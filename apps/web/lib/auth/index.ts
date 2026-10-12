import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSessionUser } from "@/lib/auth/session";
import { roleHasPermission } from "@/lib/auth/permissions";
import type { Permission, SafeUser } from "@/lib/data/contract";

export type { Permission, SafeUser };

export class ForbiddenError extends Error {
  readonly permission: Permission;
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "UnauthenticatedError";
  }
}

/** Current user for the request (memoised per request via React cache). */
export const getCurrentUser = cache(async (): Promise<SafeUser | null> => {
  try {
    return await getSessionUser();
  } catch {
    return null;
  }
});

export function can(user: SafeUser | null, permission: Permission): boolean {
  if (!user || !user.active) return false;
  return roleHasPermission(user.roleKey, permission);
}

async function currentPath(): Promise<string> {
  try {
    const h = await headers();
    // Set by middleware when present; otherwise fall back to referer-less default.
    const p = h.get("x-vitra-path") ?? h.get("x-invoke-path") ?? h.get("next-url");
    if (p && p.startsWith("/")) return p;
  } catch {
    /* no request scope */
  }
  return "/console";
}

/**
 * Requires an authenticated user. Redirects to /login?next=… when there is no session;
 * throws ForbiddenError when `permission` is given and the user lacks it.
 */
export async function requireUser(permission?: Permission): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = await currentPath();
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (permission && !can(user, permission)) throw new ForbiddenError(permission);
  return user;
}

/** Variant for API routes: never redirects, throws typed errors instead. */
export async function requireApiUser(permission?: Permission): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  if (permission && !can(user, permission)) throw new ForbiddenError(permission);
  return user;
}
