-- 015_billing_start_end.sql
-- Add billing_start and billing_end columns to payments table

ALTER TABLE payments
ADD COLUMN billing_start DATE,
ADD COLUMN billing_end DATE;

-- Optionally, backfill existing rows using the month column if needed:
UPDATE payments
SET
  billing_start = DATE_TRUNC('month', month),
  billing_end = (DATE_TRUNC('month', month) + INTERVAL '1 month - 1 day')::date
WHERE billing_start IS NULL OR billing_end IS NULL;
