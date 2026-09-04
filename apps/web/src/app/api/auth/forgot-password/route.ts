import { NextRequest, NextResponse } from "next/server";
import { authConfigured } from "@/server/db";
import { requestPasswordReset } from "@/server/email-auth";
import { siteOrigin } from "@/server/google";
import { mailConfigured } from "@/server/mail";

const OK = { detail: "If that email is on an account, we sent a link." };

export async function POST(request: NextRequest) {
  if (!authConfigured() || !mailConfigured()) {
    return NextResponse.json(OK);
  }
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    if (email.includes("@")) {
      await requestPasswordReset(email, siteOrigin(request));
    }
  } catch {
    /* same response either way */
  }
  return NextResponse.json(OK);
}
