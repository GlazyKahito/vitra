import Link from "next/link";
import type { ReactNode } from "react";
import { Timecode } from "@/components/motion/timecode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

export interface PublicShellProps {
  children: ReactNode;
  /** Let the first section sit under the transparent top bar. */
  overlayNav?: boolean;
  className?: string;
}

export const PUBLIC_NAV = [
  { label: "Console", href: "/console" },
  { label: "Methodology", href: "/methodology" },
] as const;

export function PublicTopBar({ overlay }: { overlay?: boolean }) {
  return (
    <header className={cn("z-50 flex h-16 items-center justify-between px-10", overlay ? "absolute inset-x-0 top-0" : "sticky top-0 border-b border-line bg-[rgba(6,6,7,0.8)] backdrop-blur-sm")}>
      <Wordmark size="md" />
      <nav className="flex items-center gap-7" aria-label="Public">
        {PUBLIC_NAV.map((n) => (
          <Link key={n.href} href={n.href} className="text-[13px] text-fg-3 transition-colors hover:text-fg">
            {n.label}
          </Link>
        ))}
        <Button href="/login" variant="secondary" size="sm">
          Sign in
        </Button>
      </nav>
      <Timecode />
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-line px-10 pb-10 pt-14">
      <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
        <div>
          <Wordmark size="md" tag />
          <p className="mt-5 max-w-[360px] text-[13px] leading-relaxed text-fg-3">
            An experimental computer-vision platform for controlled urine-strip analysis, calibration, and clinical review.
          </p>
        </div>
        <FooterColumn title="Routes" items={[["Console", "/console"], ["New analysis", "/analysis/new"], ["Review queue", "/review"], ["Sign in", "/login"]]} />
        <FooterColumn
          title="Methodology"
          items={[["Pipeline", "/methodology#pipeline"], ["Sources of variability", "/methodology#variability"], ["Model limitations", "/methodology#limitations"], ["Clinical validation", "/methodology#validation"]]}
        />
        <FooterColumn title="Governance" items={[["DPDP Act 2023", "/methodology#dpdp"], ["CDSCO MDR 2017 — IVD", "/methodology#cdsco"], ["Implemented / future", "/methodology#roadmap"]]} />
      </div>
      <div className="mt-12 flex items-end justify-between border-t border-line pt-5">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
          <div>Built for the KJS-HC-03 use case. No endorsement by K. J. Somaiya Hospital or Paramcare Lifesciences is implied.</div>
          <div className="mt-1">Research prototype. Not a medical device. Not clinically validated.</div>
        </div>
        <div className="flex items-center gap-5">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">KJS-HC-03</span>
          <Timecode />
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <div className="t-eyebrow mb-4">{title}</div>
      <ul className="flex flex-col gap-2.5">
        {items.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="text-[13px] text-fg-2 transition-colors hover:text-fg">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Top nav + footer for public pages (methodology, login etc.). */
export function PublicShell({ children, overlayNav, className }: PublicShellProps) {
  return (
    <div className={cn("relative flex min-h-screen flex-col bg-ink-0", className)}>
      <PublicTopBar overlay={overlayNav} />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
