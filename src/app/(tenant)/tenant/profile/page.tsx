"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  Home,
  IdCard,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Save,
  User,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { OtpVerificationDialog } from "../../../../components/ui/otp-verification-dialog";
import { UploadDocType, processImageForUpload } from "../../../../lib/image-upload";
import { normalizeIndianPhoneDigits } from "../../../../lib/phone";

type TenantProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
  status: string | null;
  occupation_type: string | null;
  institution_name: string | null;
  govt_id_type: string | null;
  govt_id_last4: string | null;
  aadhar_last4: string | null;
  profile_photo_url: string | null;
  govt_id_front_url: string | null;
  govt_id_back_url: string | null;
  aadhar_front_url: string | null;
  aadhar_back_url: string | null;
  alternate_id_url: string | null;
  profile_completion_percentage: number;
  profile_completion_missing: string[];
  profile_completion_counts: { complete: number; total: number };
  hostel_name: string | null;
  hostel_address: string | null;
  hostel_city: string | null;
  hostel_state: string | null;
  hostel_pincode: string | null;
  property_type: string | null;
};

const OCCUPATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "student", label: "Student" },
  { value: "working_professional", label: "Working Professional" },
  { value: "business", label: "Business" },
  { value: "other", label: "Other" },
];

const GOVT_ID_OPTIONS = [
  "Aadhaar",
  "PAN",
  "Voter ID card",
  "Passport",
  "Driving license",
];

function maskGovtIdNumber(value: string, type?: string): string {
  const sanitized = value.trim();
  if (!sanitized) return "";

  const digits = sanitized.replace(/\D/g, "");
  const last4 = digits.slice(-4) || sanitized.slice(-4);

  if (!last4) return "";

  switch (type) {
    case "Aadhaar":
      if (digits.length === 12) return `XXXX XXXX ${last4}`;
      return `XXXXXX${last4}`;
    case "PAN":
      return `XXXX${last4}`;
    case "Voter ID card":
      return `XXXXXX${last4}`;
    case "Passport":
      return `XXXXXX${last4}`;
    case "Driving license":
      return `XXXXXX${last4}`;
    default:
      return `XXXXXX${last4}`;
  }
}

const DOC_LABELS: Record<UploadDocType, string> = {
  profile_photo: "Profile picture",
  govt_id_front: "Government ID front image",
  govt_id_back: "Government ID back image",
  aadhar_front: "Government ID front image",
  aadhar_back: "Government ID back image",
  alternate_id: "Alternate government / institution ID",
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ElementType;
    note: string;
    chipClassName: string;
  }
