import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/server/account";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
