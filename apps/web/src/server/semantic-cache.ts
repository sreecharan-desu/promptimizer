import { cacheGet, cacheSet, userCacheKey } from "./upstash";

export type SemanticEntry = {
  id: string;
  prompt: string;
  embedding: number[];
  answer: string;
  model: string;
  tier: string;
  quality: number;
  created_at: number;
};

export type SemanticMatch = {
  entry: SemanticEntry;
  similarity: number;
  mode: "full" | "hybrid" | "miss";
  novel: string;
  shared_ratio: number;
};

const DIM = 256;

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "are",
  "was",
  "were",
  "be",
  "to",
  "of",
  "in",
  "on",
  "for",
  "and",
  "or",
  "at",
  "by",
  "as",
  "it",
  "this",
  "that",
  "with",
  "from",
  "what",
  "whats",
  "which",
  "who",
  "whom",
  "how",
  "why",
  "when",
  "where",
  "please",
  "kindly",
  "just",
  "me",
  "my",
  "your",
  "you",
  "i",
  "we",
  "only",
  "reply",
  "answer",
  "number",
  "result",
  "value",
  "equals",
  "equal",
]);

function indexKey(owner?: string | null) {
  return userCacheKey(owner, "semantic", "index");
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Env: SEMANTIC_THRESHOLD (default 0.5), SEMANTIC_FULL_HIT (default 0.88). */
export function semanticThreshold() {
  const n = Number(process.env.SEMANTIC_THRESHOLD ?? 0.5);
  return Number.isFinite(n) ? clamp01(n) : 0.5;
}

export function semanticFullHit() {
  const n = Number(process.env.SEMANTIC_FULL_HIT ?? 0.88);
  return Number.isFinite(n) ? clamp01(n) : 0.88;
}

/** Soft floor for paraphrase full-hits when entities/negation also align. */
export function semanticParaphraseHit() {
  const n = Number(process.env.SEMANTIC_PARAPHRASE_HIT ?? 0.62);
  return Number.isFinite(n) ? clamp01(n) : 0.62;
}

export function semanticEnabled() {
  const raw = (process.env.SEMANTIC_CACHE ?? "true").trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function hashToken(token: string) {
  let h = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Canonical form for prompt-cache keys + embeddings.
 * Strips trailing ellipsis/punctuation so "What is 17 * 24?..." ≡ "What is 17 * 24?".
 */
export function normalizeCachePrompt(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\u2026/g, "...")
    .replace(/[×✕✖⨯]/g, "*")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?:\.{2,}|…+|[.!?]+)+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fold paraphrases into a shared surface form for embedding + equality checks.
 * "Calculate 17 multiplied by 24" → "17 * 24"
 */
export function canonicalizeSemanticPrompt(text: string): string {
  let s = normalizeCachePrompt(text);
  s = s
    .replace(/\bmultiplied\s+by\b/g, "*")
    .replace(/\btimes\b/g, "*")
    .replace(/\bproduct\s+of\b/g, "*")
    .replace(/\bdivided\s+by\b/g, "/")
    .replace(/\bplus\b/g, "+")
    .replace(/\bminus\b/g, "-")
    .replace(/\badded\s+to\b/g, "+")
    .replace(/\bsubtract(?:ed)?\s+from\b/g, "-");
  // 17x24 / 17 x 24 → 17 * 24
  s = s.replace(/(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/g, "$1 * $2");
  s = s.replace(/\b(?:please|kindly|compute|calculate|evaluate|solve|determine|find|tell\s+me|give\s+me|can\s+you|could\s+you)\b/g, " ");
  s = s.replace(/\bwhat(?:'s|s)?\b/g, " ");
  s = s.replace(/\b(?:is|are|the|a|an|of|to|for|result|answer|equals?|=)\b/g, " ");
  s = s.replace(/\s*([*+/])\s*/g, " $1 ");
  s = s.replace(/[^a-z0-9_*+./\s-]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

export type PromptEntities = {
  numbers: string[];
  ops: Array<"*" | "+" | "-" | "/">;
  negated: boolean;
  tokens: string[];
};

export function extractPromptEntities(text: string): PromptEntities {
  const canon = canonicalizeSemanticPrompt(text);
  const raw = normalizeCachePrompt(text);
  const numbers = (canon.match(/\d+(?:\.\d+)?/g) ?? []).map(String);
  const ops = (canon.match(/[*+/-]/g) ?? []) as Array<"*" | "+" | "-" | "/">;
  const negated = /\b(not|never|no|without|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|cannot|can't)\b/i.test(
    raw,
  );
  const tokens = canon
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t) && !/^\d+(?:\.\d+)?$/.test(t));
  return { numbers, ops, negated, tokens };
}

function sortedJoin(xs: string[]) {
  return [...xs].sort().join("\0");
}

function opsCommutative(ops: Array<"*" | "+" | "-" | "/">) {
  return ops.length > 0 && ops.every((o) => o === "*" || o === "+");
}

/** True when replaying the cached answer is safe (same facts / no polarity flip). */
export function entitiesCompatible(a: string, b: string): boolean {
  const ea = extractPromptEntities(a);
  const eb = extractPromptEntities(b);
  if (ea.negated !== eb.negated) return false;

  if (ea.numbers.length || eb.numbers.length) {
    if (ea.numbers.length !== eb.numbers.length) return false;
    const commutative =
      (opsCommutative(ea.ops) && opsCommutative(eb.ops)) ||
      (ea.ops.length === 0 && eb.ops.length === 0 && ea.numbers.length >= 2);
    const numsOk = commutative
      ? sortedJoin(ea.numbers) === sortedJoin(eb.numbers)
      : ea.numbers.join("\0") === eb.numbers.join("\0");
    if (!numsOk) return false;
    if (ea.ops.length && eb.ops.length) {
      const oa = sortedJoin(ea.ops);
      const ob = sortedJoin(eb.ops);
      if (!commutative && ea.ops.join("") !== eb.ops.join("")) return false;
      if (commutative && oa !== ob) return false;
    }
    return true;
  }

  if (!ea.tokens.length || !eb.tokens.length) return false;
  const setA = new Set(ea.tokens);
  const setB = new Set(eb.tokens);
  let inter = 0;
  for (const t of setA) if (setB.has(t)) inter += 1;
  const union = new Set([...setA, ...setB]).size || 1;
  return inter / union >= 0.5 && inter >= Math.min(2, Math.min(setA.size, setB.size));
}

/** Lightweight hashed bag-of-tokens + char-trigrams → fixed vector (no external embed API). */
export function embedText(text: string): number[] {
  const vec = new Float64Array(DIM);
  const normalized = canonicalizeSemanticPrompt(text) || normalizeCachePrompt(text);
  if (!normalized) return Array.from(vec);

  const tokens = normalized.split(/[^a-z0-9_+./-]+/).filter(Boolean);
  for (const token of tokens) {
    const idx = hashToken(token) % DIM;
    vec[idx] += 1;
    if (token.length >= 4) {
      const idx2 = hashToken(`##${token.slice(0, 4)}`) % DIM;
      vec[idx2] += 0.5;
    }
  }
  for (let i = 0; i < normalized.length - 2; i += 1) {
    const tri = normalized.slice(i, i + 3);
    if (/\s/.test(tri)) continue;
    vec[hashToken(`tri:${tri}`) % DIM] += 0.25;
  }

  let norm = 0;
  for (let i = 0; i < DIM; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Array<number>(DIM);
  for (let i = 0; i < DIM; i += 1) out[i] = vec[i] / norm;
  return out;
}

export function cosineSimilarity(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? clamp01(dot / denom) : 0;
}

/** Sentences/clauses in `prompt` that are weakly covered by `cachedPrompt`. */
export function extractNovelParts(prompt: string, cachedPrompt: string): { novel: string; shared_ratio: number } {
  const parts = prompt
    .split(/(?<=[.!?])\s+|\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 12);
  if (!parts.length) {
    return { novel: prompt.trim(), shared_ratio: 0 };
  }
  const cached = cachedPrompt.toLowerCase();
  const novelParts: string[] = [];
  let shared = 0;
  for (const part of parts) {
    const tokens = part
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 3);
    if (!tokens.length) {
      novelParts.push(part);
      continue;
    }
    const hit = tokens.filter((t) => cached.includes(t)).length / tokens.length;
    if (hit >= 0.65) shared += 1;
    else novelParts.push(part);
  }
  const shared_ratio = shared / parts.length;
  return {
    novel: novelParts.join(" ").trim() || prompt.trim(),
    shared_ratio,
  };
}

async function loadIndex(owner?: string | null): Promise<SemanticEntry[]> {
  const rows = (await cacheGet<SemanticEntry[]>(indexKey(owner))) ?? [];
  return Array.isArray(rows) ? rows : [];
}

async function saveIndex(owner: string | null | undefined, rows: SemanticEntry[]) {
  const max = Math.max(32, Number(process.env.SEMANTIC_CACHE_SIZE ?? 200) || 200);
  await cacheSet(indexKey(owner), rows.slice(-max));
}

function entryFromPayload(p: {
  prompt: string;
  answer: string;
  model: string;
  tier: string;
  quality: number;
  created_at: number;
  entry_id: string;
}): SemanticEntry {
  return {
    id: p.entry_id,
    prompt: p.prompt,
    embedding: [],
    answer: p.answer,
    model: p.model,
    tier: p.tier,
    quality: p.quality,
    created_at: p.created_at,
  };
}

function pickMatch(
  prompt: string,
  candidates: Array<{ entry: SemanticEntry; sim: number }>,
): SemanticMatch | null {
  if (!candidates.length) return null;
  const promptNorm = normalizeCachePrompt(prompt);
  const promptCanon = canonicalizeSemanticPrompt(prompt);

  type Cand = { entry: SemanticEntry; sim: number; compatible: boolean; sameCanon: boolean; sameNorm: boolean };
  let bestAny: Cand | null = null;
  let bestSafe: Cand | null = null;

  for (const { entry, sim: rawSim } of candidates) {
    if (!entry?.answer) continue;
    const sameNorm = Boolean(promptNorm && promptNorm === normalizeCachePrompt(entry.prompt));
    const sameCanon = Boolean(promptCanon && promptCanon === canonicalizeSemanticPrompt(entry.prompt));
    const compatible = sameNorm || sameCanon || entitiesCompatible(prompt, entry.prompt);
    const sim = sameNorm || sameCanon ? 1 : rawSim;
    const cand: Cand = { entry, sim, compatible, sameCanon, sameNorm };
    if (!bestAny || sim > bestAny.sim) bestAny = cand;
    if (compatible && (!bestSafe || sim > bestSafe.sim)) bestSafe = cand;
  }

  const pick = bestSafe ?? bestAny;
  if (!pick) return null;

  const threshold = semanticThreshold();
  const full = semanticFullHit();
  const paraphrase = semanticParaphraseHit();
  const { novel, shared_ratio } = extractNovelParts(prompt, pick.entry.prompt);

  if (!pick.compatible) {
    return { entry: pick.entry, similarity: pick.sim, mode: "miss", novel: prompt, shared_ratio };
  }

  if (pick.sameNorm || pick.sameCanon || pick.sim >= full || (pick.sim >= paraphrase && pick.compatible)) {
    return {
      entry: pick.entry,
      similarity: pick.sameNorm || pick.sameCanon ? 1 : pick.sim,
      mode: "full",
      novel: "",
      shared_ratio,
    };
  }
  if (pick.sim >= threshold) {
    return { entry: pick.entry, similarity: pick.sim, mode: "hybrid", novel, shared_ratio };
  }
  return { entry: pick.entry, similarity: pick.sim, mode: "miss", novel: prompt, shared_ratio };
}

export async function findSimilar(prompt: string, owner?: string | null): Promise<SemanticMatch | null> {
  if (!semanticEnabled()) return null;

  // Qdrant path (Cloud / self-hosted) when configured.
  try {
    const { qdrantConfigured, searchSemanticPoints } = await import("./qdrant-semantic");
    if (qdrantConfigured() && owner) {
      const { embedQuery } = await import("./embeddings");
      const vector = await embedQuery(prompt, embedText);
      const hits = await searchSemanticPoints({ vector, owner: String(owner), limit: 8 });
      const candidates = hits.map((h) => ({ entry: entryFromPayload(h.payload), sim: h.score }));
      const match = pickMatch(prompt, candidates);
      if (match) return match;
      // Fall through to Redis/memory if Qdrant has no hits yet.
    }
  } catch (err) {
    console.warn("[semantic-cache] qdrant search failed; falling back", err);
  }

  const embedding = embedText(prompt);
  const index = await loadIndex(owner);
  if (!index.length) return null;

  const candidates: Array<{ entry: SemanticEntry; sim: number }> = [];
  for (const entry of index) {
    if (!entry?.answer) continue;
    const entryVec = entry.prompt ? embedText(entry.prompt) : entry.embedding;
    if (!entryVec?.length) continue;
    candidates.push({ entry, sim: cosineSimilarity(embedding, entryVec) });
  }
  return pickMatch(prompt, candidates);
}

export async function rememberSemantic(input: {
  prompt: string;
  answer: string;
  model: string;
  tier: string;
  quality: number;
  owner?: string | null;
}) {
  if (!semanticEnabled()) return;
  if (!input.prompt.trim() || !input.answer.trim()) return;
  const entry: SemanticEntry = {
    id: `sem_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`,
    prompt: input.prompt.slice(0, 12_000),
    embedding: embedText(input.prompt),
    answer: input.answer.slice(0, 24_000),
    model: input.model,
    tier: input.tier,
    quality: input.quality,
    created_at: Date.now(),
  };

  let wroteQdrant = false;
  try {
    const { qdrantConfigured, upsertSemanticPoint } = await import("./qdrant-semantic");
    if (qdrantConfigured() && input.owner) {
      const { embedQuery, embeddingBackend } = await import("./embeddings");
      const vector = await embedQuery(input.prompt, embedText);
      await upsertSemanticPoint({
        vector,
        payload: {
          prompt: entry.prompt,
          answer: entry.answer,
          model: entry.model,
          tier: entry.tier,
          quality: entry.quality,
          owner: String(input.owner),
          created_at: entry.created_at,
          entry_id: entry.id,
          embed_backend: embeddingBackend(),
        },
      });
      wroteQdrant = true;
    }
  } catch (err) {
    console.warn("[semantic-cache] qdrant upsert failed; falling back to redis", err);
  }

  // Always keep a Redis/memory copy as hot fallback (and for unit tests without Qdrant).
  if (!wroteQdrant || process.env.SEMANTIC_DUAL_WRITE !== "0") {
    const index = await loadIndex(input.owner);
    index.push(entry);
    await saveIndex(input.owner, index);
  }
}

export function buildHybridMessages(
  textMessages: Array<{ role: string; content: string }>,
  match: SemanticMatch,
): Array<{ role: string; content: string }> {
  const systemExtra = [
    "You are continuing a related request. A similar prior answer is cached below.",
    "Reuse correct shared reasoning. Focus compute on the NEW / dissimilar parts.",
    `Similarity: ${(match.similarity * 100).toFixed(1)}%. Shared-ratio: ${(match.shared_ratio * 100).toFixed(0)}%.`,
    "",
    "=== CACHED SIMILAR PROMPT ===",
    match.entry.prompt.slice(0, 4000),
    "",
    "=== CACHED ANSWER ===",
    match.entry.answer.slice(0, 6000),
    "",
    "=== NOVEL / DISSIMILAR FOCUS ===",
    match.novel.slice(0, 4000) || "(minor wording change — adapt the cached answer carefully)",
  ].join("\n");

  const out = [...textMessages];
  const sysIdx = out.findIndex((m) => m.role === "system");
  if (sysIdx >= 0) {
    out[sysIdx] = { ...out[sysIdx], content: `${out[sysIdx].content}\n\n${systemExtra}` };
  } else {
    out.unshift({ role: "system", content: systemExtra });
  }
  return out;
}
