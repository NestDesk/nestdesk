import { sendNoticeWhatsApp } from "../../messaging/whatsapp";

interface Msg91SendOtpInput {
  phoneE164: string;
  otpCode: string;
}

export async function sendOtpViaMsg91(input: Msg91SendOtpInput): Promise<void> {
  const templateName =
    process.env.MSG91_WHATSAPP_TEMPLATE_NAME?.trim() || "reference_number";

  await sendNoticeWhatsApp({
    phoneE164: input.phoneE164,
    templateName,
    templateComponents: {
      body_1: {
        parameter_name: "reference_number",
        type: "text",
        value: input.otpCode,
      },
    },
  });
}
