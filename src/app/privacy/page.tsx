import type { Metadata } from "next";
import { LegalPolicyContent } from "../../components/legal/legal-policy-content";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read NestDesk's Privacy Policy to understand how we collect, use, and protect your data.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <LegalPolicyContent policy="privacy" />
    </div>
  );
}
