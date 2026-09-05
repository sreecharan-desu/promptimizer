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

function indexKey(owner?: string | null) {
  return userCacheKey(owner, "semantic", "index");
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** Env: SEMANTIC_THRESHOLD (default 0.5), SEMANTIC_FULL_HIT (default 0.92). */
export function semanticThreshold() {
  const n = Number(process.env.SEMANTIC_THRESHOLD ?? 0.5);
  return Number.isFinite(n) ? clamp01(n) : 0.5;
}

export function semanticFullHit() {
  const n = Number(process.env.SEMANTIC_FULL_HIT ?? 0.92);
  return Number.isFinite(n) ? clamp01(n) : 0.92;
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

/** Lightweight hashed bag-of-tokens + char-trigrams → fixed vector (no external embed API). */
export function embedText(text: string): number[] {
  const vec = new Float64Array(DIM);
  const normalized = normalizeCachePrompt(text);
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

export async function findSimilar(prompt: string, owner?: string | null): Promise<SemanticMatch | null> {
  if (!semanticEnabled()) return null;
  const embedding = embedText(prompt);
  const promptNorm = normalizeCachePrompt(prompt);
  const index = await loadIndex(owner);
  if (!index.length) return null;

  let best: SemanticEntry | null = null;
  let bestSim = 0;
  for (const entry of index) {
    if (!entry?.answer) continue;
    // Re-embed from stored prompt so lookup stays correct after normalize/embed tweaks.
    const entryVec = entry.prompt ? embedText(entry.prompt) : entry.embedding;
    if (!entryVec?.length) continue;
    const sameNorm = promptNorm && promptNorm === normalizeCachePrompt(entry.prompt);
    const sim = sameNorm ? 1 : cosineSimilarity(embedding, entryVec);
    if (sim > bestSim) {
      bestSim = sim;
      best = entry;
    }
  }
  if (!best) return null;

  const threshold = semanticThreshold();
  const full = semanticFullHit();
  const { novel, shared_ratio } = extractNovelParts(prompt, best.prompt);
  const sameAsBest = Boolean(promptNorm && promptNorm === normalizeCachePrompt(best.prompt));

  if (bestSim >= full || sameAsBest) {
    return { entry: best, similarity: sameAsBest ? 1 : bestSim, mode: "full", novel: "", shared_ratio };
  }
  if (bestSim >= threshold) {
    return { entry: best, similarity: bestSim, mode: "hybrid", novel, shared_ratio };
  }
  return { entry: best, similarity: bestSim, mode: "miss", novel: prompt, shared_ratio };
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
  const index = await loadIndex(input.owner);
  index.push(entry);
  await saveIndex(input.owner, index);
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
