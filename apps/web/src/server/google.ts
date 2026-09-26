import type { NextRequest } from "next/server";
import { googleAuthConfigured } from "./db";

export const OAUTH_COOKIE = "pmz_oauth";

/** Canonical site origin. Never taken from Host or X-Forwarded-Host. */
export function siteOrigin(_request?: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || process.env.WEB_ORIGIN?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  return "https://www.promptimizer.site";
}

/** Prefer exact env URI so Google Console and token exchange always match. */
export function googleRedirectUri(request?: NextRequest) {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return `${siteOrigin(request)}/api/auth/google/callback`;
}

export function googleAuthReady() {
  return googleAuthConfigured();
}

export function safeNext(value: string | null | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/console";
}
