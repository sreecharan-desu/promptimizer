"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCachedMe, invalidateMe, loadMe, subscribeMe, type AuthMe } from "@/lib/auth-me";
import { UserMenu } from "./user-menu";

export function AuthNav() {
  const router = useRouter();
  const [me, setMe] = useState<AuthMe | null>(() => getCachedMe());

  useEffect(() => {
    const unsub = subscribeMe(setMe);
    void loadMe();
    return unsub;
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    try {
      const { clearConsoleCache } = await import("@/lib/console-cache");
      const { clearSessionId } = await import("@/lib/api");
      clearConsoleCache();
      clearSessionId();
    } catch {
      /* ignore */
    }
    invalidateMe();
    setMe({ user: null, configured: true });
    router.push("/");
    router.refresh();
  }

  if (me?.user) return <UserMenu user={me.user} onLogout={logout} />;

  return (
    <>
      <Link
        href="/login"
        className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] transition-colors duration-150 hover:bg-primary/[0.04]"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
      >
        Get started
      </Link>
    </>
  );
}
