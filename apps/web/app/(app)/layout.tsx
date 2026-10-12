import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { isEphemeralDemo } from "@/lib/runtime-mode";
import { EphemeralDemoProvider } from "@/components/shell/demo-mode";
import { WorkspaceChrome } from "@/components/shell/workspace-chrome";

/**
 * Authenticated app segment. Guards the session and renders the persistent
 * workspace chrome (rail, top bar, quick-jump, honesty footer) once, so it
 * survives navigation. Each page wraps its own content in <AppShell> to set
 * the eyebrow / serif title / actions.
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
  return (
    <EphemeralDemoProvider value={isEphemeralDemo()}>
      <WorkspaceChrome user={{ displayName: user.displayName, roleKey: user.roleKey }} onLogout={logoutAction}>
        {children}
      </WorkspaceChrome>
    </EphemeralDemoProvider>
  );
}
