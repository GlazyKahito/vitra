import type { RunListFilter } from "@/lib/data/contract";

export type SearchParams = Record<string, string | string[] | undefined>;

const STATUSES = new Set(["queued", "processing", "invalid_image", "calibration_required", "pending_review", "reviewed", "rejected", "failed"]);

function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Translates URL search params (from RunFilters) into a RunListFilter. */
export function parseRunFilter(sp: SearchParams, defaults: { limit: number }): RunListFilter & { page: number } {
  const status = one(sp.status);
  const mode = one(sp.mode);
  const synthetic = one(sp.synthetic);
  const page = Math.max(1, Number.parseInt(one(sp.page) ?? "1", 10) || 1);
  const q = one(sp.q)?.trim();
  const from = one(sp.from);
  const to = one(sp.to);
  const strip = one(sp.strip);
  return {
    q: q || undefined,
    status: status && STATUSES.has(status) ? (status as RunListFilter["status"]) : "all",
    mode: mode === "research" || mode === "demo" ? mode : "all",
    synthetic: synthetic === "only" || synthetic === "exclude" ? synthetic : "all",
    stripProductId: strip && strip !== "all" ? strip : undefined,
    from: from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined,
    to: to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined,
    limit: defaults.limit,
    offset: (page - 1) * defaults.limit,
    page,
  };
}
