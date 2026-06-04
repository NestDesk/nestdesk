"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type ActivatePropertyButtonProps = {
  hostelId: string;
  disabled?: boolean;
  disabledReason?: string;
};

type ActivateResponse = {
  success?: boolean;
  message?: string;
  error?: string;
};

export function ActivatePropertyButton({
  hostelId,
  disabled = false,
  disabledReason,
}: ActivatePropertyButtonProps) {
  const [activating, setActivating] = useState(false);
  const router = useRouter();

  async function onActivate() {
    if (activating || disabled) {
      if (disabled && disabledReason) {
        toast.error(disabledReason);
      }
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

  const button = (
    <Button
      type="button"
      size="sm"
      className="rounded-lg h-6 px-2 text-xs"
      onClick={onActivate}
      disabled={activating || disabled}
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

  if (!disabledReason) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{button}</span>
        </TooltipTrigger>
        <TooltipContent>{disabledReason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
