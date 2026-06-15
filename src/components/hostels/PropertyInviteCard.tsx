"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, Link2, QrCode, Check, Hash } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type Props = {
  joinToken: string;
  propertyName: string;
  propertyCode?: string;
};

export function PropertyInviteCard({
  joinToken,
  propertyName,
  propertyCode,
}: Props) {
  const [joinUrl, setJoinUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Build absolute URL client-side so it works across environments
    setJoinUrl(`${window.location.origin}/join/${joinToken}`);
  }, [joinToken]);

  async function copyLink() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      toast.success("Invite link copied to clipboard.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Could not copy. Please copy the link manually.");
    }
  }

  async function copyCode() {
    if (!propertyCode) return;
    try {
      await navigator.clipboard.writeText(propertyCode);
      setCodeCopied(true);
      toast.success("Property code copied.");
      setTimeout(() => setCodeCopied(false), 2500);
    } catch {
      toast.error("Could not copy. Please copy the code manually.");
    }
  }

  function downloadQr() {
    if (!svgRef.current || !joinUrl) return;

    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `${propertyName.replace(/\s+/g, "-").toLowerCase()}-invite-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <QrCode className="h-4 w-4 text-primary" />
          Tenant Invite Link
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Share this link or QR code with tenants so they can self-register for{" "}
          <span className="font-medium text-foreground">{propertyName}</span>.
        </p>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Property code row */}
        {propertyCode ? (
          <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
            <Hash className="h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-xs text-muted-foreground">Property Code</span>
              <span className="font-mono text-sm font-semibold tracking-widest text-foreground">
                {propertyCode}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 rounded-lg px-2 text-xs"
              onClick={copyCode}
            >
              {codeCopied ? (
                <>
                  <Check className="mr-1 h-3 w-3 text-emerald-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </>
              )}
            </Button>
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Tenants can visit{" "}
          <span className="font-medium text-foreground">nestdesk.in/join</span> and
          enter the property code above, or scan the QR code below.
        </p>
        {/* URL row */}
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
            {joinUrl || "Loading…"}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 rounded-lg px-2 text-xs"
            onClick={copyLink}
            disabled={!joinUrl}
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3 w-3 text-emerald-500" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3 w-3" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* QR Code */}
        {joinUrl ? (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="rounded-xl border border-border/60 bg-white p-3 shadow-sm">
              <QRCodeSVG
                ref={svgRef}
                value={joinUrl}
                size={160}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="M"
                includeMargin={false}
              />
            </div>

            <div className="flex flex-col gap-2 sm:pt-1">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Tenants can scan this QR code with any camera app to open the
                registration page for this property.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit rounded-lg"
                onClick={downloadQr}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Download QR Code
              </Button>
            </div>
          </div>
        ) : (
          <div className="h-[160px] w-[160px] animate-pulse rounded-xl bg-muted" />
        )}
      </CardContent>
    </Card>
  );
}
