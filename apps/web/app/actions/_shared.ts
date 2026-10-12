import "server-only";
import { ForbiddenError } from "@/lib/auth";
import { CvServiceError } from "@/lib/cv/client";
import { AnalysisInputError } from "@/lib/analysis/run-analysis";
import type { ZodError } from "zod";

export type ActionResult<T extends object = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

export function zodMessage(err: ZodError): string {
  const first = err.issues[0];
  return first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input.";
}

/** Maps thrown errors to a user-facing message; re-throws Next.js redirect/notFound signals. */
export function toActionError(err: unknown): { ok: false; error: string } {
  if (err && typeof err === "object" && "digest" in err && typeof (err as { digest?: unknown }).digest === "string" && (err as { digest: string }).digest.startsWith("NEXT_")) throw err;
  if (err instanceof ForbiddenError) return { ok: false, error: `You do not have permission (${err.permission}).` };
  if (err instanceof AnalysisInputError) return { ok: false, error: err.message };
  if (err instanceof CvServiceError) return { ok: false, error: err.unreachable ? `CV service unreachable: ${err.message}` : `CV service error (${err.code}): ${err.message}` };
  if (err instanceof Error) return { ok: false, error: err.message || "Unexpected error." };
  return { ok: false, error: "Unexpected error." };
}

export function str(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  return typeof v === "string" ? v : undefined;
}

export function bool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  return v === "on" || v === "true" || v === "1";
}
