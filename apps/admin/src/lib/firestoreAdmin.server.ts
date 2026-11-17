import { GoogleAuth } from "google-auth-library";
import { normalizePhone } from "@tardadi/shared";

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  nullValue?: null;
  mapValue?: { fields?: Record<string, FirestoreValue> };
};

function parseServiceAccount(): {
  credentials: Record<string, unknown>;
  projectId: string;
} {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.");
  }
  const credentials = JSON.parse(raw) as Record<string, unknown>;
  const projectId =
    (credentials.project_id as string | undefined) ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    "trddk-54c45";
  return { credentials, projectId };
}

async function accessToken(): Promise<{ token: string; projectId: string }> {
  const { credentials, projectId } = parseServiceAccount();
  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  const client = await auth.getClient();
  const got = await client.getAccessToken();
  if (!got.token) {
    throw new Error("تعذّر الاتصال بقاعدة البيانات.");
  }
  return { token: got.token, projectId };
}

function root(projectId: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

function str(fields: Record<string, FirestoreValue> | undefined, key: string) {
  return fields?.[key]?.stringValue ?? null;
}

function docIdFromName(name: string) {
  return name.split("/").pop() || "";
}

async function firestoreFetch(
  url: string,
  token: string,
  init: RequestInit = {}
): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error
        ? String((body.error as { message?: string }).message)
        : `Firestore request failed (${res.status})`;
    throw new Error(error);
  }
  return body;
}

export function phoneCandidates(phone: string): string[] {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  const values = new Set<string>([trimmed, normalizePhone(trimmed)]);
  if (digits) values.add(digits);
  if (digits.startsWith("966")) values.add(`+${digits}`);
  if (digits.startsWith("05") && digits.length === 10) {
    values.add(`+966${digits.slice(1)}`);
  }
  if (digits.startsWith("5") && digits.length === 9) {
    values.add(`+966${digits}`);
  }
  return [...values].filter(Boolean);
}

export async function listBusinessDocs(): Promise<
  Array<{ id: string; fields: Record<string, FirestoreValue> }>
> {
  const { token, projectId } = await accessToken();
  const body = (await firestoreFetch(
    `${root(projectId)}/businesses?pageSize=200`,
    token
  )) as { documents?: Array<{ name: string; fields?: Record<string, FirestoreValue> }> };
  const documents = body.documents || [];
  return documents.map((doc) => ({
    id: docIdFromName(doc.name),
    fields: doc.fields || {},
  }));
}

async function querySubcollection(
  token: string,
  projectId: string,
  parentPath: string,
  collectionId: string,
  field: string,
  value: string
) {
  const url = parentPath
    ? `${root(projectId)}/${parentPath}:runQuery`
    : `${root(projectId)}:runQuery`;
  const body = await firestoreFetch(url, token, {
    method: "POST",
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath: field },
            op: "EQUAL",
            value: { stringValue: value },
          },
        },
        limit: 5,
      },
    }),
  });
  const rows = Array.isArray(body) ? body : [];
  return rows
    .map((row) => (row as { document?: { name: string; fields?: Record<string, FirestoreValue> } }).document)
    .filter((doc): doc is { name: string; fields?: Record<string, FirestoreValue> } => Boolean(doc));
}

async function getDoc(
  token: string,
  projectId: string,
  path: string
): Promise<{ id: string; fields: Record<string, FirestoreValue> } | null> {
  try {
    const body = (await firestoreFetch(`${root(projectId)}/${path}`, token)) as {
      name?: string;
      fields?: Record<string, FirestoreValue>;
    };
    return {
      id: docIdFromName(String(body.name || path)),
      fields: body.fields || {},
    };
  } catch {
    return null;
  }
}

async function listDocs(
  token: string,
  projectId: string,
  path: string
) {
  const body = (await firestoreFetch(
    `${root(projectId)}/${path}?pageSize=200&orderBy=sequenceNo`,
    token
  ).catch(async () =>
    firestoreFetch(`${root(projectId)}/${path}?pageSize=200`, token)
  )) as { documents?: Array<{ name: string; fields?: Record<string, FirestoreValue> }> };
  const documents = body.documents || [];
  return documents.map((doc) => ({
    id: docIdFromName(doc.name),
    fields: doc.fields || {},
  }));
}

