"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, ArrowRight, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import Link from "next/link";

/**
 * /join — public page where a tenant can:
 *   1. Paste their full invite link  (https://...nestdesk.in/join/TOKEN)
 *   2. Type the short property code  (SBH-47293810)
 *
 * Both routes ultimately redirect the user to /join/[token].
 */

function isPropertyCode(value: string) {
  return /^[A-Z]{1,3}-\d{8}$/i.test(value.trim());
}

function extractTokenFromUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    // Expect pathname: /join/TOKEN or /join/TOKEN/
    const match = url.pathname.match(/^\/join\/([^/]+)\/?$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

export default function JoinPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFind() {
    const trimmed = value.trim();
    if (!trimmed) {
      setErrorMsg("Enter a property code or paste your invite link.");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      // Case 1: full invite URL
      const tokenFromUrl = extractTokenFromUrl(trimmed);
      if (tokenFromUrl) {
        router.push(`/join/${tokenFromUrl}`);
        return;
      }

      // Case 2: relative /join/TOKEN path
      if (trimmed.startsWith("/join/")) {
        const token = trimmed.replace("/join/", "").replace(/\/$/, "");
        router.push(`/join/${token}`);
        return;
      }

      // Case 3: property code like SBH-47293810
      if (isPropertyCode(trimmed)) {
        const res = await fetch(
          `/api/join/by-code?code=${encodeURIComponent(trimmed.toUpperCase())}`,
        );
        const json = await res.json();
        if (!res.ok) {
          setErrorMsg(json.error ?? "Property not found.");
          return;
        }
        router.push(`/join/${json.token as string}`);
        return;
      }

      setErrorMsg(
        "Enter a valid property code (e.g. SBH-47293810) or paste your full invite link.",
      );
    } catch {
      toast.error("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      void handleFind();
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* Brand */}
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-foreground hover:opacity-80"
      >
        <Building2 className="h-6 w-6 text-primary" />
        <span className="text-xl font-bold tracking-tight">NestDesk</span>
      </Link>

      <Card className="w-full max-w-md rounded-2xl border-border/70 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">Join a Property</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the property code shared by your owner, or paste your invite link
            to complete your registration.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="code-input">Property code or invite link</Label>
            <div className="flex gap-2">
              <Input
                id="code-input"
                type="text"
                placeholder="e.g. SBH-47293810 or paste link…"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setErrorMsg(null);
                }}
                onKeyDown={onKeyDown}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className="rounded-xl"
              />
              <Button
                type="button"
                onClick={handleFind}
                disabled={loading || !value.trim()}
                className="shrink-0 rounded-xl"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Search className="mr-1.5 h-4 w-4" />
                    Find
                  </>
                )}
              </Button>
            </div>
            {errorMsg ? (
              <p className="text-xs text-destructive">{errorMsg}</p>
            ) : null}
          </div>

          <div className="rounded-xl bg-muted/50 p-4 space-y-2">
            <p className="text-xs font-medium text-foreground">
              How to get your code
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
              <li>Ask your property owner for the property code</li>
              <li>Scan the QR code posted at the property</li>
              <li>Click the invite link shared by your owner</li>
            </ul>
          </div>

          <div className="flex items-center gap-1 pt-1">
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              You will be asked to create an account after finding your property.
            </p>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Are you a property owner?{" "}
            <Link
              href="/register"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Register here
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
