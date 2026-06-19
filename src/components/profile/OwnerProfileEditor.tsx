"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Dialog, DialogTrigger } from "../ui/dialog";
import { OtpVerificationDialog } from "../ui/otp-verification-dialog";
import { formatDateInIndia } from "../../lib/date";

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
  const [reqId, setReqId] = useState("");
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [phoneVerifiedForEdit, setPhoneVerifiedForEdit] = useState(displayValues.phoneVerified);
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
    if (key === "phone") {
      setPhoneVerifiedForEdit(false);
    }
  }

  function resetForm() {
    setForm(initial);
    setPhoneVerifiedForEdit(displayValues.phoneVerified);
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

    const phoneChanged = form.phone !== initial.phone;
    if (phoneChanged && !phoneVerifiedForEdit) {
      toast.error("Verify your updated phone number before saving the profile.");
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
        reqId?: string;
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
      if (json.reqId) setReqId(json.reqId);
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
        body: JSON.stringify({ phone: form.phone, otpCode, reqId }),
      });

      const json = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(json.error ?? "OTP verification failed.");
        return;
      }

      toast.success("Phone number verified successfully.");
      setPhoneVerifiedForEdit(true);
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
      <div className="sm:col-span-2 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Full Name</p>
            <p className="mt-2 text-base font-semibold text-foreground">{initial.fullName}</p>
          </article>

          <article className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Status</p>
            <div className="mt-2">
              <Badge
                variant={displayValues.onboardingCompleted ? "default" : "secondary"}
                className="rounded-full px-3 py-1"
              >
                {displayValues.onboardingCompleted
                  ? "Onboarding Completed"
                  : "Onboarding Pending"}
              </Badge>
            </div>
          </article>

          <article className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm md:col-span-2">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> Email
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">{displayValues.email ?? "-"}</p>
          </article>

          <article className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm md:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">{initial.phone || "Not added"}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={displayValues.phoneVerified ? "default" : "secondary"}
                  className="rounded-full px-3 py-1"
                >
                  {displayValues.phoneVerified
                    ? verificationDate
                      ? `Verified on ${verificationDate}`
                      : "Verified"
                    : "Not Verified"}
                </Badge>
                {!displayValues.phoneVerified && (
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
                        className="rounded-xl border-primary/20 bg-background/90 shadow-sm hover:bg-primary/5"
                      >
                        {sendingOtp ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Sending
                          </>
                        ) : (
                          "Verify WhatsApp"
                        )}
                      </Button>
                    </DialogTrigger>

                    <OtpVerificationDialog
                      open={verifyDialogOpen}
                      onOpenChange={(open) => {
                        setVerifyDialogOpen(open);
                        if (!open) {
                          setOtpSent(false);
                          setOtpCode("");
                        }
                      }}
                      phone={normalizePhone(form.phone)}
                      otpCode={otpCode}
                      onOtpChange={setOtpCode}
                      onVerify={handleVerifyOtp}
                      onResend={handleSendOtp}
                      sendingOtp={sendingOtp}
                      verifyingOtp={verifyingOtp}
                      otpSent={otpSent}
                    />
                  </Dialog>
                )}
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-border/70 bg-background/90 p-4 shadow-sm md:col-span-2">
            <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Address
            </p>
            <p className="mt-2 whitespace-pre-line text-sm font-medium text-foreground">
              {displayValues.addressText}
            </p>
          </article>
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
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {form.phone !== initial.phone ? (
              phoneVerifiedForEdit ? (
                <Badge variant="default" className="rounded-full px-3 py-1">
                  Phone verified
                </Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={async () => {
                    if (!/^\d{10}$/.test(form.phone)) {
                      toast.error("Enter a valid 10-digit phone number first.");
                      return;
                    }

                    await handleSendOtp();
                    setVerifyDialogOpen(true);
                  }}
                  disabled={saving || !/^\d{10}$/.test(form.phone) || sendingOtp}
                >
                  {sendingOtp ? "Sending OTP..." : "Send OTP"}
                </Button>
              )
            ) : (
              <span className="text-xs text-muted-foreground">Current phone number is already verified.</span>
            )}
          </div>
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

      <OtpVerificationDialog
        open={verifyDialogOpen}
        onOpenChange={(open) => {
          setVerifyDialogOpen(open);
          if (!open) {
            setOtpSent(false);
            setOtpCode("");
          }
        }}
        phone={normalizePhone(form.phone)}
        otpCode={otpCode}
        onOtpChange={setOtpCode}
        onVerify={handleVerifyOtp}
        onResend={handleSendOtp}
        sendingOtp={sendingOtp}
        verifyingOtp={verifyingOtp}
        otpSent={otpSent}
      />
    </div>
  );
}
