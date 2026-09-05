import { cacheGet, cacheSet, cacheScope } from "./upstash";

type Bucket = { count: number; reset: number };

const memory = new Map<string, Bucket>();

function windowMs() {
  return Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
}

function limitFor(kind: "auth" | "chat" | "connect") {
  if (kind === "auth") return Number(process.env.RATE_LIMIT_AUTH ?? 20);
  if (kind === "connect") return Number(process.env.RATE_LIMIT_CONNECT ?? 30);
  return Number(process.env.RATE_LIMIT_CHAT ?? 120);
}

/**
 * Fixed-window rate limit. Returns null when allowed, or a Response when blocked.
 * Uses Upstash when configured, else in-process memory (per instance).
 */
export async function rateLimit(
  kind: "auth" | "chat" | "connect",
  identity: string,
): Promise<Response | null> {
  const id = cacheScope(identity || "anon");
  const limit = limitFor(kind);
  const window = windowMs();
  const bucketKey = `pm:rl:${kind}:${id}`;
  const now = Date.now();

  const remote = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
  if (remote) {
    const cur = (await cacheGet<Bucket>(bucketKey)) ?? { count: 0, reset: now + window };
    if (cur.reset < now) {
      cur.count = 0;
      cur.reset = now + window;
    }
    cur.count += 1;
    await cacheSet(bucketKey, cur, { ttlSeconds: Math.ceil(window / 1000) });
    if (cur.count > limit) {
      return new Response(JSON.stringify({ detail: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(Math.max(1, Math.ceil((cur.reset - now) / 1000))),
        },
      });
    }
    return null;
  }

  const cur = memory.get(bucketKey) ?? { count: 0, reset: now + window };
  if (cur.reset < now) {
    cur.count = 0;
    cur.reset = now + window;
  }
  cur.count += 1;
  memory.set(bucketKey, cur);
  if (cur.count > limit) {
    return new Response(JSON.stringify({ detail: "Rate limit exceeded. Try again shortly." }), {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(Math.max(1, Math.ceil((cur.reset - now) / 1000))),
      },
    });
  }
  return null;
}

export function clientIp(request: Request): string {
  const xf = request.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "anon";
  return request.headers.get("x-real-ip") || "anon";
}
