import type { Session } from "@/lib/api";

const CACHE_KEY = "promptimizer-console-cache";

export type ConsoleCache = {
  fleetKey: string;
  sessionId: string;
  bench: unknown | null;
  completion: Record<string, unknown> | null;
  prompt: string | null;
  tab: string | null;
  benchAt: number | null;
};

/** Stable fingerprint of the connected fleet — bench is only reused when this matches. */
export function fleetKey(session: Session) {
  const models = session.models
    .filter((m) => m.selected !== false)
    .map((m) => `${m.id}:${m.tier}`)
    .sort()
    .join("|");
  return [session.mode, session.label, session.base_url, session.baseline_model ?? "", models].join("\n");
}

export function readConsoleCache(): ConsoleCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsoleCache & { savedAt?: number };
    if (!parsed || typeof parsed.fleetKey !== "string") return null;
    if (parsed.benchAt == null && typeof parsed.savedAt === "number" && parsed.bench) {
      parsed.benchAt = parsed.savedAt;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeConsoleCache(next: ConsoleCache) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
}

export function clearConsoleCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
}

export function restoreForSession(session: Session) {
  const cached = readConsoleCache();
  if (!cached) return null;
  if (cached.fleetKey !== fleetKey(session)) return null;
  return cached;
}
