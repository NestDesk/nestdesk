import crypto from "node:crypto";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_HEX = process.env.AADHAAR_ENCRYPTION_KEY;
const HASH_PEPPER = process.env.AADHAAR_HASH_PEPPER ?? "";

if (!ENCRYPTION_KEY_HEX) {
  throw new Error("Missing AADHAAR_ENCRYPTION_KEY environment variable.");
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, "hex");
if (ENCRYPTION_KEY.length !== 32) {
  throw new Error("AADHAAR_ENCRYPTION_KEY must be a 32-byte hex string.");
}

export function encryptAadhaar(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}::${tag.toString("hex")}::${encrypted.toString("hex")}`;
}

export function decryptAadhaar(ciphertext: string) {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split("::");
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Invalid Aadhaar ciphertext format.");
  }

  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function hashAadhaar(plain: string) {
  return crypto
    .createHmac("sha256", HASH_PEPPER)
    .update(plain, "utf8")
    .digest("hex");
}
