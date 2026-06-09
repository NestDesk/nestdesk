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
} from "lucide-react";

export const dynamic = "force-dynamic";
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
            className="h-10 rounded-xl pl-9 text-sm"
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
                <Button
                  type="button"
                  size="sm"
                  className="h-8 w-full gap-1.5 rounded-xl text-xs"
                  onClick={() => openAddCredits(owner)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Credits
                </Button>
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
    </div>
  );
}
