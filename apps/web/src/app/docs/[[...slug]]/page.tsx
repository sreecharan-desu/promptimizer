import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DOC_CONTENT } from "@/lib/docs/content";
import { neighbors } from "@/lib/docs/nav";

type Params = { slug?: string[] };

function hrefFrom(slug?: string[]) {
  if (!slug?.length) return "/docs";
  return `/docs/${slug.join("/")}`;
}

export function generateStaticParams() {
  return Object.keys(DOC_CONTENT).map((href) => ({
    slug: href === "/docs" ? [] : href.replace(/^\/docs\//, "").split("/"),
  }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = DOC_CONTENT[hrefFrom(slug)];
  if (!page) return { title: "Docs" };
  return { title: page.title, description: page.description };
}

export default async function DocsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const href = hrefFrom(slug);
  const page = DOC_CONTENT[href];
  if (!page) notFound();
  const { prev, next } = neighbors(href);

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_180px] lg:gap-12">
      <article className="max-w-2xl pb-16">
        <h1 className="font-display text-3xl font-medium leading-[1.05] tracking-tight text-primary text-balance">
          {page.title}
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-secondary">{page.description}</p>
        {page.content}
        <div className="mt-16 grid gap-3 border-t border-primary/5 pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={prev.href} className="rounded-xl border border-primary/[0.06] bg-card px-4 py-3">
              <p className="text-[11px] text-secondary">Previous</p>
              <p className="mt-1 text-sm font-medium text-primary">{prev.title}</p>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={next.href} className="rounded-xl border border-primary/[0.06] bg-card px-4 py-3 sm:text-right">
              <p className="text-[11px] text-secondary">Next</p>
              <p className="mt-1 text-sm font-medium text-primary">{next.title}</p>
            </Link>
          ) : null}
        </div>
      </article>
      {page.headings.length ? (
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <p className="text-[11px] font-medium uppercase tracking-wide text-secondary">On this page</p>
            <ul className="mt-3 space-y-2">
              {page.headings.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-sm text-primary/50 transition-colors hover:text-primary">
                    {h.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
