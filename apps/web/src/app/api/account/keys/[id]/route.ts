import { NextResponse } from "next/server";
import { getCurrentUser, revokeKey, updateKey } from "@/server/account";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Sign in required." }, { status: 401 });
  const { id } = await ctx.params;
  await revokeKey(user.id, id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Sign in required." }, { status: 401 });
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  await updateKey(user.id, id, {
    name: typeof body.name === "string" ? body.name : undefined,
    monthly_budget_usd:
      typeof body.monthly_budget_usd === "number"
        ? body.monthly_budget_usd
        : body.monthly_budget_usd === null
          ? null
          : undefined,
    environment: typeof body.environment === "string" ? body.environment : undefined,
    is_active: typeof body.is_active === "boolean" ? body.is_active : undefined,
    reset_spend: Boolean(body.reset_spend),
  });
  return NextResponse.json({ ok: true });
}
