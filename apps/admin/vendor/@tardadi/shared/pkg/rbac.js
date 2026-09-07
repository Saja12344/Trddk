"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIMARY_ROLES = exports.ADMIN_ROLES = void 0;
exports.roleHasPermission = roleHasPermission;
exports.assertPermission = assertPermission;
exports.membershipGrantsBusinessAccess = membershipGrantsBusinessAccess;
exports.ADMIN_ROLES = {
    SUPER_ADMIN: "super_admin",
    PLATFORM_ADMIN: "platform_admin",
    BUSINESS_ADMIN: "business_admin",
    BUSINESS_VIEWER: "business_viewer",
};
exports.PRIMARY_ROLES = {
    SUPER_ADMIN: "super_admin",
    PLATFORM_ADMIN: "platform_admin",
    BUSINESS_ADMIN: "business_admin",
    BUSINESS_VIEWER: "business_viewer",
    EMPLOYEE: "employee",
    DRIVER: "driver",
};
const PRIMARY_ROLE_PERMISSIONS = {
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
const ROLE_PERMISSIONS = {
    super_admin: PRIMARY_ROLE_PERMISSIONS.super_admin,
    platform_admin: PRIMARY_ROLE_PERMISSIONS.platform_admin,
    business_admin: PRIMARY_ROLE_PERMISSIONS.business_admin,
    business_viewer: PRIMARY_ROLE_PERMISSIONS.business_viewer,
};
function roleHasPermission(role, permission) {
    const perms = PRIMARY_ROLE_PERMISSIONS[role] ??
        ROLE_PERMISSIONS[role];
    return perms?.includes(permission) ?? false;
}
function assertPermission(role, permission) {
    if (!roleHasPermission(role, permission)) {
        throw new Error("Forbidden");
    }
}
function membershipGrantsBusinessAccess(role, permission) {
    const asPrimary = role;
    return roleHasPermission(asPrimary, permission);
}
