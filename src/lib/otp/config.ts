export function isMsg91Enabled(): boolean {
  return process.env.MSG91_ENABLED === "true";
}

export function getDevOtpCode(): string {
  return process.env.DEV_OTP_CODE?.trim() || "123456";
}

export function getOtpTtlSeconds(): number {
  const value = Number(process.env.OTP_TTL_SECONDS ?? 300);
  return Number.isFinite(value) && value > 0 ? value : 300;
}

export function getOtpMaxAttempts(): number {
  const value = Number(process.env.OTP_MAX_ATTEMPTS ?? 5);
  return Number.isFinite(value) && value > 0 ? value : 5;
}
