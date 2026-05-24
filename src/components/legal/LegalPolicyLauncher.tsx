"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LegalPolicyDialog } from "./LegalPolicyDialog";
import type { LegalPolicyKey } from "./legal-policy-content";

const POLICIES: Array<{ value: LegalPolicyKey; label: string }> = [
  { value: "privacy", label: "Privacy Policy" },
  { value: "terms", label: "Terms of Service" },
  { value: "cookies", label: "Cookie Policy" },
  { value: "refund", label: "Refund Policy" },
];

export function LegalPolicyLauncher() {
  const [open, setOpen] = useState(false);
  const [activePolicy, setActivePolicy] = useState<LegalPolicyKey>("privacy");

  return (
    <>
      <LegalPolicyDialog
        open={open}
        onOpenChange={setOpen}
        defaultPolicy={activePolicy}
      />
      <ul className="space-y-2 text-sm text-muted-foreground">
        {POLICIES.map((item) => (
          <li key={item.value}>
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => {
                setActivePolicy(item.value);
                setOpen(true);
              }}
            >
              {item.label}
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}
