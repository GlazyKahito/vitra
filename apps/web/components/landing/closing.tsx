import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { PublicFooter } from "@/components/shell/public-shell";
import { Chapter } from "./chapter";

/** Chapter 08 — closing call + footer. */
export function Closing() {
  return (
    <Chapter index="08" label="Closing" id="closing" bleed>
      <div className="grid-bg relative px-10 pb-32 pt-28">
        <Reveal>
          <h2 className="t-display text-[112px] text-fg">Open the console.</h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-8 max-w-[48ch] text-[17px] leading-relaxed text-fg-2">
            Sign in with a demo account, upload or capture a strip image, and follow one run from pixels to a reviewed report.
          </p>
        </Reveal>
        <Reveal delay={0.2}>
          <div className="mt-10 flex items-center gap-3">
            <Button href="/console" size="lg" trailing={<ArrowRight className="size-4" />}>
              Open Analysis Console
            </Button>
            <Button href="/methodology" size="lg" variant="secondary">
              Explore the Methodology
            </Button>
          </div>
        </Reveal>
      </div>
      <PublicFooter />
    </Chapter>
  );
}
