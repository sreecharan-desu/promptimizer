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
  { id: "play", label: "Play", href: "/console?tab=play" },
] as const;

const APP_LINKS = [
  { id: "savings", label: "Savings", href: "/portal" },
  { id: "keys", label: "Keys", href: "/account" },
] as const;

export function AppDock({ activeTab, onTabChange }: AppDockProps) {
  return (
    <>
      {/* Desktop — abcchess-style left rail */}
      <aside
        className="app-rail pointer-events-none fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-w)] flex-col pt-[calc(env(safe-area-inset-top,0px)+4.75rem)] pb-[env(safe-area-inset-bottom,0px)] lg:flex"
        aria-label="Console navigation"
      >
        <nav className="pointer-events-auto mx-1.5 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto rounded-[1.25rem] border border-primary/[0.08] bg-card/55 p-1.5 shadow-[var(--shadow-soft)] backdrop-blur-xl backdrop-saturate-150">
          {CONSOLE_TABS.map((item) => (
            <RailItem
              key={item.id}
              {...item}
              active={activeTab === item.id}
              onTabChange={onTabChange}
            />
          ))}
          <div className="mx-2 my-1.5 h-px bg-primary/10" aria-hidden="true" />
          {APP_LINKS.map((item) => (
            <RailItem key={item.id} {...item} active={activeTab === item.id} />
          ))}
        </nav>
      </aside>

      {/* Mobile — floating glass capsule */}
      <aside
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        aria-label="Console navigation"
      >
        <nav className="console-dock pointer-events-auto flex w-full max-w-md flex-row items-stretch gap-0.5 rounded-[1.35rem] border border-primary/[0.1] bg-card/60 p-1.5 shadow-[var(--shadow-soft-lg)] backdrop-blur-2xl backdrop-saturate-150">
          {[...CONSOLE_TABS, ...APP_LINKS].map((item) => {
            const active = activeTab === item.id;
            const className = `flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[1rem] px-1 py-1.5 text-[10px] font-bold tracking-tight transition-colors duration-150 ${
              active ? "bg-primary/90 text-background" : "text-primary/45 hover:bg-primary/[0.06] hover:text-primary"
            }`;
            const inner = (
              <>
                <DockIcon tab={item.id} className="size-[17px]" />
                <span className="leading-none">{item.label}</span>
              </>
            );
            if (onTabChange && (item.id === "connect" || item.id === "fleet" || item.id === "play")) {
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  onClick={() => onTabChange(item.id)}
                  className={className}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                className={className}
              >
                {inner}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}

function RailItem({
  id,
  label,
  href,
  active,
  onTabChange,
}: {
  id: DockTabId;
  label: string;
  href: string;
  active: boolean;
  onTabChange?: AppDockProps["onTabChange"];
}) {
  const className = `group flex flex-col items-center gap-0.5 rounded-[0.95rem] px-1 py-2 text-[10px] font-extrabold transition-colors duration-150 ${
    active ? "text-primary" : "text-primary/40 hover:text-primary"
  }`;
  const inner = (
    <>
      <span
        className={`flex size-9 items-center justify-center rounded-full transition-colors duration-150 ${
          active ? "bg-accent/70 text-background" : "group-hover:bg-primary/[0.06]"
        }`}
      >
        <DockIcon tab={id} className="size-[18px]" />
      </span>
      <span className="leading-none">{label}</span>
    </>
  );

  if (onTabChange && (id === "connect" || id === "fleet" || id === "play")) {
    return (
      <button
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
    <Link href={href} title={label} aria-label={label} aria-current={active ? "page" : undefined} className={className}>
      {inner}
    </Link>
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
