import { randomUUID } from "crypto";
import nodemailer from "nodemailer";

export function mailConfigured() {
  return Boolean(process.env.GOOGLE_MAIL_USER?.trim() && process.env.GOOGLE_MAIL_PASSWORD?.trim());
}

function mailUser() {
  const value = process.env.GOOGLE_MAIL_USER?.trim();
  if (!value) throw Object.assign(new Error("Email is not configured."), { status: 503 });
  return value;
}

function mailPass() {
  const value = process.env.GOOGLE_MAIL_PASSWORD?.replace(/\s+/g, "");
  if (!value) throw Object.assign(new Error("Email is not configured."), { status: 503 });
  return value;
}

function mailFromName() {
  return process.env.MAIL_FROM_NAME?.trim() || "Promptimizer";
}

function mailReplyTo() {
  return process.env.MAIL_REPLY_TO?.trim() || mailUser();
}

function senderDomain() {
  const host = mailUser().split("@")[1];
  return host || "gmail.com";
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function transport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: mailUser(), pass: mailPass() },
      tls: { minVersion: "TLSv1.2" },
    });
  }
  return transporter;
}

export async function sendMail(input: { to: string; subject: string; text: string; html: string }) {
  if (!mailConfigured()) {
    throw Object.assign(new Error("Email is not configured."), { status: 503 });
  }
  const fromAddress = mailUser();
  const messageId = `<pmz.${randomUUID()}@${senderDomain()}>`;
  await transport().sendMail({
    from: { name: mailFromName(), address: fromAddress },
    sender: fromAddress,
    replyTo: mailReplyTo(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    messageId,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
      "Precedence": "auto_reply",
      "List-Id": `<transactional.promptimizer>`,
      "List-Unsubscribe": `<mailto:${fromAddress}?subject=unsubscribe>`,
      "X-Entity-Ref-ID": randomUUID(),
    },
  });
}

/** Quiet transactional layout — plain, aligned text/html, no marketing chrome. */
function wrap(title: string, paragraphs: string[], href: string, cta: string) {
  const paras = paragraphs
    .map((p) => `<p style="margin:0 0 16px;font-size:15px;line-height:1.5;color:#222222;">${p}</p>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#222222;">
    <p style="margin:0 0 24px;font-size:14px;color:#222222;"><strong>Promptimizer</strong></p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;line-height:1.3;color:#111111;">${title}</h1>
    ${paras}
    <p style="margin:24px 0;">
      <a href="${href}" style="color:#111111;font-size:15px;font-weight:600;">${cta}</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#555555;">Or paste this URL into your browser:</p>
    <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;color:#555555;">${href}</p>
    <p style="margin:0;font-size:12px;line-height:1.5;color:#777777;">You received this because someone used this address with Promptimizer. If that was not you, ignore this message.</p>
  </div>
</body>
</html>`;
}

export function verificationMessage(origin: string, token: string) {
  const href = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
  const subject = "Confirm your Promptimizer account";
  const text = [
    "Promptimizer",
    "",
    "Confirm your Promptimizer account",
    "",
    "Open the link below to verify this email and finish creating your account.",
    "The link expires in 24 hours.",
    "",
    href,
    "",
    "If you did not create a Promptimizer account, you can ignore this email.",
  ].join("\n");
  return {
    subject,
    text,
    html: wrap(
      "Confirm your Promptimizer account",
      [
        "Open the link below to verify this email and finish creating your account.",
        "The link expires in 24 hours.",
      ],
      href,
      "Verify email address",
    ),
  };
}

export function resetMessage(origin: string, token: string) {
  const href = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = "Reset your Promptimizer password";
  const text = [
    "Promptimizer",
    "",
    "Reset your Promptimizer password",
    "",
    "Open the link below to choose a new password.",
    "The link expires in one hour.",
    "",
    href,
    "",
    "If you did not ask to reset your password, you can ignore this email.",
  ].join("\n");
  return {
    subject,
    text,
    html: wrap(
      "Reset your Promptimizer password",
      ["Open the link below to choose a new password.", "The link expires in one hour."],
      href,
      "Choose a new password",
    ),
  };
}
