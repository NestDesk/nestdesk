"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatDateInIndia } from "../../../../lib/date";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { Card, CardContent } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { cn } from "../../../../lib/utils";

type Request = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  owner_comments: Array<{
    id: string;
    comment: string;
    created_at: string;
  }>;
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

export default function TenantMaintenancePage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [maintenanceLimit, setMaintenanceLimit] = useState(3);
  const [requestsRaised, setRequestsRaised] = useState(0);
  const [requestsRemaining, setRequestsRemaining] = useState(3);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDescription, setEditingDescription] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadRequests() {
    const response = await fetch("/api/tenant/maintenance");
    const json = (await response.json()) as {
      requests?: Request[];
      maintenanceLimit?: number;
      requestsRaised?: number;
      requestsRemaining?: number;
      error?: string;
    };
    if (json.requests) {
      setRequests(json.requests);
    }
    if (typeof json.maintenanceLimit === "number") {
      setMaintenanceLimit(json.maintenanceLimit);
    }
    if (typeof json.requestsRaised === "number") {
      setRequestsRaised(json.requestsRaised);
    }
    if (typeof json.requestsRemaining === "number") {
      setRequestsRemaining(json.requestsRemaining);
    }
  }

  useEffect(() => {
    loadRequests()
      .catch(() => {
        toast.error("Could not load maintenance requests.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Failed to submit request.");
        return;
      }
      setRequestsRaised((prev) => prev + 1);
      setRequestsRemaining((prev) => Math.max(0, prev - 1));
      toast.success("Maintenance request submitted.");
      setTitle("");
      setDescription("");
      setShowForm(false);
      router.refresh();
      await loadRequests();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditing(request: Request) {
    if (request.status !== "open") {
      toast.error("Only open requests can be edited.");
      return;
    }
    setEditingId(request.id);
    setEditingTitle(request.title);
    setEditingDescription(request.description ?? "");
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingTitle("");
    setEditingDescription("");
  }

  async function saveEdit(requestId: string) {
    if (!editingTitle.trim()) {
      return;
    }

    const target = requests.find((r) => r.id === requestId);
    if (!target || target.status !== "open") {
      toast.error("Only open requests can be edited.");
      return;
    }

    setSavingId(requestId);
    try {
      const res = await fetch(`/api/tenant/maintenance/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTitle.trim(),
          description: editingDescription.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not update request.");
        return;
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                title: editingTitle.trim(),
                description: editingDescription.trim() || null,
                updated_at: json.request?.updated_at ?? r.updated_at,
              }
            : r,
        ),
      );

      toast.success("Request updated.");
      cancelEditing();
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteRequest(requestId: string) {
    const target = requests.find((r) => r.id === requestId);
    if (!target || target.status !== "open") {
      toast.error("Only open requests can be deleted.");
      return;
    }

    const ok = window.confirm(
      "Delete this maintenance request? This action cannot be undone.",
    );
    if (!ok) {
      return;
    }

    setDeletingId(requestId);
    try {
      const res = await fetch(`/api/tenant/maintenance/${requestId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not delete request.");
        return;
      }

      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      setRequestsRaised((prev) => Math.max(0, prev - 1));
      setRequestsRemaining((prev) => Math.min(maintenanceLimit, prev + 1));
      if (editingId === requestId) {
        cancelEditing();
      }
      toast.success("Request deleted.");
      router.refresh();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Maintenance
          </h1>
          <p className="text-sm text-muted-foreground">
            Raise and track maintenance requests for your room.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Requests raised: {requestsRaised}/{maintenanceLimit} (remaining: {requestsRemaining})
          </p>
        </div>
        <Button
          size="sm"
          variant={showForm ? "outline" : "default"}
          className="shrink-0 rounded-xl"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? (
            <>
              <X className="mr-1.5 h-3.5 w-3.5" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Request
            </>
          )}
        </Button>
      </div>

      {/* New request form */}
      {showForm ? (
        <Card className="overflow-hidden rounded-2xl border-primary/30 shadow-md shadow-primary/5">
          <CardContent className="p-0">
            <div className="border-b border-border/60 bg-primary/5 px-3 py-2.5">
              <p className="text-sm font-semibold text-foreground">
                New Maintenance Request
              </p>
              <p className="text-[11px] text-muted-foreground">
                Describe the issue and we&apos;ll notify your property manager.
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                You have {requestsRemaining} of {maintenanceLimit} maintenance requests left.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3 p-3">
              <div className="space-y-1.5">
                <Label htmlFor="req-title" className="text-xs font-medium">
                  Issue Title <span className="text-rose-500">*</span>
                </Label>
                <Input
                  id="req-title"
                  placeholder="e.g. Leaking tap in bathroom"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-9 rounded-xl text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-desc" className="text-xs font-medium">
                  Description{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <textarea
                  id="req-desc"
                  placeholder="Describe the issue in more detail…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting || !title.trim() || requestsRemaining <= 0}
                  className="h-8 rounded-lg px-3 text-xs font-medium"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Submit Request
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg px-3 text-xs"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Wrench className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            No requests yet.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Use &ldquo;New Request&rdquo; above to report an issue.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => {
            const isEditing = editingId === r.id;
            const canEdit = r.status === "open";

            return (
              <Card
                key={r.id}
                className={cn(
                  "overflow-hidden rounded-2xl border transition-shadow duration-150",
                  isEditing
                    ? "border-primary/30 shadow-md shadow-primary/5"
                    : "border-border/70 hover:border-border hover:shadow-sm",
                )}
              >
                <CardContent className="p-0">
                  {/* ── Main row ── */}
                  <div className="flex items-start gap-2.5 p-3">
                    {/* Status dot indicator */}
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                        r.status === "open"
                          ? "bg-amber-50 dark:bg-amber-500/10"
                          : r.status === "in_progress"
                            ? "bg-blue-50 dark:bg-blue-500/10"
                            : r.status === "completed" || r.status === "resolved"
                              ? "bg-emerald-50 dark:bg-emerald-500/10"
                              : "bg-rose-50 dark:bg-rose-500/10",
                      )}
                    >
                      <Wrench
                        className={cn(
                          "h-3 w-3",
                          r.status === "open"
                            ? "text-amber-600"
                            : r.status === "in_progress"
                              ? "text-blue-600"
                              : r.status === "completed" || r.status === "resolved"
                                ? "text-emerald-600"
                                : "text-rose-600",
                        )}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        /* Edit form */
                        <div className="space-y-2">
                          <Input
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            className="h-9 rounded-xl text-sm"
                            placeholder="Issue title"
                          />
                          <textarea
                            value={editingDescription}
                            onChange={(e) => setEditingDescription(e.target.value)}
                            rows={2}
                            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            placeholder="Describe the issue…"
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="h-8 rounded-xl px-3 text-xs"
                              disabled={savingId === r.id || !editingTitle.trim()}
                              onClick={() => saveEdit(r.id)}
                            >
                              {savingId === r.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Save className="mr-1 h-3 w-3" />
                                  Save
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 rounded-xl px-3 text-xs"
                              onClick={cancelEditing}
                            >
                              <X className="mr-1 h-3 w-3" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold leading-snug text-foreground">
                            {r.title}
                          </p>
                          {r.description ? (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {r.description}
                            </p>
                          ) : null}
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <CalendarDays className="h-3 w-3" />
                              {formatDateInIndia(r.created_at, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                            {canEdit ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                                  onClick={() => startEditing(r)}
                                >
                                  <Pencil className="h-2.5 w-2.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
                                  disabled={deletingId === r.id}
                                  onClick={() => deleteRequest(r.id)}
                                >
                                  {deletingId === r.id ? (
                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-2.5 w-2.5" />
                                  )}
                                  Delete
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground/60">
                                Locked after owner action
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    <Badge
                      className={cn(
                        "ml-auto shrink-0 text-[11px]",
                        STATUS_CHIP_CLASS[r.status],
                      )}
                    >
                      {r.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* ── Owner comments ── */}
                  {r.owner_comments.length > 0 ? (
                    <div className="border-t border-border/60 bg-muted/20 px-3 pb-3 pt-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                        Owner Comments
                      </p>
                      <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                        {r.owner_comments.map((comment) => (
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
                                {formatDateInIndia(comment.created_at, {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
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
