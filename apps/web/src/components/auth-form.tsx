"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AuthForm({
  mode,
  next,
  configured,
}: {
  mode: "login" | "signup";
  next?: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
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
          : "Sign in to the console and your API keys."}
      </p>
      {!configured ? (
        <p className="mt-8 rounded-xl border border-warning/30 bg-warning/[0.06] px-4 py-3 text-sm text-secondary">
          Accounts need DATABASE_URL, AUTH_SECRET, and ENCRYPTION_KEY in the environment.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "signup" ? (
            <label className="block">
              <span className="text-sm text-secondary">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 h-11 w-full rounded-xl border border-primary/10 bg-card px-3 text-sm text-primary outline-none focus:border-primary/30"
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
              className="mt-1 h-11 w-full rounded-xl border border-primary/10 bg-card px-3 text-sm text-primary outline-none focus:border-primary/30"
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
              className="mt-1 h-11 w-full rounded-xl border border-primary/10 bg-card px-3 text-sm text-primary outline-none focus:border-primary/30"
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
