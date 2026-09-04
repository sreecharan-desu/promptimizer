import Link from "next/link";

export default function DocsNotFound() {
  return (
    <div className="max-w-2xl py-16">
      <p className="text-[11px] font-medium uppercase tracking-wide text-accent">404</p>
      <h1 className="mt-3 font-display text-4xl font-medium tracking-tight text-primary">Page not found</h1>
      <p className="mt-4 text-lg text-secondary">That docs path is not in the sidebar.</p>
      <Link href="/docs" className="mt-8 inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-background">
        Back to introduction
      </Link>
    </div>
  );
}
