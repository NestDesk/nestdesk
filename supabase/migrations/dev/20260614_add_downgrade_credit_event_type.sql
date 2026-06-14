-- Migration to allow downgrade-generated credit transaction events.

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_event_type_check;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_event_type_check
  CHECK (event_type IN ('admin_credit_added', 'credit_used', 'downgrade_credit_added'));
