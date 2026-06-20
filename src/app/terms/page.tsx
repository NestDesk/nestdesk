import type { Metadata } from "next";
import { LegalPolicyContent } from "../../components/legal/legal-policy-content";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Review the Terms of Service governing your use of NestDesk's property management platform.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <LegalPolicyContent policy="terms" />
    </div>
  );
}
