-- ============================================================
-- 014 — Rent Billing Engine
-- ============================================================
-- Adds rent_start_date to tenants (owner-editable, independent of
-- join_date) and creates the invoices table which permanently
-- snapshots every billing calculation so it never changes even if
-- the tenant's agreed rent amount is later updated.

-- ─── 1. Add rent_start_date to tenants ──────────────────────

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS rent_start_date DATE;

-- Default existing tenants: use join_date
UPDATE public.tenants
  SET rent_start_date = join_date
  WHERE rent_start_date IS NULL AND join_date IS NOT NULL;

COMMENT ON COLUMN public.tenants.rent_start_date IS
  'The date from which rent billing begins. Defaults to join_date but can
   be independently edited by the owner (e.g. to grant a free-first-day).
   All billing calculations use this field — never join_date directly.';

-- ─── 2. Create invoices table ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID            NOT NULL REFERENCES public.tenants(id)  ON DELETE RESTRICT,
  hostel_id       UUID            NOT NULL REFERENCES public.hostels(id)  ON DELETE RESTRICT,

  -- Billing period (both dates inclusive)
  billing_start   DATE            NOT NULL,
  billing_end     DATE            NOT NULL,

  -- Immutable calculation snapshot ----------------------------------
  -- These must NEVER be recalculated from live tenant data later.
  -- They reflect the rent agreement and period at the moment of
  -- invoice creation. Change = new invoice, not an edit.
  monthly_rent    NUMERIC(10, 2)  NOT NULL CHECK (monthly_rent >= 0),
  days_in_month   SMALLINT        NOT NULL CHECK (days_in_month BETWEEN 28 AND 31),
  occupied_days   SMALLINT        NOT NULL CHECK (occupied_days >= 1),
  per_day_rent    NUMERIC(12, 4)  NOT NULL CHECK (per_day_rent >= 0),
  payable_amount  NUMERIC(10, 2)  NOT NULL CHECK (payable_amount >= 0),
  is_prorated     BOOLEAN         NOT NULL DEFAULT FALSE,
  invoice_type    TEXT            NOT NULL DEFAULT 'full_month'
                    CHECK (invoice_type IN ('first_partial','full_month','final_partial','custom')),
  -- ------------------------------------------------------------------

  status          TEXT            NOT NULL DEFAULT 'issued'
                    CHECK (status IN ('draft','issued','paid','overdue','waived')),

  invoice_number  TEXT            UNIQUE,
  notes           TEXT,

  generated_by    UUID            REFERENCES public.owners(id)  ON DELETE SET NULL,
  payment_id      UUID            REFERENCES public.payments(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT chk_billing_order    CHECK (billing_end >= billing_start),
  CONSTRAINT chk_occupied_cap     CHECK (occupied_days <= days_in_month)
);

-- ─── 3. Indexes ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id
  ON public.invoices (tenant_id);

CREATE INDEX IF NOT EXISTS idx_invoices_hostel_id
  ON public.invoices (hostel_id);

CREATE INDEX IF NOT EXISTS idx_invoices_billing_start
  ON public.invoices (billing_start DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON public.invoices (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_payment_id
  ON public.invoices (payment_id)
  WHERE payment_id IS NOT NULL;

-- ─── 4. Auto-update timestamp ────────────────────────────────

CREATE TRIGGER set_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ─── 5. Row Level Security ───────────────────────────────────

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Owners can fully manage invoices for properties they own
CREATE POLICY invoices_owner_all ON public.invoices
  FOR ALL
  TO authenticated
  USING (
    hostel_id IN (
      SELECT h.id
      FROM public.hostels h
      JOIN public.owners o ON o.id = h.owner_id
      WHERE o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    hostel_id IN (
      SELECT h.id
      FROM public.hostels h
      JOIN public.owners o ON o.id = h.owner_id
      WHERE o.user_id = auth.uid()
    )
  );

-- Tenants can read their own invoices (read-only)
CREATE POLICY invoices_tenant_select ON public.invoices
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT t.id
      FROM public.tenants t
      WHERE t.auth_user_id = auth.uid()
    )
  );

-- ─── 6. Notify PostgREST ──────────────────────────────────────
NOTIFY pgrst, 'reload schema';
