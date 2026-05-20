"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  User,
  Home,
  CheckCircle2,
  Loader2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

// ── Zod schemas per step ─────────────────────────────────────────────────────
const ownerSchema = z.object({
  fullName: z.string().min(2, "Enter your full name."),
  phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
  addressLine1: z.string().min(5, "Enter address line 1."),
  addressLine2: z.string().max(150).optional(),
  landmark: z.string().max(100).optional(),
  city: z.string().min(2, "Enter your city."),
  state: z.string().min(2, "Enter your state."),
  ownerPincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
});

const hostelSchema = z.object({
  hostelName: z.string().min(2, "Enter your property name."),
  propertyType: z.enum(["pg", "hostel", "coliving", "rental"], {
    errorMap: () => ({ message: "Select a property type." }),
  }),
  address: z.string().min(5, "Enter the full address."),
  hostelCity: z.string().min(2, "Enter city."),
  hostelState: z.string().min(2, "Enter state."),
  pincode: z.string().regex(/^\d{6}$/, "Enter a valid 6-digit pincode."),
  totalRooms: z.coerce
    .number({ invalid_type_error: "Enter a number." })
    .int()
    .min(1, "Must have at least 1 room.")
    .max(9999),
});

type OwnerForm = z.infer<typeof ownerSchema>;
type HostelForm = z.infer<typeof hostelSchema>;

const ONBOARDING_DRAFT_KEY = "nestdesk:onboarding:draft:v1";

type OnboardingDraft = {
  step: 1 | 2;
  ownerData: OwnerForm | null;
  hostelData: Partial<HostelForm> | null;
};

