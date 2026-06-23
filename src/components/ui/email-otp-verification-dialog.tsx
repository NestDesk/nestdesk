"use client";

import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "./button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";

interface EmailOtpVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  otpCode: string;
  onOtpChange: (value: string) => void;
  onVerify: () => void;
  onResend: () => void;
  sendingOtp: boolean;
  verifyingOtp: boolean;
  otpSent: boolean;
}

export function EmailOtpVerificationDialog({
  open,
  onOpenChange,
  email,
  otpCode,
  onOtpChange,
  onVerify,
  onResend,
  sendingOtp,
  verifyingOtp,
  otpSent,
}: EmailOtpVerificationDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(180);
  const otpDigits = useMemo(() => otpCode.padEnd(6, "").slice(0, 6).split(""), [otpCode]);

  useEffect(() => {
    if (!open) return;

    setSecondsLeft(180);
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [open, otpSent]);

  function updateDigit(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "").slice(0, 1);
    const next = otpCode.slice(0, index) + cleaned + otpCode.slice(index + 1);
    onOtpChange(next.slice(0, 6));

    if (cleaned && index < 5) {
      const input = document.getElementById(`otp-digit-${index + 1}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (otpCode[index] || index > 0) {
        const next = otpCode.slice(0, index) + otpCode.slice(index + 1);
        onOtpChange(next.slice(0, 6));
        const input = document.getElementById(`otp-digit-${index}`) as HTMLInputElement | null;
        input?.focus();
        input?.select();
      }
    }

    if (event.key === "ArrowLeft" && index > 0) {
      const input = document.getElementById(`otp-digit-${index - 1}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }

    if (event.key === "ArrowRight" && index < 5) {
      const input = document.getElementById(`otp-digit-${index + 1}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    onOtpChange(pasted);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-3xl border border-border/70 bg-background p-0 shadow-2xl shadow-black/10 dark:shadow-black/30"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <div className="p-6">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-semibold">Verify your email</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to {email || "your email address"}.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Input
                  key={index}
                  id={`otp-digit-${index}`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpDigits[index] ?? ""}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  className="h-12 rounded-2xl border-border bg-muted/30 text-center text-lg font-semibold shadow-none focus-visible:border-primary focus-visible:ring-primary/20"
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{otpSent ? "OTP sent successfully." : "We’ll send a fresh code if needed."}</span>
              <button
                type="button"
                onClick={() => {
                  setSecondsLeft(180);
                  onResend();
                }}
                disabled={sendingOtp || secondsLeft > 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-foreground/80 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {sendingOtp ? "Sending..." : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend OTP"}
              </button>
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={onVerify}
                disabled={verifyingOtp || otpCode.length !== 6}
              >
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
