"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Send,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  open: "secondary",
  in_progress: "default",
  completed: "default",
  rejected: "destructive",
  resolved: "outline",
  closed: "outline",
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
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);
  const [commentSavingId, setCommentSavingId] = useState<string | null>(null);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

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
      setRequests((json.requests ?? []) as MaintenanceRequest[]);
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

  async function updateStatus(requestId: string, status: string) {
    setStatusUpdatingId(requestId);
    try {
      const res = await fetch(`/api/maintenance/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not update status.");
        return;
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status,
                updated_at: json.request?.updated_at ?? new Date().toISOString(),
              }
            : r,
        ),
      );
      toast.success("Status updated.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setStatusUpdatingId(null);
    }
  }

  async function addComment(requestId: string) {
    const draft = (commentDrafts[requestId] ?? "").trim();
    if (!draft) {
      return;
    }

    setCommentSavingId(requestId);
    try {
      const res = await fetch(`/api/maintenance/${requestId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment: draft }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not add comment.");
        return;
      }

      const added = json.comment as OwnerComment | undefined;
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId
            ? {
                ...r,
                owner_comments: added
                  ? [...r.owner_comments, added]
                  : r.owner_comments,
              }
            : r,
        ),
      );
      setCommentDrafts((prev) => ({ ...prev, [requestId]: "" }));
      toast.success("Comment added.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCommentSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Maintenance
          </h1>
          <p className="text-sm text-muted-foreground">
            Track tenant requests, add comments, and update progress.
          </p>
        </div>
        <Badge variant={openCount > 0 ? "secondary" : "outline"}>
          {openCount} open request{openCount === 1 ? "" : "s"}
        </Badge>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Wrench className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No maintenance requests yet.
          </p>
          <p className="text-xs text-muted-foreground">
            New tenant requests will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id} className="rounded-2xl border-border/70">
              <CardHeader className="space-y-2 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base text-foreground">
                      {request.title}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {request.tenant_name}
                      {request.room_number ? ` • Room ${request.room_number}` : ""}
                      {` • ${request.hostel_name}`}
                    </p>
                    {request.hostel_location ? (
                      <p className="text-xs text-muted-foreground">
                        {request.hostel_location}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[request.status] ?? "outline"}>
                      {request.status.replace("_", " ")}
                    </Badge>
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={request.status}
                      disabled={statusUpdatingId === request.id}
                      onChange={(e) => updateStatus(request.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {request.description ? (
                  <p className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                    {request.description}
                  </p>
                ) : null}
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="rounded-xl border border-border/60 bg-background/70 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Owner Comments
                  </div>

                  {request.owner_comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No comments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {request.owner_comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-md bg-muted/30 px-2.5 py-2"
                        >
                          <p className="text-sm text-foreground/90">
                            {comment.comment}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
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
                      ))}
                    </div>
                  )}

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <textarea
                      rows={2}
                      value={commentDrafts[request.id] ?? ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [request.id]: e.target.value,
                        }))
                      }
                      placeholder="Add an update for the tenant..."
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg sm:self-end"
                      disabled={commentSavingId === request.id}
                      onClick={() => addComment(request.id)}
                    >
                      {commentSavingId === request.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Send
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {request.status === "rejected" ? (
                    <AlertCircle className="h-3.5 w-3.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Last update{" "}
                  {new Date(request.updated_at).toLocaleDateString("en-IN")}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
