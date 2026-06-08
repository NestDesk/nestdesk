"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { cn } from "../../../lib/utils";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters.")
      .regex(/[A-Z]/, "Add at least one uppercase letter.")
      .regex(/[a-z]/, "Add at least one lowercase letter.")
      .regex(/[0-9]/, "Add at least one number."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

interface StrengthRule {
  label: string;
  test: (value: string) => boolean;
}

const STRENGTH_RULES: StrengthRule[] = [
  { label: "At least 8 characters", test: (value) => value.length >= 8 },
  { label: "Uppercase letter (A-Z)", test: (value) => /[A-Z]/.test(value) },
  { label: "Lowercase letter (a-z)", test: (value) => /[a-z]/.test(value) },
  { label: "Number (0-9)", test: (value) => /[0-9]/.test(value) },
];

function PasswordChecklist({ password }: { password: string }) {
  if (!password) {
    return null;
  }

  return (
    <ul className="mt-2 space-y-1">
      {STRENGTH_RULES.map((rule) => {
        const ok = rule.test(password);

        return (
          <li key={rule.label} className="flex items-center gap-1.5 text-xs">
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
            )}
            <span className={cn(ok ? "text-foreground" : "text-muted-foreground")}>
              {rule.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  useEffect(() => {
    const subscription = watch((value) => setPasswordValue(value.password ?? ""));
    return () => subscription.unsubscribe();
  }, [watch]);

  async function onSubmit(data: ResetPasswordForm) {
    setSessionExpired(false);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: data.password }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setSessionExpired(true);
          return;
        }

        toast.error(json.error ?? "Unable to update your password.");
        return;
      }

      toast.success("Password updated successfully. Redirecting to login...");
      await router.push("/login?passwordReset=success");
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  return (
    <Card className="w-full rounded-3xl border border-border/70 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-2xl dark:bg-slate-950/80 dark:border-white/10">
      <CardHeader className="space-y-4 pb-4 pt-8">
        <div className="flex justify-center">
          <div className="glow-ring flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400">
            <KeyRound className="h-7 w-7 text-white drop-shadow" />
          </div>
        </div>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">
            Set a new password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a strong password for your NestDesk account.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-8">
        {sessionExpired && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            This reset session has expired or is no longer valid. Request a fresh
            link to continue.
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-foreground">
              New password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars, mixed case + number"
                autoComplete="new-password"
                className="rounded-xl border-border/60 bg-background/90 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
              <PasswordChecklist password={passwordValue} />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword" className="text-foreground">
              Confirm new password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="new-password"
                className="rounded-xl border-border/60 bg-background/90 pr-10 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30"
                {...register("confirmPassword")}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? (
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

          <Button
            type="submit"
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating
                password...
              </>
            ) : (
              "Update password"
            )}
          </Button>
        </form>

        <Button
          asChild
          variant="ghost"
          className="mt-6 w-full rounded-xl border border-border/60 text-foreground/70 hover:bg-muted/10 hover:text-foreground"
        >
          <Link href={sessionExpired ? "/forgot-password" : "/login"}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {sessionExpired ? "Request another reset link" : "Back to sign in"}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
