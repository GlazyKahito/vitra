import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, normaliseMime, sniffImageMime, validateImage } from "@/lib/analysis/image-validate";

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0]);

describe("sniffImageMime", () => {
  it("detects jpeg/png/webp", () => {
    expect(sniffImageMime(jpeg)).toBe("image/jpeg");
    expect(sniffImageMime(png)).toBe("image/png");
    expect(sniffImageMime(webp)).toBe("image/webp");
  });
  it("rejects unknown bytes", () => {
    expect(sniffImageMime(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(sniffImageMime(new Uint8Array([]))).toBeNull();
  });
});

describe("validateImage", () => {
  it("accepts matching declared type", () => {
    const v = validateImage(png, "image/png");
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.mimeType).toBe("image/png");
  });
  it("accepts generic declared type and uses sniffed", () => {
    const v = validateImage(jpeg, "application/octet-stream");
    expect(v.ok && v.mimeType).toBe("image/jpeg");
    expect(validateImage(webp, undefined).ok).toBe(true);
  });
  it("normalises image/jpg", () => {
    expect(normaliseMime("image/jpg; charset=binary")).toBe("image/jpeg");
    expect(validateImage(jpeg, "image/jpg").ok).toBe(true);
  });
  it("rejects declared/actual mismatch", () => {
    const v = validateImage(jpeg, "image/png");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toBe("magic_mismatch");
  });
  it("rejects unsupported declared types", () => {
    const v = validateImage(png, "image/gif");
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.error).toBe("unsupported_type");
  });
  it("rejects empty and oversized payloads", () => {
    const empty = validateImage(new Uint8Array([]), "image/png");
    expect(!empty.ok && empty.error).toBe("empty");
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png);
    const v = validateImage(big, "image/png");
    expect(!v.ok && v.error).toBe("too_large");
  });
});
