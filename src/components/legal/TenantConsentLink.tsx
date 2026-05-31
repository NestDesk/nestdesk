"use client";

import { useState } from "react";
import { TenantConsentDialog } from "./TenantConsentDialog";

interface TenantConsentLinkProps {
  className?: string;
}

export function TenantConsentLink({ className = "" }: TenantConsentLinkProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`underline hover:text-white transition-colors ${className}`}
      >
        Tenant Consent Policy
      </button>
      <TenantConsentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
