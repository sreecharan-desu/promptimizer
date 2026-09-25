"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DOCS_HOME } from "@/lib/site";
import { useAuthMe } from "@/lib/auth-me";

export function UnizHero() {
  const me = useAuthMe();
  const isLoggedIn = Boolean(me?.user);

  return (
    <section className="relative -mt-16 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <Image
          src="/hero-routing.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Soft read wash — image already carries the mint paths */}
        <div className="absolute inset-0 bg-slate-950/25 sm:bg-slate-950/20" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-transparent to-slate-950/55" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[hsl(var(--background))] via-[hsl(var(--background)/0.55)] to-transparent sm:h-44" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[min(100svh,32rem)] max-w-5xl flex-col items-center justify-center px-6 pb-16 pt-32 text-center sm:min-h-[44rem] sm:px-6 sm:pb-28 sm:pt-40">
        <h1 className="max-w-[11ch] font-display text-[clamp(2.55rem,11vw,3.05rem)] font-semibold leading-[1.02] tracking-[-0.048em] text-balance text-white sm:max-w-4xl sm:text-[clamp(3.4rem,7.5vw,5.8rem)] sm:leading-[0.96] sm:tracking-[-0.055em]">
          <span className="block">Model routing,</span>
          <span className="mt-1 block text-[#b7e0c2]">made deliberate.</span>
        </h1>

        <p className="mt-5 max-w-[20rem] text-[15px] leading-relaxed text-white/80 sm:mt-6 sm:max-w-md sm:text-lg sm:leading-8 sm:text-white/84">
          Route each request to the cheapest model that still gets it right.
        </p>

        <div className="mt-8 flex w-full max-w-[14.5rem] flex-col gap-2.5 sm:mt-9 sm:w-auto sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-3">
          <Link
            href={isLoggedIn ? "/console" : "/signup"}
            className="group inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-slate-950 transition-transform duration-150 hover:-translate-y-0.5 sm:h-12 sm:w-auto sm:px-7"
          >
            <span>{isLoggedIn ? "Open console" : "Start routing"}</span>
            <ArrowRight className="size-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
          <a
            href={DOCS_HOME}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/20 bg-transparent px-6 text-sm font-semibold text-white/90 transition-colors duration-150 hover:border-white/40 hover:bg-white/10 sm:h-12 sm:w-auto sm:px-7"
          >
            Docs
          </a>
        </div>

        <p className="mt-8 hidden text-[12px] font-medium tracking-wide text-white/55 sm:block">
          OpenAI-compatible · Bring your own keys · No routing markup
        </p>
      </div>
    </section>
  );
}
