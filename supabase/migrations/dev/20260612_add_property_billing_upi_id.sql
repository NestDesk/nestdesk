-- Add UPI ID support for property billing details
ALTER TABLE public.property_billing
  ADD COLUMN IF NOT EXISTS upi_id TEXT;
