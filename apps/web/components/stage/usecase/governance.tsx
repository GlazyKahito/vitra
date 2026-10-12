"use client";

import { useRef } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { Chapter, ChapterCopy, ChapterHeadline } from "@/components/landing/chapter";
import { gsap, useScrollScene } from "@/components/landing/fx/use-scroll-scene";
import type { UseCaseChapterProps } from "./why-hard";

const GOLD = "var(--lux-gold, #c9a96e)";

type Status = "In code" | "Partial" | "Not used" | "Future work";

interface Row {
  area: string;
  rel: "High" | "Low";
  /** The use case's recommended consideration, condensed. */
  rec: string;
  status: Status;
  /** What the software in this repository actually does (see docs/security.md). */
  today: string;
}

const ROWS: readonly Row[] = [
  {
    area: "Privacy & data protection",
    rel: "High",
    rec: "AES-256 for data at rest and in transit. Anonymised model-training data. Role-based access to the hospital database. Compliance with the DPDP Act 2023.",
    status: "Partial",
    today:
      "Five-role access control enforced on the server, scrypt-hashed passwords, pseudonymous sample codes with no name or MRN fields, and an append-only audit log. Encryption at rest belongs to the deployment's database and storage layer, and TLS terminates at a reverse proxy. No DPDP compliance is claimed.",
  },
  {
    area: "AI security & trustworthiness",
    rel: "High",
    rec: "Reproducible outputs across strip batches and lighting conditions. Predictions validated against gold-standard laboratory results. Uncertainty quantified so clinicians see model confidence.",
    status: "Partial",
    today:
      "Nine image-quality checks gate every run. Calibration baselines are scored with group-aware five-fold cross-validation and carry an empirical 95% residual interval. Batch, lighting and laboratory validation have not been done.",
  },
  {
    area: "Responsible AI",
    rel: "High",
    rec: "No false negatives on critical analytes such as glucose and blood. Results presented as decision support only, with clear uncertainty indicators.",
    status: "Partial",
    today:
      "Results are framed as decision support and every synthetic value is labelled SYNTHETIC. Glucose and blood are marked critical, but no false-negative rate can be claimed without clinical validation. Reference-interval flagging is future work; none ship.",
  },
  {
    area: "Generative AI / LLMs",
    rel: "Low",
    rec: "Not part of the colorimetric pipeline. Future scope: report narration or anomaly explanation as an add-on.",
    status: "Not used",
    today: "No language model anywhere in the pipeline. If narration is ever added, it may describe a value; it must never alter a measured one.",
  },
  {
    area: "Agentic AI",
    rel: "Low",
    rec: "Not applicable at present. The system is a deterministic, fully automated pipeline with no autonomous agent.",
    status: "In code",
    today: "Quality checks, strip localisation, pad-grid segmentation, colour features, regression: a fixed sequence of deterministic steps. Nothing decides on its own what runs next.",
  },
  {
    area: "Human-in-the-loop",
    rel: "High",
    rec: "A qualified clinician or pathologist reviews and approves every result before any clinical action. Out-of-range results flagged for immediate review.",
    status: "In code",
    today: "A review queue records accept, reject or repeat decisions with notes, and every decision is audited. A setting can refuse report generation until a run has been reviewed.",
  },
  {
    area: "Regulatory & governance",
    rel: "High",
    rec: "An In Vitro Diagnostic device under CDSCO MDR 2017, needing approval before clinical deployment. Patient data under the DPDP Act 2023. Ethics committee approval for validation studies.",
    status: "Future work",
    today: "VITRA is a research prototype. It is not registered under MDR 2017, not a medical device and not clinically validated. No ethics approval exists; all data is synthetic.",
  },
];

const HIGH = ROWS.filter((r) => r.rel === "High").length;
const LOW = ROWS.length - HIGH;
const COLS = "grid-cols-[56px_1.05fr_104px_1.7fr_1.85fr]";

function StatusChip({ s }: { s: Status }) {
  const tone = s === "In code" ? "code" : s === "Partial" ? "partial" : s === "Not used" ? "none" : "future";
  return (
    <span className="uc-status" data-tone={tone}>
      <span className="uc-status-dot" aria-hidden />
      {s}
    </span>
  );
}

/**
 * Built to be trusted, before it is used. The use case's seven governance
 * areas as a matrix; a scanning line sweeps down it with scroll and each row
 * develops as the line passes. The last column is the honest one: what the
 * software does today versus what is deployment-level or future work.
 */
