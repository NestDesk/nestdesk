"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type ActivatePropertyButtonProps = {
  hostelId: string;
};

type ActivateResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export function ActivatePropertyButton({ hostelId }: ActivatePropertyButtonProps) {
  const [activating, setActivating] = useState(false);
  const router = useRouter();

  async function onActivate() {
    if (activating) {
      return;
    }

    setActivating(true);
    try {
      const response = await fetch(`/api/hostels/${hostelId}/activate`, {
        method: "POST",
      });

      let payload: ActivateResponse = {};
      try {
        payload = (await response.json()) as ActivateResponse;
      } catch {
        payload = {};
      }

      if (!response.ok) {
        toast.error(payload.error ?? "Could not activate property.");
        return;
      }

      toast.success(payload.message ?? "Property activated.");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setActivating(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      className="rounded-lg h-6 px-2 text-xs"
      onClick={onActivate}
      disabled={activating}
    >
      {activating ? (
        <>
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          Activating...
        </>
      ) : (
        <>
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Activate Property
        </>
      )}
    </Button>
  );
}
