import crypto from "node:crypto";

export interface PhoneVerificationPayload {
  phoneE164: string;
  purpose: string;
  exp: number;
}

function getSigningSecret(): string {
  const candidates = [
    process.env.OTP_SIGNING_SECRET,
    process.env.NEXTAUTH_SECRET,
    process.env.CRON_SECRET,
    "dev-otp-signing-secret-123456",
  ];

  const secret = candidates.find((value) => value && value.trim().length >= 16);

  if (!secret) {
    throw new Error("OTP_SIGNING_SECRET is missing or too short.");
  }

  return secret.trim();
}

function sign(body: string): string {
  return crypto.createHmac("sha256", getSigningSecret()).update(body).digest("hex");
}

export function createPhoneVerificationToken(
  payload: PhoneVerificationPayload,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyPhoneVerificationToken(
  token: string,
): PhoneVerificationPayload {
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    throw new Error("Invalid verification token format.");
  }

  const expected = sign(body);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid verification token signature.");
  }

  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as PhoneVerificationPayload;

  if (!payload.phoneE164 || !payload.purpose || !payload.exp) {
    throw new Error("Invalid verification token payload.");
  }

  if (Date.now() > payload.exp) {
    throw new Error("Phone verification token expired.");
  }

  return payload;
}
