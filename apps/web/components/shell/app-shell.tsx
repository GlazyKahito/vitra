import type { ReactNode } from "react";
import { PageCrumb } from "./workspace-chrome";

export { APP_NAV, FOOTER_LINE } from "./workspace-nav";

export interface AppShellUser {
  displayName: string;
  roleKey: string;
}

export interface AppShellProps {
  /** Kept for the page contract; the persistent chrome in the (app) layout renders the user chip. */
  user: AppShellUser;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Kept for the page contract; sign-out lives in the persistent chrome. */
  onLogout: () => Promise<void>;
}

/** "01 / Console" → index "01" + label "Console". */
function splitEyebrow(eyebrow: string): { index: string | null; label: string } {
  const m = /^\s*(\d{1,3})\s*\/\s*(.+)$/.exec(eyebrow);
  return m ? { index: m[1], label: m[2] } : { index: null, label: eyebrow };
}

/**
 * Page frame inside the signed-in workspace: mono eyebrow, serif title,
 * actions, then the page body. The rail / top bar / footer are rendered once
 * by <WorkspaceChrome> in app/(app)/layout.tsx.
 */
export function AppShell({ title, eyebrow, actions, children }: AppShellProps) {
  const eb = eyebrow ? splitEyebrow(eyebrow) : null;
  return (
    <div className="ws-page">
      <PageCrumb title={title} />
      <header className="ws-pagehead mb-7 flex items-end justify-between gap-10 pb-6">
        <div className="min-w-0">
          {eb ? (
            <div className="ws-eyebrow ws-in flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.2em]">
              {eb.index ? (
                <>
                  <span className="tabular-nums text-[var(--lux-gold)]">{eb.index}</span>
                  <span className="h-px w-7 bg-[rgba(201,169,110,0.45)]" aria-hidden />
                </>
              ) : null}
              <span className="text-fg-3">{eb.label}</span>
            </div>
          ) : null}
          <h1 className="ws-title ws-in t-serif mt-3 truncate text-[46px]">{title}</h1>
        </div>
        {actions ? <div className="ws-in ws-actions flex shrink-0 items-center gap-2 pb-1">{actions}</div> : null}
      </header>
      <div className="ws-page-body">{children}</div>
    </div>
  );
}
