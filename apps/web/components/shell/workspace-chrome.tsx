"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ChevronRight, LogOut, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Timecode } from "@/components/motion/timecode";
import { Wordmark } from "./wordmark";
import { EphemeralDemoNotice } from "./demo-mode";
import { CommandPalette } from "./command-palette";
import { APP_NAV, FOOTER_LINE, crumbsFor, isNavActive } from "./workspace-nav";

export interface WorkspaceUser {
  displayName: string;
  roleKey: string;
}

export interface WorkspaceChromeProps {
  user: WorkspaceUser;
  /** Server action invoked by the sign-out form. */
  onLogout: () => Promise<void>;
  children: ReactNode;
}

/* ── page-title bridge: pages report their title so the top bar can show it as the last crumb ── */
interface CrumbState {
  path: string;
  title: string;
}
const CrumbContext = createContext<((c: CrumbState) => void) | null>(null);

/** Rendered by <AppShell>; pushes the page title into the top-bar breadcrumb. */
export function PageCrumb({ title }: { title?: string }) {
  const set = useContext(CrumbContext);
  const pathname = usePathname() ?? "/";
  useEffect(() => {
    if (set && title) set({ path: pathname, title });
  }, [set, title, pathname]);
  return null;
}

const PaletteContext = createContext<(() => void) | null>(null);

