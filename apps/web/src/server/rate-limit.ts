import { cacheScope } from "./upstash";

type Bucket = { count: number; reset: number };

const memory = new Map<string, Bucket>();

function windowMs(kind: "auth" | "chat" | "connect" | "judge") {
  if (kind === "judge") return Number(process.env.RATE_LIMIT_JUDGE_WINDOW_MS ?? 3_600_000);
  return Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
}

function limitFor(kind: "auth" | "chat" | "connect" | "judge") {
  if (kind === "auth") return Number(process.env.RATE_LIMIT_AUTH ?? 20);
  if (kind === "connect") return Number(process.env.RATE_LIMIT_CONNECT ?? 30);
  if (kind === "judge") return Number(process.env.RATE_LIMIT_JUDGE ?? 30);
  return Number(process.env.RATE_LIMIT_CHAT ?? 120);
}

function blocked(reset: number) {
  return new Response(JSON.stringify({ detail: "Rate limit exceeded. Try again shortly." }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
    },
  });
}

/**
 * Fixed-window rate limit. Uses atomic INCR when Upstash REST is configured.
 */
export async function rateLimit(
  kind: "auth" | "chat" | "connect" | "judge",
  identity: string,
): Promise<Response | null> {
  const id = cacheScope(identity || "anon");
  const limit = limitFor(kind);
  const window = windowMs(kind);
  const bucketKey = `pm:rl:${kind}:${id}`;
  const now = Date.now();

  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (url && token) {
    try {
      const incr = await fetch(`${url}/incr/${encodeURIComponent(bucketKey)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = (await incr.json()) as { result?: number };
      const count = Number(body.result ?? 0);
      if (count === 1) {
        await fetch(`${url}/pexpire/${encodeURIComponent(bucketKey)}/${window}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (count > limit) {
        return blocked(now + window);
      }
      return null;
    } catch {
      /* fall through to memory */
    }
  }

  const cur = memory.get(bucketKey) ?? { count: 0, reset: now + window };
  if (cur.reset < now) {
    cur.count = 0;
    cur.reset = now + window;
  }
  cur.count += 1;
  memory.set(bucketKey, cur);
  if (cur.count > limit) return blocked(cur.reset);
  return null;
}

export function clientIp(request: Request): string {
  // Vercel overwrites this header, so a client cannot prepend a fake address.
  const platform = request.headers.get("x-vercel-forwarded-for");
  if (platform) {
    const ip = platform.split(",").map((part) => part.trim()).find(Boolean);
    if (ip) return ip;
  }
  if (process.env.VERCEL) {
    const real = request.headers.get("x-real-ip")?.trim();
    if (real) return real;
  }
  return "anon";
}
