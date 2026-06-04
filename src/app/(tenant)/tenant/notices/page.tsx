"use client";

import { useEffect, useState } from "react";
import { Bell, CalendarDays, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { formatDateInIndia } from "@/lib/date";
import { Card, CardContent } from "@/components/ui/card";

type TenantNotice = {
  id: string;
  title: string;
  body: string;
  published_at: string | null;
  created_at: string;
};

function formatDate(iso: string) {
  return formatDateInIndia(iso, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function TenantNoticesPage() {
  const [notices, setNotices] = useState<TenantNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [inactive, setInactive] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/tenant/notices", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "Could not load notices.");
          return;
        }
        if (json.inactive) {
          setInactive(true);
          return;
        }
        setNotices((json.notices ?? []) as TenantNotice[]);
      } catch {
        toast.error("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load().catch(() => {
      // handled above
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Megaphone className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Notices
          </h1>
          <p className="text-sm text-muted-foreground">
            Announcements and updates from your property.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : inactive ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            Account not yet active
          </p>
          <p className="text-xs text-muted-foreground">
            Notices will appear here once your tenancy is approved.
          </p>
        </div>
      ) : notices.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">No notices yet</p>
          <p className="text-xs text-muted-foreground">
            Notices posted by your property owner will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((n, idx) => (
            <Card
              key={n.id}
              className="group rounded-2xl border border-border/70 bg-card/70 transition-shadow hover:shadow-sm"
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  {/* Icon bubble */}
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      idx === 0
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Bell className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {n.title}
                      </h3>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(n.published_at ?? n.created_at)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {n.body}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
