-- ============================================================
-- NestDesk - Add tenant gender field
-- Purpose: Capture tenant self-declared gender in registration
-- ============================================================

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS gender TEXT;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_gender_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_gender_check
  CHECK (gender IN ('male', 'female', 'rather_not_say') OR gender IS NULL);

COMMIT;