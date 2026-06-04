import { Rocket } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizeOwnerPlan,
  type OwnerPlan,
  type SubscriptionStatus,
} from "@/lib/subscriptions";
import { SubscriptionsUsageClient } from "@/components/subscriptions/SubscriptionsUsageClient";

type SubscriptionRow = {
  id: string;
  plan: string;
  status: SubscriptionStatus;
  starts_at: string;
  ends_at: string | null;
  razorpay_sub_id: string | null;
};

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();

  const { data: owner } = await admin
    .from("owners")
    .select("id, plan")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!owner) return null;

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("id, plan, status, starts_at, ends_at, razorpay_sub_id")
    .eq("owner_id", owner.id)
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle<SubscriptionRow>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Rocket className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Subscriptions and Usage
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your NestDesk plan and upgrade as your operations grow.
          </p>
        </div>
      </div>

      <Separator />

      <SubscriptionsUsageClient
        currentPlan={normalizeOwnerPlan(owner.plan) as OwnerPlan}
        subscription={
          subscription
            ? {
                id: subscription.id,
                plan: normalizeOwnerPlan(subscription.plan),
                status: subscription.status,
                starts_at: subscription.starts_at,
                ends_at: subscription.ends_at,
                razorpay_payment_id: subscription.razorpay_sub_id,
              }
            : null
        }
      />
    </div>
  );
}
