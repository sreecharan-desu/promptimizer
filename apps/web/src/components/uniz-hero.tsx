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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Image
          src="/hero-landscape.png"
          alt="Snowy mountain peaks landscape"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_48%] sm:object-[center_38%]"
        />
        <div className="absolute inset-0 bg-slate-950/25 sm:bg-slate-950/35" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/10 to-slate-950/70 sm:from-slate-950/50 sm:via-transparent sm:to-slate-950/80" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[hsl(var(--background))] to-transparent sm:h-32" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[min(100svh,34rem)] max-w-6xl flex-col items-center justify-center px-6 pb-14 pt-28 text-center sm:min-h-[48rem] sm:px-6 sm:pb-32 sm:pt-48">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase text-white/90 backdrop-blur-md sm:border-white/20 sm:bg-black/30 sm:px-4 sm:py-1.5 sm:text-[11px] sm:tracking-[0.14em]">
          <span>Promptimizer &middot; Production Routing</span>
        </div>

        <h1 className="mt-5 max-w-[11.5ch] font-display text-[clamp(2.35rem,10.8vw,2.9rem)] font-bold leading-[0.98] tracking-[-0.048em] text-balance text-white drop-shadow-md sm:mt-7 sm:max-w-5xl sm:text-[clamp(3.3rem,8.5vw,7.6rem)] sm:leading-[0.9] sm:tracking-[-0.055em]">
          <span className="block">Model routing,</span>
          <span className="relative mt-0.5 block font-semibold text-[#a8d5b5] sm:mt-1">
            made deliberate.
            <span className="absolute -bottom-[0.06em] left-[12%] right-[12%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#86c898] to-transparent opacity-80 sm:-bottom-[0.1em] sm:left-[8%] sm:right-[8%] sm:h-[2.5px] sm:opacity-90" />
          </span>
        </h1>

        <p className="mt-4 max-w-[20.5rem] text-[15px] leading-[1.55] text-white/88 drop-shadow-sm sm:mt-6 sm:max-w-xl sm:text-lg sm:leading-relaxed sm:text-white/90">
          Intelligently dispatch requests across your model fleet. Protect quality with edge guardrails and cut token spend with zero SDK rewrites.
        </p>

        <div className="mt-7 flex w-full max-w-[16.5rem] flex-col gap-2.5 sm:mt-9 sm:w-auto sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
          <Link
            href={isLoggedIn ? "/console" : "/signup"}
            className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-slate-950 shadow-[0_8px_24px_rgb(0_0_0_/0.22)] transition-transform duration-150 hover:-translate-y-0.5 sm:h-12 sm:w-auto sm:gap-2 sm:px-7"
          >
            <span>{isLoggedIn ? "Open console" : "Build your routing policy"}</span>
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-md transition-colors duration-150 hover:border-white/40 hover:bg-white/18 sm:h-12 sm:w-auto sm:px-7"
          >
            Read the docs
          </a>
        </div>

        <div className="mt-6 flex max-w-[18rem] flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-white/80 sm:mt-8 sm:max-w-none sm:gap-x-5 sm:text-xs sm:text-white/85">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            OpenAI-compatible
          </span>
          <span className="hidden text-white/35 sm:inline">&bull;</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            Bring your own keys
          </span>
          <span className="hidden text-white/35 sm:inline">&bull;</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            No routing markup
          </span>
        </div>
      </div>
    </section>
  );
}
