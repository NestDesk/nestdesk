-- ============================================
-- Add test subscription plan and update plan constraints
-- ============================================

ALTER TABLE public.owners
  DROP CONSTRAINT IF EXISTS owners_plan_check;

ALTER TABLE public.owners
  ADD CONSTRAINT owners_plan_check
    CHECK (plan IN ('free', 'micro', 'test', 'starter', 'pro', 'business', 'enterprise'));

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_plan_check;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_plan_check
    CHECK (plan IN ('free', 'micro', 'test', 'starter', 'pro', 'business', 'enterprise'));
