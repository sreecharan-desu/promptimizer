"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { DOCS_HOME } from "@/lib/site";
import { useAuthMe } from "@/lib/auth-me";

export function UnizHero() {
  const me = useAuthMe();
  const isLoggedIn = Boolean(me?.user);

  return (
    <section className="relative -mt-16 overflow-hidden">
      {/* Background Mountain Landscape */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Image
          src="/hero-landscape.png"
          alt="Snowy mountain peaks landscape"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_28%] sm:object-[center_38%]"
        />
        {/* Soft atmospheric wash: mountains and snowy valley are clearly visible */}
        <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-[0.3px]" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-transparent to-slate-950/80" />
        
        {/* Bottom smooth fade to page background */}
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[hsl(var(--background))] to-transparent" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 mx-auto flex min-h-[42rem] max-w-6xl flex-col items-center justify-center px-4 pb-28 pt-40 text-center sm:min-h-[48rem] sm:px-6 sm:pb-32 sm:pt-48">
        {/* Elevated Pill Kicker */}
        <div className="inline-flex items-center rounded-full border border-white/25 bg-black/35 px-4 py-1.5 text-[11px] font-semibold tracking-[0.14em] uppercase text-white shadow-sm backdrop-blur-md transition-all hover:bg-black/50">
          <span>Promptimizer &middot; Production Routing</span>
        </div>

        {/* Headline */}
        <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.3rem,8.5vw,7.6rem)] font-bold leading-[0.9] tracking-[-0.055em] text-balance text-white drop-shadow-md">
          <span className="block text-white">Model routing,</span>
          <span className="relative mt-1 block font-semibold text-[#a8d5b5]">
            made deliberate.
            <span className="absolute -bottom-[0.1em] left-[8%] right-[8%] h-[2.5px] rounded-full bg-gradient-to-r from-transparent via-[#86c898] to-transparent opacity-90" />
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 max-w-xl text-base leading-relaxed text-white/90 drop-shadow-sm sm:text-lg">
          Intelligently dispatch requests across your model fleet. Protect quality with edge guardrails and cut token spend with zero SDK rewrites.
        </p>

        {/* Action Buttons */}
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Link
            href={isLoggedIn ? "/console" : "/signup"}
            className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white px-7 text-sm font-bold text-slate-950 shadow-lg shadow-black/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-100 hover:shadow-xl hover:shadow-black/30"
          >
            <span>{isLoggedIn ? "Open console" : "Build your routing policy"}</span>
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center rounded-full border border-white/30 bg-white/15 px-7 text-sm font-semibold text-white shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white/50 hover:bg-white/25"
          >
            Read the docs
          </a>
        </div>

        {/* Proof Points */}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-white/85 drop-shadow-xs">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            OpenAI-compatible
          </span>
          <span className="hidden sm:inline text-white/40">&bull;</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            Bring your own keys
          </span>
          <span className="hidden sm:inline text-white/40">&bull;</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            No routing markup
          </span>
        </div>
      </div>
    </section>
  );
}
