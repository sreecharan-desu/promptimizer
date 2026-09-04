"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { UserMenu } from "./user-menu";

type Me = {
  user: { name: string; email: string; avatarUrl?: string | null } | null;
  configured: boolean;
};

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

  if (me?.user) return <UserMenu user={me.user} onLogout={logout} />;

  return (
    <>
      <Link href="/login" className="text-sm font-medium text-primary/50 transition-colors hover:text-primary">
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
