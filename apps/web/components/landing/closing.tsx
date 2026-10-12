"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowRight, ClipboardList, ListChecks, Timer, type LucideIcon } from "lucide-react";
import { PublicFooter } from "@/components/shell/public-shell";
import { Chapter } from "./chapter";
import { SplitChars } from "./fx/split";
import { gsap, useScrollScene } from "./fx/use-scroll-scene";

const STEPS: { n: string; title: string; sub: string; Icon: LucideIcon }[] = [
  { n: "01", title: "Register a sample", sub: "Sample ID · strip product · operator", Icon: ClipboardList },
  { n: "02", title: "Wait 120 s", sub: "Fixed reaction window · then capture", Icon: Timer },
  { n: "03", title: "Review the ten results", sub: "State per analyte · clinician sign-off", Icon: ListChecks },
];

/**
 * Chapter 08 — the closing call. The headline rises letter by letter, then a
 * compact "Start a run" panel on glass: three steps, the two ways in, and the
 * project credits. Entrances are fade/rise only, scrubbed; no flashes.
 */
export function Closing() {
  const ref = useRef<HTMLDivElement>(null);

  useScrollScene(ref, (root) => {
    const h = root.querySelector<HTMLElement>("[data-title]")!;
    gsap.fromTo(
      h.querySelectorAll("[data-c]"),
      { yPercent: 115, rotate: 7, opacity: 0 },
      { yPercent: 0, rotate: 0, opacity: 1, ease: "power3.out", stagger: 0.035, scrollTrigger: { trigger: h, start: "top 92%", end: "top 38%", scrub: 0.8 } },
    );
    gsap.from(root.querySelector("[data-after]"), { y: 30, opacity: 0, ease: "power2.out", scrollTrigger: { trigger: h, start: "top 60%", end: "top 30%", scrub: 0.6 } });

    const panel = root.querySelector<HTMLElement>("[data-run]")!;
    const tl = gsap.timeline({ defaults: { ease: "power2.out" }, scrollTrigger: { trigger: panel, start: "top 92%", end: "top 45%", scrub: 0.7 } });
    tl.from(panel, { y: 70, opacity: 0, duration: 1 }, 0);
    tl.from(panel.querySelectorAll("[data-step]"), { y: 28, opacity: 0, stagger: 0.18, duration: 0.6 }, 0.35);
    tl.from(panel.querySelectorAll("[data-link]"), { scaleX: 0, stagger: 0.18, duration: 0.5, transformOrigin: "0% 50%" }, 0.55);
    tl.from(panel.querySelectorAll("[data-ctas], [data-credits]"), { y: 18, opacity: 0, stagger: 0.12, duration: 0.5 }, 0.9);
  });

  return (
    <Chapter index="13" label="Closing" id="closing" bleed>
      <div ref={ref}>
        <div className="relative px-10 pb-16 pt-24">
          <h2 data-title className="t-serif text-[min(12.6vw,188px)] leading-[0.9] tracking-[-0.025em]">
            <SplitChars text="Open the *console.*" />
          </h2>
          <p data-after className="mt-8 max-w-[52ch] text-[18px] leading-relaxed text-fg-2">
            Sign in with a demo account, upload or capture a strip image, and follow one run from pixels to a reviewed report.
          </p>
        </div>

        {/* start a run */}
        <div className="px-10 pb-16">
          <div data-run className="glass px-10 pb-8 pt-9">
            <div className="flex items-end justify-between gap-10">
              <div>
                <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--lc-gold)]">Start a run</div>
                <div className="t-serif mt-3 text-[40px] leading-none">
                  Three steps, <em>one reviewed report.</em>
                </div>
              </div>
              <div data-ctas className="flex shrink-0 items-center gap-3">
                <Link className="glass-cta" href="/console">
                  Open Analysis Console
                  <span className="glass-cta-dot">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
                <Link className="glass-cta lc-cta-ghost" href="/login">
                  Sign in with a demo account
                  <span className="glass-cta-dot">
                    <ArrowRight className="size-4" />
                  </span>
                </Link>
              </div>
            </div>

            <ol className="mt-10 grid grid-cols-3 gap-6">
              {STEPS.map(({ n, title, sub, Icon }, i) => (
                <li key={n} data-step className="relative rounded-[16px] border border-[rgb(var(--lc-ivory-rgb)/0.1)] bg-[rgb(var(--lc-onyx-rgb)/0.28)] px-6 py-5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] tracking-[0.2em] text-[var(--lc-gold)]">{n}</span>
                    <Icon className="size-[22px] text-[var(--lc-gold)]" strokeWidth={1.25} aria-hidden />
                  </div>
                  <div className="t-serif mt-5 text-[28px] leading-none">{title}</div>
                  <div className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--lux-platinum,#bfc1c2)]">{sub}</div>
                  {i < STEPS.length - 1 ? <span data-link className="absolute -right-6 top-1/2 h-px w-6 bg-[rgb(var(--lc-gold-rgb)/0.55)]" aria-hidden /> : null}
                </li>
              ))}
            </ol>

            <div
              data-credits
              className="mt-9 border-t border-[rgb(var(--lc-ivory-rgb)/0.1)] pt-5 font-mono text-[10.5px] uppercase leading-[1.8] tracking-[0.12em] text-[var(--lux-platinum,#bfc1c2)]"
            >
              <div>
                KJS-HC-03 · Urine Test Strip Reader using Colorimetry as a Point-of-Care Technology · K J Somaiya School of Engineering · Faculty owners: Dr. Ninad
                Mehendale, Dr. Jagannath Nirmal
              </div>
              <div className="mt-1 text-[var(--lc-gold)]">Research prototype. Not a medical device. Not clinically validated.</div>
            </div>
          </div>
        </div>

        {/* site footer, on glass */}
        <div className="lc-footer glass mx-10 mb-10 overflow-hidden">
          <PublicFooter />
        </div>
      </div>
    </Chapter>
  );
}
