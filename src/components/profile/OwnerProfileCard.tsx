"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardTitle } from "../ui/card";
import { OwnerProfileEditor } from "./OwnerProfileEditor";

type OwnerProfileCardProps = {
  initial: {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string;
    landmark: string;
    city: string;
    state: string;
    pincode: string;
  };
  displayValues: {
    email: string | null;
    onboardingCompleted: boolean;
    phoneVerified: boolean;
    phoneVerifiedAt: string | null;
    addressText: string;
  };
};

export function OwnerProfileCard({ initial, displayValues }: OwnerProfileCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <Card className="overflow-hidden rounded-3xl border-border/70 bg-gradient-to-br from-background via-background to-primary/5 shadow-sm lg:col-span-2">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/8 via-transparent to-emerald-500/8 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.24em] text-primary/80">Owner Portal</p>
            <CardTitle className="text-xl font-semibold tracking-tight text-foreground">Owner Details</CardTitle>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Keep your profile accurate and verify your phone number directly from this section.
            </p>
          </div>
          {!editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-xl border-primary/20 bg-background/80 shadow-sm hover:bg-primary/5"
              onClick={() => setEditing(true)}
            >
              <PencilLine className="h-4 w-4" />
              Edit Profile
            </Button>
          )}
        </div>
      </div>
      <CardContent className="p-5 sm:p-6">
        <OwnerProfileEditor
          initial={initial}
          displayValues={displayValues}
          editing={editing}
          setEditing={setEditing}
        />
      </CardContent>
    </Card>
  );
}
