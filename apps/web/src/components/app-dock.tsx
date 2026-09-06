"use client";

import Link from "next/link";
import {
  Plug,
  Server,
  SquareTerminal,
  PiggyBank,
  KeyRound,
} from "lucide-react";

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
  const iconProps = {
    className,
    size: 18,
    strokeWidth: 1.75,
    "aria-hidden": true as const,
  };

  switch (tab) {
    case "connect":
      return <Plug {...iconProps} />;
    case "fleet":
      return <Server {...iconProps} />;
    case "play":
      return <SquareTerminal {...iconProps} />;
    case "savings":
      return <PiggyBank {...iconProps} />;
    case "keys":
      return <KeyRound {...iconProps} />;
  }
}
