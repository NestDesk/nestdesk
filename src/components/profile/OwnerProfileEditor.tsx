"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

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
        toast.error(json.error ?? "Could not send OTP.");
        return;
      }

      setOtpSent(true);
      if (json.devOtpHint) {
        toast.success(`OTP sent. DEV OTP: ${json.devOtpHint}`);
      } else {
        toast.success("OTP sent to your WhatsApp number.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    if (!otpSent) {
      toast.error("Request OTP first.");
      return;
    }

    if (!/^\d{4,8}$/.test(otpCode)) {
      toast.error("Enter a valid OTP code.");
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
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  const verificationDate = displayValues.phoneVerifiedAt
    ? new Date(displayValues.phoneVerifiedAt).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  if (!editing) {
    return (
      <>
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

        <div className="space-y-1">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> Phone
          </p>
          <p className="text-sm font-medium text-foreground">{initial.phone}</p>

          <Badge variant={displayValues.phoneVerified ? "default" : "secondary"}>
            {displayValues.phoneVerified
              ? verificationDate
                ? `Verified on ${verificationDate}`
                : "Verified"
              : "Not Verified"}
          </Badge>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <p className="text-xs text-muted-foreground">
            Verify your WhatsApp phone number to activate any property.
          </p>
          {!displayValues.phoneVerified ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSendOtp}
                  disabled={sendingOtp}
                  className="w-full sm:w-auto"
                >
                  {sendingOtp ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Sending
                    </>
                  ) : (
                    "Send OTP"
                  )}
                </Button>

                <Input
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 8))
                  }
                  placeholder="Enter OTP"
                  disabled={!otpSent || verifyingOtp}
                  className="h-9"
                />

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleVerifyOtp}
                  disabled={!otpSent || verifyingOtp}
                  className="w-full sm:w-auto"
                >
                  {verifyingOtp ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />{" "}
                      Verifying
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" /> Phone number verified
            </div>
          )}
        </div>

        <div className="space-y-1 sm:col-span-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" /> Address
          </p>
          <p className="whitespace-pre-line text-sm font-medium text-foreground">
            {displayValues.addressText}
          </p>
        </div>
      </>
    );
  }

  return (
    <>
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
            className="h-9"
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
            className="h-9"
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
            className="h-9"
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
            className="h-9"
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
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-city" className="text-xs">
            City <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-city"
            value={form.city}
            onChange={(e) => updateField("city", e.target.value)}
            disabled={saving}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-state" className="text-xs">
            State <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-state"
            value={form.state}
            onChange={(e) => updateField("state", e.target.value)}
            disabled={saving}
            className="h-9"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="owner-pincode" className="text-xs">
            Pincode <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="owner-pincode"
            value={form.pincode}
            onChange={(e) =>
              updateField("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            disabled={saving}
            className="h-9"
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
    </>
  );
}
