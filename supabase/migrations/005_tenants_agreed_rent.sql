-- Add agreed rent amount for owner-tenant commercial terms
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS agreed_rent_amount NUMERIC(10,2);

COMMENT ON COLUMN public.tenants.agreed_rent_amount
IS 'Finalized rent amount agreed with tenant at activation/approval time.';
