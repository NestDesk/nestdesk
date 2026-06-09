"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Building2, CircleCheckBig, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-border/70 bg-card/70 p-8 shadow-sm">
          <div className="space-y-6">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-muted" />
            <div className="space-y-3">
              <Skeleton className="h-5 w-44 rounded-full" />
              <Skeleton className="h-4 w-72 rounded-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
              <Skeleton className="h-12 rounded-2xl" />
            </div>
            <Skeleton className="h-12 rounded-2xl" />
          </div>
        </div>
      }
    >
      <ForgotPasswordPageContent />
    </Suspense>
  );
}

function ForgotPasswordPageContent() {
  const searchParams = useSearchParams();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const error = searchParams.get("error");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  async function onSubmit(data: ForgotPasswordForm) {
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Unable to send reset email.");
        return;
      }

      setSubmittedEmail(data.email);
    } catch {
      toast.error("Network error. Please try again.");
    }
  }

  return (
    <Card className="w-full rounded-3xl border border-border/70 bg-card/90 shadow-2xl shadow-black/10 backdrop-blur-2xl dark:bg-slate-950/80 dark:border-white/10">
      <CardHeader className="space-y-4 pb-4 pt-8">
        <div className="flex justify-center">
          <div className="glow-ring flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-blue-400">
            {submittedEmail ? (
              <Mail className="h-7 w-7 text-white drop-shadow" />
            ) : (
              <Building2 className="h-7 w-7 text-white drop-shadow" />
            )}
          </div>
        </div>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">
            {submittedEmail ? "Check your inbox" : "Forgot your password?"}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {submittedEmail
              ? "We sent a secure reset link if the account exists."
              : "Request a reset link for your owner or tenant account."}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-8">
        {error === "invalid_or_expired_link" && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
            That reset link is invalid or has expired. Request a fresh one below.
          </div>
        )}

        {submittedEmail ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-900 dark:text-emerald-100">
              <div className="flex items-start gap-3">
                <CircleCheckBig className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
                <div className="space-y-2">
                  <p>
                    If an account exists for{" "}
                    <span className="font-semibold text-foreground dark:text-white">
                      {submittedEmail}
                    </span>
                    , a password reset link is on the way.
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-xs text-emerald-900/80 dark:text-emerald-100/75">
                    <li>Use the most recent email only</li>
                    <li>Check spam or promotions if it does not arrive soon</li>
                    <li>The link opens a secure password reset session</li>
                  </ul>
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="w-full rounded-xl border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setSubmittedEmail(null)}
            >
              Send another reset link
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className="rounded-xl border-border/60 bg-background/90 text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-rose-500">{errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="mt-2 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 font-semibold shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:brightness-110"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending reset
                  link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>
        )}

        <Button
          asChild
          variant="ghost"
          className="mt-6 w-full rounded-xl border border-border/60 text-foreground/70 hover:bg-muted hover:text-foreground"
        >
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to sign in
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
