import type { Permission } from "@/lib/data/contract";

export type RoleKey = "admin" | "clinician" | "operator" | "researcher" | "viewer";

export const ROLE_KEYS: readonly RoleKey[] = ["admin", "clinician", "operator", "researcher", "viewer"];

export const PERMISSIONS: readonly Permission[] = [
  "runs.create",
  "runs.read",
  "samples.manage",
  "reviews.write",
  "reports.generate",
  "reports.read",
  "calibration.manage",
  "models.validate",
  "devices.manage",
  "settings.manage",
  "audit.read",
  "users.manage",
];

export const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "runs.create": "Start analysis runs (upload / capture / device ingest).",
  "runs.read": "View runs, images and results.",
  "samples.manage": "Create and edit pseudonymous samples.",
  "reviews.write": "Record clinical review decisions.",
  "reports.generate": "Generate PDF / JSON reports.",
  "reports.read": "Download generated reports.",
  "calibration.manage": "Import datasets, train and retire calibration models.",
  "models.validate": "Mark a calibration model as validated (requires evidence).",
  "devices.manage": "Rotate device keys, simulate device events.",
  "settings.manage": "Change application settings.",
  "audit.read": "Read the audit trail.",
  "users.manage": "Manage user accounts.",
};

export const ROLE_LABELS: Record<RoleKey, { label: string; description: string }> = {
  admin: { label: "Administrator", description: "Full access, including model validation and settings." },
  clinician: { label: "Clinician", description: "Reviews runs and generates reports." },
  operator: { label: "Operator", description: "Captures images and starts runs." },
  researcher: { label: "Researcher", description: "Runs analyses and manages calibration." },
  viewer: { label: "Viewer", description: "Read-only access to runs and reports." },
};

export const ROLE_PERMISSIONS: Record<RoleKey, readonly Permission[]> = {
  admin: PERMISSIONS,
  clinician: ["runs.read", "samples.manage", "reviews.write", "reports.generate", "reports.read"],
  operator: ["runs.create", "runs.read", "samples.manage", "reports.read"],
  researcher: ["runs.create", "runs.read", "samples.manage", "calibration.manage", "reports.generate", "reports.read", "audit.read"],
  viewer: ["runs.read", "reports.read"],
};

export function isRoleKey(v: string): v is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(v);
}

export function roleHasPermission(role: string, permission: Permission): boolean {
  if (!isRoleKey(role)) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
