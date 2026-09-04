import { NextResponse } from "next/server";
import { loginUser, writeSessionCookie } from "@/server/account";
import { authConfigured } from "@/server/db";

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ detail: "Accounts are not configured." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const user = await loginUser(body.email ?? "", body.password ?? "");
    await writeSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 401;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Could not sign in." }, { status });
  }
}
