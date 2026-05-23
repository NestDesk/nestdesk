"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Save,
  User,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  pg: "PG",
  hostel: "Hostel",
  coliving: "Co-living",
  rental: "Rental",
};

type TenantProfile = {
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  hostel_name: string | null;
  hostel_address: string | null;
  hostel_city: string | null;
  hostel_state: string | null;
  hostel_pincode: string | null;
  property_type: string | null;
};

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ElementType;
    note: string;
  }
> = {
  pending: {
    label: "Pending Approval",
    variant: "secondary",
    icon: Clock,
    note: "Your registration is under review. The property owner will approve your account shortly.",
  },
  active: {
    label: "Active",
    variant: "default",
    icon: CheckCircle2,
    note: "Your account is active. You have full access to this property.",
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
    note: "Your registration was not approved. Please contact your property owner.",
  },
};

export default function TenantProfilePage() {
  const [profile, setProfile] = useState<TenantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetch("/api/tenant/profile")
      .then((r) => r.json())
      .then((j: { tenant?: TenantProfile; error?: string }) => {
        if (j.tenant) {
          setProfile(j.tenant);
          setFullName(j.tenant.full_name);
          setPhone(j.tenant.phone ?? "");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch("/api/tenant/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not save changes.");
        return;
      }
      setProfile((prev) =>
        prev
          ? { ...prev, full_name: fullName.trim(), phone: phone.trim() || null }
          : prev,
      );
      toast.success("Profile updated.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
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
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;
  const fullAddress = [
    profile?.hostel_address,
    profile?.hostel_city,
    profile?.hostel_state,
    profile?.hostel_pincode,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          My Profile
        </h1>
        <p className="text-sm text-muted-foreground">
          Your account details and registration status.
        </p>
      </div>

      {/* ── Account status card ─────────────────────────────────────────── */}
      <Card className="rounded-2xl border-border/70">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User className="h-7 w-7" />
          </div>

          <div className="flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                {profile?.full_name ?? "—"}
              </h2>
              <Badge variant={statusCfg.variant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {statusCfg.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{profile?.email ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{statusCfg.note}</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Property info ──────────────────────────────────────────────── */}
      {profile?.hostel_name ? (
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Registered Property
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{profile.hostel_name}</p>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              <span className="leading-relaxed">{fullAddress || "—"}</span>
            </div>
            {profile.property_type ? (
              <Badge variant="outline" className="w-fit">
                {PROPERTY_TYPE_LABELS[profile.property_type] ??
                  profile.property_type}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                className="rounded-xl max-w-sm"
                required
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
                Phone number{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="profile-phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                className="rounded-xl max-w-sm"
              />
              {phone && !/^\d{10}$/.test(phone) && (
                <p className="text-xs text-destructive">
                  Enter a valid 10-digit phone number.
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={
                saving || !fullName.trim() || (!!phone && !/^\d{10}$/.test(phone))
              }
              className="rounded-xl"
            >
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
