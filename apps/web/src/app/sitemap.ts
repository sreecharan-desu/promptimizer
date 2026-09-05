import type { MetadataRoute } from "next";
import { DOCS_URL, SITE_URL } from "@/lib/site";

const mainPaths = ["", "/console", "/portal", "/account", "/login", "/signup", "/privacy", "/terms"];

const docsPaths = [
  "/docs",
  "/docs/quickstart",
  "/docs/concepts",
  "/docs/api",
  "/docs/sdk",
  "/docs/cli",
  "/docs/guides/classification",
  "/docs/guides/routing",
  "/docs/guides/caching",
  "/docs/guides/quality",
  "/docs/guides/byok",
  "/docs/guides/benchmark",
  "/docs/portal",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...mainPaths.map((path) => ({
      url: `${SITE_URL}${path || "/"}`,
      lastModified: now,
      changeFrequency: (path === "" ? "daily" : "monthly") as const,
      priority: path === "" ? 1 : path === "/console" || path === "/portal" ? 0.7 : 0.5,
    })),
    ...docsPaths.map((path) => ({
      url: `${DOCS_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
