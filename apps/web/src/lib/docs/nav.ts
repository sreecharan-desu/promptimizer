export type DocLink = { href: string; title: string; description: string };

export type DocGroup = { title: string; tab: "Documentation" | "API reference"; pages: DocLink[] };

export const DOC_GROUPS: DocGroup[] = [
  {
    title: "Get started",
    tab: "Documentation",
    pages: [
      { href: "/docs", title: "Introduction", description: "What Promptimizer does." },
      { href: "/docs/quickstart", title: "Quickstart", description: "Account, key, first request." },
      { href: "/docs/concepts", title: "Concepts", description: "Sessions, fleets, tiers, baseline." },
    ],
  },
  {
    title: "How it works",
    tab: "Documentation",
    pages: [
      { href: "/docs/guides/classification", title: "Classification", description: "How a request is scored." },
      { href: "/docs/guides/routing", title: "Routing", description: "How a model is chosen." },
      { href: "/docs/guides/caching", title: "Prompt cache", description: "Repeated prefix discount." },
      { href: "/docs/guides/quality", title: "Quality gate", description: "When a cheap answer is retried." },
      { href: "/docs/guides/byok", title: "Bring your own key", description: "Known hosts and custom URLs." },
      { href: "/docs/guides/benchmark", title: "Benchmark", description: "Fixed task set and policies." },
    ],
  },
  {
    title: "SDK",
    tab: "Documentation",
    pages: [
      { href: "/docs/sdk", title: "SDK", description: "npm i promptimizer" },
      { href: "/docs/sdk/client", title: "Client", description: "TypeScript client methods." },
      { href: "/docs/sdk/classifier", title: "Classifier", description: "Offline classification." },
      { href: "/docs/sdk/openai", title: "OpenAI drop-in", description: "Official SDK via baseURL." },
    ],
  },
  {
    title: "Product",
    tab: "Documentation",
    pages: [
      { href: "/docs/console", title: "Console", description: "Connect, fleet, playground." },
      { href: "/docs/cli", title: "CLI", description: "login, connect, chat, savings." },
      { href: "/docs/portal", title: "Savings", description: "Account-level cost report." },
    ],
  },
  {
    title: "Overview",
    tab: "API reference",
    pages: [
      { href: "/docs/api", title: "API overview", description: "Hosts and request flow." },
      { href: "/docs/api/authentication", title: "Authentication", description: "Bearer pmz_live_ keys." },
      { href: "/docs/api/errors", title: "Errors", description: "HTTP status map." },
    ],
  },
  {
    title: "Endpoints",
    tab: "API reference",
    pages: [
      { href: "/docs/api/providers", title: "Providers", description: "GET /v1/providers" },
      { href: "/docs/api/connect", title: "Connect", description: "POST /v1/providers/connect" },
      { href: "/docs/api/session", title: "Session", description: "GET /v1/session" },
      { href: "/docs/api/models", title: "Models", description: "GET · PATCH /v1/models" },
      { href: "/docs/api/classify", title: "Classify", description: "POST /v1/classify" },
      { href: "/docs/api/chat", title: "Chat completions", description: "POST /v1/chat/completions" },
      { href: "/docs/api/benchmark", title: "Benchmark", description: "GET · POST /v1/benchmark" },
      { href: "/docs/api/analytics", title: "Analytics", description: "GET /v1/analytics" },
      { href: "/docs/api/savings", title: "Savings", description: "GET /v1/savings" },
    ],
  },
];

export function allDocLinks() {
  return DOC_GROUPS.flatMap((g) => g.pages);
}

export function findDoc(pathname: string) {
  return allDocLinks().find((p) => p.href === pathname);
}

export function neighbors(pathname: string) {
  const group = DOC_GROUPS.find((g) => g.pages.some((p) => p.href === pathname));
  const flat = group
    ? DOC_GROUPS.filter((g) => g.tab === group.tab).flatMap((g) => g.pages)
    : allDocLinks();
  const i = flat.findIndex((p) => p.href === pathname);
  return { prev: i > 0 ? flat[i - 1] : null, next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : null };
}
