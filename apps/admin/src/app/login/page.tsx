"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  firebaseSignIn,
  mapFirebaseAuthError,
} from "@/lib/firebase/auth.client";
import TrddkWordmark from "@/components/TrddkWordmark";

type Step = "password" | "otp";

const MFA_KEY = "trddk_admin_mfa";

function safeAdminNext(next: string | null, fallback: string) {
  if (!next || next === "/" || next === "/en" || next.startsWith("/en/")) {
    return fallback;
  }
  if (next.startsWith("/login") || next.startsWith("/forgot-password")) {
    return fallback;
  }
  return next;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeToken, setChallengeToken] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(MFA_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        challengeToken?: string;
        maskedEmail?: string;
        email?: string;
      };
      if (!saved.challengeToken) return;
      setChallengeToken(saved.challengeToken);
      setMaskedEmail(saved.maskedEmail || "");
      if (saved.email) setEmail(saved.email);
      setStep("otp");
    } catch {
      // ignore
    }
  }, []);

  async function handlePasswordStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { idToken } = await firebaseSignIn(email, password);
      const res = await fetch("/api/auth/mfa-challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const body = await res.json();
      if (!res.ok || !body.success || !body.data?.challengeToken) {
        throw new Error(body.error || "فشل تسجيل الدخول");
      }
      const nextToken = body.data.challengeToken as string;
      const nextEmail = body.data.email as string;
      setChallengeToken(nextToken);
      setMaskedEmail(nextEmail);
      setStep("otp");
      try {
        sessionStorage.setItem(
          MFA_KEY,
          JSON.stringify({
            challengeToken: nextToken,
            maskedEmail: nextEmail,
            email,
          })
        );
      } catch {
        // ignore
      }
    } catch (err) {
      setError(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpStep(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code: otp }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "رمز التحقق غير صحيح");
      }
      try {
        sessionStorage.removeItem(MFA_KEY);
      } catch {
        // ignore
      }
      redirectAfterLogin(body.data.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/mfa-resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "تعذّر إرسال الرمز");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  function redirectAfterLogin(user: { role: string; businessId: string | null }) {
    const next = searchParams.get("next");
    if (
      (user.role === "business_admin" || user.role === "business_viewer") &&
      user.businessId
    ) {
      router.replace(
        safeAdminNext(next, `/businesses/${user.businessId}`)
      );
    } else {
      router.replace(safeAdminNext(next, "/dashboard"));
    }
    router.refresh();
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="login-card-header">
          <TrddkWordmark className="login-wordmark" />
          <h1>تسجيل الدخول</h1>
          <p>
            {step === "password"
              ? "لوحة إدارة TRDDK — البريد وكلمة المرور"
              : `أدخل رمز التحقق المرسل إلى ${maskedEmail || "بريدك"}`}
          </p>
        </div>

        {step === "password" ? (
          <form className="login-form" onSubmit={handlePasswordStep}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="field">
              <label htmlFor="login-email">البريد الإلكتروني</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="login-password">كلمة المرور</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "جاري التحقق..." : "متابعة"}
            </button>

            <Link href="/forgot-password" className="btn btn-ghost">
              نسيت كلمة المرور؟
            </Link>
            <Link href="/" className="btn btn-ghost">
              العودة إلى الموقع
            </Link>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleOtpStep}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="field">
              <label htmlFor="login-otp">رمز التحقق (6 أرقام)</label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                dir="ltr"
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "جاري الدخول..." : "تأكيد والدخول"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              disabled={loading}
              onClick={() => void resendOtp()}
            >
              إعادة إرسال الرمز
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                try {
                  sessionStorage.removeItem(MFA_KEY);
                } catch {
                  // ignore
                }
                setStep("password");
                setOtp("");
                setChallengeToken("");
              }}
            >
              رجوع
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
