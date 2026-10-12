import type { Metadata } from "next";
import { ScrollProgress } from "@/components/motion/scroll-progress";
import { Closing, Hero, Honesty, ImageToData, Instrument, IntroBar, Pipeline, Problem, WorkspacePreview } from "@/components/landing";

export const metadata: Metadata = {
  title: "VITRA — Reagent colour to measurable data",
};

/**
 * Landing page — a cinematic, chaptered walk from the problem to the console.
 * Desktop-only (≥1280px). Every animation is guarded by prefers-reduced-motion.
 */
export default function LandingPage() {
  return (
    <>
      <IntroBar />
      <ScrollProgress />
      <Hero />
      <Problem />
      <Instrument />
      <Pipeline />
      <ImageToData />
      <WorkspacePreview />
      <Honesty />
      <Closing />
    </>
  );
}
