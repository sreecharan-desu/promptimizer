"""Qdrant-backed semantic cache (prompt → answer replay)."""

from __future__ import annotations

import logging
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any, Literal

from app.core.config import get_settings
from app.domain.embeddings import embed_query, embedding_configured, embedding_dim

logger = logging.getLogger(__name__)

Mode = Literal["full", "hybrid", "miss"]


@dataclass
class SemanticEntry:
    id: str
    prompt: str
    answer: str
    model: str
    tier: str
    quality: float
    created_at: float


@dataclass
class SemanticMatch:
    entry: SemanticEntry
    similarity: float
    mode: Mode
    novel: str
    shared_ratio: float


_client = None
_ensured = False


def semantic_enabled() -> bool:
    settings = get_settings()
    raw = (settings.semantic_cache or "true").strip().lower()
    return raw not in {"0", "false", "off"}


def qdrant_configured() -> bool:
    settings = get_settings()
    return bool(settings.qdrant_url.strip()) and embedding_configured()


def collection_name() -> str:
    return get_settings().qdrant_collection.strip() or "promptimizer_semantic_2048"


def _client_get():
    global _client
    if _client is not None:
        return _client
    from qdrant_client import QdrantClient

    settings = get_settings()
    kwargs: dict[str, Any] = {
        "url": settings.qdrant_url.rstrip("/"),
        "prefer_grpc": False,
    }
    if settings.qdrant_api_key.strip():
        kwargs["api_key"] = settings.qdrant_api_key.strip()
    # Docker compose hostname
    if settings.qdrant_url.startswith("http://qdrant:"):
        kwargs["url"] = settings.qdrant_url.rstrip("/")
    _client = QdrantClient(**kwargs)
    return _client


def ensure_collection() -> bool:
    global _ensured
    if not qdrant_configured():
        return False
    if _ensured:
        return True
    from qdrant_client.http import models as qm

    q = _client_get()
    name = collection_name()
    dim = embedding_dim()
    existing = {c.name for c in q.get_collections().collections}
    if name not in existing:
        q.create_collection(
            collection_name=name,
            vectors_config=qm.VectorParams(size=dim, distance=qm.Distance.COSINE),
        )
    else:
        info = q.get_collection(name)
        size = None
        params = info.config.params.vectors
        if hasattr(params, "size"):
            size = int(params.size)
        if size is not None and size != dim:
            raise RuntimeError(
                f'Qdrant collection "{name}" is {size}-d but embeddings are {dim}-d. '
                "Set QDRANT_COLLECTION to a new name."
            )
    try:
        q.create_payload_index(
            collection_name=name,
            field_name="owner",
            field_schema=qm.PayloadSchemaType.KEYWORD,
        )
    except Exception as err:  # noqa: BLE001
        msg = str(err).lower()
        if "already" not in msg and "conflict" not in msg and "exists" not in msg:
            logger.warning("payload index owner: %s", err)
    _ensured = True
    return True


def _normalize(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"[.…]+$", "", s)
    s = re.sub(r"\s+", " ", s)
    return s


