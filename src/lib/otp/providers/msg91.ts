import { toMsg91Mobile } from "@/lib/phone";

interface Msg91SendOtpInput {
  phoneE164: string;
  otpCode: string;
  expiryMinutes: number;
}

function getMsg91Config() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_OTP_TEMPLATE_ID;
  const baseUrl = process.env.MSG91_BASE_URL?.trim() || "https://control.msg91.com";

  if (!authKey) {
    throw new Error("MSG91_AUTH_KEY is missing.");
  }

  if (!templateId) {
    throw new Error("MSG91_OTP_TEMPLATE_ID is missing.");
  }

  return { authKey, templateId, baseUrl };
}

export async function sendOtpViaMsg91(input: Msg91SendOtpInput): Promise<void> {
  const { authKey, templateId, baseUrl } = getMsg91Config();

  const response = await fetch(`${baseUrl}/api/v5/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      authkey: authKey,
    },
    body: JSON.stringify({
      mobile: toMsg91Mobile(input.phoneE164),
      otp: input.otpCode,
      otp_expiry: input.expiryMinutes,
      template_id: templateId,
      realTimeResponse: "1",
    }),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? (payload as { message: string }).message
        : "MSG91 OTP send failed.";
    throw new Error(message);
  }
}
