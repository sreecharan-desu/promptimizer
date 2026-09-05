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
  errorCode,
}: {
  mode: "login" | "signup";
  next?: string;
  configured: boolean;
  /** @deprecated Hackathon: email verification is off; kept for call-site compat. */
  mailReady?: boolean;
  errorCode?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? ERRORS[errorCode] ?? "Could not sign in." : null);
  const [busy, setBusy] = useState(false);
  const dest = next && next.startsWith("/") ? next : "/console";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(mode === "signup" ? "/api/auth/signup" : "/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail ?? "Request failed");
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
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
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
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
