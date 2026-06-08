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
import { Card, CardContent, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Badge } from "../../../../components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "../../../../components/ui/dialog";
import { UploadDocType, processImageForUpload } from "../../../../lib/image-upload";
import { isValidAadhaarNumber, normalizeAadhaarNumber } from "../../../../lib/aadhaar";

type TenantProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  occupation_type: string | null;
  institution_name: string | null;
  aadhar_number: string | null;
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

const DOC_PREVIEW_KEY: Record<UploadDocType, keyof TenantProfile> = {
  profile_photo: "profile_photo_url",
  aadhar_front: "aadhar_front_url",
  aadhar_back: "aadhar_back_url",
  alternate_id: "alternate_id_url",
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

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [occupationType, setOccupationType] = useState("student");
  const [institutionName, setInstitutionName] = useState("");
  const [aadharNumber, setAadharNumber] = useState("");
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
      setOccupationType(j.tenant.occupation_type ?? "student");
      setInstitutionName(j.tenant.institution_name ?? "");
      setAadharNumber(j.tenant.aadhar_number ?? "");
    }
  }

  useEffect(() => {
    reloadProfile().finally(() => setLoading(false));
  }, []);

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

      const key = DOC_PREVIEW_KEY[docType];
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              [key]: json.signedUrl ?? prev[key],
            }
          : prev,
      );

      toast.success(`${DOC_LABELS[docType]} uploaded successfully.`);
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

  const normalizedFullName = fullName.trim();
  const normalizedPhone = phone.trim();
  const normalizedInstitutionName = institutionName.trim();
  const normalizedAadhaar = normalizeAadhaarNumber(aadharNumber);
  const initialAadhaar = normalizeAadhaarNumber(profile?.aadhar_number ?? "");
  const isAadhaarValid =
    !normalizedAadhaar || isValidAadhaarNumber(normalizedAadhaar);
  const hasChanges = Boolean(profile)
    ? isAccountActive
      ? normalizedPhone !== (profile?.phone ?? "")
      : normalizedFullName !== (profile?.full_name ?? "") ||
        normalizedPhone !== (profile?.phone ?? "") ||
        occupationType !== (profile?.occupation_type ?? "student") ||
        normalizedInstitutionName !== (profile?.institution_name ?? "") ||
        normalizedAadhaar !== initialAadhaar
    : false;

  const canSave =
    !saving &&
    Boolean(normalizedPhone) &&
    /^\d{10}$/.test(normalizedPhone) &&
    isAadhaarValid &&
    hasChanges;

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
      <div className="space-y-2 rounded-xl border border-border/70 p-3">
        <p className="text-xs font-medium text-foreground">{DOC_LABELS[docType]}</p>
        <div className="flex items-center gap-3">
          <div className="h-16 w-24 overflow-hidden rounded-lg border border-border/60 bg-muted/40">
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
            className={`inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium ${
              uploadDisabled
                ? "cursor-not-allowed opacity-70"
                : "cursor-pointer hover:bg-muted"
            }`}
            aria-disabled={uploadDisabled}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {uploadDisabled ? "Upload disabled" : preview ? "Replace" : "Upload"}
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
        <p className="text-[11px] text-muted-foreground">
          Auto-crop and compression are applied before upload.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          My Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account details, KYC documents, and registration status.
        </p>
      </div>

      {/* ── Account status card ─────────────────────────────────────────── */}
      <Card className="rounded-2xl border-border/70">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:gap-6">
          {/* Avatar */}
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            {profile?.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.profile_photo_url}
                alt="Profile"
                className="h-20 w-20 rounded-3xl object-cover"
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

          <div className="w-full rounded-xl border border-border/60 bg-muted/20 p-3 lg:w-[280px]">
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
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-primary" />
            Personal details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
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
                disabled={isAccountActive}
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
              <Input
                id="profile-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setPhone(e.target.value)
                }
                placeholder="10-digit mobile number"
                className="rounded-xl max-w-sm"
              />
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
                disabled={isAccountActive}
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
                disabled={isAccountActive}
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
                disabled={isAccountActive}
              />
              {aadharNumber && !isValidAadhaarNumber(aadharNumber) ? (
                <p className="text-xs text-destructive">Aadhaar number is invalid</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium text-foreground">Documents</p>
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
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
