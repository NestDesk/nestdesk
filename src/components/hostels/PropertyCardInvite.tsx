"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Hash, Link2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  joinToken: string;
  propertyCode?: string;
  propertyName: string;
};

export function PropertyCardInvite({
  joinToken,
  propertyCode,
  propertyName,
}: Props) {
  const [joinUrl, setJoinUrl] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}/join/${joinToken}`);
  }, [joinToken]);

  async function copyLink() {
    if (!joinUrl) return;
    try {
      await navigator.clipboard.writeText(joinUrl);
      setLinkCopied(true);
      toast.success("Invite link copied.");
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      toast.error("Could not copy.");
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
      toast.error("Could not copy.");
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
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `${propertyName.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  }

  return (
    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2.5">
      <p className="text-xs font-semibold text-foreground">Tenant Signup</p>

      {/* Property code */}
      {propertyCode ? (
        <div className="flex items-center gap-2">
          <Hash className="h-3 w-3 shrink-0 text-primary" />
          <span className="flex-1 font-mono text-xs font-bold tracking-widest text-foreground">
            {propertyCode}
          </span>
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            {codeCopied ? (
              <Check className="h-2.5 w-2.5 text-emerald-500" />
            ) : (
              <Copy className="h-2.5 w-2.5" />
            )}
            {codeCopied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {/* QR + link row */}
      <div className="flex items-start gap-3">
        {/* QR code */}
        <div className="shrink-0 rounded-lg border border-border/60 bg-white p-1.5">
          <QRCodeSVG
            ref={svgRef}
            value={joinUrl || "about:blank"}
            size={80}
            level="M"
          />
        </div>

        {/* Link + buttons */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate font-mono text-[10px] text-muted-foreground">
              {joinUrl || "Loading…"}
            </span>
          </div>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 rounded-lg px-2 text-[10px]"
              onClick={copyLink}
              disabled={!joinUrl}
            >
              {linkCopied ? (
                <Check className="mr-1 h-2.5 w-2.5 text-emerald-500" />
              ) : (
                <Copy className="mr-1 h-2.5 w-2.5" />
              )}
              {linkCopied ? "Copied" : "Copy link"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 rounded-lg px-2 text-[10px]"
              onClick={downloadQr}
              disabled={!joinUrl}
            >
              <Download className="mr-1 h-2.5 w-2.5" />
              QR
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
