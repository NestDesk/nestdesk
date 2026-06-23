export function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.slice(1)}`;
  }

  throw new Error("Enter a valid Indian phone number.");
}

export function normalizeIndianPhoneDigits(raw: string): string {
  if (!raw) {
    return "";
  }

  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 10) {
    return digits;
  }

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  if (digits.length === 11 && digits.startsWith("0")) {
    return digits.slice(1);
  }

  return digits;
}

export function toMsg91Mobile(phoneE164: string): string {
  return phoneE164.replace(/^\+/, "");
}
