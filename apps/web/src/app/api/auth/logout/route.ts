import { NextResponse } from "next/server";
import { clearSessionCookie, getCurrentUser } from "@/server/account";
import { accountSessionId, destroySession, invalidateOwnerCaches } from "@/server/engine";

export async function POST() {
  const user = await getCurrentUser().catch(() => null);
  if (user) {
    try {
      await destroySession(accountSessionId(user.id), user.id);
      await invalidateOwnerCaches(user.id);
    } catch {
      /* best-effort clear */
    }
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
