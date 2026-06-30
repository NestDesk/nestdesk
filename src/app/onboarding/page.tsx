"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";
import { createClient as createBrowserSupabaseClient } from "../../lib/supabase/client";
import { TopBar } from "../../components/layout/TopBar";
import { OtpVerificationDialog } from "../../components/ui/otp-verification-dialog";

// ── Zod schemas per step ─────────────────────────────────────────────────────
const ownerSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
  addressLine1: z.string().min(5, "Enter address line 1."),
  addressLine2: z.string().max(150).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2, "Enter your city."),
  state: z.string().min(2, "Enter your state."),
  ownerPincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
});

type OwnerForm = z.infer<typeof ownerSchema>;

const ONBOARDING_DRAFT_KEY = "nestdesk:onboarding:draft:v1";

type OnboardingDraft = {
  step: 1;
  ownerData: OwnerForm | null;
};

type OnboardingPrefillResponse = {
  success: boolean;
  ownerName?: string;
  onboardingCompleted: boolean;
  ownerData: OwnerForm | null;
  redirectTo?: string;
};

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = [
    { icon: CheckCircle2, label: "Your details" },
    { icon: CheckCircle2, label: "All set" },
  ];

  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {steps.map(({ icon: Icon, label }, i) => {
        const stepNum = i + 1;
        const isDone = current > stepNum;
        const isActive = current === stepNum;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                  isDone &&
                    "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                  isActive && "border-primary bg-primary/10 text-primary",
                  !isDone &&
                    !isActive &&
                    "border-border bg-muted text-muted-foreground",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium",
                  isDone && "text-emerald-600 dark:text-emerald-400",
                  isActive && "text-foreground",
                  !isDone && !isActive && "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-px w-10 transition-all",
                  isDone ? "bg-emerald-500/40" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Reusable field wrapper ────────────────────────────────────────────────────
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [reqId, setReqId] = useState("");
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [ownerName, setOwnerName] = useState("Owner");
  const [bootstrapping, setBootstrapping] = useState(true);
  const [pincodeLookupError, setPincodeLookupError] = useState<string | null>(null);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  const bootstrappedRef = useRef(false);

  const ownerForm = useForm<OwnerForm>({ resolver: zodResolver(ownerSchema) });

  function readDraft(): OnboardingDraft | null {
    try {
      const raw = localStorage.getItem(ONBOARDING_DRAFT_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as OnboardingDraft;
    } catch {
      return null;
    }
  }

  function writeDraft(next: OnboardingDraft) {
    localStorage.setItem(ONBOARDING_DRAFT_KEY, JSON.stringify(next));
  }

  function clearDraft() {
    localStorage.removeItem(ONBOARDING_DRAFT_KEY);
  }

  useEffect(() => {
    if (bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;

    async function bootstrap() {
      try {
        const draft = readDraft();

        const supabase = createBrowserSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const fullName =
          (user?.user_metadata?.full_name as string | undefined)?.trim() || "";
        const fallbackName =
          user?.email?.split("@")[0]?.trim() ||
          (user?.user_metadata?.name as string | undefined)?.trim() ||
          "Owner";
        setOwnerName(fullName || fallbackName);

        const prefillRes = await fetch("/api/onboarding", {
          method: "GET",
          cache: "no-store",
        });

        if (prefillRes.status === 401) {
          router.replace("/login");
          return;
        }

        if (!prefillRes.ok) {
          throw new Error("Failed to fetch onboarding data.");
        }

        const prefill = (await prefillRes.json()) as OnboardingPrefillResponse;

        if (prefill.ownerName?.trim()) {
          setOwnerName(prefill.ownerName.trim());
        }

        if (prefill.onboardingCompleted) {
          clearDraft();
          router.replace(prefill.redirectTo ?? "/dashboard");
          return;
        }

        const mergedOwnerData = draft?.ownerData ?? prefill.ownerData;

        if (mergedOwnerData) {
          ownerForm.reset(mergedOwnerData);
        }
      } catch {
        toast.error("Could not prefill onboarding. Please continue manually.");
      } finally {
        setBootstrapping(false);
      }
    }

    bootstrap().catch(() => {
      setBootstrapping(false);
    });
  }, [ownerForm, router]);

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
        throw new Error(json.error ?? "Lookup failed.");
      }

      ownerForm.setValue(
        "city",
        String(json.city ?? ownerForm.getValues("city")).trim(),
      );
      ownerForm.setValue(
        "state",
        String(json.state ?? ownerForm.getValues("state")).trim(),
      );
    } catch (error) {
      setPincodeLookupError(
        error instanceof Error
          ? error.message
          : "Unable to resolve this pincode to city/state.",
      );
    } finally {
      setPincodeLookupLoading(false);
    }
  }

  async function handleSendOtp() {
    const phoneValue = ownerForm.getValues("phone")?.replace(/\D/g, "") ?? "";

    if (!/^\d{10}$/.test(phoneValue)) {
      toast.error("Enter a valid 10-digit phone number before requesting OTP.");
      return;
    }

    setSendingOtp(true);
    try {
      const response = await fetch("/api/auth/phone-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue, purpose: "register-owner-phone" }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "Could not send OTP.");
        return;
      }

      setOtpCode("");
      setOtpSent(true);
      if (json.reqId) setReqId(json.reqId);
      setPhoneVerified(false);
      setOtpDialogOpen(true);
      toast.success(json.message ?? "OTP sent to your WhatsApp number.");
      if (json.devOtpHint) {
        toast.success(`DEV OTP: ${json.devOtpHint}`);
      }
    } catch {
      toast.error("Network error while sending OTP.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const phoneValue = ownerForm.getValues("phone")?.replace(/\D/g, "") ?? "";

    if (!/^\d{10}$/.test(phoneValue)) {
      toast.error("Enter a valid 10-digit phone number first.");
      return;
    }

    // Validate OTP code - must be exactly 6 digits
    const cleanedOtpCode = (otpCode ?? "").trim().replace(/\D/g, "");
    if (cleanedOtpCode.length !== 6) {
      toast.error("Enter the 6-digit OTP code.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await fetch("/api/auth/phone-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue, otpCode: cleanedOtpCode, reqId, purpose: "register-owner-phone" }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "OTP verification failed.");
        return;
      }

      setPhoneVerified(true);
      setOtpCode("");
      setOtpSent(false);
      setOtpDialogOpen(false);
      toast.success("Phone number verified successfully.");
    } catch {
      toast.error("Network error while verifying OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleOwnerSubmit(data: OwnerForm) {
    if (!phoneVerified) {
      await handleSendOtp();
      return;
    }

    writeDraft({ step: 1, ownerData: data });

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, phoneVerified }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Setup failed. Please try again.");
        return;
      }

      clearDraft();
      setStep(2);
      // Small delay so user sees the success step before redirect
      setTimeout(() => {
        router.push(json.redirectTo ?? "/dashboard");
      }, 2000);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const welcomeName = ownerName.trim() || "Owner";
  const ownerInitial = welcomeName.charAt(0).toUpperCase();

  if (bootstrapping) {
    return (
      <div className="min-h-screen bg-background px-4 pt-6">
        <div className="mx-auto flex h-[70vh] w-full max-w-lg items-center justify-center rounded-2xl border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading onboarding...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 pb-8">
      <TopBar title="Onboarding" />

      <div className="relative z-10 mt-2 mx-auto w-full max-w-lg">
        <StepIndicator current={step} />

        {/* ── Step 1: Owner details ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-6 rounded-2xl border bg-muted/40 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-1 ring-primary/30">
                  {ownerInitial}
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Welcome
                  </p>
                  <p className="text-base font-semibold text-foreground">
                    {welcomeName}{" "}
                    <span className="text-muted-foreground">(Owner)</span>
                  </p>
                </div>
              </div>
            </div>

            <h4 className="mb-1 text-md font-semibold text-foreground">
              Tell us about your details
            </h4>
            <div className="my-4 h-px w-full bg-border" />
            <form
              onSubmit={ownerForm.handleSubmit(handleOwnerSubmit)}
              className="space-y-4"
            >
              <Field
                label="Phone number"
                error={ownerForm.formState.errors.phone?.message}
              >
                <div className="flex overflow-hidden rounded-xl border bg-background transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <span className="flex items-center border-r border-border px-3 text-sm font-medium text-muted-foreground">
                    +91
                  </span>
                  <Input
                    type="tel"
                    placeholder="9876543210"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    className="rounded-none border-0 bg-transparent text-foreground placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...ownerForm.register("phone", {
                      setValueAs: (value) =>
                        String(value ?? "")
                          .replace(/\D/g, "")
                          .slice(0, 10),
                      onChange: (event) => {
                        const target = event.target as HTMLInputElement;
                        target.value = target.value.replace(/\D/g, "").slice(0, 10);
                        setPhoneVerified(false);
                        setOtpSent(false);
                      },
                    })}
                  />
                </div>
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">
                    {phoneVerified
                      ? "Phone verified ✅"
                      : "A WhatsApp OTP prompt will appear when you finish setup."}
                  </span>
                </div>
              </Field>


              <Field
                label="Address line 1"
                error={ownerForm.formState.errors.addressLine1?.message}
              >
                <Input
                  placeholder="176/1 Atif Vihar, Opp BBD University"
                  className="rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
                  {...ownerForm.register("addressLine1")}
                />
              </Field>

              <Field
                label="Address line 2 (optional)"
                error={ownerForm.formState.errors.addressLine2?.message}
              >
                <Input
                  placeholder="Area / locality"
                  className="rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
                  {...ownerForm.register("addressLine2")}
                />
              </Field>

              <Field
                label="Landmark (optional)"
                error={ownerForm.formState.errors.landmark?.message}
              >
                <Input
                  placeholder="Near main gate"
                  className="rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
                  {...ownerForm.register("landmark")}
                />
              </Field>

              <Field
                label="Pincode"
                error={
                  ownerForm.formState.errors.ownerPincode?.message ||
                  pincodeLookupError ||
                  undefined
                }
              >
                <Input
                  placeholder="226010"
                  maxLength={6}
                  className="rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
                  {...ownerForm.register("ownerPincode", {
                    setValueAs: (value) =>
                      String(value ?? "")
                        .replace(/\D/g, "")
                        .slice(0, 6),
                    onChange: (event) => {
                      const value = String(
                        (event.target as HTMLInputElement).value ?? "",
                      );
                      const digits = value.replace(/\D/g, "");
                      if (digits.length === 6) {
                        lookupPincodeLocation(digits);
                      }
                    },
                  })}
                />
                {pincodeLookupLoading ? (
                  <p className="text-xs text-muted-foreground">
                    Loading city and state...
                  </p>
                ) : null}
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="City" error={ownerForm.formState.errors.city?.message}>
                  <Input
                    disabled={true}
                    placeholder="Lucknow"
                    className="rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
                    {...ownerForm.register("city")}
                  />
                </Field>
                <Field
                  label="State"
                  error={ownerForm.formState.errors.state?.message}
                >
                  <Input
                    disabled={true}
                    placeholder="Uttar Pradesh"
                    className="rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:border-primary"
                    {...ownerForm.register("state")}
                  />
                </Field>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="mt-2 w-full rounded-xl font-semibold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Finish setup
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <OtpVerificationDialog
              open={otpDialogOpen}
              onOpenChange={(open) => {
                setOtpDialogOpen(open);
                if (!open) {
                  setOtpCode("");
                }
              }}
              phone={ownerForm.getValues("phone")?.replace(/\D/g, "") ?? ""}
              otpCode={otpCode}
              onOtpChange={setOtpCode}
              onVerify={handleVerifyOtp}
              onResend={handleSendOtp}
              sendingOtp={sendingOtp}
              verifyingOtp={verifyingOtp}
              otpSent={otpSent}
            />
          </div>
        )}

        {/* ── Step 2: Success ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="rounded-2xl border border-emerald-500/20 bg-card p-8 text-center shadow-sm">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-bold text-foreground">
              You&apos;re all set! 🎉
            </h2>
            <p className="mb-2 text-sm text-muted-foreground">
              Your owner profile is ready. Taking you to the dashboard...
            </p>
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
