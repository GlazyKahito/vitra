"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { updateSettings } from "@/lib/data/settings";
import { getStripProduct } from "@/lib/data/strips";
import { str, toActionError, zodMessage, type ActionResult } from "@/app/actions/_shared";
import type { AppSettingsShape } from "@/lib/data/contract";

const schema = z.object({
  defaultStripProductId: z.string().min(1).optional(),
  defaultReactionSeconds: z.coerce.number().int().min(0).max(3600).optional(),
  recalibrationIntervalDays: z.coerce.number().int().min(1).max(3650).optional(),
  demoModeEnabled: z.boolean().optional(),
  requireReviewForReports: z.boolean().optional(),
  cvServiceUrl: z.string().trim().url().max(300).optional(),
});

/** updateSettingsAction(formData): any subset of AppSettingsShape keys. Checkboxes are read when `<key>_present` is set. */
export async function updateSettingsAction(formData: FormData): Promise<ActionResult<{ settings: AppSettingsShape }>> {
  try {
    const user = await requireUser("settings.manage");
    const checkbox = (k: string) => (formData.has(k) || formData.has(`${k}_present`) ? formData.get(k) === "on" || formData.get(k) === "true" : undefined);
    const parsed = schema.safeParse({
      defaultStripProductId: str(formData, "defaultStripProductId") || undefined,
      defaultReactionSeconds: str(formData, "defaultReactionSeconds") || undefined,
      recalibrationIntervalDays: str(formData, "recalibrationIntervalDays") || undefined,
      demoModeEnabled: checkbox("demoModeEnabled"),
      requireReviewForReports: checkbox("requireReviewForReports"),
      cvServiceUrl: str(formData, "cvServiceUrl") || undefined,
    });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    if (parsed.data.defaultStripProductId && !(await getStripProduct(parsed.data.defaultStripProductId))) return { ok: false, error: "Unknown strip product." };
    const settings = await updateSettings(parsed.data, user);
    revalidatePath("/settings");
    revalidatePath("/console");
    return { ok: true, settings };
  } catch (err) {
    return toActionError(err);
  }
}
