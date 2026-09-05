/**
 * Embeddings for semantic cache.
 * Prefer notebook model: nvidia/nemotron-3-embed-1b via NVIDIA Integrate API (2048-d).
 * Falls back to local hashed vectors (256-d) when no embedding API key is set.
 */

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "nvidia/nemotron-3-embed-1b";
export const NVIDIA_EMBED_DIM = 2048;
export const LOCAL_EMBED_DIM = 256;

export type EmbeddingBackend = "nvidia" | "local";

export function embeddingApiKey() {
  return (
    process.env.NVIDIA_API_KEY?.trim() ||
    process.env.EMBEDDING_API_KEY?.trim() ||
    ""
  );
}

export function embeddingBaseURL() {
  return process.env.EMBEDDING_BASE_URL?.trim().replace(/\/$/, "") || NVIDIA_BASE;
}

export function embeddingModel() {
  return process.env.EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
}

export function embeddingBackend(): EmbeddingBackend {
  return embeddingApiKey() ? "nvidia" : "local";
}

export function embeddingDim() {
  const forced = Number(process.env.EMBEDDING_DIM ?? "");
  if (Number.isFinite(forced) && forced > 0) return forced;
  return embeddingBackend() === "nvidia" ? NVIDIA_EMBED_DIM : LOCAL_EMBED_DIM;
}

export async function embedQuery(text: string, localEmbed: (t: string) => number[]): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) return new Array(embeddingDim()).fill(0);

  if (embeddingBackend() === "local") {
    return localEmbed(trimmed);
  }

  const response = await fetch(`${embeddingBaseURL()}/embeddings`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${embeddingApiKey()}`,
    },
    body: JSON.stringify({
      input: trimmed.slice(0, 8000),
      model: embeddingModel(),
      encoding_format: "float",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`Embedding failed (${response.status}): ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };
  const vector = data.data?.[0]?.embedding;
  if (!vector?.length) throw new Error("Embedding response missing vector");
  return vector;
}
