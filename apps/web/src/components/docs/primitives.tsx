import Link from "next/link";
import { type ReactNode } from "react";

export function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2 id={id} className="mt-12 scroll-mt-28 font-display text-2xl font-medium tracking-tight text-primary">
      {children}
    </h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-base leading-relaxed text-secondary text-pretty">{children}</p>;
}

export function Callout({
  kind,
  children,
}: {
  kind: "note" | "tip" | "warning";
  children: ReactNode;
}) {
  const label = kind === "note" ? "Note" : kind === "tip" ? "Tip" : "Warning";
  const ring =
    kind === "warning"
      ? "border-error/30 bg-error/[0.06]"
      : kind === "tip"
        ? "border-success/30 bg-success/[0.06]"
        : "border-accent/25 bg-accent/[0.06]";
  return (
    <aside className={`mt-6 rounded-xl border px-4 py-3 text-sm leading-relaxed text-primary ${ring}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">{label}</p>
      <div className="mt-1 text-secondary [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">{children}</div>
    </aside>
  );
}

export function Cards({ children }: { children: ReactNode }) {
  return <div className="mt-8 grid gap-3 sm:grid-cols-2">{children}</div>;
}

export function Card({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group/card rounded-2xl border border-primary/[0.06] bg-card p-5 transition-all duration-300 hover:border-primary/20"
    >
      <p className="text-sm font-medium text-primary">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-secondary">{children}</p>
      <p className="mt-4 text-sm text-secondary group-hover/card:text-primary">Open →</p>
    </Link>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="mt-6 space-y-5">{children}</ol>;
}

export function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="grid gap-2 sm:grid-cols-[56px_1fr]">
      <p className="font-display text-xl text-primary/35">{n}</p>
      <div>
        <p className="font-display text-xl font-medium tracking-tight text-primary">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-secondary">{children}</p>
      </div>
    </li>
  );
}

export function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-primary/[0.06]">
      <table className="w-full text-left text-sm">
        <thead className="bg-card text-secondary">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-primary/5">
              {row.map((cell, j) => (
                <td key={j} className={`px-4 py-2.5 ${j === 0 ? "text-primary" : "text-secondary"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { CodeBlock } from "@/components/docs/code-block";

export function Pre({ children, label }: { children: ReactNode; label?: string }) {
  const codeString =
    typeof children === "string"
      ? children
      : Array.isArray(children)
        ? children.map((c) => (typeof c === "string" ? c : String(c ?? ""))).join("")
        : String(children ?? "");

  return <CodeBlock code={codeString} label={label} />;
}

export function Endpoint({ method, path }: { method: string; path: string }) {
  const tone =
    method === "GET" ? "text-success" : method === "DELETE" ? "text-error" : method === "PATCH" ? "text-warning" : "text-accent";
  return (
    <p className="mt-4 flex flex-wrap items-center gap-3 font-mono text-sm">
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${tone} bg-primary/[0.04]`}>{method}</span>
      <span className="text-primary">{path}</span>
    </p>
  );
}

export function Param({
  name,
  type,
  required,
  children,
}: {
  name: string;
  type: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-b border-primary/5 pb-4">
      <p className="font-mono text-sm text-primary">
        {name}
        {required ? <span className="ml-2 text-error">*</span> : null}
        <span className="ml-2 text-secondary">{type}</span>
      </p>
      <p className="mt-1 text-sm leading-relaxed text-secondary">{children}</p>
    </div>
  );
}

export function Accordion({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group mt-3 border-b border-primary/5 py-3">
      <summary className="cursor-pointer list-none text-left text-base text-primary [&::-webkit-details-marker]:hidden">
        <span className="text-secondary group-open:hidden">+</span>
        <span className="hidden text-secondary group-open:inline">−</span>
        <span className="ml-3">{title}</span>
      </summary>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">{children}</p>
    </details>
  );
}
