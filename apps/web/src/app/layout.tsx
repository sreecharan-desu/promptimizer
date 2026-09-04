import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { ThemeScript } from "@/components/theme-script";
import "./tailwind.generated.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Inter({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
  display: "swap",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "")}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`
    : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

const description = "Quality-aware LLM router for OpenAI-compatible APIs. Bring your own key.";

export const metadata: Metadata = {
  title: {
    default: "Promptimizer",
    template: "%s · Promptimizer",
  },
  description,
  metadataBase: new URL(siteUrl),
  applicationName: "Promptimizer",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Promptimizer",
    description,
    type: "website",
    siteName: "Promptimizer",
  },
  twitter: {
    card: "summary_large_image",
    title: "Promptimizer",
    description,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${sans.variable} ${display.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="font-sans antialiased">
        <Header />
        <main className="pt-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
