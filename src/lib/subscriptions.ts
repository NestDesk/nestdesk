export const OWNER_PLANS = [
  "free",
  "micro",
  "starter",
  "pro",
  "institution",
] as const;

export type OwnerPlan = (typeof OWNER_PLANS)[number];

export const BILLING_CYCLES = ["monthly", "yearly"] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export type SubscriptionStatus = "active" | "cancelled" | "expired" | "grace_period";

export interface PlanConfig {
  id: OwnerPlan;
  name: string;
  description: string;
  amountPaise: number;
  currency: "INR";
  billingCycle: "monthly" | "yearly";
  maxProperties: number;
  maxTenants: number;
  support: string;
  isCustom: boolean;
}

export interface PlanDisplayConfig extends Pick<
  PlanConfig,
  | "id"
  | "name"
  | "description"
  | "amountPaise"
  | "currency"
  | "billingCycle"
  | "isCustom"
> {
  features: string[];
  ctaLabel: string;
  ctaHref: string;
  highlighted: boolean;
}

const PLAN_CONFIG: Record<OwnerPlan, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "For trying NestDesk with one property.",
    amountPaise: 0,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 1,
    maxTenants: 15,
    support: "Community",
    isCustom: false,
  },
  micro: {
    id: "micro",
    name: "Micro",
    description: "For growing hostels and PGs.",
    amountPaise: 94900,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 1,
    maxTenants: 50,
    support: "Email",
    isCustom: false,
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "For established hostels and PGs.",
    amountPaise: 49900,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 2,
    maxTenants: 150,
    support: "Email",
    isCustom: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For multi-property operators.",
    amountPaise: 139900,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 3,
    maxTenants: 150,
    support: "Priority",
    isCustom: false,
  },
  institution: {
    id: "institution",
    name: "Institution",
    description:
      "For institutions that need a custom rollout and sales-assisted onboarding.",
    amountPaise: 0,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 100,
    maxTenants: 10000,
    support: "Sales",
    isCustom: true,
  },
};

const PLAN_DISPLAY_CONFIG: Record<OwnerPlan, PlanDisplayConfig> = {
  free: {
    ...PLAN_CONFIG.free,
    features: [
      "Dashboard overview with owner activity snapshots",
      "Tenant management and room occupancy status",
      "Rent payments, receipts, and billing history",
      "Subscriptions & usage insights",
      "Tenant document upload and review",
    ],
    ctaLabel: "Start Free",
    ctaHref: "/register",
    highlighted: false,
  },
  starter: {
    ...PLAN_CONFIG.starter,
    features: [
      "Unlock Dashboard, Hostels, Tenants, Payments, Subscriptions, and Usage",
      "1 property with floors, rooms, and occupancy setup",
      "Up to 50 tenants with tenant lifecycle workflows",
      "Create notices and track maintenance requests",
      "Track expenses and payment statuses",
      "Tenant profile and identity document upload",
      "Email support for faster onboarding",
    ],
    ctaLabel: "Choose Starter",
    ctaHref: "/register",
    highlighted: true,
  },
  micro: {
    ...PLAN_CONFIG.micro,
    features: [
      "Full owner portal access across all sidebar sections",
      "Up to 2 properties and 150 tenants",
      "Live occupancy tracking and room assignment",
      "Notices, maintenance, payments, and expense workflows",
      "Tenant KYC, document verification, and profile completion",
      "Email support with faster issue resolution",
    ],
    ctaLabel: "Choose Micro",
    ctaHref: "/register",
    highlighted: false,
  },
  pro: {
    ...PLAN_CONFIG.pro,
    features: [
      "Full owner portal access with all sidebar modules unlocked",
      "Up to 3 properties and 200 tenants",
      "Advanced reports, occupancy analytics, and room-level visibility",
      "Priority notices, maintenance, payments, expenses, and settings control",
      "Tenant KYC, profile, and document workflows in one place",
      "Faster email support for growing teams",
    ],
    ctaLabel: "Choose Pro",
    ctaHref: "/register",
    highlighted: false,
  },
  institution: {
    ...PLAN_CONFIG.institution,
    features: [
      "Custom property and tenant limits for large portfolios",
      "Dedicated sales-assisted setup, onboarding, and support",
      "Full access to Dashboard, Hostels, Tenants, Payments, Expenses, Occupancy, Notices, Maintenance, Reports, Subscriptions, and Settings",
      "Tenant profile, ID, and KYC workflows for institution use cases",
      "Separate institution and inmate portal access",
      "Priority rollout support and tailored reporting",
    ],
    ctaLabel: "Contact Sales Team",
    ctaHref: "",
    highlighted: false,
  },
};

