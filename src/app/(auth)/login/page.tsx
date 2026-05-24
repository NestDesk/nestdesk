"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Building2, Loader2, Eye, EyeOff, AlertTriangle } from "lucide-react";
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

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-white/10 bg-white/10 p-8" />
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [rateLimitMsg, setRateLimitMsg] = useState<string | null>(null);

  // Show friendly message if redirected due to idle timeout
  const reason = searchParams.get("reason");
  const authError = searchParams.get("error");
  const passwordReset = searchParams.get("passwordReset");
  const redirectTo = searchParams.get("redirectTo") ?? "/dashboard";

  const authErrorMessage =
    authError === "missing_code"
      ? "That sign-in link is incomplete. Please try again."
      : authError === "invalid_link"
        ? "That verification or recovery link is no longer valid. Request a new one."
        : null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginForm) {
    setRateLimitMsg(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          const minutes = Math.ceil((json.retryAfterSeconds ?? 900) / 60);
          setRateLimitMsg(
            `Too many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? "s" : ""}.`,
          );
          return;
        }
        toast.error(json.error ?? "Sign in failed.");
        return;
      }

      router.push(json.redirectTo ?? redirectTo);
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
            Welcome back
          </CardTitle>
          <CardDescription className="text-white/60">
            Sign in to your NestDesk account
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-8">
        {reason === "idle" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            You were signed out after 30 minutes of inactivity.
          </div>
        )}

        {passwordReset === "success" && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Your password was updated. Sign in with your new password.
          </div>
        )}

        {authErrorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {authErrorMessage}
          </div>
        )}

        {rateLimitMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {rateLimitMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password" className="text-white/80">
                Password
              </Label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-white/60 underline underline-offset-2 transition-colors hover:text-white"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
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
            {errors.password && (
              <p className="text-xs text-red-400">{errors.password.message}</p>
            )}
          </div>

          <Button
            type="submit"
            className="mt-2 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110"
            disabled={isSubmitting || !!rateLimitMsg}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-white/70 underline underline-offset-2 hover:text-white"
          >
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
