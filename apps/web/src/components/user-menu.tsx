"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "./avatar";

type User = { name: string; email: string; avatarUrl?: string | null };

export function UserMenu({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const label = user.name || user.email;

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full p-0.5 text-left"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar name={user.name} email={user.email} src={user.avatarUrl} />
        <span className="hidden max-w-[10rem] truncate text-sm font-bold text-slate-900 dark:text-white sm:inline">{label}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[90] mt-2 min-w-48 overflow-hidden rounded-xl border border-primary/10 bg-background py-1"
        >
          <div className="border-b border-primary/5 px-3 py-2">
            <p className="truncate text-sm font-medium text-primary">{label}</p>
            <p className="truncate text-xs text-secondary">{user.email}</p>
          </div>
          <Link href="/console" role="menuitem" onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-primary hover:bg-primary/[0.04]">
            Console
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-secondary hover:bg-primary/[0.04] hover:text-primary"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
