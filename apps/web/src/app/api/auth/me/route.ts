import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/account";
import { authConfigured } from "@/server/db";

export async function GET() {
  if (!authConfigured()) return NextResponse.json({ user: null, configured: false });
  const user = await getCurrentUser();
  return NextResponse.json({ user, configured: true });
}
