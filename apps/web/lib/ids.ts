import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Time-sortable id: 8-char base36 timestamp + 12 random base36 chars (e.g. "lt3k9f2a-x7q1b0c9d8e2"). */
export function newId(prefix?: string): string {
  const ts = Date.now().toString(36).padStart(9, "0");
  const bytes = randomBytes(12);
  let rand = "";
  for (let i = 0; i < 12; i++) rand += ALPHABET[bytes[i] % 36];
  const id = `${ts}${rand}`;
  return prefix ? `${prefix}_${id}` : id;
}

/** Opaque random token (hex) for sessions and device keys. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Zero-padded code like "R-000123". */
export function padCode(prefix: string, n: number, width = 6): string {
  return `${prefix}-${String(n).padStart(width, "0")}`;
}
