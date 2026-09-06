"use client";

import Link from "next/link";

export type DockTabId = "connect" | "fleet" | "play" | "savings" | "keys";

export interface AppDockProps {
  activeTab: DockTabId;
  onTabChange?: (tab: "connect" | "fleet" | "play") => void;
}

const CONSOLE_TABS = [
  { id: "connect", label: "Connect", href: "/console?tab=connect" },
  { id: "fleet", label: "Fleet", href: "/console?tab=fleet" },
  { id: "play", label: "Playground", href: "/console?tab=play" },
] as const;

const APP_LINKS = [
  { id: "savings", label: "Savings", href: "/portal" },
  { id: "keys", label: "API keys", href: "/account" },
] as const;

export function AppDock({ activeTab, onTabChange }: AppDockProps) {
  return (
    <aside
      className="pointer-events-none fixed bottom-5 left-1/2 z-40 -translate-x-1/2 lg:bottom-auto lg:left-4 lg:top-[calc(50%+0.5rem)] lg:translate-x-0 lg:-translate-y-1/2"
      aria-label="Console navigation"
    >
      <nav className="console-dock pointer-events-auto flex flex-row gap-1 rounded-2xl border border-primary/[0.1] bg-card/95 p-1.5 shadow-[0_14px_36px_-24px_rgba(0,0,0,0.45)] backdrop-blur-md lg:flex-col lg:gap-1 lg:p-1.5">
        {CONSOLE_TABS.map(({ id, label, href }) => {
          const active = activeTab === id;
          const className = `group relative flex size-10 items-center justify-center rounded-xl transition-colors duration-150 ${
            active
              ? "bg-primary text-background"
              : "text-primary/45 hover:bg-primary/[0.05] hover:text-primary"
          }`;

          const inner = (
            <>
              <DockIcon tab={id} className="size-[18px]" />
              <span className="sr-only">{label}</span>
              <span className="pointer-events-none absolute left-full top-1/2 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 lg:block">
                {label}
              </span>
            </>
          );

          if (onTabChange) {
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                onClick={() => onTabChange(id)}
                className={className}
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={id}
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              {inner}
            </Link>
          );
        })}

        <div className="mx-1 hidden h-px bg-primary/10 lg:block" aria-hidden="true" />
        <div className="mx-0.5 w-px self-stretch bg-primary/10 lg:hidden" aria-hidden="true" />

        {APP_LINKS.map(({ id, label, href }) => {
          const active = activeTab === id;
          const className = `group relative flex size-10 items-center justify-center rounded-xl transition-colors duration-150 ${
            active
              ? "bg-primary text-background"
              : "text-primary/45 hover:bg-primary/[0.05] hover:text-primary"
          }`;

          return (
            <Link
              key={id}
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={className}
            >
              <DockIcon tab={id} className="size-[18px]" />
              <span className="sr-only">{label}</span>
              <span className="pointer-events-none absolute left-full top-1/2 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 lg:block">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function DockIcon({ tab, className }: { tab: DockTabId; className?: string }) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (tab === "connect") {
    return (
      <svg {...common}>
        <path d="M8 5v5M12 5v5" />
        <path d="M6 10h8v2.5a4 4 0 0 1-4 4H9" />
        <path d="M9 16.5v2.5M6.5 19h5" />
      </svg>
    );
  }

  if (tab === "fleet") {
    return (
      <svg {...common}>
        <rect x="4.5" y="4.5" width="6" height="6" rx="1" />
        <rect x="13.5" y="4.5" width="6" height="6" rx="1" />
        <rect x="4.5" y="13.5" width="6" height="6" rx="1" />
        <path d="M16.5 14v5M14 16.5h5" />
      </svg>
    );
  }

  if (tab === "savings") {
    return (
      <svg {...common}>
        <path d="M5 19.5h14" />
        <path d="M7 16v-4M12 16V7M17 16v-6" />
      </svg>
    );
  }

  if (tab === "keys") {
    return (
      <svg {...common}>
        <circle cx="8.5" cy="11.5" r="3.5" />
        <path d="m11 14 5 5M16 19h3" />
      </svg>
    );
  }

  // "play" (Playground)
  return (
    <svg {...common}>
      <path d="m6.5 8 3.5 3.5-3.5 3.5" />
      <path d="M12.5 15h5" />
    </svg>
  );
}
