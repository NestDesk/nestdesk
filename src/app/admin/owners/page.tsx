"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Search,
  RefreshCw,
  Building2,
  IndianRupee,
  MoreVertical,
} from "lucide-react";
import { Card, CardContent } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";

export const dynamic = "force-dynamic";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { normalizeOwnerPlan, PLAN_BADGE_CLASSES } from "../../../lib/subscriptions";
import { formatDateInIndia } from "../../../lib/date";

type OwnerRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  plan: string;
  unused_credit_paise: number;
  onboarding_completed: boolean;
  hostel_count: number;
  active_tenant_count: number;
  created_at: string;
};

type CustomPlanOption = {
  id: string;
  name: string;
};

export default function AdminOwnersPage() {
  const [owners, setOwners] = useState<OwnerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<OwnerRow | null>(null);
  const [customPlans, setCustomPlans] = useState<CustomPlanOption[]>([]);
  const [selectedCustomPlanId, setSelectedCustomPlanId] = useState<string | null>(
    null,
  );
  const [savingAssignment, setSavingAssignment] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const fetchOwners = useCallback(async (q: string, off: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(off),
      });
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

  const fetchCustomPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/planner/plans");
      if (!res.ok) throw new Error("Failed to load plans");
      const data = (await res.json()) as {
        plans: Array<{ id: string; name: string }>;
      };
      setCustomPlans(data.plans.map((plan) => ({ id: plan.id, name: plan.name })));
    } catch {
      toast.error("Failed to load custom plans.");
    }
  }, []);

  useEffect(() => {
    fetchOwners("", 0);
    fetchCustomPlans();
  }, [fetchOwners, fetchCustomPlans]);

  function handleSearchChange(value: string) {
    setSearch(value);
    setOffset(0);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchOwners(value, 0), 400);
  }

  function openAssignDialog(owner: OwnerRow) {
    setSelectedOwner(owner);
    setSelectedCustomPlanId(null);
    setAssignModalOpen(true);
  }

  async function assignPlanToOwner() {
    if (!selectedOwner || !selectedCustomPlanId) return;
    setSavingAssignment(true);

    try {
      const res = await fetch(`/api/admin/owners/${selectedOwner.id}/assign-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customPlanId: selectedCustomPlanId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to assign plan.");
      }

      toast.success("Custom plan assigned successfully.");
      setAssignModalOpen(false);
      fetchOwners(search, offset);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign plan.");
    } finally {
      setSavingAssignment(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10">
            <Users className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Accounts
            </p>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">
              Owners
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {total} registered owner account{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-2 rounded-xl"
          onClick={() => fetchOwners(search, offset)}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by name or email…"
          className="h-10 rounded-xl pl-9 text-sm"
        />
      </div>

      {/* Table */}
      <Card className="rounded-2xl border border-border/60 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Owner
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Properties
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tenants
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Credits
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-muted" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : owners.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-muted-foreground"
                    >
                      No owners found.
                    </td>
                  </tr>
                ) : (
                  owners.map((owner) => {
                    const plan = normalizeOwnerPlan(owner.plan);
                    return (
                      <tr
                        key={owner.id}
                        className="group transition-colors hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">
                            {owner.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {owner.email ?? "—"}
                          </p>
                          {owner.phone && (
                            <p className="text-xs text-muted-foreground">
                              {owner.phone}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border border-border/30 px-2.5 py-0.5 text-[11px] font-semibold uppercase ${PLAN_BADGE_CLASSES[plan] ?? ""}`}
                          >
                            {plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="flex items-center justify-end gap-1 font-medium text-foreground">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {owner.hostel_count}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          {owner.active_tenant_count}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {owner.unused_credit_paise > 0 ? (
                            <span className="flex items-center justify-end gap-0.5 text-indigo-600 dark:text-indigo-400">
                              <IndianRupee className="h-3.5 w-3.5" />
                              {(owner.unused_credit_paise / 100).toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${owner.onboarding_completed ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}
                          >
                            {owner.onboarding_completed ? "Active" : "Onboarding"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {formatDateInIndia(owner.created_at, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Owner actions"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem
                                onClick={() => openAssignDialog(owner)}
                              >
                                Assign subscription plan
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Assign custom subscription plan</DialogTitle>
                <DialogDescription>
                  Select the custom institution plan that should be shown to the
                  owner on their subscription and usage pages.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="owner-name">Owner</Label>
                  <Input
                    id="owner-name"
                    value={selectedOwner?.full_name ?? ""}
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="custom-plan-select">Custom plan</Label>
                  <Select
                    value={selectedCustomPlanId ?? ""}
                    onValueChange={(value) => setSelectedCustomPlanId(value)}
                  >
                    <SelectTrigger id="custom-plan-select">
                      <SelectValue placeholder="Select a plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAssignModalOpen(false)}
                  disabled={savingAssignment}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={assignPlanToOwner}
                  disabled={savingAssignment || !selectedCustomPlanId}
                >
                  {savingAssignment ? "Saving…" : "Assign plan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {offset + 1}–{Math.min(offset + limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  disabled={offset === 0 || loading}
                  onClick={() => {
                    const next = Math.max(0, offset - limit);
                    setOffset(next);
                    fetchOwners(search, next);
                  }}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-lg text-xs"
                  disabled={offset + limit >= total || loading}
                  onClick={() => {
                    const next = offset + limit;
                    setOffset(next);
                    fetchOwners(search, next);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
