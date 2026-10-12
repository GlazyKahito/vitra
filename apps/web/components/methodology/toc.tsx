"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TocItem {
  id: string;
  label: string;
  index?: string;
}

/** Sticky table of contents that tracks the section in view. */
export function MethodologyToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="sticky top-24">
      <div className="t-eyebrow mb-4">Contents</div>
      <ol className="flex flex-col border-l border-line">
        {items.map((i) => {
          const on = i.id === active;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                className={cn("-ml-px flex items-baseline gap-2.5 border-l py-1.5 pl-4 text-[12.5px] transition-colors", on ? "border-signal text-fg" : "border-transparent text-fg-3 hover:text-fg-2")}
                aria-current={on ? "location" : undefined}
              >
                {i.index ? <span className="font-mono text-[10px] tabular-nums text-fg-4">{i.index}</span> : null}
                {i.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
