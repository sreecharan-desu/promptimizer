import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/account";
import { authConfigured, ensureSchema } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!authConfigured()) return NextResponse.json({ user: null, configured: false });
  await ensureSchema();
  const user = await getCurrentUser();
  return NextResponse.json({ user, configured: true });
}
