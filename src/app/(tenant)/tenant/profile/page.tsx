"use client";

import { useEffect, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Clock,
  Home,
  IdCard,
  Image as ImageIcon,
  Loader2,
  Save,
  User,
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
import { Badge } from "../../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "../../../../components/ui/dialog";
import { OtpVerificationDialog } from "../../../../components/ui/otp-verification-dialog";
import { UploadDocType, processImageForUpload } from "../../../../lib/image-upload";
import {
  isValidAadhaarNumber,
  normalizeAadhaarNumber,
} from "../../../../lib/aadhaar";

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
  aadhar_last4: string | null;
  profile_photo_url: string | null;
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

const DOC_LABELS: Record<UploadDocType, string> = {
  profile_photo: "Profile picture",
  aadhar_front: "Aadhaar front image",
  aadhar_back: "Aadhaar back image",
  alternate_id: "Alternate government/institution ID",
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
      "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
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
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [isPhoneEditing, setIsPhoneEditing] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [originalPhone, setOriginalPhone] = useState("");
  const [occupationType, setOccupationType] = useState("student");
  const [institutionName, setInstitutionName] = useState("");
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
      setProfile(j.tenant);
      setFullName(j.tenant.full_name);
      setPhone(j.tenant.phone ?? "");
      setOriginalPhone(j.tenant.phone ?? "");
      setPhoneVerified(Boolean(j.tenant.phone_verified));
      setIsPhoneEditing(false);
      setIsEditingDetails(false);
      setOccupationType(j.tenant.occupation_type ?? "student");
      setInstitutionName(j.tenant.institution_name ?? "");
      setSavedAadharLast4(j.tenant.aadhar_last4 ?? null);
      setAadharNumber("");
    }
  }

  useEffect(() => {
    reloadProfile().finally(() => setLoading(false));
  }, []);

  async function handleSendOtp() {
    const normalizedPhone = phone.trim().replace(/\D/g, "");
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
    const normalizedPhone = phone.trim().replace(/\D/g, "");
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
        body: JSON.stringify({ phone: normalizedPhone, otpCode }),
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
    if (!fullName.trim()) {
      return;
    }

    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      toast.error("Phone number is required.");
      return;
    }

    if (!/^\d{10}$/.test(normalizedPhone)) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }

    const hasPhoneChanged = normalizedPhone !== originalPhone.replace(/\D/g, "");
    if (hasPhoneChanged && !phoneVerified) {
      toast.error("Verify your updated phone number before saving the profile.");
      return;
    }

    const normalizedAadhaar = normalizeAadhaarNumber(aadharNumber);
    if (normalizedAadhaar && !isValidAadhaarNumber(normalizedAadhaar)) {
      toast.error("Enter a valid Aadhaar number.");
      return;
    }

    setSaving(true);
    try {
      const payload: {
        fullName: string;
        phone: string;
        occupationType: string;
        institutionName: string;
        aadharNumber?: string;
      } = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        occupationType,
        institutionName: institutionName.trim(),
      };

      if (normalizedAadhaar) {
        payload.aadharNumber = normalizedAadhaar;
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

  const normalizedPhone = phone.trim();
  const normalizedAadhaar = normalizeAadhaarNumber(aadharNumber);
  const isAadhaarValid =
    !normalizedAadhaar || isValidAadhaarNumber(normalizedAadhaar);

  const canSave =
    !saving &&
    Boolean(normalizedPhone) &&
    /^\d{10}$/.test(normalizedPhone) &&
    isAadhaarValid;

  function UploadBlock({
    docType,
    preview,
  }: {
    docType: UploadDocType;
    preview: string | null;
  }) {
    const isUploading = uploadingDoc === docType;
    const uploadDisabled = isUploading || isAccountActive;

    return (
      <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-background/95">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{DOC_LABELS[docType]}</p>
            <p className="text-[11px] text-muted-foreground">Auto-crop and compression are applied before upload.</p>
          </div>
          <span className="rounded-full border border-border/70 bg-muted/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">KYC</span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-20 w-28 overflow-hidden rounded-2xl border border-border/60 bg-muted/40 shadow-inner">
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
            className={`inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold shadow-sm ${
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
      <header className="rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-primary/[0.05] p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary">Tenant profile</p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">My Profile</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Update your details, manage verification status, and keep your KYC documents current in one compact workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-background px-3 py-1.5 shadow-sm">Status overview</span>
            <span className="rounded-full border border-border/70 bg-background px-3 py-1.5 shadow-sm">KYC uploads</span>
            <span className="rounded-full border border-border/70 bg-background px-3 py-1.5 shadow-sm">Phone verification</span>
          </div>
        </div>
      </header>

      {/* ── Account status card ─────────────────────────────────────────── */}
      <Card className="rounded-3xl border-border/70 bg-gradient-to-br from-background via-background to-primary/[0.04] shadow-sm">
        <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:gap-6">
          {/* Avatar */}
          <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-inner ring-1 ring-primary/10">
            {profile?.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_photo_url}
                alt="Profile"
                className="h-24 w-24 rounded-3xl object-cover"
              />
            ) : (
              <User className="h-9 w-9" />
            )}
          </div>

          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {profile?.full_name ?? "—"}
              </h2>
              <Badge
                variant={statusCfg.variant}
                className={`flex items-center gap-1 border ${statusCfg.chipClassName}`}
              >
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{profile?.email ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{statusCfg.note}</p>
          </div>

          <div className="w-full rounded-2xl border border-border/60 bg-background/90 p-4 shadow-sm lg:w-[320px]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Profile completion
              </p>
              <p className="text-sm font-semibold text-foreground">{completion}%</p>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {profile?.profile_completion_counts.complete ?? 0}/
              {profile?.profile_completion_counts.total ?? 0} requirements completed.
            </p>
            {profile?.profile_completion_missing?.length ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
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
      <Card className="rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
            <span className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Personal details
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setIsEditingDetails((prev) => !prev)}
            >
              {isEditingDetails ? "View mode" : "Edit details"}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-4">
            {/* Full name */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input
                id="profile-name"
                type="text"
                value={fullName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFullName(e.target.value)
                }
                placeholder="Your full name"
                className="rounded-xl max-w-sm"
                required
                disabled={!isEditingDetails}
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-email">
                Email{" "}
                <span className="text-muted-foreground font-normal">
                  (cannot be changed here)
                </span>
              </Label>
              <Input
                id="profile-email"
                type="email"
                value={profile?.email ?? ""}
                disabled
                className="rounded-xl max-w-sm opacity-60"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone">
                Phone number <span className="text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-2 max-w-sm">
                <span className="inline-flex h-10 items-center rounded-xl border border-input bg-muted/30 px-3 text-sm text-muted-foreground">+91</span>
                <Input
                  id="profile-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  disabled={!isPhoneEditing}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const nextPhone = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setPhone(nextPhone);
                    setPhoneVerified(false);
                    setOtpSent(false);
                  }}
                  placeholder="10-digit mobile number"
                  className="rounded-xl flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => {
                    if (isPhoneEditing) {
                      setPhone(originalPhone);
                      setPhoneVerified(false);
                      setOtpSent(false);
                      setOtpCode("");
                    }
                    setIsPhoneEditing((prev) => !prev);
                  }}
                >
                  {isPhoneEditing ? "Cancel" : "Update phone number"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {phoneVerified ? (
                  <>
                    <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-700 shadow-sm transition-colors dark:border-emerald-400/30 dark:bg-emerald-500/15 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Phone verified
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Phone number is locked. Click “Update phone number” to change it.
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-300">
                    {isPhoneEditing
                      ? "Verify this number in the OTP dialog before saving."
                      : "Phone number is locked. Click “Update phone number” to change it."}
                  </span>
                )}

                {isPhoneEditing && !phoneVerified && (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSendOtp}
                      disabled={sendingOtp || !/^\d{10}$/.test(phone.trim().replace(/\D/g, ""))}
                    >
                      {sendingOtp ? "Sending OTP..." : otpSent ? "Resend OTP" : "Send OTP"}
                    </Button>
                    <span className="text-xs text-muted-foreground">Verify in the OTP dialog</span>
                  </>
                )}
              </div>
              {isPhoneEditing && (
                <p className="text-xs text-muted-foreground/80">
                  A secure 6-digit OTP dialog will open after the code is sent.
                </p>
              )}
              
              {!phone && (
                <p className="text-xs text-destructive">Phone number is required.</p>
              )}
              {phone && !/^\d{10}$/.test(phone) && (
                <p className="text-xs text-destructive">
                  Enter a valid 10-digit phone number.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="occupation-type" className="block">
                Occupation type
              </Label>
              <select
                id="occupation-type"
                className="block h-10 w-full max-w-sm rounded-xl border border-input bg-background px-3 text-sm"
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

            <div className="space-y-1.5">
              <Label htmlFor="institution-name">Institution name</Label>
              <Input
                id="institution-name"
                type="text"
                value={institutionName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setInstitutionName(e.target.value)
                }
                placeholder="College / company / organization"
                className="rounded-xl max-w-sm"
                disabled={!isEditingDetails}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="aadhar-number">Aadhaar number</Label>
              <Input
                id="aadhar-number"
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={aadharNumber}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAadharNumber(normalizeAadhaarNumber(e.target.value))
                }
                placeholder="12-digit Aadhaar number"
                className="rounded-xl max-w-sm"
                disabled={!isEditingDetails}
              />
              {savedAadharLast4 && !aadharNumber ? (
                <p className="text-xs text-muted-foreground">
                  Saved Aadhaar: **** **** {savedAadharLast4}
                </p>
              ) : null}
              {aadharNumber && !isValidAadhaarNumber(aadharNumber) ? (
                <p className="text-xs text-destructive">Aadhaar number is invalid</p>
              ) : null}
            </div>

              </div>

              <aside className="space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick tips</p>
                  <h3 className="text-sm font-semibold text-foreground">Keep your account review-ready</h3>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Verify your phone number before saving any updated contact detail.</li>
                  <li>• Alternate ID documents can be used if Aadhaar is not available.</li>
                  <li>• Keep front and back Aadhaar and alternate ID images clear and cropped.</li>
                  <li>• Update institution details if your stay or role changes.</li>
                </ul>
              </aside>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Documents</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                <UploadBlock
                  docType="profile_photo"
                  preview={profile?.profile_photo_url ?? null}
                />
                <UploadBlock
                  docType="aadhar_front"
                  preview={profile?.aadhar_front_url ?? null}
                />
                <UploadBlock
                  docType="aadhar_back"
                  preview={profile?.aadhar_back_url ?? null}
                />
                <UploadBlock
                  docType="alternate_id"
                  preview={profile?.alternate_id_url ?? null}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Ready to save your changes?</p>
                </div>
              <Button type="submit" disabled={!canSave} className="rounded-xl">
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
