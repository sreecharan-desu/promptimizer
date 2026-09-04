"use client";

export type AuthMe = {
  user: { id?: string; name: string; email: string; avatarUrl?: string | null } | null;
  configured: boolean;
};

let cached: AuthMe | null = null;
let inflight: Promise<AuthMe> | null = null;
const listeners = new Set<(me: AuthMe) => void>();

function publish(me: AuthMe) {
  cached = me;
  for (const listener of listeners) listener(me);
}

export function getCachedMe() {
  return cached;
}

export function subscribeMe(listener: (me: AuthMe) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function invalidateMe() {
  cached = null;
  inflight = null;
}

export async function loadMe(force = false): Promise<AuthMe> {
  if (!force && cached) return cached;
  if (!force && inflight) return inflight;
  inflight = fetch("/api/auth/me", { credentials: "include" })
    .then(async (response) => {
      const data = (await response.json()) as AuthMe;
      publish(data);
      return data;
    })
    .catch(() => {
      const fallback = { user: null, configured: false };
      publish(fallback);
      return fallback;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
