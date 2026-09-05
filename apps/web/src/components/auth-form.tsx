"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { invalidateMe, loadMe } from "@/lib/auth-me";
import { AUTH_FIELD, AuthPanel } from "./auth-panel";

const ERRORS: Record<string, string> = {
  google: "Google sign-in did not complete. Try again.",
  google_not_configured: "Google sign-in is not available right now.",
};

export function AuthForm({
  mode,
  next,
  configured,
  mailReady,
  errorCode,
}: {
  mode: "login" | "signup";
  next?: string;
  configured: boolean;
  mailReady: boolean;
  errorCode?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? ERRORS[errorCode] ?? "Could not sign in." : null);
  const [unverified, setUnverified] = useState(false);
  const [busy, setBusy] = useState(false);
  const dest = next && next.startsWith("/") ? next : "/console";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setUnverified(false);
    try {
      const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "unverified") setUnverified(true);
        throw new Error(data.detail ?? "Request failed");
      }
      if (data.verify) {
        router.push(`/verify?sent=1&email=${encodeURIComponent(email.trim().toLowerCase())}`);
        return;
      }
      invalidateMe();
      await loadMe(true);
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      router.push(`/verify?sent=1&email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } finally {
      setBusy(false);
    }
  }

  const emailSignupBlocked = mode === "signup" && !mailReady;

  return (
    <AuthPanel
      title={mode === "signup" ? "Create an account" : "Sign in"}
      dek={mode === "signup" ? "Then open the console and mint an API key." : "Access the console, keys, and savings."}
    >
      {!configured ? (
        <p className="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm text-secondary">
          Accounts need DATABASE_URL, AUTH_SECRET, and ENCRYPTION_KEY in the environment.
        </p>
      ) : (
        <div className="space-y-4">
          <a
            href={`/api/auth/google?next=${encodeURIComponent(dest)}`}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-primary/15 bg-card text-sm font-medium text-primary transition-colors hover:bg-primary/[0.04]"
          >
            <GoogleMark />
            Continue with Google
          </a>
          <div className="flex items-center gap-3 text-xs text-secondary">
            <span className="h-px flex-1 bg-primary/10" />
            or
            <span className="h-px flex-1 bg-primary/10" />
          </div>
          {emailSignupBlocked ? (
            <p className="rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm text-secondary">
              Email signup needs GOOGLE_MAIL_USER and GOOGLE_MAIL_PASSWORD so we can send a verification link.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" ? (
                <label className="block">
                  <span className="text-sm text-secondary">Name</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    placeholder="Ada Lovelace"
                    className={AUTH_FIELD}
                  />
                </label>
              ) : null}
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
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="auth-password" className="text-sm text-secondary">
                    Password
                  </label>
                  {mode === "login" ? (
                    <Link href="/forgot-password" className="text-sm text-primary">
                      Forgot password?
                    </Link>
                  ) : null}
                </div>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder="At least 8 characters"
                  className={AUTH_FIELD}
                />
              </div>
              {error ? <p className="text-sm text-error">{error}</p> : null}
              {unverified ? (
                <button
                  type="button"
                  onClick={resend}
                  disabled={busy}
                  className="text-sm text-primary disabled:opacity-60"
                >
                  Send another verification link
                </button>
              ) : null}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-60"
              >
                {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>
          )}
        </div>
      )}
      <p className="mt-6 text-sm text-secondary">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-primary">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="text-primary">
              Create an account
            </Link>
          </>
        )}
      </p>
    </AuthPanel>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.2l6.3 5.3C38.4 37.4 44 31.5 44 24c0-1.2-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
