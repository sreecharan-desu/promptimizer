import { NextRequest, NextResponse } from "next/server";
import { DOCS_HOST, SITE_HOST, SITE_URL } from "@/lib/site";

function hostname(request: NextRequest) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    ?.trim()
    .replace(/:\d+$/, "")
    .toLowerCase();
}

function isDocsHost(host: string) {
  return host === DOCS_HOST || host === `docs.${SITE_HOST.replace(/^www\./, "")}`;
}

function isMainHost(host: string) {
  const apex = SITE_HOST.replace(/^www\./, "");
  return (
    host === SITE_HOST ||
    host === apex ||
    host.endsWith(".vercel.app") ||
    host === "localhost" ||
    host.startsWith("127.0.0.1")
  );
}

export function middleware(request: NextRequest) {
  const host = hostname(request);
  const { pathname, search } = request.nextUrl;

  if (isDocsHost(host)) {
    // docs home
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/docs";
      return NextResponse.redirect(url, 308);
    }

    // App / API live on the main site
    if (
      pathname.startsWith("/api/") ||
      pathname === "/login" ||
      pathname === "/signup" ||
      pathname === "/console" ||
      pathname.startsWith("/console/") ||
      pathname === "/portal" ||
      pathname.startsWith("/portal/") ||
      pathname === "/account" ||
      pathname.startsWith("/account/") ||
      pathname === "/verify" ||
      pathname.startsWith("/forgot-password") ||
      pathname.startsWith("/reset-password")
    ) {
      return NextResponse.redirect(new URL(`${SITE_URL}${pathname}${search}`), 308);
    }

    return NextResponse.next();
  }

  // Main site (and Vercel aliases): send /docs → docs subdomain
  if (
    isMainHost(host) &&
    !isDocsHost(host) &&
    (pathname === "/docs" || pathname.startsWith("/docs/"))
  ) {
    if (host === "localhost" || host.startsWith("127.0.0.1")) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(`https://${DOCS_HOST}${pathname}${search}`), 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/docs",
    "/docs/:path*",
    "/api/:path*",
    "/login",
    "/signup",
    "/console",
    "/console/:path*",
    "/portal",
    "/portal/:path*",
    "/account",
    "/account/:path*",
    "/verify",
    "/forgot-password",
    "/forgot-password/:path*",
    "/reset-password",
    "/reset-password/:path*",
  ],
};
