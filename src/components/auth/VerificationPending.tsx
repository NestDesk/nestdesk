"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Mail, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface Props {
  email: string;
  message: string;
  otpCode?: string;
  onOtpChange?: (value: string) => void;
  onVerify?: () => void;
  onResend?: () => void;
  sendingOtp?: boolean;
  verifyingOtp?: boolean;
  otpSent?: boolean;
}

export function VerificationPending({
  email,
  message,
  otpCode = "",
  onOtpChange,
  onVerify,
  onResend,
  sendingOtp = false,
  verifyingOtp = false,
  otpSent = true,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(180);
  const otpDigits = useMemo(() => otpCode.padEnd(6, "").slice(0, 6).split(""), [otpCode]);

  useEffect(() => {
    setSecondsLeft(180);
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [otpSent]);

  useEffect(() => {
    const firstInput = document.getElementById("verification-otp-0") as HTMLInputElement | null;
    firstInput?.focus();
  }, []);

  function updateDigit(index: number, value: string) {
    if (!onOtpChange) return;

    const cleaned = value.replace(/\D/g, "").slice(0, 1);
    const next = otpCode.slice(0, index) + cleaned + otpCode.slice(index + 1);
    onOtpChange(next.slice(0, 6));

    if (cleaned && index < 5) {
      const input = document.getElementById(`verification-otp-${index + 1}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  function handleKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (!onOtpChange) return;

    if (event.key === "Backspace") {
      event.preventDefault();
      const hasValueAtCurrent = Boolean(otpCode[index]);
      const targetIndex = hasValueAtCurrent ? index : Math.max(0, index - 1);
      const next = otpCode.slice(0, targetIndex) + otpCode.slice(targetIndex + 1);
      const nextCode = (next.slice(0, 6)).padEnd(6, "");
      onOtpChange(nextCode.slice(0, 6));

      const input = document.getElementById(`verification-otp-${targetIndex}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }

    if (event.key === "ArrowLeft" && index > 0) {
      const input = document.getElementById(`verification-otp-${index - 1}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }

    if (event.key === "ArrowRight" && index < 5) {
      const input = document.getElementById(`verification-otp-${index + 1}`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    if (!onOtpChange) return;
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    onOtpChange(pasted);
  }

  const showOtpFlow = Boolean(onOtpChange && onVerify && onResend);

  return (
    <div className="mx-auto">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CheckCircle2 className="h-7 w-7" />
      </div>

      <div className="space-y-4 text-left">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">Email verification</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Verify your email</h1>
          <p className="text-sm leading-6 text-muted-foreground">{message}</p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Code sent to</p>
          <p className="mt-1 break-words text-sm font-medium text-foreground">{email}</p>
        </div>

        {showOtpFlow ? (
          <div className="rounded-2xl border border-border/70 bg-background/70 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span>Enter the 6-digit code</span>
            </div>

            <div className="mt-4 mx-auto grid w-full max-w-[30rem] grid-cols-6 gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Input
                  key={index}
                  id={`verification-otp-${index}`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otpDigits[index] ?? ""}
                  onChange={(event) => updateDigit(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                  className="h-14 w-full rounded-2xl border-border/70 bg-background text-center text-xl font-semibold shadow-none focus-visible:border-primary focus-visible:ring-primary/20 sm:h-16 sm:text-2xl"
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{otpSent ? "Code sent successfully." : "A fresh code will be sent if needed."}</span>
              <button
                type="button"
                onClick={() => onResend?.()}
                disabled={sendingOtp || secondsLeft > 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-foreground/80 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {sendingOtp ? "Sending..." : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend code"}
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href="/login">Back to sign in</Link>
              </Button>
              <Button
                type="button"
                className="rounded-xl"
                onClick={onVerify}
                disabled={verifyingOtp || otpCode.length !== 6}
              >
                {verifyingOtp ? "Verifying..." : "Verify code"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/login">Back to sign in</Link>
            </Button>
            <Button asChild className="rounded-xl">
              <a href="mailto:support@nestdesk.in">Contact support</a>
            </Button>
          </div>
        )}
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
        <Mail className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Check your inbox and spam folder if needed. The code expires in a few minutes.</span>
      </div>
    </div>
  );
}
