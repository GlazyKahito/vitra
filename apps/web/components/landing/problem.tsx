import { Reveal } from "@/components/motion/reveal";
import { demoColor } from "@/lib/analytes";
import { Chapter, ChapterCopy, ChapterHeadline } from "./chapter";

const CHART_BLOCKS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;
const CHART_LABELS = ["neg", "trace", "+", "++", "+++", "++++"] as const;

/** Chapter 02 — the problem: discrete chart swatches vs a continuous ramp. */
export function Problem() {
  return (
    <Chapter index="02" label="The problem" id="problem">
      <div className="grid grid-cols-[1fr_1.1fr] gap-16 py-24">
        <div>
          <Reveal>
            <ChapterHeadline>Reading a strip by eye is a guess.</ChapterHeadline>
          </Reveal>
          <Reveal delay={0.1}>
            <ChapterCopy className="mt-8">
              A reagent pad develops a continuous colour. The printed chart offers five or six blocks, so the reader has to snap a continuous signal to a
              category, under whatever light happens to be in the room, within a window that closes as the pad keeps reacting.
            </ChapterCopy>
          </Reveal>
          <Reveal delay={0.18}>
            <ChapterCopy className="mt-5">
              Two readers of the same strip can disagree by a block. The same reader can disagree with themselves an hour later. The result is a categorical
              output with no record of how close the call was.
            </ChapterCopy>
          </Reveal>
          <Reveal delay={0.26}>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-line pt-6">
              {[
                ["Inter-observer", "Different readers, different blocks"],
                ["Lighting", "Warm, cool, dim — each shifts hue"],
                ["Timing", "Colour keeps developing after the window"],
              ].map(([t, d]) => (
                <div key={t}>
                  <dt className="t-eyebrow">{t}</dt>
                  <dd className="mt-2 text-[13px] leading-relaxed text-fg-3">{d}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="flex flex-col justify-center">
          <figure className="panel p-8">
            <figcaption className="t-eyebrow mb-6 flex items-center justify-between">
              <span>Chart blocks vs continuous signal</span>
              <span className="text-fg-4">Illustrative</span>
            </figcaption>
            {/* discrete */}
            <div className="flex items-end gap-2">
              {CHART_BLOCKS.map((t, i) => (
                <div key={t} className="flex flex-1 flex-col items-center gap-2">
                  <div className="h-14 w-full rounded-[3px] border border-[rgba(0,0,0,0.3)]" style={{ background: demoColor("glucose", t) }} />
                  <span className="font-mono text-[10px] text-fg-4">{CHART_LABELS[i]}</span>
                </div>
              ))}
            </div>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">what the eye is asked to do</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            {/* continuous */}
            <div className="relative">
              <div
                className="h-14 w-full rounded-[3px] border border-[rgba(0,0,0,0.3)]"
                style={{ background: `linear-gradient(90deg, ${demoColor("glucose", 0)}, ${demoColor("glucose", 0.5)}, ${demoColor("glucose", 1)})` }}
              />
              {/* marker */}
              <div className="absolute inset-y-[-6px]" style={{ left: "38%" }} aria-hidden>
                <div className="h-full w-px bg-signal shadow-[0_0_10px_rgba(95,212,230,0.8)]" />
                <div className="absolute -top-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-signal" />
              </div>
              <div className="absolute -bottom-7 font-mono text-[11px] tracking-[0.08em] text-signal" style={{ left: "38%", transform: "translateX(-50%)" }}>
                RGB 142 / 171 / 88
              </div>
            </div>
            <div className="mt-12 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
              <span>Continuous colour at t = 120 s</span>
              <span>One number, with its uncertainty</span>
            </div>
          </figure>
        </Reveal>
      </div>
    </Chapter>
  );
}
