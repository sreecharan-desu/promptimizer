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

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function transport() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: mailUser(), pass: mailPass() },
    });
  }
  return transporter;
}

export async function sendMail(input: { to: string; subject: string; text: string; html: string }) {
  if (!mailConfigured()) {
    throw Object.assign(new Error("Email is not configured."), { status: 503 });
  }
  await transport().sendMail({
    from: `Promptimizer <${mailUser()}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

function wrap(body: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:32px 16px;background:#f6f6f4;font-family:ui-sans-serif,system-ui,sans-serif;color:#111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#fff;border:1px solid #ecece8;border-radius:16px;padding:32px;">
            <tr>
              <td style="font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:#8a8a82;">Promptimizer</td>
            </tr>
            <tr><td style="padding-top:20px;">${body}</td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;background:#111;color:#fff;text-decoration:none;border-radius:999px;padding:12px 18px;font-size:14px;font-weight:500;">${label}</a>`;
}

export function verificationMessage(origin: string, token: string) {
  const href = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
  return {
    subject: "Verify your Promptimizer email",
    text: `Confirm this address to finish creating your account.\n\n${href}\n\nThis link expires in 24 hours. If you did not create an account, ignore this email.`,
    html: wrap(
      `<h1 style="margin:0;font-size:24px;font-weight:500;letter-spacing:-0.03em;">Verify your email</h1>
       <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#5c5c56;">Confirm this address to finish creating your account. The link expires in 24 hours.</p>
       ${button(href, "Verify email")}
       <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#8a8a82;">If you did not create an account, you can ignore this email.</p>`,
    ),
  };
}

export function resetMessage(origin: string, token: string) {
  const href = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  return {
    subject: "Reset your Promptimizer password",
    text: `Use this link to choose a new password.\n\n${href}\n\nThis link expires in 1 hour. If you did not ask to reset your password, ignore this email.`,
    html: wrap(
      `<h1 style="margin:0;font-size:24px;font-weight:500;letter-spacing:-0.03em;">Reset your password</h1>
       <p style="margin:12px 0 0;font-size:15px;line-height:1.55;color:#5c5c56;">Choose a new password for your account. The link expires in one hour.</p>
       ${button(href, "Choose a new password")}
       <p style="margin:24px 0 0;font-size:13px;line-height:1.5;color:#8a8a82;">If you did not ask for this, you can ignore this email.</p>`,
    ),
  };
}
