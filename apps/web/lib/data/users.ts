import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import type { SafeUser } from "@/lib/data/contract";

/** All user accounts without secrets. Ordered by role then email for a stable table. */
export async function listUsers(): Promise<SafeUser[]> {
  const db = await getDb();
  return db
    .select({ id: users.id, email: users.email, displayName: users.displayName, roleKey: users.roleKey, active: users.active })
    .from(users)
    .orderBy(asc(users.roleKey), asc(users.email));
}
