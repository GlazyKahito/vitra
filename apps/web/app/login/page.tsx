import type { Metadata } from "next";
import { Timecode } from "@/components/motion/timecode";
import { Wordmark } from "@/components/shell/wordmark";
import { DeviceIllustration } from "@/components/strip/device-illustration";
import { LoginForm } from "@/components/auth/login-form";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign in" };

function safeNext(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  // Only allow same-origin relative paths.
  if (!s || !s.startsWith("/") || s.startsWith("//")) return undefined;
  return s;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(params.next);

  return (
    <div className="grid min-h-screen grid-cols-[1fr_1fr] bg-ink-0">
      {/* instrument side */}
      <aside className="grid-bg grain relative flex flex-col justify-between overflow-hidden border-r border-line px-12 py-10">
        <div className="relative z-10 flex items-center justify-between">
          <Wordmark size="md" tag />
          <Timecode />
        </div>
        <div className="relative z-10 flex flex-col items-center">
          <DeviceIllustration width={520} />
          <div className="mt-6 grid w-[520px] grid-cols-3 gap-6 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
            <div>
              <div className="text-fg-3">Optics</div>
              <div className="mt-1 flex items-center gap-2 text-signal">
                <span className="pulse-dot size-1.5 rounded-full bg-signal" aria-hidden />
                idle
              </div>
            </div>
            <div>
              <div className="text-fg-3">Reaction window</div>
              <div className="mt-1 text-fg-2">120 s</div>
            </div>
            <div>
              <div className="text-fg-3">Mode</div>
              <div className="mt-1 text-fg-2">research</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
          Research prototype. Not a medical device. Not clinically validated.
        </div>
      </aside>

      {/* form side */}
      <main className="flex flex-col justify-between px-16 py-10">
        <div className="flex justify-end">
          <Link href="/" className="text-[13px] text-fg-3 transition-colors hover:text-fg">
            ← Back to overview
          </Link>
        </div>
        <div className="flex flex-col items-start">
          <div className="t-eyebrow mb-4 flex items-center gap-3">
            <span className="text-signal">Sign in</span>
            <span className="text-fg-4">/</span>
            <span>Analysis console</span>
          </div>
          <h1 className="t-display mb-10 text-[48px]">Operator authentication.</h1>
          <LoginForm next={next} />
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">KJS-HC-03 · K J Somaiya School of Engineering</div>
      </main>
    </div>
  );
}
