CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL CHECK (code IN ('free', 'micro', 'starter', 'pro', 'institution')),
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_paise INT NOT NULL CHECK (monthly_price_paise >= 0),
  yearly_price_paise INT NOT NULL CHECK (yearly_price_paise >= 0),
  max_properties INT NOT NULL CHECK (max_properties >= 1),
  max_tenants INT NOT NULL CHECK (max_tenants >= 1),
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank INT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_code_unique
  ON public.subscription_plans(code)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_code_active
  ON public.subscription_plans(code, is_active);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_rank
  ON public.subscription_plans(rank)
  WHERE is_active = TRUE;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'free',
  'Free',
  'For trying NestDesk with one property.',
  0,
  0,
  1,
  15,
  FALSE,
  TRUE,
  NULL,
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'free'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'starter',
  'Starter',
  'For established hostels and PGs.',
  49900,
  538920,
  1,
  50,
  FALSE,
  TRUE,
  NULL,
  2
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'starter'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'micro',
  'Micro',
  'For growing hostels and PGs.',
  94900,
  1024920,
  2,
  120,
  FALSE,
  TRUE,
  NULL,
  3
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'micro'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'pro',
  'Pro',
  'For multi-property operators.',
  139900,
  1510920,
  3,
  150,
  FALSE,
  TRUE,
  NULL,
  4
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'pro'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'institution',
  'Institution',
  'For institutions that need custom rollout and onboarding.',
  0,
  0,
  100,
  10000,
  TRUE,
  TRUE,
  NULL,
  5
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'institution'
);
