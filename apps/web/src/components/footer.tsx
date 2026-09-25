"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthMe } from "@/lib/auth-me";
import { DOCS_HOME } from "@/lib/site";

export function Footer() {
  const pathname = usePathname();
  const me = useAuthMe();
  const loggedIn = Boolean(me?.user);
  const compact = pathname.startsWith("/docs");

  const columns = [
    {
      title: "Product",
      links: [
        ...(loggedIn ? [{ href: "/console", label: "Console" }] : []),
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

  return (
    <footer className="border-t border-primary/[0.07] px-4 py-12 sm:px-6 sm:py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:justify-between">
        <div>
          <p className="font-display text-base font-semibold tracking-tight text-primary">Promptimizer</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-secondary">The adaptive routing layer for production AI.</p>
          <div className="mt-4 flex items-center gap-3">
            <p className="text-xs text-secondary">© {new Date().getFullYear()} Promptimizer</p>
          </div>
        </div>
        {compact ? null : (
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {columns.map((column) => (
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
      </div>
    </footer>
  );
}
