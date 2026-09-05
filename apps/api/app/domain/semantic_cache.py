"""Qdrant semantic cache — same PointStruct / query_points pattern as the RAG notebooks."""

from __future__ import annotations

import logging
import re
import time
import uuid
from dataclasses import dataclass
from typing import Any, Literal

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    FilterSelector,
    MatchValue,
    PayloadSchemaType,
    PointStruct,
    VectorParams,
)

from app.core.config import get_settings
from app.domain.embeddings import embed_query, embedding_configured, embedding_dim, get_embedding

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


_client: QdrantClient | None = None
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


def _client_get() -> QdrantClient:
    """Notebook style: QdrantClient(url=...)."""
    global _client
    if _client is not None:
        return _client
    settings = get_settings()
    kwargs: dict[str, Any] = {
        "url": settings.qdrant_url.rstrip("/"),
        "prefer_grpc": False,
    }
    if settings.qdrant_api_key.strip():
        kwargs["api_key"] = settings.qdrant_api_key.strip()
    _client = QdrantClient(**kwargs)
    return _client


def ensure_collection() -> bool:
    """create_collection(VectorParams(size=2048, distance=Distance.COSINE)) like the notebook."""
    global _ensured
    if not qdrant_configured():
        return False
    if _ensured:
        return True

    qdrant_client = _client_get()
    name = collection_name()
    dim = embedding_dim()
    existing = {c.name for c in qdrant_client.get_collections().collections}

    if name not in existing:
        qdrant_client.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=dim, distance=Distance.COSINE),
        )
    else:
        info = qdrant_client.get_collection(name)
        params = info.config.params.vectors
        size = int(params.size) if hasattr(params, "size") else None
        if size is not None and size != dim:
            raise RuntimeError(
                f'Qdrant collection "{name}" is {size}-d but embeddings are {dim}-d. '
                "Set QDRANT_COLLECTION to a new name."
            )

    try:
        qdrant_client.create_payload_index(
            collection_name=name,
            field_name="owner",
            field_schema=PayloadSchemaType.KEYWORD,
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


def _entry_from_payload(point_id: Any, payload: dict[str, Any]) -> SemanticEntry | None:
    if not payload.get("answer") or not payload.get("prompt"):
        return None
    return SemanticEntry(
        id=str(payload.get("entry_id") or point_id),
        prompt=str(payload["prompt"]),
        answer=str(payload["answer"]),
        model=str(payload.get("model") or ""),
        tier=str(payload.get("tier") or ""),
        quality=float(payload.get("quality") or 0),
        created_at=float(payload.get("created_at") or 0),
    )


async def find_similar(prompt: str, owner: str) -> SemanticMatch | None:
    """Notebook retrieve: embed → query_points → read payload + score from results.points."""
    if not semantic_enabled() or not qdrant_configured() or not owner.strip():
        return None
    try:
        ensure_collection()
        query_embedding = await embed_query(prompt)
        qdrant_client = _client_get()
        results = qdrant_client.query_points(
            collection_name=collection_name(),
            query=query_embedding,
            limit=8,
            with_payload=True,
            query_filter=Filter(
                must=[FieldCondition(key="owner", match=MatchValue(value=owner))]
            ),
        )

        candidates: list[tuple[SemanticEntry, float]] = []
        for result in results.points or []:
            payload = result.payload or {}
            entry = _entry_from_payload(result.id, payload)
            if not entry:
                continue
            candidates.append((entry, float(result.score or 0)))
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
    """Notebook upsert: PointStruct(id, vector, payload) → upsert(wait=True, points=[...])."""
    if not semantic_enabled() or not qdrant_configured():
        return
    if not prompt.strip() or not answer.strip() or not owner.strip():
        return
    try:
        ensure_collection()
        embedding = await embed_query(prompt)
        entry_id = f"sem_{uuid.uuid4().hex[:12]}"
        point_id = str(uuid.uuid4())

        point = PointStruct(
            id=point_id,
            vector=embedding,
            payload={
                "prompt": prompt[:12_000],
                "answer": answer[:24_000],
                "model": model,
                "tier": tier,
                "quality": quality,
                "owner": owner,
                "created_at": time.time() * 1000,
                "entry_id": entry_id,
                "embed_model": get_settings().embedding_model or "nvidia/nemotron-3-embed-1b",
            },
        )

        qdrant_client = _client_get()
        qdrant_client.upsert(
            collection_name=collection_name(),
            wait=True,
            points=[point],
        )
    except Exception as err:  # noqa: BLE001
        logger.warning("semantic remember failed: %s", err)


async def delete_semantic_by_owner(owner: str) -> None:
    if not qdrant_configured() or not owner.strip():
        return
    try:
        ensure_collection()
        qdrant_client = _client_get()
        qdrant_client.delete(
            collection_name=collection_name(),
            points_selector=FilterSelector(
                filter=Filter(
                    must=[FieldCondition(key="owner", match=MatchValue(value=owner))]
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


# Sync helpers matching notebook cell names (useful for scripts / smoke tests).
def retrieve_data(query: str, owner: str, k: int = 5) -> dict[str, Any]:
    """Sync retrieve like 03-RAG-pipeline.retrieve_data."""
    ensure_collection()
    query_embedding = get_embedding(query)
    results = _client_get().query_points(
        collection_name=collection_name(),
        query=query_embedding,
        limit=k,
        with_payload=True,
        query_filter=Filter(
            must=[FieldCondition(key="owner", match=MatchValue(value=owner))]
        ),
    )
    prompts: list[str] = []
    answers: list[str] = []
    scores: list[float] = []
    for result in results.points:
        payload = result.payload or {}
        prompts.append(str(payload.get("prompt") or ""))
        answers.append(str(payload.get("answer") or ""))
        scores.append(float(result.score or 0))
    return {
        "retrieved_prompts": prompts,
        "retrieved_answers": answers,
        "similarity_scores": scores,
    }
