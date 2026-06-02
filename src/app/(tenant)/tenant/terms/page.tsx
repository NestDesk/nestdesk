"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type TermsData = {
  hostel_name: string;
  property_type: string | null;
  terms: {
    content: string;
    is_default: boolean;
    updated_at: string;
  } | null;
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  pg: "PG",
  hostel: "Hostel",
  coliving: "Co-living",
  rental: "Rental",
};

export default function TenantTermsPage() {
  const [data, setData] = useState<TermsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/tenant/terms").then((r) => r.json())])
      .then(([termsData]) => {
        setData(termsData);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = data?.terms?.content ?? null;
  const isDefault = data?.terms?.is_default ?? true;
  const updatedAt = data?.terms?.updated_at
    ? new Date(data.terms.updated_at).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const propertyTypeLabel = data?.property_type
    ? (PROPERTY_TYPE_LABELS[data.property_type] ?? data.property_type)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Terms & Conditions
          </h2>
          <p className="text-sm text-muted-foreground">
            {data?.hostel_name ?? "Your Property"}
            {propertyTypeLabel ? (
              <>
                {" "}
                &nbsp;·&nbsp; <span>{propertyTypeLabel}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>

      {/* Disclaimer if default */}
      {(!content || isDefault) && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div className="text-sm text-amber-600 dark:text-amber-400">
            <span className="font-medium">Default terms shown.</span> Your property
            owner has not yet customized the terms and conditions. Please contact
            them for the official version.
          </div>
        </div>
      )}

      {/* Terms content */}
      <Card className="rounded-2xl border-border/70 bg-card/80">
        <CardContent className="p-5">
          {content ? (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground/80">
              {content}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              Terms and conditions have not been set for this property yet.
            </p>
          )}
          {updatedAt && !isDefault && (
            <>
              <Separator className="my-4" />
              <p className="text-xs text-muted-foreground">
                Last updated: {updatedAt}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
