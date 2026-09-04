"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { allDocLinks } from "@/lib/docs/nav";

export function DocsSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const all = allDocLinks();
    if (!needle) return all.slice(0, 8);
    return all.filter((p) => `${p.title} ${p.description}`.toLowerCase().includes(needle)).slice(0, 10);
  }, [q]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-primary/10 bg-background px-3 text-sm text-secondary transition-colors hover:text-primary"
      >
        <span>Search docs…</span>
        <span className="font-mono text-[11px] text-primary/40">⌘K</span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="mx-auto mt-[12vh] w-[min(560px,92vw)] overflow-hidden rounded-2xl border border-primary/[0.08] bg-card shadow-xl shadow-black/20"
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search documentation"
              className="h-12 w-full border-b border-primary/[0.06] bg-transparent px-4 text-sm text-primary outline-none placeholder:text-secondary"
            />
            <ul className="max-h-80 overflow-y-auto py-2">
              {hits.map((hit) => (
                <li key={hit.href}>
                  <button
                    type="button"
                    className="flex w-full flex-col items-start px-4 py-2.5 text-left hover:bg-primary/[0.04]"
                    onClick={() => {
                      router.push(hit.href);
                      setOpen(false);
                      setQ("");
                    }}
                  >
                    <span className="text-sm font-medium text-primary">{hit.title}</span>
                    <span className="text-xs text-secondary">{hit.description}</span>
                  </button>
                </li>
              ))}
              {hits.length === 0 ? <li className="px-4 py-6 text-sm text-secondary">No matches.</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
