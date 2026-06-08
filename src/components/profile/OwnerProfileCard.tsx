"use client";

import { useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
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
    <Card className="rounded-2xl border-border/70 lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Owner Details</CardTitle>
        {!editing && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setEditing(true)}
          >
            <PencilLine className="h-4 w-4" />
            Edit Profile
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
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
