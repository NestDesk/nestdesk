import { Badge } from "../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export type LegalPolicyKey = "privacy" | "terms" | "cookies" | "refund";

type PolicySection = {
  title: string;
  body: string[];
  bullets?: string[];
};

export const LEGAL_POLICY_META: Record<
  LegalPolicyKey,
  { title: string; subtitle: string; badge: string }
> = {
  privacy: {
    title: "Privacy Policy",
    subtitle:
      "How NestDesk collects, uses, stores, shares, and protects personal data for owners, tenants, and visitors.",
    badge: "Privacy",
  },
  terms: {
    title: "Terms of Service",
    subtitle: "The rules for using NestDesk as a property management SaaS platform.",
    badge: "Terms",
  },
  cookies: {
    title: "Cookie Policy",
    subtitle:
      "How we use cookies, local storage, and similar technologies on our website and app.",
    badge: "Cookies",
  },
  refund: {
    title: "Refund Policy",
    subtitle:
      "The billing, cancellation, and refund rules that apply to NestDesk subscriptions.",
    badge: "Refunds",
  },
};

const POLICY_CONTENT: Record<LegalPolicyKey, PolicySection[]> = {
  privacy: [
    {
      title: "1. Who we are",
      body: [
        "NestDesk is a SaaS platform used by hostel, PG, coliving, and rental property owners to manage tenants, rooms, payments, notices, documents, and maintenance requests.",
        "For privacy law purposes, the owner or property operator using NestDesk may also act as a separate data controller for tenant records they upload or manage within the platform.",
      ],
    },
    {
      title: "2. Data we collect",
      body: [
        "We collect only the information needed to operate the service, provide user accounts, secure the platform, and support property workflows.",
      ],
      bullets: [
        "Account information: name, email address, phone number, password hash, avatar, and user metadata.",
        "Owner and business profile details: property name, address, city, state, pincode, plan details, and billing status.",
        "Tenant details: full name, contact information, room assignment, occupation, institution name, Aadhaar-related data where provided, profile completion data, and consent records.",
        "Operational records: payments, notices, maintenance requests, comments, audit logs, login activity, subscriptions, invoices, and support communications.",
        "Uploaded files: profile photos, identification documents, receipts, bills, and any other files you upload or store in the service.",
        "Technical data: IP address, browser type, device information, timestamps, and limited usage logs for security, fraud prevention, and troubleshooting.",
      ],
    },
    {
      title: "3. Why we collect data",
      body: [
        "We process personal data to provide the core NestDesk service, authenticate users, maintain records, send important notifications, comply with legal obligations, and protect the platform from misuse.",
      ],
      bullets: [
        "To create and manage user accounts and verify identity during sign-up.",
        "To let owners manage properties, tenants, payments, maintenance, and notices.",
        "To let tenants access their dashboard, submit maintenance requests, view notices, and manage profile information.",
        "To generate invoices, receipts, reminders, and account activity history.",
        "To detect abuse, rate-limit requests, secure the platform, and investigate incidents.",
        "To comply with applicable tax, accounting, IT, and regulatory obligations.",
      ],
    },
    {
      title: "4. Legal basis and consent",
      body: [
        "Where required, we rely on consent, contract performance, legitimate interests, and compliance with law to process personal data.",
        "Tenants and owners may be asked to provide explicit consent for privacy-related processing, document uploads, or communication preferences.",
      ],
    },
    {
      title: "5. Sharing and processors",
      body: [
        "We do not sell personal data. We may share limited data with trusted service providers strictly for service delivery, support, or legal compliance.",
      ],
      bullets: [
        "Supabase: authentication, database, storage, and application infrastructure.",
        "Razorpay: subscription billing, payment processing, transaction status, and payment verification.",
        "MSG91 or similar messaging providers: OTP, SMS, and WhatsApp delivery where enabled.",
        "Resend or similar email providers: account emails, notifications, and confirmations.",
        "Cloud storage or CDN providers: secure file delivery and document storage.",
        "Professional advisors, auditors, or legal authorities where disclosure is required by law.",
      ],
    },
    {
      title: "6. Retention",
      body: [
        "We keep personal data only for as long as necessary for the purposes described in this policy, unless a longer period is required by law, tax rules, accounting rules, or a valid legal request.",
      ],
      bullets: [
        "Account and login records: retained while the account is active and for a reasonable period after closure for security and compliance.",
        "Financial and invoice records: retained for at least seven years where required for accounting, tax, or audit purposes.",
        "Support and audit records: retained for operational, compliance, and dispute-resolution purposes.",
        "Uploaded documents: retained while the account or related record remains active, unless deletion is requested and legally permitted.",
      ],
    },
    {
      title: "7. Security",
      body: [
        "We use technical and organizational safeguards designed to protect data against unauthorized access, alteration, disclosure, or destruction.",
      ],
      bullets: [
        "Row-level security and server-side access checks for sensitive records.",
        "Access controls, authentication, and session management.",
        "Audit logging for key security-sensitive actions.",
        "Rate limiting and abuse prevention measures.",
        "Encrypted transport over HTTPS for data in transit.",
      ],
    },
    {
      title: "8. Cookies and similar technologies",
      body: [
        "We use cookies and similar technologies to keep users signed in, remember preferences, protect sessions, and improve the site experience. For more detail, see the Cookie Policy.",
      ],
    },
    {
      title: "9. Your rights",
      body: [
        "Subject to applicable law, you may request access to your data, correction of inaccurate data, deletion or restriction of certain data, withdrawal of consent where applicable, and a copy of information we hold about you.",
      ],
      bullets: [
        "Owners may request export of business records and account data where legally permitted.",
        "Tenants may request corrections to profile information and certain document-related updates.",
        "We may need to retain some data where required by law or where necessary to protect legal claims, resolve disputes, or prevent fraud.",
      ],
    },
    {
      title: "10. Data requests and complaints",
      body: [
        "You can contact us for access, correction, deletion, or grievance requests through the support or grievance contact details published on the website or in the app footer.",
        "If you believe your data has been handled improperly, you may raise a complaint and we will review it within a reasonable period and in any event within the time required by law.",
      ],
    },
  ],
  terms: [
    {
      title: "1. Acceptance of terms",
      body: [
        "By accessing or using NestDesk, you agree to these Terms of Service. If you use the platform on behalf of a business or property, you confirm that you are authorized to bind that entity to these terms.",
      ],
    },
    {
      title: "2. Service description",
      body: [
        "NestDesk is a software platform that helps owners manage properties, tenants, payments, notices, maintenance requests, and related administrative tasks. We provide software tools only.",
      ],
    },
    {
      title: "3. User responsibilities",
      body: [
        "You are responsible for the accuracy, legality, and appropriateness of the data you upload, enter, or share in the platform.",
      ],
      bullets: [
        "Provide true and complete account information.",
        "Keep passwords, access tokens, and devices secure.",
        "Ensure you have lawful authority to upload tenant documents or personal data.",
        "Use the service only for legitimate property management purposes.",
        "Review notices, payments, and records before relying on them for legal or financial decisions.",
      ],
    },
    {
      title: "4. Tenant data and privacy",
      body: [
        "Owners remain responsible for how tenant data is collected, used, and disclosed in their property operations, subject to applicable law. NestDesk provides tools to store and manage records, but owners are responsible for their own compliance obligations as a data controller or equivalent legal role.",
      ],
    },
    {
      title: "5. Payments, invoices, and billing records",
      body: [
        "Subscription fees, plan changes, invoices, and receipts are processed according to the billing terms shown in the product, the applicable order form, or the checkout page.",
      ],
      bullets: [
        "Payments are processed through Razorpay and are subject to Razorpay's terms, settlement timelines, and applicable payment gateway rules.",
        "By using the service, you authorize us to share billing and transaction details with Razorpay to process payments and verify settlement.",
        "Fees are generally non-refundable except where the Refund Policy says otherwise or where non-waivable law requires a refund.",
        "You are responsible for paying taxes and charges shown at checkout, if applicable.",
        "We may suspend or limit access for failed payments, charge disputes, or abuse of billing systems.",
      ],
    },
    {
      title: "6. Acceptable use",
      body: [
        "You must not use NestDesk for unlawful, harmful, fraudulent, or abusive activities.",
      ],
      bullets: [
        "Do not upload false identity documents or knowingly inaccurate tenant information.",
        "Do not attempt unauthorized access, reverse engineering, scraping, or service disruption.",
        "Do not use the platform to violate tenant rights, privacy laws, or data protection rules.",
        "Do not store malicious code, offensive content, or illegal content in uploaded files or records.",
      ],
    },
    {
      title: "7. Suspension and termination",
      body: [
        "We may suspend or terminate access if we reasonably believe you violated these terms, created security risks, failed to pay applicable fees, or used the service unlawfully.",
      ],
    },
    {
      title: "8. Ownership and license",
      body: [
        "NestDesk and its related branding, software, and content are owned by us or our licensors. Subject to compliance with these terms, we grant you a limited, non-exclusive, non-transferable license to use the service for your internal business purposes.",
      ],
    },
    {
      title: "9. Third-party services",
      body: [
        "The service may integrate with third-party providers such as authentication, payment, messaging, and storage vendors. Their own terms and policies may also apply.",
      ],
    },
    {
      title: "10. Disclaimer of disputes between owners and tenants",
      body: [
        "NestDesk is a technology platform and not a party to owner-tenant lease disputes, occupancy disputes, payment disputes, eviction decisions, or property operations. We are not responsible for disputes arising from incorrect information entered by users or from the underlying property relationship itself.",
      ],
    },
    {
      title: "11. Limitation of liability",
      body: [
        "To the maximum extent permitted by law, our liability for platform-related issues is limited to the amount paid to us for the affected service period, excluding liabilities that cannot be excluded by law.",
      ],
    },
    {
      title: "12. Changes to terms",
      body: [
        "We may update these terms from time to time. Continued use of the service after an update becomes effective means you accept the revised terms, subject to applicable law.",
      ],
    },
  ],
  cookies: [
    {
      title: "1. What are cookies",
      body: [
        "Cookies are small text files stored on your device by your browser. We also use related technologies such as local storage, session storage, and server-side session cookies.",
      ],
    },
    {
      title: "2. Why we use them",
      body: [
        "We use cookies to keep you signed in, remember your preferences, protect security-sensitive flows, and improve the experience across pages.",
      ],
      bullets: [
        "Strictly necessary cookies for authentication and session management.",
        "Preference cookies for theme, layout, and UI choices.",
        "Security cookies and tokens used to protect forms and sensitive actions.",
        "Analytics or performance cookies only if we clearly disclose them and the law allows them.",
      ],
    },
    {
      title: "3. Cookie categories",
      body: [
        "Depending on the implementation, the following categories may be used on the website or in the app.",
      ],
      bullets: [
        "Essential: required for login, navigation, and secure operations.",
        "Functional: remembers settings such as theme or UI preferences.",
        "Performance: helps us understand loading issues and improve speed.",
        "Advertising: currently not used unless clearly disclosed in the future.",
      ],
    },
    {
      title: "4. Third-party cookies",
      body: [
        "Service providers such as authentication, messaging, or analytics vendors may set their own cookies or storage items when needed to deliver their services.",
      ],
    },
    {
      title: "5. Managing cookies",
      body: [
        "You can control cookies through your browser settings. Disabling some cookies may prevent sign-in or reduce functionality.",
      ],
    },
    {
      title: "6. Policy updates",
      body: [
        "We may update this Cookie Policy when we change how cookies or similar technologies are used.",
      ],
    },
  ],
  refund: [
    {
      title: "1. Subscription billing",
      body: [
        "NestDesk is a subscription-based SaaS service. Fees, billing cycles, applicable taxes, and any trial terms are shown at the time of purchase, upgrade, or renewal.",
      ],
    },
    {
      title: "2. Refund eligibility",
      body: [
        "Refunds are limited, and subscription fees are generally non-refundable after the applicable billing period begins unless required by law or expressly approved by us.",
      ],
      bullets: [
        "If you cancel within 3 calendar days of a new paid subscription purchase, you may qualify for an automated refund where technically available and consistent with payment processor rules.",
        "After the initial 3-day window, we generally do not refund the current paid period, but we may provide a prorated credit or refund in exceptional cases at our discretion.",
        "Upgrades, renewal charges, taxes, and fees already remitted are typically non-refundable once processed.",
        "If a payment was charged in error due to a system fault, duplicate transaction, or other verified billing error, we will review it and may refund or credit the amount as appropriate.",
      ],
    },
    {
      title: "3. Cancellation effects",
      body: [
        "Cancelling a subscription stops future renewals. Access may continue until the end of the current paid term or any grace period specified in the product, unless otherwise required by law.",
      ],
    },
    {
      title: "4. Processor and payment terms",
      body: [
        "Payments are processed through Razorpay and are subject to Razorpay's terms, settlement timelines, and applicable payment gateway rules.",
      ],
      bullets: [
        "Approved refunds are returned to the original payment method through Razorpay and may take 7-14 business days or longer depending on the processor and bank.",
        "Any refund is subject to verification and may be delayed by payment processor review, bank policies, or regulatory requirements.",
      ],
    },
    {
      title: "5. Failed payments and retries",
      body: [
        "Failed payment retries, reminders, grace periods, and access restrictions are handled according to the plan rules shown in the product and your billing status.",
      ],
    },
    {
      title: "6. Charge disputes",
      body: [
        "If you believe a payment was processed incorrectly, contact support promptly with the invoice or transaction details so we can investigate before initiating a payment dispute with the processor.",
      ],
    },
    {
      title: "7. Denied refunds",
      body: [
        "We may deny refunds where the account was suspended or terminated for fraud, abuse, policy violation, chargeback abuse, non-payment, or unlawful use of the platform.",
      ],
    },
    {
      title: "8. Changes",
      body: [
        "We may update this Refund Policy from time to time. Continued use of the service after a change means you accept the revised policy, subject to applicable law.",
      ],
    },
  ],
};

export function getLegalPolicyContent(policy: LegalPolicyKey) {
  return {
    meta: LEGAL_POLICY_META[policy],
    sections: POLICY_CONTENT[policy],
  };
}

export function LegalPolicyContent({ policy }: { policy: LegalPolicyKey }) {
  const { meta, sections } = getLegalPolicyContent(policy);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
          {meta.badge}
        </Badge>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {meta.title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {meta.subtitle}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card
            key={section.title}
            className="rounded-2xl border-border/70 shadow-sm"
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm leading-6 text-muted-foreground">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-5">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
