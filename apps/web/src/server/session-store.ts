import { cacheDel, cacheGet, cacheSet, cacheScope } from "./upstash";
import type { Session } from "./engine";

const SESSION_TTL = () => Number(process.env.SESSION_CACHE_TTL_SECONDS ?? 86_400);

function sessionKey(sessionId: string) {
  return `pm:sess:${cacheScope(sessionId)}`;
}

/** Persist BYOK session (incl. provider keys) to Redis so Vercel instances share fleet state. */
export async function persistSession(session: Session) {
  await cacheSet(sessionKey(session.id), session, { ttlSeconds: SESSION_TTL() });
}

export async function loadPersistedSession(sessionId: string): Promise<Session | null> {
  const row = await cacheGet<Session>(sessionKey(sessionId));
  if (!row?.id || !Array.isArray(row.connections)) return null;
  return row;
}

export async function deletePersistedSession(sessionId: string) {
  await cacheDel(sessionKey(sessionId));
}
