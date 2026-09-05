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
/** Resolved collection after dim-mismatch auto-fallback (per cold start). */
let resolvedCollection: string | null = null;

export function qdrantConfigured() {
  return Boolean(process.env.QDRANT_URL?.trim());
}

export function qdrantCollection() {
  return resolvedCollection || process.env.QDRANT_COLLECTION?.trim() || "promptimizer_semantic_2048";
}

function configuredCollectionName() {
  return process.env.QDRANT_COLLECTION?.trim() || "promptimizer_semantic_2048";
}

function collectionForDim(dim: number) {
  const configured = configuredCollectionName();
  if (configured.endsWith(`_${dim}`)) return configured;
  // Prefer the canonical nvidia collection name when dim matches.
  if (dim === 2048) return "promptimizer_semantic_2048";
  if (dim === 256) return "promptimizer_semantic";
  return `${configured.replace(/_\d+$/, "")}_${dim}`;
}

function vectorSize(info: { config?: { params?: { vectors?: unknown } } }): number | null {
  const vectors = info.config?.params?.vectors;
  if (vectors && typeof vectors === "object" && "size" in vectors) {
    return Number((vectors as { size?: number }).size);
  }
  return null;
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

async function ensureOwnerIndex(q: QdrantClient, name: string) {
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
      const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 0;
      if (status !== 409) throw err;
    }
  }
}

/** Create collection if missing (Cosine, size = active embedding dim). */
export async function ensureSemanticCollection() {
  if (!qdrantConfigured()) return false;
  if (ensured && resolvedCollection) return true;
  const q = getClient();
  const dim = embeddingDim();
  let name = configuredCollectionName();
  const existing = await q.getCollections();
  const found = existing.collections?.find((c) => c.name === name);
  if (!found) {
    await q.createCollection(name, {
      vectors: { size: dim, distance: "Cosine" },
    });
  } else {
    const info = await q.getCollection(name);
    const size = vectorSize(info);
    if (size != null && size !== dim) {
      const fallback = collectionForDim(dim);
      console.warn(
        `[qdrant] collection "${name}" is ${size}-d but embeddings are ${dim}-d (${embeddingBackend()}); using "${fallback}"`,
      );
      name = fallback;
      const fallbackFound = existing.collections?.find((c) => c.name === name);
      if (!fallbackFound) {
        // May already exist but wasn't in the first list if created concurrently.
        const again = await q.getCollections();
        if (!again.collections?.find((c) => c.name === name)) {
          await q.createCollection(name, {
            vectors: { size: dim, distance: "Cosine" },
          });
        }
      } else {
        const fbInfo = await q.getCollection(name);
        const fbSize = vectorSize(fbInfo);
        if (fbSize != null && fbSize !== dim) {
          throw new Error(
            `Qdrant collection "${name}" is ${fbSize}-d but embeddings are ${dim}-d (${embeddingBackend()}).`,
          );
        }
      }
    }
  }

  await ensureOwnerIndex(q, name);
  resolvedCollection = name;
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

/** Delete all semantic points for an owner (Qdrant Cloud filter delete). */
export async function deleteSemanticByOwner(owner: string) {
  if (!qdrantConfigured() || !owner.trim()) return;
  await ensureSemanticCollection();
  const q = getClient();
  await q.delete(qdrantCollection(), {
    wait: true,
    filter: {
      must: [{ key: "owner", match: { value: owner } }],
    },
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
