"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { InstitutionSalesLeadDialog } from "./InstitutionSalesLeadDialog";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  getPlanRank,
  listPlanDisplayConfigs,
  type BillingCycle,
  type OwnerPlan,
  type PlanDisplayConfig,
} from "../../lib/subscriptions";

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

function getCtaLabel(
  cta: string,
  ctaText: string,
  planId: string,
  isCustom: boolean,
  isAssignedCustom: boolean,
) {
  if (planId === "institution") {
    return isAssignedCustom ? ctaText : cta;
  }
  if (cta.startsWith("Choose")) {
    return cta.replace(/^Choose/, ctaText);
  }
  return cta;
}

type AssignedCustomPlanPayload = {
  id?: string;
  name?: string;
  description?: string | null;
  monthly_price_paise?: number;
  max_properties?: number;
  max_tenants?: number;
};

function mergeAssignedCustomPlan(
  plans: PlanDisplayConfig[],
  assignedCustomPlan?: AssignedCustomPlanPayload | null,
): PlanDisplayConfig[] {
  if (!assignedCustomPlan?.id) {
    return plans;
  }

  const institutionBase = listPlanDisplayConfigs().find(
    (plan) => plan.id === "institution",
  );
  if (!institutionBase) {
    return plans;
  }

  const assignedPlan: PlanDisplayConfig = {
    ...institutionBase,
    name: assignedCustomPlan.name?.trim() || institutionBase.name,
    description:
      assignedCustomPlan.description?.trim() || institutionBase.description,
    amountPaise:
      typeof assignedCustomPlan.monthly_price_paise === "number"
        ? assignedCustomPlan.monthly_price_paise
        : institutionBase.amountPaise,
    isCustom: true,
    customPlanId: assignedCustomPlan.id,
    maxProperties:
      typeof assignedCustomPlan.max_properties === "number"
        ? assignedCustomPlan.max_properties
        : institutionBase.maxProperties,
    maxTenants:
      typeof assignedCustomPlan.max_tenants === "number"
        ? assignedCustomPlan.max_tenants
        : institutionBase.maxTenants,
  };

  const withoutSameCustomPlan = plans.filter(
    (plan) => !(plan.id === "institution" && plan.customPlanId === assignedPlan.id),
  );

  const freeIndex = withoutSameCustomPlan.findIndex((plan) => plan.id === "free");
  const institutionIndex = withoutSameCustomPlan.findIndex(
    (plan) => plan.id === "institution" && !plan.customPlanId,
  );

  if (freeIndex >= 0) {
    return [
      ...withoutSameCustomPlan.slice(0, freeIndex + 1),
      assignedPlan,
      ...withoutSameCustomPlan.slice(freeIndex + 1),
    ];
  }

  if (institutionIndex >= 0) {
    return [
      ...withoutSameCustomPlan.slice(0, institutionIndex + 1),
      assignedPlan,
      ...withoutSameCustomPlan.slice(institutionIndex + 1),
    ];
  }

  return [...withoutSameCustomPlan, assignedPlan];
}

type PricingPlansProps = {
  isLoggedIn?: boolean;
  ctaText?: string;
  title?: string;
  description?: string;
  id?: string;
  currentPlan?: OwnerPlan;
  currentCustomPlanId?: string | null;
  initialPlans?: PlanDisplayConfig[];
};

