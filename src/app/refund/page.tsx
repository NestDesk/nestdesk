import type { Metadata } from "next";
import { LegalPolicyContent } from "../../components/legal/legal-policy-content";

export const metadata: Metadata = {
  title: "Refund Policy",
  description:
    "Understand NestDesk's refund and cancellation policy for subscription plans.",
  alternates: { canonical: "/refund" },
  robots: { index: true, follow: true },
};

export default function RefundPolicyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <LegalPolicyContent policy="refund" />
    </div>
  );
}
