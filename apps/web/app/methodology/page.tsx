import type { Metadata } from "next";
import Image from "next/image";
import { PublicShell } from "@/components/shell/public-shell";
import { Chip } from "@/components/ui/chip";
import { DIAGRAMS, METHOD_SECTIONS, METHOD_STEPS, MethodologyToc, ROADMAP, type TocItem } from "@/components/methodology";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How VITRA turns a controlled strip photograph into per-analyte values with explicit result states — and what it does not claim.",
};

const TOC: TocItem[] = [
  { id: "pipeline", label: "Pipeline", index: "A" },
  ...METHOD_STEPS.map((s) => ({ id: s.id, label: s.title, index: String(s.n).padStart(2, "0") })),
  ...METHOD_SECTIONS.map((s, i) => ({ id: s.id, label: s.title, index: String.fromCharCode(66 + i) })),
  { id: "roadmap", label: "Implemented today / Future work", index: "H" },
];

export default function MethodologyPage() {
  return (
    <PublicShell>
      {/* header */}
      <header className="border-b border-line px-10 pb-16 pt-20">
        <div className="t-eyebrow mb-5 flex items-center gap-3">
          <span className="text-signal">Methodology</span>
          <span className="text-fg-4">/</span>
          <span>KJS-HC-03 · research prototype</span>
        </div>
        <h1 className="t-display max-w-[16ch] text-[72px]">From a controlled photograph to a number with a state.</h1>
        <p className="mt-8 max-w-[60ch] text-[17px] leading-[1.6] text-fg-2">
          This page describes every stage of the VITRA pipeline, the sources of error we know about, the data a real calibration would need, and the
          regulatory position of the prototype. It is written to be checked, not to persuade.
        </p>
        <div className="mt-8 flex gap-2">
          <Chip tone="notice">Not a medical device</Chip>
          <Chip tone="muted">No clinical validation</Chip>
          <Chip tone="muted">Synthetic data labelled</Chip>
        </div>
      </header>

      <div className="grid grid-cols-[240px_1fr] gap-16 px-10 py-16">
        <aside>
          <MethodologyToc items={TOC} />
        </aside>

        <div className="max-w-[820px]">
          {/* photo */}
          <figure id="pipeline" className="scroll-mt-24">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[var(--radius-md)] border border-line">
              <Image src="/media/prototype-3.jpg" alt="The VITRA prototype enclosure with a reagent strip inserted at the bottom slot" fill sizes="820px" className="object-cover" priority />
            </div>
            <figcaption className="mt-3 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
              <span>Prototype enclosure — KJS-HC-03 use-case document, Fig. 1</span>
              <span>Raspberry Pi 5 · Pi camera · regulated LEDs</span>
            </figcaption>
          </figure>

          <div className="mt-16">
            <div className="t-eyebrow mb-3">A · Pipeline</div>
            <h2 className="font-display text-[34px] font-semibold tracking-[-0.03em]">Eleven steps, in order.</h2>
            <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-fg-3">
              Each step either passes the run forward or stops it with a recorded reason. There is no path from an image to a displayed value that skips a
              check.
            </p>
          </div>

          <ol className="mt-10 flex flex-col">
            {METHOD_STEPS.map((s) => (
              <li key={s.id} id={s.id} className="grid scroll-mt-24 grid-cols-[64px_1fr_240px] gap-8 border-t border-line py-10">
                <span className="font-mono text-[13px] tabular-nums text-signal">{String(s.n).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[22px] font-medium tracking-[-0.02em] text-fg">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-[1.65] text-fg-2">{s.body}</p>
                </div>
                <div className="flex items-start justify-end">{DIAGRAMS[s.n]}</div>
              </li>
            ))}
          </ol>

          {METHOD_SECTIONS.map((sec, i) => (
            <section key={sec.id} id={sec.id} className="scroll-mt-24 border-t border-line py-14">
              <div className="t-eyebrow mb-3">{String.fromCharCode(66 + i)} · {sec.title}</div>
              <h2 className="font-display text-[30px] font-semibold tracking-[-0.03em]">{sec.title}</h2>
              {sec.paragraphs.map((p, j) => (
                <p key={j} className="mt-4 max-w-[64ch] text-[15px] leading-[1.65] text-fg-2">
                  {p}
                </p>
              ))}
              {sec.bullets ? (
                <ul className="mt-6 flex flex-col divide-y divide-line border-y border-line">
                  {sec.bullets.map((b, j) => {
                    const [head, ...rest] = b.split(" — ");
                    return (
                      <li key={j} className="grid grid-cols-[32px_200px_1fr] gap-4 py-3 text-[14px]">
                        <span className="font-mono text-[11px] tabular-nums text-fg-4">{String(j + 1).padStart(2, "0")}</span>
                        <span className="text-fg">{head}</span>
                        <span className="text-fg-3">{rest.join(" — ")}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </section>
          ))}

          <section id="roadmap" className="scroll-mt-24 border-t border-line py-14">
            <div className="t-eyebrow mb-3">H · Status</div>
            <h2 className="font-display text-[30px] font-semibold tracking-[-0.03em]">Implemented today / Future work</h2>
            <div className="panel mt-8 overflow-hidden">
              <table className="table-instrument">
                <thead>
                  <tr>
                    <th className="w-1/2">Implemented today</th>
                    <th className="w-1/2">Future work</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(ROADMAP.implemented.length, ROADMAP.future.length) }).map((_, i) => (
                    <tr key={i}>
                      <td className="align-top">
                        {ROADMAP.implemented[i] ? (
                          <span className="flex items-start gap-2.5">
                            <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-signal" aria-hidden />
                            {ROADMAP.implemented[i]}
                          </span>
                        ) : null}
                      </td>
                      <td className="align-top text-fg-3">
                        {ROADMAP.future[i] ? (
                          <span className="flex items-start gap-2.5">
                            <span className="mt-[7px] size-1.5 shrink-0 rounded-full border border-line-strong" aria-hidden />
                            {ROADMAP.future[i]}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-5 text-[12.5px] leading-relaxed text-fg-4">
              Built for the KJS-HC-03 use case. No endorsement by K. J. Somaiya Hospital or Paramcare Lifesciences is implied. Research prototype — not a
              medical device — not clinically validated.
            </p>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
