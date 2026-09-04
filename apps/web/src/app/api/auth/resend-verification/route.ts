import { NextRequest, NextResponse } from "next/server";
import { authConfigured } from "@/server/db";
import { requestVerification } from "@/server/email-auth";
import { siteOrigin } from "@/server/google";
import { mailConfigured } from "@/server/mail";

const OK = { detail: "If that email needs verification, we sent a link." };

export async function POST(request: NextRequest) {
  if (!authConfigured() || !mailConfigured()) {
    return NextResponse.json(OK);
  }
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    if (email.includes("@")) {
      await requestVerification(email, siteOrigin(request));
    }
  } catch {
    /* same response either way */
  }
  return NextResponse.json(OK);
}
