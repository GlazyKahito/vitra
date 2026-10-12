"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { updateSettingsAction } from "@/app/actions/settings";
import type { AppSettingsShape } from "@/lib/data/contract";

export interface SettingsFormProps {
  settings: AppSettingsShape;
  products: { id: string; name: string }[];
  canEdit: boolean;
}

function Toggle({ name, label, help, checked, onChange, disabled }: { name: string; label: string; help: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-line bg-ink-1 px-4 py-3">
      <input type="checkbox" name={name} className="mt-1 accent-[var(--color-signal)]" checked={checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
      <span className="text-[13px] leading-relaxed text-fg-2">
        <span className="font-medium text-fg">{label}</span>
        <span className="block text-[12px] text-fg-3">{help}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ settings, products, canEdit }: SettingsFormProps) {
  const router = useRouter();
  const [s, setS] = useState<AppSettingsShape>(settings);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const reactionOk = Number.isInteger(s.defaultReactionSeconds) && s.defaultReactionSeconds >= 30 && s.defaultReactionSeconds <= 600;
  const recalOk = Number.isInteger(s.recalibrationIntervalDays) && s.recalibrationIntervalDays >= 1 && s.recalibrationIntervalDays <= 730;
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);

  function save() {
    if (!canEdit || !reactionOk || !recalOk) return;
    const fd = new FormData();
    fd.set("defaultStripProductId", s.defaultStripProductId);
    fd.set("defaultReactionSeconds", String(s.defaultReactionSeconds));
    fd.set("recalibrationIntervalDays", String(s.recalibrationIntervalDays));
    fd.set("demoModeEnabled", s.demoModeEnabled ? "true" : "false");
    fd.set("requireReviewForReports", s.requireReviewForReports ? "true" : "false");
    start(async () => {
      const res = await updateSettingsAction(fd);
      if (res.ok) {
        setMsg({ tone: "ok", text: "Settings saved and audited." });
        router.refresh();
      } else setMsg({ tone: "error", text: res.error });
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Default strip product" help="Used by device ingest when strip_product_id is omitted.">
          <Select value={s.defaultStripProductId} disabled={!canEdit} onChange={(e) => setS({ ...s, defaultStripProductId: e.target.value })}>
            {products.length === 0 ? <option value={s.defaultStripProductId}>{s.defaultStripProductId || "none"}</option> : null}
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Default reaction time" hint="seconds" error={reactionOk ? undefined : "30–600"} help="KJS-HC-03 workflow default: 120 s.">
          <Input mono type="number" min={30} max={600} value={s.defaultReactionSeconds} disabled={!canEdit} onChange={(e) => setS({ ...s, defaultReactionSeconds: Number(e.target.value) })} />
        </Field>
        <Field label="Recalibration interval" hint="days" error={recalOk ? undefined : "1–730"} help="Models older than this are flagged “recalibration due”.">
          <Input mono type="number" min={1} max={730} value={s.recalibrationIntervalDays} disabled={!canEdit} onChange={(e) => setS({ ...s, recalibrationIntervalDays: Number(e.target.value) })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Toggle name="demoModeEnabled" label="Demo mode enabled" help="Allows demo-mode runs, which may surface Synthetic demo values from synthetic-trained models. Research mode is unaffected." checked={s.demoModeEnabled} disabled={!canEdit} onChange={(v) => setS({ ...s, demoModeEnabled: v })} />
        <Toggle name="requireReviewForReports" label="Require clinical review before reports" help="Report generation is refused for runs without a recorded review decision." checked={s.requireReviewForReports} disabled={!canEdit} onChange={(v) => setS({ ...s, requireReviewForReports: v })} />
      </div>
      <div className="flex items-center justify-between">
        <p className={msg ? (msg.tone === "ok" ? "text-[12px] text-fg-3" : "text-[12px] text-fault") : "text-[12px] text-fg-4"} aria-live="polite">
          {msg ? msg.text : canEdit ? "Changes are written to the audit trail." : "Read-only: requires settings.manage."}
        </p>
        <Button size="sm" onClick={save} loading={pending} disabled={!canEdit || !dirty || !reactionOk || !recalOk}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
