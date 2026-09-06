"use client";

import Link from "next/link";
import { useAuthMe } from "@/lib/auth-me";
import { DOCS_URL } from "@/lib/site";

export function HomeBottomCta() {
  const me = useAuthMe();
  const isLoggedIn = Boolean(me?.user);

  return (
    <div className="flex flex-wrap gap-3">
      {isLoggedIn ? (
        <Link
          href="/console"
          className="inline-flex h-11 items-center rounded-xl bg-background px-5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
        >
          Go to console
        </Link>
      ) : (
        <Link
          href="/signup"
          className="inline-flex h-11 items-center rounded-xl bg-background px-5 text-sm font-semibold text-primary transition-transform hover:-translate-y-0.5"
        >
          Create an account
        </Link>
      )}
      <a
        href={`${DOCS_URL}/docs/sdk`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-background transition-colors hover:bg-white/10"
      >
        Explore the SDK
      </a>
    </div>
  );
}
