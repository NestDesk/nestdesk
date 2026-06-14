DROP INDEX IF EXISTS public.idx_subscription_plans_owner_code_unique;
DROP INDEX IF EXISTS public.idx_subscription_plans_code_owner_active;
DROP INDEX IF EXISTS public.idx_subscription_plans_owner_id_active;
DROP INDEX IF EXISTS public.idx_subscription_plans_global_code_unique;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS owner_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_code_unique
  ON public.subscription_plans(code)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_code_active
  ON public.subscription_plans(code, is_active);
