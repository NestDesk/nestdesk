BEGIN;

SET TIME ZONE 'Asia/Kolkata';

DROP TABLE IF EXISTS public.institution_sales_leads;

CREATE TABLE public.institution_sales_leads (
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  property_count INT,
  tenant_count INT,
  preferred_timeline TEXT,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'closed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
