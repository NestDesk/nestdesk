import { getDevOtpCode, isMsg91Enabled } from "./config";

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

function normalizeIndianNumber(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 13 && digits.startsWith("091")) return digits.slice(1);
  return null;
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
    reqId: data.reqId || data.messageData?.reqId || (data.type === "success" && typeof data.message === "string" ? data.message : undefined),
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
