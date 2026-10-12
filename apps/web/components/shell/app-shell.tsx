"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  BookOpen,
  ClipboardCheck,
  Cpu,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  LogOut,
  PlusSquare,
  Settings,
  SlidersHorizontal,
  TestTubes,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Timecode } from "@/components/motion/timecode";
import { Wordmark } from "./wordmark";

export interface AppShellUser {
  displayName: string;
  roleKey: string;
}

export interface AppShellProps {
  user: AppShellUser;
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Server action; invoked by the sign-out form. */
  onLogout: () => Promise<void>;
}

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Console", href: "/console", icon: LayoutDashboard },
      { label: "New analysis", href: "/analysis/new", icon: PlusSquare },
      { label: "History", href: "/history", icon: History },
      { label: "Samples", href: "/samples", icon: TestTubes },
      { label: "Review queue", href: "/review", icon: ClipboardCheck },
      { label: "Reports", href: "/reports", icon: FileText },
    ],
  },
  {
    label: "Engineering",
    items: [
      { label: "Calibration", href: "/calibration", icon: SlidersHorizontal },
      { label: "Model lab", href: "/model-lab", icon: FlaskConical },
      { label: "Devices", href: "/devices", icon: Cpu },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Methodology", href: "/methodology", icon: BookOpen },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export const FOOTER_LINE = "Research prototype. Not a medical device. Not clinically validated.";

function isActive(pathname: string, href: string): boolean {
  if (href === "/console") return pathname === "/console";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({ user, title, eyebrow, actions, children, onLogout }: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const initials = user.displayName
    .split(/\s+/)
    .map((s) => s[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen bg-ink-0 text-fg">
      {/* Left rail */}
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-line bg-ink-1">
        <div className="flex h-14 items-center border-b border-line px-5">
          <Wordmark size="sm" tag />
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
          {APP_NAV.map((group) => (
            <div key={group.label} className="mb-5">
              <div className="t-eyebrow mb-1.5 px-2 text-[10px]">{group.label}</div>
              <ul className="flex flex-col gap-px">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-8 items-center gap-2.5 rounded-[var(--radius-xs)] px-2 text-[13px] transition-colors duration-150",
                          active ? "bg-[rgba(255,255,255,0.05)] text-fg" : "text-fg-3 hover:bg-[rgba(255,255,255,0.03)] hover:text-fg-2",
                        )}
                      >
                        {active ? <span className="absolute -left-3 top-1/2 h-4 w-px -translate-y-1/2 bg-signal" aria-hidden /> : null}
                        <Icon className={cn("size-[15px]", active ? "text-signal" : "text-fg-4 group-hover:text-fg-3")} aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2">
            <div className="flex size-7 items-center justify-center rounded-full border border-line-strong bg-ink-3 font-mono text-[10px] text-fg-2">{initials}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] text-fg">{user.displayName}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">{user.roleKey}</div>
            </div>
            <form action={onLogout}>
              <button type="submit" aria-label="Sign out" title="Sign out" className="rounded p-1.5 text-fg-4 transition-colors hover:bg-[rgba(255,255,255,0.05)] hover:text-fg">
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-line bg-[rgba(6,6,7,0.85)] px-8 backdrop-blur-sm">
          <div className="flex min-w-0 items-baseline gap-3">
            {eyebrow ? <span className="t-eyebrow">{eyebrow}</span> : null}
            <h1 className="truncate text-[15px] font-medium tracking-[-0.01em]">{title}</h1>
          </div>
          <div className="flex items-center gap-5">
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
            <span className="hidden items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4 xl:inline-flex">
              <Activity className="size-3 text-notice" aria-hidden />
              Research prototype · not a medical device
            </span>
            <Timecode />
          </div>
        </header>
        <main className="flex-1 px-8 py-7">{children}</main>
        <footer className="flex h-10 items-center justify-between border-t border-line px-8 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">
          <span>{FOOTER_LINE}</span>
          <span>KJS-HC-03 · VITRA</span>
        </footer>
      </div>
    </div>
  );
}
