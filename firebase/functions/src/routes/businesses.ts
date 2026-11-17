import { Router } from "express";
import {
  COLLECTIONS,
  type Business,
  type BusinessListItem,
  type BusinessStats,
  type CreateBusinessRequest,
  type UpdateBusinessRequest,
} from "@tardadi/shared";
import type { DocumentData } from "firebase-admin/firestore";
import { db } from "../firebase";
import {
  requirePermission,
  requireSuperAdmin,
} from "../auth/middleware";
import { businessRef, getBusinessStats } from "../business/helpers";
import { fail, ok, paramId } from "../utils";
import {
  listBusinessEmployees,
  removeEmployeeFromBusiness,
  updateEmployeeMembership,
} from "../services/employees";
import { normalizeEmail, sendPasswordSetupLink } from "../services/users";
import {
  loadCompanyManagerSummary,
  migrateLegacyManagerEmail,
  provisionCompanyManager,
  replaceCompanyManager,
  sendCompanyManagerInvite,
} from "../services/companyManager";

const router = Router();

async function loadAdminSummary(
  businessId: string,
  data: DocumentData
) {
  const manager = await loadCompanyManagerSummary(businessId, data);
  return {
    adminName: manager.name,
    adminPhone: manager.phone,
    adminEmail: manager.email,
  };
}

function inviterUid(req: { adminAuth?: { firebaseUser?: { uid: string }; userId: string } | null }) {
  return req.adminAuth?.firebaseUser?.uid ?? req.adminAuth?.userId ?? "system";
}

router.get(
  "/",
  requirePermission("businesses:read"),
  async (_req, res) => {
    try {
      const snapshot = await db.collection(COLLECTIONS.businesses).get();
      const items: BusinessListItem[] = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          const businessId = doc.id;
          const [stats, admin] = await Promise.all([
            getBusinessStats(db, businessId),
            loadAdminSummary(businessId, data),
          ]);

          return {
            businessId,
            name: data.name as string,
            logo: (data.logo as string | null) ?? null,
            status: data.status as Business["status"],
            adminUserId: (data.adminUserId as string | null) ?? null,
            createdAt: data.createdAt as string | undefined,
            updatedAt: data.updatedAt as string | undefined,
            ...admin,
            driverCount: stats.driverCount,
            busCount: stats.busCount,
            routeCount: stats.routeCount,
            stationCount: stats.stationCount,
          };
        })
      );

      ok(res, items);
    } catch (error) {
      fail(res, (error as Error).message, 500);
    }
  }
);

router.get(
  "/:businessId",
  requirePermission("businesses:read", "drivers:read"),
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const auth = req.adminAuth!;

      if (
        auth.role === "business_admin" &&
        auth.businessId !== businessId
      ) {
        fail(res, "لا يمكنك الوصول لبيانات شركة أخرى.", 403);
        return;
      }

      const doc = await businessRef(db, businessId).get();
      if (!doc.exists) {
        fail(res, "لم نجد هذه الشركة.", 404);
        return;
      }

      const data = doc.data()!;
      const [admin, stats, manager] = await Promise.all([
        loadAdminSummary(businessId, data),
        getBusinessStats(db, businessId),
        loadCompanyManagerSummary(businessId, data),
      ]);

      ok(res, {
        businessId,
        name: data.name,
        logo: data.logo ?? null,
        status: data.status,
        adminUserId: data.adminUserId ?? null,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        ...admin,
        manager,
        stats,
      });
    } catch (error) {
      fail(res, (error as Error).message, 500);
    }
  }
);

router.get(
  "/:businessId/stats",
  requirePermission("businesses:read", "drivers:read", "stats:read_all"),
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const auth = req.adminAuth!;

      if (
        auth.role === "business_admin" &&
        auth.businessId !== businessId
      ) {
        fail(res, "لا يمكنك الوصول لبيانات شركة أخرى.", 403);
        return;
      }

      const doc = await businessRef(db, businessId).get();
      if (!doc.exists) {
        fail(res, "لم نجد هذه الشركة.", 404);
        return;
      }

      const stats: BusinessStats = await getBusinessStats(db, businessId);
      ok(res, stats);
    } catch (error) {
      fail(res, (error as Error).message, 500);
    }
  }
);

