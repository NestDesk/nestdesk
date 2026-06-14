-- Migration to add a dedicated credit transaction history table.

CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  payment_order_id UUID REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('admin_credit_added', 'credit_used')),
  amount_paise INT NOT NULL,
  balance_before INT NOT NULL,
  balance_after INT NOT NULL,
  note TEXT,
  created_by TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_owner_id
  ON public.credit_transactions(owner_id);

CREATE INDEX idx_credit_transactions_payment_order_id
  ON public.credit_transactions(payment_order_id);

CREATE INDEX idx_credit_transactions_created_at
  ON public.credit_transactions(created_at DESC);
