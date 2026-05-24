BEGIN;

CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  category TEXT NOT NULL
    CHECK (
      category IN (
        'electricity',
        'water',
        'gas',
        'internet',
        'staff_salary',
        'security_services',
        'housekeeping_cleaning',
        'maintenance_repair',
        'plumbing',
        'electrical_repairs',
        'pest_control',
        'laundry_linen',
        'kitchen_supplies',
        'property_supplies',
        'property_tax',
        'government_fees',
        'insurance',
        'software_saas',
        'marketing',
        'transportation',
        'legal_professional',
        'waste_management',
        'amenities',
        'miscellaneous'
      )
    ),
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  expense_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'paid'
    CHECK (status IN ('paid', 'pending', 'disputed')),
  payment_mode TEXT
    CHECK (payment_mode IN ('cash', 'upi', 'bank_transfer', 'card', 'other')),
  vendor_name TEXT,
  bill_number TEXT,
  notes TEXT,
  is_recurring BOOLEAN NOT NULL DEFAULT FALSE,
  recurring_frequency TEXT
    CHECK (recurring_frequency IN ('monthly', 'quarterly', 'yearly')),
  next_due_date DATE,
  receipt_url TEXT,
  created_by UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_expenses_owner_date
  ON public.expenses(owner_id, expense_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_hostel_date
  ON public.expenses(hostel_id, expense_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_owner_category
  ON public.expenses(owner_id, category)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_owner_status
  ON public.expenses(owner_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS expenses_select_own ON public.expenses;
CREATE POLICY expenses_select_own ON public.expenses
  FOR SELECT USING (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS expenses_insert_own ON public.expenses;
CREATE POLICY expenses_insert_own ON public.expenses
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS expenses_update_own ON public.expenses;
CREATE POLICY expenses_update_own ON public.expenses
  FOR UPDATE USING (owner_id = public.current_owner_id())
  WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS expenses_delete_own ON public.expenses;
CREATE POLICY expenses_delete_own ON public.expenses
  FOR DELETE USING (owner_id = public.current_owner_id());

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
