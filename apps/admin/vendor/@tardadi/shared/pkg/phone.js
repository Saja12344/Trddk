"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.isSaudiMobile = isSaudiMobile;
exports.requireSaudiMobile = requireSaudiMobile;
exports.phoneCandidates = phoneCandidates;
function normalizePhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("966") && digits.length >= 12) {
        return `+${digits}`;
    }
    if (digits.startsWith("05") && digits.length === 10) {
        return `+966${digits.slice(1)}`;
    }
    if (digits.startsWith("5") && digits.length === 9) {
        return `+966${digits}`;
    }
    if (phone.startsWith("+")) {
        return `+${digits}`;
    }
    return digits;
}
/** Saudi mobile stored form: +9665XXXXXXXX. */
function isSaudiMobile(phone) {
    return /^\+9665\d{8}$/.test(normalizePhone(phone));
}
function requireSaudiMobile(phone) {
    const normalized = normalizePhone(phone);
    if (!/^\+9665\d{8}$/.test(normalized)) {
        throw new Error("أدخل رقم جوال سعودي صحيح.");
    }
    return normalized;
}
/** Match a stored phone that may predate E.164. */
function phoneCandidates(phone) {
    const trimmed = phone.trim();
    const digits = trimmed.replace(/\D/g, "");
    const values = new Set([trimmed, normalizePhone(trimmed)]);
    if (digits)
        values.add(digits);
    if (digits.startsWith("966"))
        values.add(`+${digits}`);
    if (digits.startsWith("05") && digits.length === 10) {
        values.add(`+966${digits.slice(1)}`);
    }
    if (digits.startsWith("5") && digits.length === 9) {
        values.add(`+966${digits}`);
    }
    return [...values].filter(Boolean);
}
