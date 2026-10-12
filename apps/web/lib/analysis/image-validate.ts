/** Pure image validation (no I/O). Unit-tested in tests/unit/image-validate.test.ts. */

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIMES)[number];

export type ImageValidationError = "empty" | "too_large" | "unsupported_type" | "magic_mismatch";

export type ImageValidation =
  | { ok: true; mimeType: AllowedImageMime; byteSize: number }
  | { ok: false; error: ImageValidationError; message: string };

function startsWith(bytes: Uint8Array, sig: number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

/** Detects the real image type from magic bytes; null when unrecognised. */
export function sniffImageMime(bytes: Uint8Array): AllowedImageMime | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "image/webp";
  return null;
}

export function normaliseMime(declared: string | null | undefined): string {
  const m = (declared ?? "").split(";")[0].trim().toLowerCase();
  if (m === "image/jpg" || m === "image/pjpeg") return "image/jpeg";
  return m;
}

/**
 * Validates declared mime + size + magic bytes. The sniffed type wins over the declared one
 * when the declared one is missing/generic; a declared supported type that disagrees with the
 * bytes is rejected.
 */
export function validateImage(bytes: Uint8Array, declaredMime: string | null | undefined): ImageValidation {
  if (!bytes || bytes.length === 0) return { ok: false, error: "empty", message: "The uploaded file is empty." };
  if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "too_large", message: `Image exceeds the ${MAX_IMAGE_BYTES / (1024 * 1024)} MB limit.` };
  const sniffed = sniffImageMime(bytes);
  if (!sniffed) return { ok: false, error: "magic_mismatch", message: "File content is not a JPEG, PNG or WebP image." };
  const declared = normaliseMime(declaredMime);
  const declaredIsGeneric = declared === "" || declared === "application/octet-stream";
  if (!declaredIsGeneric) {
    if (!(ALLOWED_IMAGE_MIMES as readonly string[]).includes(declared)) {
      return { ok: false, error: "unsupported_type", message: `Unsupported file type "${declared}". Use JPEG, PNG or WebP.` };
    }
    if (declared !== sniffed) return { ok: false, error: "magic_mismatch", message: `File declares ${declared} but its content is ${sniffed}.` };
  }
  return { ok: true, mimeType: sniffed, byteSize: bytes.length };
}
