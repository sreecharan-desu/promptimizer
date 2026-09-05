import { QdrantClient } from "@qdrant/js-client-rest";
import { embeddingBackend, embeddingDim } from "./embeddings";

export type QdrantSemanticPayload = {
  prompt: string;
  answer: string;
  model: string;
  tier: string;
  quality: number;
  owner: string;
  created_at: number;
  entry_id: string;
  embed_backend: string;
};

let client: QdrantClient | null = null;
let ensured = false;

export function qdrantConfigured() {
  return Boolean(process.env.QDRANT_URL?.trim());
}

export function qdrantCollection() {
  return process.env.QDRANT_COLLECTION?.trim() || "promptimizer_semantic";
}

function qdrantUrl() {
  return process.env.QDRANT_URL!.trim().replace(/\/$/, "");
}

function getClient() {
  if (!client) {
    client = new QdrantClient({
      url: qdrantUrl(),
      apiKey: process.env.QDRANT_API_KEY?.trim() || undefined,
      checkCompatibility: false,
    });
  }
  return client;
}

/** Create collection if missing (Cosine, size = active embedding dim). */
export async function ensureSemanticCollection() {
  if (!qdrantConfigured()) return false;
  if (ensured) return true;
  const q = getClient();
  const name = qdrantCollection();
  const dim = embeddingDim();
  const existing = await q.getCollections();
  const found = existing.collections?.find((c) => c.name === name);
  if (!found) {
    await q.createCollection(name, {
      vectors: { size: dim, distance: "Cosine" },
    });
  } else {
    const info = await q.getCollection(name);
    const vectors = info.config?.params?.vectors;
    const size =
      vectors && typeof vectors === "object" && "size" in vectors
        ? Number((vectors as { size?: number }).size)
        : null;
    if (size != null && size !== dim) {
      throw new Error(
        `Qdrant collection "${name}" is ${size}-d but embeddings are ${dim}-d (${embeddingBackend()}). ` +
          `Set QDRANT_COLLECTION to a new name or EMBEDDING_DIM=${size}.`,
      );
    }
  }

  // Qdrant Cloud requires a keyword index before filtering on payload fields.
  try {
    await q.createPayloadIndex(name, {
      field_name: "owner",
      field_schema: "keyword",
      wait: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/already exists|duplicate|conflict/i.test(msg)) {
      // Some clusters return 409 differently — ignore only known "exists" cases.
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 0;
      if (status !== 409) throw err;
    }
  }

  ensured = true;
  return true;
}

export async function upsertSemanticPoint(input: {
  vector: number[];
  payload: QdrantSemanticPayload;
}) {
  await ensureSemanticCollection();
  const q = getClient();
  await q.upsert(qdrantCollection(), {
    wait: true,
    points: [
      {
        id: crypto.randomUUID(),
        vector: input.vector,
        payload: input.payload as unknown as Record<string, unknown>,
      },
    ],
  });
}

export async function searchSemanticPoints(input: {
  vector: number[];
  owner: string;
  limit?: number;
}): Promise<Array<{ score: number; payload: QdrantSemanticPayload }>> {
  await ensureSemanticCollection();
  const q = getClient();
  const result = await q.query(qdrantCollection(), {
    query: input.vector,
    limit: input.limit ?? 8,
    with_payload: true,
    filter: {
      must: [{ key: "owner", match: { value: input.owner } }],
    },
  });

  const points = result.points ?? [];
  const rows: Array<{ score: number; payload: QdrantSemanticPayload }> = [];
  for (const hit of points) {
    const p = (hit.payload ?? {}) as Partial<QdrantSemanticPayload>;
    if (!p.answer || !p.prompt) continue;
    rows.push({
      score: Number(hit.score ?? 0),
      payload: {
        prompt: String(p.prompt),
        answer: String(p.answer),
        model: String(p.model ?? ""),
        tier: String(p.tier ?? ""),
        quality: Number(p.quality ?? 0),
        owner: String(p.owner ?? ""),
        created_at: Number(p.created_at ?? 0),
        entry_id: String(p.entry_id ?? hit.id),
        embed_backend: String(p.embed_backend ?? ""),
      },
    });
  }
  return rows;
}
