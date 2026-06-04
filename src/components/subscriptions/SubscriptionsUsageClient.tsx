"use client";

import Script from "next/script";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatPlanLabel,
  listPlanConfigs,
  normalizeOwnerPlan,
  type OwnerPlan,
} from "@/lib/subscriptions";

type SubscriptionSummary = {
  id: string;
  plan: OwnerPlan;
  status: string;
  starts_at: string;
  ends_at: string | null;
  razorpay_payment_id: string | null;
} | null;

type SubscriptionsUsageClientProps = {
  currentPlan: OwnerPlan;
  subscription: SubscriptionSummary;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatRupeesFromPaise(amountPaise: number) {
  const value = amountPaise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function SubscriptionsUsageClient({
  currentPlan,
  subscription,
}: SubscriptionsUsageClientProps) {
  const [isCheckoutScriptReady, setIsCheckoutScriptReady] = useState(false);
  const [activePlan, setActivePlan] = useState<OwnerPlan>(
    normalizeOwnerPlan(currentPlan),
  );
  const [isBuyingPlan, setIsBuyingPlan] = useState<OwnerPlan | null>(null);

  const plans = useMemo(
    () => listPlanConfigs().filter((plan) => plan.id !== "free"),
    [],
  );

  async function openCheckout(plan: OwnerPlan) {
    if (isBuyingPlan) return;

    if (!isCheckoutScriptReady || typeof window.Razorpay === "undefined") {
      toast.error("Razorpay checkout is not ready. Please refresh and try again.");
      return;
    }

    try {
      setIsBuyingPlan(plan);

      const orderRes = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const orderData = (await orderRes.json().catch(() => null)) as {
        order_id?: string;
        amount?: number;
        currency?: string;
        key_id?: string;
        error?: string;
      } | null;

      if (!orderRes.ok || !orderData?.order_id || !orderData.key_id) {
        throw new Error(orderData?.error || "Could not create payment order.");
      }

      const razorpay = new window.Razorpay({
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "NestDesk",
        description: `${formatPlanLabel(plan)} plan subscription`,
        order_id: orderData.order_id,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          const verifyRes = await fetch("/api/verify-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan,
            }),
          });

          const verifyData = (await verifyRes.json().catch(() => null)) as {
            success?: boolean;
            error?: string;
          } | null;

          if (!verifyRes.ok || !verifyData?.success) {
            toast.error(verifyData?.error || "Payment verification failed.");
            return;
          }

          setActivePlan(plan);
          toast.success("Subscription activated successfully.");
          window.location.reload();
        },
        modal: {
          ondismiss: () => {
            toast.message("Checkout closed before payment completion.");
          },
        },
        theme: {
          color: "#2563EB",
        },
      });

      razorpay.on(
        "payment.failed",
        (failure: { error?: { description?: string } }) => {
          toast.error(failure.error?.description || "Payment failed.");
        },
      );

      razorpay.open();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setIsBuyingPlan(null);
    }
  }

  return (
    <div className="space-y-6">
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onLoad={() => setIsCheckoutScriptReady(true)}
        onError={() => {
          setIsCheckoutScriptReady(false);
          toast.error("Failed to load Razorpay checkout script.");
        }}
      />

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Current Plan</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Plan</p>
            <p className="text-lg font-semibold text-foreground">
              {formatPlanLabel(activePlan)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge
              variant={subscription?.status === "active" ? "default" : "outline"}
            >
              {subscription?.status ?? "free"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valid Till</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(subscription?.ends_at ?? null)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = activePlan === plan.id;
          const isProcessing = isBuyingPlan === plan.id;

          return (
            <Card
              key={plan.id}
              className="rounded-2xl border-border/70 transition-all hover:border-primary/40"
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  {isCurrent ? <Badge>Current</Badge> : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-2xl font-bold text-foreground">
                  {formatRupeesFromPaise(plan.amountPaise)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">
                    / {plan.billingCycle === "yearly" ? "year" : "month"}
                  </span>
                </p>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Up to {plan.maxProperties} properties
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    Up to {plan.maxTenants} tenants
                  </p>
                  <p className="inline-flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    {plan.support} support
                  </p>
                </div>

                <Button
                  type="button"
                  className="w-full gap-2"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || isProcessing}
                  onClick={() => openCheckout(plan.id)}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      {isCurrent ? "Current Plan" : "Buy Plan"}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
