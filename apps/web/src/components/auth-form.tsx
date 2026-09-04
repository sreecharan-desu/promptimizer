"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ERRORS: Record<string, string> = {
  google: "Google sign-in did not complete. Try again.",
  google_not_configured: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then restart the app.",
};

const fieldClass =
  "mt-1 h-11 w-full rounded-xl border border-primary/20 bg-background px-3 text-sm text-primary outline-none placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-accent";

export function AuthForm({
  mode,
  next,
  configured,
  google,
  errorCode,
}: {
  mode: "login" | "signup";
  next?: string;
  configured: boolean;
  google: boolean;
  errorCode?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(errorCode ? ERRORS[errorCode] ?? "Could not sign in." : null);
  const [busy, setBusy] = useState(false);
  const dest = next && next.startsWith("/") ? next : mode === "signup" ? "/account" : "/console";

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
      if (!response.ok) throw new Error(data.detail ?? "Request failed");
      router.push(dest);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <p className="text-[11px] font-medium uppercase tracking-wide text-accent">Account</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-primary">
        {mode === "signup" ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-3 text-secondary">
        {mode === "signup"
          ? "Then create an API key and route from your own app."
          : "Sign in to the console, portal, and your API keys."}
      </p>
      {!configured ? (
        <p className="mt-8 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm text-secondary">
          Accounts need DATABASE_URL, AUTH_SECRET, and ENCRYPTION_KEY in the environment.
        </p>
      ) : (
        <div className="mt-8 space-y-4">
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
                  className={fieldClass}
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
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="text-sm text-secondary">Password</span>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                placeholder="At least 8 characters"
                className={fieldClass}
              />
            </label>
            {error ? <p className="text-sm text-error">{error}</p> : null}
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-background disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
            </button>
          </form>
          {!google ? (
            <p className="text-xs text-secondary">
              Google is ready in the UI. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable it.
            </p>
          ) : null}
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
    </div>
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
