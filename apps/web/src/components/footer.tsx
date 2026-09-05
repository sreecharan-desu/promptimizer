"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { DOCS_HOME, GITHUB_URL } from "@/lib/site";
import { GitHubLink } from "./github-link";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/console", label: "Console" },
      { href: "/account", label: "API keys" },
      { href: "/portal", label: "Savings" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: DOCS_HOME, label: "Docs" },
      { href: GITHUB_URL, label: "GitHub" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

type Theme = "dark" | "light" | "system";

export function Footer() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("light");
  const compact = pathname.startsWith("/docs");

  useEffect(() => {
    const stored = (localStorage.getItem("promptimizer-theme") as Theme | null) ?? "light";
    setTheme(stored);
  }, []);

  function cycle() {
    const next: Theme = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
    localStorage.setItem("promptimizer-theme", next);
    const applied =
      next === "system"
        ? window.matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : next;
    document.documentElement.classList.remove("dark", "light");
    document.documentElement.classList.add(applied);
  }

  const label =
    theme === "light" ? "Switch to dark mode" : theme === "dark" ? "Switch to system theme" : "Switch to light mode";

  return (
    <footer className="border-t border-primary/[0.07] px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div>
          <p className="font-display text-base font-semibold tracking-tight text-primary">Promptimizer</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-secondary">The adaptive routing layer for production AI.</p>
          <div className="mt-4 flex items-center gap-3">
            <GitHubLink className="inline-flex size-8 items-center justify-center rounded-lg text-primary/40 transition-colors hover:bg-primary/[0.05] hover:text-primary" />
            <p className="text-xs text-secondary">© {new Date().getFullYear()} Promptimizer</p>
          </div>
        </div>
        {compact ? null : (
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-secondary">{column.title}</p>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      {link.href.startsWith("http") ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary/55 transition-colors hover:text-primary"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="text-sm text-primary/55 transition-colors hover:text-primary">
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={cycle}
          aria-label={label}
          className="size-8 rounded-lg border border-primary/[0.08] text-primary/35 transition-colors duration-150 hover:bg-primary/[0.04] hover:text-primary/65"
        >
          {theme === "light" ? "○" : theme === "system" ? "◐" : "●"}
        </button>
      </div>
    </footer>
  );
}
