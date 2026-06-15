"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { TrendingUp, RefreshCw, Building2, Users, Clock } from "lucide-react";

export const dynamic = "force-dynamic";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { formatDateInIndia } from "../../../lib/date";

type Lead = {
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  institution_name: string | null;
  property_count: number | null;
  tenant_count: number | null;
  preferred_timeline: string | null;
  status: "fresh" | "contacted" | "closed" | "rejected";
  created_at: string;
  updated_at: string;
};

const STATUS_CONFIG: Record<Lead["status"], { label: string; class: string }> = {
  fresh: {
    label: "Fresh",
    class:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  },
  contacted: {
    label: "Contacted",
    class: "bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400",
  },
  closed: {
    label: "Closed",
    class: "bg-zinc-500/10 text-zinc-600 border-zinc-500/30 dark:text-zinc-400",
  },
  rejected: {
    label: "Rejected",
    class: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
  },
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/leads?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load leads");
      const data = (await res.json()) as { leads: Lead[]; total: number };
      setLeads(data.leads);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  async function updateStatus(lead: Lead, newStatus: Lead["status"]) {
    const key = `${lead.contact_email}-${lead.created_at}`;
    setUpdatingKey(key);
    try {
      const res = await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: lead.contact_email,
          createdAt: lead.created_at,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Update failed");
      setLeads((prev) =>
        prev.map((l) =>
          l.contact_email === lead.contact_email && l.created_at === lead.created_at
            ? { ...l, status: newStatus }
            : l,
        ),
      );
      toast.success("Lead status updated.");
    } catch {
      toast.error("Failed to update lead status.");
    } finally {
      setUpdatingKey(null);
    }
  }

  const counts = leads.reduce(
    (acc, l) => {
      acc[l.status] = (acc[l.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10">
            <TrendingUp className="h-6 w-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Sales Pipeline
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
              Leads
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} institution lead{total !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-36 rounded-xl text-sm">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="fresh">Fresh</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-xl"
            onClick={fetchLeads}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status summary chips */}
      <div className="flex flex-wrap gap-2">
        {(["fresh", "contacted", "closed", "rejected"] as Lead["status"][]).map(
          (s) => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-opacity ${cfg.class} ${statusFilter !== "all" && statusFilter !== s ? "opacity-40" : ""}`}
              >
                {cfg.label}
                <span className="rounded-full bg-current/10 px-1.5 py-0.5 text-[10px]">
                  {counts[s] ?? 0}
                </span>
              </button>
            );
          },
        )}
      </div>

      {/* Leads grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card className="rounded-2xl border border-border/60">
          <CardContent className="py-16 text-center">
            <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              No leads found.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {leads.map((lead) => {
            const key = `${lead.contact_email}-${lead.created_at}`;
            const cfg = STATUS_CONFIG[lead.status];
            return (
              <Card
                key={key}
                className="rounded-2xl border border-border/60 shadow-sm transition-shadow hover:shadow-md"
              >
                <CardHeader className="pb-2 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-sm font-semibold">
                        {lead.contact_name}
                      </CardTitle>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {lead.contact_email}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${cfg.class}`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pb-4">
                  {lead.institution_name && (
                    <p className="text-xs font-medium text-foreground">
                      {lead.institution_name}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    {lead.property_count !== null && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {lead.property_count} properties
                      </span>
                    )}
                    {lead.tenant_count !== null && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {lead.tenant_count} tenants
                      </span>
                    )}
                    {lead.preferred_timeline && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lead.preferred_timeline}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    📞 {lead.contact_phone}
                  </p>
                  <div className="flex items-center justify-between gap-2 border-t border-border/40 pt-2">
                    <span className="text-[10px] text-muted-foreground">
                      {formatDateInIndia(lead.created_at, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <Select
                      value={lead.status}
                      onValueChange={(v) => updateStatus(lead, v as Lead["status"])}
                      disabled={updatingKey === key}
                    >
                      <SelectTrigger className="h-7 w-28 rounded-lg text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fresh">Fresh</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
