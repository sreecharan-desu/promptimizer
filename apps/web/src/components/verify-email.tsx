"use client";

import Link from "next/link";
import { useState } from "react";
import { AUTH_FIELD, AuthPanel } from "./auth-panel";

export function VerifyEmail({ email, error }: { email?: string; error?: string }) {
  const [value, setValue] = useState(email ?? "");
  const [note, setNote] = useState<string | null>(
    error === "invalid" ? "This link is invalid or expired." : null,
  );
  const [busy, setBusy] = useState(false);

  async function resend(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = await response.json();
      setNote(data.detail ?? "If that email needs verification, we sent a link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel
      title={error === "invalid" ? "Link expired" : "Check your email"}
      dek={
        error === "invalid"
          ? "Ask for a new verification link and try again."
          : "We sent a verification link. Open it to finish creating your account."
      }
    >
      <form onSubmit={resend} className="space-y-4">
        <label className="block">
          <span className="text-sm text-secondary">Email</span>
          <input
            type="email"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="email"
            className={AUTH_FIELD}
          />
        </label>
        {note ? <p className="text-sm text-secondary">{note}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? "Please wait…" : "Send another link"}
        </button>
      </form>
      <p className="mt-6 text-sm text-secondary">
        <Link href="/login" className="text-primary">
          Back to sign in
        </Link>
      </p>
    </AuthPanel>
  );
}
