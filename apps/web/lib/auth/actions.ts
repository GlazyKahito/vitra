"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit } from "@/lib/data/audit";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(500),
  next: z.string().max(500).optional(),
});

function safeNext(next: string | undefined): string {
  if (!next) return "/console";
  // Only same-origin absolute paths; block protocol-relative and external URLs.
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) return "/console";
  return next;
}

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: typeof formData.get("next") === "string" ? formData.get("next") : undefined,
  });
  if (!parsed.success) return { error: "Enter a valid email address and password." };
  const { email, password, next } = parsed.data;

  const db = await getDb();
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  // Verify even when the user is missing to keep timing roughly constant.
  const ok = await verifyPassword(password, user?.passwordHash ?? "scrypt$16384$8$1$00$00");
  if (!user || !ok || !user.active) {
    await recordAudit({ actor: null, action: "auth.login_failed", entityType: "user", entityId: email, detail: { reason: !user ? "unknown_user" : !user.active ? "inactive" : "bad_password" } });
    return { error: "Invalid email or password." };
  }
  await createSession(user.id);
  await recordAudit({
    actor: { id: user.id, email: user.email, displayName: user.displayName, roleKey: user.roleKey, active: user.active },
    action: "auth.login",
    entityType: "user",
    entityId: user.id,
  });
  redirect(safeNext(next));
}

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await recordAudit({ actor: user, action: "auth.logout", entityType: "user", entityId: user.id });
  redirect("/login");
}
