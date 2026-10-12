import { Reveal } from "@/components/motion/reveal";
import { Chapter } from "./chapter";

const LINES = [
  { k: "Not a medical device", v: "VITRA is a research prototype. It is not registered, certified or intended for diagnosis." },
  { k: "No clinical validation", v: "No model has been compared against laboratory reference measurements. No accuracy is claimed." },
  { k: "Synthetic data is labelled", v: "Every demo value is produced from synthetic fixtures and is marked SYNTHETIC in the data and the interface." },
  { k: "No reference intervals", v: "The platform ships without normal ranges and never colours a result as normal or abnormal." },
] as const;

/** Chapter 07 — honesty strip. */
export function Honesty() {
  return (
    <Chapter index="07" label="What this is not" id="honesty">
      <Reveal>
        <dl className="grid grid-cols-4 gap-10 py-20">
          {LINES.map((l, i) => (
            <div key={l.k} className="border-l border-line pl-6">
              <dt className="flex items-baseline gap-3">
                <span className="font-mono text-[11px] tabular-nums text-notice">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[17px] font-medium tracking-[-0.01em] text-fg">{l.k}</span>
              </dt>
              <dd className="mt-3 text-[13.5px] leading-relaxed text-fg-3">{l.v}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </Chapter>
  );
}
