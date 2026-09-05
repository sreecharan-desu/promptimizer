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
    <header
      className="fixed inset-x-0 top-0 z-50 h-16 border-b border-primary/[0.06]"
      style={{ background: "var(--site-header-bg)", backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href={homeHref} className="flex items-center gap-2.5 text-primary">
          <Mark className="h-9 w-9" />
          <span className="font-display text-[17px] font-medium tracking-tight">Promptimizer</span>
        </Link>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            href={DOCS_HOME}
            className={`mr-1 flex items-center px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
              docs ? "text-primary" : "text-primary/50 hover:text-primary"
            }`}
          >
            Docs
          </Link>
          <GitHubLink className="mr-1 inline-flex size-9 items-center justify-center rounded-full text-primary/50 transition-colors duration-150 hover:bg-primary/[0.04] hover:text-primary" />
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
            <Link
              href={DOCS_HOME}
              onClick={() => setOpen(false)}
              className={`py-2 text-sm font-medium ${docs ? "text-primary" : "text-primary/70"}`}
            >
              Docs
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 py-2 text-sm font-medium text-primary/70"
            >
              <GitHubIcon className="size-4" />
              GitHub
            </a>
            <div className="mt-3 flex items-center gap-3">
              <AuthNav />
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
