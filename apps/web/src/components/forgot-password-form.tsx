"use client";

import Link from "next/link";
import { useState } from "react";
import { AUTH_FIELD, AuthPanel } from "./auth-panel";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      setNote(data.detail ?? "If that email is on an account, we sent a link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel title="Forgot password" dek="We’ll email a reset link if that address has a password.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-sm text-secondary">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            className={AUTH_FIELD}
          />
        </label>
        {note ? <p className="text-sm text-secondary">{note}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-60"
        >
          {busy ? "Please wait…" : "Send reset link"}
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
