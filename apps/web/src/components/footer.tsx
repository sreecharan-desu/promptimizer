"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { DOCS_HOME } from "@/lib/site";

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
    links: [{ href: DOCS_HOME, label: "Docs" }],
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
    <footer className="border-t border-primary/[0.06] px-4 py-16 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div>
          <p className="font-display text-sm font-medium tracking-tight text-primary">Promptimizer</p>
          <p className="mt-3 text-sm text-secondary">© {new Date().getFullYear()} Promptimizer</p>
        </div>
        {compact ? null : (
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {COLUMNS.map((column) => (
              <div key={column.title}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{column.title}</p>
                <ul className="mt-3 space-y-2">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-sm text-primary/50 transition-colors hover:text-primary">
                        {link.label}
                      </Link>
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
          className="size-7 rounded-full text-primary/30 transition-colors duration-150 hover:text-primary/60"
        >
          {theme === "light" ? "○" : theme === "system" ? "◐" : "●"}
        </button>
      </div>
    </footer>
  );
}
