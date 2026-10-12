"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { startAnalysisAction } from "@/app/actions/analysis";
import { ANALYTE_BY_KEY, DEFAULT_REACTION_SECONDS, isAnalyteKey } from "@/lib/analytes";
import { cn } from "@/lib/utils";
import { ImageAcquisition, bakeRotation, type AcquiredImage } from "./image-acquisition";
import { ReactionTimer, clearTimerState, loadTimerState, type ReactionTimerState } from "./reaction-timer";

export interface WizardSample {
  id: string;
  sampleCode: string;
  subjectPseudonym: string | null;
  synthetic: boolean;
  runCount: number;
}
export interface WizardStripProduct {
  id: string;
  name: string;
  manufacturer: string;
  padMap: string[];
  reactionSeconds: number;
  batches: { id: string; lotNumber: string; expiresOn: string | null }[];
}
export interface NewAnalysisWizardProps {
  operatorLabel: string;
  samples: WizardSample[];
  stripProducts: WizardStripProduct[];
  suggestedSampleCode: string;
  defaultStripProductId: string | null;
  demoModeEnabled: boolean;
}

type Mode = "research" | "demo";
type SampleChoice = "existing" | "new";
type Step = "sample" | "timer" | "image" | "submit";

const STEPS: { key: Step; n: string; label: string }[] = [
  { key: "sample", n: "A", label: "Sample registration" },
  { key: "timer", n: "B", label: "Reaction timer" },
  { key: "image", n: "C", label: "Image acquisition" },
  { key: "submit", n: "D", label: "Submit" },
];

function newDraftId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * End-to-end analysis workflow on one screen. State lives here; the timer is
 * persisted per draft id so a refresh resumes mid-reaction.
 */
