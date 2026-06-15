import { PricingPlans } from "./PricingPlans";

export function PricingSection({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <PricingPlans
      id="pricing"
      isLoggedIn={isLoggedIn}
      title="Clear plans based on your current scale"
      description="Every plan includes the core NestDesk workflows. Higher plans add capacity and hands-on support for larger operations."
    />
  );
}
