import type { Metadata } from "next";
import { Closing, Honesty, ImageToData, Instrument, Pipeline, Problem, WorkspacePreview } from "@/components/landing";
import { AfterIntro } from "@/components/stage/after-intro";
import { FilmIntro } from "@/components/stage/film-intro";
import { GlassDock } from "@/components/stage/glass-dock";
import { SilkWaves } from "@/components/stage/silk-waves";
import { StageProvider } from "@/components/stage/smooth-scroll";
import { LabOverview, ModuleShowcase } from "@/components/stage/lab";
import { BuildStack, Governance, WhyHard } from "@/components/stage/usecase";
import VitraSpecimen from "@/components/stage/vitra-specimen";

export const metadata: Metadata = {
  title: "VITRA — Reagent colour to measurable data",
};

/**
 * Landing. An LED warm-up opens onto the homescreen (the ten pads as orbs in a
 * glass RGB cube, six scroll-scrubbed frames), then the chapters run over the
 * live emerald background: problem → why a phone can't → instrument →
 * pipeline → image to data → workspace → modules → the lab right now → governance → disciplines → honesty →
 * closing. Desktop-only (≥1280px); every animation honours reduced motion.
 */
export default function LandingPage() {
  return (
    <StageProvider>
      <FilmIntro />
      <SilkWaves />
      <GlassDock />
      <main className="relative z-10">
        <VitraSpecimen />
        <AfterIntro>
          <Problem />
          <WhyHard index="03" />
          <Instrument />
          <Pipeline />
          <ImageToData />
          <WorkspacePreview />
          <ModuleShowcase index="08" />
          <LabOverview index="09" />
          <Governance index="10" />
          <BuildStack index="11" />
          <Honesty />
          <Closing />
        </AfterIntro>
      </main>
    </StageProvider>
  );
}