export function NewAnalysisWizard({ operatorLabel, samples, stripProducts, suggestedSampleCode, defaultStripProductId, demoModeEnabled }: NewAnalysisWizardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("sample");
  const [error, setError] = useState<string | null>(null);

  // A. sample
  const [sampleChoice, setSampleChoice] = useState<SampleChoice>(samples.length > 0 ? "existing" : "new");
  const [sampleId, setSampleId] = useState<string>(samples[0]?.id ?? "");
  const [newCode, setNewCode] = useState(suggestedSampleCode);
  const [newSubject, setNewSubject] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newSynthetic, setNewSynthetic] = useState(false);
  const [stripProductId, setStripProductId] = useState<string>(defaultStripProductId ?? stripProducts[0]?.id ?? "");
  const product = useMemo(() => stripProducts.find((p) => p.id === stripProductId) ?? null, [stripProducts, stripProductId]);
  const [stripBatchId, setStripBatchId] = useState<string>("");
  const [operator, setOperator] = useState(operatorLabel);
  const [mode, setMode] = useState<Mode>("research");

  // B. timer (persisted)
  // The draft id comes from sessionStorage, so it is only known in the browser: render a
  // placeholder on the server and the first client pass, then fill it in (no hydration mismatch).
  const [draftId, setDraftId] = useState<string>("pending");
  useEffect(() => {
    try {
      const existing = window.sessionStorage.getItem("vitra.draft");
      if (existing) return setDraftId(existing);
      const id = newDraftId();
      window.sessionStorage.setItem("vitra.draft", id);
      setDraftId(id);
    } catch {
      setDraftId(newDraftId());
    }
  }, []);
  const reactionDefault = product?.reactionSeconds ?? DEFAULT_REACTION_SECONDS;
  const [timer, setTimer] = useState<ReactionTimerState>(() => ({ seconds: reactionDefault, startedAt: null, completed: false, untimed: false }));
  useEffect(() => {
    if (draftId === "pending") return;
    setTimer(loadTimerState(draftId, reactionDefault));
  }, [draftId, reactionDefault]);
  const onTimerChange = useCallback((t: ReactionTimerState) => setTimer(t), []);

  // C. image
  const [image, setImage] = useState<AcquiredImage | null>(null);

  const sampleValid = sampleChoice === "existing" ? sampleId !== "" : newCode.trim().length >= 3;
  const productValid = product !== null;
  const timerValid = timer.untimed || timer.completed;
  const imageValid = image !== null;
  const canSubmit = sampleValid && productValid && timerValid && imageValid && !pending;
  const captureBlocked = !timerValid ? (timer.startedAt ? "Capture is enabled once the reaction timer completes." : "Start the reaction timer (or acknowledge an untimed capture) before acquiring the image.") : null;

  const stepDone: Record<Step, boolean> = { sample: sampleValid && productValid, timer: timerValid, image: imageValid, submit: false };

  function submit() {
    if (!canSubmit || !image || !product) return;
    setError(null);
    startTransition(async () => {
      try {
        const file = await bakeRotation(image);
        const fd = new FormData();
        // Field names follow app/actions/analysis.ts: sampleId | sampleCode (+ subjectPseudonym), synthetic.
        // Notes for a new sample are persisted by the action as samples.metadata.notes.
        if (sampleChoice === "existing") fd.set("sampleId", sampleId);
        else {
          fd.set("sampleCode", newCode.trim());
          if (newSubject.trim()) fd.set("subjectPseudonym", newSubject.trim());
          if (newNotes.trim()) fd.set("notes", newNotes.trim());
        }
        fd.set("synthetic", String(newSynthetic || image.source === "synthetic"));
        fd.set("stripProductId", product.id);
        if (stripBatchId) fd.set("stripBatchId", stripBatchId);
        fd.set("mode", mode);
        fd.set("imageSource", image.source);
        fd.set("operatorLabel", operator.trim() || operatorLabel);
        fd.set("reactionSeconds", String(timer.seconds));
        if (!timer.untimed && timer.startedAt) fd.set("reactionStartedAt", timer.startedAt);
        fd.set("file", file, file.name);
        const res = await startAnalysisAction(fd);
        if (res.ok) {
          clearTimerState(draftId);
          try {
            window.sessionStorage.removeItem("vitra.draft");
          } catch {
            /* ignore */
          }
          router.push(`/analysis/${res.runId}`);
        } else {
          setError(res.error);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Submission failed.");
      }
    });
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* stepper */}
      <aside className="col-span-3">
        <ol className="panel sticky top-4 flex flex-col divide-y divide-line">
          {STEPS.map((s) => {
            const active = s.key === step;
            const done = stepDone[s.key];
            return (
              <li key={s.key}>
                <button type="button" onClick={() => setStep(s.key)} className={cn("flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors", active ? "bg-[rgba(255,255,255,0.03)]" : "hover:bg-[rgba(255,255,255,0.02)]")}>
                  <span className={cn("t-mono flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border text-[11px]", done ? "border-signal text-signal" : active ? "border-line-strong text-fg" : "border-line text-fg-4")}>{done ? <Check className="size-3.5" /> : s.n}</span>
                  <span className={cn("text-[13px]", active ? "text-fg" : "text-fg-3")}>{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 px-1 text-[11.5px] leading-relaxed text-fg-4">
          Draft <span className="t-mono text-fg-3">{draftId}</span>. The reaction timer survives a refresh; the image does not.
        </div>
      </aside>

      <div className="col-span-9 flex flex-col gap-6">
        {/* A */}
        <section className={cn("panel", step !== "sample" && "opacity-70")} aria-labelledby="step-a">
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <div className="t-eyebrow">A / Sample registration</div>
              <h2 id="step-a" className="mt-0.5 text-[15px] font-medium text-fg">
                Sample, strip and mode
              </h2>
            </div>
            {stepDone.sample ? <span className="t-mono text-[10.5px] uppercase tracking-[0.12em] text-signal">ready</span> : null}
          </header>
          <div className="grid grid-cols-2 gap-5 p-5">
            <div className="col-span-2 flex gap-2">
              {(["existing", "new"] as SampleChoice[]).map((c) => (
                <button key={c} type="button" onClick={() => setSampleChoice(c)} className={cn("h-9 rounded-[var(--radius-sm)] border px-4 text-[12.5px]", sampleChoice === c ? "border-signal bg-signal-dim text-fg" : "border-line-strong text-fg-3 hover:text-fg")} disabled={c === "existing" && samples.length === 0}>
                  {c === "existing" ? "Select existing sample" : "Register new sample"}
                </button>
              ))}
            </div>
            {sampleChoice === "existing" ? (
              <Field label="Sample" htmlFor="sampleId" required className="col-span-2">
                <Select id="sampleId" value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
                  {samples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sampleCode}
                      {s.subjectPseudonym ? ` · ${s.subjectPseudonym}` : ""}
                      {s.synthetic ? " · SYNTHETIC" : ""} · {s.runCount} run{s.runCount === 1 ? "" : "s"}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <>
                <Field label="Sample code" htmlFor="newCode" required hint="auto-suggested" help="Pseudonymous code. Never a name or MRN.">
                  <Input id="newCode" mono value={newCode} onChange={(e) => setNewCode(e.target.value)} invalid={newCode.trim().length < 3} />
                </Field>
                <Field label="Subject pseudonym" htmlFor="newSubject" hint="optional" help="Links runs into a time series for the same subject.">
                  <Input id="newSubject" mono value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. SUBJ-07" />
                </Field>
                <Field label="Metadata notes" htmlFor="newNotes" hint="optional" className="col-span-2">
                  <Textarea id="newNotes" rows={2} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Collection context, dilution, storage…" />
                </Field>
                <label className="col-span-2 flex items-center gap-2 text-[12.5px] text-fg-2">
                  <input type="checkbox" checked={newSynthetic} onChange={(e) => setNewSynthetic(e.target.checked)} className="accent-[var(--color-signal)]" />
                  Mark sample as synthetic (set automatically when a synthetic demo strip is used)
                </label>
              </>
            )}

            <Field label="Strip product" htmlFor="strip" required>
              <Select
                id="strip"
                value={stripProductId}
                onChange={(e) => {
                  setStripProductId(e.target.value);
                  setStripBatchId("");
                }}
              >
                {stripProducts.length === 0 ? <option value="">No strip products configured</option> : null}
                {stripProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.manufacturer} {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Batch / lot" htmlFor="batch" hint="optional">
              <Select id="batch" value={stripBatchId} onChange={(e) => setStripBatchId(e.target.value)} disabled={!product || product.batches.length === 0}>
                <option value="">{product && product.batches.length > 0 ? "No batch recorded" : "No batches for this product"}</option>
                {product?.batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.lotNumber}
                    {b.expiresOn ? ` · exp ${b.expiresOn}` : ""}
                  </option>
                ))}
              </Select>
            </Field>

            {product ? (
              <div className="col-span-2">
                <div className="t-eyebrow mb-2">Pad map · left → right</div>
                <ol className="grid grid-cols-10 gap-1">
                  {product.padMap.map((key, i) => {
                    const def = isAnalyteKey(key) ? ANALYTE_BY_KEY[key] : null;
                    return (
                      <li key={`${key}${i}`} className="panel-inset flex flex-col items-center gap-1 px-1 py-2">
                        <span className="t-mono text-[10px] text-fg-4">P{String(i + 1).padStart(2, "0")}</span>
                        <span className="h-3 w-full rounded-[2px]" style={{ background: def ? def.demoRamp[1] : "var(--color-ink-4)" }} aria-hidden />
                        <span className="t-mono text-[10.5px] text-fg-2">{def?.short ?? key}</span>
                      </li>
                    );
                  })}
                </ol>
                <div className="mt-1.5 text-[11px] text-fg-4">Pad swatches are illustrative ramp colours, not calibration references. Reaction time {product.reactionSeconds} s.</div>
              </div>
            ) : null}

            <Field label="Operator" htmlFor="operator" help="Recorded on the run and in the audit trail.">
              <Input id="operator" value={operator} onChange={(e) => setOperator(e.target.value)} />
            </Field>

            <div className="col-span-2">
              <div className="t-eyebrow mb-2">Analysis mode</div>
              <div className="grid grid-cols-2 gap-3">
                <ModeCard active={mode === "research"} onClick={() => setMode("research")} title="Research" blurb="Only models trained on real reference measurements can produce a value, and they are labelled Experimental estimate. Analytes without such a model report Calibration required. Nothing here is clinically validated." />
                <ModeCard active={mode === "demo"} onClick={() => demoModeEnabled && setMode("demo")} disabled={!demoModeEnabled} title="Demo" blurb={demoModeEnabled ? "Synthetic-data models may produce numbers to demonstrate the pipeline. Every such value is labelled Synthetic demo value and has no clinical meaning." : "Demo mode is disabled in settings."} />
              </div>
            </div>
          </div>
          <footer className="flex justify-end border-t border-line px-5 py-3">
            <Button type="button" size="sm" variant="secondary" disabled={!stepDone.sample} onClick={() => setStep("timer")}>
              Continue to timer
            </Button>
          </footer>
        </section>

        {/* B */}
        <section className={cn("panel", step !== "timer" && "opacity-70")}>
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <div className="t-eyebrow">B / Reaction timer</div>
              <h2 className="mt-0.5 text-[15px] font-medium text-fg">Dip, blot, start the clock</h2>
            </div>
            {stepDone.timer ? <span className="t-mono text-[10.5px] uppercase tracking-[0.12em] text-signal">{timer.untimed ? "untimed" : "complete"}</span> : null}
          </header>
          <div className="p-5">
            <ReactionTimer draftId={draftId} defaultSeconds={reactionDefault} value={timer} onChange={onTimerChange} />
          </div>
          <footer className="flex justify-end border-t border-line px-5 py-3">
            <Button type="button" size="sm" variant="secondary" disabled={!stepDone.timer} onClick={() => setStep("image")}>
              Continue to image
            </Button>
          </footer>
        </section>

        {/* C */}
        <section className={cn("panel", step !== "image" && "opacity-70")}>
          <header className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <div className="t-eyebrow">C / Image acquisition</div>
              <h2 className="mt-0.5 text-[15px] font-medium text-fg">Upload, browser camera or synthetic strip</h2>
            </div>
            {stepDone.image ? <span className="t-mono text-[10.5px] uppercase tracking-[0.12em] text-signal">{image?.source === "synthetic" ? "synthetic" : "acquired"}</span> : null}
          </header>
          <div className="p-5">
            <ImageAcquisition value={image} onChange={setImage} blockedReason={captureBlocked} />
            <p className="mt-4 text-[12px] leading-relaxed text-fg-4">Browser capture and file upload are not device integration. Images from the physical prototype arrive through the device ingest API with controlled illumination; everything acquired here is tagged by its source.</p>
          </div>
          <footer className="flex justify-end border-t border-line px-5 py-3">
            <Button type="button" size="sm" variant="secondary" disabled={!stepDone.image} onClick={() => setStep("submit")}>
              Continue to submit
            </Button>
          </footer>
        </section>

        {/* D */}
        <section className={cn("panel", step !== "submit" && "opacity-70")}>
          <header className="border-b border-line px-5 py-4">
            <div className="t-eyebrow">D / Submit</div>
            <h2 className="mt-0.5 text-[15px] font-medium text-fg">Start analysis</h2>
          </header>
          <div className="p-5">
            <dl className="grid grid-cols-4 gap-x-6 gap-y-3 text-[12.5px]">
              <Row k="Sample" v={sampleChoice === "existing" ? (samples.find((s) => s.id === sampleId)?.sampleCode ?? "—") : `${newCode || "—"} (new)`} />
              <Row k="Strip" v={product ? `${product.manufacturer} ${product.name}` : "—"} />
              <Row k="Batch" v={product?.batches.find((b) => b.id === stripBatchId)?.lotNumber ?? "none"} />
              <Row k="Mode" v={mode} />
              <Row k="Reaction" v={timer.untimed ? "untimed (acknowledged)" : timer.completed ? `${timer.seconds} s from ${new Date(timer.startedAt ?? 0).toLocaleTimeString("en-GB")}` : "timer not complete"} />
              <Row k="Image" v={image ? `${image.source === "browser_camera" ? "browser camera" : image.source} · ${image.width}×${image.height}${image.rotation ? ` · rot ${image.rotation}°` : ""}` : "none"} />
              <Row k="Operator" v={operator || operatorLabel} />
              <Row k="Synthetic" v={image?.source === "synthetic" || newSynthetic ? "yes — run will be tagged" : "no"} />
            </dl>
            {error ? (
              <div className="mt-4 rounded-[var(--radius-sm)] border border-[rgba(224,108,108,0.35)] bg-fault-dim px-4 py-3 text-[12.5px] text-fault" role="alert">
                {error}
              </div>
            ) : null}
            {!canSubmit && !pending ? (
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-fg-4">
                {!sampleValid ? <li>· choose or register a sample</li> : null}
                {!productValid ? <li>· choose a strip product</li> : null}
                {!timerValid ? <li>· complete the reaction timer or acknowledge untimed capture</li> : null}
                {!imageValid ? <li>· acquire an image</li> : null}
              </ul>
            ) : null}
          </div>
          <footer className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="text-[11.5px] text-fg-4">The image is stored, sent to the CV service, segmented into ten pads and scored by the result-state policy. Research prototype — not a medical device.</span>
            <Button type="button" onClick={submit} disabled={!canSubmit} loading={pending}>
              {pending ? "Analysing…" : "Start analysis"}
            </Button>
          </footer>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="t-eyebrow">{k}</dt>
      <dd className="t-mono truncate text-fg-2" title={v}>
        {v}
      </dd>
    </div>
  );
}

function ModeCard({ active, onClick, title, blurb, disabled }: { active: boolean; onClick: () => void; title: string; blurb: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cn("flex flex-col gap-1.5 rounded-[var(--radius-sm)] border p-4 text-left transition-colors disabled:opacity-40", active ? "border-signal bg-signal-dim" : "border-line-strong hover:border-[rgba(255,255,255,0.3)]")} aria-pressed={active}>
      <span className="flex items-center justify-between">
        <span className="text-[13.5px] font-medium text-fg">{title}</span>
        <span className={cn("t-mono text-[10px] uppercase tracking-[0.12em]", active ? "text-signal" : "text-fg-4")}>{active ? "selected" : "select"}</span>
      </span>
      <span className="text-[12px] leading-relaxed text-fg-3">{blurb}</span>
    </button>
  );
}
