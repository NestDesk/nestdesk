/**
 * Property code utilities.
 * Format: {INITIALS}-{8 random digits}
 * Example: "Sunrise Boys Hostel" → "SBH-47293810"
 * Max initials = 3 characters (first letter of each word, alpha only).
 * Codes never expire and are permanently unique per property.
 */

/**
 * Derive up to 3-char initials from a property name.
 * Strips non-alpha characters, takes first letter of each word, uppercases.
 * Falls back to "PG" if name is empty or has no alpha chars.
 */
function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);

  if (words.length === 0) return "PG";

  const initials = words
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");

  return initials || "PG";
}

/**
 * Generate a random 8-digit string (zero-padded).
 * Uses crypto.getRandomValues for unpredictability.
 */
function randomEightDigits(): string {
  // Generate a number in range [10_000_000, 99_999_999]
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const n = (arr[0] % 90_000_000) + 10_000_000;
  return String(n);
}

/**
 * Generate a unique property code.
 * @param name  Property display name
 * @returns     e.g. "SBH-47293810"
 */
export function generatePropertyCode(name: string): string {
  const initials = getInitials(name);
  const digits = randomEightDigits();
  return `${initials}-${digits}`;
}

/**
 * Validate that a string looks like a property code.
 * Used in the /join page to distinguish codes from full URLs.
 */
export function isPropertyCode(value: string): boolean {
  return /^[A-Z]{1,3}-\d{8}$/i.test(value.trim());
}
