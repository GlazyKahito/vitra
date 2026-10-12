"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReagentStrip } from "@/components/strip/reagent-strip";
import { EnclosureSceneLazy } from "@/components/three/EnclosureSceneLazy";
import { PublicTopBar } from "@/components/shell/public-shell";

const HERO_LEVELS = {
  glucose: 0.25,
  protein: 0.4,
  ph: 0.55,
  ketones: 0.15,
  blood: 0.2,
  bilirubin: 0.1,
  urobilinogen: 0.35,
  nitrite: 0.05,
  leucocytes: 0.3,
  specific_gravity: 0.6,
} as const;

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Chapter 01 — full-screen hero. */
export function Hero() {
  const reduced = useReducedMotion();
  const fade = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.9, delay, ease: EASE } };

  return (
    <section className="grain relative flex min-h-screen flex-col overflow-hidden" aria-labelledby="hero-title">
      <PublicTopBar overlay />
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="pointer-events-none absolute -right-40 top-1/3 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(95,212,230,0.10),transparent_60%)]" aria-hidden />

      <div className="relative z-10 grid flex-1 grid-cols-[1.05fr_1fr] items-center gap-12 px-10 pt-24">
        <div>
          <motion.div {...fade(0.05)} className="mb-7 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.14em] text-fg-3">
            <span className="text-signal">01</span>
            <span className="text-fg-4">/</span>
            <span>Reagent colour → measurable data</span>
          </motion.div>
          <motion.h1 {...fade(0.15)} id="hero-title" className="t-display text-[92px] text-fg">
            Turn reagent colours into measurable data.
          </motion.h1>
          <motion.p {...fade(0.3)} className="mt-8 max-w-[46ch] text-[19px] leading-[1.55] text-fg-2">
            An experimental computer-vision platform for controlled urine-strip analysis, calibration, and clinical review.
          </motion.p>
          <motion.div {...fade(0.42)} className="mt-10 flex items-center gap-3">
            <Button href="/console" size="lg" trailing={<ArrowRight className="size-4" />}>
              Open Analysis Console
            </Button>
            <Button href="/methodology" size="lg" variant="secondary">
              Explore the Methodology
            </Button>
          </motion.div>
          <motion.div {...fade(0.55)} className="mt-14 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-4">
            KJS-HC-03 · K J Somaiya School of Engineering · research prototype
          </motion.div>
        </div>

        <motion.div {...fade(0.35)} className="relative flex flex-col items-center">
          <EnclosureSceneLazy height={440} />
          <div className="mt-2 w-full px-6">
            <ReagentStrip levels={HERO_LEVELS} width={560} labels className="mx-auto" />
          </div>
          <div className="mt-4 flex w-full items-center justify-between px-6 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
            <span>Enclosure · idle</span>
            <span>Strip colours illustrative</span>
          </div>
        </motion.div>
      </div>

      <div className="relative z-10 flex items-center justify-between px-10 pb-6 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
        <span>Scroll to begin</span>
        <span className="flex items-center gap-2">
          <span className="pulse-dot size-1.5 rounded-full bg-signal" aria-hidden />
          Reel 01 · synthetic demonstration
        </span>
      </div>
    </section>
  );
}
