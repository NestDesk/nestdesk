declare module "aadhaar-validator" {
  export function isValidNumber(aadhaar_no: string): boolean;
  export function isValidVID(aadhaar_vid_no: string): boolean;
}
