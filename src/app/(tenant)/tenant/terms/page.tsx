"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Loader2, Phone, UserCog } from "lucide-react";
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

type StaffMember = {
  id: string;
  name: string;
  phone: string;
  designation: string;
  hostel_id: string | null;
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  pg: "PG",
  hostel: "Hostel",
  coliving: "Co-living",
  rental: "Rental",
};

export default function TenantTermsPage() {
  const [data, setData] = useState<TermsData | null>(null);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/tenant/terms").then((r) => r.json()),
      fetch("/api/settings/support-staff").then((r) => r.json()),
    ])
      .then(([termsData, staffData]) => {
        setData(termsData);
        setStaff(Array.isArray(staffData) ? staffData : []);
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

      {/* Support Staff */}
      {staff.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Support Contacts</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-3 py-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserCog className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <span>{s.phone}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{s.designation}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
