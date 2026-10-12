"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/shell/wordmark";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface to the console; there is no telemetry in the prototype.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-0 px-10">
      <div className="mb-10">
        <Wordmark size="md" />
      </div>
      <div className="t-eyebrow mb-4 flex items-center gap-3">
        <span className="text-fault">Fault</span>
        <span className="text-fg-4">/</span>
        <span>Unhandled application error</span>
      </div>
      <h1 className="t-display text-center text-[56px]">Something failed while rendering.</h1>
      <p className="mt-6 max-w-[48ch] text-center text-[15px] leading-relaxed text-fg-3">
        The error has been logged to the browser console. Retrying re-renders this route without reloading the page.
      </p>
      {error.digest ? <p className="mt-3 font-mono text-[11px] text-fg-4">digest {error.digest}</p> : null}
      <div className="mt-8 flex gap-3">
        <Button onClick={reset}>Retry</Button>
        <Button href="/console" variant="secondary">
          Open console
        </Button>
      </div>
    </div>
  );
}
