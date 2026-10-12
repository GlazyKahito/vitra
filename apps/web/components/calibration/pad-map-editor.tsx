"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ANALYTES, ANALYTE_BY_KEY, isAnalyteKey, type AnalyteKey } from "@/lib/analytes";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { updateStripProductAction } from "@/app/actions/strips";

export interface PadMapEditorProps {
  product: {
    id: string;
    name: string;
    manufacturer: string;
    padCount: number;
    padMap: string[];
    reactionSeconds: number;
    geometry: Record<string, unknown> | null;
    notes: string | null;
  };
  canEdit: boolean;
}

const SLOTS = 10;

function normaliseMap(m: string[]): string[] {
  const out = [...m].slice(0, SLOTS);
  while (out.length < SLOTS) out.push("");
  return out;
}

function validateGeometry(text: string): { ok: true; value: Record<string, unknown> | null } | { ok: false; error: string } {
  const t = text.trim();
  if (t.length === 0) return { ok: true, value: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(t);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ok: false, error: "Geometry must be a JSON object." };
  const g = parsed as Record<string, unknown>;
  if (g.mode !== undefined && g.mode !== "auto" && g.mode !== "fixed") return { ok: false, error: '"mode" must be "auto" or "fixed".' };
  if (g.pad_centers !== undefined) {
    if (!Array.isArray(g.pad_centers) || g.pad_centers.length !== SLOTS) return { ok: false, error: `"pad_centers" must be an array of ${SLOTS} numbers.` };
    if (!g.pad_centers.every((v) => typeof v === "number" && v >= 0 && v <= 1)) return { ok: false, error: '"pad_centers" values must be numbers in 0..1.' };
  }
  for (const k of ["pad_size", "roi_inset"]) {
    const v = g[k];
    if (v !== undefined && (typeof v !== "number" || v <= 0 || v >= 1)) return { ok: false, error: `"${k}" must be a number in (0, 1).` };
  }
  return { ok: true, value: g };
}

