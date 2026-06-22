"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, MessageCircle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

const passwordRegex = {
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
};

export default function RecoverPhonePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"phone" | "otp" | "reset">("phone");
  const [phone, setPhone] = useState("");
  const [reqId, setReqId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resetting, setResetting] = useState(false);

  const phoneValid = /^\d{10}$/.test(phone);
  const otpValid = /^\d{6}$/.test(otpCode);
  const passwordValid =
    newPassword.length >= 8 &&
    passwordRegex.upper.test(newPassword) &&
    passwordRegex.lower.test(newPassword) &&
    passwordRegex.digit.test(newPassword);

  async function handleSendOtp() {
    if (!phoneValid) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }

    setSendingOtp(true);
    try {
      const res = await fetch("/api/auth/recover-by-phone/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Could not send OTP.");
        return;
      }

      setReqId(json.reqId ?? "");
      setPhase("otp");
      toast.success(json.message ?? "OTP sent to your phone.");
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
    if (!phoneValid) {
      toast.error("Enter a valid 10-digit phone number.");
      return;
    }
    if (!otpValid) {
      toast.error("Enter the 6-digit OTP.");
      return;
    }

    setVerifyingOtp(true);
    try {
      const res = await fetch("/api/auth/recover-by-phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otpCode, reqId }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "OTP verification failed.");
        return;
      }

      setRecoveryToken(json.recoveryToken);
      setPhase("reset");
      toast.success("Phone verified. You may now reset your password.");
    } catch {
      toast.error("Network error while verifying OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handleReset() {
    if (!passwordValid) {
      toast.error(
        "Password must be at least 8 characters long and include uppercase, lowercase, and a number.",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setResetting(true);
    try {
      const res = await fetch("/api/auth/recover-by-phone/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recoveryToken,
          newPassword,
          confirmPassword,
          newEmail: newEmail.trim(),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Unable to reset password.");
        return;
      }

      toast.success(json.message ?? "Password reset successfully.");
      router.push("/login");
    } catch {
      toast.error("Network error while resetting password.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-xl rounded-3xl border border-border bg-card shadow-2xl shadow-black/10">
        <CardHeader className="space-y-4 px-6 py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-primary/10 text-primary">
            <MessageCircle className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Recover account</CardTitle>
          <CardDescription className="text-muted-foreground">
            Recover access using your verified phone number, then reset your password.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-8">
          {phase === "phone" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <div className="flex overflow-hidden rounded-xl border border-border bg-background">
                  <span className="flex items-center px-3 text-sm text-muted-foreground">+91</span>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={phone}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "").slice(0, 10);
                      setPhone(value);
                    }}
                    placeholder="1234567890"
                  />
                </div>
              </div>

              <Button
                type="button"
                className="w-full rounded-xl"
                disabled={!phoneValid || sendingOtp}
                onClick={handleSendOtp}
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Send OTP...
                  </>
                ) : (
                  "Send OTP"
                )}
              </Button>
            </div>
          )}

          {phase === "otp" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <div className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground">
                  +91 {phone}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="otpCode">OTP code</Label>
                <Input
                  id="otpCode"
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => {
                    const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                    setOtpCode(value);
                  }}
                  placeholder="Enter 6-digit code"
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  className="w-full rounded-xl"
                  disabled={!otpValid || verifyingOtp}
                  onClick={handleVerifyOtp}
                >
                  {verifyingOtp ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verify OTP
                    </>
                  ) : (
                    "Verify OTP"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full rounded-xl"
                  disabled={sendingOtp}
                  onClick={handleSendOtp}
                >
                  {sendingOtp ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending...
                    </>
                  ) : (
                    "Resend OTP"
                  )}
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full rounded-xl"
                onClick={() => setPhase("phone")}
              >
                Change phone number
              </Button>
            </div>
          )}

          {phase === "reset" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <div className="rounded-xl border border-border bg-background px-3 py-3 text-sm text-foreground">
                  +91 {phone}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newEmail">New email (optional)</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  placeholder="you@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  If your email was incorrect, update it here. A verification email will be sent to the new address.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Must be at least 8 characters and include uppercase, lowercase, and a number.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="Repeat new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="button"
                className="w-full rounded-xl"
                disabled={!passwordValid || !confirmPassword || resetting}
                onClick={handleReset}
              >
                {resetting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reset password
                  </>
                ) : (
                  "Reset password"
                )}
              </Button>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 text-center text-sm text-muted-foreground">
            <Link href="/auth/forgot-password" className="text-primary underline underline-offset-2">
              Recover by email
            </Link>
            <Link href="/login" className="text-primary underline underline-offset-2">
              Back to sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
