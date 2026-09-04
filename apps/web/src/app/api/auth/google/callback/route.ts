import { NextRequest, NextResponse } from "next/server";
import { upsertGoogleUser, writeSessionCookie } from "@/server/account";
import { googleAuthReady, googleRedirectUri, OAUTH_COOKIE, safeNext } from "@/server/google";

export const dynamic = "force-dynamic";

function fail(request: NextRequest, code: string) {
  const response = NextResponse.redirect(new URL(`/login?error=${code}`, request.url));
  response.cookies.delete(OAUTH_COOKIE);
  return response;
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
  const tokens = (await tokenRes.json()) as { access_token?: string; error?: string };
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
  if (!profile.sub || !profile.email || profile.email_verified === false) return fail(request, "google");

  const user = await upsertGoogleUser({
    email: profile.email,
    name: profile.name ?? "",
    sub: profile.sub,
    picture: profile.picture,
  });
  await writeSessionCookie(user.id);
  const response = NextResponse.redirect(new URL(safeNext(saved.next), request.url));
  response.cookies.delete(OAUTH_COOKIE);
  return response;
}
