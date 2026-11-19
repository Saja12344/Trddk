import { createHash } from "crypto";
import { isStoreReviewPhone } from "./passengerReview";

/** Synthetic driver created by driver-review-login. Never stored in Firestore. */
export const STORE_REVIEW_DRIVER_ID = "store-review-driver";
export const STORE_REVIEW_BUSINESS_ID = "store-review";
/** Synthetic passenger created by passenger-review-login. */
export const PASSENGER_REVIEW_USER_ID = "passenger-store-review";

export const ADMIN_NOTIFICATIONS = "admin_notifications";

export type AccountRole = "driver" | "passenger";

export type AccountDeletionPlan =
  | { action: "review_noop" }
  | { action: "already_deleted" }
  | {
      action: "delete";
      role: AccountRole;
      displayName: string;
      phoneLast4: string;
      phoneHash: string | null;
    };

export function isReviewDriverIdentity(
  driverId: string,
  businessId: string
): boolean {
  return (
    driverId === STORE_REVIEW_DRIVER_ID ||
    businessId === STORE_REVIEW_BUSINESS_ID
  );
}

export function isReviewPassengerIdentity(
  userId: string,
  phone?: string | null
): boolean {
  if (userId === PASSENGER_REVIEW_USER_ID) return true;
  if (phone && isStoreReviewPhone(phone)) return true;
  return false;
}

export function phoneLast4(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.slice(-4);
}

export function hashPersonalValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return createHash("sha256").update(trimmed).digest("hex");
}

export function planAccountDeletion(input: {
  role: AccountRole;
  review: boolean;
  status?: string | null;
  displayName?: string | null;
  phone?: string | null;
}): AccountDeletionPlan {
  if (input.review) return { action: "review_noop" };
  if (input.status === "deleted") return { action: "already_deleted" };
  const name = input.displayName?.trim();
  return {
    action: "delete",
    role: input.role,
    displayName: name && name.length > 0 ? name : "—",
    phoneLast4: phoneLast4(input.phone),
    phoneHash: hashPersonalValue(input.phone),
  };
}

export function anonymizedIdentity(now: string, phoneHash: string | null) {
  return {
    name: null,
    nameAr: null,
    nameEn: null,
    displayName: null,
    phone: null,
    email: null,
    phoneHash,
    status: "deleted" as const,
    deletedAt: now,
    deletedBy: "self" as const,
    updatedAt: now,
  };
}
