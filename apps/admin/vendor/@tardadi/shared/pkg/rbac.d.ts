import type { AdminPanelRole, MembershipRole, PrimaryRole } from "./auth";
/** @deprecated Use PrimaryRole — kept for legacy JWT sessions during migration. */
export type AdminRole = AdminPanelRole;
export declare const ADMIN_ROLES: {
    SUPER_ADMIN: "super_admin";
    PLATFORM_ADMIN: "platform_admin";
    BUSINESS_ADMIN: "business_admin";
    BUSINESS_VIEWER: "business_viewer";
};
export declare const PRIMARY_ROLES: {
    readonly SUPER_ADMIN: "super_admin";
    readonly PLATFORM_ADMIN: "platform_admin";
    readonly BUSINESS_ADMIN: "business_admin";
    readonly BUSINESS_VIEWER: "business_viewer";
    readonly EMPLOYEE: "employee";
    readonly DRIVER: "driver";
};
/** Permission keys — checked by RBAC middleware on the backend. */
export type Permission = "businesses:create" | "businesses:read" | "businesses:update" | "businesses:delete" | "businesses:disable" | "businesses:assign_admin" | "users:invite" | "users:manage" | "users:read" | "users:bulk_import" | "drivers:read" | "drivers:write" | "buses:read" | "buses:write" | "routes:read" | "routes:write" | "trips:read" | "trips:write" | "stats:read_all";
export declare function roleHasPermission(role: AdminPanelRole | PrimaryRole, permission: Permission): boolean;
export declare function assertPermission(role: AdminPanelRole | PrimaryRole, permission: Permission): void;
export declare function membershipGrantsBusinessAccess(role: MembershipRole, permission: Permission): boolean;
