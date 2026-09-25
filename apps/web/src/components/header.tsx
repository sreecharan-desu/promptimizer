"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOCS_HOME, SITE_URL } from "@/lib/site";
import { AuthNav } from "./auth-nav";
import { Mark } from "./mark";

function docsActive(pathname: string) {
  return pathname === "/docs" || pathname.startsWith("/docs/");
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const docs = docsActive(pathname);
  const homeHref = docs ? SITE_URL : "/";

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5">
      <div className="site-nav relative mx-auto flex h-12 max-w-6xl items-center justify-between rounded-[1.15rem] px-3 sm:px-4">
        <Link href={homeHref} className="flex items-center gap-2.5 text-primary">
          <Mark className="h-8 w-8" />
          <span className="font-display text-[16px] font-bold tracking-tight text-primary">
            Promptimizer
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <Link href="/console" className="nav-link">
            Console
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className={`nav-link ${docs ? "is-active" : ""}`}
            aria-current={docs ? "page" : undefined}
          >
            Docs
          </a>
          <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
          <AuthNav />
        </div>

        <button
          type="button"
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-bold text-primary transition-colors hover:bg-background-hover lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>

        {open ? (
          <div className="site-nav absolute left-0 right-0 top-[calc(100%+0.5rem)] rounded-[1.15rem] p-2.5 lg:hidden">
            <div className="flex flex-col gap-0.5">
              <Link
                href="/console"
                onClick={() => setOpen(false)}
                className="nav-link"
              >
                Console
              </Link>
              <a
                href={DOCS_HOME}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={`nav-link ${docs ? "is-active" : ""}`}
                aria-current={docs ? "page" : undefined}
              >
                Docs
              </a>
              <div className="mt-2 flex items-center gap-3 border-t border-border px-2 pt-3">
                <AuthNav />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
