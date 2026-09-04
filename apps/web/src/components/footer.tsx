"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Mark } from "./mark";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/signup", label: "Create account" },
      { href: "/account", label: "API keys" },
      { href: "/console", label: "Console" },
      { href: "/portal", label: "Savings" },
    ],
  },
  {
    title: "Developers",
    links: [
      { href: "/docs/api", label: "API reference" },
      { href: "/docs/sdk", label: "SDK" },
      { href: "/docs/guides/quality", label: "Quality gate" },
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
  const [theme, setTheme] = useState<Theme>("dark");
  const docs = pathname.startsWith("/docs");

  useEffect(() => {
    const stored = (localStorage.getItem("promptimizer-theme") as Theme | null) ?? "dark";
    setTheme(stored);
  }, []);

  function cycle() {
    const next: Theme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
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
    theme === "light" ? "Switch to system theme" : theme === "system" ? "Switch to dark mode" : "Switch to light mode";

  if (docs) {
    return (
      <footer className="border-t border-primary/[0.06] px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <p className="text-xs text-secondary">© {new Date().getFullYear()} Promptimizer</p>
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

  return (
    <footer className="border-t border-primary/[0.06] px-4 py-16 sm:px-6">
      <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_repeat(3,1fr)]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-primary">
            <Mark className="h-8 w-8" />
            <span className="font-display text-lg font-medium">Promptimizer</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-secondary">
            Quality-aware LLM routing. Bring your own key. Keep the hard answers expensive — and everything else cheap.
          </p>
          <p className="mt-6 text-sm text-primary/50">© {new Date().getFullYear()} Promptimizer</p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-sm font-medium text-primary">{col.title}</p>
            <ul className="mt-4 space-y-2">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-primary/50 transition-colors duration-150 hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-7xl items-center justify-between">
        <p className="text-xs text-secondary">Gold marks savings. Jet stays out of the way.</p>
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
