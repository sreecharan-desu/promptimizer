import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ThemeScript } from "@/components/theme-script";
import { JsonLd } from "@/components/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import "./tailwind.generated.css";

// Self-hosted so production builds do not download Google Fonts.
// next/font crashes the Vercel build when a returned file URL has no extension.
const sans = localFont({
  src: "../fonts/Inter-latin.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const display = localFont({
  src: "../fonts/Inter-latin.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "100 900",
});

const mono = localFont({
  src: [
    { path: "../fonts/IBMPlexMono-400-latin.woff2", weight: "400", style: "normal" },
    { path: "../fonts/IBMPlexMono-500-latin.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

function resolveSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  }
  return SITE_URL;
}

const siteUrl = resolveSiteUrl();
const description = SITE_DESCRIPTION;

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} · ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description,
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  keywords: [
    "LLM router",
    "GPU cost optimizer",
    "prompt caching",
    "BYOK",
    "OpenAI compatible",
    "model routing",
    "quality gate",
    "AI cost optimization",
    "Promptimizer",
  ],
  authors: [{ name: SITE_NAME, url: siteUrl }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "technology",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description,
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: SITE_NAME,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · ${SITE_TAGLINE}`,
    description,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F7FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <JsonLd />
      </head>
      <body className="font-sans antialiased">
        <Header />
        <main className="pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
