import { normalizePhone } from "@tardadi/shared";
import { isStoreReviewPhone } from "../services/passengerReview";

function digits(phone: string): string {
  return normalizePhone(phone).replace(/\D/g, "");
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<boolean> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function sendSms(phone: string, text: string): Promise<void> {
  if (isStoreReviewPhone(phone)) {
    throw new Error("تعذّر إرسال رمز التحقق إلى الجوال.");
  }

  const to = digits(phone);
  if (!to) {
    throw new Error("رقم الجوال غير صالح.");
  }

  const taqnyat = process.env.TAQNYAT_API_KEY?.trim();
  if (taqnyat) {
    const ok = await postJson(
      "https://api.taqnyat.sa/v1/messages",
      {
        recipients: [Number(to)],
        body: text,
        sender: process.env.TAQNYAT_SENDER?.trim() || "TRDDK",
      },
      { Authorization: `Bearer ${taqnyat}` }
    );
    if (ok) return;
    throw new Error("تعذّر إرسال الرسالة إلى الجوال.");
  }

  const msegatKey = process.env.MSEGAT_API_KEY?.trim();
  const msegatUser = process.env.MSEGAT_USER?.trim();
  if (msegatKey && msegatUser) {
    const ok = await postJson(
      "https://www.msegat.com/gw/sendsms.php",
      {
        userName: msegatUser,
        apiKey: msegatKey,
        numbers: to,
        userSender: process.env.MSEGAT_SENDER?.trim() || "TRDDK",
        msg: text,
        msgEncoding: "UTF8",
      },
      {}
    );
    if (ok) return;
    throw new Error("تعذّر إرسال الرسالة إلى الجوال.");
  }

  const webhook = process.env.SMS_WEBHOOK_URL?.trim();
  if (webhook) {
    const ok = await postJson(webhook, { phone: `+${to}`, text }, {});
    if (ok) return;
    throw new Error("تعذّر إرسال الرسالة إلى الجوال.");
  }

  throw new Error("تعذّر إرسال رمز التحقق إلى الجوال.");
}