/** Opens the quick-jump palette (for buttons outside the chrome). */
export function useOpenQuickJump(): () => void {
  return useContext(PaletteContext) ?? (() => {});
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter((s) => /[A-Za-z0-9]/.test(s[0] ?? ""))
      .map((s) => s[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "··"
  );
}

/**
 * Persistent signed-in chrome: left rail, top bar, honesty footer, quick-jump.
 * Lives in the (app) layout so it survives navigation (the rail indicator
 * slides between items instead of re-mounting with every page).
 */
export function WorkspaceChrome({ user, onLogout, children }: WorkspaceChromeProps) {
  const pathname = usePathname() ?? "/";
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [crumb, setCrumb] = useState<CrumbState | null>(null);
  const [modKey, setModKey] = useState("Ctrl");

  useEffect(() => {
    if (/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)) setModKey("⌘");
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const crumbs = useMemo(() => crumbsFor(pathname, crumb && crumb.path === pathname ? crumb.title : undefined), [pathname, crumb]);
  const initials = initialsOf(user.displayName);

  return (
    <CrumbContext.Provider value={setCrumb}>
      <PaletteContext.Provider value={openPalette}>
        <div className="ws-root relative flex min-h-screen text-fg">
          <div className="ws-atmosphere" aria-hidden />
          <a href="#ws-main" className="ws-skip">
            Skip to content
          </a>

          {/* ── Left rail ── */}
          <aside className="ws-rail sticky top-0 z-30 flex h-screen w-[248px] shrink-0 flex-col">
            <div className="flex h-14 items-center justify-between px-5">
              <Wordmark size="sm" tag href="/console" />
            </div>
            <div className="ws-rail-rule mx-5" aria-hidden />

            <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-5" aria-label="Primary">
              {APP_NAV.map((group) => (
                <div key={group.label} className="mb-6 last:mb-0">
                  <div className="ws-rail-group mb-2 flex items-center gap-2 px-3">
                    <span>{group.label}</span>
                    <span className="h-px flex-1 bg-[rgba(255,255,255,0.05)]" aria-hidden />
                  </div>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map((item) => {
                      const active = isNavActive(pathname, item.href);
                      const Icon = item.icon;
                      return (
                        <li key={item.href} className="relative">
                          <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("ws-nav-link group relative flex h-9 items-center gap-3 rounded-[7px] px-3 text-[13px]", active && "is-active")}>
                            {active ? (
                              <motion.span layoutId="ws-rail-active" className="ws-nav-indicator absolute inset-0 rounded-[7px]" transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.8 }} aria-hidden>
                                <span className="ws-nav-bar" />
                              </motion.span>
                            ) : null}
                            <Icon className="ws-nav-icon relative size-[15px] shrink-0" aria-hidden />
                            <span className="relative">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="px-3 pb-3">
              <button type="button" onClick={openPalette} className="ws-jump group flex h-10 w-full items-center gap-2.5 rounded-[8px] px-3 text-left text-[12.5px]" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K">
                <Search className="size-3.5 text-fg-4 transition-colors group-hover:text-[var(--lux-gold)]" aria-hidden />
                <span className="flex-1 text-fg-3 group-hover:text-fg-2">Quick jump</span>
                <span className="flex items-center gap-1">
                  <kbd className="ws-kbd" suppressHydrationWarning>
                    {modKey}
                  </kbd>
                  <kbd className="ws-kbd">K</kbd>
                </span>
              </button>
              <div className="mt-3 flex items-center gap-2 px-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-fg-4">
                <span className="size-1 rounded-full bg-[var(--lux-gold)] opacity-70" aria-hidden />
                KJS-HC-03
              </div>
            </div>
          </aside>

          {/* ── Main column ── */}
          <div className="relative z-[1] flex min-w-0 flex-1 flex-col">
            <header className="ws-topbar sticky top-0 z-40 flex h-14 items-center justify-between gap-6 px-8">
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em]">
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <span key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
                      {i > 0 ? <ChevronRight className="size-3 shrink-0 text-fg-4" aria-hidden /> : null}
                      {last ? (
                        <span aria-current="page" className="truncate text-[var(--lux-champagne)]">
                          {c.label}
                        </span>
                      ) : c.href ? (
                        <Link href={c.href} className="truncate text-fg-3 transition-colors hover:text-fg">
                          {c.label}
                        </Link>
                      ) : (
                        <span className="truncate text-fg-4">{c.label}</span>
                      )}
                    </span>
                  );
                })}
              </nav>

              <div className="flex shrink-0 items-center gap-4">
                <button type="button" onClick={openPalette} className="ws-search flex h-8 w-[220px] items-center gap-2 rounded-[7px] px-2.5 text-left" aria-haspopup="dialog" aria-label="Quick jump to a screen">
                  <Search className="size-3.5 text-fg-4" aria-hidden />
                  <span className="flex-1 text-[12.5px] text-fg-4">Jump to…</span>
                  <kbd className="ws-kbd" suppressHydrationWarning>
                    {modKey} K
                  </kbd>
                </button>
                <EphemeralDemoNotice />
                <span className="ws-proto-tag hidden items-center gap-1.5 xl:inline-flex">
                  <span className="size-1.5 rounded-full bg-notice" aria-hidden />
                  Research prototype
                </span>
                <Timecode className="font-mono text-[11px] text-fg-3" />
                <div className="ws-user flex items-center gap-2.5 pl-4">
                  <div className="ws-avatar flex size-7 items-center justify-center rounded-full font-mono text-[10px]">{initials}</div>
                  <div className="leading-tight">
                    <div className="max-w-[140px] truncate text-[12.5px] text-fg">{user.displayName}</div>
                    <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--lux-gold)]">{user.roleKey}</div>
                  </div>
                  <form action={onLogout}>
                    <button type="submit" aria-label="Sign out" title="Sign out" className="ml-1 rounded-[6px] p-1.5 text-fg-4 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-fg">
                      <LogOut className="size-3.5" />
                    </button>
                  </form>
                </div>
              </div>
            </header>

            <main id="ws-main" className="flex-1 px-8 pb-12 pt-8">
              {children}
            </main>

            <footer className="ws-footer flex h-10 items-center justify-between px-8 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
              <span className="flex items-center gap-2">
                <span className="size-1 rounded-full bg-notice" aria-hidden />
                {FOOTER_LINE}
              </span>
              <span>KJS-HC-03 · VITRA</span>
            </footer>
          </div>

          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </div>
      </PaletteContext.Provider>
    </CrumbContext.Provider>
  );
}
