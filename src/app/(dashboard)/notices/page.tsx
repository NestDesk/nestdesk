"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { formatDateInIndia } from "../../../lib/date";
import { cn } from "../../../lib/utils";

type NoticeRow = {
  id: string;
  hostel_id: string;
  hostel_name: string;
  hostel_location: string | null;
  title: string;
  body: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type HostelOption = {
  id: string;
  name: string;
  location: string | null;
};

type ModalMode = "create" | "edit";

type NoticeDraft = {
  hostel_id: string;
  title: string;
  body: string;
  publish: boolean;
};

const EMPTY_DRAFT: NoticeDraft = {
  hostel_id: "",
  title: "",
  body: "",
  publish: false,
};

function formatDate(iso: string) {
  return formatDateInIndia(iso, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OwnerNoticesPage() {
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [hostels, setHostels] = useState<HostelOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterHostelId, setFilterHostelId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "draft">(
    "all",
  );

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NoticeDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmPublishNotice, setConfirmPublishNotice] = useState<NoticeRow | null>(
    null,
  );

  // Publish toggle
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function loadHostels() {
    try {
      const res = await fetch("/api/hostels", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load properties.");
        return;
      }

      type HostelApiRow = { id: string; name: string; city: string; state: string };
      const rows = (json.hostels ?? []) as HostelApiRow[];

      setHostels(
        rows.map((h) => ({
          id: h.id,
          name: h.name,
          location: [h.city, h.state].filter(Boolean).join(", "),
        })),
      );
    } catch {
      toast.error("Network error while loading properties.");
    }
  }

  async function loadNotices() {
    setLoading(true);
    try {
      const res = await fetch("/api/notices", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not load notices.");
        return;
      }
      const rows = (json.notices ?? []) as NoticeRow[];
      setNotices(rows);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadHostels(), loadNotices()]).catch(() => {
      // handled in loaders
    });
  }, []);

  const filtered = useMemo(() => {
    return notices.filter((n) => {
      if (filterHostelId !== "all" && n.hostel_id !== filterHostelId) return false;
      if (filterStatus === "published" && !n.is_published) return false;
      if (filterStatus === "draft" && n.is_published) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !n.title.toLowerCase().includes(q) &&
          !n.body.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [notices, filterHostelId, filterStatus, searchQuery]);

  const draftCount = useMemo(
    () => notices.filter((n) => !n.is_published).length,
    [notices],
  );

  const MONTHLY_PUBLISHED_LIMIT = 4;
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const currentMonthPublishedCount = notices.filter((n) => {
    if (!n.is_published || !n.published_at) return false;
    const publishedDate = new Date(n.published_at);
    return publishedDate >= currentMonthStart && publishedDate <= currentMonthEnd;
  }).length;

  const currentMonthRangeLabel = `${formatDateInIndia(currentMonthStart, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} – ${formatDateInIndia(currentMonthEnd, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;

  const publishLimitReached = currentMonthPublishedCount >= MONTHLY_PUBLISHED_LIMIT;

  function openCreateModal(preselectedHostelId?: string) {
    setModalMode("create");
    setEditingId(null);
    setDraft({
      ...EMPTY_DRAFT,
      hostel_id: preselectedHostelId ?? (hostels.length === 1 ? hostels[0].id : ""),
    });
    setModalOpen(true);
  }

  function openEditModal(notice: NoticeRow) {
    setModalMode("edit");
    setEditingId(notice.id);
    setDraft({
      hostel_id: notice.hostel_id,
      title: notice.title,
      body: notice.body,
      publish: notice.is_published,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  async function handleSave() {
    const titleTrimmed = draft.title.trim();
    const bodyTrimmed = draft.body.trim();

    if (!draft.hostel_id) {
      toast.error("Please select a property.");
      return;
    }
    if (titleTrimmed.length < 2) {
      toast.error("Title must be at least 2 characters.");
      return;
    }
    if (bodyTrimmed.length < 5) {
      toast.error("Body must be at least 5 characters.");
      return;
    }

    if (
      draft.publish &&
      (!editingId || !notices.find((n) => n.id === editingId)?.is_published) &&
      publishLimitReached
    ) {
      toast.error("You can publish up to 4 notices per calendar month.");
      return;
    }

    setSaving(true);
    try {
      if (modalMode === "create") {
        const createPayload = {
          hostel_id: draft.hostel_id,
          title: titleTrimmed,
          body: bodyTrimmed,
          publish: draft.publish,
        };
        console.info("Creating notice", createPayload);
        console.log("Notice create payload", createPayload);
        const res = await fetch("/api/notices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });
        const json = await res.json();
        console.info("Create notice response", {
          status: res.status,
          ok: res.ok,
          body: json,
        });
        if (!res.ok) {
          toast.error(json.error ?? "Could not create notice.");
          return;
        }
        const newNotice = json.notice as NoticeRow;
        setNotices((prev) => [newNotice, ...prev]);

        const alreadyInHostels = hostels.some((h) => h.id === newNotice.hostel_id);
        if (!alreadyInHostels) {
          setHostels((prev) => [
            ...prev,
            {
              id: newNotice.hostel_id,
              name: newNotice.hostel_name,
              location: newNotice.hostel_location,
            },
          ]);
        }

        toast.success(
          draft.publish ? "Notice published." : "Notice saved as draft.",
        );
        closeModal();
      } else if (modalMode === "edit" && editingId) {
        const currentNotice = notices.find((n) => n.id === editingId);
        const payload: Record<string, unknown> = {};
        if (titleTrimmed !== currentNotice?.title) payload.title = titleTrimmed;
        if (bodyTrimmed !== currentNotice?.body) payload.body = bodyTrimmed;
        if (draft.publish !== currentNotice?.is_published)
          payload.is_published = draft.publish;

        if (Object.keys(payload).length === 0) {
          toast.info("No changes made.");
          closeModal();
          return;
        }

        console.info("Updating notice", { noticeId: editingId, payload });
        console.log("Notice update payload", payload);
        const res = await fetch(`/api/notices/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        console.info("Update notice response", {
          status: res.status,
          ok: res.ok,
          body: json,
        });
        if (!res.ok) {
          toast.error(json.error ?? "Could not update notice.");
          return;
        }
        const updated = json.notice as NoticeRow;
        setNotices((prev) =>
          prev.map((n) =>
            n.id === editingId
              ? {
                  ...n,
                  title: updated.title,
                  body: updated.body,
                  is_published: updated.is_published,
                  published_at: updated.published_at,
                  updated_at: updated.updated_at,
                }
              : n,
          ),
        );
        toast.success("Notice updated.");
        closeModal();
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(notice: NoticeRow) {
    if (notice.is_published) return;
    if (publishLimitReached) {
      toast.error("You can publish up to 4 notices per calendar month.");
      return;
    }
    setTogglingId(notice.id);
    try {
      const togglePayload = { is_published: true };
      console.info("Publishing notice", { noticeId: notice.id });
      console.log("Notice publish payload", togglePayload);
      const res = await fetch(`/api/notices/${notice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(togglePayload),
      });
      const json = await res.json();
      console.info("Toggle publish response", {
        noticeId: notice.id,
        status: res.status,
        ok: res.ok,
        body: json,
      });
      if (!res.ok) {
        toast.error(json.error ?? "Could not update notice.");
        return;
      }
      const updated = json.notice as NoticeRow;
      setNotices((prev) =>
        prev.map((n) =>
          n.id === notice.id
            ? {
                ...n,
                is_published: updated.is_published,
                published_at: updated.published_at,
              }
            : n,
        ),
      );
      toast.success("Notice published to tenants.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setTogglingId(null);
    }
  }

  function openPublishConfirm(notice: NoticeRow) {
    if (publishLimitReached) {
      toast.error("You can publish up to 4 notices per calendar month.");
      return;
    }
    setConfirmPublishNotice(notice);
  }

  async function confirmPublishNoticeAction() {
    if (!confirmPublishNotice) return;
    await togglePublish(confirmPublishNotice);
    setConfirmPublishNotice(null);
  }

  async function handleDelete(noticeId: string) {
    setDeletingId(noticeId);
    try {
      const res = await fetch(`/api/notices/${noticeId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Could not delete notice.");
        return;
      }
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
      toast.success("Notice deleted.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
         
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Notices
            </h2>
            <p className="text-sm text-muted-foreground">
              Publish announcements to your property tenants.
            </p>
          </div>
        </div>
        <Button onClick={() => openCreateModal()} size="sm" className="h-9 gap-1.5">
          <Plus className="h-4 w-4" />
          New Notice
        </Button>
      </div>

      {/* Stats strip */}
      {!loading && notices.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="mt-1 text-xl font-bold text-foreground">
              {notices.length}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              Published
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {currentMonthPublishedCount}/{MONTHLY_PUBLISHED_LIMIT}
            </p>
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80">
              {currentMonthRangeLabel}
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="text-xs text-amber-700 dark:text-amber-400">Drafts</p>
            <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
              {draftCount}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      {!loading && notices.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-8 text-sm"
              placeholder="Search notices…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {hostels.length > 1 && (
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
              value={filterHostelId}
              onChange={(e) => setFilterHostelId(e.target.value)}
            >
              <option value="all">All Properties</option>
              {hostels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-1">
            {(["all", "published", "draft"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "h-9 rounded-md px-3 text-xs font-medium capitalize transition-colors",
                  filterStatus === s
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/70 bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {s === "all" ? "All" : s === "published" ? "Published" : "Drafts"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notices.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No notices yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Create your first notice to broadcast announcements to your tenants.
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={() => openCreateModal()}>
            <Plus className="h-4 w-4" />
            Create Notice
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Bell className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            No notices match your filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setFilterHostelId("all");
              setFilterStatus("all");
            }}
            className="text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((notice) => (
            <Card
              key={notice.id}
              className={cn(
                "rounded-2xl border transition-colors",
                notice.is_published
                  ? "border-border/70"
                  : "border-dashed border-amber-300/70 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-500/5",
              )}
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  {/* Main info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {notice.title}
                      </h3>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-5 text-[11px]",
                          notice.is_published
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
                        )}
                      >
                        {notice.is_published ? (
                          <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                        ) : (
                          <EyeOff className="mr-1 h-2.5 w-2.5" />
                        )}
                        {notice.is_published ? "Published" : "Draft"}
                      </Badge>
                    </div>

                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {notice.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {notice.hostel_name}
                        {notice.hostel_location && ` · ${notice.hostel_location}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {notice.is_published && notice.published_at
                          ? `Published ${formatDate(notice.published_at)}`
                          : `Created ${formatDate(notice.created_at)}`}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    {!notice.is_published ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 px-2.5 text-xs"
                          onClick={() => openPublishConfirm(notice)}
                          disabled={togglingId === notice.id || publishLimitReached}
                        >
                          {togglingId === notice.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                          Publish
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => openEditModal(notice)}
                          title="Edit notice"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>

                        {confirmDeleteId === notice.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">
                              Sure?
                            </span>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={deletingId === notice.id}
                              onClick={() => handleDelete(notice.id)}
                            >
                              {deletingId === notice.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Yes"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              No
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:border-rose-300 hover:text-rose-600 dark:hover:border-rose-500/50 dark:hover:text-rose-400"
                            onClick={() => setConfirmDeleteId(notice.id)}
                            title="Delete notice"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <div className="w-full max-w-lg rounded-t-2xl border border-border bg-background p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-base font-semibold text-foreground">
                {modalMode === "create" ? "New Notice" : "Edit Notice"}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Property select (only on create) */}
              {modalMode === "create" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Property</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    value={draft.hostel_id}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, hostel_id: e.target.value }))
                    }
                  >
                    <option value="">Select a property…</option>
                    {hostels.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                        {h.location && ` — ${h.location}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Title</Label>
                <Input
                  placeholder="e.g. Water Supply Interruption on Saturday"
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                  maxLength={200}
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {draft.title.length}/200
                </p>
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Message</Label>
                <textarea
                  rows={5}
                  placeholder="Write your notice here…"
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  value={draft.body}
                  onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                  maxLength={5000}
                />
                <p className="text-right text-[11px] text-muted-foreground">
                  {draft.body.length}/5000
                </p>
              </div>

              {/* Publish toggle */}
              <div className="space-y-2">
                {(() => {
                  const currentNotice = editingId
                    ? notices.find((n) => n.id === editingId)
                    : undefined;
                  const isPublished = Boolean(currentNotice?.is_published);

                  return (
                    <>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border p-3",
                          isPublished
                            ? "border-border/70 bg-slate-100 text-muted-foreground"
                            : "border-border/70 hover:bg-muted/40",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-primary"
                          checked={draft.publish}
                          disabled={isPublished || publishLimitReached}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, publish: e.target.checked }))
                          }
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Publish immediately
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tenants will see this notice right away.
                          </p>
                        </div>
                      </label>
                      {isPublished && (
                        <p className="text-xs text-muted-foreground">
                          This notice is already published and cannot be unpublished.
                        </p>
                      )}
                      {!isPublished && publishLimitReached && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          Monthly publish limit reached. Save as draft and publish
                          next month.
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {modalMode === "create"
                  ? draft.publish
                    ? "Publish Notice"
                    : "Save as Draft"
                  : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={Boolean(confirmPublishNotice)}
        onOpenChange={(open) => {
          if (!open) setConfirmPublishNotice(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm Publish Notice</DialogTitle>
            <DialogDescription>
              This notice will be published for all tenants of the property and a
              WhatsApp message will be sent to them.
            </DialogDescription>
          </DialogHeader>

          {confirmPublishNotice ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-medium text-foreground">Notice title</p>
                <p className="mt-1 text-sm text-foreground">
                  {confirmPublishNotice.title}
                </p>
              </div>
              <div className="rounded-xl border border-border/70 bg-card/70 p-4">
                <p className="text-sm font-medium text-foreground">Notice content</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {confirmPublishNotice.body}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPublishNotice(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmPublishNoticeAction}
              disabled={
                !confirmPublishNotice || togglingId === confirmPublishNotice?.id
              }
              className="gap-1.5"
            >
              {togglingId === confirmPublishNotice?.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              Confirm Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
