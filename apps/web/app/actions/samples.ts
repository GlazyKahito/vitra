"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSample, getSampleByCode, nextSampleCode } from "@/lib/data/samples";
import { str, toActionError, zodMessage, type ActionResult } from "@/app/actions/_shared";

const schema = z.object({
  sampleCode: z.string().trim().regex(/^[A-Za-z0-9._-]{2,40}$/, "Use 2–40 letters, digits, '.', '_' or '-'").optional(),
  subjectPseudonym: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9._-]*$/, "Pseudonym may only contain letters, digits, '.', '_' or '-'")
    .optional(),
  notes: z.string().trim().max(2000).optional(),
  synthetic: z.boolean().default(false),
});

/** createSampleAction(formData): sampleCode? (auto when blank), subjectPseudonym?, notes?, synthetic? */
export async function createSampleAction(formData: FormData): Promise<ActionResult<{ sampleId: string; sampleCode: string }>> {
  try {
    const user = await requireUser("samples.manage");
    const parsed = schema.safeParse({
      sampleCode: str(formData, "sampleCode") || undefined,
      subjectPseudonym: str(formData, "subjectPseudonym") || undefined,
      notes: str(formData, "notes") || undefined,
      synthetic: formData.get("synthetic") === "on" || formData.get("synthetic") === "true",
    });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const d = parsed.data;
    // Never accept anything that looks like a name/MRN in the pseudonym; the regex already blocks spaces.
    const code = d.sampleCode || (await nextSampleCode());
    if (await getSampleByCode(code)) return { ok: false, error: `Sample code ${code} already exists.` };
    const sample = await createSample(
      { sampleCode: code, subjectPseudonym: d.subjectPseudonym, synthetic: d.synthetic, metadata: d.notes ? { notes: d.notes } : undefined },
      user,
    );
    revalidatePath("/samples");
    return { ok: true, sampleId: sample.id, sampleCode: sample.sampleCode };
  } catch (err) {
    return toActionError(err);
  }
}
