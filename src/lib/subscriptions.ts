export type OwnerPlan =
  | "free"
  | "micro"
  | "starter"
  | "pro"
  | "business"
  | "enterprise";

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
  },
  micro: {
    id: "micro",
    name: "Micro",
    description: "For growing hostels and PGs.",
    amountPaise: 39900,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 1,
    maxTenants: 50,
    support: "Email",
  },
  starter: {
    id: "starter",
    name: "Starter",
    description: "For established hostels and PGs.",
    amountPaise: 59900,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 2,
    maxTenants: 75,
    support: "Email",
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For multi-property operators.",
    amountPaise: 99900,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 3,
    maxTenants: 75,
    support: "Priority",
  },
  business: {
    id: "business",
    name: "Business",
    description: "For larger chains and operations teams.",
    amountPaise: 199900,
    currency: "INR",
    billingCycle: "monthly",
    maxProperties: 6,
    maxTenants: 100,
    support: "Dedicated",
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    description: "For custom scale and enterprise controls.",
    amountPaise: 299900,
    currency: "INR",
    billingCycle: "yearly",
    maxProperties: 100,
    maxTenants: 10000,
    support: "Account Manager",
  },
};

export function listPlanConfigs(): PlanConfig[] {
  return [
    PLAN_CONFIG.free,
    PLAN_CONFIG.micro,
    PLAN_CONFIG.starter,
    PLAN_CONFIG.pro,
    PLAN_CONFIG.business,
    PLAN_CONFIG.enterprise,
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
    plan === "business" ||
    plan === "enterprise"
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
  if (plan === "enterprise") {
    endDate.setFullYear(endDate.getFullYear() + 1);
    return endDate;
  }

  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
}