export function PadMapEditor({ product, canEdit }: PadMapEditorProps) {
  const [padMap, setPadMap] = useState<string[]>(() => normaliseMap(product.padMap));
  const [reaction, setReaction] = useState(String(product.reactionSeconds));
  const [geometry, setGeometry] = useState(product.geometry ? JSON.stringify(product.geometry, null, 2) : "");
  const [notes, setNotes] = useState(product.notes ?? "");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const geo = useMemo(() => validateGeometry(geometry), [geometry]);
  const reactionNum = Number(reaction);
  const reactionOk = Number.isInteger(reactionNum) && reactionNum >= 30 && reactionNum <= 600;
  const duplicates = useMemo(() => {
    const seen = new Map<string, number>();
    for (const k of padMap) if (k) seen.set(k, (seen.get(k) ?? 0) + 1);
    return [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  }, [padMap]);
  const filled = padMap.filter((k) => k !== "").length;
  // The server requires exactly padCount analytes, so every slot must be mapped before saving.
  const mapOk = duplicates.length === 0 && filled === SLOTS && padMap.every((k) => isAnalyteKey(k));
  const dirty =
    padMap.join(",") !== normaliseMap(product.padMap).join(",") || reaction !== String(product.reactionSeconds) || notes !== (product.notes ?? "") || geometry !== (product.geometry ? JSON.stringify(product.geometry, null, 2) : "");

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= SLOTS) return;
    setPadMap((m) => {
      const n = [...m];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  }

  function save() {
    if (!geo.ok || !reactionOk || !mapOk) return;
    const fd = new FormData();
    fd.set("id", product.id);
    fd.set("padMap", JSON.stringify(padMap));
    fd.set("reactionSeconds", String(reactionNum));
    fd.set("geometry", geo.value ? JSON.stringify(geo.value) : "");
    fd.set("notes", notes);
    start(async () => {
      const res = await updateStripProductAction(fd);
      setMsg(res.ok ? { tone: "ok", text: "Saved. New runs on this product use the updated pad map." } : { tone: "error", text: res.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[13.5px] font-medium text-fg">{product.name}</div>
          <div className="text-[12px] text-fg-3">{product.manufacturer}</div>
        </div>
        <span className="t-mono text-[11px] text-fg-4">
          {filled}/{SLOTS} pads mapped
        </span>
      </div>

      <ol className="flex flex-col gap-1" aria-label="Pad to analyte map, left to right">
        {padMap.map((key, i) => {
          const def = isAnalyteKey(key) ? ANALYTE_BY_KEY[key] : null;
          const dup = key !== "" && duplicates.includes(key);
          return (
            <li key={i} className="flex items-center gap-2 rounded-[var(--radius-xs)] border border-line bg-ink-1 px-2 py-1.5">
              <span className="t-mono w-8 text-[11px] text-fg-4">P{String(i + 1).padStart(2, "0")}</span>
              <span className="size-3 shrink-0 rounded-[2px] border border-line" style={{ background: def ? def.demoRamp[1] : "transparent" }} aria-hidden title={def ? "demo ramp colour (synthetic, illustrative only)" : undefined} />
              <Select
                aria-label={`Pad ${i + 1} analyte`}
                value={key}
                disabled={!canEdit}
                invalid={dup}
                onChange={(e) => setPadMap((m) => m.map((v, j) => (j === i ? e.target.value : v)))}
                className="h-8 text-[12.5px]"
              >
                <option value="">— unused —</option>
                {ANALYTES.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label} ({a.short}) · {a.unit}
                  </option>
                ))}
              </Select>
              <div className="flex shrink-0 gap-0.5">
                <Button variant="ghost" size="sm" className="px-1.5" aria-label="Move up" disabled={!canEdit || i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="px-1.5" aria-label="Move down" disabled={!canEdit || i === SLOTS - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      {duplicates.length > 0 ? (
        <p className="text-[12px] text-fault" role="alert">
          Duplicate analyte on more than one pad: {duplicates.map((k) => (isAnalyteKey(k) ? ANALYTE_BY_KEY[k as AnalyteKey].label : k)).join(", ")}.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Reaction time" hint="seconds" error={reactionOk ? undefined : "30–600 s, integer"}>
          <Input mono type="number" min={30} max={600} value={reaction} disabled={!canEdit} onChange={(e) => setReaction(e.target.value)} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-fg-2">Pad count</span>
          <div className="flex h-10 items-center">
            <Chip tone="neutral">{product.padCount} pads</Chip>
          </div>
        </div>
      </div>

      <Field
        label="Fixed geometry"
        hint="JSON · optional"
        help={geo.ok ? 'Keys: mode ("auto"|"fixed"), pad_centers[10] (0..1), pad_size, roi_inset. Empty = service defaults.' : undefined}
        error={geo.ok ? undefined : geo.error}
      >
        <Textarea mono rows={6} value={geometry} disabled={!canEdit} invalid={!geo.ok} onChange={(e) => setGeometry(e.target.value)} placeholder={'{\n  "mode": "auto",\n  "pad_size": 0.62,\n  "roi_inset": 0.18\n}'} />
      </Field>

      <Field label="Notes">
        <Textarea rows={2} value={notes} disabled={!canEdit} onChange={(e) => setNotes(e.target.value)} placeholder="Insert / lot observations, handle side, known artefacts…" />
      </Field>

      <div className="flex items-center justify-between gap-3">
        <p className={msg ? (msg.tone === "ok" ? "text-[12px] text-fg-3" : "text-[12px] text-fault") : "text-[12px] text-fg-4"} aria-live="polite">
          {msg ? msg.text : !canEdit ? "Read-only: saving the pad map requires settings.manage." : filled < SLOTS ? `Map all ${SLOTS} pads to save (${SLOTS - filled} unused).` : "Pad order is left → right with the handle on the left."}
        </p>
        <Button size="sm" onClick={save} loading={pending} disabled={!canEdit || !dirty || !geo.ok || !reactionOk || !mapOk}>
          Save pad map
        </Button>
      </div>
    </div>
  );
}
