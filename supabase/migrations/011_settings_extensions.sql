-- ============================================================
-- NestDesk - Settings Extensions
-- Adds: owner_billing, property_terms, support_staff
-- ============================================================

BEGIN;

-- ============================================================
-- OWNER BILLING DETAILS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.owner_billing (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     UUID NOT NULL UNIQUE REFERENCES public.owners(id) ON DELETE CASCADE,
  gst_number   TEXT,
  pan_number   TEXT,
  business_name TEXT,
  billing_address TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_billing_owner_id ON public.owner_billing(owner_id);

-- ============================================================
-- PROPERTY TERMS & CONDITIONS (per hostel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.property_terms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id  UUID NOT NULL UNIQUE REFERENCES public.hostels(id) ON DELETE CASCADE,
  content    TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_terms_hostel_id ON public.property_terms(hostel_id);

-- ============================================================
-- SUPPORT STAFF (per owner, optionally scoped to hostel)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.support_staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  hostel_id   UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  designation TEXT NOT NULL DEFAULT 'Staff',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_staff_owner_id ON public.support_staff(owner_id);
CREATE INDEX IF NOT EXISTS idx_support_staff_hostel_id ON public.support_staff(hostel_id);

COMMIT;
