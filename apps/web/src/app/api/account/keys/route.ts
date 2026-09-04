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
      last_used_at: k.last_used_at,
      created_at: k.created_at,
    })),
  });
}

export async function POST(request: Request) {
  const gate = await requireUser();
  if ("error" in gate) return gate.error;
  const body = await request.json().catch(() => ({}));
  const created = await createKey(gate.user.id, typeof body.name === "string" ? body.name : "Default");
  return NextResponse.json(created);
}
