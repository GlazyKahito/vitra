import type { Metadata } from "next";
import Link from "next/link";
import { SilkWaves } from "@/components/stage/silk-waves";
import { LoginForm } from "@/components/auth/login-form";
import { DemoLogins, type DemoAccount } from "@/components/auth/demo-logins";
import { DevelopingStrip } from "@/components/auth/developing-strip";
import { Stagger, StaggerItem } from "@/components/auth/login-motion";
import { EphemeralDemoNotice, EphemeralDemoProvider } from "@/components/shell/demo-mode";
import { isEphemeralDemo } from "@/lib/runtime-mode";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  // Only allow same-origin relative paths.
  if (!s || !s.startsWith("/") || s.startsWith("//")) return undefined;
  return s;
}

/** One-click demo logins: dev servers, the ephemeral Vercel demo, or an explicit VITRA_DEMO_LOGINS=1. */
function demoLoginsEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.VITRA_DEMO_LOGINS === "1" || isEphemeralDemo();
}

/** The seeded accounts (db/seed.ts), with the same SEED_*_PASSWORD overrides the seed honours. */
function demoAccounts(): DemoAccount[] {
  return [
    { role: "admin", label: "Admin", email: "admin@vitra.local", password: process.env.SEED_ADMIN_PASSWORD ?? "vitra-admin", note: "All access" },
    { role: "clinician", label: "Clinician", email: "clinician@vitra.local", password: process.env.SEED_CLINICIAN_PASSWORD ?? "vitra-clinician", note: "Review" },
    { role: "operator", label: "Operator", email: "operator@vitra.local", password: process.env.SEED_OPERATOR_PASSWORD ?? "vitra-operator", note: "Capture" },
    { role: "researcher", label: "Researcher", email: "researcher@vitra.local", password: process.env.SEED_RESEARCHER_PASSWORD ?? "vitra-researcher", note: "Calibration" },
  ];
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const demo = demoLoginsEnabled() ? demoAccounts() : [];

  return (
    <>
      <SilkWaves />
      {/* Fits one screen: no page scroll from 1280×720 up; type and gaps scale with the viewport height. */}
      <Stagger className="relative z-10 grid h-[100dvh] min-h-[640px] grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] gap-[clamp(24px,3vw,48px)] overflow-hidden px-[clamp(24px,2.6vw,48px)] py-[clamp(16px,3vh,32px)]">
        {/* ── left: the instrument ── */}
        <StaggerItem className="flex min-h-0">
          <aside className="glass glass-sheen flex h-full w-full flex-col justify-between overflow-hidden px-[clamp(32px,3.4vw,56px)] py-[clamp(24px,4.5vh,44px)]">
            <div className="flex items-center justify-between">
              <Link href="/" className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-[var(--lux-platinum)]/70 transition-colors hover:text-[var(--lux-champagne)]">
                KJS-HC-03
              </Link>
              <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--lux-platinum)]/60">
                <span className="size-1.5 rounded-full bg-[#5fd4e6]" aria-hidden />
                Optics idle
              </span>
            </div>

            <div className="max-w-[560px]">
              <h1 className="t-serif text-[clamp(5rem,15vh,9rem)] leading-[0.82] tracking-[-0.03em] !text-[var(--lux-ivory)]">Vitra</h1>
              <p className="t-serif mt-[clamp(6px,1.4vh,16px)] text-[clamp(1.35rem,3vh,1.9rem)] italic leading-tight !text-[var(--lux-champagne)]/90">
                Reagent colour to measurable data.
              </p>
              <div className="mt-[clamp(20px,5vh,48px)]">
                <DevelopingStrip />
              </div>
              <dl className="mt-[clamp(16px,3.6vh,36px)] grid grid-cols-3 gap-6 border-t border-[rgb(var(--lc-ivory-rgb)/0.1)] pt-[clamp(10px,2vh,20px)]">
                {[
                  ["Pads", "10"],
                  ["Reaction window", "120 s"],
                  ["Feature vector", "30-D RGB"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[var(--lux-platinum)]/55">{k}</dt>
                    <dd className="mt-1.5 font-mono text-[13px] tabular-nums text-[var(--lux-ivory)]/85">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--lux-platinum)]/70">Research prototype · not a medical device</p>
          </aside>
        </StaggerItem>

        {/* ── right: authentication ── */}
        <div className="flex min-h-0 flex-col">
          <StaggerItem className="flex items-center justify-end gap-5">
            <EphemeralDemoProvider value={isEphemeralDemo()}>
              <EphemeralDemoNotice />
            </EphemeralDemoProvider>
            <Link href="/" className="text-[13px] text-[var(--lux-platinum)]/70 transition-colors hover:text-[var(--lux-ivory)]">
              ← Back to overview
            </Link>
          </StaggerItem>

          <div className="flex min-h-0 flex-1 items-center py-[clamp(8px,1.6vh,16px)]">
            <div className="glass mx-auto w-full max-w-[540px] px-[clamp(28px,2.6vw,40px)] py-[clamp(20px,3.6vh,34px)]">
              <StaggerItem>
                <div className="flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-[0.18em]">
                  <span className="text-[var(--lux-gold)]">Sign in</span>
                  <span className="text-[var(--lux-platinum)]/35">/</span>
                  <span className="text-[var(--lux-platinum)]/70">Analysis console</span>
                </div>
                <h2 className="t-serif mt-[clamp(6px,1.2vh,12px)] text-[clamp(2.4rem,5.2vh,3.6rem)] leading-[0.95] !text-[var(--lux-ivory)]">
                  Operator <span className="italic">authentication.</span>
                </h2>
                <p className="mt-[clamp(6px,1.1vh,10px)] truncate text-[13.5px] text-[var(--lux-platinum)]/75">Sessions and decisions are recorded in the audit trail.</p>
              </StaggerItem>
              <StaggerItem className="mt-[clamp(14px,2.6vh,24px)]">
                <LoginForm next={next} />
              </StaggerItem>
              {demo.length > 0 ? (
                <StaggerItem className="mt-[clamp(14px,2.6vh,26px)] border-t border-[rgb(var(--lc-ivory-rgb)/0.1)] pt-[clamp(12px,2.2vh,22px)]">
                  <DemoLogins accounts={demo} next={next} />
                </StaggerItem>
              ) : null}
            </div>
          </div>

          <StaggerItem className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--lux-platinum)]/50">K J Somaiya School of Engineering · KJS-HC-03</StaggerItem>
        </div>
      </Stagger>
    </>
  );
}
