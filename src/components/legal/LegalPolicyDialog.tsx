"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LegalPolicyContent, type LegalPolicyKey } from "./legal-policy-content";

const POLICIES: Array<{ value: LegalPolicyKey; label: string }> = [
  { value: "privacy", label: "Privacy Policy" },
  { value: "terms", label: "Terms of Service" },
  { value: "cookies", label: "Cookie Policy" },
  { value: "refund", label: "Refund Policy" },
];

export function LegalPolicyDialog({
  open,
  onOpenChange,
  defaultPolicy = "privacy",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPolicy?: LegalPolicyKey;
}) {
  const [policy, setPolicy] = useState<LegalPolicyKey>(defaultPolicy);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          setPolicy(defaultPolicy);
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <div className="border-b border-border/70 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-xl">Legal Information</DialogTitle>
            <DialogDescription>
              Review the legal terms that apply to NestDesk, its website, and the
              SaaS product.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="border-b border-border/70 px-6 py-4">
          <div className="grid gap-2 sm:grid-cols-4">
            {POLICIES.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={policy === item.value ? "default" : "outline"}
                className="rounded-xl"
                onClick={() => setPolicy(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="max-h-[calc(90vh-11rem)] overflow-y-auto px-6 py-5">
          <LegalPolicyContent policy={policy} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
