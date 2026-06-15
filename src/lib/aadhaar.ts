// @ts-expect-error - aadhaar-validator module lacks type definitions
import { isValidNumber } from "aadhaar-validator";

export function normalizeAadhaarNumber(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12);
}

export function isValidAadhaarNumber(value: string): boolean {
  const digits = normalizeAadhaarNumber(value);
  return isValidNumber(digits);
}
