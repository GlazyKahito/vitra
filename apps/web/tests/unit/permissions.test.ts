import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLE_KEYS, ROLE_PERMISSIONS, isRoleKey, roleHasPermission } from "@/lib/auth/permissions";

describe("role permissions", () => {
  it("admin has everything", () => {
    for (const p of PERMISSIONS) expect(roleHasPermission("admin", p)).toBe(true);
  });
  it("clinician can review and report but not create runs", () => {
    expect(roleHasPermission("clinician", "reviews.write")).toBe(true);
    expect(roleHasPermission("clinician", "reports.generate")).toBe(true);
    expect(roleHasPermission("clinician", "runs.create")).toBe(false);
    expect(roleHasPermission("clinician", "calibration.manage")).toBe(false);
  });
  it("operator can create runs but not review", () => {
    expect(roleHasPermission("operator", "runs.create")).toBe(true);
    expect(roleHasPermission("operator", "reviews.write")).toBe(false);
    expect(roleHasPermission("operator", "reports.generate")).toBe(false);
  });
  it("researcher manages calibration but cannot validate models", () => {
    expect(roleHasPermission("researcher", "calibration.manage")).toBe(true);
    expect(roleHasPermission("researcher", "audit.read")).toBe(true);
    expect(roleHasPermission("researcher", "models.validate")).toBe(false);
    expect(roleHasPermission("researcher", "settings.manage")).toBe(false);
  });
  it("viewer is read-only", () => {
    expect(ROLE_PERMISSIONS.viewer).toEqual(["runs.read", "reports.read"]);
  });
  it("only admin can validate models or manage settings/users", () => {
    for (const role of ROLE_KEYS.filter((r) => r !== "admin")) {
      expect(roleHasPermission(role, "models.validate")).toBe(false);
      expect(roleHasPermission(role, "users.manage")).toBe(false);
      expect(roleHasPermission(role, "settings.manage")).toBe(false);
    }
  });
  it("unknown roles have no permissions", () => {
    expect(isRoleKey("root")).toBe(false);
    expect(roleHasPermission("root", "runs.read")).toBe(false);
  });
});
