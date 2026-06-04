-- ============================================
-- Subscription payment order tracking for Razorpay
-- ============================================

CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free','micro','test','starter','pro','business','enterprise')),
  status TEXT NOT NULL DEFAULT 'created'
    CHECK (status IN ('created','paid','failed','cancelled')),
  amount_paise INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR' CHECK (currency = 'INR'),
  receipt TEXT NOT NULL,
  razorpay_order_id TEXT NOT NULL UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  notes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_owner_id
  ON public.payment_orders(owner_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_status
  ON public.payment_orders(status);

CREATE INDEX IF NOT EXISTS idx_payment_orders_razorpay_order_id
  ON public.payment_orders(razorpay_order_id);
