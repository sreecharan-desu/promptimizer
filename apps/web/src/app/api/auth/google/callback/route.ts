import { NextRequest, NextResponse } from "next/server";
import { upsertGoogleUser, writeSessionCookie } from "@/server/account";
import { googleAuthReady, googleRedirectUri, OAUTH_COOKIE, safeNext } from "@/server/google";

export const dynamic = "force-dynamic";

function fail(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}

function claimsFromIdToken(idToken?: string) {
  if (!idToken) return {} as Record<string, unknown>;
  try {
    const payload = idToken.split(".")[1];
    if (!payload) return {};
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function normalizeAvatar(url?: string | null) {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (!parsed.hostname.endsWith("googleusercontent.com")) return raw;
    parsed.search = "";
    parsed.pathname = parsed.pathname.replace(/=s\d+(-c)?$/i, "");
    return `${parsed.origin}${parsed.pathname}=s96-c`;
  } catch {
    return raw;
  }
}

export async function GET(request: NextRequest) {
  if (!googleAuthReady()) return fail(request, "google_not_configured");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const raw = request.cookies.get(OAUTH_COOKIE)?.value;
  if (!code || !state || !raw) return fail(request, "google");

  let saved: { nonce?: string; next?: string } = {};
  try {
    saved = JSON.parse(raw) as { nonce?: string; next?: string };
  } catch {
    return fail(request, "google");
  }
  if (!saved.nonce || saved.nonce !== state) return fail(request, "google");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
  };
  if (!tokenRes.ok || !tokens.access_token) return fail(request, "google");

  const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await profileRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };
  const claims = claimsFromIdToken(tokens.id_token);
  const sub = profile.sub || (typeof claims.sub === "string" ? claims.sub : undefined);
  const email = profile.email || (typeof claims.email === "string" ? claims.email : undefined);
  const emailVerified =
    profile.email_verified !== false && claims.email_verified !== false && claims.email_verified !== "false";
  const name =
    profile.name ||
    (typeof claims.name === "string" ? claims.name : "") ||
    (typeof claims.given_name === "string" ? claims.given_name : "");
  const picture = normalizeAvatar(
    profile.picture || (typeof claims.picture === "string" ? claims.picture : null),
  );

  if (!sub || !email || !emailVerified) return fail(request, "google");

  const user = await upsertGoogleUser({
    email,
    name,
    sub,
    picture: picture ?? undefined,
  });
  await writeSessionCookie(user.id);
  const response = NextResponse.redirect(new URL(safeNext(saved.next), request.url));
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}
