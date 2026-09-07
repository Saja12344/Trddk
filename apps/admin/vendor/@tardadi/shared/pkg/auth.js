"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_PANEL_ROLES = void 0;
exports.isAdminPanelRole = isAdminPanelRole;
exports.ADMIN_PANEL_ROLES = [
    "super_admin",
    "platform_admin",
    "business_admin",
    "business_viewer",
];
function isAdminPanelRole(role) {
    return exports.ADMIN_PANEL_ROLES.includes(role);
}
