import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/db/schema";
import { newToken } from "@/lib/ids";
import type { SafeUser } from "@/lib/data/contract";

export const SESSION_COOKIE = "vitra_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  // SESSION_SECRET acts as a pepper so a leaked DB alone cannot forge cookies.
  const pepper = process.env.SESSION_SECRET ?? "vitra-dev-session-secret";
  return createHash("sha256").update(`${pepper}:${token}`).digest("hex");
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string): Promise<void> {
  const db = await getDb();
  const token = newToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const h = await headers();
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: (h.get("user-agent") ?? "").slice(0, 400) || null,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  jar.set(SESSION_COOKIE, "", { ...cookieOptions(new Date(0)), maxAge: 0 });
}

/** Resolves the session cookie to an active user, or null. */
export async function getSessionUser(): Promise<SafeUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32) return null;
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      roleKey: users.roleKey,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || !u.active) return null;
  return u;
}

/** Housekeeping: removes expired sessions. */
export async function purgeExpiredSessions(): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