export function Governance({ index = "10" }: UseCaseChapterProps) {
  const ref = useRef<HTMLDivElement>(null);

  useScrollScene(ref, (el) => {
    const body = el.querySelector<HTMLElement>("[data-rows]")!;
    const rows = Array.from(body.querySelectorAll<HTMLElement>("[data-row]"));
    const scan = body.querySelector<HTMLElement>("[data-scan]")!;

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: body, start: "top 70%", end: "bottom 75%", scrub: 0.7, invalidateOnRefresh: true },
    });
    tl.fromTo(scan, { y: 0, opacity: 1 }, { y: () => body.offsetHeight, duration: 1 }, 0);
    tl.to(scan, { opacity: 0, duration: 0.05 }, 0.97);
    rows.forEach((row) => {
      const at = row.offsetTop / Math.max(1, body.offsetHeight);
      const span = row.offsetHeight / Math.max(1, body.offsetHeight);
      tl.fromTo(row, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: span }, at);
      tl.fromTo(row.querySelector("[data-num]"), { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: span * 0.8, ease: "power2.out" }, at);
      tl.fromTo(row.querySelector("[data-badge]"), { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: span * 0.6, ease: "back.out(2.4)" }, at + span * 0.2);
    });

    gsap.from(el.querySelectorAll("[data-head]"), {
      y: 30,
      opacity: 0,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: { trigger: el.querySelector("[data-matrix]"), start: "top 90%", end: "top 60%", scrub: 0.6 },
    });
  });

  return (
    <Chapter index={index} label="Governance" id="governance">
      <div ref={ref} className="pb-32 pt-20">
        <div className="grid grid-cols-[1.3fr_1fr] items-end gap-16">
          <ChapterHeadline size="text-[108px]" className="max-w-[13ch]">
            {"Built to be trusted, *before it is used.*"}
          </ChapterHeadline>
          <div className="pb-3">
            <ChapterCopy>
              The use case sets out seven governance areas, each with a relevance rating and a recommended consideration. Here they are, condensed, beside a plain account
              of what the software does today and what is still deployment work or future work.
            </ChapterCopy>
            <p className="mt-6 flex gap-6 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-4">
              <span>
                <span style={{ color: GOLD }}>{ROWS.length}</span> areas
              </span>
              <span>
                <span style={{ color: GOLD }}>{HIGH}</span> high
              </span>
              <span>
                <span className="text-fg-2">{LOW}</span> low
              </span>
            </p>
          </div>
        </div>

        <div data-matrix className="mt-20">
          <GlassTilt className="px-3 pb-3 pt-2" max={1.5}>
            <div role="table" aria-label="KJS-HC-03 governance areas">
              <div role="row" className={`grid ${COLS} gap-6 px-6 py-5 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-4`}>
                <span role="columnheader" data-head>
                  №
                </span>
                <span role="columnheader" data-head>
                  Area
                </span>
                <span role="columnheader" data-head>
                  Relevance
                </span>
                <span role="columnheader" data-head>
                  The use case recommends
                </span>
                <span role="columnheader" data-head className="text-[var(--lux-ivory,#f2ebdd)]">
                  In VITRA today
                </span>
              </div>

              <div data-rows role="rowgroup" className="relative">
                {ROWS.map((r, i) => (
                  <div
                    key={r.area}
                    role="row"
                    data-row
                    className={`uc-gov-row grid ${COLS} items-start gap-6 border-t border-[rgba(242,235,221,0.1)] px-6 py-6`}
                  >
                    <span role="cell" data-num className="t-serif text-[40px] leading-none" style={{ color: GOLD }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span role="cell" className="pt-1 text-[17px] font-medium leading-snug tracking-[-0.01em] text-[var(--lux-ivory,#f2ebdd)]">
                      {r.area}
                    </span>
                    <span role="cell" className="pt-1">
                      <span data-badge className={`uc-badge ${r.rel === "High" ? "uc-badge-high" : "uc-badge-low"}`}>
                        {r.rel}
                      </span>
                    </span>
                    <span role="cell" className="text-[13.5px] leading-relaxed text-fg-2">
                      {r.rec}
                    </span>
                    <span role="cell" className="uc-today block rounded-[12px] px-4 py-3">
                      <StatusChip s={r.status} />
                      <span className="mt-2 block text-[13px] leading-relaxed text-fg-3">{r.today}</span>
                    </span>
                  </div>
                ))}
                <div data-scan className="uc-scan pointer-events-none absolute inset-x-0 top-0 opacity-0" aria-hidden />
              </div>
            </div>
          </GlassTilt>
        </div>

        <div className="mt-6 flex items-start justify-between gap-10 font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-fg-4">
          <p className="max-w-[90ch] flex-1">
            Recommendations condensed from the KJS-HC-03 governance table. &ldquo;In VITRA today&rdquo; describes the software in this repository, not a deployment. No
            regulatory or data-protection compliance is claimed.
          </p>
          <ul className="flex shrink-0 gap-5 normal-case tracking-normal">
            {(["In code", "Partial", "Not used", "Future work"] as const).map((s) => (
              <li key={s}>
                <StatusChip s={s} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Chapter>
  );
}
