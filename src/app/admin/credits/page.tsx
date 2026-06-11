"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Coins,
  Search,
  Plus,
  IndianRupee,
  RefreshCw,
  CheckCircle2,
  Clock,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
export const dynamic = "force-dynamic";

import { normalizeOwnerPlan, PLAN_BADGE_CLASSES } from "../../../lib/subscriptions";

type OwnerRow = {
  id: string;
  full_name: string;
  email: string | null;
  plan: string;
  unused_credit_paise: number;
  hostel_count: number;
  active_tenant_count: number;
  created_at: string;
};

function fmt(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

export default function AdminCreditsPage() {
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedOwner, setSelectedOwner] = useState<OwnerRow | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [amountRupees, setAmountRupees] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [amountError, setAmountError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyRows, setHistoryRows] = useState<
    {
      id: string;
      event_type: "admin_credit_added" | "credit_used" | "downgrade_credit_added";
      amount_paise: number;
      balance_before: number;
      balance_after: number;
      note: string | null;
      payment_order_id: string | null;
      created_by: string | null;
      created_at: string;
    }[]
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [deletingCreditId, setDeletingCreditId] = useState<string | null>(null);

  const fetchOwners = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/owners?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { owners: OwnerRow[]; total: number };
      setOwners(data.owners);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load owners.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOwners("");
  }, [fetchOwners]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchOwners(value), 400);
  }

  function openAddCredits(owner: OwnerRow) {
    setSelectedOwner(owner);
    setAmountRupees("");
    setNote("");
    setAmountError("");
    setDialogOpen(true);
  }

  async function openHistory(owner: OwnerRow) {
    setSelectedOwner(owner);
    setHistoryLoading(true);
    setHistoryOpen(true);
    setHistoryRows([]);

    try {
      const res = await fetch(`/api/admin/credits/history?ownerId=${owner.id}`);
      if (!res.ok) throw new Error("Failed to load credit history.");
      const data = (await res.json()) as { history: typeof historyRows };
      setHistoryRows(data.history ?? []);
    } catch {
      toast.error("Unable to load credit history.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleAddCredits() {
    if (!selectedOwner) return;

    const rupees = Number(amountRupees);
    if (!amountRupees || isNaN(rupees) || rupees <= 0) {
      setAmountError("Enter a valid positive amount.");
      return;
    }
    if (rupees > 100000) {
      setAmountError("Maximum single allocation is ₹1,00,000.");
      return;
    }
    setAmountError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerId: selectedOwner.id,
          amountPaise: Math.round(rupees * 100),
          note: note.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        newBalancePaise?: number;
        error?: string;
      };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Failed");

      toast.success(
        `Added ${fmt(Math.round(rupees * 100))} credits to ${selectedOwner.full_name}.`,
      );

      setOwners((prev) =>
        prev.map((o) =>
          o.id === selectedOwner.id
            ? {
                ...o,
                unused_credit_paise: data.newBalancePaise ?? o.unused_credit_paise,
              }
            : o,
        ),
      );
      setSelectedOwner((prev) =>
        prev
          ? {
              ...prev,
              unused_credit_paise: data.newBalancePaise ?? prev.unused_credit_paise,
            }
          : null,
      );
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add credits.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteCredit(creditId: string) {
    if (!selectedOwner) return;
    if (
      !window.confirm(
        "Delete this admin-added credit adjustment? This will deduct the same amount from the owner's current balance.",
      )
    ) {
      return;
    }

    setDeletingCreditId(creditId);

    try {
      const res = await fetch(`/api/admin/credits?creditId=${creditId}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as {
        success?: boolean;
        newBalancePaise?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to delete credit.");
      }

      toast.success("Admin credit adjustment deleted.");
      setHistoryRows((prev) => prev.filter((row) => row.id !== creditId));
      setOwners((prev) =>
        prev.map((o) =>
          o.id === selectedOwner.id
            ? {
                ...o,
                unused_credit_paise: data.newBalancePaise ?? o.unused_credit_paise,
              }
            : o,
        ),
      );
      setSelectedOwner((prev) =>
        prev
          ? {
              ...prev,
              unused_credit_paise: data.newBalancePaise ?? prev.unused_credit_paise,
            }
          : null,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete credit.");
    } finally {
      setDeletingCreditId((current) => (current === creditId ? null : current));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10">
          <Coins className="h-6 w-6 text-indigo-500" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Credit Management
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
            Credits
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search owner accounts and allocate credits.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name or email…"
            className="h-10 rounded-xl pl-9 text-sm  w-[25rem]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 gap-2 rounded-xl"
          onClick={() => fetchOwners(search)}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {owners.length} of {total} accounts
      </p>

      {/* Owner cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : owners.length === 0 ? (
        <Card className="rounded-2xl border border-border/60">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No owners found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {owners.map((owner) => (
            <Card
              key={owner.id}
              className="rounded-2xl border border-border/60 shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-2 pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm font-semibold">
                      {owner.full_name}
                    </CardTitle>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {owner.email ?? "—"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PLAN_BADGE_CLASSES[normalizeOwnerPlan(owner.plan)] ?? ""}`}
                  >
                    {normalizeOwnerPlan(owner.plan)}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="mb-3 flex items-center gap-2 rounded-xl bg-indigo-500/10 px-3 py-2">
                  <IndianRupee className="h-4 w-4 shrink-0 text-indigo-500" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">
                      Unused Credits
                    </p>
                    <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {fmt(owner.unused_credit_paise)}
                    </p>
                  </div>
                </div>
                <div className="mb-3 flex gap-3 text-xs text-muted-foreground">
                  <span>{owner.hostel_count} properties</span>
                  <span>•</span>
                  <span>{owner.active_tenant_count} tenants</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 w-full gap-1.5 rounded-xl text-xs"
                    onClick={() => openAddCredits(owner)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Credits
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full gap-1.5 rounded-xl text-xs"
                    onClick={() => openHistory(owner)}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    History
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add credits dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(28rem,100vw)] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Add Credits</DialogTitle>
            <DialogDescription className="text-sm">
              Adding credits to{" "}
              <span className="font-semibold text-foreground">
                {selectedOwner?.full_name}
              </span>
              . Current balance:{" "}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                {fmt(selectedOwner?.unused_credit_paise ?? 0)}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="credit-amount">Amount (₹)</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="credit-amount"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  placeholder="e.g. 500"
                  value={amountRupees}
                  onChange={(e) => {
                    setAmountRupees(e.target.value);
                    setAmountError("");
                  }}
                  className="pl-9 rounded-xl"
                />
              </div>
              {amountError && (
                <p className="text-xs text-destructive">{amountError}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="credit-note">Note (optional)</Label>
              <Input
                id="credit-note"
                placeholder="Reason or reference…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl"
                maxLength={500}
              />
            </div>
            {amountRupees &&
              !isNaN(Number(amountRupees)) &&
              Number(amountRupees) > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="text-emerald-700 dark:text-emerald-400">
                    New balance will be{" "}
                    <strong>
                      {fmt(
                        (selectedOwner?.unused_credit_paise ?? 0) +
                          Math.round(Number(amountRupees) * 100),
                      )}
                    </strong>
                  </span>
                </div>
              )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleAddCredits}
              disabled={submitting || !amountRupees}
            >
              {submitting ? "Adding…" : "Add Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="w-[min(36rem,100vw)] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>Credit history</DialogTitle>
            <DialogDescription className="text-sm">
              Recent credit additions and usage for {selectedOwner?.full_name}.
            </DialogDescription>
          </DialogHeader>

          {historyLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Loading credit history…
            </div>
          ) : historyRows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No credit history recorded for this owner.
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {historyRows.map((row) => {
                let eventLabel = "Credits used";
                let eventDescription = "Service credit consumption";
                if (row.event_type === "admin_credit_added") {
                  eventLabel = "Credits added";
                  eventDescription = "Admin adjustment";
                } else if (row.event_type === "downgrade_credit_added") {
                  eventLabel = "Downgrade credit added";
                  eventDescription = "Credit generated by downgrade";
                }

                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border/70 bg-card/80 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {eventLabel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {eventDescription}
                        </p>
                      </div>
                      <div className="text-right text-sm font-semibold text-foreground">
                        {row.event_type === "credit_used"
                          ? `-${fmt(row.amount_paise)}`
                          : fmt(row.amount_paise)}
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-2">
                      <div>Before: {fmt(row.balance_before)}</div>
                      <div>After: {fmt(row.balance_after)}</div>
                      {row.payment_order_id ? (
                        <div>Payment order: {row.payment_order_id}</div>
                      ) : null}
                      {row.created_by ? (
                        <div>Recorded by: {row.created_by}</div>
                      ) : null}
                      <div>
                        Created: {new Date(row.created_at).toLocaleString("en-IN")}
                      </div>
                    </div>
                    {row.note ? (
                      <div className="mt-3 text-[11px] text-muted-foreground">
                        Note: {row.note}
                      </div>
                    ) : null}
                    {row.event_type === "admin_credit_added" ? (
                      <div className="mt-3 flex justify-end">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="rounded-xl"
                          onClick={() => handleDeleteCredit(row.id)}
                          disabled={deletingCreditId === row.id}
                        >
                          {deletingCreditId === row.id ? "Deleting…" : "Delete"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setHistoryOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
