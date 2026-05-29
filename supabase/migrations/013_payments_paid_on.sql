-- ============================================================
-- 013 — Add paid_on column to payments
-- ============================================================
-- paid_on is the user-visible date on which a payment was received.
-- Defaults to today; owner may back-date it to any past date (including today).

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_on DATE NOT NULL DEFAULT CURRENT_DATE;

-- Back-fill existing rows: use the paid_at date if present, otherwise created_at
UPDATE public.payments
  SET paid_on = COALESCE(paid_at::DATE, created_at::DATE)
  WHERE paid_on = CURRENT_DATE;   -- only rows that just got the default

-- Index for date-range queries on paid_on
CREATE INDEX IF NOT EXISTS idx_payments_paid_on
  ON public.payments(paid_on);
