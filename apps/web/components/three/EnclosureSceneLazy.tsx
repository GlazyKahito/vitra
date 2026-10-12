"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import { EnclosureFallback } from "./EnclosureScene";
import type { EnclosureSceneProps } from "./EnclosureScene";

const Scene = dynamic(() => import("./EnclosureScene").then((m) => m.EnclosureScene), {
  ssr: false,
  loading: () => <EnclosureFallback />,
});

/**
 * Client-only wrapper around the R3F scene. Under reduced motion the WebGL
 * canvas is not mounted at all — the static SVG illustration is used instead.
 */
export function EnclosureSceneLazy(props: EnclosureSceneProps) {
  const reduced = useReducedMotion();
  if (reduced) return <EnclosureFallback height={props.height} />;
  return <Scene {...props} />;
}

export default EnclosureSceneLazy;
