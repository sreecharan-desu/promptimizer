"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AuthNav } from "./auth-nav";
import { Mark } from "./mark";

const NAV = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/api", label: "API" },
  { href: "/docs/sdk", label: "SDK" },
  { href: "/console", label: "Console" },
  { href: "/portal", label: "Portal" },
];

function navActive(pathname: string, href: string) {
  if (href === "/docs") {
    return (
      pathname === "/docs" ||
      (pathname.startsWith("/docs/") && !pathname.startsWith("/docs/api") && !pathname.startsWith("/docs/sdk"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
            const active = navActive(pathname, item.href);
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

        <div className="hidden items-center gap-3 lg:flex">
          <AuthNav />
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
            <Link href="/signup" onClick={() => setOpen(false)} className="mt-2 inline-flex h-11 items-center justify-center rounded-full bg-primary text-sm font-medium text-background">
              Get API keys
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
