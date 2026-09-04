import { NextResponse } from "next/server";
import { setPassword, writeSessionCookie } from "@/server/account";
import { authConfigured } from "@/server/db";
import { consumeEmailToken } from "@/server/email-auth";

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ detail: "Accounts are not configured." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    const userId = await consumeEmailToken(token, "reset");
    await setPassword(userId, password);
    await writeSessionCookie(userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not reset password." },
      { status },
    );
  }
}