export function listPlanConfigs(): PlanConfig[] {
  return [
    PLAN_CONFIG.free,
    PLAN_CONFIG.starter,
    PLAN_CONFIG.micro,
    PLAN_CONFIG.pro,
    PLAN_CONFIG.institution,
  ];
}

export function listPlanDisplayConfigs(): PlanDisplayConfig[] {
  return [
    PLAN_DISPLAY_CONFIG.free,
    PLAN_DISPLAY_CONFIG.starter,
    PLAN_DISPLAY_CONFIG.micro,
    PLAN_DISPLAY_CONFIG.pro,
    PLAN_DISPLAY_CONFIG.institution,
  ];
}

export function getPlanConfig(plan: OwnerPlan): PlanConfig {
  return PLAN_CONFIG[plan];
}

export function getPlanDisplayConfig(plan: OwnerPlan): PlanDisplayConfig {
  return PLAN_DISPLAY_CONFIG[plan];
}

export const PLAN_BADGE_CLASSES: Record<OwnerPlan, string> = {
  free: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  micro: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  starter: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  pro: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  institution: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

export function isPaidPlan(plan: OwnerPlan): boolean {
  return plan !== "free" && plan !== "institution";
}

export function normalizeOwnerPlan(plan: string | null | undefined): OwnerPlan {
  if (!plan) return "free";

  if (
    plan === "free" ||
    plan === "micro" ||
    plan === "starter" ||
    plan === "pro" ||
    plan === "institution"
  ) {
    return plan;
  }

  return "free";
}

export function formatPlanLabel(plan: string | null | undefined): string {
  const resolved = normalizeOwnerPlan(plan);
  return getPlanConfig(resolved).name;
}

export function getPlanAmountPaise(plan: OwnerPlan): number {
  return getPlanConfig(plan).amountPaise;
}

export const PLAN_RANKS: Record<OwnerPlan, number> = {
  free: 0,
  starter: 1,
  micro: 2,
  pro: 3,
  institution: 4,
};

export function getPlanRank(plan: OwnerPlan): number {
  return PLAN_RANKS[plan] ?? 0;
}

export type SubscriptionRecord = {
  id?: string;
  plan: string;
  status: SubscriptionStatus;
  razorpay_sub_id?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

export function isSubscriptionCurrent(
  subscription: SubscriptionRecord | null,
): boolean {
  if (!subscription) return false;
  if (subscription.status !== "active" && subscription.status !== "grace_period") {
    return false;
  }
  if (!subscription.ends_at) {
    return true;
  }

  const endsAt = new Date(subscription.ends_at).getTime();
  return endsAt > Date.now();
}

export function getEffectivePlan(
  subscription: SubscriptionRecord | null,
): OwnerPlan {
  if (!subscription) {
    return "free";
  }

  return isSubscriptionCurrent(subscription)
    ? normalizeOwnerPlan(subscription.plan)
    : "free";
}

export function getPlanAmountPaiseForCycle(
  plan: OwnerPlan,
  billingCycle: BillingCycle,
): number {
  const monthlyAmount = getPlanAmountPaise(plan);
  return billingCycle === "yearly"
    ? Math.round(monthlyAmount * 12 * 0.9)
    : monthlyAmount;
}

export function inferBillingCycleFromSubscription(
  startDate: Date,
  endDate: Date,
): BillingCycle {
  const days = Math.round(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  return days >= 330 ? "yearly" : "monthly";
}

export function buildOrderReceipt(ownerId: string, plan: OwnerPlan): string {
  const compactOwner = ownerId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const stamp = Date.now().toString().slice(-8);
  return `ND-${plan.toUpperCase()}-${compactOwner}-${stamp}`;
}

export function computeSubscriptionEndDate(
  plan: OwnerPlan,
  startDate: Date = new Date(),
  billingCycle: BillingCycle = "monthly",
): Date {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + (billingCycle === "yearly" ? 12 : 1));
  return endDate;
}
