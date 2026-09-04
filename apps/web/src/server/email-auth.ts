import { randomBytes } from "crypto";
import { hashToken, newId } from "./crypto";
import { ensureSchema, getSql } from "./db";
import { resetMessage, sendMail, verificationMessage } from "./mail";

export type EmailPurpose = "verify" | "reset";

const VERIFY_MS = 24 * 60 * 60 * 1000;
const RESET_MS = 60 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;

function asRecord(row: unknown) {
  return row as Record<string, unknown>;
}

async function recentToken(userId: string, purpose: EmailPurpose) {
  const rows = await getSql()`
    SELECT created_at FROM email_tokens
    WHERE user_id = ${userId} AND purpose = ${purpose}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const created = rows[0] ? asRecord(rows[0]).created_at : null;
  if (!created) return false;
  const at = created instanceof Date ? created.getTime() : Date.parse(String(created));
  return Number.isFinite(at) && Date.now() - at < COOLDOWN_MS;
}

async function issueToken(userId: string, purpose: EmailPurpose, ttlMs: number) {
  await ensureSchema();
  if (await recentToken(userId, purpose)) return null;
  const raw = randomBytes(32).toString("base64url");
  await getSql()`
    UPDATE email_tokens
    SET consumed_at = now()
    WHERE user_id = ${userId} AND purpose = ${purpose} AND consumed_at IS NULL
  `;
  await getSql()`
    INSERT INTO email_tokens (id, user_id, purpose, token_hash, expires_at)
    VALUES (${newId("emt")}, ${userId}, ${purpose}, ${hashToken(raw)}, ${new Date(Date.now() + ttlMs)})
  `;
  return raw;
}

export async function consumeEmailToken(raw: string, purpose: EmailPurpose) {
  await ensureSchema();
  const token = raw.trim();
  if (!token) throw Object.assign(new Error("This link is invalid or expired."), { status: 400 });
  const rows = await getSql()`
    SELECT t.id, t.user_id
    FROM email_tokens t
    WHERE t.token_hash = ${hashToken(token)}
      AND t.purpose = ${purpose}
      AND t.consumed_at IS NULL
      AND t.expires_at > now()
  `;
  const row = rows[0] ? asRecord(rows[0]) : null;
  if (!row) throw Object.assign(new Error("This link is invalid or expired."), { status: 400 });
  await getSql()`UPDATE email_tokens SET consumed_at = now() WHERE id = ${String(row.id)}`;
  return String(row.user_id);
}

export async function sendVerificationEmail(userId: string, email: string, origin: string) {
  const token = await issueToken(userId, "verify", VERIFY_MS);
  if (!token) return;
  const message = verificationMessage(origin, token);
  await sendMail({ to: email, ...message });
}

export async function sendResetEmail(userId: string, email: string, origin: string) {
  const token = await issueToken(userId, "reset", RESET_MS);
  if (!token) return;
  const message = resetMessage(origin, token);
  await sendMail({ to: email, ...message });
}

export async function requestVerification(email: string, origin: string) {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, email, email_verified_at, password_hash
    FROM users WHERE email = ${email.trim().toLowerCase()}
  `;
  const row = rows[0] ? asRecord(rows[0]) : null;
  if (!row || row.email_verified_at || !row.password_hash) return;
  await sendVerificationEmail(String(row.id), String(row.email), origin);
}

export async function requestPasswordReset(email: string, origin: string) {
  await ensureSchema();
  const rows = await getSql()`
    SELECT id, email, password_hash
    FROM users WHERE email = ${email.trim().toLowerCase()}
  `;
  const row = rows[0] ? asRecord(rows[0]) : null;
  if (!row || !row.password_hash) return;
  await sendResetEmail(String(row.id), String(row.email), origin);
}
