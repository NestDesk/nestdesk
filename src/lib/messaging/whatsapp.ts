import { sendWhatsAppViaMsg91 } from "./msg91";

export interface SendNoticeWhatsAppInput {
  phoneE164: string;
  templateComponents: Record<
    string,
    { parameter_name?: string; type: "text"; value: string }
  >;
  templateName?: string;
  templateId?: string;
  languageCode?: string;
}

export async function sendNoticeWhatsApp(
  input: SendNoticeWhatsAppInput,
): Promise<void> {
  await sendWhatsAppViaMsg91({
    phoneE164: input.phoneE164,
    templateName: input.templateName,
    templateId: input.templateId,
    languageCode: input.languageCode,
    templateComponents: input.templateComponents,
  });
}
