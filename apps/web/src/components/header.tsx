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
      <div className="site-nav relative mx-auto flex h-12 max-w-6xl items-center justify-between rounded-2xl border border-slate-200/90 bg-white/95 px-3 sm:px-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl backdrop-saturate-150 dark:border-slate-800 dark:bg-slate-950/95 dark:shadow-[0_10px_40px_rgb(0,0,0,0.6)]">
        <Link href={homeHref} className="flex items-center gap-2.5 text-slate-900 dark:text-white">
          <Mark className="h-8 w-8" />
          <span className="font-display text-[16px] font-bold tracking-tight text-slate-900 dark:text-white">
            Promptimizer
          </span>
        </Link>

        <div className="hidden items-center gap-1.5 lg:flex">
          <Link
            href="/console"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            Console
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors duration-150 ${
              docs
                ? "bg-slate-100 font-bold text-slate-950 dark:bg-slate-800 dark:text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            }`}
          >
            Docs
          </a>
          <GitHubLink className="ml-1 inline-flex size-8 items-center justify-center rounded-lg text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white" />
          <span className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
          <AuthNav />
        </div>

        <button
          type="button"
          className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Close" : "Menu"}
        </button>

        {open ? (
          <div className="site-nav absolute left-0 right-0 top-[calc(100%+0.5rem)] rounded-2xl border border-slate-200/90 bg-white/95 p-3 shadow-2xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 lg:hidden">
            <div className="flex flex-col gap-1">
              <Link
                href="/console"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Console
              </Link>
              <a
                href={DOCS_HOME}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100 ${
                  docs
                    ? "bg-slate-100 text-slate-950 dark:bg-slate-800 dark:text-white"
                    : "text-slate-800 hover:text-slate-950 dark:text-slate-200 dark:hover:text-white"
                }`}
              >
                Docs
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <GitHubIcon className="size-4" />
                GitHub
              </a>
              <div className="mt-2 flex items-center gap-3 border-t border-slate-200 px-2 pt-3 dark:border-slate-800">
                <AuthNav />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
