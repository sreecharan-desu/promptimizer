import { NextResponse } from "next/server";
import { createUser, writeSessionCookie } from "@/server/account";
import { authConfigured } from "@/server/db";

export async function POST(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ detail: "Accounts are not configured. Set DATABASE_URL, AUTH_SECRET, and ENCRYPTION_KEY." }, { status: 503 });
  }
  try {
    const body = await request.json();
    const user = await createUser({ email: body.email ?? "", password: body.password ?? "", name: body.name ?? "" });
    await writeSessionCookie(user.id);
    return NextResponse.json({ user });
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    return NextResponse.json({ detail: error instanceof Error ? error.message : "Could not create account." }, { status });
  }
}
