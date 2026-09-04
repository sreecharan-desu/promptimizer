import { NextResponse } from "next/server";
import { getCurrentUser, revokeKey } from "@/server/account";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Sign in required." }, { status: 401 });
  const { id } = await ctx.params;
  await revokeKey(user.id, id);
  return NextResponse.json({ ok: true });
}
