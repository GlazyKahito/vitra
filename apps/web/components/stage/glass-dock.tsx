"use client";

import Link from "next/link";
import { useLenis } from "lenis/react";
import { useEffect, useRef, useState } from "react";
import { useStage } from "./smooth-scroll";

const LINKS = [
  { href: "/methodology", label: "Methodology" },
  { href: "/login", label: "Sign in" },
  { href: "/console", label: "Console" },
] as const;

/**
 * A floating glass dock: the site navigation once the homescreen has scrolled
 * past its cover. A thin film counter inside it tracks progress down the page.
 */
export function GlassDock() {
  const { introDone } = useStage();
  const [shown, setShown] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);
  const lenis = useLenis(({ scroll, limit }) => {
    setShown(scroll > window.innerHeight * 0.6);
    if (bar.current) bar.current.style.transform = `scaleX(${limit > 0 ? scroll / limit : 0})`;
  });

  useEffect(() => {
    if (lenis) return;
    // reduced-motion / no-Lenis fallback
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.6);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [lenis]);

  const visible = introDone && shown;
  return (
    <nav
      aria-label="Primary"
      className="glass glass-pill fixed left-1/2 top-5 z-50 flex h-[52px] items-center gap-1 pl-5 pr-1.5 transition-[opacity,transform] duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
      style={{ opacity: visible ? 1 : 0, transform: `translate(-50%, ${visible ? 0 : -24}px)`, pointerEvents: visible ? "auto" : "none" }}
    >
      <button type="button" onClick={() => lenis?.scrollTo(0, { duration: 2 })} className="t-serif mr-4 text-[22px] leading-none tracking-[0.04em] text-[#f2ebdd]">
        VITRA
      </button>
      {LINKS.map((l) =>
        l.href === "/console" ? (
          <Link key={l.href} href={l.href} className="ml-2 rounded-full bg-[#f2ebdd] px-4 py-2 text-[13px] font-medium text-[#0b0c0e] transition-transform hover:-translate-y-px">
            Open {l.label}
          </Link>
        ) : (
          <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-[13px] text-[#f2ebdd]/75 transition-colors hover:bg-white/[0.06] hover:text-[#f2ebdd]">
            {l.label}
          </Link>
        ),
      )}
      <span aria-hidden className="absolute inset-x-6 bottom-[5px] h-px origin-left bg-gradient-to-r from-[#c9a96e]/0 via-[#ebdab0]/70 to-[#c9a96e]/70" ref={bar} style={{ transform: "scaleX(0)" }} />
    </nav>
  );
}
