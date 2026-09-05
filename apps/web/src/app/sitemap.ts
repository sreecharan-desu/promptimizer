import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const paths = [
  "",
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
  "/console",
  "/portal",
  "/account",
  "/login",
  "/signup",
  "/privacy",
  "/terms",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return paths.map((path) => ({
    url: `${SITE_URL}${path || "/"}`,
    lastModified: now,
    changeFrequency: path.startsWith("/docs") ? "weekly" : path === "" ? "daily" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/docs") ? 0.8 : path === "/console" || path === "/portal" ? 0.7 : 0.5,
  }));
}
