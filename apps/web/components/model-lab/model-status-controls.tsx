"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/field";
import { setModelStatusAction } from "@/app/actions/calibration";

export interface ModelStatusControlsProps {
  modelId: string;
  status: string;
  trainedOnSynthetic: boolean;
  canManage: boolean;
  canValidate: boolean;
}

export function ModelStatusControls({ modelId, status, trainedOnSynthetic, canManage, canValidate }: ModelStatusControlsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function apply(next: "retired" | "validated" | "trained", ev: string) {
    const fd = new FormData();
    fd.set("modelId", modelId);
    fd.set("status", next);
    fd.set("evidence", ev);
    setError(null);
    start(async () => {
      const res = await setModelStatusAction(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setEvidence("");
      router.refresh();
    });
  }

  const validateBlocked = trainedOnSynthetic ? "synthetic-trained models cannot be validated" : !canValidate ? "requires admin (models.validate)" : status === "retired" ? "retired" : status === "validated" ? "already validated" : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "retired" ? (
          <Button variant="secondary" size="sm" disabled={!canManage} loading={pending} onClick={() => apply("retired", "")}>
            Mark retired
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={!canManage} loading={pending} onClick={() => apply("trained", "")}>
            Restore to trained
          </Button>
        )}
        <Button size="sm" disabled={validateBlocked !== null} onClick={() => setOpen(true)} title={validateBlocked ?? undefined}>
          Mark validated…
        </Button>
        {validateBlocked ? <span className="t-mono text-[11px] text-fg-4">{validateBlocked}</span> : null}
        {!canManage ? <span className="t-mono text-[11px] text-fg-4">retire requires calibration.manage</span> : null}
      </div>
      {error ? (
        <p className="text-[12px] text-fault" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Model validation"
        title="Mark this model validated"
        description="Validation unlocks the “Measured” result state for this analyte on this strip product. It is an administrator's attestation and is written to the audit trail."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={pending} disabled={evidence.trim().length < 40} onClick={() => apply("validated", evidence.trim())}>
              Validate with evidence
            </Button>
          </>
        }
      >
        <Field label="Evidence" required hint={`${evidence.trim().length} chars · min 40`} help="Describe the method-comparison study: laboratory analyser, number of samples and batches, bias and limits of agreement, date, who signed off. Vague text will be rejected on review.">
          <Textarea rows={7} value={evidence} onChange={(e) => setEvidence(e.target.value)} data-autofocus placeholder="e.g. 120 paired samples across lots 2026-03/04, Roche Cobas u 411 reference, bias +2.1 mg/dL, LoA −18…+22 mg/dL, reviewed by … on 2026-…" />
        </Field>
      </Dialog>
    </div>
  );
}
