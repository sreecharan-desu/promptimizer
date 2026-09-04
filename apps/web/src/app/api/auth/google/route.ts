import { NextRequest, NextResponse } from "next/server";
import { googleAuthReady, googleRedirectUri, OAUTH_COOKIE, safeNext } from "@/server/google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!googleAuthReady()) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const nonce = crypto.randomUUID();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", nonce);
  url.searchParams.set("prompt", "select_account");
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, JSON.stringify({ nonce, next }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
