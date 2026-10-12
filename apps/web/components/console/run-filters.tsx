"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const RUN_STATUS_OPTIONS = ["all", "queued", "processing", "invalid_image", "calibration_required", "pending_review", "reviewed", "rejected", "failed"] as const;

export interface RunFiltersProps {
  /** Extra filters shown on the history page. */
  extended?: boolean;
  stripProducts?: { id: string; name: string }[];
  className?: string;
}

/**
 * URL-search-param driven filter bar (q, status, mode, synthetic, and for the
 * extended variant: strip, from, to). The server component re-reads the params.
 */
export function RunFilters({ extended = false, stripProducts = [], className }: RunFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function apply(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => {
      router.replace(`${pathname}${next.size ? `?${next.toString()}` : ""}`, { scroll: false });
    });
  }

  const hasFilters = ["q", "status", "mode", "synthetic", "strip", "from", "to"].some((k) => params.get(k));

  return (
    <form
      className={cn("flex flex-wrap items-end gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
      aria-busy={pending}
    >
      <div className="w-64">
        <Input mono placeholder="Run, sample or subject…" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => q !== (params.get("q") ?? "") && apply({ q })} aria-label="Search runs" className="h-9" />
      </div>
      <Select aria-label="Status" value={params.get("status") ?? "all"} onChange={(e) => apply({ status: e.target.value })} className="h-9 w-44">
        {RUN_STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? "All statuses" : s.replace("_", " ")}
          </option>
        ))}
      </Select>
      <Select aria-label="Mode" value={params.get("mode") ?? "all"} onChange={(e) => apply({ mode: e.target.value })} className="h-9 w-36">
        <option value="all">All modes</option>
        <option value="research">research</option>
        <option value="demo">demo</option>
      </Select>
      <Select aria-label="Synthetic" value={params.get("synthetic") ?? "all"} onChange={(e) => apply({ synthetic: e.target.value })} className="h-9 w-40">
        <option value="all">Real + synthetic</option>
        <option value="exclude">Exclude synthetic</option>
        <option value="only">Synthetic only</option>
      </Select>
      {extended ? (
        <>
          <Select aria-label="Strip product" value={params.get("strip") ?? "all"} onChange={(e) => apply({ strip: e.target.value })} className="h-9 w-52">
            <option value="all">All strip products</option>
            {stripProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input type="date" mono aria-label="From" value={params.get("from") ?? ""} onChange={(e) => apply({ from: e.target.value })} className="h-9 w-40" />
          <Input type="date" mono aria-label="To" value={params.get("to") ?? ""} onChange={(e) => apply({ to: e.target.value })} className="h-9 w-40" />
        </>
      ) : null}
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Apply
      </Button>
      {hasFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => apply({ q: null, status: null, mode: null, synthetic: null, strip: null, from: null, to: null })}>
          Clear
        </Button>
      ) : null}
    </form>
  );
}
