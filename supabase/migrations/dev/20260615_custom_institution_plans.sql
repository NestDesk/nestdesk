CREATE TABLE IF NOT EXISTS public.custom_institution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL DEFAULT 'institution' CHECK (code = 'institution'),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  monthly_price_paise INT NOT NULL CHECK (monthly_price_paise >= 0),
  yearly_price_paise INT NOT NULL CHECK (yearly_price_paise >= 0),
  max_properties INT NOT NULL CHECK (max_properties >= 1),
  max_tenants INT NOT NULL CHECK (max_tenants >= 1),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_institution_plans_code
  ON public.custom_institution_plans(code)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.owner_custom_institution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  custom_plan_id UUID NOT NULL REFERENCES public.custom_institution_plans(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_custom_institution_plans_active_owner_id
  ON public.owner_custom_institution_plans(owner_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_owner_custom_institution_plans_plan_id
  ON public.owner_custom_institution_plans(custom_plan_id);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS custom_plan_id UUID REFERENCES public.custom_institution_plans(id) ON DELETE SET NULL;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS custom_plan_id UUID REFERENCES public.custom_institution_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_custom_plan_id
  ON public.subscriptions(custom_plan_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_custom_plan_id
  ON public.payment_orders(custom_plan_id);
