-- ============================================================
-- NestDesk - Property Billing (Per-Property)
-- Converts billing from owner-level to property-level
-- ============================================================

BEGIN;

-- ============================================================
-- PROPERTY BILLING DETAILS (per hostel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_billing (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id       UUID NOT NULL UNIQUE REFERENCES public.hostels(id) ON DELETE CASCADE,
  gst_number      TEXT,
  pan_number      TEXT,
  business_name   TEXT,
  billing_address TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_billing_hostel_id ON public.property_billing(hostel_id);

-- Migrate data from owner_billing to property_billing (if data exists)
-- For now, this table is empty and will be populated as owners add billing details per property

COMMIT;
