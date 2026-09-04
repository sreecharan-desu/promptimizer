import type { ReactNode } from "react";

export const AUTH_FIELD =
  "mt-1 h-11 w-full rounded-xl border border-primary/20 bg-background px-3 text-sm text-primary outline-none placeholder:text-secondary focus-visible:ring-2 focus-visible:ring-accent";

export function AuthPanel({
  title,
  dek,
  children,
}: {
  title: string;
  dek: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 sm:px-6">
      <h1 className="font-display text-3xl font-medium tracking-tight text-primary">{title}</h1>
      <p className="mt-3 text-secondary">{dek}</p>
      <div className="mt-8">{children}</div>
    </div>
  );
}
