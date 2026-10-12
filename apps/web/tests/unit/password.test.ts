import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("scrypt passwords", () => {
  it("round-trips", async () => {
    const h = await hashPassword("vitra-admin");
    expect(h.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(await verifyPassword("vitra-admin", h)).toBe(true);
    expect(await verifyPassword("vitra-admin ", h)).toBe(false);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("salts differ between hashes of the same password", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });
  it("is deterministic with an explicit salt", async () => {
    const salt = Buffer.alloc(16, 7);
    expect(await hashPassword("x", salt)).toBe(await hashPassword("x", salt));
  });
  it("rejects malformed or missing hashes without throwing", async () => {
    expect(await verifyPassword("x", null)).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "bcrypt$abc")).toBe(false);
    expect(await verifyPassword("x", "scrypt$0$8$1$00$00")).toBe(false);
    expect(await verifyPassword("x", "scrypt$16384$8$1$zz$zz")).toBe(false);
  });
  it("applies NFKC normalisation", async () => {
    const h = await hashPassword("ﬁsh"); // U+FB01 ligature
    expect(await verifyPassword("fish", h)).toBe(true);
  });
});
