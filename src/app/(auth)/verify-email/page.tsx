import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface VerifyEmailPageProps {
  searchParams?: {
    email?: string | string[];
  };
}

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const emailParam = searchParams?.email;
  const email = Array.isArray(emailParam) ? emailParam[0] : emailParam;

  return (
    <Card className="w-full rounded-3xl border border-white/10 bg-white/10 shadow-2xl shadow-black/30 backdrop-blur-2xl dark:bg-white/5">
      <CardHeader className="space-y-4 pb-4 pt-8">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/30">
            <Mail className="h-7 w-7 text-white drop-shadow" />
          </div>
        </div>
        <div className="text-center">
          <CardTitle className="text-2xl font-bold text-white">
            Check your email
          </CardTitle>
          <CardDescription className="text-white/60">
            We sent a verification link to your inbox
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-8">
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          <p>
            Click the link in the email to verify your address and activate your
            account.
          </p>
          {email && (
            <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
              Verification link sent to:{" "}
              <span className="font-semibold">{email}</span>
            </p>
          )}
          <ul className="list-inside list-disc space-y-1 text-xs text-white/40">
            <li>The link expires in 24 hours</li>
            <li>Check your spam folder if you don&apos;t see it</li>
            <li>Only one active verification link at a time</li>
          </ul>
        </div>

        <Button
          asChild
          variant="ghost"
          className="mt-6 w-full rounded-xl border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
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
