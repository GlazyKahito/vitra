import {
  BookOpen,
  ClipboardCheck,
  Cpu,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  PlusSquare,
  Settings,
  SlidersHorizontal,
  TestTubes,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** One-line purpose, shown in the quick-jump palette. */
  hint: string;
  /** Extra words the palette filter should match. */
  keywords?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const APP_NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { label: "Console", href: "/console", icon: LayoutDashboard, hint: "Throughput, run status and recent activity", keywords: "dashboard home overview" },
      { label: "New analysis", href: "/analysis/new", icon: PlusSquare, hint: "Register a sample, time the reaction, capture the strip", keywords: "capture upload run start" },
      { label: "History", href: "/history", icon: History, hint: "Every analysis run, filterable, with CSV export", keywords: "runs list export csv" },
      { label: "Samples", href: "/samples", icon: TestTubes, hint: "Sample registry and per-analyte trends", keywords: "registry subjects" },
      { label: "Review queue", href: "/review", icon: ClipboardCheck, hint: "Clinician decisions on finished runs", keywords: "review clinician accept reject" },
      { label: "Reports", href: "/reports", icon: FileText, hint: "Generated PDF and JSON reports", keywords: "pdf json export" },
    ],
  },
  {
    label: "Engineering",
    items: [
      { label: "Calibration", href: "/calibration", icon: SlidersHorizontal, hint: "Datasets, pad maps and per-analyte status", keywords: "datasets pad map train" },
      { label: "Model lab", href: "/model-lab", icon: FlaskConical, hint: "Calibration models, metrics and comparison", keywords: "models regression metrics" },
      { label: "Devices", href: "/devices", icon: Cpu, hint: "Reader devices, events and the ingest API", keywords: "raspberry pi reader fleet api" },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "Methodology", href: "/methodology", icon: BookOpen, hint: "How the pipeline works and what it cannot do", keywords: "docs method pipeline limits" },
      { label: "Settings", href: "/settings", icon: Settings, hint: "Workflow defaults, roles, accounts, CV health", keywords: "users roles permissions" },
    ],
  },
];

export const FOOTER_LINE = "Research prototype. Not a medical device. Not clinically validated.";

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/console") return pathname === "/console";
  if (href === "/history") return pathname === "/history" || (pathname.startsWith("/analysis/") && pathname !== "/analysis/new");
  return pathname === href || pathname.startsWith(href + "/");
}

export interface Crumb {
  label: string;
  href?: string;
}

/** Group › section › (detail) for the top bar. The detail label comes from the page title. */
export function crumbsFor(pathname: string, detail?: string): Crumb[] {
  for (const group of APP_NAV) {
    for (const item of group.items) {
      if (!isNavActive(pathname, item.href)) continue;
      const crumbs: Crumb[] = [{ label: group.label }, { label: item.label, href: item.href }];
      const exact = pathname === item.href;
      if (!exact && detail) crumbs.push({ label: detail });
      return crumbs;
    }
  }
  return [{ label: "Workspace" }, ...(detail ? [{ label: detail }] : [])];
}
