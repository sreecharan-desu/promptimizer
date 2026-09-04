"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/api", label: "API" },
  { href: "/docs/sdk", label: "SDK" },
  { href: "/docs/cli", label: "CLI" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

type Theme = "dark" | "light" | "system";

export function Footer() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<Theme>("dark");
  const compact = pathname.startsWith("/docs");

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

  return (
    <footer className="border-t border-primary/[0.06] px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-secondary">© {new Date().getFullYear()} Promptimizer</p>
        {compact ? null : (
          <nav className="flex flex-wrap gap-4">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="text-xs text-primary/50 transition-colors hover:text-primary">
                {link.label}
              </Link>
            ))}
          </nav>
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
