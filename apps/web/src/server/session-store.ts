import { cacheDel, cacheGet, cacheSet, cacheScope } from "./upstash";
import { decryptText, encryptText } from "./crypto";
import type { Session } from "./engine";

const SESSION_TTL = () => Number(process.env.SESSION_CACHE_TTL_SECONDS ?? 86_400);

function sessionKey(sessionId: string) {
  return `pm:sess:${cacheScope(sessionId)}`;
}

function encryptionReady() {
  return Boolean(process.env.ENCRYPTION_KEY?.trim());
}

/** Encrypt BYOK keys before Redis so a compromised cache cannot steal provider secrets. */
function sealSession(session: Session): Session {
  if (!encryptionReady()) return session;
  try {
    return {
      ...session,
      api_key: session.api_key ? encryptText(session.api_key) : "",
      connections: session.connections.map((c) => ({
        ...c,
        api_key: c.api_key ? encryptText(c.api_key) : "",
      })),
    };
  } catch {
    return session;
  }
}

function unsealSession(row: Session): Session {
  if (!encryptionReady()) return row;
  const looksEncrypted = (v: string) => /^[0-9a-f]+\.[0-9a-f]+\.[0-9a-f]+$/i.test(v);
  try {
    return {
      ...row,
      api_key: row.api_key && looksEncrypted(row.api_key) ? decryptText(row.api_key) : row.api_key,
      connections: (row.connections ?? []).map((c) => ({
        ...c,
        api_key: c.api_key && looksEncrypted(c.api_key) ? decryptText(c.api_key) : c.api_key,
      })),
    };
  } catch {
    return row;
  }
}

/** Persist BYOK session (incl. provider keys) to Redis so Vercel instances share fleet state. */
export async function persistSession(session: Session) {
  await cacheSet(sessionKey(session.id), sealSession(session), { ttlSeconds: SESSION_TTL() });
}

export async function loadPersistedSession(sessionId: string): Promise<Session | null> {
  const row = await cacheGet<Session>(sessionKey(sessionId));
  if (!row?.id || !Array.isArray(row.connections)) return null;
  return unsealSession(row);
}

export async function deletePersistedSession(sessionId: string) {
  await cacheDel(sessionKey(sessionId));
}
