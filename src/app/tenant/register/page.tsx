"use client";

import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Home,
  Loader2,
  MapPin,
  XCircle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ── Validation ────────────────────────────────────────────────────────────────

const tenantRegisterSchema = z
  .object({
    fullName: z.string().min(2, "Enter your full name (at least 2 characters)."),
    email: z.string().email("Enter a valid email address."),
    phone: z
      .string()
      .regex(/^\d{10}$/, "Enter a valid 10-digit phone number.")
      .optional()
      .or(z.literal("")),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Add at least one uppercase letter.")
      .regex(/[a-z]/, "Add at least one lowercase letter.")
      .regex(/[0-9]/, "Add at least one number."),
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
              i < passed ? STRENGTH_COLORS[passed] : "bg-white/10",
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
                <XCircle className="h-3.5 w-3.5 text-white/30" />
              )}
              <span className={ok ? "text-white/60" : "text-white/30"}>
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
  city: string;
  state: string;
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  pg: "PG / Paying Guest",
  hostel: "Hostel",
  coliving: "Co-living Space",
  rental: "Rental Property",
};

function PropertyBanner({ hostel }: { hostel: HostelInfo }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/8 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary">
        <Home className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-white leading-snug">{hostel.name}</p>
        <p className="text-xs text-white/50">
          {PROPERTY_TYPE_LABELS[hostel.property_type] ?? hostel.property_type}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/40">
          <MapPin className="h-3 w-3" />
          {hostel.city}, {hostel.state}
        </p>
      </div>
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TenantRegisterForm>({
    resolver: zodResolver(tenantRegisterSchema),
    defaultValues: { consentGiven: false },
  });

  useEffect(() => {
    const sub = watch((v) => setPasswordValue(v.password ?? ""));
    return () => sub.unsubscribe();
  }, [watch]);

  async function onSubmit(data: TenantRegisterForm) {
    try {
      const res = await fetch("/api/tenant/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          hostelId,
          fullName: data.fullName,
          email: data.email,
          phone: data.phone,
          password: data.password,
          consentGiven: data.consentGiven,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Registration failed.");
        return;
      }

      if (json.requiresEmailVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(data.email)}`);
      } else {
        toast.success("Account created. Welcome!");
        router.push(json.redirectTo ?? "/tenant/profile");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (hostelLoading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-auth px-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-white/60">Verifying invite…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (hostelError || !hostel) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-auth px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-destructive/20 text-destructive">
            <XCircle className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Invalid Invite Link</h2>
          <p className="text-sm text-white/60">{hostelError}</p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/join">Try entering your property code</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Register form ──────────────────────────────────────────────────────────
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-auth">
      <div className="animate-blob pointer-events-none absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-primary/20 blur-3xl" />
      <div className="animate-blob-delay-2 pointer-events-none absolute -right-32 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-500/15 blur-3xl" />

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-blue-400 shadow shadow-primary/30">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">NestDesk</span>
          </Link>
          <Link
            href="/login"
            className="text-xs text-white/50 hover:text-white transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 items-start justify-center px-4 py-10">
        <Card className="w-full max-w-md rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/30 backdrop-blur-2xl dark:bg-white/5">
          <CardHeader className="space-y-4 pb-4 pt-8">
            <div className="flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400 glow-ring">
                <Home className="h-7 w-7 text-white drop-shadow" />
              </div>
            </div>
            <div className="text-center">
              <CardTitle className="text-2xl font-bold text-white">
                Create Tenant Account
              </CardTitle>
              <CardDescription className="text-white/60">
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
                <Label htmlFor="fullName" className="text-white/80">
                  Full name
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="Your full name"
                  autoComplete="name"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
                  {...register("fullName")}
                />
                {errors.fullName && (
                  <p className="text-xs text-red-400">{errors.fullName.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-white/80">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email.message}</p>
                )}
              </div>

              {/* Phone (optional) */}
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-white/80">
                  Phone number{" "}
                  <span className="text-white/40 font-normal">(optional)</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  autoComplete="tel-national"
                  className="rounded-xl border-white/15 bg-white/10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
                  {...register("phone")}
                />
                {errors.phone && (
                  <p className="text-xs text-red-400">{errors.phone.message}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-white/80">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 8 chars, mixed case + number"
                    autoComplete="new-password"
                    className="rounded-xl border-white/15 bg-white/10 pr-10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
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
                <Label htmlFor="confirmPassword" className="text-white/80">
                  Confirm password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="rounded-xl border-white/15 bg-white/10 pr-10 text-white placeholder:text-white/30 focus-visible:border-primary focus-visible:ring-primary/30"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
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
              <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <input
                  id="consentGiven"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-white/30 accent-primary"
                  {...register("consentGiven")}
                />
                <Label
                  htmlFor="consentGiven"
                  className="text-xs text-white/60 leading-relaxed cursor-pointer"
                >
                  I agree to NestDesk&apos;s{" "}
                  <Link
                    href="/privacy"
                    className="underline underline-offset-2 hover:text-white"
                  >
                    Privacy Policy
                  </Link>{" "}
                  and consent to my personal data being used for rental management
                  purposes by {hostel.name} and NestDesk.
                </Label>
              </div>
              {errors.consentGiven && (
                <p className="text-xs text-red-400">{errors.consentGiven.message}</p>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:brightness-110"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Tenant Account"
                )}
              </Button>

              <p className="text-center text-xs text-white/50">
                Already have an account?{" "}
                <Link
                  href={`/login?token=${token}&hostel=${hostelId}`}
                  className="underline underline-offset-4 hover:text-white"
                >
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
