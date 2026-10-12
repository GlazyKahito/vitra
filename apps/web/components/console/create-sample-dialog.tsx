"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { createSampleAction } from "@/app/actions/samples";

/** Create-sample dialog → createSampleAction → navigate to the new sample. */
export function CreateSampleDialog({ suggestedCode }: { suggestedCode: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createSampleAction(fd);
      if (res.ok) {
        setOpen(false);
        router.push(`/samples/${res.sampleId}`);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <>
      <Button size="sm" leading={<Plus className="size-3.5" />} onClick={() => setOpen(true)}>
        New sample
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} eyebrow="Samples" title="Register a sample" description="Pseudonymous only. Never enter a name, MRN or any direct identifier.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <Field label="Sample code" htmlFor="cs-code" hint="auto if blank" required>
            <Input id="cs-code" name="sampleCode" mono defaultValue={suggestedCode} data-autofocus />
          </Field>
          <Field label="Subject pseudonym" htmlFor="cs-subject" hint="optional" help="Links runs over time for the same subject.">
            <Input id="cs-subject" name="subjectPseudonym" mono placeholder="SUBJ-07" />
          </Field>
          <Field label="Notes" htmlFor="cs-notes" hint="optional">
            <Textarea id="cs-notes" name="notes" rows={3} />
          </Field>
          <label className="flex items-center gap-2 text-[12.5px] text-fg-2">
            <input type="checkbox" name="synthetic" className="accent-[var(--color-signal)]" />
            Synthetic sample (labelled SYNTHETIC everywhere)
          </label>
          {error ? (
            <p className="text-[12.5px] text-fault" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Create sample
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
