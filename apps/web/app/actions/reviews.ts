"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { submitReview } from "@/lib/data/reviews";
import { str, toActionError, zodMessage, type ActionResult } from "@/app/actions/_shared";

const schema = z.object({
  runId: z.string().min(1),
  decision: z.enum(["accepted", "rejected", "needs_repeat", "note"]),
  note: z.string().trim().max(4000).optional(),
});

/** submitReviewAction(formData): runId, decision, note? */
export async function submitReviewAction(formData: FormData): Promise<ActionResult<{ reviewId: string }>> {
  try {
    const user = await requireUser("reviews.write");
    const parsed = schema.safeParse({ runId: str(formData, "runId"), decision: str(formData, "decision"), note: str(formData, "note") || undefined });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const review = await submitReview(parsed.data.runId, { decision: parsed.data.decision, note: parsed.data.note }, user);
    revalidatePath("/review");
    revalidatePath("/runs");
    revalidatePath(`/runs/${parsed.data.runId}`);
    revalidatePath("/console");
    return { ok: true, reviewId: review.id };
  } catch (err) {
    return toActionError(err);
  }
}
