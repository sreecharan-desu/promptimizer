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

export async function cacheSet(key: string, value: unknown) {
  const packed = JSON.stringify(value);
  const remote = rest();
  if (remote) {
    await command("SET", key, packed, "EX", ttl());
    return;
  }
  memory.set(key, { exp: Date.now() + ttl() * 1000, value });
}

export async function cacheRemember(key: string) {
  const existing = await cacheGet(key);
  if (existing !== undefined) return true;
  await cacheSet(key, true);
  return false;
}