def _canonicalize(text: str) -> str:
    s = _normalize(text)
    s = s.replace("×", "*").replace("x", "*")
    s = re.sub(r"\btimes\b", "*", s)
    s = re.sub(r"\bmultiplied by\b", "*", s)
    s = re.sub(r"[^0-9*+\-/\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    # Prefer compact math form when digits present
    nums = re.findall(r"\d+", s)
    if len(nums) >= 2 and "*" in s:
        return f"{nums[0]} * {nums[1]}"
    return _normalize(text)


def _entities_compatible(a: str, b: str) -> bool:
    if _canonicalize(a) and _canonicalize(a) == _canonicalize(b):
        return True
    na = set(re.findall(r"\d+", a))
    nb = set(re.findall(r"\d+", b))
    if na or nb:
        return na == nb
    # Negation flip
    neg_a = bool(re.search(r"\bnot\b|n't\b", a.lower()))
    neg_b = bool(re.search(r"\bnot\b|n't\b", b.lower()))
    if neg_a != neg_b:
        return False
    return True


def _threshold() -> float:
    return float(get_settings().semantic_threshold)


def _full_hit() -> float:
    return float(get_settings().semantic_full_hit)


def _paraphrase_hit() -> float:
    return float(get_settings().semantic_paraphrase_hit)


def _pick(
    prompt: str,
    candidates: list[tuple[SemanticEntry, float]],
) -> SemanticMatch | None:
    if not candidates:
        return None
    prompt_norm = _normalize(prompt)
    prompt_canon = _canonicalize(prompt)
    best_any: tuple[SemanticEntry, float, bool, bool, bool] | None = None
    best_safe: tuple[SemanticEntry, float, bool, bool, bool] | None = None

    for entry, raw_sim in candidates:
        same_norm = bool(prompt_norm and prompt_norm == _normalize(entry.prompt))
        same_canon = bool(prompt_canon and prompt_canon == _canonicalize(entry.prompt))
        compatible = same_norm or same_canon or _entities_compatible(prompt, entry.prompt)
        sim = 1.0 if same_norm or same_canon else raw_sim
        cand = (entry, sim, compatible, same_canon, same_norm)
        if best_any is None or sim > best_any[1]:
            best_any = cand
        if compatible and (best_safe is None or sim > best_safe[1]):
            best_safe = cand

    pick = best_safe or best_any
    if not pick:
        return None
    entry, sim, compatible, same_canon, same_norm = pick
    shared_ratio = 1.0 if same_norm or same_canon else 0.5
    novel = "" if same_norm or same_canon else prompt

    if not compatible:
        return SemanticMatch(entry, sim, "miss", prompt, shared_ratio)

    if same_norm or same_canon or sim >= _full_hit() or (sim >= _paraphrase_hit() and compatible):
        return SemanticMatch(
            entry,
            1.0 if same_norm or same_canon else sim,
            "full",
            "",
            shared_ratio,
        )
    if sim >= _threshold():
        return SemanticMatch(entry, sim, "hybrid", novel, shared_ratio)
    return SemanticMatch(entry, sim, "miss", prompt, shared_ratio)


async def find_similar(prompt: str, owner: str) -> SemanticMatch | None:
    if not semantic_enabled() or not qdrant_configured() or not owner.strip():
        return None
    try:
        ensure_collection()
        vector = await embed_query(prompt)
        from qdrant_client.http import models as qm

        q = _client_get()
        hits = q.query_points(
            collection_name=collection_name(),
            query=vector,
            limit=8,
            with_payload=True,
            query_filter=qm.Filter(
                must=[qm.FieldCondition(key="owner", match=qm.MatchValue(value=owner))]
            ),
        )
        candidates: list[tuple[SemanticEntry, float]] = []
        for hit in hits.points or []:
            p = hit.payload or {}
            if not p.get("answer") or not p.get("prompt"):
                continue
            entry = SemanticEntry(
                id=str(p.get("entry_id") or hit.id),
                prompt=str(p["prompt"]),
                answer=str(p["answer"]),
                model=str(p.get("model") or ""),
                tier=str(p.get("tier") or ""),
                quality=float(p.get("quality") or 0),
                created_at=float(p.get("created_at") or 0),
            )
            candidates.append((entry, float(hit.score or 0)))
        return _pick(prompt, candidates)
    except Exception as err:  # noqa: BLE001
        logger.warning("semantic find_similar failed: %s", err)
        return None


async def remember_semantic(
    *,
    prompt: str,
    answer: str,
    model: str,
    tier: str,
    quality: float,
    owner: str,
) -> None:
    if not semantic_enabled() or not qdrant_configured():
        return
    if not prompt.strip() or not answer.strip() or not owner.strip():
        return
    try:
        ensure_collection()
        vector = await embed_query(prompt)
        entry_id = f"sem_{uuid.uuid4().hex[:12]}"
        from qdrant_client.http import models as qm

        q = _client_get()
        q.upsert(
            collection_name=collection_name(),
            wait=True,
            points=[
                qm.PointStruct(
                    id=str(uuid.uuid4()),
                    vector=vector,
                    payload={
                        "prompt": prompt[:12_000],
                        "answer": answer[:24_000],
                        "model": model,
                        "tier": tier,
                        "quality": quality,
                        "owner": owner,
                        "created_at": time.time() * 1000,
                        "entry_id": entry_id,
                        "embed_backend": "nvidia",
                    },
                )
            ],
        )
    except Exception as err:  # noqa: BLE001
        logger.warning("semantic remember failed: %s", err)


async def delete_semantic_by_owner(owner: str) -> None:
    if not qdrant_configured() or not owner.strip():
        return
    try:
        ensure_collection()
        from qdrant_client.http import models as qm

        q = _client_get()
        q.delete(
            collection_name=collection_name(),
            points_selector=qm.FilterSelector(
                filter=qm.Filter(
                    must=[qm.FieldCondition(key="owner", match=qm.MatchValue(value=owner))]
                )
            ),
        )
    except Exception as err:  # noqa: BLE001
        logger.warning("semantic delete failed: %s", err)


def build_hybrid_messages(
    messages: list[dict[str, Any]],
    match: SemanticMatch,
) -> list[dict[str, Any]]:
    system_extra = "\n".join(
        [
            "You are continuing a related request. A similar prior answer is cached below.",
            "Reuse correct shared reasoning. Focus compute on the NEW / dissimilar parts.",
            f"Similarity: {match.similarity * 100:.1f}%.",
            "",
            "=== CACHED SIMILAR PROMPT ===",
            match.entry.prompt[:4000],
            "",
            "=== CACHED ANSWER ===",
            match.entry.answer[:6000],
            "",
            "=== NOVEL / DISSIMILAR FOCUS ===",
            (match.novel[:4000] or "(minor wording change — adapt the cached answer carefully)"),
        ]
    )
    out = [dict(m) for m in messages]
    for i, m in enumerate(out):
        if m.get("role") == "system":
            out[i] = {**m, "content": f"{m.get('content', '')}\n\n{system_extra}"}
            return out
    out.insert(0, {"role": "system", "content": system_extra})
    return out
