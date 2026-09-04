import { NextRequest, NextResponse } from "next/server";
import { createUser, deleteUser } from "@/server/account";
import { authConfigured } from "@/server/db";
import { sendVerificationEmail } from "@/server/email-auth";
import { siteOrigin } from "@/server/google";
import { mailConfigured } from "@/server/mail";

export async function POST(request: NextRequest) {
  if (!authConfigured()) {
    return NextResponse.json(
      { detail: "Accounts are not configured. Set DATABASE_URL, AUTH_SECRET, and ENCRYPTION_KEY." },
      { status: 503 },
    );
  }
  if (!mailConfigured()) {
    return NextResponse.json({ detail: "Email sending is not configured." }, { status: 503 });
  }
  let user: { id: string; email: string } | null = null;
  try {
    const body = await request.json();
    user = await createUser({ email: body.email ?? "", password: body.password ?? "", name: body.name ?? "" });
    await sendVerificationEmail(user.id, user.email, siteOrigin(request));
    return NextResponse.json({ verify: true, email: user.email });
  } catch (error) {
    if (user) {
      try {
        await deleteUser(user.id);
      } catch {
        /* keep the original error */
      }
    }
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : 400;
    return NextResponse.json(
      { detail: error instanceof Error ? error.message : "Could not create account." },
      { status },
    );
  }
}
