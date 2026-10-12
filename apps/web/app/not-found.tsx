import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";

export default function NotFound() {
  return (
    <div className="grid-bg flex min-h-screen flex-col items-center justify-center bg-ink-0 px-10">
      <div className="mb-10">
        <Wordmark size="md" />
      </div>
      <div className="t-eyebrow mb-4 flex items-center gap-3">
        <span className="text-notice">404</span>
        <span className="text-fg-4">/</span>
        <span>No route at this address</span>
      </div>
      <h1 className="t-display text-center text-[64px]">Nothing on this frame.</h1>
      <p className="mt-6 max-w-[44ch] text-center text-[15px] leading-relaxed text-fg-3">
        The page you asked for does not exist or has moved. Runs, samples and reports live inside the console.
      </p>
      <div className="mt-8 flex gap-3">
        <Button href="/console">Open console</Button>
        <Button href="/" variant="secondary">
          Back to overview
        </Button>
      </div>
      <Link href="/methodology" className="mt-10 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4 hover:text-fg-2">
        Methodology
      </Link>
    </div>
  );
}
