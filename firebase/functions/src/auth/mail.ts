import nodemailer from "nodemailer";

type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER?.trim();
  const pass =
    process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

export function classifySmtpDeliveryError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string }).code ?? "";

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    return "secret not bound";
  }
  if (
    code === "EAUTH" ||
    /535|534|authentication/i.test(message) ||
    /Invalid login/i.test(message)
  ) {
    return /Invalid login|Username and Password not accepted/i.test(message)
      ? "invalid SMTP credentials"
      : "Gmail authentication rejected";
  }
  if (/self-signed|certificate|TLS|SSL/i.test(message)) {
    return "network/port error";
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ESOCKET/i.test(code + message)) {
    return "network/port error";
  }
  if (/Sender|from address|550|553|mail from/i.test(message)) {
    return "sender mismatch";
  }
  if (/SMTP is not configured/i.test(message)) {
    return "secret not bound";
  }
  return "smtp delivery failed";
}

export async function sendSupportMail(input: SendMailInput): Promise<void> {
  const smtp = getSmtpConfig();
  if (!smtp) {
    throw new Error("SMTP is not configured");
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    const category = classifySmtpDeliveryError(error);
    console.error("smtp send failed", { category, code: (error as { code?: string }).code });
    throw new Error(category);
  }
}

export function getSupportEmail(): string | undefined {
  return process.env.SUPPORT_EMAIL?.trim() || undefined;
}

export function getAdminPublicUrl(): string {
  return (
    process.env.ADMIN_PUBLIC_URL?.trim() ||
    "https://tardadi-admin.vercel.app"
  ).replace(/\/$/, "");
}
