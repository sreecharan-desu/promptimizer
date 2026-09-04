import { NextRequest, NextResponse } from "next/server";
import { writeSessionCookie } from "@/server/account";
import { authConfigured, getSql, ensureSchema } from "@/server/db";
import { consumeEmailToken } from "@/server/email-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const fail = new URL("/verify?error=invalid", request.url);
  if (!authConfigured() || !token) {
    return NextResponse.redirect(fail);
  }
  try {
    const userId = await consumeEmailToken(token, "verify");
    await ensureSchema();
    await getSql()`UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = ${userId}`;
    await writeSessionCookie(userId);
    return NextResponse.redirect(new URL("/console", request.url));
  } catch {
    return NextResponse.redirect(fail);
  }
}
