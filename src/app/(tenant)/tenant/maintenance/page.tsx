"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Pencil,
  Plus,
  PlusCircle,
  Save,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

export default function TenantMaintenancePage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
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
    const json = (await response.json()) as { requests?: Request[]; error?: string };
    if (json.requests) {
      setRequests(json.requests);
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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Maintenance
          </h1>
          <p className="text-muted-foreground">
            Raise and track maintenance requests for your room.
          </p>
        </div>
        <Button
          size="sm"
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
      {showForm && (
        <Card className="rounded-2xl border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">New maintenance request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="req-title">Title</Label>
                <Input
                  id="req-title"
                  placeholder="e.g. Leaking tap in bathroom"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="req-desc">
                  Description{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <textarea
                  id="req-desc"
                  placeholder="Describe the issue in more detail…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button
                type="submit"
                disabled={submitting || !title.trim()}
                className="rounded-xl"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                    Submit Request
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Wrench className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No requests yet.</p>
          <p className="text-xs text-muted-foreground">
            Use &quot;New Request&quot; above to report an issue.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="rounded-2xl border-border/70">
              <CardContent className="flex items-start justify-between gap-4 p-4">
                <div className="min-w-0">
                  {editingId === r.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="h-8 rounded-lg"
                        placeholder="Issue title"
                      />
                      <textarea
                        value={editingDescription}
                        onChange={(e) => setEditingDescription(e.target.value)}
                        rows={3}
                        className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        placeholder="Describe the issue..."
                      />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">
                        {r.title}
                      </p>
                      {r.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                          {r.description}
                        </p>
                      )}
                    </>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>

                  <div className="mt-2 flex items-center gap-1.5">
                    {editingId === r.id ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 rounded-lg px-2 text-xs"
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
                          className="h-7 rounded-lg px-2 text-xs"
                          onClick={cancelEditing}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg px-2 text-xs"
                          onClick={() => startEditing(r)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Edit
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10"
                          disabled={deletingId === r.id}
                          onClick={() => deleteRequest(r.id)}
                        >
                          {deletingId === r.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="mr-1 h-3 w-3" />
                              Delete
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>

                  {r.owner_comments.length > 0 ? (
                    <div className="mt-2 space-y-1.5 rounded-lg border border-border/60 bg-muted/30 p-2.5">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Owner comments
                      </p>
                      {r.owner_comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="rounded-md bg-background/80 px-2 py-1.5"
                        >
                          <p className="text-xs text-foreground/90">
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
                  ) : null}
                </div>
                <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                  {r.status.replace("_", " ")}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
