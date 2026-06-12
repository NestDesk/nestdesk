import { toMsg91Mobile } from "../phone";

interface Msg91SendWhatsAppInput {
  phoneE164: string;
  templateName?: string;
  templateId?: string;
  languageCode?: string;
  templateComponents?: Record<string, { type: "text"; value: string }>;
}

interface Msg91TemplateComponent {
  parameter_name?: string;
  type: "text";
  value: string;
}

interface Msg91WhatsAppPayload {
  integrated_number: string;
  content_type: "template";
  payload: {
    type: "template";
    template: {
      name: string;
      language: {
        code: string;
        policy: "deterministic";
      };
      namespace: null;
      to_and_components: Array<{
        to: string[];
        components: Record<string, Msg91TemplateComponent>;
      }>;
    };
    messaging_product: "whatsapp";
  };
}

function getMsg91Config(input: { templateName?: string; templateId?: string }) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const baseUrl = process.env.MSG91_BASE_URL?.trim() || "https://control.msg91.com";
  const integratedNumber = process.env.MSG91_INTEGRATED_NUMBER?.trim();
  const resolvedTemplateId =
    input.templateId?.trim() ||
    process.env.MSG91_WHATSAPP_NOTICE_TEMPLATE_ID?.trim() ||
    process.env.MSG91_NOTICE_TEMPLATE_ID?.trim() ||
    process.env.MSG91_WHATSAPP_TEMPLATE_ID?.trim() ||
    process.env.MSG91_OTP_TEMPLATE_ID?.trim();
  const resolvedTemplateName =
    input.templateName?.trim() ||
    process.env.MSG91_WHATSAPP_NOTICE_TEMPLATE_NAME?.trim() ||
    process.env.MSG91_WHATSAPP_TEMPLATE_NAME?.trim() ||
    "notices";

  if (!authKey) {
    throw new Error("MSG91_AUTH_KEY is missing.");
  }

  if (!integratedNumber) {
    throw new Error("MSG91_INTEGRATED_NUMBER is missing.");
  }

  if (!resolvedTemplateId && !resolvedTemplateName) {
    throw new Error(
      "MSG91_WHATSAPP_NOTICE_TEMPLATE_ID, MSG91_WHATSAPP_TEMPLATE_NAME, or MSG91_WHATSAPP_TEMPLATE_ID is missing.",
    );
  }

  return {
    authKey,
    baseUrl,
    integratedNumber,
    templateId: resolvedTemplateId,
    templateName: resolvedTemplateName,
  };
}

export async function sendWhatsAppViaMsg91(
  input: Msg91SendWhatsAppInput,
): Promise<void> {
  const { authKey, baseUrl, integratedNumber, templateId, templateName } =
    getMsg91Config(input);
  const languageCode =
    input.languageCode?.trim() ||
    process.env.MSG91_WHATSAPP_LANGUAGE_CODE?.trim() ||
    "en";
  const sanitizedComponents =
    input.templateComponents && Object.keys(input.templateComponents).length > 0
      ? input.templateComponents
      : {};

  const payload: Msg91WhatsAppPayload = {
    integrated_number: integratedNumber,
    content_type: "template",
    payload: {
      type: "template",
      template: {
        name: templateName,
        language: {
          code: languageCode,
          policy: "deterministic",
        },
        namespace: null,
        to_and_components: [
          {
            to: [toMsg91Mobile(input.phoneE164)],
            components: sanitizedComponents,
          },
        ],
      },
      messaging_product: "whatsapp",
    },
  };

  if (templateId && templateId !== templateName) {
    console.warn(
      "sendWhatsAppViaMsg91 templateId is set but MSG91 WhatsApp bulk API payload uses template name. Ignoring templateId for request body.",
      { templateId, templateName },
    );
  }

  const serializedPayload = JSON.stringify(payload);
  const response = await fetch(
    `${baseUrl}/api/v5/whatsapp/whatsapp-outbound-message/bulk/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: serializedPayload,
      cache: "no-store",
    },
  );

  const responseText = await response.text();
  let responseBody: unknown = null;
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    const message =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "message" in responseBody &&
      typeof (responseBody as { message?: unknown }).message === "string"
        ? (responseBody as { message: string }).message
        : "MSG91 WhatsApp send failed.";

    throw new Error(message);
  }
}
