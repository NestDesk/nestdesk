"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDateInIndia } from "@/lib/date";

type OwnerProfileEditorProps = {
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
  editing: boolean;
  setEditing: (editing: boolean) => void;
};

type FormState = OwnerProfileEditorProps["initial"];

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function OwnerProfileEditor({
  initial,
  displayValues,
  editing,
  setEditing,
}: OwnerProfileEditorProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  const [pincodeLookupError, setPincodeLookupError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initial);

  const hasChanges = useMemo(() => {
    return Object.entries(initial).some(([key, value]) => {
      return form[key as keyof FormState] !== value;
    });
  }, [form, initial]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(initial);
    setPincodeLookupError(null);
    setPincodeLookupLoading(false);
    setEditing(false);
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    if (!/^\d{10}$/.test(form.phone)) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }

    if (!form.addressLine1.trim()) {
      toast.error("Address line 1 is required.");
      return;
    }

    if (!form.city.trim() || !form.state.trim()) {
      toast.error("City and state are required.");
      return;
    }

    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error("Enter a valid 6-digit pincode.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/owner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "Could not update profile.");
        return;
      }

      toast.success("Profile updated successfully.");
      if (form.phone !== initial.phone) {
        setOtpSent(false);
        setOtpCode("");
      }
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendOtp() {
    if (!/^\d{10}$/.test(form.phone)) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }

    if (editing && form.phone !== initial.phone) {
      toast.error("Save profile first, then verify the updated phone number.");
      return;
    }

    setSendingOtp(true);
    try {
      const response = await fetch("/api/owner/phone-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone }),
      });

      const json = (await response.json()) as {
        error?: string;
        devOtpHint?: string;
      };

      if (!response.ok) {
        setOtpSent(true);
        setOtpCode("");
        toast.error(
          `${json.error ?? "Could not send OTP."} You can still verify with any OTP in dev mode.`,
        );
        return;
      }

      setOtpCode("");
      setOtpSent(true);
      if (json.devOtpHint) {
        toast.success(`OTP sent. DEV OTP: ${json.devOtpHint}`);
      } else {
        toast.success("OTP sent to your WhatsApp number.");
      }
    } catch {
      setOtpSent(true);
      setOtpCode("");
      toast.error(
        "Network error. OTP request failed, but you can still verify with any OTP in dev mode.",
      );
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpSent) {
      toast.error("Request OTP first.");
      return;
    }

    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Enter a valid 6-digit OTP code.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await fetch("/api/owner/phone-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, otpCode }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "OTP verification failed.");
        return;
      }

      toast.success("Phone number verified successfully.");
      setOtpCode("");
      setOtpSent(false);
      setVerifyDialogOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function lookupPincodeLocation(pincode: string) {
    if (pincode.length !== 6) {
      return;
    }

    setPincodeLookupLoading(true);
    setPincodeLookupError(null);

    try {
      const response = await fetch(`/api/pincode/${encodeURIComponent(pincode)}`);
      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error ?? "Unable to resolve this pincode.");
      }

      updateField("city", String(json.city ?? ""));
      updateField("state", String(json.state ?? ""));
    } catch (error) {
      setPincodeLookupError(
        error instanceof Error ? error.message : "Unable to resolve this pincode.",
      );
    } finally {
      setPincodeLookupLoading(false);
    }
  }

  const verificationDate = displayValues.phoneVerifiedAt
    ? formatDateInIndia(displayValues.phoneVerifiedAt, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  if (!editing) {
    return (
      <div className="sm:col-span-2 space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Full Name</p>
          <p className="text-sm font-medium text-foreground">{initial.fullName}</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge
            variant={displayValues.onboardingCompleted ? "default" : "secondary"}
          >
            {displayValues.onboardingCompleted
              ? "Onboarding Completed"
              : "Onboarding Pending"}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> Email
          </p>
          <p className="text-sm font-medium text-foreground">
            {displayValues.email ?? "-"}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> Phone
              </p>
              <p className="text-sm font-medium text-foreground">{initial.phone}</p>
            </div>

            {!displayValues.phoneVerified ? (
              <Dialog
                open={verifyDialogOpen}
                onOpenChange={(open) => {
                  setVerifyDialogOpen(open);
                  if (!open) {
                    setOtpSent(false);
                    setOtpCode("");
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={sendingOtp}
                  >
                    {sendingOtp ? (
                      <>
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        Sending
                      </>
                    ) : (
                      "Verify"
                    )}
                  </Button>
                </DialogTrigger>

                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Verify phone number</DialogTitle>
                    <DialogDescription className="text-sm leading-6">
                      Enter the OTP sent to your WhatsApp number to verify your
                      phone. For development, any OTP is accepted.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-4 py-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                    >
                      {sendingOtp ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Sending OTP
                        </>
                      ) : otpSent ? (
                        "Resend OTP"
                      ) : (
                        "Send OTP"
                      )}
                    </Button>

                    {otpSent ? (
                      <div className="grid gap-2">
                        <Input
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                          }
                          placeholder="Enter 6-digit OTP"
                          disabled={verifyingOtp}
                          className="h-9 w-full"
                        />
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={verifyingOtp || !otpCode}
                        >
                          {verifyingOtp ? (
                            <>
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              Verifying
                            </>
                          ) : (
                            "Verify OTP"
                          )}
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  <DialogFooter className="gap-2">
                    <DialogDescription className="flex-1 text-xs text-muted-foreground">
                      Close this dialog at any time and reopen it later.
                    </DialogDescription>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setVerifyDialogOpen(false)}
                    >
                      Close
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>

          <Badge variant={displayValues.phoneVerified ? "default" : "secondary"}>
            {displayValues.phoneVerified
              ? verificationDate
                ? `Verified on ${verificationDate}`
                : "Verified"
              : "Not Verified"}
          </Badge>
        </div>

        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Address
          </p>
          <p className="whitespace-pre-line text-sm font-medium text-foreground">
            {displayValues.addressText}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="owner-full-name" className="text-xs">
            Full Name <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-full-name"
            value={form.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            disabled={saving}
            className="h-9 w-full"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-phone" className="text-xs">
            Phone Number <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-phone"
            value={form.phone}
            onChange={(e) => updateField("phone", normalizePhone(e.target.value))}
            disabled={saving}
            placeholder="10-digit number"
            className="h-9 w-full"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="owner-address-1" className="text-xs">
            Address Line 1 <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-address-1"
            value={form.addressLine1}
            onChange={(e) => updateField("addressLine1", e.target.value)}
            disabled={saving}
            className="h-9 w-full"
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="owner-address-2" className="text-xs">
            Address Line 2
          </Label>
          <Input
            id="owner-address-2"
            value={form.addressLine2}
            onChange={(e) => updateField("addressLine2", e.target.value)}
            disabled={saving}
            className="h-9 w-full"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-landmark" className="text-xs">
            Landmark
          </Label>
          <Input
            id="owner-landmark"
            value={form.landmark}
            onChange={(e) => updateField("landmark", e.target.value)}
            disabled={saving}
            className="h-9 w-full"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-pincode" className="text-xs">
            Pincode <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-pincode"
            value={form.pincode}
            onChange={(e) => {
              const raw = e.target.value.replace(/\D/g, "").slice(0, 6);
              updateField("pincode", raw);
              if (raw.length === 6) {
                lookupPincodeLocation(raw);
              } else {
                setPincodeLookupError(null);
              }
            }}
            disabled={saving}
            className="h-9 w-full"
          />
          {pincodeLookupLoading ? (
            <p className="text-xs text-muted-foreground">
              Loading city and state...
            </p>
          ) : null}
          {pincodeLookupError ? (
            <p className="text-xs text-destructive">{pincodeLookupError}</p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-city" className="text-xs">
            City <span className="text-rose-500">*</span>
          </Label>
          <Input id="owner-city" value={form.city} disabled className="h-9 w-full" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-state" className="text-xs">
            State <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-state"
            value={form.state}
            disabled
            className="h-9 w-full"
          />
        </div>
      </div>

      <div className="border-t border-border/60 pt-3">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetForm}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="gap-1.5"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
