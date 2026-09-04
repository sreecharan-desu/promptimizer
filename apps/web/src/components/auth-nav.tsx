"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Me = { user: { name: string; email: string } | null; configured: boolean };

export function AuthNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then(setMe)
      .catch(() => setMe({ user: null, configured: false }));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe({ user: null, configured: true });
    router.push("/");
    router.refresh();
  }

  if (!me?.configured) {
    return (
      <Link
        href="/console"
        className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
      >
        Open console
      </Link>
    );
  }

  if (me.user) {
    return (
      <>
        <Link href="/portal" className="text-sm font-medium text-primary/50 transition-colors hover:text-primary">
          Portal
        </Link>
        <Link href="/account" className="text-sm font-medium text-primary/50 transition-colors hover:text-primary">
          API keys
        </Link>
        <button type="button" onClick={logout} className="text-sm font-medium text-primary/50 hover:text-primary">
          Sign out
        </button>
        <Link
          href="/console"
          className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
        >
          Console
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/login" className="text-sm font-medium text-primary/50 transition-colors hover:text-primary">
        Sign in
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
      >
        Get API keys
      </Link>
    </>
  );
}
