"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, Tag } from "lucide-react";

const pricingPlans = [
  {
    planId: "free",
    name: "Free",
    monthlyPrice: "0",
    period: "forever",
    description: "Best for a single small property",
    features: [
      "1 property",
      "Up to 15 tenants",
      "Tenants and Payments",
      "Tenant Document Upload",
    ],
    cta: "Start Free",
    ctaHref: "/register",
    highlighted: false,
  },
  {
    planId: "micro",
    name: "Micro",
    monthlyPrice: "5",
    period: "month",
    description: "For growing hostels and PGs",
    features: [
      "1 property",
      "Up to 50 tenants",
      "Tenants, Payments, Notices, Maintenance",
      "Occupancy and Expense modules",
      "Basic Document Upload",
    ],
    cta: "Choose Micro",
    ctaHref: "/register",
    highlighted: true,
  },
  {
    planId: "starter",
    name: "Starter",
    monthlyPrice: "7",
    period: "month",
    description: "For established hostels and PGs",
    features: [
      "Up to 2 properties",
      "Up to 75 tenants each",
      "Tenants, Payments, Notices, Maintenance",
      "Occupancy and Expense modules",
      "Tenant profile and Identity document upload",
    ],
    cta: "Choose Starter",
    ctaHref: "/register",
    highlighted: false,
  },
  {
    planId: "pro",
    name: "Pro",
    monthlyPrice: "11",
    period: "month",
    description: "Most popular for multi-property operators",
    features: [
      "Up to 3 properties",
      "Up to 75 tenants in each",
      "Occupancy and Expense modules",
      "Tenant profile and Identity document upload",
      "Dedicated onboarding",
      "Tenants, Payments, Notices, Maintenance",
      "Operational review support",
    ],
    cta: "Choose Pro",
    ctaHref: "/register",
    highlighted: false,
  },
  {
    planId: "institution",
    name: "Institution",
    monthlyPrice: null,
    period: null,
    description:
      "For institutions that need a custom rollout and sales-assisted onboarding",
    features: [
      "Custom property and tenant limits",
      "Tailored rollout and onboarding",
      "Tenant profile and Identity document upload",
      "Occupancy, Expenses, Payments, Notices, and Maintenance",
      "Sales-assisted setup",
    ],
    cta: "Contact Sales Team",
    ctaHref: "tel:+917081335246",
    highlighted: false,
  },
];

function formatINR(n: number): string {
  return n.toLocaleString("en-IN");
}

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const carouselRef = useRef<HTMLDivElement | null>(null);

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
    <section id="pricing" className="bg-muted/30 py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center text-center">
          <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Clear plans based on your current scale
          </h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            Every plan includes the core NestDesk workflows. Higher plans add
            capacity and hands-on support for larger operations.
          </p>
        </div>

        {/* Toggle */}
        <div className="mb-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-3 rounded-full border border-border bg-background p-1 shadow-sm">
            <button
              onClick={() => setIsYearly(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                !isYearly
                  ? "bg-primary text-white shadow"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
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
              Save an extra 10% with yearly billing
            </span>
          )}
        </div>

        {/* Cards */}
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
            className="flex gap-6 overflow-x-auto pb-4 pr-4 pt-4 snap-x snap-mandatory scroll-smooth"
          >
            {pricingPlans.map(
              ({
                planId,
                name,
                monthlyPrice,
                period,
                description,
                features: planFeatures,
                cta,
                ctaHref,
                highlighted,
              }) => {
                const isPaid =
                  monthlyPrice && monthlyPrice !== "0" && period === "month";
                const monthly = isPaid ? parseInt(monthlyPrice) : null;
                const activePrice =
                  isYearly && monthly ? Math.round(monthly * 0.9) : monthly;
                const yearlyTotal =
                  isYearly && monthly ? Math.round(monthly * 0.9) * 12 : null;
                const ctaLinkHref = ctaHref.startsWith("tel:")
                  ? ctaHref
                  : `${ctaHref}?plan=${planId}`;

                return (
                  <div
                    key={name}
                    className={`relative flex min-w-[85vw] flex-col rounded-2xl border p-6 snap-start sm:min-w-[70vw] md:min-w-[22rem] xl:min-w-[24rem] ${
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

                    <div className="mb-4">
                      <h3
                        className={`text-lg font-bold ${highlighted ? "text-white" : "text-foreground"}`}
                      >
                        {name}
                      </h3>
                      <p
                        className={`mt-1 h-8 text-xs leading-4 ${highlighted ? "text-white/70" : "text-muted-foreground"}`}
                      >
                        {description}
                      </p>
                    </div>

                    <div className="mb-6">
                      {!isPaid ? (
                        <div className="space-y-3">
                          <span
                            className={`text-3xl font-bold leading-none tracking-tight ${highlighted ? "text-white" : "text-foreground"}`}
                          >
                            {monthlyPrice === "0" ? "Free" : "Custom"}
                          </span>
                          {planId === "institution" && (
                            <p
                              className={`text-sm ${highlighted ? "text-white/70" : "text-muted-foreground"}`}
                            >
                              Pricing is tailored to your rollout and requirements.
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="mb-3 flex items-baseline gap-1">
                            <span
                              className={`text-3xl font-bold leading-none tracking-tight ${highlighted ? "text-white" : "text-foreground"}`}
                            >
                              Rs.{activePrice ? formatINR(activePrice) : ""}
                            </span>
                            <span
                              className={`text-sm ${highlighted ? "text-white/70" : "text-muted-foreground"}`}
                            >
                              /month
                            </span>
                          </div>

                          {isYearly && yearlyTotal && (
                            <p
                              className={`mb-3 text-xs ${highlighted ? "text-white/60" : "text-muted-foreground"}`}
                            >
                              Rs.{formatINR(yearlyTotal)} billed yearly
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <ul className="mb-8 flex-1 space-y-2.5">
                      {planFeatures.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <CheckCircle2
                            className={`mt-0.5 h-4 w-4 shrink-0 ${highlighted ? "text-white/80" : "text-primary"}`}
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

                    <Link href={ctaLinkHref}>
                      <Button
                        className={`w-full rounded-xl ${
                          highlighted
                            ? "bg-white text-primary hover:bg-white/90"
                            : ""
                        }`}
                        variant={highlighted ? "secondary" : "default"}
                      >
                        {cta}
                      </Button>
                    </Link>
                  </div>
                );
              },
            )}
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
      </div>
    </section>
  );
}
