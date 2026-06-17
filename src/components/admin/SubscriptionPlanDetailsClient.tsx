"use client";

import * as React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { formatDateInIndia } from "../../lib/date";

const planOrder = ["free", "starter", "micro", "pro", "institution"] as const;

type PlanCounts = Record<
  string,
  { total: number; active: number; expired: number }
>;

type HostelsRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
};

type OwnerRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SubscriptionDetail = {
  id: string;
  owner_id: string;
  plan: string;
  custom_plan_id: string | null;
  custom_plan_name: string | null;
  status: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  owner: OwnerRow | null;
  hostels: HostelsRow[];
};

type PlanDetailResponse = {
  plan: string;
  subscriptions: SubscriptionDetail[];
};

type Props = {
  planCounts: PlanCounts;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return formatDateInIndia(value, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPlanName(plan: string) {
  return plan?.charAt(0).toUpperCase() + plan?.slice(1);
}

export default function SubscriptionPlanDetailsClient({ planCounts }: Props) {
  const [selectedPlan, setSelectedPlan] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<PlanDetailResponse | null>(null);

  const openPlan = React.useCallback(async (plan: string) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
    setLoading(true);
    setError(null);
    setDetails(null);

    try {
      const response = await fetch(
        `/api/admin/subscription-plan-details?plan=${encodeURIComponent(plan)}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(
          json?.error ?? `Failed to load plan details (${response.status})`,
        );
      }

      const json = (await response.json()) as PlanDetailResponse;
      setDetails(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load plan details.");
    } finally {
      setLoading(false);
    }
  }, []);

  const closeDialog = React.useCallback(() => {
    setDialogOpen(false);
  }, []);

  return (
    <>
      <div className="space-y-3">
        {planOrder.map((plan) => (
          <button
            key={plan}
            type="button"
            onClick={() => openPlan(plan)}
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/50 px-4 py-4 text-left transition hover:border-border hover:bg-muted"
          >
            <div>
              <p className="font-medium text-foreground">{formatPlanName(plan)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{planCounts[plan]?.total ?? 0} subscriptions</span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  {planCounts[plan]?.active ?? 0} active
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {planCounts[plan]?.expired ?? 0} expired
                </span>
              </div>
            </div>
            <Badge variant="secondary">View</Badge>
          </button>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(80rem,100vw)] max-w-[90rem] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle>
              {selectedPlan
                ? `${formatPlanName(selectedPlan)} plan activity`
                : "Plan details"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              View the hostels and subscription lifecycle events for the selected
              plan.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-2xl border border-border/70 bg-background/80 p-8 text-center text-sm text-muted-foreground">
                Loading plan details…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive/70 bg-destructive/10 p-6 text-sm text-destructive-foreground">
                {error}
              </div>
            ) : details ? (
              details.subscriptions.length === 0 ? (
                <div className="rounded-2xl border border-border/70 bg-background/80 p-8 text-center text-sm text-muted-foreground">
                  No subscriptions found for this plan.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-border/70 bg-card/80">
                  <table className="min-w-full border-collapse text-sm">
                    <thead className="border-b border-border/70 bg-muted/50 text-left text-xs uppercase tracking-[0.24em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Plan</th>
                        <th className="px-4 py-3">Custom plan</th>
                        <th className="px-4 py-3">Account</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Bought on</th>
                        <th className="px-4 py-3">Activated</th>
                        <th className="px-4 py-3">Expired / ends</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {details.subscriptions.map((subscription) => (
                        <tr key={subscription.id} className="bg-card/80">
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {formatPlanName(subscription.plan)}
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {subscription.custom_plan_name ?? "-"}
                          </td>
                          <td className="px-4 py-4 align-top">
                            <div className="font-medium text-foreground">
                              {subscription.owner?.full_name ?? "Owner"}
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {subscription.owner?.email ?? "No email available"}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            <span
                              className={
                                subscription.status === "active"
                                  ? "rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600"
                                  : "rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700"
                              }
                            >
                              {subscription.status === "active" ? "Active" : "Expired"}
                            </span>
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {formatDate(subscription.created_at)}
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {formatDate(subscription.starts_at)}
                          </td>
                          <td className="px-4 py-4 align-top text-muted-foreground">
                            {subscription.ends_at
                              ? formatDate(subscription.ends_at)
                              : "Ongoing"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-border/70 bg-background/80 p-8 text-center text-sm text-muted-foreground">
                Select a plan to view details.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
