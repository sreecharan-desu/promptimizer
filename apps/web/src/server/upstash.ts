const memory = new Map<string, { exp: number; value: unknown }>();

function rest() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url, token };
}

export function cacheConfigured() {
  return Boolean(rest());
}

async function command<T>(...parts: Array<string | number>): Promise<T | null> {
  const cfg = rest();
  if (!cfg) return null;
  const response = await fetch(`${cfg.url}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(parts),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { result?: T };
  return payload.result ?? null;
}

function ttl() {
  return Number(process.env.CACHE_TTL_SECONDS ?? 3600);
}

/** Sanitize owner id for Redis key segments (user id or session id). */
export function cacheScope(owner?: string | null) {
  const raw = (owner ?? "").trim() || "anon";
  return raw.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 96);
}

/** Per-user / per-session cache key — never share completions across accounts. */
export function userCacheKey(owner: string | null | undefined, ...parts: string[]) {
  return ["pm", "u", cacheScope(owner), ...parts].join(":");
}

function ownerKeyset(owner: string | null | undefined) {
  return userCacheKey(owner, "keyset");
}

async function trackKey(owner: string | null | undefined, key: string) {
  if (!owner) return;
  const setKey = ownerKeyset(owner);
  const remote = rest();
  if (remote) {
    await command("SADD", setKey, key);
    await command("EXPIRE", setKey, Math.max(ttl() * 2, 7200));
    return;
  }
  const existing = (memory.get(setKey)?.value as string[] | undefined) ?? [];
  if (!existing.includes(key)) existing.push(key);
  memory.set(setKey, { exp: Date.now() + Math.max(ttl() * 2, 7200) * 1000, value: existing });
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const remote = rest();
  if (remote) {
    const raw = await command<string | null>("GET", key);
    if (raw == null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as T;
    }
  }
  const item = memory.get(key);
  if (!item || item.exp < Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return item.value as T;
}

export async function cacheSet(key: string, value: unknown, opts?: { owner?: string | null; ttlSeconds?: number }) {
  const packed = JSON.stringify(value);
  const exp = opts?.ttlSeconds ?? ttl();
  const remote = rest();
  if (remote) {
    await command("SET", key, packed, "EX", exp);
  } else {
    memory.set(key, { exp: Date.now() + exp * 1000, value });
  }
  const owner =
    opts?.owner ??
    (/^pm:u:([^:]+):/.exec(key)?.[1] && /^pm:u:([^:]+):/.exec(key)![1] !== "anon"
      ? /^pm:u:([^:]+):/.exec(key)![1]
      : null);
  if (owner) await trackKey(owner, key);
}

/** Back-compat helper. */
export async function cacheSetTracked(owner: string | null | undefined, key: string, value: unknown) {
  await cacheSet(key, value, { owner });
}

export async function cacheRemember(key: string) {
  const existing = await cacheGet(key);
  if (existing !== undefined) return true;
  await cacheSet(key, true);
  return false;
}

export async function cacheDel(...keys: string[]) {
  if (!keys.length) return;
  const remote = rest();
  if (remote) {
    await command("DEL", ...keys);
    return;
  }
  for (const key of keys) memory.delete(key);
}

/**
 * Delete all tracked completion/semantic keys for an owner.
 * Also clears known fixed keys (semantic index) even if keyset is empty.
 */
export async function clearOwnerCaches(owner: string | null | undefined) {
  if (!owner?.trim()) return { deleted: 0 };
  const scope = cacheScope(owner);
  const setKey = ownerKeyset(owner);
  const fixed = [
    userCacheKey(owner, "semantic", "index"),
    setKey,
  ];

  let tracked: string[] = [];
  const remote = rest();
  if (remote) {
    tracked = ((await command<string[]>("SMEMBERS", setKey)) ?? []).filter(Boolean);
  } else {
    tracked = ((memory.get(setKey)?.value as string[] | undefined) ?? []).slice();
  }

  // SCAN fallback for any untracked keys (best-effort).
  const scanned: string[] = [];
  if (remote) {
    let cursor = "0";
    do {
      const res = await command<[string, string[]]>("SCAN", cursor, "MATCH", `pm:u:${scope}:*`, "COUNT", 200);
      if (!res) break;
      cursor = String(res[0] ?? "0");
      scanned.push(...(res[1] ?? []));
    } while (cursor !== "0");
  } else {
    for (const key of memory.keys()) {
      if (key.startsWith(`pm:u:${scope}:`)) scanned.push(key);
    }
  }

  const all = [...new Set([...tracked, ...scanned, ...fixed])];
  if (all.length) await cacheDel(...all);

  try {
    const { deleteSemanticByOwner, qdrantConfigured } = await import("./qdrant-semantic");
    if (qdrantConfigured()) await deleteSemanticByOwner(owner);
  } catch {
    /* qdrant optional */
  }

  return { deleted: all.length };
}
