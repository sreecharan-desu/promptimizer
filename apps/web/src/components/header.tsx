"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DOCS_HOME, GITHUB_URL, SITE_URL } from "@/lib/site";
import { AuthNav } from "./auth-nav";
import { GitHubIcon, GitHubLink } from "./github-link";
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
      <div
        className="site-nav relative mx-auto flex h-12 max-w-6xl items-center justify-between rounded-2xl px-3 sm:px-4"
        style={{ backdropFilter: "blur(var(--site-header-blur))" }}
      >
        <Link href={homeHref} className="flex items-center gap-2.5 text-primary">
          <Mark className="h-8 w-8" />
          <span className="font-display text-[16px] font-semibold tracking-tight">Promptimizer</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          <Link
            href="/console"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-primary/55 transition-colors hover:bg-primary/[0.05] hover:text-primary"
          >
            Console
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              docs ? "bg-primary/[0.05] text-primary" : "text-primary/55 hover:bg-primary/[0.05] hover:text-primary"
            }`}
          >
            Docs
          </a>
          <GitHubLink className="ml-1 inline-flex size-8 items-center justify-center rounded-lg text-primary/45 transition-colors duration-150 hover:bg-primary/[0.05] hover:text-primary" />
          <span className="mx-2 h-5 w-px bg-primary/10" aria-hidden="true" />
          <AuthNav />
        </div>

        <button
          type="button"
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-primary/70 transition-colors hover:bg-primary/[0.05] lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>

        {open ? (
          <div className="site-nav absolute left-0 right-0 top-[calc(100%+0.5rem)] rounded-2xl p-3 shadow-xl lg:hidden">
            <div className="flex flex-col gap-1">
              <Link
                href="/console"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-primary/70 hover:bg-primary/[0.05] hover:text-primary"
              >
                Console
              </Link>
              <a
                href={DOCS_HOME}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary/[0.05] ${
                  docs ? "text-primary" : "text-primary/70"
                }`}
              >
                Docs
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-primary/70 hover:bg-primary/[0.05] hover:text-primary"
              >
                <GitHubIcon className="size-4" />
                GitHub
              </a>
              <div className="mt-2 flex items-center gap-3 border-t border-primary/[0.07] px-2 pt-3">
                <AuthNav />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
