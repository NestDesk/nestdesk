"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MessageSquare,
  Send,
  User,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type OwnerComment = {
  id: string;
  comment: string;
  created_at: string;
};

type MaintenanceRequest = {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "rejected" | "completed" | string;
  created_at: string;
  updated_at: string;
  hostel_name: string;
  hostel_location: string | null;
  tenant_name: string;
  room_number: string | null;
  owner_comments: OwnerComment[];
};

const STATUS_CHIP_CLASS: Record<string, string> = {
  open: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  in_progress:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
  completed:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
  resolved:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
  closed:
    "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-300",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
] as const;

export default function OwnerMaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [statusDrafts, setStatusDrafts] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const openCount = useMemo(
    () => requests.filter((r) => r.status === "open").length,
    [requests],
  );

  async function loadRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/maintenance", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load maintenance requests.");
        return;
      }
      const rows = (json.requests ?? []) as MaintenanceRequest[];
      setRequests(rows);
      const nextStatusDrafts: Record<string, string> = {};
      rows.forEach((row) => {
        nextStatusDrafts[row.id] = row.status;
      });
      setStatusDrafts(nextStatusDrafts);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests().catch(() => {
      // handled in loadRequests
    });
  }, []);

  async function saveRequestChanges(request: MaintenanceRequest) {
    const requestId = request.id;
    const nextStatus = statusDrafts[requestId] ?? request.status;
    const nextComment = (commentDrafts[requestId] ?? "").trim();
    const statusChanged = nextStatus !== request.status;

    if (!statusChanged && !nextComment) {
      toast.error("No changes to save.");
      return;
    }

    setSavingId(requestId);
    try {
      if (statusChanged) {
        const statusRes = await fetch(`/api/maintenance/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        const statusJson = await statusRes.json();
        if (!statusRes.ok) {
          toast.error(statusJson.error ?? "Could not update status.");
          return;
        }

        setRequests((prev) =>
          prev.map((r) =>
            r.id === requestId
              ? {
                  ...r,
                  status: nextStatus,
                  updated_at:
                    statusJson.request?.updated_at ?? new Date().toISOString(),
                }
              : r,
          ),
        );
      }

      if (nextComment) {
        const commentRes = await fetch(`/api/maintenance/${requestId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment: nextComment }),
        });
        const commentJson = await commentRes.json();
        if (!commentRes.ok) {
          toast.error(commentJson.error ?? "Could not add comment.");
          return;
        }

        const added = commentJson.comment as OwnerComment | undefined;
        if (added) {
          setRequests((prev) =>
            prev.map((r) =>
              r.id === requestId
                ? {
                    ...r,
                    owner_comments: [...r.owner_comments, added],
                  }
                : r,
            ),
          );
        }
        setCommentDrafts((prev) => ({ ...prev, [requestId]: "" }));
      }

      toast.success("Changes saved.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Maintenance
          </h1>
          <p className="text-sm text-muted-foreground">
            Track tenant requests, add comments, and update progress.
          </p>
        </div>
        {openCount > 0 ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            {openCount} open request{openCount === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            All requests resolved
          </span>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Wrench className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No maintenance requests yet.
          </p>
          <p className="text-xs text-muted-foreground/70">
            New tenant requests will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => {
            const isDirty =
              (statusDrafts[request.id] ?? request.status) !== request.status ||
              (commentDrafts[request.id] ?? "").trim().length > 0;
            const isExpanded = expandedId === request.id;

            return (
              <Card
                key={request.id}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-shadow duration-150",
                  isDirty || isExpanded
                    ? "border-primary/30 shadow-md shadow-primary/5"
                    : "border-border/70 hover:border-border hover:shadow-sm",
                )}
              >
                <CardContent className="p-0">
                  {/* ── Accordion header (always visible) ── */}
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => toggleExpand(request.id)}
                  >
                    <div className="flex items-center gap-2.5 p-3">
                      {/* Icon pill */}
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {request.title}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <User className="h-3 w-3 shrink-0" />
                            {request.tenant_name}
                            {request.room_number
                              ? ` · Room ${request.room_number}`
                              : ""}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0 text-primary/60" />
                            {request.hostel_name}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                            {new Date(request.created_at).toLocaleDateString(
                              "en-IN",
                              { day: "numeric", month: "short", year: "numeric" },
                            )}
                          </span>
                          {request.owner_comments.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <MessageSquare className="h-3 w-3" />
                              {request.owner_comments.length}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="ml-auto flex shrink-0 items-center gap-2">
                        <Badge
                          className={cn(
                            "text-[11px]",
                            STATUS_CHIP_CLASS[request.status],
                          )}
                        >
                          {request.status.replace("_", " ")}
                        </Badge>
                        {isDirty ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        ) : null}
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200",
                            isExpanded && "rotate-180",
                          )}
                        />
                      </div>
                    </div>
                  </button>

                  {/* ── Expandable panel ── */}
                  {isExpanded ? (
                    <div className="border-t border-border/60 bg-muted/20 px-3 pb-3 pt-3">
                      {/* Description */}
                      {request.description ? (
                        <p className="mb-2.5 rounded-lg border border-border/50 bg-background/60 px-2 py-1.5 text-xs text-muted-foreground">
                          {request.description}
                        </p>
                      ) : null}

                      {/* Comments history */}
                      {request.owner_comments.length > 0 ? (
                        <div className="mb-2.5">
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                            Comments
                          </p>
                          <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                            {request.owner_comments.map((comment) => (
                              <div
                                key={comment.id}
                                className="flex gap-2 rounded-lg border border-border/60 bg-background/80 px-2.5 py-2"
                              >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                  <MessageSquare className="h-2.5 w-2.5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs leading-relaxed text-foreground/90">
                                    {comment.comment}
                                  </p>
                                  <p className="mt-1 text-[10px] text-muted-foreground">
                                    {new Date(comment.created_at).toLocaleDateString(
                                      "en-IN",
                                      {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                      },
                                    )}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {/* Add comment + status row */}
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-1.5">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                            Add comment
                          </label>
                          <textarea
                            rows={2}
                            value={commentDrafts[request.id] ?? ""}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [request.id]: e.target.value,
                              }))
                            }
                            placeholder="Write an update visible to the tenant…"
                            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          />
                        </div>

                        <div className="flex shrink-0 flex-col gap-2">
                          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                            Status
                          </label>
                          <select
                            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={statusDrafts[request.id] ?? request.status}
                            disabled={savingId === request.id}
                            onChange={(e) =>
                              setStatusDrafts((prev) => ({
                                ...prev,
                                [request.id]: e.target.value,
                              }))
                            }
                          >
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s.value} value={s.value}>
                                {s.label}
                              </option>
                            ))}
                          </select>

                          <Button
                            type="button"
                            size="sm"
                            className="h-8 rounded-lg px-3 text-xs font-medium"
                            disabled={savingId === request.id || !isDirty}
                            onClick={() => saveRequestChanges(request)}
                          >
                            {savingId === request.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Last updated footer */}
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                        {request.status === "rejected" ? (
                          <AlertCircle className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Last updated{" "}
                        {new Date(request.updated_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