> = {
  pending: {
    label: "Pending Approval",
    variant: "secondary",
    icon: Clock,
    note: "Your registration is under review. The property owner will approve your account shortly.",
    chipClassName:
      "border-yellow-300 bg-yellow-50 text-yellow-700 dark:border-yellow-500/40 dark:bg-yellow-500/15 dark:text-yellow-300",
  },
  active: {
    label: "Active",
    variant: "default",
    icon: CheckCircle2,
    note: "Your account is active. You have full access to this property.",
    chipClassName:
      "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  moved_out: {
    label: "Moved Out",
    variant: "outline",
    icon: Home,
    note: "Your stay has been marked as moved out for this property.",
    chipClassName:
      "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
    note: "Your registration was not approved. Please contact your property owner.",
    chipClassName:
      "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

export default function TenantProfilePage() {
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<UploadDocType | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [reqId, setReqId] = useState("");
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [originalPhoneVerified, setOriginalPhoneVerified] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [showStatusNote, setShowStatusNote] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const statusNoteRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!showStatusNote) return;

    function handleOutsidePointerDown(event: PointerEvent) {
      if (
        statusNoteRef.current &&
        !statusNoteRef.current.contains(event.target as Node)
      ) {
        setShowStatusNote(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [showStatusNote]);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [occupationType, setOccupationType] = useState("student");
  const [institutionName, setInstitutionName] = useState("");
  const [govtIdType, setGovtIdType] = useState("");
  const [govtIdNumber, setGovtIdNumber] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
  const [savedAadharLast4, setSavedAadharLast4] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    src: string;
    title: string;
  } | null>(null);

  async function reloadProfile() {
    const res = await fetch("/api/tenant/profile", { cache: "no-store" });
    const j = (await res.json()) as { tenant?: TenantProfile; error?: string };
    if (j.tenant) {
      const nextPhone = normalizeIndianPhoneDigits(j.tenant.phone ?? "");

      setProfile(j.tenant);
      setFullName(j.tenant.full_name);
      setPhone(nextPhone);
      setOriginalPhone(nextPhone);
      setPhoneVerified(Boolean(j.tenant.phone_verified));
      setOriginalPhoneVerified(Boolean(j.tenant.phone_verified));
      setIsEditingDetails(false);
      setOccupationType(j.tenant.occupation_type ?? "student");
      setInstitutionName(j.tenant.institution_name ?? "");
      const nextGovtIdType = j.tenant.govt_id_type ?? (j.tenant.aadhar_last4 ? "Aadhaar" : "");
      const nextGovtIdNumber = j.tenant.govt_id_last4
        ? maskGovtIdNumber(j.tenant.govt_id_last4, nextGovtIdType)
        : j.tenant.aadhar_last4
          ? maskGovtIdNumber(j.tenant.aadhar_last4, nextGovtIdType)
          : "";

      setGovtIdType(nextGovtIdType);
      setGovtIdNumber(nextGovtIdNumber);
      setSavedAadharLast4(j.tenant.aadhar_last4 ?? null);
      setAadharNumber("");
    }
  }

  useEffect(() => {
    reloadProfile().finally(() => setLoading(false));
  }, []);

  async function handleSendOtp() {
    const normalizedPhone = normalizeIndianPhoneDigits(phone.trim());
    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast.error("Enter a valid 10-digit phone number before requesting OTP.");
      return;
    }

    setSendingOtp(true);
    try {
      const response = await fetch("/api/tenant/phone-otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone }),
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

  async function handleVerifyOtp() {
    const normalizedPhone = normalizeIndianPhoneDigits(phone.trim());
    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast.error("Enter a valid 10-digit phone number first.");
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      toast.error("Enter a valid 6-digit OTP code.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await fetch("/api/tenant/phone-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizedPhone, otpCode, reqId }),
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setShowValidationErrors(true);
    if (!fullName.trim()) {
      toast.error("Full name is required.");
      return;
    }

    const normalizedPhone = normalizeIndianPhoneDigits(phone.trim());
    if (!normalizedPhone) {
      toast.error("Phone number is required.");
      return;
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }

    const hasPhoneChanged = normalizedPhone !== normalizeIndianPhoneDigits(originalPhone);
    if (hasPhoneChanged && !phoneVerified) {
      toast.error("Verify your updated phone number before saving the profile.");
      return;
    }

    const selectedGovtIdType = govtIdType;
    const savedGovtIdType = profile?.govt_id_type ?? (savedAadharLast4 ? "Aadhaar" : "");
    const existingIdDisplay = savedIdDisplay;
    const isExistingIdValue =
      Boolean(existingIdDisplay) &&
      selectedGovtIdType === savedGovtIdType &&
      govtIdNumber === existingIdDisplay;
    const submittedGovtIdNumber = govtIdNumber
      .replace(/\s+/g, "")
      .replace(/\*/g, "")
      .trim();

    const missingDocuments = requiredDocumentErrors;
    if (missingDocuments.length > 0) {
      toast.error(`Upload ${missingDocuments.join(", ")} before saving.`);
      return;
    }

    setSaving(true);
    try {
      const payload: {
        fullName: string;
        phone: string;
        occupationType: string;
        institutionName: string;
        govtIdType?: string;
        govtIdNumber?: string;
        aadharNumber?: string;
      } = {
        fullName: fullName.trim(),
        phone: normalizedPhone,
        occupationType,
        institutionName: institutionName.trim(),
      };

      if (selectedGovtIdType !== savedGovtIdType || !isExistingIdValue) {
        payload.govtIdType = selectedGovtIdType;
        payload.govtIdNumber = submittedGovtIdNumber;
      }

      const res = await fetch("/api/tenant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not save changes.");
        return;
      }
      await reloadProfile();
      toast.success("Profile updated.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshCompletion() {
    try {
      const res = await fetch("/api/tenant/profile", { cache: "no-store" });
      const j = (await res.json()) as { tenant?: TenantProfile; error?: string };
      if (j.tenant) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                profile_photo_url: j.tenant!.profile_photo_url,
                govt_id_front_url: j.tenant!.govt_id_front_url,
                govt_id_back_url: j.tenant!.govt_id_back_url,
                aadhar_front_url: j.tenant!.aadhar_front_url,
                aadhar_back_url: j.tenant!.aadhar_back_url,
                alternate_id_url: j.tenant!.alternate_id_url,
                profile_completion_percentage:
                  j.tenant!.profile_completion_percentage,
                profile_completion_missing: j.tenant!.profile_completion_missing,
                profile_completion_counts: j.tenant!.profile_completion_counts,
              }
            : prev,
        );
      }
    } catch {
      // silent — completion display is best-effort
    }
  }

  async function handleUpload(docType: UploadDocType, file: File) {
    setUploadingDoc(docType);
    try {
      const processed = await processImageForUpload(file, docType);
      const formData = new FormData();
      formData.append("docType", docType);
      formData.append("file", processed);

      const res = await fetch("/api/tenant/profile/upload", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Upload failed.");
        return;
      }

      toast.success(`${DOC_LABELS[docType]} uploaded successfully.`);
      await refreshCompletion();
    } catch {
      toast.error("Could not process this image. Try a clearer photo.");
    } finally {
      setUploadingDoc(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const status = profile?.status ?? "pending";
  const isAccountActive = status === "active";
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const completion = profile?.profile_completion_percentage ?? 0;

  const normalizedPhone = normalizeIndianPhoneDigits(phone.trim());
  const hasPhoneChanged =
    normalizedPhone !== normalizeIndianPhoneDigits(originalPhone);
  const primaryGovtFrontUrl = profile?.govt_id_front_url ?? profile?.aadhar_front_url ?? null;
  const primaryGovtBackUrl = profile?.govt_id_back_url ?? profile?.aadhar_back_url ?? null;
  const savedGovtIdType = profile?.govt_id_type ?? (savedAadharLast4 ? "Aadhaar" : "");
  const savedGovtIdLast4 = profile?.govt_id_last4 ?? savedAadharLast4;
  const savedIdDisplay = savedGovtIdLast4
    ? maskGovtIdNumber(savedGovtIdLast4, savedGovtIdType || undefined)
    : null;
  const requiredDocumentErrors = [
    !profile?.profile_photo_url ? DOC_LABELS.profile_photo : null,
    !primaryGovtFrontUrl ? DOC_LABELS.govt_id_front : null,
    !primaryGovtBackUrl ? DOC_LABELS.govt_id_back : null,
  ].filter((label): label is string => Boolean(label));
  const missingRequiredFields = [...requiredDocumentErrors].filter((label): label is string => Boolean(label));

  const canSave =
    !saving &&
    isEditingDetails;

  function UploadBlock({
    docType,
    preview,
    required = false,
  }: {
    docType: UploadDocType;
    preview: string | null;
    required?: boolean;
  }) {
    const isUploading = uploadingDoc === docType;
    const uploadDisabled = isUploading || isAccountActive;

    return (
      <div className="rounded-2xl border border-border/70 bg-card/80 p-3 shadow-sm transition-colors hover:border-primary/30 hover:bg-background/95 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase text-muted-foreground">
              {DOC_LABELS[docType]}
              {required ? <span className="ml-1 text-rose-500">*</span> : null}
            </p>
            {!preview && docType !== "alternate_id" ? (
              <p className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                <CircleAlert className="h-3 w-3 shrink-0" />
                Please upload your {DOC_LABELS[docType].toLowerCase()}.
              </p>
            ) : null}
          </div>
          <span className="shrink-0 rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">KYC</span>
        </div>
        <div className="mt-3 flex flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
          <div className="h-20 w-full max-w-[7rem] shrink-0 overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-inner sm:w-28">
            {preview ? (
              <button
                type="button"
                onClick={() =>
                  setPreviewImage({ src: preview, title: DOC_LABELS[docType] })
                }
                className="h-full w-full cursor-zoom-in"
                aria-label={`Open ${DOC_LABELS[docType]} image preview`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview}
                  alt={DOC_LABELS[docType]}
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-4 w-4" />
              </div>
            )}
          </div>

          <label
            className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold shadow-sm sm:w-auto ${
              uploadDisabled
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer bg-background hover:bg-muted/70"
            }`}
            title={
              isAccountActive
                ? "This account is activated by the owner. Image replacement is disabled."
                : undefined
            }
            aria-disabled={uploadDisabled}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {isUploading
              ? "Uploading..."
              : isAccountActive
                ? "Locked"
                : preview
                  ? "Replace"
                  : "Upload"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadDisabled}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleUpload(docType, file).catch(() => {
                    // handled in upload function
                  });
                }
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
     
      {/* ── Account status card ─────────────────────────────────────────── */}
      <Card className="rounded-3xl border-border/70 bg-gradient-to-br from-background via-background to-primary/[0.04] shadow-sm">
        <CardContent className="flex flex-col gap-4 p-3 sm:gap-5 sm:p-5">
          <div className="flex min-w-0 items-start gap-3 sm:gap-5">
            {/* Avatar */}
            <div className="flex shrink-0 flex-col items-center gap-1">
              <div className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-inner ring-1 ring-primary/10 sm:h-36 sm:w-36">
                {profile?.profile_photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.profile_photo_url}
                    alt="Profile"
                    className="h-32 w-32 rounded-3xl object-cover sm:h-36 sm:w-36"
                  />
                ) : (
                  <User className="h-9 w-9 sm:h-11 sm:w-11" />
                )}
                <label
                  className="absolute inset-x-1 bottom-0 flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-black/65 px-2 py-1.5 text-[10px] font-semibold text-white shadow-sm transition-colors hover:bg-black/80"
                >
                  {uploadingDoc === "profile_photo" ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Camera className="h-3 w-3" />
                  )}
                  {uploadingDoc === "profile_photo"
                    ? "Uploading..."
                    : profile?.profile_photo_url
                      ? "Update photo"
                      : "Add photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingDoc === "profile_photo"}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleUpload("profile_photo", file).catch(() => {
                          // handled in upload function
                        });
                      }
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="text-[11px] font-semibold text-muted-foreground">
                Profile picture <span className="text-rose-500">*</span>
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="truncate text-base font-semibold text-foreground sm:text-lg">
                {profile?.full_name ?? "—"}
              </h2>
              <p className="truncate text-sm text-muted-foreground">{profile?.email ?? "—"}</p>
              <span ref={statusNoteRef} className="relative inline-flex">
                <button
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${statusCfg.chipClassName}`}
                  aria-expanded={showStatusNote}
                  aria-label={`Show details for ${statusCfg.label} status`}
                  onClick={() => setShowStatusNote((visible) => !visible)}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusCfg.label}
                </button>
                {showStatusNote ? (
                  <div
                    role="tooltip"
                    className="absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-border bg-popover p-3 text-xs leading-5 text-popover-foreground shadow-xl"
                  >
                    {statusCfg.note}
                  </div>
                ) : null}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Profile completion
              </p>
              <p className="text-sm font-semibold text-foreground">{completion}%</p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {profile?.profile_completion_counts.complete ?? 0}/
              {profile?.profile_completion_counts.total ?? 0} requirements completed.
            </p>
            {profile?.profile_completion_missing?.length ? (
              <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
                Missing: {profile.profile_completion_missing.join(", ")}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(previewImage)}
        onOpenChange={(open: boolean) => {
          if (!open) {
            setPreviewImage(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl border-border/70 p-3 sm:p-4">
          <DialogTitle className="text-sm">
            {previewImage?.title ?? "Image preview"}
          </DialogTitle>
          {previewImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewImage.src}
              alt={previewImage.title}
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ── Edit details ───────────────────────────────────────────────── */}
      <Card className="overflow-hidden rounded-3xl border-border/70 bg-card/90 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/15 px-4 py-4 sm:px-6 sm:py-5">
          <CardTitle className="flex w-full items-center justify-between gap-3 text-base">
            <span className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <User className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold text-foreground">
                  Personal details
                </span>
              
              </span>
            </span>
            <Button
              type="button"
              variant={isEditingDetails ? "outline" : "default"}
              size="sm"
              className="shrink-0 rounded-xl"
              onClick={() => setIsEditingDetails((prev) => !prev)}
            >
              {!isEditingDetails ? <Pencil className="h-4 w-4" /> : <X className="h-4 w-4" />}
             
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form onSubmit={handleSave} className="space-y-8 p-4 sm:p-6">
            <div>
              <div className="space-y-6">
            {/* Full name */}
            <div className="space-y-2">
              <Label htmlFor="profile-name" className="text-sm font-medium">
                Full name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="profile-name"
                type="text"
                value={fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFullName(e.target.value)
                }
                placeholder="Your full name"
                className="w-full max-w-sm rounded-xl border-border/70 bg-background/80 shadow-sm"
                required
                disabled={!isEditingDetails}
              />
              {!fullName.trim() ? (
                <p className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                  <CircleAlert className="h-3 w-3 shrink-0" />
                  Please enter your full name.
                </p>
              ) : null}
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label htmlFor="profile-email" className="text-sm font-medium">
                Email <span className="text-rose-500">*</span>{" "}
                <span className="text-muted-foreground font-normal">
                  (cannot be changed here)
                </span>
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={profile?.email ?? ""}
                disabled
                className="w-full max-w-sm rounded-xl border-border/70 bg-muted/40 opacity-70"
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="profile-phone" className="text-sm font-medium">
                Phone number <span className="text-rose-500">*</span>
              </Label>
              <div className="flex max-w-sm flex-row items-center gap-2">
                <span className="inline-flex h-10 items-center rounded-xl border border-border/70 bg-muted/40 px-3 text-sm font-medium text-muted-foreground">+91</span>
                <div className="relative min-w-0 flex-1">
                  <Input
                    id="profile-phone"
                    type="tel"
                    inputMode="numeric"
                    value={phone}
                    disabled={!isEditingDetails}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const nextPhone = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setPhone(nextPhone);
                      setPhoneVerified(
                        normalizeIndianPhoneDigits(nextPhone) ===
                          normalizeIndianPhoneDigits(originalPhone)
                          ? originalPhoneVerified
                          : false,
                      );
                      setOtpSent(false);
                    }}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-xl border-border/70 bg-background/80 pr-10 shadow-sm"
                  />
                  {phoneVerified ? (
                    <span
                      className="group absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 cursor-help items-center justify-center text-emerald-600 dark:text-emerald-400"
                      aria-label="Phone number verified"
                      tabIndex={0}
                    >
                      <Check className="h-4 w-4" aria-hidden="true" />
                      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        Verified
                      </span>
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex min-w-0 flex-nowrap items-center gap-2 pt-1">
                {!phoneVerified ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300">
                    {isEditingDetails
                      ? "Verify phone number."
                      : "Phone number is locked. Click Edit to change it."}
                  </span>
                ) : null}

                {isEditingDetails && !phoneVerified && hasPhoneChanged && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || !/^\d{10}$/.test(normalizedPhone)}
                    >
                      {sendingOtp ? "Sending OTP..." : otpSent ? "Resend OTP" : "Send OTP"}
                    </Button>
                  </>
                )}
              </div>
              {isEditingDetails && (
                <p className="text-xs text-muted-foreground/80">
                  A secure 6-digit OTP dialog will open after the code is sent.
                </p>
              )}
              
              {phone && !/^\d{10}$/.test(phone) && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400">
                  Enter a valid 10-digit phone number.
                </p>
              )}
              {!phone && (
                <p className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                  <CircleAlert className="h-3 w-3 shrink-0" />
                  Please enter your phone number.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupation-type" className="block">
                Occupation type <span className="text-rose-500">*</span>
              </Label>
              <select
                id="occupation-type"
                className="block h-10 w-full max-w-sm rounded-xl border border-border/70 bg-background/80 px-3 text-sm shadow-sm"
                value={occupationType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setOccupationType(e.target.value)
                }
                disabled={!isEditingDetails}
              >
                {OCCUPATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="institution-name" className="text-sm font-medium">
                Institution name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="institution-name"
                type="text"
                value={institutionName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInstitutionName(e.target.value)
                }
                placeholder="College / company / organization"
                className="w-full max-w-sm rounded-xl border-border/70 bg-background/80 shadow-sm"
                required
                disabled={!isEditingDetails}
              />
            </div>

                    <div className="space-y-2">
              <Label htmlFor="govt-id-type" className="text-sm font-medium">
                Government ID type <span className="text-muted-foreground text-[11px]">(Optional)</span>
              </Label>
              <select
                id="govt-id-type"
                value={govtIdType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  const nextType = e.target.value;
                  if (
                    savedIdDisplay &&
                    govtIdNumber === savedIdDisplay
                  ) {
                    setGovtIdNumber("");
                  }
                  setGovtIdType(nextType);
                }}
                className="block h-10 w-full max-w-sm rounded-xl border border-border/70 bg-background/80 px-3 text-sm shadow-sm"
                disabled={!isEditingDetails}
              >
                <option value="">Select ID type</option>
                {GOVT_ID_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="govt-id-number" className="text-sm font-medium">
                  ID number
                </Label>
                <span className="text-[11px] text-muted-foreground">(Optional)</span>
              </div>
              <Input
                id="govt-id-number"
                type="text"
                value={govtIdNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGovtIdNumber(e.target.value)}
                placeholder={"Enter your ID number"}
                className="w-full max-w-sm rounded-xl border-border/70 bg-background/80 shadow-sm"
                disabled={!isEditingDetails}
              />
              {savedIdDisplay && !govtIdNumber ? (
                <p className="text-[11px] text-muted-foreground/80">
                  Existing ID: {savedIdDisplay}
                </p>
              ) : null}
              
            </div>

              </div>
            </div>

            <div className="space-y-4 border-t border-border/60 pt-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                  <IdCard className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Documents</p>
                  <p className="text-xs text-muted-foreground">Upload clear images for a faster review.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <UploadBlock
                  docType="govt_id_front"
                  preview={profile?.govt_id_front_url ?? profile?.aadhar_front_url ?? null}
                  required
                />
                <UploadBlock
                  docType="govt_id_back"
                  preview={profile?.govt_id_back_url ?? profile?.aadhar_back_url ?? null}
                  required
                />
                <UploadBlock
                  docType="alternate_id"
                  preview={profile?.alternate_id_url ?? null}
                />
              </div>
              {showValidationErrors && missingRequiredFields.length > 0 ? (
                <p className="mt-1 text-xs font-bold text-red-600 dark:text-red-400">
                  Missing: {missingRequiredFields.join(", ")}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <p className="text-sm font-semibold text-foreground">Ready to save your changes?</p>
                <p className="mt-1 text-xs text-muted-foreground">Your updated details will be reflected in your tenant profile.</p>
              </div>
              <Button type="submit" disabled={!canSave} className="rounded-xl sm:min-w-32">
              {saving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <OtpVerificationDialog
        open={otpDialogOpen}
        onOpenChange={setOtpDialogOpen}
        phone={phone.trim().replace(/\D/g, "")}
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
