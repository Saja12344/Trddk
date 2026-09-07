import type { AdminPanelRole, MembershipRole, PrimaryRole } from "./auth";

/** @deprecated Use PrimaryRole — kept for legacy JWT sessions during migration. */
export type AdminRole = AdminPanelRole;

export const ADMIN_ROLES = {
  SUPER_ADMIN: "super_admin" as const,
  PLATFORM_ADMIN: "platform_admin" as const,
  BUSINESS_ADMIN: "business_admin" as const,
  BUSINESS_VIEWER: "business_viewer" as const,
};

export const PRIMARY_ROLES = {
  SUPER_ADMIN: "super_admin",
  PLATFORM_ADMIN: "platform_admin",
  BUSINESS_ADMIN: "business_admin",
  BUSINESS_VIEWER: "business_viewer",
  EMPLOYEE: "employee",
  DRIVER: "driver",
} as const;

/** Permission keys — checked by RBAC middleware on the backend. */
export type Permission =
  | "businesses:create"
  | "businesses:read"
  | "businesses:update"
  | "businesses:delete"
  | "businesses:disable"
  | "businesses:assign_admin"
  | "users:invite"
  | "users:manage"
  | "users:read"
  | "users:bulk_import"
  | "drivers:read"
  | "drivers:write"
  | "buses:read"
  | "buses:write"
  | "routes:read"
  | "routes:write"
  | "trips:read"
  | "trips:write"
  | "stats:read_all";

const PRIMARY_ROLE_PERMISSIONS: Record<
  PrimaryRole,
  readonly Permission[]
> = {
  super_admin: [
    "businesses:create",
    "businesses:read",
    "businesses:update",
    "businesses:delete",
    "businesses:disable",
    "businesses:assign_admin",
    "users:invite",
    "users:manage",
    "users:read",
    "users:bulk_import",
    "drivers:read",
    "drivers:write",
    "buses:read",
    "buses:write",
    "routes:read",
    "routes:write",
    "trips:read",
    "trips:write",
    "stats:read_all",
  ],
  platform_admin: [
    "businesses:create",
    "businesses:read",
    "businesses:update",
    "businesses:disable",
    "businesses:assign_admin",
    "users:invite",
    "users:manage",
    "users:read",
    "users:bulk_import",
    "drivers:read",
    "drivers:write",
    "buses:read",
    "buses:write",
    "routes:read",
    "routes:write",
    "trips:read",
    "trips:write",
    "stats:read_all",
  ],
  business_admin: [
    "drivers:read",
    "drivers:write",
    "buses:read",
    "buses:write",
    "routes:read",
    "routes:write",
    "trips:read",
    "trips:write",
    "users:invite",
    "users:manage",
    "users:read",
    "users:bulk_import",
  ],
  business_viewer: [
    "drivers:read",
    "buses:read",
    "routes:read",
    "trips:read",
  ],
  employee: [],
  driver: [],
};

/** Legacy map for JWT migration period. */
const ROLE_PERMISSIONS: Record<AdminPanelRole, readonly Permission[]> = {
  super_admin: PRIMARY_ROLE_PERMISSIONS.super_admin,
  platform_admin: PRIMARY_ROLE_PERMISSIONS.platform_admin,
  business_admin: PRIMARY_ROLE_PERMISSIONS.business_admin,
  business_viewer: PRIMARY_ROLE_PERMISSIONS.business_viewer,
};

export function roleHasPermission(
  role: AdminPanelRole | PrimaryRole,
  permission: Permission
): boolean {
  const perms =
    PRIMARY_ROLE_PERMISSIONS[role as PrimaryRole] ??
    ROLE_PERMISSIONS[role as AdminPanelRole];
  return perms?.includes(permission) ?? false;
}

export function assertPermission(
  role: AdminPanelRole | PrimaryRole,
  permission: Permission
): void {
  if (!roleHasPermission(role, permission)) {
    throw new Error("Forbidden");
  }
}

export function membershipGrantsBusinessAccess(
  role: MembershipRole,
  permission: Permission
): boolean {
  const asPrimary = role as PrimaryRole;
  return roleHasPermission(asPrimary, permission);
}
