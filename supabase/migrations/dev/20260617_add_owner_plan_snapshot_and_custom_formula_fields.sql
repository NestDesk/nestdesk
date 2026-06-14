ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS active_plan_id UUID,
  ADD COLUMN IF NOT EXISTS active_plan_name TEXT;

CREATE INDEX IF NOT EXISTS idx_owners_active_plan_id
  ON public.owners(active_plan_id)
  WHERE active_plan_id IS NOT NULL;

ALTER TABLE public.custom_institution_plans
  ADD COLUMN IF NOT EXISTS base_fee_inr INT NOT NULL DEFAULT 100 CHECK (base_fee_inr >= 0),
  ADD COLUMN IF NOT EXISTS property_fee_inr INT NOT NULL DEFAULT 900 CHECK (property_fee_inr >= 0),
  ADD COLUMN IF NOT EXISTS tenant_fee_inr INT NOT NULL DEFAULT 7 CHECK (tenant_fee_inr >= 0),
  ADD COLUMN IF NOT EXISTS tenant_threshold INT NOT NULL DEFAULT 150 CHECK (tenant_threshold >= 0),
  ADD COLUMN IF NOT EXISTS pricing_property_count INT,
  ADD COLUMN IF NOT EXISTS pricing_tenant_count INT,
  ADD COLUMN IF NOT EXISTS formula_version TEXT NOT NULL DEFAULT 'v1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_institution_plans_pricing_property_count_check'
  ) THEN
    ALTER TABLE public.custom_institution_plans
      ADD CONSTRAINT custom_institution_plans_pricing_property_count_check
      CHECK (pricing_property_count IS NULL OR pricing_property_count >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_institution_plans_pricing_tenant_count_check'
  ) THEN
    ALTER TABLE public.custom_institution_plans
      ADD CONSTRAINT custom_institution_plans_pricing_tenant_count_check
      CHECK (pricing_tenant_count IS NULL OR pricing_tenant_count >= 0);
  END IF;
END $$;

WITH latest_active AS (
  SELECT DISTINCT ON (s.owner_id)
    s.owner_id,
    s.plan,
    s.custom_plan_id,
    COALESCE(cp.name, sp.name) AS resolved_plan_name,
    COALESCE(cp.id, sp.id) AS resolved_plan_id
  FROM public.subscriptions s
  LEFT JOIN public.custom_institution_plans cp
    ON cp.id = s.custom_plan_id
  LEFT JOIN public.subscription_plans sp
    ON sp.code = s.plan
   AND sp.is_active = TRUE
  WHERE s.status IN ('active', 'grace_period')
  ORDER BY s.owner_id, s.starts_at DESC
)
UPDATE public.owners o
SET
  active_plan_id = l.resolved_plan_id,
  active_plan_name = l.resolved_plan_name,
  updated_at = NOW()
FROM latest_active l
WHERE o.id = l.owner_id;

UPDATE public.owners o
SET
  active_plan_id = sp.id,
  active_plan_name = sp.name,
  updated_at = NOW()
FROM public.subscription_plans sp
WHERE sp.code = o.plan
  AND sp.is_active = TRUE
  AND o.active_plan_id IS NULL;
