import { fetchBackend } from "@/lib/backend.server";
import { sendFirebasePasswordSetupEmail } from "@/lib/firebaseIdentity.server";

export async function provisionCompanyManagerLogin(options: {
  token: string;
  businessId: string;
  email: string;
  displayName: string;
}): Promise<{ invited: boolean; emailSent: boolean; error?: string }> {
  let invited = false;
  let inviteError = "";

  try {
    const inviteRes = await fetchBackend("/api/users/invite", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.token}`,
      },
      body: JSON.stringify({
        email: options.email.trim(),
        displayName: options.displayName.trim(),
        primaryRole: "business_admin",
        membershipRole: "business_admin",
        businessId: options.businessId,
      }),
    });
    const inviteBody = (await inviteRes.json().catch(() => ({}))) as {
      success?: boolean;
      error?: string;
    };
    invited = inviteRes.ok && inviteBody.success !== false;
    if (!invited) {
      inviteError =
        inviteBody.error || `تعذّر تجهيز حساب الدخول (${inviteRes.status}).`;
    }
  } catch {
    inviteError = "تعذّر تجهيز حساب الدخول.";
  }

  if (invited) {
    try {
      await fetchBackend(`/api/businesses/${options.businessId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${options.token}`,
        },
        body: JSON.stringify({
          status: "active",
          adminEmail: options.email.trim(),
        }),
      });
    } catch {
      // Invitation already created the login profile.
    }
  }

  let emailSent = false;
  try {
    await sendFirebasePasswordSetupEmail(options.email);
    emailSent = true;
  } catch (err) {
    if (!inviteError) inviteError = (err as Error).message;
  }

  if (invited && emailSent) {
    return { invited, emailSent };
  }

  if (invited && !emailSent) {
    return {
      invited,
      emailSent,
      error:
        "أُنشئ حساب الدخول لكن إيميل التفعيل لم يُرسل. استخدمي «نسيت كلمة المرور» من صفحة الدخول.",
    };
  }

  return {
    invited,
    emailSent,
    error:
      inviteError ||
      "أُرسل الإيميل لكن حساب لوحة الإدارة لم يكتمل. أعدي إرسال الدعوة.",
  };
}
