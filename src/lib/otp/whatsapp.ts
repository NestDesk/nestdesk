import { sendOtpViaMsg91 } from "./providers/msg91";

export interface SendWhatsAppOtpInput {
  phoneE164: string;
  otpCode: string;
  expiryMinutes: number;
}

export async function sendWhatsAppOtp(input: SendWhatsAppOtpInput): Promise<void> {
  await sendOtpViaMsg91(input);
}
