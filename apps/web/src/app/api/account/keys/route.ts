import { NextResponse } from "next/server";
import { createKey, getCurrentUser, listKeys } from "@/server/account";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ detail: "Sign in required." }, { status: 401 }) };
  return { user };
}

export async function GET() {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const keys = await listKeys(gate.user.id);
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      monthly_budget_usd: k.monthly_budget_usd != null ? Number(k.monthly_budget_usd) : null,
      current_spend_usd: Number(k.current_spend_usd || 0),
      environment: k.environment || "production",
      is_active: k.is_active ?? true,
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const body = await request.json().catch(() => ({}));
  const budget =
    typeof body.monthly_budget_usd === "number"
      ? body.monthly_budget_usd
      : typeof body.monthly_budget_usd === "string" && !isNaN(Number(body.monthly_budget_usd))
        ? Number(body.monthly_budget_usd)
        : null;
  const env = typeof body.environment === "string" ? body.environment : "production";
  const created = await createKey(gate.user.id, typeof body.name === "string" ? body.name : "Default", {
    monthly_budget_usd: budget,
    environment: env,
  });
  return NextResponse.json(created);
}