export function PricingPlans({
  isLoggedIn = false,
  ctaText = "Choose",
  title,
  description,
  id,
  currentPlan,
  currentCustomPlanId = null,
  initialPlans,
}: PricingPlansProps) {
  const fallbackPlans = listPlanDisplayConfigs();
  const [planCards, setPlanCards] = useState<PlanDisplayConfig[]>(
    initialPlans && initialPlans.length > 0 ? initialPlans : fallbackPlans,
  );
  const [isYearly, setIsYearly] = useState(false);
  const [isCheckoutScriptReady, setIsCheckoutScriptReady] = useState(false);
  const [isBuyingPlan, setIsBuyingPlan] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLeadDialogOpen, setIsLeadDialogOpen] = useState(false);
  const [confirmingUpgrade, setConfirmingUpgrade] = useState(false);
  const [previewData, setPreviewData] = useState<{
    requestedPlan: OwnerPlan;
    customPlanId?: string;
    billingCycle: BillingCycle;
    currentPlan: OwnerPlan;
    currentPlanBillingCycle: BillingCycle;
    currentPlanAmountPaise: number;
    newPlanAmountPaise: number;
    currentOwnerCreditPaise: number;
    prorationCreditPaise: number;
    availableCreditPaise: number;
    creditUsedPaise: number;
    leftoverCreditPaise: number;
    amountDuePaise: number;
    currentPlanEndsAt: string | null;
    requiresCheckout: boolean;
  } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [selectedPlanName, setSelectedPlanName] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  function formatRupee(amountPaise: number) {
    return (amountPaise / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  async function startRazorpayCheckout(
    planId: string,
    planName: string,
    orderData: {
      order_id: string;
      amount: number;
      currency: string;
      key_id: string;
    },
  ) {
    type RazorpayInstance = {
      on(
        event: "payment.failed",
        callback: (failure: { error?: { description?: string } }) => void,
      ): void;
      on(event: string, callback: (event: unknown) => void): void;
      open(): void;
    };
    type RazorpayConstructor = new (
      options: Record<string, unknown>,
    ) => RazorpayInstance;
    const Razorpay = (window as unknown as { Razorpay?: RazorpayConstructor })
      .Razorpay;
    if (!isCheckoutScriptReady || typeof Razorpay === "undefined") {
      toast.error("Razorpay checkout is not ready. Please refresh and try again.");
      return;
    }

    const razorpay = new Razorpay({
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency || "INR",
      name: "NestDesk",
      description: `${planName} plan subscription`,
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
            plan: planId,
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
  }

  async function previewUpgrade(
    planId: string,
    planName: string,
    customPlanId?: string,
  ) {
    if (isBuyingPlan || !isLoggedIn) return;
    setIsBuyingPlan(planId);
    setSelectedPlanId(planId);
    setSelectedPlanName(planName);

    try {
      const billingCycle = isYearly ? "yearly" : "monthly";
      const previewRes = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: planId,
          billingCycle,
          preview: true,
          customPlanId,
        }),
      });

      const data = await previewRes.json().catch(() => null);
      if (!previewRes.ok || !data?.success) {
        throw new Error(data?.error || "Unable to preview plan upgrade.");
      }

      setPreviewData(data);
      setIsConfirmOpen(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not prepare upgrade preview.",
      );
    } finally {
      setIsBuyingPlan(null);
    }
  }

  async function confirmUpgrade() {
    if (!selectedPlanId || !previewData) return;

    setConfirmingUpgrade(true);
    try {
      const response = await fetch("/api/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plan: selectedPlanId,
          billingCycle: previewData.billingCycle,
          confirm: true,
          customPlanId: previewData.customPlanId ?? undefined,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Could not confirm upgrade.");
      }

      if (data?.requiresCheckout === false) {
        toast.success("Subscription upgraded successfully.");
        window.location.reload();
        return;
      }

      if (!data?.order_id || !data?.key_id || !data?.amount || !data?.currency) {
        throw new Error("Incomplete checkout order response.");
      }

      await startRazorpayCheckout(selectedPlanId, selectedPlanName ?? "", {
        order_id: data.order_id,
        amount: data.amount,
        currency: data.currency,
        key_id: data.key_id,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upgrade failed.");
    } finally {
      setConfirmingUpgrade(false);
      setIsConfirmOpen(false);
    }
  }

  const updateScrollButtons = () => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    setCanScrollLeft(carousel.scrollLeft > 0);
    setCanScrollRight(
      carousel.scrollLeft + carousel.clientWidth < carousel.scrollWidth - 1,
    );
  };

  const scrollCarousel = (direction: "left" | "right") => {
    const carousel = carouselRef.current;
    if (!carousel) return;

    const distance = Math.round(carousel.clientWidth * 0.8);
    carousel.scrollBy({
      left: direction === "left" ? -distance : distance,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    let isMounted = true;

    fetch("/api/subscription-plans", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load plans");
        }

        const payload = (await response.json()) as {
          plans?: PlanDisplayConfig[];
          assignedCustomPlan?: AssignedCustomPlanPayload | null;
        };

        if (!isMounted || !payload.plans || payload.plans.length === 0) {
          return;
        }

        setPlanCards(
          mergeAssignedCustomPlan(payload.plans, payload.assignedCustomPlan),
        );
      })
      .catch(() => {
        if (isMounted) {
          setPlanCards((existing) =>
            existing.length > 0 ? existing : listPlanDisplayConfigs(),
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const carousel = carouselRef.current;
    if (!carousel) return;

    carousel.addEventListener("scroll", updateScrollButtons, { passive: true });
    window.addEventListener("resize", updateScrollButtons);

    return () => {
      carousel.removeEventListener("scroll", updateScrollButtons);
      window.removeEventListener("resize", updateScrollButtons);
    };
  }, []);

  return (
    <section id={id} className="bg-muted/30 py-10">
      <div className="w-full px-4 sm:px-6">
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="afterInteractive"
          onLoad={() => setIsCheckoutScriptReady(true)}
          onError={() => {
            setIsCheckoutScriptReady(false);
            toast.error("Failed to load Razorpay checkout script.");
          }}
        />
        {title ? (
          <div className="mb-6 flex flex-col items-center text-center">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h2>
            {description ? (
              <p className="mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
                {description}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 rounded-full border border-border bg-background p-1 shadow-sm">
            <button
              onClick={() => setIsYearly(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                !isYearly
                  ? "bg-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                isYearly
                  ? "bg-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
            </button>
          </div>
          {isYearly && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <Tag className="h-3 w-3" />
              Yearly billing preview
            </span>
          )}
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 z-10 hidden items-center pl-1 md:flex">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => scrollCarousel("left")}
              disabled={!canScrollLeft}
              aria-label="Scroll plans left"
              className="shadow-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <div
            ref={carouselRef}
            className="flex gap-4 overflow-x-auto pb-3 pr-3 pt-3 snap-x snap-mandatory scroll-smooth"
          >
            {planCards.map((plan) => {
              const planId = plan.id;
              const name = plan.name;
              const planFeatures = plan.features;
              const cta = plan.ctaLabel;
              const ctaHref = plan.ctaHref;
              const highlighted = plan.highlighted;
              const isAssignedCustomInstitution = !!(
                planId === "institution" && plan.isCustom && plan.customPlanId
              );
              const isCurrent =
                isLoggedIn &&
                currentPlan === planId &&
                (planId !== "institution"
                  ? true
                  : plan.customPlanId
                    ? currentCustomPlanId === plan.customPlanId
                    : !currentCustomPlanId);
              const planRank = getPlanRank(planId);
              const currentPlanRank = currentPlan ? getPlanRank(currentPlan) : 0;
              const isDowngrade =
                isLoggedIn &&
                currentPlan &&
                planRank < currentPlanRank &&
                currentPlan !== "free";
              const monthly = plan.amountPaise > 0 ? plan.amountPaise / 100 : null;
              const isPaid = monthly !== null;
              const usesCustomYearly = Boolean(plan.customPlanId);
              const activePrice =
                isYearly && monthly
                  ? usesCustomYearly
                    ? monthly
                    : Math.round(monthly * 0.9)
                  : monthly;
              const yearlyTotal =
                isYearly && monthly
                  ? usesCustomYearly
                    ? monthly * 12
                    : Math.round(monthly * 0.9) * 12
                  : null;
              const ctaLinkHref = ctaHref.startsWith("tel:")
                ? ctaHref
                : isLoggedIn
                  ? "/dashboard/subscriptions"
                  : `${ctaHref}?plan=${planId}`;
              const buttonText = getCtaLabel(
                cta,
                ctaText,
                planId,
                plan.isCustom,
                isAssignedCustomInstitution,
              );
              const currentButtonText = isCurrent
                ? "Current plan"
                : isDowngrade
                  ? "Downgrade unavailable"
                  : buttonText;

              return (
                <div
                  key={`${name}-${plan.customPlanId ?? planId}`}
                  className={`relative flex min-w-[80vw] flex-col rounded-2xl border p-5 snap-start sm:min-w-[68vw] md:min-w-[20rem] xl:min-w-[22rem] ${
                    highlighted
                      ? "border-primary/0 bg-gradient-to-br from-primary via-blue-600 to-blue-700 shadow-xl shadow-primary/30"
                      : "card-hover border-border/60 bg-card/80 backdrop-blur-sm"
                  }`}
                >
                  {highlighted && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1 text-xs font-semibold text-white ring-2 ring-background">
                      Most Popular
                    </span>
                  )}

                  <div className="mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={`text-base font-semibold ${
                          highlighted ? "text-white" : "text-foreground"
                        }`}
                      >
                        {name}
                      </h3>
                      {plan.customPlanId ? (
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                            highlighted
                              ? "border-white/30 bg-white/10 text-white"
                              : "border-primary/30 bg-primary/10 text-primary"
                          }`}
                        >
                          Assigned plan
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mb-4">
                    {!isPaid ? (
                      <div className="space-y-3">
                        <span
                          className={`text-3xl font-bold leading-none tracking-tight ${
                            highlighted ? "text-white" : "text-foreground"
                          }`}
                        >
                          {plan.isCustom ? "Custom" : "Free"}
                        </span>
                        {planId === "institution" && (
                          <p
                            className={`text-sm ${
                              highlighted ? "text-white/70" : "text-muted-foreground"
                            }`}
                          >
                            Pricing is tailored to your rollout and requirements.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="mb-2 space-y-2">
                          {!usesCustomYearly ? (
                            <div className="flex items-center gap-2 text-[18px] font-semibold">
                              <span
                                className={`line-through ${
                                  highlighted
                                    ? "text-white/60"
                                    : "text-muted-foreground"
                                }`}
                              >
                                Rs.{monthly ? formatINR(monthly * 2 + 1) : ""}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                                  highlighted
                                    ? "bg-white/15 text-white"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                50% off
                              </span>
                            </div>
                          ) : null}

                          <div className="flex items-baseline gap-1">
                            <span
                              className={`text-3xl font-bold leading-none tracking-tight ${
                                highlighted ? "text-white" : "text-foreground"
                              }`}
                            >
                              Rs.{activePrice ? formatINR(activePrice) : ""}
                            </span>
                            <span
                              className={`text-sm ${
                                highlighted
                                  ? "text-white/70"
                                  : "text-muted-foreground"
                              }`}
                            >
                              /month
                            </span>
                          </div>
                        </div>

                        {isYearly && yearlyTotal && (
                          <p
                            className={`mb-2 text-sm font-semibold ${
                              highlighted ? "text-white" : "text-foreground"
                            }`}
                          >
                            Rs.{formatINR(yearlyTotal)} billed yearly
                          </p>
                        )}
                        {plan.customPlanId &&
                        plan.maxProperties != null &&
                        plan.maxTenants != null ? (
                          <p
                            className={`text-sm ${
                              highlighted ? "text-white/70" : "text-muted-foreground"
                            }`}
                          >
                            Allowed {plan.maxProperties} properties ·{" "}
                            {plan.maxTenants} tenants
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  <ul className="mb-6 flex-1 space-y-2">
                    {planFeatures.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2
                          className={`mt-0.5 h-4 w-4 shrink-0 ${
                            highlighted ? "text-white/80" : "text-primary"
                          }`}
                        />
                        <span
                          className={
                            highlighted ? "text-white/90" : "text-muted-foreground"
                          }
                        >
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {planId === "institution" ? (
                    isCurrent ? (
                      <Button
                        type="button"
                        className={`w-full rounded-xl ${
                          highlighted ? "bg-white text-primary" : ""
                        }`}
                        variant={highlighted ? "secondary" : "default"}
                        disabled
                      >
                        {currentButtonText}
                      </Button>
                    ) : isAssignedCustomInstitution ? (
                      <Button
                        type="button"
                        className={`w-full rounded-xl ${
                          highlighted
                            ? "bg-white text-primary hover:bg-white/90"
                            : ""
                        }`}
                        variant={highlighted ? "secondary" : "default"}
                        size="sm"
                        disabled={isBuyingPlan === planId}
                        onClick={() =>
                          previewUpgrade(planId, name, plan.customPlanId)
                        }
                      >
                        {isBuyingPlan === planId ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4" />
                            {buttonText}
                          </>
                        )}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className={`w-full rounded-xl ${
                          highlighted
                            ? "bg-white text-primary hover:bg-white/90"
                            : ""
                        }`}
                        variant={highlighted ? "secondary" : "default"}
                        onClick={() => setIsLeadDialogOpen(true)}
                      >
                        {buttonText}
                      </Button>
                    )
                  ) : isCurrent ? (
                    <Button
                      type="button"
                      className={`w-full rounded-xl ${
                        highlighted ? "bg-white text-primary" : ""
                      }`}
                      variant={highlighted ? "secondary" : "default"}
                      disabled
                    >
                      {currentButtonText}
                    </Button>
                  ) : isDowngrade ? (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        className={`w-full rounded-xl ${
                          highlighted ? "bg-white text-primary" : ""
                        }`}
                        variant={highlighted ? "secondary" : "default"}
                        disabled
                      >
                        {currentButtonText}
                      </Button>
                      <p className="text-xs text-amber-600">
                        Downgrades are blocked while your current subscription is
                        active.
                      </p>
                    </div>
                  ) : isLoggedIn && isPaid ? (
                    <Button
                      type="button"
                      className={`w-full rounded-xl ${
                        highlighted ? "bg-white text-primary hover:bg-white/90" : ""
                      }`}
                      variant={highlighted ? "secondary" : "default"}
                      size="sm"
                      disabled={isBuyingPlan === planId}
                      onClick={() => previewUpgrade(planId, name, plan.customPlanId)}
                    >
                      {isBuyingPlan === planId ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          {buttonText}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Link href={ctaLinkHref}>
                      <Button
                        className={`w-full rounded-xl ${
                          highlighted
                            ? "bg-white text-primary hover:bg-white/90"
                            : ""
                        }`}
                        variant={highlighted ? "secondary" : "default"}
                      >
                        {buttonText}
                      </Button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          <div className="absolute inset-y-0 right-0 z-10 hidden items-center pr-1 md:flex">
            <Button
              variant="secondary"
              size="icon"
              onClick={() => scrollCarousel("right")}
              disabled={!canScrollRight}
              aria-label="Scroll plans right"
              className="shadow-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Need a custom rollout for large operations? Contact support for an
          institution plan tailored to your property network.
        </p>

        <InstitutionSalesLeadDialog
          open={isLeadDialogOpen}
          onOpenChange={setIsLeadDialogOpen}
        />

        <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm plan upgrade</DialogTitle>
              <DialogDescription>
                Review the plan change before you proceed. Your current billing
                period will end now, and any unused credit will be applied.
              </DialogDescription>
            </DialogHeader>
            {previewData ? (
              <div className="mt-4 space-y-4 text-sm text-muted-foreground">
                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">Current plan</p>
                  <p>
                    {previewData.currentPlan} • {previewData.currentPlanBillingCycle}
                  </p>
                  {previewData.currentPlanEndsAt ? (
                    <p>
                      Expires on:{" "}
                      {new Date(previewData.currentPlanEndsAt).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">New plan</p>
                  <p>
                    {selectedPlanName} • {previewData.billingCycle}
                  </p>
                  <p>Plan value: ₹{formatRupee(previewData.newPlanAmountPaise)}</p>
                </div>

                <div className="rounded-2xl border border-border bg-background p-4">
                  <p className="font-medium text-foreground">Credit summary</p>
                  <p>
                    Existing credit: ₹
                    {formatRupee(previewData.currentOwnerCreditPaise)}
                  </p>
                  <p>
                    Proration credit: ₹
                    {formatRupee(previewData.prorationCreditPaise)}
                  </p>
                  <p>
                    Available credit: ₹
                    {formatRupee(previewData.availableCreditPaise)}
                  </p>
                  <p>Credit applied: ₹{formatRupee(previewData.creditUsedPaise)}</p>
                  <p>Amount due now: ₹{formatRupee(previewData.amountDuePaise)}</p>
                  {previewData.leftoverCreditPaise > 0 ? (
                    <p>
                      Leftover credit after upgrade: ₹
                      {formatRupee(previewData.leftoverCreditPaise)}
                    </p>
                  ) : null}
                </div>
                {previewData.amountDuePaise === 0 ? (
                  <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
                    No payment is required. This upgrade will apply immediately.
                  </p>
                ) : null}
              </div>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                onClick={confirmUpgrade}
                disabled={confirmingUpgrade}
              >
                {confirmingUpgrade ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Confirming...
                  </>
                ) : (
                  "Confirm upgrade"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsConfirmOpen(false)}
                disabled={confirmingUpgrade}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
