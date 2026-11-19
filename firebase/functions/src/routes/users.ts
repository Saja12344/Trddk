import { Router } from "express";
import type { InviteUserRequest, PrimaryRole } from "@tardadi/shared";
import { consumeRateLimit } from "../auth/rateLimit";
import {
  requirePermission,
  requireSuperAdmin,
} from "../auth/middleware";
import {
  assertCanInviteRole,
  enrichBulkImportPreview,
  executeBulkImport,
  inviteUser,
  parseBulkImportRows,
} from "../services/users";
import { fail, ok } from "../utils";
import { resolveBusinessId } from "../auth/scope";

const router = Router();

router.post(
  "/invite",
  requirePermission("users:invite"),
  async (req, res) => {
    try {
      const auth = req.adminAuth!;
      const body = req.body as InviteUserRequest;

      if (!body.displayName || !body.primaryRole) {
        fail(res, "الاسم والدور مطلوبان.");
        return;
      }

      const phoneAccount =
        body.primaryRole === "employee" ||
        body.primaryRole === "driver" ||
        body.membershipRole === "employee" ||
        body.membershipRole === "driver";
      if (phoneAccount) {
        if (!body.phone?.trim()) {
          fail(res, "رقم الجوال مطلوب.");
          return;
        }
      } else if (!body.email?.trim()) {
        fail(res, "الاسم والإيميل والدور مطلوبة.");
        return;
      }

      assertCanInviteRole(
        (auth.firebaseUser?.primaryRole ?? auth.role) as PrimaryRole,
        body.primaryRole
      );

      if (
        (body.primaryRole === "business_admin" ||
          body.primaryRole === "business_viewer" ||
          body.primaryRole === "employee" ||
          body.primaryRole === "driver") &&
        !body.businessId
      ) {
        fail(res, "حدّد الشركة للعضوية.");
        return;
      }

      const inviterUid = auth.firebaseUser?.uid ?? auth.userId;
      const result = await inviteUser(inviterUid, body);
      ok(res, result);
    } catch (error) {
      fail(res, (error as Error).message, 400);
    }
  }
);

router.post(
  "/bulk-import/preview",
  requirePermission("users:bulk_import"),
  async (req, res) => {
    try {
      const auth = req.adminAuth!;
      const { headers, rows, businessId: requestedBusinessId } = req.body as {
        headers?: string[];
        rows?: string[][];
        businessId?: string;
      };
      if (!headers?.length || !rows?.length) {
        fail(res, "الملف فارغ أو غير صالح.");
        return;
      }
      const parsed = parseBulkImportRows(headers, rows);
      const businessId =
        resolveBusinessId(req, auth) ?? requestedBusinessId ?? null;
      if (businessId && parsed.rows.length > 0) {
        const preview = await enrichBulkImportPreview(businessId, parsed.rows);
        ok(res, { preview, rows: parsed.rows });
        return;
      }
      ok(res, { preview: parsed.preview, rows: parsed.rows });
    } catch (error) {
      fail(res, (error as Error).message, 400);
    }
  }
);

router.post(
  "/bulk-import/confirm",
  requirePermission("users:bulk_import"),
  async (req, res) => {
    try {
      const auth = req.adminAuth!;
      const { businessId: requestedBusinessId, rows } = req.body as {
        businessId?: string;
        rows?: ReturnType<typeof parseBulkImportRows>["rows"];
      };

      const businessId =
        resolveBusinessId(req, auth) ?? requestedBusinessId ?? null;
      if (!businessId) {
        fail(res, "حدّد الشركة.");
        return;
      }
      if (!rows?.length) {
        fail(res, "لا توجد صفوف للاستيراد.");
        return;
      }

      const limit = consumeRateLimit(`bulk:${auth.userId}`, 5, 60_000);
      if (!limit.allowed) {
        fail(res, "محاولات كثيرة. حاول لاحقاً.", 429);
        return;
      }

      const inviterUid = auth.firebaseUser?.uid ?? auth.userId;
      const result = await executeBulkImport(inviterUid, businessId, rows);
      ok(res, result);
    } catch (error) {
      fail(res, (error as Error).message, 400);
    }
  }
);

router.post(
  "/:uid/disable",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const { admin } = await import("../firebase");
      const uid = req.params.uid;
      await admin.auth().updateUser(uid, { disabled: true });
      ok(res, { uid, disabled: true });
    } catch (error) {
      fail(res, (error as Error).message, 400);
    }
  }
);

router.post(
  "/:uid/resend-invite",
  requirePermission("users:manage"),
  async (req, res) => {
    try {
      const { sendPasswordSetupLink, getUserByEmail } = await import(
        "../services/users"
      );
      const uid = req.params.uid;
      const userDoc = await (await import("../firebase")).db
        .collection("users")
        .doc(uid)
        .get();
      if (!userDoc.exists) {
        fail(res, "المستخدم غير موجود.", 404);
        return;
      }
      const email = userDoc.data()?.email as string;
      if (!email) {
        fail(res, "لا يوجد إيميل.", 400);
        return;
      }
      const existing = await getUserByEmail(email);
      if (!existing) {
        fail(res, "المستخدم غير موجود.", 404);
        return;
      }
      await sendPasswordSetupLink(email);
      ok(res, { sent: true });
    } catch (error) {
      fail(res, (error as Error).message, 400);
    }
  }
);

export default router;
