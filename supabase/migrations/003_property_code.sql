-- ============================================================
-- NestDesk - Add readable property_code to hostels
-- Format: {INITIALS}-{8 random digits}  e.g. SBH-47293810
-- This code never changes and never expires.
-- ============================================================

BEGIN;

ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS property_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hostels_property_code
  ON public.hostels(property_code)
  WHERE property_code IS NOT NULL;

COMMIT;
