"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AUTH_FIELD, AuthPanel } from "./auth-panel";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(token ? null : "This link is invalid or expired.");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Could not reset password.");
      router.push("/console");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPanel title="Choose a new password" dek="This link works once and expires in an hour.">
      {token ? (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="text-sm text-secondary">New password</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className={AUTH_FIELD}
            />
          </label>
          {error ? <p className="text-sm text-error">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-60"
          >
            {busy ? "Please wait…" : "Update password"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-error">{error}</p>
      )}
      <p className="mt-6 text-sm text-secondary">
        <Link href="/forgot-password" className="text-primary">
          Send a new link
        </Link>
      </p>
    </AuthPanel>
  );
}
