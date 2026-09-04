import { NextResponse } from "next/server";
import { getCurrentUser, savingsForUser } from "@/server/account";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Sign in required." }, { status: 401 });
  return NextResponse.json(await savingsForUser(user.id));
}