const PROPERTY_TYPES = [
  { value: "pg", label: "PG" },
  { value: "hostel", label: "Hostel" },
  { value: "coliving", label: "Co-living" },
  { value: "rental", label: "Rental" },
] as const;

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  const steps = [
    { icon: User, label: "Your details" },
    { icon: Home, label: "First property" },
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
                  isDone && "border-emerald-400 bg-emerald-400/20 text-emerald-400",
                  isActive &&
                    "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/20",
                  !isDone && !isActive && "border-white/20 bg-white/5 text-white/30",
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
                  isDone && "text-emerald-400",
                  isActive && "text-white/80",
                  !isDone && !isActive && "text-white/30",
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-px w-10 transition-all",
                  isDone ? "bg-emerald-400/50" : "bg-white/10",
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
      <Label className="text-sm font-medium text-foreground/80">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [ownerData, setOwnerData] = useState<OwnerForm | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ownerForm = useForm<OwnerForm>({ resolver: zodResolver(ownerSchema) });
  const hostelForm = useForm<HostelForm>({ resolver: zodResolver(hostelSchema) });

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
    const draft = readDraft();
    if (draft?.ownerData) {
      ownerForm.reset(draft.ownerData);
      setOwnerData(draft.ownerData);
    }

    if (draft?.hostelData) {
      hostelForm.reset(draft.hostelData as HostelForm);
    }

    if (draft?.step === 2 && draft.ownerData) {
      setStep(2);
    }
  }, [hostelForm, ownerForm]);

  useEffect(() => {
    async function prefillFromAuth() {
      if (ownerForm.getValues("fullName")?.trim()) {
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const fullName =
        (user?.user_metadata?.full_name as string | undefined)?.trim() || "";
      if (fullName) {
        ownerForm.setValue("fullName", fullName, { shouldValidate: true });
      }
    }

    prefillFromAuth().catch(() => {
      // Non-blocking: form remains fully manual if auth read fails.
    });
  }, [ownerForm]);

  // Step 1 → Step 2
  async function handleOwnerNext(data: OwnerForm) {
    setOwnerData(data);
    writeDraft({
      step: 2,
      ownerData: data,
      hostelData: hostelForm.getValues(),
    });
    setStep(2);
  }

  // Step 2 → Submit
  async function handleHostelSubmit(data: HostelForm) {
    if (!ownerData) {
      setStep(1);
      return;
    }

    writeDraft({
      step: 2,
      ownerData,
      hostelData: data,
    });

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ownerData, ...data }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Setup failed. Please try again.");
        return;
      }

      clearDraft();
      setStep(3);
      // Small delay so user sees the success step before redirect
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 2000);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950/40 to-slate-950 px-4 py-10">
      {/* Ambient blobs */}
      <div className="pointer-events-none fixed -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none fixed -right-32 bottom-0 h-[400px] w-[400px] rounded-full bg-blue-500/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-lg">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-white">NestDesk</span>
        </div>

        <StepIndicator current={step} />

        {/* ── Step 1: Owner details ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
            <h2 className="mb-1 text-lg font-semibold text-white">
              Tell us about yourself
            </h2>
            <p className="mb-6 text-sm text-white/50">
              This creates your owner profile and stores your complete address for
              KYC.
            </p>
            <form
              onSubmit={ownerForm.handleSubmit(handleOwnerNext)}
              className="space-y-4"
            >
              <Field
                label="Full name"
                error={ownerForm.formState.errors.fullName?.message}
              >
                <Input
                  placeholder="Ahmad Khan"
                  autoComplete="name"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                  {...ownerForm.register("fullName")}
                />
              </Field>

              <Field
                label="Phone number"
                error={ownerForm.formState.errors.phone?.message}
              >
                <div className="flex overflow-hidden rounded-xl border border-white/15 bg-white/10 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30">
                  <span className="flex items-center border-r border-white/15 px-3 text-sm font-medium text-white/70">
                    +91
                  </span>
                  <Input
                    placeholder="9876543210"
                    autoComplete="tel-national"
                    inputMode="numeric"
                    maxLength={10}
                    className="rounded-none border-0 bg-transparent text-white placeholder:text-white/30 focus-visible:ring-0 focus-visible:ring-offset-0"
                    {...ownerForm.register("phone", {
                      setValueAs: (value) =>
                        String(value ?? "")
                          .replace(/\D/g, "")
                          .slice(0, 10),
                    })}
                  />
                </div>
              </Field>

              <Field
                label="Address line 1"
                error={ownerForm.formState.errors.addressLine1?.message}
              >
                <Input
                  placeholder="176/1 Atif Vihar, Opp BBD University"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                  {...ownerForm.register("addressLine1")}
                />
              </Field>

              <Field
                label="Address line 2 (optional)"
                error={ownerForm.formState.errors.addressLine2?.message}
              >
                <Input
                  placeholder="Area / locality"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                  {...ownerForm.register("addressLine2")}
                />
              </Field>

              <Field
                label="Landmark (optional)"
                error={ownerForm.formState.errors.landmark?.message}
              >
                <Input
                  placeholder="Near main gate"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                  {...ownerForm.register("landmark")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="City" error={ownerForm.formState.errors.city?.message}>
                  <Input
                    placeholder="Lucknow"
                    className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                    {...ownerForm.register("city")}
                  />
                </Field>
                <Field
                  label="State"
                  error={ownerForm.formState.errors.state?.message}
                >
                  <Input
                    placeholder="Uttar Pradesh"
                    className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                    {...ownerForm.register("state")}
                  />
                </Field>
              </div>

              <Field
                label="Pincode"
                error={ownerForm.formState.errors.ownerPincode?.message}
              >
                <Input
                  placeholder="226010"
                  maxLength={6}
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                  {...ownerForm.register("ownerPincode")}
                />
              </Field>

              <Button
                type="submit"
                className="mt-2 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </div>
        )}

        {/* ── Step 2: First property ──────────────────────────────────────── */}
        {step === 2 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/30 backdrop-blur-xl">
            <h2 className="mb-1 text-lg font-semibold text-white">
              Add your first property
            </h2>
            <p className="mb-6 text-sm text-white/50">
              You can add more properties from the dashboard later.
            </p>
            <form
              onSubmit={hostelForm.handleSubmit(handleHostelSubmit)}
              className="space-y-4"
            >
              <Field
                label="Property name"
                error={hostelForm.formState.errors.hostelName?.message}
              >
                <Input
                  placeholder="Sunrise PG for Boys"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                  {...hostelForm.register("hostelName")}
                />
              </Field>

              {/* Property type selector */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-foreground/80">
                  Property type
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {PROPERTY_TYPES.map((pt) => (
                    <label key={pt.value} className="cursor-pointer">
                      <input
                        type="radio"
                        value={pt.value}
                        className="peer sr-only"
                        {...hostelForm.register("propertyType")}
                      />
                      <div className="rounded-xl border border-white/15 bg-white/5 px-2 py-2 text-center text-xs font-medium text-white/50 transition-all peer-checked:border-primary peer-checked:bg-primary/20 peer-checked:text-white hover:border-white/30 hover:text-white/80">
                        {pt.label}
                      </div>
                    </label>
                  ))}
                </div>
                {hostelForm.formState.errors.propertyType && (
                  <p className="text-xs text-destructive">
                    {hostelForm.formState.errors.propertyType.message}
                  </p>
                )}
              </div>

              <Field
                label="Full address"
                error={hostelForm.formState.errors.address?.message}
              >
                <Input
                  placeholder="Plot 12, Sector 5, Near Station"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                  {...hostelForm.register("address")}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="City"
                  error={hostelForm.formState.errors.hostelCity?.message}
                >
                  <Input
                    placeholder="Mumbai"
                    className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                    {...hostelForm.register("hostelCity")}
                  />
                </Field>
                <Field
                  label="State"
                  error={hostelForm.formState.errors.hostelState?.message}
                >
                  <Input
                    placeholder="Maharashtra"
                    className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                    {...hostelForm.register("hostelState")}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Pincode"
                  error={hostelForm.formState.errors.pincode?.message}
                >
                  <Input
                    placeholder="400001"
                    maxLength={6}
                    className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                    {...hostelForm.register("pincode")}
                  />
                </Field>
                <Field
                  label="Total rooms"
                  error={hostelForm.formState.errors.totalRooms?.message}
                >
                  <Input
                    type="number"
                    placeholder="24"
                    min={1}
                    className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary"
                    {...hostelForm.register("totalRooms")}
                  />
                </Field>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1 rounded-xl border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => {
                    writeDraft({
                      step: 1,
                      ownerData: ownerForm.getValues(),
                      hostelData: hostelForm.getValues(),
                    });
                    setStep(1);
                  }}
                  disabled={submitting}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30"
                  disabled={submitting}
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
              </div>
            </form>
          </div>
        )}

        {/* ── Step 3: Success ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center shadow-xl shadow-black/30 backdrop-blur-xl">
            <div className="mb-4 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-bold text-white">
              You&apos;re all set! 🎉
            </h2>
            <p className="mb-2 text-sm text-white/60">
              Your property has been added. Taking you to the dashboard…
            </p>
            <Loader2 className="mx-auto h-4 w-4 animate-spin text-white/30" />
          </div>
        )}
      </div>
    </div>
  );
}
