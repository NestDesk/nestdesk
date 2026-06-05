export type OwnerPlan = "free" | "micro" | "starter" | "pro" | "institution";

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

const PLAN_CONFIG: Record<OwnerPlan, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    description: "For trying NestDesk with one property.",
    amountPaise: 0,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 1,
    maxTenants: 10,
    support: "Community",
    isCustom: false,
  },
  micro: {
    id: "micro",
    name: "Micro",
    description: "For growing hostels and PGs.",
    amountPaise: 500,
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
    amountPaise: 700,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 2,
    maxTenants: 75,
    support: "Email",
    isCustom: false,
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For multi-property operators.",
    amountPaise: 1100,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 3,
    maxTenants: 75,
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

export function listPlanConfigs(): PlanConfig[] {
  return [
    PLAN_CONFIG.free,
    PLAN_CONFIG.micro,
    PLAN_CONFIG.starter,
    PLAN_CONFIG.pro,
    PLAN_CONFIG.institution,
  ];
}

export function getPlanConfig(plan: OwnerPlan): PlanConfig {
  return PLAN_CONFIG[plan];
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

export function buildOrderReceipt(ownerId: string, plan: OwnerPlan): string {
  const compactOwner = ownerId.replace(/-/g, "").slice(0, 8).toUpperCase();
  const stamp = Date.now().toString().slice(-8);
  return `ND-${plan.toUpperCase()}-${compactOwner}-${stamp}`;
}

export function computeSubscriptionEndDate(
  plan: OwnerPlan,
  startDate: Date = new Date(),
): Date {
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
}
