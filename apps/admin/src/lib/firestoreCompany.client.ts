import { getFirebaseAuth } from "@/lib/firebase/auth.client";

function projectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "trddk-54c45";
}

export async function activateCompanyLoginInFirestore(options: {
  businessId: string;
  adminEmail: string;
}): Promise<boolean> {
  const auth = getFirebaseAuth();
  const user = auth?.currentUser;
  if (!user) return false;
  const idToken = await user.getIdToken(true);
  const email = options.adminEmail.trim().toLowerCase();
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId()}` +
    `/databases/(default)/documents/businesses/${encodeURIComponent(options.businessId)}` +
    `?updateMask.fieldPaths=status&updateMask.fieldPaths=adminEmail&updateMask.fieldPaths=updatedAt`;

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: "active" },
        adminEmail: { stringValue: email },
        updatedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });
  return res.ok;
}
