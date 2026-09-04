import { googleAuthConfigured } from "./db";

export const OAUTH_COOKIE = "pmz_oauth";

export function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function googleRedirectUri() {
  return (process.env.GOOGLE_REDIRECT_URI || `${siteOrigin()}/api/auth/google/callback`).trim();
}

export function googleAuthReady() {
  return googleAuthConfigured();
}

export function safeNext(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/console";
}