async function loadDriverSessionViaFunctions(phone: string) {
  const apiUrl = (
    process.env.TARDADI_API_URL ||
    "https://us-central1-trddk-54c45.cloudfunctions.net/api"
  ).replace(/\/$/, "");
  const orgId = process.env.TARDADI_ORG_ID?.trim();
  const payloads = [
    ...(orgId ? [{ phone, organizationId: orgId, businessId: orgId }] : []),
    { phone },
  ];
  let lastError = "رقم الجوال غير مسجل. تواصل مع الإدارة.";
  for (const payload of payloads) {
    const res = await fetch(`${apiUrl}/api/auth/driver-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as {
      success?: boolean;
      data?: unknown;
      error?: string;
    };
    if (json.success && json.data) return json.data;
    if (json.error) lastError = json.error;
  }
  throw new Error(lastError);
}

export async function loadDriverSessionByPhone(phone: string) {
  try {
    return await loadDriverSessionFromFirestore(phone);
  } catch (error) {
    const message = (error as Error).message || "";
    if (!/GOOGLE_SERVICE_ACCOUNT_JSON is not configured/.test(message)) {
      throw error;
    }
    return loadDriverSessionViaFunctions(phone);
  }
}

async function loadDriverSessionFromFirestore(phone: string) {
  const { token, projectId } = await accessToken();
  const candidates = phoneCandidates(phone);
  const businesses = await listBusinessDocs();

  for (const business of businesses) {
    for (const candidate of candidates) {
      const drivers = await querySubcollection(
        token,
        projectId,
        `businesses/${business.id}`,
        "drivers",
        "phone",
        candidate
      );
      const driver = drivers.find((doc) => {
        const status = str(doc.fields, "status");
        return !status || status === "active";
      });
      if (!driver) continue;

      const driverId = docIdFromName(driver.name);
      const assignedRouteId = str(driver.fields, "assignedRouteId");
      const assignedBusId = str(driver.fields, "assignedBusId");
      if (!assignedRouteId || !assignedBusId) {
        throw new Error("لم يتم تعيين خط أو باص لك بعد. تواصل مع الإدارة.");
      }

      const bus = await getDoc(
        token,
        projectId,
        `businesses/${business.id}/buses/${assignedBusId}`
      );
      const route = await getDoc(
        token,
        projectId,
        `businesses/${business.id}/routes/${assignedRouteId}`
      );
      if (!bus) throw new Error("الباص المعيّن غير موجود");
      if (!route) throw new Error("الخط المعيّن غير موجود");

      const stopDocs = await listDocs(
        token,
        projectId,
        `businesses/${business.id}/routes/${assignedRouteId}/stops`
      );
      const stops = stopDocs
        .map((stop) => ({
          stopId: stop.id,
          routeId: assignedRouteId,
          name: str(stop.fields, "name") || "",
          sequenceNo: Number(stop.fields.sequenceNo?.integerValue || 0),
          latitude: Number(
            (stop.fields.latitude as { doubleValue?: number } | undefined)
              ?.doubleValue ??
              stop.fields.latitude?.integerValue ??
              0
          ),
          longitude: Number(
            (stop.fields.longitude as { doubleValue?: number } | undefined)
              ?.doubleValue ??
              stop.fields.longitude?.integerValue ??
              0
          ),
        }))
        .sort((a, b) => a.sequenceNo - b.sequenceNo);

      const trips = await querySubcollection(
        token,
        projectId,
        `businesses/${business.id}`,
        "trips",
        "busId",
        assignedBusId
      );
      const activeTrip = trips.find(
        (trip) => str(trip.fields, "tripStatus") === "active"
      );

      return {
        driver: {
          driverId,
          businessId: business.id,
          organizationId: business.id,
          name: str(driver.fields, "name") || "",
          phone: str(driver.fields, "phone") || candidate,
          driverCode: str(driver.fields, "driverCode"),
          assignedRouteId,
          assignedBusId,
          status: str(driver.fields, "status") || "active",
        },
        bus: {
          busId: bus.id,
          businessId: business.id,
          organizationId: business.id,
          plateNo: str(bus.fields, "plateNo") || "",
          label: str(bus.fields, "label") || "",
          status: str(bus.fields, "status") || "active",
        },
        route: {
          routeId: route.id,
          businessId: business.id,
          organizationId: business.id,
          name: str(route.fields, "name") || "",
          code: str(route.fields, "code") || "",
          colorHex: str(route.fields, "colorHex") || "#FF6B00",
          status: str(route.fields, "status") || "active",
        },
        stops,
        tripId: activeTrip ? docIdFromName(activeTrip.name) : null,
      };
    }
  }

  throw new Error("رقم الجوال غير مسجل. تواصل مع الإدارة.");
}

export async function linkManagerEmailToBusinesses(options: {
  uid: string;
  email: string;
}): Promise<string | null> {
  const { token, projectId } = await accessToken();
  const email = options.email.trim().toLowerCase();
  const businesses = await listBusinessDocs();
  const now = new Date().toISOString();
  let linked: string | null = null;

  for (const business of businesses) {
    const managerUid = str(business.fields, "managerUid");
    const adminEmail = str(business.fields, "adminEmail")?.toLowerCase();
    const managerEmail = str(business.fields, "managerEmail")?.toLowerCase();
    const matchesUser = managerUid === options.uid;
    const matchesEmail = adminEmail === email || managerEmail === email;
    if (!matchesUser && !matchesEmail) continue;

    await firestoreFetch(
      `${root(projectId)}/businesses/${business.id}?updateMask.fieldPaths=adminEmail&updateMask.fieldPaths=managerEmail&updateMask.fieldPaths=managerUid&updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            adminEmail: { stringValue: email },
            managerEmail: { stringValue: email },
            managerUid: { stringValue: options.uid },
            status: { stringValue: "active" },
            updatedAt: { stringValue: now },
          },
        }),
      }
    );
    linked = business.id;
  }

  const userHits = await querySubcollection(
    token,
    projectId,
    "",
    "users",
    "email",
    email
  ).catch(() => []);
  const uid = userHits[0] ? docIdFromName(userHits[0].name) : options.uid;
  const memberships = await listDocs(
    token,
    projectId,
    `users/${uid}/memberships`
  ).catch(() => []);
  for (const membership of memberships) {
    const role = str(membership.fields, "role");
    const status = str(membership.fields, "status");
    if (role !== "business_admin" && role !== "business_viewer") continue;
    if (status === "revoked" || status === "suspended") continue;
    await firestoreFetch(
      `${root(projectId)}/businesses/${membership.id}?updateMask.fieldPaths=adminEmail&updateMask.fieldPaths=managerEmail&updateMask.fieldPaths=managerUid&updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
      token,
      {
        method: "PATCH",
        body: JSON.stringify({
          fields: {
            adminEmail: { stringValue: email },
            managerEmail: { stringValue: email },
            managerUid: { stringValue: options.uid },
            status: { stringValue: "active" },
            updatedAt: { stringValue: now },
          },
        }),
      }
    );
    linked = membership.id;
  }

  return linked;
}
