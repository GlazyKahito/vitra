"use client";

import { useEffect, useState } from "react";

/** False during SSR and the hydration render, true afterwards — keeps reduced-motion markup from mismatching the server HTML. */
export function useHydrated(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(true), []);
  return on;
}
