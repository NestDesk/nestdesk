"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { formatDateInIndia } from "../../../lib/date";
import { calculateRent } from "../../../lib/billing";
import { cn } from "../../../lib/utils";

type TenantReminderRow = {
  id: string;
  full_name: string;
  phone: string | null;
  hostel_name: string;
  room_number: string | null;
  hostel_id: string;
  status: "active" | "moved_out" | "pending" | "rejected";
  agreed_rent_amount: number | null;
  rent_start_date: string | null;
  move_out_date: string | null;
  pending_from: string | null;
  pending_to: string | null;
  pending_amount: number;
  covered_till: string | null;
};

type ReminderUsage = {
  tenant_id: string;
  count: number;
  limit: number;
  cooldown_until?: string | null;
};

const REMINDER_LIMIT = 3;

function formatCooldown(until: Date | null, now = Date.now()) {
  if (!until) return "a moment";

  const remainingMs = Math.max(0, until.getTime() - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function formatCurrency(amount: number | null) {
  if (!amount || amount <= 0) return "-";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return formatDateInIndia(value, { day: "2-digit", month: "short", year: "numeric" });
}

function parseISODate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addDays(date: string, days: number) {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

function getMonthEndDate(date: string) {
  const [year, month] = date.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return toISODate(new Date(year, month - 1, lastDay));
}

function calculateCoverageAmount(monthlyRent: number, fromDate: string, toDate: string) {
  let cursor = parseISODate(fromDate);
  const end = parseISODate(toDate);
  let totalAmount = 0;

  while (cursor <= end) {
    const periodStart = new Date(cursor);
    const monthEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
    const periodEnd = monthEnd < end ? monthEnd : end;
    const calc = calculateRent(monthlyRent, toISODate(periodStart), toISODate(periodEnd));
    totalAmount += calc.payableAmount;
    cursor = new Date(periodEnd);
    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.round(totalAmount * 100) / 100;
}

function getTenantReminderDetails(tenant: TenantReminderRow) {
  const monthlyRent = tenant.agreed_rent_amount ?? 0;
  const today = toISODate(new Date());
  const effectiveEnd = tenant.status === "moved_out" && tenant.move_out_date ? tenant.move_out_date : today;
  const currentMonthEnd = getMonthEndDate(today);
  const pendingStart = tenant.pending_from || (tenant.covered_till ? addDays(tenant.covered_till, 1) : tenant.rent_start_date);
  const pendingEnd = pendingStart && pendingStart <= effectiveEnd ? effectiveEnd : null;
  const billingPeriodEnd = pendingStart && pendingStart <= currentMonthEnd
    ? tenant.status === "moved_out" && tenant.move_out_date
      ? (tenant.move_out_date < currentMonthEnd ? tenant.move_out_date : currentMonthEnd)
      : currentMonthEnd
    : null;
  const pendingAmount = pendingStart && pendingEnd && monthlyRent > 0 ? calculateCoverageAmount(monthlyRent, pendingStart, pendingEnd) : 0;
  const billingAmount = pendingStart && billingPeriodEnd && monthlyRent > 0 ? calculateCoverageAmount(monthlyRent, pendingStart, billingPeriodEnd) : 0;
  const billingPeriodLabel = pendingStart && billingPeriodEnd ? `${formatDate(pendingStart)} - ${formatDate(billingPeriodEnd)}` : "-";
  const pendingPeriodLabel = pendingStart && pendingEnd ? `${formatDate(pendingStart)} - ${formatDate(pendingEnd)}` : "-";

  return {
    billingAmount,
    billingPeriodLabel,
    pendingAmount,
    pendingPeriodLabel,
  };
}

function TenantReminderCard({
  tenant,
  usage,
  isSelected,
  toggleSelection,
  sending,
}: {
  tenant: TenantReminderRow;
  usage?: ReminderUsage;
  isSelected: boolean;
  toggleSelection: (tenantId: string) => void;
  sending: boolean;
}) {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const limit = usage?.limit ?? REMINDER_LIMIT;
  const used = Math.min(usage?.count ?? 0, limit);
  const remaining = Math.max(0, limit - used);
  const cooldownUntil = usage?.cooldown_until ? new Date(usage.cooldown_until) : null;
  const cooldownActive = cooldownUntil ? cooldownUntil.getTime() > currentTime : false;
  const reminderDetails = getTenantReminderDetails(tenant);
  const pendingAmount = reminderDetails.pendingAmount;
  const billingAmount = reminderDetails.billingAmount;
  const billingPeriodLabel = reminderDetails.billingPeriodLabel;
  const pendingPeriodLabel = reminderDetails.pendingPeriodLabel;

  return (
    <Card
      className={cn(
        "overflow-hidden border border-border/70 bg-card/95 shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md",
        isSelected && "border-primary/50 bg-primary/[0.03] shadow-sm",
        (remaining <= 0 || cooldownActive) && "border-dashed border-amber-300/70 bg-card/80 opacity-80 dark:border-amber-700/50",
      )}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 gap-3">
              <label className={cn("mt-0.5 flex shrink-0 items-start", remaining > 0 ? "cursor-pointer" : "cursor-not-allowed") }>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelection(tenant.id)}
                  disabled={remaining <= 0 || cooldownActive || sending}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                />
              </label>
              <div className="min-w-0 flex-1">
                <div className="truncate text-base font-semibold text-foreground">{tenant.full_name}</div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{tenant.hostel_name}</span>
                  {tenant.room_number ? (
                    <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 shadow-sm dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300">
                      Room {tenant.room_number}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 sm:min-w-[240px] sm:shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                    Billing period
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">₹{formatCurrency(billingAmount)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{billingPeriodLabel}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/80">
                    Till today
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-foreground">₹{formatCurrency(pendingAmount)}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{pendingPeriodLabel}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="-mt-1 rounded-xl border border-border/60 bg-muted/25 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                Phone: {tenant.phone || "-"}
              </Badge>
              <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs">
                Rent: ₹{formatCurrency(tenant.agreed_rent_amount)}/month
              </Badge>
              <Badge
                className={cn(
                  "w-fit rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm",
                  cooldownActive
                    ? "bg-orange-500 text-orange-950 ring-1 ring-orange-400/40"
                    : remaining > 0
                    ? "bg-emerald-600 text-emerald-50 ring-1 ring-emerald-500/40 dark:bg-emerald-500 dark:text-emerald-950"
                    : "bg-rose-600 text-rose-50 ring-1 ring-rose-500/40 dark:bg-rose-500 dark:text-rose-950",
                )}
              >
                {cooldownActive ? (
                  <span className="whitespace-nowrap">Wait {formatCooldown(cooldownUntil, currentTime)}</span>
                ) : remaining > 0 ? (
                  `${remaining} reminder${remaining === 1 ? "" : "s"} left`
                ) : (
                  "0 reminders left"
                )}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RentRemindersPage() {
  const [tenants, setTenants] = useState<TenantReminderRow[]>([]);
  const [usageByTenant, setUsageByTenant] = useState<Record<string, ReminderUsage>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loadingOpen, setLoadingOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successRecipients, setSuccessRecipients] = useState<
    Array<{
      id: string;
      full_name: string;
      room_number: string | null;
      amount: number | null;
      billingAmount: number | null;
      billingPeriodLabel: string | null;
    }>
  >([]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [tenantsRes, usageRes] = await Promise.all([
          fetch("/api/tenants?view=reminder", { cache: "no-store" }),
          fetch("/api/tenants/reminders", { cache: "no-store" }),
        ]);

        const tenantsJson = await tenantsRes.json();
        const usageJson = await usageRes.json();

        if (!tenantsRes.ok) {
          toast.error(tenantsJson.error ?? "Could not load reminder tenants.");
          setTenants([]);
          setUsageByTenant({});
          return;
        }

        const rows = Array.isArray(tenantsJson.tenants) ? tenantsJson.tenants : [];
        setTenants(rows as TenantReminderRow[]);

        const usageMap = Object.fromEntries(
          (Array.isArray(usageJson.reminders) ? usageJson.reminders : []).map((item: ReminderUsage) => [item.tenant_id, item]),
        );
        setUsageByTenant(usageMap);
      } catch {
        toast.error("Network error while loading reminders.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const reminderTenants = useMemo(() => {
    return tenants.filter((tenant) => {
      return (tenant.status === "active" || tenant.status === "moved_out") && !!tenant.phone && tenant.pending_amount > 0;
    });
  }, [tenants]);

  const selectedRecipients = useMemo(
    () =>
      reminderTenants
        .filter((tenant) => selectedTenantIds.includes(tenant.id))
        .map((tenant) => ({
          ...tenant,
          reminderDetails: getTenantReminderDetails(tenant),
        })),
    [reminderTenants, selectedTenantIds],
  );

  function toggleSelection(tenantId: string) {
    const usage = usageByTenant[tenantId];
    const limit = usage?.limit ?? REMINDER_LIMIT;
    const used = Math.min(usage?.count ?? 0, limit);
    const remaining = Math.max(0, limit - used);
    const cooldownUntil = usage?.cooldown_until ? new Date(usage.cooldown_until) : null;
    const cooldownActive = cooldownUntil ? cooldownUntil.getTime() > Date.now() : false;

    if (remaining <= 0 || cooldownActive) {
      return;
    }

    setSelectedTenantIds((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId],
    );
  }

  function openConfirmDialog() {
    if (selectedRecipients.length === 0) {
      toast.error("Select at least one tenant with remaining reminder capacity.");
      return;
    }

    setConfirmOpen(true);
  }

  async function sendSelectedReminders() {
    if (selectedRecipients.length === 0) {
      toast.error("Select at least one tenant with remaining reminder capacity.");
      return;
    }

    setConfirmOpen(false);
    setLoadingOpen(true);
    setSending(true);
    try {
      const response = await fetch("/api/tenants/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantIds: selectedRecipients.map((tenant) => tenant.id) }),
      });
      const json = await response.json();
      if (!response.ok) {
        toast.error(json.error ?? "Could not send reminders.");
        return;
      }

      const successfulRecipients = (json.results ?? [])
        .filter((item: { tenantId: string; sent: boolean }) => item.sent)
        .map((item: { tenantId: string; sent: boolean }) => {
          const tenant = reminderTenants.find((entry) => entry.id === item.tenantId);
          const reminderDetails = tenant ? getTenantReminderDetails(tenant) : null;
          return {
            id: item.tenantId,
            full_name: tenant?.full_name ?? "Tenant",
            room_number: tenant?.room_number ?? null,
            amount: tenant?.pending_amount ?? null,
            billingAmount: reminderDetails?.billingAmount ?? null,
            billingPeriodLabel: reminderDetails?.billingPeriodLabel ?? null,
          };
        });

      setSuccessRecipients(successfulRecipients);
      setSuccessOpen(true);
      toast.success(
        successfulRecipients.length > 0
          ? `Reminders sent to ${successfulRecipients.length} tenant${successfulRecipients.length === 1 ? "" : "s"}.`
          : "No reminders were sent.",
      );

      const usageRes = await fetch("/api/tenants/reminders", { cache: "no-store" });
      const usageJson = await usageRes.json();
      const usageMap = Object.fromEntries(
        (Array.isArray(usageJson.reminders) ? usageJson.reminders : []).map((item: ReminderUsage) => [item.tenant_id, item]),
      );
      setUsageByTenant(usageMap);
    } catch {
      toast.error("Network error while sending reminders.");
    } finally {
      setLoadingOpen(false);
      setSending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Monthly Rent reminders</h1>
          <p className="text-sm text-muted-foreground">Send reminders for tenants with pending rent in a cleaner, more compact view.</p>
        </div>
        <Button
          onClick={openConfirmDialog}
          disabled={sending || selectedRecipients.length === 0}
          className="w-full sm:w-auto"
        >
          {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : <><Send className="mr-2 h-4 w-4" />Send reminders</>}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reminderTenants.length === 0 ? (
        <Card className="border-dashed border-border/70">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">No tenants with pending rent right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">Tenants with pending rent and available phone numbers will appear here once reminders are due.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminderTenants.map((tenant) => (
            <TenantReminderCard
              key={tenant.id}
              tenant={tenant}
              usage={usageByTenant[tenant.id]}
              isSelected={selectedTenantIds.includes(tenant.id)}
              toggleSelection={toggleSelection}
              sending={sending}
            />
          ))}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={(open) => !sending && setConfirmOpen(open)}>
        <DialogContent className="max-w-2xl rounded-2xl border-border/70 bg-card p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <DialogTitle className="text-lg font-semibold">Send rent reminders?</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              These tenants will receive a rent reminder for the amount shown below.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
            {selectedRecipients.map((tenant) => (
              <div key={tenant.id} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-medium text-foreground">{tenant.full_name}</p>
                    <p className="text-sm text-muted-foreground">Room {tenant.room_number || "-"}</p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-right">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                        Pending for Billing period
                      </p>
                      <p className="mt-1 font-semibold text-foreground">₹{formatCurrency(tenant.reminderDetails.billingAmount)}</p>
                      <p className="text-xs text-muted-foreground">{tenant.reminderDetails.billingPeriodLabel}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendSelectedReminders} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...
                </>
              ) : (
                "Confirm send"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={loadingOpen} onOpenChange={() => {}}>
        <DialogContent className="fixed inset-0 z-[70] flex h-screen w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center rounded-none border-0 bg-background/95 p-0 shadow-none [&>button]:hidden">
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border/70 bg-card/95 px-8 py-10 text-center shadow-2xl">
            <div className="rounded-full bg-primary/10 p-4 text-primary">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Sending rent reminders</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Please wait while the reminders are sent to the selected tenants.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-border/70 bg-card p-0 shadow-2xl">
          <DialogHeader className="border-b border-border/70 px-6 py-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <DialogTitle className="text-lg font-semibold">Reminders sent</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {successRecipients.length > 0
                ? "The following tenants received the rent reminder."
                : "No reminders were sent."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
            {successRecipients.length > 0 ? (
              successRecipients.map((tenant) => (
                <div key={tenant.id} className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-foreground">{tenant.full_name}</p>
                      <p className="text-sm text-muted-foreground">Room {tenant.room_number || "-"}</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                          Pending for Billing period
                        </p>
                        <p className="mt-1 font-semibold text-foreground">₹{formatCurrency(tenant.billingAmount)}</p>
                        <p className="text-xs text-muted-foreground">{tenant.billingPeriodLabel}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 p-4 text-sm text-muted-foreground">
                No reminders were sent for the selected tenants.
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-border/70 bg-muted/20 px-6 py-4">
            <Button onClick={() => setSuccessOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
