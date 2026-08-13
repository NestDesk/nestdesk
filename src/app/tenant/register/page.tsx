"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
  InfoIcon,
  Loader2,
  MapPin,
  Trash2,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Navbar, NavbarLogo } from "../../../components/layout/Navbar";
import { ThemeToggle } from "../../../components/layout/ThemeToggle";
import { isValidAadhaarNumber, normalizeAadhaarNumber } from "../../../lib/aadhaar";
import { TenantConsentLink } from "../../../components/legal/TenantConsentLink";
import { OtpVerificationDialog } from "../../../components/ui/otp-verification-dialog";
import { EmailOtpVerificationDialog } from "../../../components/ui/email-otp-verification-dialog";
import { ValidationChecklist } from "../../../components/auth/ValidationChecklist";
import { UploadDocType, processImageForUpload } from "../../../lib/image-upload";
import { cn } from "../../../lib/utils";

// ── Validation ────────────────────────────────────────────────────────────────

const tenantRegisterSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Enter your full name (at least 2 characters).")
      .refine((value) => !/\d/.test(value), {
        message: "Full name cannot contain numbers.",
      }),
    email: z.string().email("Enter a valid email address."),
    phone: z.string().regex(/^\d{10}$/, "Enter a valid 10-digit phone number."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Add at least one uppercase letter.")
      .regex(/[a-z]/, "Add at least one lowercase letter.")
      .regex(/[0-9]/, "Add at least one number."),
    occupationType: z.enum(
      ["student", "working_professional", "business", "other"],
      {
        message: "Select your occupation type.",
      },
    ),
    institutionName: z
      .string()
      .min(2, "Enter your institution or company name.")
      .max(120),
    gender: z.enum(["male", "female", "rather_not_say"], {
      message: "Select your gender option.",
    }),
    govtIdType: z.enum(
      ["Aadhaar", "PAN", "Voter ID card", "Passport", "Driving license"],
      {
        message: "Select your government ID type.",
      },
    ).optional(),
    govtIdNumber: z
      .string()
      .min(1, "Enter your government ID number.")
      .max(80, "Government ID number is too long.")
      .optional()
      .or(z.literal("",)),
    aadharNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((v) => !v || (/^\d{12}$/.test(v) && isValidAadhaarNumber(v)), {
        message: "Enter a valid 12-digit Aadhaar number.",
      }),
    confirmPassword: z.string(),
    consentGiven: z.boolean().refine((v) => v === true, {
      message: "You must agree to the privacy policy to continue.",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type TenantRegisterForm = z.infer<typeof tenantRegisterSchema>;

// ── Password strength ─────────────────────────────────────────────────────────

interface StrengthRule {
  label: string;
  test: (v: string) => boolean;
}

const STRENGTH_RULES: StrengthRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "Uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { label: "Lowercase letter (a–z)", test: (v) => /[a-z]/.test(v) },
  { label: "Number (0–9)", test: (v) => /[0-9]/.test(v) },
];

const STRENGTH_COLORS = [
  "",
  "bg-red-500",
  "bg-red-400",
  "bg-amber-400",
  "bg-emerald-400",
];

function normalizePhoneNumber(value: string) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 10);
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const passed = STRENGTH_RULES.filter((r) => r.test(password)).length;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex gap-1">
        {STRENGTH_RULES.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-300",
              i < passed ? STRENGTH_COLORS[passed] : "bg-muted-foreground/20",
            )}
          />
        ))}
      </div>
      <ul className="space-y-1">
        {STRENGTH_RULES.map((rule) => {
          const ok = rule.test(password);
          return (
            <li key={rule.label} className="flex items-center gap-1.5 text-xs">
              {ok ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
              <span
                className={ok ? "text-muted-foreground" : "text-muted-foreground/70"}
              >
                {rule.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── Hostel info banner ────────────────────────────────────────────────────────

type HostelInfo = {
  id: string;
  name: string;
  property_type: string;
  address: string;
  city: string;
  state: string;
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  pg: "PG / Paying Guest",
  hostel: "Hostel",
  coliving: "Co-living Space",
  rental: "Rental Property",
};

const OCCUPATION_LABELS: Record<string, string> = {
  student: "Student",
  working_professional: "Working Professional",
  business: "Business",
  other: "Other",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  rather_not_say: "Rather not say",
};

const GOVT_ID_OPTIONS = [
  "Aadhaar",
  "PAN",
  "Voter ID card",
  "Passport",
  "Driving license",
];

function PropertyBanner({ hostel }: { hostel: HostelInfo }) {
  const address = [hostel.address, hostel.city, hostel.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-popover/80 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
        <Home className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground leading-snug">
          {hostel.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {PROPERTY_TYPE_LABELS[hostel.property_type] ?? hostel.property_type}
        </p>
        <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground/70">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="break-words">{address}</span>
        </p>
      </div>
    </div>
  );
}

function DocumentUploadCard({
  label,
  required = false,
  value,
  preview,
  error,
  onChange,
  onRemove,
}: {
  label: string;
  required?: boolean;
  value: File | null;
  preview: string | null;
  error?: string | null;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-foreground/80">
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </Label>

      <div className="group relative">
        <label className="relative block cursor-pointer overflow-hidden rounded-2xl border border-dashed border-border bg-background/80 p-2 transition-all duration-200 hover:border-primary/60 hover:bg-primary/5">
          <input type="file" accept="image/*" onChange={onChange} className="sr-only" />

          {preview ? (
            <div className="relative h-32 overflow-hidden rounded-xl bg-muted/40">
              <img
                src={preview}
                alt={label}
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-slate-950/75 via-slate-900/25 to-transparent px-3 py-2 text-center text-[11px] font-medium text-white">
                {value ? "Replace image" : "Upload image"}
              </div>
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/20 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path d="M12 16V4m0 0 3.5 3.5M12 4 8.5 7.5M4 15.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Upload image</p>
                <p className="text-xs text-muted-foreground">PNG, JPG, or JPEG</p>
              </div>
            </div>
          )}
        </label>

        {preview ? (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            onClick={(event) => {
              event.preventDefault();
              onRemove();
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-slate-950/70 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TenantRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <TenantRegisterPageContent />
    </Suspense>
  );
}

function TenantRegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token") ?? "";
  const hostelId = searchParams.get("hostel") ?? "";

  const [hostel, setHostel] = useState<HostelInfo | null>(null);
  const [hostelError, setHostelError] = useState<string | null>(null);
  const [hostelLoading, setHostelLoading] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [reqId, setReqId] = useState("");
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false);
  const [verifyingEmailOtp, setVerifyingEmailOtp] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [emailOtpDialogOpen, setEmailOtpDialogOpen] = useState(false);
  const [govtIdFrontFile, setGovtIdFrontFile] = useState<File | null>(null);
  const [govtIdBackFile, setGovtIdBackFile] = useState<File | null>(null);
  const [alternateIdFile, setAlternateIdFile] = useState<File | null>(null);
  const [govtIdFrontPreview, setGovtIdFrontPreview] = useState<string | null>(null);
  const [govtIdBackPreview, setGovtIdBackPreview] = useState<string | null>(null);
  const [alternateIdPreview, setAlternateIdPreview] = useState<string | null>(null);
  const [idFrontError, setIdFrontError] = useState<string | null>(null);
  const [idBackError, setIdBackError] = useState<string | null>(null);

  useEffect(() => {
    if (!govtIdFrontFile) {
      setGovtIdFrontPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(govtIdFrontFile);
    setGovtIdFrontPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [govtIdFrontFile]);

  useEffect(() => {
    if (!govtIdBackFile) {
      setGovtIdBackPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(govtIdBackFile);
    setGovtIdBackPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [govtIdBackFile]);

  useEffect(() => {
    if (!alternateIdFile) {
      setAlternateIdPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(alternateIdFile);
    setAlternateIdPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [alternateIdFile]);

  // Validate token + fetch hostel info
  useEffect(() => {
    if (!token || !hostelId) {
      setHostelError(
        "Invalid invite link. Please scan the QR code or click your invite link again.",
      );
      setHostelLoading(false);
      return;
    }

    fetch(`/api/join/${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((json: { hostel?: HostelInfo; error?: string }) => {
        if (json.hostel) {
          setHostel(json.hostel);
        } else {
          setHostelError(json.error ?? "Property not found.");
        }
      })
      .catch(() =>
        setHostelError("Could not verify invite link. Check your connection."),
      )
      .finally(() => setHostelLoading(false));
  }, [token, hostelId]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenantRegisterForm>({
    resolver: zodResolver(tenantRegisterSchema),
    defaultValues: {
      consentGiven: false,
      occupationType: "student",
      gender: "male",
    },
  });

  const selectedGovtIdType = watch("govtIdType") || "";
  const govtIdNumberLabel = selectedGovtIdType
    ? `${selectedGovtIdType} number`
    : "Government ID number";
  const govtIdNumberPlaceholder = selectedGovtIdType
    ? `Enter your ${selectedGovtIdType} number`
    : "Enter your ID number";
  const govtFrontLabel = selectedGovtIdType
    ? `${selectedGovtIdType} front photo`
    : "ID front photo";
  const govtBackLabel = selectedGovtIdType
    ? `${selectedGovtIdType} back photo`
    : "ID back photo";
  const alternateGovtLabel = selectedGovtIdType
    ? `Alternate ${selectedGovtIdType} photo`
    : "Alternate ID photo";

  useEffect(() => {
    const sub = watch((v) => setPasswordValue(v.password ?? ""));
    return () => sub.unsubscribe();
  }, [watch]);

  async function handleSendOtp() {
    const phoneValue = normalizePhoneNumber(watch("phone") ?? "");
    if (!/^\d{10}$/.test(phoneValue)) {
      toast.error("Enter a valid 10-digit phone number before requesting OTP.");
      return;
    }

    setSendingOtp(true);
    try {
      const response = await fetch("/api/tenant/phone-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "Could not send OTP.");
        return;
      }

      setOtpSent(true);
      if (json.reqId) setReqId(json.reqId);
      setOtpCode("");
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

  async function handleRetryOtp() {
    if (!reqId) {
      return handleSendOtp();
    }
    setSendingOtp(true);
    try {
      const response = await fetch("/api/tenant/phone-otp/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reqId, retryChannel: "12" }),
      });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error ?? "Could not retry OTP.");
        return;
      }
      toast.success("OTP resent via WhatsApp successfully.");
    } catch {
      toast.error("Network error while retrying OTP.");
    } finally {
      setSendingOtp(false);
    }
  }

  async function handleVerifyOtp() {
    const phoneValue = normalizePhoneNumber(watch("phone") ?? "");
    if (!/^\d{10}$/.test(phoneValue)) {
      toast.error("Enter a valid 10-digit phone number first.");
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Enter the 6-digit OTP code.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await fetch("/api/tenant/phone-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue, otpCode, reqId }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "OTP verification failed.");
        return;
      }

      setPhoneVerified(true);
      setOtpCode("");
      setOtpDialogOpen(false);
      toast.success("Phone number verified successfully.");
    } catch {
      toast.error("Network error while verifying OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  // ── Email OTP verification (before submit) ────────────────────────────────

  async function handleSendEmailOtp() {
    const emailValue = watch("email") ?? "";
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      toast.error("Enter a valid email address before requesting OTP.");
      return;
    }

    setSendingEmailOtp(true);
    try {
      const response = await fetch("/api/auth/email-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "Could not send email OTP.");
        return;
      }

      setEmailOtpSent(true);
      setEmailOtpCode("");
      setEmailOtpDialogOpen(true);
      toast.success(json.message ?? "OTP sent to your email.");
      if (json.devOtpHint) {
        toast.success(`DEV OTP: ${json.devOtpHint}`);
      }
    } catch {
      toast.error("Network error while sending email OTP.");
    } finally {
      setSendingEmailOtp(false);
    }
  }

  async function handleVerifyEmailOtp() {
    const emailValue = watch("email") ?? "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      toast.error("Enter a valid email address first.");
      return;
    }
    
    // Validate email OTP code - must be exactly 6 digits
    const cleanedEmailOtpCode = (emailOtpCode ?? "").trim().replace(/\D/g, "");
    if (cleanedEmailOtpCode.length !== 6) {
      toast.error("Enter the 6-digit email OTP code (received in your email).");
      return;
    }

    setVerifyingEmailOtp(true);
    try {
      const response = await fetch("/api/auth/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue,
          otpCode: cleanedEmailOtpCode,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "Email OTP verification failed.");
        return;
      }

      setEmailVerified(true);
      setEmailOtpCode("");
      setEmailOtpDialogOpen(false);
      toast.success("Email verified successfully.");
    } catch {
      toast.error("Network error while verifying email OTP.");
    } finally {
      setVerifyingEmailOtp(false);
    }
  }

  async function handleResendEmailOtp() {
    const emailValue = watch("email") ?? "";
    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      toast.error("Enter a valid email address first.");
      return;
    }

    setSendingEmailOtp(true);
    try {
      const response = await fetch("/api/auth/email-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailValue }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "Could not resend email OTP.");
        return;
      }

      setEmailOtpSent(true);
      setEmailOtpCode("");
      toast.success(json.message ?? "OTP resent to your email.");
    } catch {
      toast.error("Network error while resending email OTP.");
    } finally {
      setSendingEmailOtp(false);
    }
  }

  const [registeringTenant, setRegisteringTenant] = useState(false);

  async function uploadSignupDocument(
    docType: Exclude<UploadDocType, "profile_photo">,
    file: File,
  ) {
    const processed = await processImageForUpload(file, docType);
    const formData = new FormData();
    formData.append("docType", docType);
    formData.append("file", processed);

    const response = await fetch("/api/tenant/profile/upload", {
      method: "POST",
      body: formData,
    });
    const json = await response.json();

    if (!response.ok) {
      throw new Error(json.error ?? "Could not upload document.");
    }
  }

  async function onSubmit(data: TenantRegisterForm) {
    if (!phoneVerified) {
      toast.error("Verify your phone number before creating the tenant account.");
      return;
    }

    if (!emailVerified) {
      toast.error("Verify your email address before creating the tenant account.");
      return;
    }

    let hasError = false;

    if (!govtIdFrontFile) {
      setIdFrontError("ID front photo is required.");
      hasError = true;
    } else {
      setIdFrontError(null);
    }

    if (!govtIdBackFile) {
      setIdBackError("ID back photo is required.");
      hasError = true;
    } else {
      setIdBackError(null);
    }

    if (hasError) {
      toast.error("Please upload your ID front and back photos to continue.");
      return;
    }

    setRegisteringTenant(true);
    try {
      const response = await fetch("/api/tenant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          hostelId,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          phoneVerified,
          password: data.password,
          occupationType: data.occupationType,
          institutionName: data.institutionName,
          gender: data.gender,
          govtIdType: data.govtIdType || (data.aadharNumber ? "Aadhaar" : ""),
          govtIdNumber: data.govtIdNumber || data.aadharNumber || "",
          aadharNumber: data.aadharNumber
            ? normalizeAadhaarNumber(data.aadharNumber)
            : "",
          consentGiven: data.consentGiven,
        }),
      });
      const json = await response.json();

      if (!response.ok) {
        toast.error(json.error ?? "Failed to create tenant account.");
        return;
      }

      // Upload documents in background (don't wait for completion)
      // This keeps the redirect instant while uploads continue in parallel
      const documentUploads = [
        uploadSignupDocument("govt_id_front", govtIdFrontFile!),
        uploadSignupDocument("govt_id_back", govtIdBackFile!),
      ];

      if (alternateIdFile) {
        documentUploads.push(uploadSignupDocument("alternate_id", alternateIdFile));
      }

      Promise.all(documentUploads).catch((err) => {
        // Log silently; the account was already created successfully
        console.error("Background document upload failed:", err);
      });

      toast.success(json.message ?? "Account created successfully. Uploading documents…");
      router.replace(json.redirectTo ?? "/tenant/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Your account was created but one of the document uploads failed.",
      );
    } finally {
      setRegisteringTenant(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (hostelLoading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-foreground px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Verifying invite…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (hostelError || !hostel) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background text-foreground px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-destructive/20 text-destructive">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Invalid Invite Link</h2>
          <p className="text-sm text-muted-foreground">{hostelError}</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/join">Try entering your property code</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Register form ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="animate-blob pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" />
      <div className="animate-blob-delay-2 pointer-events-none absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-500/15 blur-3xl" />

      <Navbar
        left={<NavbarLogo />}
        right={
          <>
            <ThemeToggle />
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm" className="rounded-xl">
                Sign in
              </Button>
            </Link>
          </>
        }
      />

      <div className="relative z-10 flex flex-1 items-start justify-center px-4 py-10">
        <Card className="w-full max-w-md rounded-3xl border border-border bg-card shadow-2xl shadow-black/10 backdrop-blur-2xl dark:shadow-black/30">
          <CardHeader className="space-y-4 pb-4 pt-8">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400 glow-ring">
                <Home className="h-7 w-7 text-white drop-shadow" />
              </div>
            </div>
            <div className="text-center">
              <CardTitle className="text-2xl font-bold text-foreground">
                Create Tenant Account
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Register to live at this property
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Property banner */}
              <PropertyBanner hostel={hostel} />

              {/* Full name */}
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-foreground/80">
                  Full name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  autoComplete="name"
                  className="rounded-xl border-border bg-popover/80 text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20"
                  {...register("fullName")}
                />
                {errors.fullName && (
                  <p className="text-xs text-red-400">{errors.fullName.message}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-foreground/80">
                  Phone number
                </Label>
                <div className="flex overflow-hidden rounded-xl border border-border bg-popover/80 text-foreground focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary">
                  <span className="flex items-center px-3 text-sm text-muted-foreground">
                    +91
                  </span>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="1234567890"
                    autoComplete="tel-national"
                    maxLength={10}
                    disabled={phoneVerified}
                    className="min-w-0 flex-1 rounded-none border-none bg-transparent px-2 text-foreground placeholder:text-muted-foreground/60 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-80"
                    {...register("phone", {
                      onChange: (event) => {
                        const value = normalizePhoneNumber(event.target.value);
                        event.target.value = value;
                        setValue("phone", value, { shouldValidate: true });
                      },
                    })}
                  />
                </div>
                {errors.phone && (
                  <p className="text-xs text-red-400">{errors.phone.message}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {phoneVerified ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Phone verified
                    </span>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSendOtp}
                        disabled={sendingOtp || !watch("phone") || !/^\d{10}$/.test(normalizePhoneNumber(watch("phone") ?? ""))}
                      >
                        <span className="inline-flex items-center gap-2">
                          <InfoIcon color="orange" />
                          Verify phone number
                        </span>
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Use the OTP dialog to send and verify your code.
                      </span>
                    </>
                  )}
                </div>

              </div>

              {/* Occupation */}
              <div className="space-y-1.5">
                <Label htmlFor="occupationType" className="text-foreground/80">
                  Occupation type
                </Label>
                <select
                  id="occupationType"
                  className="block h-10 w-full rounded-xl border border-border bg-popover/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register("occupationType")}
                >
                  {Object.entries(OCCUPATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value} className="text-black">
                      {label}
                    </option>
                  ))}
                </select>
                {errors.occupationType && (
                  <p className="text-xs text-red-400">
                    {errors.occupationType.message}
                  </p>
                )}
              </div>

              {/* Institution */}
              <div className="space-y-1.5">
                <Label htmlFor="institutionName" className="text-foreground/80">
                  Institution name
                </Label>
                <Input
                  id="institutionName"
                  type="text"
                  placeholder="College / company / organization"
                  className="rounded-xl border-border bg-popover/80 text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20"
                  {...register("institutionName")}
                />
                {errors.institutionName && (
                  <p className="text-xs text-red-400">
                    {errors.institutionName.message}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <Label htmlFor="gender" className="text-foreground/80">
                  Gender
                </Label>
                <select
                  id="gender"
                  className="h-10 w-full rounded-xl border border-border bg-popover/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register("gender")}
                >
                  {Object.entries(GENDER_LABELS).map(([value, label]) => (
                    <option key={value} value={value} className="text-black">
                      {label}
                    </option>
                  ))}
                </select>
                {errors.gender && (
                  <p className="text-xs text-red-400">{errors.gender.message}</p>
                )}
              </div>

              {/* Government ID */}
              <div className="space-y-1.5">
                <Label htmlFor="govtIdType" className="text-foreground/80">
                  Government ID type{" "}
                 
                </Label>
                <select
                  id="govtIdType"
                  className="h-10 w-full rounded-xl border border-border bg-popover/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  {...register("govtIdType")}
                >
                  <option value="">Select ID type</option>
                  {GOVT_ID_OPTIONS.map((option) => (
                    <option key={option} value={option} className="text-black">
                      {option}
                    </option>
                  ))}
                </select>
                {errors.govtIdType && (
                  <p className="text-xs text-red-400">{errors.govtIdType.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="govtIdNumber" className="text-foreground/80">
                  {govtIdNumberLabel}{" "}
                  <span className="text-muted-foreground/70 font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="govtIdNumber"
                  type="text"
                  placeholder={govtIdNumberPlaceholder}
                  className="rounded-xl border-border bg-popover/80 text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20"
                  {...register("govtIdNumber", {
                    onChange: (e) => {
                      const value = e.target.value;
                      setValue("govtIdNumber", value, { shouldValidate: true });
                      if (watch("govtIdType") === "Aadhaar") {
                        setValue("aadharNumber", normalizeAadhaarNumber(value), { shouldValidate: true });
                      }
                    },
                  })}
                />
                {errors.govtIdNumber && (
                  <p className="text-xs text-red-400">{errors.govtIdNumber.message}</p>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-popover/80 p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Upload ID documents</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Front and back photos are required</p>
                </div>
                <DocumentUploadCard
                  label={govtFrontLabel}
                  required
                  value={govtIdFrontFile}
                  preview={govtIdFrontPreview}
                  error={idFrontError}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setGovtIdFrontFile(event.target.files?.[0] ?? null);
                    setIdFrontError(null);
                  }}
                  onRemove={() => {
                    setGovtIdFrontFile(null);
                    setGovtIdFrontPreview(null);
                    setIdFrontError(null);
                  }}
                />
                <DocumentUploadCard
                  label={govtBackLabel}
                  required
                  value={govtIdBackFile}
                  preview={govtIdBackPreview}
                  error={idBackError}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setGovtIdBackFile(event.target.files?.[0] ?? null);
                    setIdBackError(null);
                  }}
                  onRemove={() => {
                    setGovtIdBackFile(null);
                    setGovtIdBackPreview(null);
                    setIdBackError(null);
                  }}
                />
                <DocumentUploadCard
                  label={alternateGovtLabel}
                  value={alternateIdFile}
                  preview={alternateIdPreview}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                    setAlternateIdFile(event.target.files?.[0] ?? null);
                  }}
                  onRemove={() => {
                    setAlternateIdFile(null);
                    setAlternateIdPreview(null);
                  }}
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-foreground/80">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={emailVerified}
                  className="rounded-xl border-border bg-popover/80 text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-80"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {emailVerified ? (
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Email verified
                    </span>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleSendEmailOtp}
                        disabled={sendingEmailOtp || !watch("email") || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(watch("email") ?? "")}
                      >
                        <span className="inline-flex items-center gap-2">
                          <InfoIcon color="orange" />
                          Verify email
                        </span>
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        Use the OTP dialog to send and verify your code.
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-foreground/80">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars, mixed case + number"
                    autoComplete="new-password"
                    className="rounded-xl border-border bg-popover/80 pr-10 text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password ? (
                  <p className="text-xs text-red-400">{errors.password.message}</p>
                ) : (
                  <PasswordStrength password={passwordValue} />
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-foreground/80">
                  Confirm password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="rounded-xl border-border bg-popover/80 pr-10 text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-primary/20"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground"
                    aria-label={showConfirm ? "Hide" : "Show"}
                  >
                    {showConfirm ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-xs text-red-400">
                    {errors.confirmPassword.message}
                  </p>
                )}
              </div>

              {/* Consent */}
              <div className="flex items-start gap-3 rounded-xl border border-border bg-popover/80 p-3">
                <input
                  id="consentGiven"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-border accent-primary"
                  {...register("consentGiven")}
                />
                <Label
                  htmlFor="consentGiven"
                  className="text-xs text-muted-foreground leading-relaxed cursor-pointer"
                >
                  I agree to NestDesk&apos;s{" "}
                  <TenantConsentLink className="text-foreground/80" /> and consent to
                  my personal data being used for rental management purposes by{" "}
                  {hostel.name} and NestDesk.
                </Label>
              </div>
              {errors.consentGiven && (
                <p className="text-xs text-red-400">{errors.consentGiven.message}</p>
              )}

              {/* Validation Checklist */}
              {(!phoneVerified || !emailVerified || !govtIdFrontFile || !govtIdBackFile) && (
                <ValidationChecklist
                  items={[
                    {
                      id: "phone",
                      label: "Verify your phone number",
                      completed: phoneVerified,
                    },
                    {
                      id: "email",
                      label: "Verify your email address",
                      completed: emailVerified,
                    },
                    {
                      id: "idFront",
                      label: "Upload ID front photo",
                      completed: !!govtIdFrontFile,
                    },
                    {
                      id: "idBack",
                      label: "Upload ID back photo",
                      completed: !!govtIdBackFile,
                    },
                  ]}
                />
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isSubmitting || registeringTenant || !phoneVerified || !emailVerified || !govtIdFrontFile || !govtIdBackFile}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:brightness-110"
              >
                {isSubmitting || registeringTenant ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Tenant Account"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground/70">
                Already have an account?{" "}
                <Link
                  href={`/login?token=${token}&hostel=${hostelId}`}
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>

      <OtpVerificationDialog
        open={otpDialogOpen}
        onOpenChange={(open) => {
          setOtpDialogOpen(open);
          if (!open) {
            setOtpCode("");
          }
        }}
        phone={normalizePhoneNumber(watch("phone") ?? "")}
        otpCode={otpCode}
        onOtpChange={setOtpCode}
        onVerify={handleVerifyOtp}
        onResend={handleRetryOtp}
        sendingOtp={sendingOtp}
        verifyingOtp={verifyingOtp}
        otpSent={otpSent}
      />

      <EmailOtpVerificationDialog
        open={emailOtpDialogOpen}
        onOpenChange={(open) => {
          setEmailOtpDialogOpen(open);
          if (!open) {
            setEmailOtpCode("");
          }
        }}
        email={watch("email") ?? ""}
        otpCode={emailOtpCode}
        onOtpChange={setEmailOtpCode}
        onVerify={handleVerifyEmailOtp}
        onResend={handleResendEmailOtp}
        sendingOtp={sendingEmailOtp}
        verifyingOtp={verifyingEmailOtp}
        otpSent={emailOtpSent}
      />
    </div>
  );
}
