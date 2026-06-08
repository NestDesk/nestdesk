"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface TenantConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TenantConsentDialog({
  open,
  onOpenChange,
}: TenantConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-0 backdrop-blur-2xl dark:bg-black/40">
        <DialogHeader className="sticky top-0 z-10 border-b border-white/10 bg-white/5 px-6 py-4 backdrop-blur-md">
          <DialogTitle className="text-lg font-bold text-white">
            Tenant Consent Policy
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6 space-y-6 text-white/80 text-sm leading-relaxed">
          {/* Introduction */}
          <section className="space-y-2">
            <h3 className="font-semibold text-white">Information Use Agreement</h3>
            <p>
              This Tenant Consent Policy explains how your personal information will
              be used when you register as a tenant on the NestDesk platform.
            </p>
          </section>

          {/* Data Collection */}
          <section className="space-y-2">
            <h3 className="font-semibold text-white">Data We Collect</h3>
            <p>
              We collect the following information for rental management purposes:
            </p>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li>Full name and contact information</li>
              <li>Email address and phone number</li>
              <li>Occupation and institution/company details</li>
              <li>Gender (optional)</li>
              <li>Aadhaar number (optional, for identity verification)</li>
            </ul>
          </section>

          {/* Use of Information */}
          <section className="space-y-2">
            <h3 className="font-semibold text-white">How We Use Your Information</h3>
            <p>Your information is used exclusively for:</p>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li>Creating and managing your tenant account</li>
              <li>Processing rental payments and rent agreements</li>
              <li>Communicating about maintenance requests and notices</li>
              <li>Managing occupancy and room assignments</li>
              <li>Complying with legal requirements</li>
              <li>Improving our platform services</li>
            </ul>
          </section>

          {/* Sharing */}
          <section className="space-y-2">
            <h3 className="font-semibold text-white">Information Sharing</h3>
            <p>
              Your information is shared only with your property owner/hostel
              management and NestDesk administrators for rental management and
              operational purposes. We do not sell or share your data with third
              parties.
            </p>
          </section>

          {/* Data Security */}
          <section className="space-y-2">
            <h3 className="font-semibold text-white">Data Security</h3>
            <p>
              We implement industry-standard security measures to protect your
              personal information. However, no transmission over the internet is
              completely secure. You acknowledge that you provide information at your
              own risk.
            </p>
          </section>

          {/* Your Rights */}
          <section className="space-y-2">
            <h3 className="font-semibold text-white">Your Rights</h3>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1 text-white/70">
              <li>Access your personal information</li>
              <li>Request corrections to your data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Opt-out of non-essential communications</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="space-y-2">
            <h3 className="font-semibold text-white">Contact Us</h3>
            <p>
              If you have questions about this policy or your data, please contact
              our support team through the NestDesk platform.
            </p>
          </section>

          {/* Consent */}
          <section className="rounded-lg border border-primary/30 bg-primary/10 p-4">
            <p className="text-sm text-white">
              By checking the consent box during registration, you acknowledge that
              you have read and understood this Tenant Consent Policy and agree to
              the use of your personal information as described above.
            </p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
