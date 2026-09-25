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
        <div className="absolute inset-0 bg-slate-950/30 sm:bg-slate-950/38" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/45 via-slate-950/12 to-slate-950/72 sm:from-slate-950/52 sm:via-transparent sm:to-slate-950/82" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[hsl(var(--background))] to-transparent sm:h-36" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[min(100svh,34rem)] max-w-6xl flex-col items-center justify-center px-6 pb-14 pt-28 text-center sm:min-h-[46rem] sm:px-6 sm:pb-28 sm:pt-44">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/70 sm:text-xs sm:tracking-[0.14em]">
          Promptimizer
        </p>

        <h1 className="mt-4 max-w-[12ch] font-display text-[clamp(2.4rem,11vw,2.95rem)] font-bold leading-[0.98] tracking-[-0.05em] text-balance text-white drop-shadow-md sm:mt-5 sm:max-w-5xl sm:text-[clamp(3.2rem,8.2vw,6.8rem)] sm:leading-[0.92] sm:tracking-[-0.055em]">
          <span className="block">Model routing,</span>
          <span className="relative mt-0.5 block font-semibold text-[#b4dfc0] sm:mt-1">
            made deliberate.
            <span className="absolute -bottom-[0.05em] left-[14%] right-[14%] h-[2px] rounded-full bg-gradient-to-r from-transparent via-[#8fcea0] to-transparent opacity-85 sm:-bottom-[0.08em] sm:left-[10%] sm:right-[10%] sm:h-[2.5px]" />
          </span>
        </h1>

        <p className="mt-4 max-w-[21rem] text-[15px] leading-[1.55] text-white/86 drop-shadow-sm sm:mt-5 sm:max-w-lg sm:text-lg sm:leading-relaxed sm:text-white/88">
          Dispatch across your fleet. Guard quality at the edge. Cut token spend — zero SDK rewrites.
        </p>

        <div className="mt-7 flex w-full max-w-[15.5rem] flex-col gap-2.5 sm:mt-8 sm:w-auto sm:max-w-none sm:flex-row sm:justify-center sm:gap-3">
          <Link
            href={isLoggedIn ? "/console" : "/signup"}
            className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 shadow-[0_10px_28px_rgb(0_0_0_/0.28)] transition-transform duration-150 hover:-translate-y-0.5 sm:h-12 sm:w-auto sm:px-7"
          >
            <span>{isLoggedIn ? "Open console" : "Start routing"}</span>
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/22 bg-white/[0.08] px-6 text-sm font-semibold text-white backdrop-blur-md transition-colors duration-150 hover:border-white/40 hover:bg-white/16 sm:h-12 sm:w-auto sm:px-7"
          >
            Read the docs
          </a>
        </div>

        <div className="mt-6 flex max-w-[17rem] flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] font-medium text-white/75 sm:mt-7 sm:max-w-none sm:gap-x-5 sm:text-xs sm:text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            OpenAI-compatible
          </span>
          <span className="hidden text-white/30 sm:inline">&bull;</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            Bring your own keys
          </span>
          <span className="hidden text-white/30 sm:inline">&bull;</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="size-3.5 text-emerald-400" strokeWidth={2.5} />
            No routing markup
          </span>
        </div>
      </div>
    </section>
  );
}
