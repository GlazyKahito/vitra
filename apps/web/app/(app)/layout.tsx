import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";

/**
 * Authenticated app segment. Every page below wraps itself in <AppShell> so it
 * can set its own title/eyebrow/actions; this layout only guards the session.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    let next = "/console";
    try {
      const h = await headers();
      const p = h.get("x-vitra-path") ?? h.get("x-invoke-path") ?? h.get("next-url");
      if (p && p.startsWith("/") && !p.startsWith("//")) next = p;
    } catch {
      /* no request scope */
    }
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  return <>{children}</>;
}
