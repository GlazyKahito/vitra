"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { ANALYTE_KEYS } from "@/lib/analytes";
import { getStripProduct, updateStripProduct } from "@/lib/data/strips";
import { str, toActionError, zodMessage, type ActionResult } from "@/app/actions/_shared";

const geometrySchema = z
  .object({
    mode: z.enum(["auto", "fixed"]).optional(),
    pad_centers: z.array(z.number().min(0).max(1)).optional(),
    pad_size: z.number().min(0.1).max(1).optional(),
    roi_inset: z.number().min(0).max(0.45).optional(),
  })
  .strict();

const schema = z.object({
  id: z.string().min(1),
  padMap: z.array(z.enum(ANALYTE_KEYS)).optional(),
  reactionSeconds: z.coerce.number().int().min(0).max(3600).optional(),
  geometry: geometrySchema.optional(),
  notes: z.string().trim().max(4000).optional(),
});

/** updateStripProductAction(formData): id, padMap (comma-separated or JSON array), reactionSeconds?, geometry (JSON)?, notes? */
export async function updateStripProductAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser("settings.manage");
    const padMapRaw = str(formData, "padMap");
    let padMap: unknown;
    if (padMapRaw && padMapRaw.trim()) {
      try {
        padMap = padMapRaw.trim().startsWith("[") ? JSON.parse(padMapRaw) : padMapRaw.split(",").map((s) => s.trim()).filter(Boolean);
      } catch {
        return { ok: false, error: "padMap must be a comma-separated list or JSON array." };
      }
    }
    const geometryRaw = str(formData, "geometry");
    let geometry: unknown;
    if (geometryRaw && geometryRaw.trim()) {
      try {
        geometry = JSON.parse(geometryRaw);
      } catch {
        return { ok: false, error: "geometry must be valid JSON." };
      }
    }
    const parsed = schema.safeParse({ id: str(formData, "id"), padMap, reactionSeconds: str(formData, "reactionSeconds") || undefined, geometry, notes: str(formData, "notes") ?? undefined });
    if (!parsed.success) return { ok: false, error: zodMessage(parsed.error) };
    const d = parsed.data;
    const product = await getStripProduct(d.id);
    if (!product) return { ok: false, error: "Strip product not found." };
    if (d.padMap) {
      if (d.padMap.length !== product.padCount) return { ok: false, error: `padMap must list exactly ${product.padCount} analytes.` };
      if (new Set(d.padMap).size !== d.padMap.length) return { ok: false, error: "padMap contains duplicate analytes." };
    }
    if (d.geometry?.pad_centers && d.geometry.pad_centers.length !== product.padCount) return { ok: false, error: `geometry.pad_centers must have ${product.padCount} entries.` };
    await updateStripProduct(d.id, { padMap: d.padMap, reactionSeconds: d.reactionSeconds, geometry: d.geometry, notes: d.notes }, user);
    revalidatePath("/settings");
    revalidatePath("/calibration");
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
