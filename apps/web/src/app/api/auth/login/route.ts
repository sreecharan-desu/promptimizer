import { NextResponse } from "next/server";
import { loginUser, writeSessionCookie } from "@/server/account";
import { authConfigured } from "@/server/db";
import { clientIp, rateLimit } from "@/server/rate-limit";

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ detail: "Accounts are not configured." }, { status: 503 });
  }
  const limited = await rateLimit("auth", clientIp(request));
  if (limited) return limited;
  try {
    const body = await request.json();
    const user = await loginUser(body.email ?? "", body.password ?? "");
    await writeSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 401;
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not sign in.", code },
      { status },
    );
  }
}
