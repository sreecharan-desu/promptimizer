"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { DOC_GROUPS } from "@/lib/docs/nav";
import { DocsSearch } from "./search";

const TABS = [
  { label: "Documentation", href: "/docs", match: (p: string) => !p.startsWith("/docs/api") },
  { label: "API reference", href: "/docs/api", match: (p: string) => p.startsWith("/docs/api") },
] as const;

function TabBar({ pathname }: { pathname: string }) {
  return (
    <div className="grid grid-cols-2 rounded-lg border border-primary/[0.08] p-0.5">
      {TABS.map((tab) => (
        <Link
          key={tab.label}
          href={tab.href}
          className={`rounded-md px-2 py-1.5 text-center text-[11px] font-medium transition-colors duration-150 ${
            tab.match(pathname) ? "bg-primary/[0.06] text-primary" : "text-secondary hover:text-primary"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function GroupNav({ pathname, api }: { pathname: string; api: boolean }) {
  const groups = DOC_GROUPS.filter((g) => g.tab === (api ? "API reference" : "Documentation"));
  return (
    <nav className="space-y-7">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-2 text-[11px] font-medium uppercase tracking-wide text-secondary">{group.title}</p>
          <ul className="mt-2 space-y-0.5">
            {group.pages.map((page) => {
              const active = pathname === page.href;
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className={`block rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-150 ${
                      active ? "bg-primary/[0.04] text-primary" : "text-primary/50 hover:text-primary"
                    }`}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function DocsSidebar() {
  const pathname = usePathname();
  const api = pathname.startsWith("/docs/api");

  return (
    <aside className="hidden w-[248px] shrink-0 lg:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-3">
        <DocsSearch />
        <div className="mt-5">
          <TabBar pathname={pathname} />
        </div>
        <div className="mt-7">
          <GroupNav pathname={pathname} api={api} />
        </div>
      </div>
    </aside>
  );
}

export function DocsMobileNav() {
  const pathname = usePathname();
  const api = pathname.startsWith("/docs/api");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="mb-8 h-[88px] lg:hidden" aria-hidden="true" />;
  }

  return (
    <div className="mb-8 lg:hidden">
      <DocsSearch />
      <div className="mt-3">
        <TabBar pathname={pathname} />
      </div>
      <div className="mt-4 max-h-64 overflow-y-auto rounded-xl border border-primary/[0.06] bg-card px-2 py-3">
        <GroupNav pathname={pathname} api={api} />
      </div>
    </div>
  );
}
