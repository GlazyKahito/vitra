import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify<string | Buffer, Buffer, number, { N: number; r: number; p: number; maxmem: number }, Buffer>(scryptCb);

const KEYLEN = 64;
const PARAMS = { N: 16384, r: 8, p: 1 };

/** Format: scrypt$N$r$p$<salt-hex>$<hash-hex> */
export async function hashPassword(password: string, salt?: Buffer): Promise<string> {
  const s = salt ?? randomBytes(16);
  const derived = await scrypt(password.normalize("NFKC"), s, KEYLEN, { ...PARAMS, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${s.toString("hex")}$${derived.toString("hex")}`;
}

/** Constant-time verification; returns false for malformed hashes instead of throwing. */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0)) return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "hex");
    expected = Buffer.from(parts[5], "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await scrypt(password.normalize("NFKC"), salt, expected.length, { N, r, p, maxmem: 128 * 1024 * 1024 });
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Hashes an opaque secret (device key) with a deterministic-length scrypt; same format as passwords. */
export const hashSecret = hashPassword;
export const verifySecret = verifyPassword;
