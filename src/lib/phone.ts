export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  throw new Error("Enter a valid Indian phone number.");
}

export function toMsg91Mobile(phoneE164: string): string {
  return phoneE164.replace(/^\+/, "");
}
