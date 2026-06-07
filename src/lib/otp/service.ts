import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getDevOtpCode,
  getOtpMaxAttempts,
  getOtpTtlSeconds,
  isMsg91Enabled,
} from "@/lib/otp/config";
import { sendWhatsAppOtp } from "@/lib/otp/whatsapp";

interface RequestOwnerPhoneOtpInput {
  phoneE164: string;
  purpose: string;
}

interface VerifyOwnerPhoneOtpInput {
  phoneE164: string;
  otpCode: string;
  purpose: string;
}

export interface OtpRequestResult {
  success: true;
  mode: "msg91" | "mock";
  devOtpHint?: string;
}

function hashOtp(otpCode: string): string {
  const secret = process.env.OTP_SIGNING_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("OTP_SIGNING_SECRET is missing or too short.");
  }

  return crypto.createHmac("sha256", secret).update(otpCode).digest("hex");
}

function randomOtp(length = 6): string {
  const max = 10 ** length;
  return crypto.randomInt(0, max).toString().padStart(length, "0");
}

export async function requestOwnerPhoneOtp(
  input: RequestOwnerPhoneOtpInput,
): Promise<OtpRequestResult> {
  const ttlSeconds = getOtpTtlSeconds();
  const useMsg91 = isMsg91Enabled();
  const otpCode = useMsg91 ? randomOtp(6) : getDevOtpCode();
  const otpHash = hashOtp(otpCode);
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const admin = createAdminClient();

  const { error: insertError } = await admin.from("phone_otp_challenges").insert({
    phone_e164: input.phoneE164,
    purpose: input.purpose,
    otp_hash: otpHash,
    attempts: 0,
    expires_at: expiresAt,
  });

  if (insertError) {
    throw new Error(insertError.message);
  }

  if (useMsg91) {
    await sendWhatsAppOtp({
      phoneE164: input.phoneE164,
      otpCode,
      expiryMinutes: Math.ceil(ttlSeconds / 60),
    });

    return { success: true, mode: "msg91" };
  }

  return {
    success: true,
    mode: "mock",
    devOtpHint: process.env.NODE_ENV === "production" ? undefined : otpCode,
  };
}

export async function verifyOwnerPhoneOtp(
  input: VerifyOwnerPhoneOtpInput,
): Promise<void> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("phone_otp_challenges")
    .select("id, otp_hash, attempts, expires_at")
    .eq("phone_e164", input.phoneE164)
    .eq("purpose", input.purpose)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    if (!isMsg91Enabled()) {
      return;
    }
    throw new Error("No OTP request found. Please request OTP again.");
  }

  if (!isMsg91Enabled()) {
    const { error: consumeError } = await admin
      .from("phone_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.id);

    if (consumeError) {
      throw new Error(consumeError.message);
    }

    return;
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("OTP expired. Please request a new OTP.");
  }

  const maxAttempts = getOtpMaxAttempts();
  if ((data.attempts ?? 0) >= maxAttempts) {
    throw new Error("Maximum attempts reached. Request OTP again.");
  }

  if (!isMsg91Enabled()) {
    const { error: consumeError } = await admin
      .from("phone_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", data.id);

    if (consumeError) {
      throw new Error(consumeError.message);
    }

    return;
  }

  const candidate = hashOtp(input.otpCode);
  if (candidate !== data.otp_hash) {
    await admin
      .from("phone_otp_challenges")
      .update({ attempts: (data.attempts ?? 0) + 1 })
      .eq("id", data.id);
    throw new Error("Invalid OTP.");
  }

  const { error: consumeError } = await admin
    .from("phone_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", data.id);

  if (consumeError) {
    throw new Error(consumeError.message);
  }
}
