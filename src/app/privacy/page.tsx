import { LegalPolicyContent } from "@/components/legal/legal-policy-content";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <LegalPolicyContent policy="privacy" />
    </div>
  );
}
