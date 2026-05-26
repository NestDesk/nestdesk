"use client";

import { useState } from "react";
import { LegalPolicyDialog } from "./LegalPolicyDialog";

/**
 * A reusable component that renders a clickable "Privacy Policy" link
 * which opens a dialog showing all legal sections instead of navigating away.
 */
export function PrivacyPolicyLink({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`underline underline-offset-2 hover:text-white transition-colors ${className}`}
      >
        Privacy Policy
      </button>
      <LegalPolicyDialog
        open={open}
        onOpenChange={setOpen}
        defaultPolicy="privacy"
      />
    </>
  );
}
