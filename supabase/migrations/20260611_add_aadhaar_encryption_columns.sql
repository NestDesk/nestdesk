-- Migration to add Aadhaar encryption support to the tenants table

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS aadhar_number_hash TEXT;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS aadhar_last4 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_aadhar_number_hash_unique
  ON public.tenants(aadhar_number_hash)
  WHERE aadhar_number_hash IS NOT NULL
    AND deleted_at IS NULL;