router.post("/", requireSuperAdmin, async (req, res) => {
  try {
    const body = req.body as CreateBusinessRequest;
    const {
      name,
      logo = null,
      status = "active",
      adminName,
      adminEmail,
      adminPhone,
    } = body;

    if (!name?.trim()) {
      fail(res, "اكتب اسم الشركة.");
      return;
    }
    if (!adminName?.trim() || !adminEmail?.trim()) {
      fail(res, "اكتب اسم المدير وبريده الإلكتروني.");
      return;
    }

    const email = normalizeEmail(adminEmail);
    const now = new Date().toISOString();
    const managerName = adminName.trim();
    const managerPhone = adminPhone?.trim() || null;
    const businessDoc = await db.collection(COLLECTIONS.businesses).add({
      name: name.trim(),
      logo,
      status,
      adminUserId: null,
      adminName: managerName,
      adminEmail: email,
      adminPhone: managerPhone,
      managerName,
      managerEmail: email,
      managerPhone,
      createdAt: now,
      updatedAt: now,
    });

    try {
      await provisionCompanyManager(businessDoc.id, {
        adminName: managerName,
        adminEmail: email,
        adminPhone: managerPhone,
        inviterUid: inviterUid(req),
      });
    } catch (error) {
      await businessDoc.delete();
      throw error;
    }

    try {
      await sendCompanyManagerInvite(businessDoc.id, email);
    } catch (error) {
      const created = await businessDoc.get();
      const admin = await loadAdminSummary(businessDoc.id, created.data()!);
      ok(
        res,
        {
          businessId: businessDoc.id,
          name: name.trim(),
          logo,
          status,
          ...admin,
          createdAt: now,
          updatedAt: now,
          provisionError:
            (error as Error).message ||
            "أُنشئت الشركة وحُفظ البريد، لكن إيميل الدعوة لم يُرسل. اضغط «حفظ وإرسال الدعوة» مرة واحدة.",
        },
        201
      );
      return;
    }

    const created = await businessDoc.get();
    const admin = await loadAdminSummary(businessDoc.id, created.data()!);

    ok(
      res,
      {
        businessId: businessDoc.id,
        name: name.trim(),
        logo,
        status,
        ...admin,
        createdAt: now,
        updatedAt: now,
      },
      201
    );
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.put("/:businessId", requireSuperAdmin, async (req, res) => {
  try {
    const businessId = paramId(req.params.businessId);
    const body = req.body as UpdateBusinessRequest;
    const docRef = businessRef(db, businessId);
    const doc = await docRef.get();

    if (!doc.exists) {
      fail(res, "لم نجد هذه الشركة.", 404);
      return;
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.logo !== undefined) updates.logo = body.logo;
    if (body.status !== undefined) updates.status = body.status;
    if (body.adminPhone !== undefined) {
      updates.managerPhone = body.adminPhone?.trim() || null;
    }

    await docRef.update(updates);

    ok(res, { businessId, ...updates });
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.get(
  "/:businessId/manager",
  requirePermission("businesses:read"),
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const doc = await businessRef(db, businessId).get();
      if (!doc.exists) {
        fail(res, "لم نجد هذه الشركة.", 404);
        return;
      }
      const manager = await loadCompanyManagerSummary(businessId, doc.data()!);
      ok(res, manager);
    } catch (error) {
      fail(res, (error as Error).message, 500);
    }
  }
);

router.patch("/:businessId/manager", requireSuperAdmin, async (req, res) => {
  try {
    const businessId = paramId(req.params.businessId);
    const { adminName, adminEmail, adminPhone, action } = req.body as {
      adminName?: string;
      adminEmail?: string;
      adminPhone?: string | null;
      action?: "replace" | "migrate_legacy" | "assign";
    };
    if (!adminName?.trim() || !adminEmail?.trim()) {
      fail(res, "الاسم والبريد الإلكتروني مطلوبان.");
      return;
    }

    const doc = await businessRef(db, businessId).get();
    if (!doc.exists) {
      fail(res, "لم نجد هذه الشركة.", 404);
      return;
    }

    const uid = inviterUid(req);
    if (action === "migrate_legacy") {
      await migrateLegacyManagerEmail(businessId, adminEmail, uid);
    } else if (action === "replace") {
      await replaceCompanyManager(businessId, {
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPhone: adminPhone ?? null,
        inviterUid: uid,
      });
    } else {
      await provisionCompanyManager(businessId, {
        adminName: adminName.trim(),
        adminEmail: adminEmail.trim(),
        adminPhone: adminPhone ?? null,
        inviterUid: uid,
      });
    }

    await sendCompanyManagerInvite(businessId, adminEmail.trim());

    const refreshed = await businessRef(db, businessId).get();
    ok(res, await loadCompanyManagerSummary(businessId, refreshed.data()!));
  } catch (error) {
    const err = error as Error & { status?: number };
    fail(res, err.message, err.status ?? 400);
  }
});

router.post(
  "/:businessId/manager/resend-invite",
  requireSuperAdmin,
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const doc = await businessRef(db, businessId).get();
      if (!doc.exists) {
        fail(res, "لم نجد هذه الشركة.", 404);
        return;
      }
      const manager = await loadCompanyManagerSummary(businessId, doc.data()!);
      if (!manager.email) {
        fail(res, "لا يوجد بريد إلكتروني للمدير.", 400);
        return;
      }
      const sent = await sendCompanyManagerInvite(businessId, manager.email);
      ok(res, sent);
    } catch (error) {
      const err = error as Error & { status?: number };
      fail(res, err.message, err.status ?? 400);
    }
  }
);

router.patch("/:businessId/disable", requireSuperAdmin, async (req, res) => {
  try {
    const businessId = paramId(req.params.businessId);
    const docRef = businessRef(db, businessId);
    const doc = await docRef.get();
    if (!doc.exists) {
      fail(res, "لم نجد هذه الشركة.", 404);
      return;
    }

    const now = new Date().toISOString();
    await docRef.update({ status: "inactive", updatedAt: now });

    const adminUserId = doc.data()?.adminUserId as string | undefined;
    if (adminUserId) {
      await db
        .collection(COLLECTIONS.adminUsers)
        .doc(adminUserId)
        .update({ status: "inactive", updatedAt: now });
    }

    ok(res, { businessId, status: "inactive" });
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.delete("/:businessId", requireSuperAdmin, async (req, res) => {
  try {
    const businessId = paramId(req.params.businessId);
    const docRef = businessRef(db, businessId);
    const doc = await docRef.get();
    if (!doc.exists) {
      fail(res, "لم نجد هذه الشركة.", 404);
      return;
    }

    const adminUserId = doc.data()?.adminUserId as string | undefined;
    if (adminUserId) {
      await db.collection(COLLECTIONS.adminUsers).doc(adminUserId).delete();
    }

    await docRef.delete();
    ok(res, { businessId, deleted: true });
  } catch (error) {
    fail(res, (error as Error).message, 500);
  }
});

router.get(
  "/:businessId/employees",
  requirePermission("users:read", "drivers:read"),
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const auth = req.adminAuth!;
      if (auth.role === "business_admin" && auth.businessId !== businessId) {
        fail(res, "ليس لديك صلاحية لهذه الشركة.", 403);
        return;
      }
      const employees = await listBusinessEmployees(businessId);
      ok(res, employees);
    } catch (error) {
      fail(res, (error as Error).message, 500);
    }
  }
);

router.patch(
  "/:businessId/employees/:uid",
  requirePermission("users:manage"),
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const uid = paramId(req.params.uid);
      const auth = req.adminAuth!;
      if (auth.role === "business_admin" && auth.businessId !== businessId) {
        fail(res, "ليس لديك صلاحية لهذه الشركة.", 403);
        return;
      }
      await updateEmployeeMembership(businessId, uid, req.body ?? {});
      ok(res, { updated: true });
    } catch (error) {
      fail(res, (error as Error).message, 400);
    }
  }
);

router.delete(
  "/:businessId/employees/:uid",
  requirePermission("users:manage"),
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const uid = paramId(req.params.uid);
      const auth = req.adminAuth!;
      if (auth.role === "business_admin" && auth.businessId !== businessId) {
        fail(res, "ليس لديك صلاحية لهذه الشركة.", 403);
        return;
      }
      await removeEmployeeFromBusiness(businessId, uid);
      ok(res, { removed: true });
    } catch (error) {
      fail(res, (error as Error).message, 400);
    }
  }
);

router.post(
  "/:businessId/employees/:uid/resend-invite",
  requirePermission("users:manage"),
  async (req, res) => {
    try {
      const businessId = paramId(req.params.businessId);
      const uid = paramId(req.params.uid);
      const auth = req.adminAuth!;
      if (auth.role === "business_admin" && auth.businessId !== businessId) {
        fail(res, "ليس لديك صلاحية لهذه الشركة.", 403);
        return;
      }
      const userDoc = await db.collection(COLLECTIONS.users).doc(uid).get();
      if (!userDoc.exists) {
        fail(res, "المستخدم غير موجود.", 404);
        return;
      }
      const email = userDoc.data()?.email as string | undefined;
      if (!email) {
        fail(res, "لا يوجد إيميل.", 400);
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
