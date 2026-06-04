"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
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
import { normalizeOwnerPlan, formatPlanLabel } from "@/lib/subscriptions";
import { PrivacyPolicyLink } from "@/components/legal/PrivacyPolicyLink";

const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(2, "Enter your full name (at least 2 characters).")
      .max(100)
      .refine((value) => !/\d/.test(value), {
        message: "Name should not contain numbers.",
      }),
    email: z.string().trim().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Add at least one uppercase letter.")
      .regex(/[a-z]/, "Add at least one lowercase letter.")
      .regex(/[0-9]/, "Add at least one number."),
    confirmPassword: z.string(),
    consentGiven: z.boolean().refine((v) => v === true, {
      message: "You must agree to the Privacy Policy to continue.",
    }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type RegisterForm = z.infer<typeof registerSchema>;

interface StrengthRule {
  label: string;
  test: (v: string) => boolean;
}

const STRENGTH_RULES: StrengthRule[] = [
  { label: "At least 8 characters", test: (v) => v.length >= 8 },
  { label: "Uppercase letter (A–Z)", test: (v) => /[A-Z]/.test(v) },
  { label: "Lowercase letter (a–z)", test: (v) => /[a-z]/.test(v) },
  { label: "Number (0–9)", test: (v) => /[0-9]/.test(v) },
  { label: "Special character (!@#$…)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const STRENGTH_LABELS = ["", "Weak", "Weak", "Fair", "Strong", "Very Strong"];
const STRENGTH_COLORS = [
  "",
  "bg-red-500",
  "bg-red-400",
  "bg-amber-400",
  "bg-emerald-400",
  "bg-blue-400",
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  const passed = STRENGTH_RULES.filter((r) => r.test(password)).length;

  return (
    <div className="mt-2 space-y-2">
      {/* Strength bar */}
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
      {passed > 0 && (
        <p
          className={cn(
            "text-xs font-medium",
            passed <= 2
              ? "text-red-400"
              : passed === 3
                ? "text-amber-400"
                : passed === 4
                  ? "text-emerald-400"
                  : "text-blue-400",
          )}
        >
          {STRENGTH_LABELS[passed]}
        </p>
      )}

      {/* Rule checklist */}
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

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedPlan = normalizeOwnerPlan(searchParams.get("plan") ?? "free");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [submitErrorDetails, setSubmitErrorDetails] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  // Keep strength indicator in sync without re-rendering the whole form
  useEffect(() => {
    const subscription = watch((v) => setPasswordValue(v.password ?? ""));
    return () => subscription.unsubscribe();
  }, [watch]);

  async function onSubmit(data: RegisterForm) {
    setSubmitErrorDetails([]);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: data.fullName,
          email: data.email,
          password: data.password,
          consentGiven: data.consentGiven,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const details: string[] = Array.isArray(json.details)
          ? json.details.map((item: unknown) => {
              if (typeof item === "string") return item;
              if (
                item &&
                typeof item === "object" &&
                "field" in item &&
                "message" in item
              ) {
                return `${String(item.field)}: ${String(item.message)}`;
              }
              return JSON.stringify(item);
            })
          : [];

        setSubmitErrorDetails(details);
        toast.error(json.error ?? details[0] ?? "Registration failed.");
        return;
      }

      if (json.redirectTo) {
        toast.success(json.message ?? "Registration successful. Continuing...");
        router.push(json.redirectTo);
        return;
      }

      toast.success(json.message ?? "Registration successful. Continuing...");
      router.push("/onboarding");
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  return (
    <Card className="w-full rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/30 backdrop-blur-2xl dark:bg-white/5">
      <CardHeader className="space-y-4 pb-4 pt-8">
        <div className="flex justify-center">
          <div className="glow-ring flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400">
            <Building2 className="h-7 w-7 text-white drop-shadow" />
          </div>
        </div>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Create your account
          </CardTitle>
          <CardDescription className="text-white/60">
            Manage your property with NestDesk
          </CardDescription>
          <p className="mt-2 text-sm text-white/70">
            Selected plan:{" "}
            <span className="font-semibold text-white">
              {formatPlanLabel(selectedPlan)}
            </span>
          </p>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Full name */}
          <div className="space-y-1.5">
            <Label htmlFor="fullName" className="text-white/80">
              Full name
            </Label>
            <Input
              id="fullName"
              type="text"
              placeholder="Owner Name"
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

          {/* Password + strength */}
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
                aria-label={showConfirm ? "Hide password" : "Show password"}
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
              <PrivacyPolicyLink className="text-white/80" /> and consent to my
              personal data being used for property management purposes by NestDesk.
            </Label>
          </div>
          {errors.consentGiven && (
            <p className="text-xs text-red-400">{errors.consentGiven.message}</p>
          )}

          <Button
            type="submit"
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>

          {submitErrorDetails.length > 0 && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <p className="mb-1 text-xs font-semibold text-red-300">
                Registration details:
              </p>
              <ul className="space-y-1 text-xs text-red-200">
                {submitErrorDetails.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-white/70 underline underline-offset-2 hover:text-white"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
