"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Mark } from "./mark";

const NAV = [
  { href: "/console", label: "Console" },
  { href: "/docs", label: "Docs" },
  { href: "/docs/sdk", label: "SDK" },
  { href: "/docs/api", label: "API" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="group fixed inset-x-0 top-0 z-50 h-16 duration-200" style={{ background: "var(--site-header-bg)", backdropFilter: "blur(12px)" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 text-primary">
          <Mark className="h-9 w-9" />
          <span className="font-display text-[17px] font-medium tracking-tight">Promptimizer</span>
        </Link>

        <nav className="hidden items-center lg:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                  active ? "text-primary" : "text-primary/50 hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href="/docs"
            className="relative isolate inline-flex h-9 items-center justify-center rounded-full px-4 py-2 text-sm font-medium text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.25)] transition-colors duration-150 hover:bg-primary/[0.04]"
          >
            Read docs
          </Link>
          <Link
            href="/console"
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-background transition-colors duration-150 hover:bg-primary-hover"
          >
            Open console
          </Link>
        </div>

        <button
          type="button"
          className="lg:hidden text-sm font-medium text-primary/70"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Menu
        </button>
      </div>

      {open ? (
        <div className="border-t border-primary/[0.06] bg-background px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-2">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="py-2 text-sm font-medium text-primary">
                {item.label}
              </Link>
            ))}
            <Link href="/console" onClick={() => setOpen(false)} className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-primary text-sm font-medium text-background">
              Open console
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
