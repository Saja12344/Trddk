/** Account lifecycle — applies to users and memberships. */
export type AccountStatus = "pending" | "active" | "suspended" | "revoked";
/** Platform-wide primary role stored on users/{uid}. */
export type PrimaryRole = "super_admin" | "platform_admin" | "business_admin" | "business_viewer" | "employee" | "driver";
/** Role within a specific business membership. */
export type MembershipRole = "business_admin" | "business_viewer" | "employee" | "driver";
/** Roles allowed to access the Admin web panel. */
export type AdminPanelRole = "super_admin" | "platform_admin" | "business_admin" | "business_viewer";
export declare const ADMIN_PANEL_ROLES: readonly AdminPanelRole[];
export declare function isAdminPanelRole(role: string): role is AdminPanelRole;
export interface TrddkUser {
    uid: string;
    email: string;
    displayName: string;
    primaryRole: PrimaryRole;
    status: AccountStatus;
    createdAt?: string;
    createdBy?: string | null;
    lastLoginAt?: string | null;
    /** Links migrated admin_users doc id during transition. */
    legacyAdminUserId?: string | null;
}
export interface BusinessMembership {
    businessId: string;
    role: MembershipRole;
    status: AccountStatus;
    joinedAt?: string;
    source?: "invite" | "bulk_import" | "migration" | "manual";
    invitedBy?: string | null;
    employeeId?: string | null;
    driverId?: string | null;
    department?: string | null;
    employeeNumber?: string | null;
    /** Can use Passenger app for this business (default true for employee imports). */
    passengerAccess?: boolean;
    /** Can use Driver app / driver assignments for this business. */
    driverAccess?: boolean;
}
/** Resolved auth context after Firebase ID token verification. */
export interface AuthenticatedUser {
    uid: string;
    email: string;
    displayName: string;
    primaryRole: PrimaryRole;
    status: AccountStatus;
    /** Active business memberships keyed by businessId. */
    memberships: BusinessMembership[];
    /** Convenience: business IDs the user may access. */
    allowedBusinessIds: string[];
}
export interface FirebaseSessionResponse {
    user: AuthenticatedUser;
    /** Short-lived Firebase ID token echo for client refresh coordination. */
    idToken?: string;
}
export interface InviteUserRequest {
    email: string;
    displayName: string;
    primaryRole: PrimaryRole;
    businessId?: string | null;
    membershipRole?: MembershipRole | null;
    employeeNumber?: string | null;
    department?: string | null;
}
export interface BulkImportRow {
    rowNumber: number;
    displayName: string;
    email: string;
    employeeNumber?: string | null;
    role?: MembershipRole | null;
    department?: string | null;
    /** Parsed app role from CSV: passenger | driver | both */
    importRole?: "passenger" | "driver" | "both";
    passengerAccess?: boolean;
    driverAccess?: boolean;
}
export interface BulkImportPreviewRow extends BulkImportRow {
    validationStatus: "valid" | "invalid";
    action: "import" | "skip" | "update";
    message?: string;
    existingInCompany?: boolean;
    existingGlobally?: boolean;
}
export interface BulkImportPreview {
    totalRows: number;
    validRows: number;
    invalidEmails: number;
    duplicatesInFile: number;
    existingUsers: number;
    missingRequired: number;
    invalidRoles?: number;
    preview: BulkImportPreviewRow[];
    errors: Array<{
        rowNumber: number;
        message: string;
    }>;
}
export interface BulkImportResult {
    created: number;
    linked: number;
    updated: number;
    skipped: number;
    failed: number;
    details: Array<{
        email: string;
        status: "created" | "linked" | "updated" | "skipped" | "failed";
        message?: string;
    }>;
}
