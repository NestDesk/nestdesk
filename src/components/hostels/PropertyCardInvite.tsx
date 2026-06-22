"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Hash, Link2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "../ui/button";

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

      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 36;
      const qrImage = canvas.toDataURL("image/png");
      const safeName = propertyName.trim() || "Property";

      pdf.setFillColor(248, 250, 252);
      pdf.rect(0, 0, pageWidth, pdf.internal.pageSize.getHeight(), "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.text(`Join ${safeName}`, margin, 52);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text("Tenants can use the QR code and steps below to join this property and create their account.", margin, 78, { maxWidth: pageWidth - margin * 2 });

      pdf.setDrawColor(226, 232, 240);
      pdf.roundedRect(margin, 96, pageWidth - margin * 2, 260, 12, 12, "S");

      if (propertyCode) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text("Property code:", margin + 36, 120);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(propertyCode, margin + 36, 138);
      }

      const qrX = margin + (pageWidth - margin * 2 - 140) / 2;
      pdf.addImage(qrImage, "PNG", qrX, 160, 140, 140);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.text("How tenants can join", margin + 36, 388);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      const instructions = [
        "1. Open the www.nestdesk.in/join link or scan the QR code with a phone camera.",
        "2. Enter the property code if asked, or continue with the invite link.",
        "3. Fill in the tenant details and create a password to complete account setup.",
        "4. Once registered, the tenant can sign in and view their account and property details.",
        "5. Please upload your Aadhaar card and any alternate ID proof for verification.",
        "6. Tenants can also see payment history, download receipts, and manage their profile.",
        "7. Tenants can raise maintenance requests and view their status.",
        "8. Tenants can view any notices published by the property management.",
      ];  
      instructions.forEach((line, index) => {
        pdf.text(line, margin + 36, 422 + index * 18, { maxWidth: pageWidth - margin * 2 - 36 });
      });

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(`Join link: ${joinUrl}`, margin, 320, { maxWidth: pageWidth - margin * 2 });
      pdf.save(`${safeName.replace(/\s+/g, "-").toLowerCase()}-join-guide.pdf`);
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
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={copyCode}
            className="w-[75px] h-6 rounded-lg text-[10px]"
          >
            {codeCopied ? (
              <Check className="h-2.5 w-2.5 text-emerald-500" />
            ) : (
              <Copy className="h-2.5 w-2.5" />
            )}
            {codeCopied ? "Copied" : "Copy"}
          </Button>
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
          <div className="flex flex-col gap-1.5 self-start">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-[100px] h-6 rounded-lg px-2 text-[10px]"
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
              className="w-[100px] h-6 rounded-lg px-2 text-[10px]"
              onClick={downloadQr}
              disabled={!joinUrl}
            >
              <Download className="mr-1 h-2.5 w-2.5" />
              QR PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
