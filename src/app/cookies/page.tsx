import type { Metadata } from "next";
import { LegalPolicyContent } from "../../components/legal/legal-policy-content";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Learn how NestDesk uses cookies and similar tracking technologies on its platform.",
  alternates: { canonical: "/cookies" },
  robots: { index: true, follow: true },
};

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <LegalPolicyContent policy="cookies" />
    </div>
  );
}
