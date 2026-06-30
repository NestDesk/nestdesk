import crypto from "node:crypto";
import { getDevOtpCode, isMsg91Enabled } from "./config";
import { createAdminClient } from "../supabase/admin";

export interface RequestOwnerPhoneOtpInput {
  phoneE164: string;
  purpose?: string;
}

export interface VerifyOwnerPhoneOtpInput {
  phoneE164: string;
  otpCode: string;
  purpose?: string;
  reqId?: string;
}

export interface RetryOwnerPhoneOtpInput {
  reqId: string;
  retryChannel: string | number; // "12" for WhatsApp, "11" for SMS, etc.
}

export interface OtpRequestResult {
  success: true;
  mode: "msg91" | "mock";
  devOtpHint?: string;
  reqId?: string;
}

export interface OtpRetryResult {
  success: boolean;
  message?: string;
}

export interface RequestEmailOtpInput {
  email: string;
  purpose?: string;
}

export interface VerifyEmailOtpInput {
  email: string;
  otpCode: string;
  purpose?: string;
}

export interface EmailOtpRequestResult {
  success: true;
  mode: "msg91" | "mock";
  devOtpHint?: string;
}

function normalizeIndianNumber(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("091")) return digits.slice(1);
  return null;
}

function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}

function hashOtpCode(otpCode: string): string {
  return crypto.createHash("sha256").update(otpCode).digest("hex");
}

function generateOtpCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export async function requestOwnerPhoneOtp(
  input: RequestOwnerPhoneOtpInput,
): Promise<OtpRequestResult> {
  const useMsg91 = isMsg91Enabled();

  if (!useMsg91) {
    return {
      success: true,
      mode: "mock",
      devOtpHint:
        process.env.NODE_ENV === "production" ? undefined : getDevOtpCode(),
      reqId: "mock_req_id_" + Date.now(),
    };
  }

  const normalized = normalizeIndianNumber(input.phoneE164);
  if (!normalized) {
    throw new Error("Invalid Indian mobile number");
  }

  const widgetId = process.env.MSG91_WIDGET_ID;
  const tokenAuth = process.env.MSG91_TOKEN_AUTH;

  if (!widgetId || !tokenAuth) {
    throw new Error("MSG91 Widget config missing");
  }

  const url = "https://control.msg91.com/api/v5/widget/sendOtp";
  const payload = {
    widgetId,
    tokenAuth,
    identifier: normalized,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();
  console.log("MSG91 sendOtp response:", data);

  if (!resp.ok || data.type === "error") {
    throw new Error(data.message || "Failed to send OTP");
  }

  return {
    success: true,
    mode: "msg91",
    reqId:
      data.reqId ||
      data.messageData?.reqId ||
      (data.type === "success" && typeof data.message === "string"
        ? data.message
        : undefined),
  };
}

export async function verifyOwnerPhoneOtp(
  input: VerifyOwnerPhoneOtpInput,
): Promise<void> {
  const useMsg91 = isMsg91Enabled();

  if (!useMsg91) {
    if (input.otpCode !== getDevOtpCode()) {
      throw new Error("Invalid OTP.");
    }
    return;
  }

  const widgetId = process.env.MSG91_WIDGET_ID;
  const tokenAuth = process.env.MSG91_TOKEN_AUTH;

  if (!widgetId || !tokenAuth) {
    throw new Error("MSG91 Widget config missing");
  }

  if (!input.reqId) {
    throw new Error("reqId is missing. Cannot verify OTP.");
  }

  const url = "https://control.msg91.com/api/v5/widget/verifyOtp";
  const payload = {
    widgetId,
    tokenAuth,
    reqId: input.reqId,
    otp: input.otpCode,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();

  if (!resp.ok || data.type === "error") {
    throw new Error(data.message || "Invalid OTP.");
  }
}

export async function retryOwnerPhoneOtp(
  input: RetryOwnerPhoneOtpInput,
): Promise<OtpRetryResult> {
  const useMsg91 = isMsg91Enabled();

  if (!useMsg91) {
    return { success: true, message: "Mock retry successful" };
  }

  const widgetId = process.env.MSG91_WIDGET_ID;
  const tokenAuth = process.env.MSG91_TOKEN_AUTH;

  if (!widgetId || !tokenAuth) {
    throw new Error("MSG91 Widget config missing");
  }

  if (!input.reqId) {
    throw new Error("reqId is missing. Cannot retry OTP.");
  }

  const url = "https://control.msg91.com/api/v5/widget/retryOtp";
  const payload = {
    widgetId,
    tokenAuth,
    reqId: input.reqId,
    retryChannel: input.retryChannel.toString(),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();

  if (!resp.ok || data.type === "error") {
    throw new Error(data.message || "Failed to retry OTP");
  }

  return { success: true, message: data.message || "Retry sent successfully." };
}

export async function requestEmailOtp(
  input: RequestEmailOtpInput,
): Promise<EmailOtpRequestResult> {
  const normalizedEmail = normalizeEmail(input.email);
  const otpCode = generateOtpCode();
  const otpHash = hashOtpCode(otpCode);
  const expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { error: insertError } = await admin.from("email_otp_challenges").insert({
    email: normalizedEmail,
    purpose: input.purpose || "signup",
    otp_hash: otpHash,
    expires_at: expiry,
  });

  if (insertError) {
    throw new Error(insertError.message || "Failed to store email OTP challenge.");
  }

  const useMsg91 = isMsg91Enabled();
  if (!useMsg91) {
    return {
      success: true,
      mode: "mock",
      devOtpHint: process.env.NODE_ENV === "production" ? undefined : otpCode,
    };
  }

  const authKey = process.env.MSG91_AUTH_KEY?.trim();
  if (!authKey) {
    await admin.from("email_otp_challenges").delete().eq("email", normalizedEmail).order("created_at", { ascending: false }).limit(1);
    throw new Error("MSG91 auth key is missing.");
  }

  const payload = {
    recipients: [
      {
        to: [
          {
            name: normalizedEmail.split("@")[0] || normalizedEmail,
            email: normalizedEmail,
          },
        ],
        variables: {
          company_name: "NestDesk",
          otp: otpCode,
        },
      },
    ],
    from: {
      name: "NestDesk",
      email: "nestdesk@mail.nestdesk.in",
    },
    domain: "mail.nestdesk.in",
    template_id: "global_otp",
  };

  const resp = await fetch("https://control.msg91.com/api/v5/email/send", {
    method: "POST",
    headers: {
      accept: "application/json",
      authkey: authKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));

  if (!resp.ok || data?.type === "error") {
    await admin.from("email_otp_challenges").delete().eq("email", normalizedEmail).order("created_at", { ascending: false }).limit(1);
    throw new Error(data?.message || "Failed to send email OTP.");
  }

  return {
    success: true,
    mode: "msg91",
  };
}

export async function verifyEmailOtp(input: VerifyEmailOtpInput): Promise<void> {
  const normalizedEmail = normalizeEmail(input.email);
  const admin = createAdminClient();

  const { data: challenge, error } = await admin
    .from("email_otp_challenges")
    .select("id, otp_hash, attempts, expires_at, consumed_at")
    .eq("email", normalizedEmail)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to verify email OTP.");
  }

  if (!challenge) {
    throw new Error("OTP not found or expired.");
  }

  const now = new Date();
  if (new Date(challenge.expires_at) <= now) {
    await admin.from("email_otp_challenges").update({ consumed_at: now.toISOString() }).eq("id", challenge.id);
    throw new Error("OTP expired.");
  }

  const nextAttempts = (challenge.attempts ?? 0) + 1;
  const providedHash = hashOtpCode(input.otpCode.trim());

  if (providedHash !== challenge.otp_hash) {
    await admin.from("email_otp_challenges").update({ attempts: nextAttempts }).eq("id", challenge.id);
    throw new Error("Invalid OTP.");
  }

  if (nextAttempts > 5) {
    await admin.from("email_otp_challenges").update({ attempts: nextAttempts, consumed_at: now.toISOString() }).eq("id", challenge.id);
    throw new Error("Too many failed attempts. Please request a new OTP.");
  }

  await admin.from("email_otp_challenges").update({ attempts: nextAttempts, consumed_at: now.toISOString() }).eq("id", challenge.id);
}
