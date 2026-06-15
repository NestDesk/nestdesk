-- ============================================================
-- Dev_create_schema
-- Purpose: create fresh app schema with tables, indexes, policies and triggers
-- ============================================================

BEGIN;

SET TIME ZONE 'Asia/Kolkata';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_enable_rls_on_new_tables()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
DECLARE
  cmd RECORD;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.object_type = 'table'
      AND cmd.schema_name IS NOT NULL
      AND cmd.schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    THEN
      EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', cmd.objid::regclass);
    END IF;
  END LOOP;
END;
$$;

CREATE EVENT TRIGGER trg_auto_enable_rls_new_tables
ON ddl_command_end
WHEN TAG IN ('CREATE TABLE')
EXECUTE FUNCTION public.auto_enable_rls_on_new_tables();

-- Auto-enable RLS on newly created tables so future schema changes remain protected.

-- ============================================================
-- CORE TABLES
-- ============================================================

CREATE TABLE public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  plan TEXT NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'micro', 'starter', 'pro', 'institution')),
  plan_expires_at TIMESTAMPTZ,
  unused_credit_paise INT NOT NULL DEFAULT 0,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  address_line1 TEXT,
  address_line2 TEXT,
  landmark TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  kyc_address_verified BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_owners_user_id_unique
  ON public.owners(user_id);

CREATE OR REPLACE FUNCTION public.current_owner_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM public.owners
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE TABLE public.hostels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'pg'
    CHECK (property_type IN ('pg', 'hostel', 'coliving', 'rental')),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  total_rooms INTEGER NOT NULL DEFAULT 0 CHECK (total_rooms >= 0),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  tenant_join_token TEXT,
  property_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hostels_owner_id
  ON public.hostels(owner_id);

CREATE INDEX idx_hostels_tenant_join_token
  ON public.hostels(tenant_join_token)
  WHERE tenant_join_token IS NOT NULL;

CREATE UNIQUE INDEX idx_hostels_property_code
  ON public.hostels(property_code)
  WHERE property_code IS NOT NULL;

CREATE TABLE public.floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_floors_hostel_id
  ON public.floors(hostel_id);

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id UUID NOT NULL REFERENCES public.floors(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  room_number TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 1 CHECK (capacity > 0),
  rent_amount NUMERIC(10,2) DEFAULT NULL,
  status TEXT NOT NULL DEFAULT 'vacant'
    CHECK (status IN ('vacant', 'occupied', 'occupied_partial', 'maintenance', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_rooms_hostel_id
  ON public.rooms(hostel_id);

CREATE INDEX idx_rooms_floor_id
  ON public.rooms(floor_id);

CREATE UNIQUE INDEX idx_rooms_hostel_room_number_unique
  ON public.rooms(hostel_id, room_number)
  WHERE deleted_at IS NULL;

CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  aadhar_last4 TEXT,
  aadhar_number TEXT,
  aadhar_number_hash TEXT,
  aadhar_doc_path TEXT,
  profile_photo_path TEXT,
  aadhar_front_path TEXT,
  aadhar_back_path TEXT,
  alternate_id_path TEXT,
  occupation_type TEXT,
  institution_name TEXT,
  join_date DATE,
  rent_start_date DATE,
  first_activated_at TIMESTAMPTZ,
  move_out_date DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'moved_out', 'rejected')),
  agreed_rent_amount NUMERIC(10,2),
  security_deposit NUMERIC(10,2),
  security_deposit_returned NUMERIC(10,2),
  gender TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_tenants_owner_id
  ON public.tenants(owner_id);

CREATE INDEX idx_tenants_hostel_id
  ON public.tenants(hostel_id);

CREATE INDEX idx_tenants_room_id
  ON public.tenants(room_id);

CREATE UNIQUE INDEX idx_tenants_aadhar_number_hash_unique
  ON public.tenants(aadhar_number_hash)
  WHERE aadhar_number_hash IS NOT NULL
    AND deleted_at IS NULL;

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE RESTRICT,
  amount NUMERIC(10,2) NOT NULL CHECK (amount >= 0),
  month DATE NOT NULL,
  paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
  billing_start DATE,
  billing_end DATE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'disputed')),
  method TEXT CHECK (method IN ('cash', 'upi', 'bank_transfer', 'razorpay', 'other')),
  razorpay_id TEXT,
  receipt_number TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  ip_address INET,
  recorded_by UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_payments_receipt_number_unique
  ON public.payments(receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE INDEX idx_payments_tenant_id
  ON public.payments(tenant_id);

CREATE INDEX idx_payments_hostel_month
  ON public.payments(hostel_id, month);

CREATE INDEX idx_payments_paid_on
  ON public.payments(paid_on);

CREATE TABLE public.notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_notices_hostel_id
  ON public.notices(hostel_id);

CREATE INDEX idx_notices_hostel_published
  ON public.notices(hostel_id, is_published)
  WHERE deleted_at IS NULL;

CREATE TABLE public.maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE RESTRICT,
  room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'rejected', 'completed', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_maintenance_hostel_id
  ON public.maintenance_requests(hostel_id);

CREATE TABLE public.maintenance_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_maintenance_request_comments_request_id
  ON public.maintenance_request_comments(maintenance_request_id, created_at DESC);

CREATE INDEX idx_maintenance_request_comments_owner_id
  ON public.maintenance_request_comments(owner_id, created_at DESC);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled', 'expired', 'grace_period')),
  razorpay_sub_id TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_owner_id
  ON public.subscriptions(owner_id);

CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  used_by UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_invite_codes_code_unique
  ON public.invite_codes(code);

CREATE INDEX idx_invite_codes_owner_id
  ON public.invite_codes(owner_id);

CREATE TABLE public.login_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_activity_email_created
  ON public.login_activity(email, created_at DESC);

CREATE INDEX idx_login_activity_ip_created
  ON public.login_activity(ip_address, created_at DESC);

CREATE INDEX idx_login_activity_success_created
  ON public.login_activity(success, created_at DESC);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_created
  ON public.audit_logs(user_id, created_at DESC);

CREATE INDEX idx_audit_logs_owner_created
  ON public.audit_logs(owner_id, created_at DESC);

CREATE TABLE public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL
    CHECK (consent_type IN ('data_collection', 'marketing_email', 'whatsapp', 'third_party')),
  consent_given BOOLEAN NOT NULL,
  ip_address INET,
  form_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_consent_records_user_type
  ON public.consent_records(user_id, consent_type, created_at DESC);

CREATE TABLE public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  reason TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_data_deletion_requests_requested_by
  ON public.data_deletion_requests(requested_by, created_at DESC);

CREATE TABLE public.phone_otp_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 TEXT NOT NULL,
  purpose TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_phone_otp_lookup
  ON public.phone_otp_challenges(phone_e164, purpose, created_at DESC);

CREATE INDEX idx_phone_otp_expires
  ON public.phone_otp_challenges(expires_at);

CREATE TABLE public.expenses (
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

CREATE INDEX idx_expenses_owner_date
  ON public.expenses(owner_id, expense_date DESC);

CREATE INDEX idx_expenses_hostel_date
  ON public.expenses(hostel_id, expense_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_owner_category
  ON public.expenses(owner_id, category)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_expenses_owner_status
  ON public.expenses(owner_id, status)
  WHERE deleted_at IS NULL;

CREATE TABLE public.owner_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES public.owners(id) ON DELETE CASCADE,
  gst_number TEXT,
  pan_number TEXT,
  business_name TEXT,
  billing_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_owner_billing_owner_id
  ON public.owner_billing(owner_id);

CREATE TABLE public.property_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL UNIQUE REFERENCES public.hostels(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_property_terms_hostel_id
  ON public.property_terms(hostel_id);

CREATE TABLE public.support_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  hostel_id UUID REFERENCES public.hostels(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  designation TEXT NOT NULL DEFAULT 'Staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_staff_owner_id
  ON public.support_staff(owner_id);

CREATE INDEX idx_support_staff_hostel_id
  ON public.support_staff(hostel_id);

CREATE TABLE public.property_billing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hostel_id UUID NOT NULL UNIQUE REFERENCES public.hostels(id) ON DELETE CASCADE,
  gst_number TEXT,
  pan_number TEXT,
  upi_id TEXT,
  business_name TEXT,
  billing_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_property_billing_hostel_id
  ON public.property_billing(hostel_id);

CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE RESTRICT,
  billing_start DATE NOT NULL,
  billing_end DATE NOT NULL,
  monthly_rent NUMERIC(10, 2) NOT NULL CHECK (monthly_rent >= 0),
  days_in_month SMALLINT NOT NULL CHECK (days_in_month BETWEEN 28 AND 31),
  occupied_days SMALLINT NOT NULL CHECK (occupied_days >= 1),
  per_day_rent NUMERIC(12, 4) NOT NULL CHECK (per_day_rent >= 0),
  payable_amount NUMERIC(10, 2) NOT NULL CHECK (payable_amount >= 0),
  is_prorated BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_type TEXT NOT NULL DEFAULT 'full_month'
    CHECK (invoice_type IN ('first_partial','full_month','final_partial','custom')),
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft','issued','paid','overdue','waived')),
  invoice_number TEXT UNIQUE,
  notes TEXT,
  generated_by UUID REFERENCES public.owners(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_billing_order CHECK (billing_end >= billing_start),
  CONSTRAINT chk_occupied_cap CHECK (occupied_days <= days_in_month)
);

CREATE INDEX idx_invoices_tenant_id
  ON public.invoices (tenant_id);

CREATE INDEX idx_invoices_hostel_id
  ON public.invoices (hostel_id);

CREATE INDEX idx_invoices_billing_start
  ON public.invoices (billing_start DESC);

CREATE INDEX idx_invoices_status
  ON public.invoices (status)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_invoices_payment_id
  ON public.invoices (payment_id)
  WHERE payment_id IS NOT NULL;

CREATE TABLE public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free','micro','starter','pro','institution')),
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

CREATE INDEX idx_payment_orders_owner_id
  ON public.payment_orders(owner_id);

CREATE INDEX idx_payment_orders_status
  ON public.payment_orders(status);

CREATE INDEX idx_payment_orders_razorpay_order_id
  ON public.payment_orders(razorpay_order_id);

CREATE TABLE public.sales_leads (
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  institution_name TEXT,
  property_count INT,
  tenant_count INT,
  preferred_timeline TEXT,
  status TEXT NOT NULL DEFAULT 'fresh'
    CHECK (status IN ('fresh', 'contacted', 'closed', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STORAGE BUCKET + POLICIES
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-documents', 'tenant-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tenant_docs_select_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tenant_docs_select_own"
      ON storage.objects FOR SELECT TO authenticated
      USING (
        bucket_id = 'tenant-documents'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tenant_docs_insert_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tenant_docs_insert_own"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'tenant-documents'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tenant_docs_update_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tenant_docs_update_own"
      ON storage.objects FOR UPDATE TO authenticated
      USING (
        bucket_id = 'tenant-documents'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'tenant-documents'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
    $policy$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'tenant_docs_delete_own'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "tenant_docs_delete_own"
      ON storage.objects FOR DELETE TO authenticated
      USING (
        bucket_id = 'tenant-documents'
        AND split_part(name, '/', 1) = auth.uid()::text
      )
    $policy$;
  END IF;
END
$$;

-- ============================================================
-- ROW LEVEL SECURITY SETUP
-- ============================================================

-- Enable row-level security according to application access rules.
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_otp_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Restore schema and table privileges for Supabase roles.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO service_role;

-- owners
DROP POLICY IF EXISTS owners_select_own ON public.owners;
CREATE POLICY owners_select_own ON public.owners
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS owners_insert_own ON public.owners;
CREATE POLICY owners_insert_own ON public.owners
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS owners_update_own ON public.owners;
CREATE POLICY owners_update_own ON public.owners
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- hostels
DROP POLICY IF EXISTS hostels_select_own ON public.hostels;
CREATE POLICY hostels_select_own ON public.hostels
  FOR SELECT USING (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS hostels_insert_own ON public.hostels;
CREATE POLICY hostels_insert_own ON public.hostels
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS hostels_update_own ON public.hostels;
CREATE POLICY hostels_update_own ON public.hostels
  FOR UPDATE USING (owner_id = public.current_owner_id())
  WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS hostels_delete_own ON public.hostels;
CREATE POLICY hostels_delete_own ON public.hostels
  FOR DELETE USING (owner_id = public.current_owner_id());

-- floors
DROP POLICY IF EXISTS floors_select_own ON public.floors;
CREATE POLICY floors_select_own ON public.floors
  FOR SELECT USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS floors_insert_own ON public.floors;
CREATE POLICY floors_insert_own ON public.floors
  FOR INSERT WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS floors_update_own ON public.floors;
CREATE POLICY floors_update_own ON public.floors
  FOR UPDATE USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

-- rooms
DROP POLICY IF EXISTS rooms_select_own ON public.rooms;
CREATE POLICY rooms_select_own ON public.rooms
  FOR SELECT USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS rooms_insert_own ON public.rooms;
CREATE POLICY rooms_insert_own ON public.rooms
  FOR INSERT WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS rooms_update_own ON public.rooms;
CREATE POLICY rooms_update_own ON public.rooms
  FOR UPDATE USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

-- tenants
DROP POLICY IF EXISTS tenants_select_scope ON public.tenants;
CREATE POLICY tenants_select_scope ON public.tenants
  FOR SELECT USING (
    owner_id = public.current_owner_id() OR auth_user_id = auth.uid()
  );

DROP POLICY IF EXISTS tenants_insert_own ON public.tenants;
CREATE POLICY tenants_insert_own ON public.tenants
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS tenants_update_own ON public.tenants;
CREATE POLICY tenants_update_own ON public.tenants
  FOR UPDATE USING (owner_id = public.current_owner_id())
  WITH CHECK (owner_id = public.current_owner_id());

-- payments
DROP POLICY IF EXISTS payments_select_scope ON public.payments;
CREATE POLICY payments_select_scope ON public.payments
  FOR SELECT USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
    OR tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS payments_insert_own ON public.payments;
CREATE POLICY payments_insert_own ON public.payments
  FOR INSERT WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS payments_update_own ON public.payments;
CREATE POLICY payments_update_own ON public.payments
  FOR UPDATE USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

-- notices
DROP POLICY IF EXISTS notices_select_scope ON public.notices;
CREATE POLICY notices_select_scope ON public.notices
  FOR SELECT USING (
    owner_id = public.current_owner_id()
    OR hostel_id IN (
      SELECT hostel_id FROM public.tenants WHERE auth_user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS notices_insert_own ON public.notices;
CREATE POLICY notices_insert_own ON public.notices
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS notices_update_own ON public.notices;
CREATE POLICY notices_update_own ON public.notices
  FOR UPDATE USING (owner_id = public.current_owner_id())
  WITH CHECK (owner_id = public.current_owner_id());

-- maintenance_requests
DROP POLICY IF EXISTS maintenance_select_scope ON public.maintenance_requests;
CREATE POLICY maintenance_select_scope ON public.maintenance_requests
  FOR SELECT USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
    OR tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS maintenance_insert_scope ON public.maintenance_requests;
CREATE POLICY maintenance_insert_scope ON public.maintenance_requests
  FOR INSERT WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
    OR tenant_id IN (SELECT id FROM public.tenants WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS maintenance_update_own ON public.maintenance_requests;
CREATE POLICY maintenance_update_own ON public.maintenance_requests
  FOR UPDATE USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

-- maintenance_request_comments
DROP POLICY IF EXISTS maintenance_request_comments_select_own ON public.maintenance_request_comments;
CREATE POLICY maintenance_request_comments_select_own ON public.maintenance_request_comments
  FOR SELECT USING (
    maintenance_request_id IN (
      SELECT id FROM public.maintenance_requests WHERE hostel_id IN (
        SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id()
      )
    )
  );

DROP POLICY IF EXISTS maintenance_request_comments_insert_own ON public.maintenance_request_comments;
CREATE POLICY maintenance_request_comments_insert_own ON public.maintenance_request_comments
  FOR INSERT WITH CHECK (
    owner_id = public.current_owner_id()
    AND maintenance_request_id IN (
      SELECT id FROM public.maintenance_requests WHERE hostel_id IN (
        SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id()
      )
    )
  );

DROP POLICY IF EXISTS maintenance_request_comments_update_own ON public.maintenance_request_comments;
CREATE POLICY maintenance_request_comments_update_own ON public.maintenance_request_comments
  FOR UPDATE USING (
    owner_id = public.current_owner_id()
    AND maintenance_request_id IN (
      SELECT id FROM public.maintenance_requests WHERE hostel_id IN (
        SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id()
      )
    )
  )
  WITH CHECK (
    owner_id = public.current_owner_id()
    AND maintenance_request_id IN (
      SELECT id FROM public.maintenance_requests WHERE hostel_id IN (
        SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id()
      )
    )
  );

DROP POLICY IF EXISTS maintenance_request_comments_delete_own ON public.maintenance_request_comments;
CREATE POLICY maintenance_request_comments_delete_own ON public.maintenance_request_comments
  FOR DELETE USING (
    owner_id = public.current_owner_id()
    AND maintenance_request_id IN (
      SELECT id FROM public.maintenance_requests WHERE hostel_id IN (
        SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id()
      )
    )
  );

-- subscriptions
DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS subscriptions_insert_own ON public.subscriptions;
CREATE POLICY subscriptions_insert_own ON public.subscriptions
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

-- invite_codes
DROP POLICY IF EXISTS invite_codes_select_own ON public.invite_codes;
CREATE POLICY invite_codes_select_own ON public.invite_codes
  FOR SELECT USING (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS invite_codes_insert_own ON public.invite_codes;
CREATE POLICY invite_codes_insert_own ON public.invite_codes
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

-- login_activity
DROP POLICY IF EXISTS login_activity_select_own ON public.login_activity;
CREATE POLICY login_activity_select_own ON public.login_activity
  FOR SELECT USING (user_id = auth.uid());

-- audit_logs
DROP POLICY IF EXISTS audit_logs_select_own ON public.audit_logs;
CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT USING (owner_id = public.current_owner_id());

-- consent_records
DROP POLICY IF EXISTS consent_records_select_own ON public.consent_records;
CREATE POLICY consent_records_select_own ON public.consent_records
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS consent_records_insert_own ON public.consent_records;
CREATE POLICY consent_records_insert_own ON public.consent_records
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- data_deletion_requests
DROP POLICY IF EXISTS data_deletion_requests_select_own ON public.data_deletion_requests;
CREATE POLICY data_deletion_requests_select_own ON public.data_deletion_requests
  FOR SELECT USING (requested_by = auth.uid());

DROP POLICY IF EXISTS data_deletion_requests_insert_own ON public.data_deletion_requests;
CREATE POLICY data_deletion_requests_insert_own ON public.data_deletion_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid());

-- phone_otp_challenges
DROP POLICY IF EXISTS phone_otp_challenges_no_access ON public.phone_otp_challenges;
CREATE POLICY phone_otp_challenges_no_access ON public.phone_otp_challenges
  FOR ALL USING (false) WITH CHECK (false);

-- expenses
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

-- owner_billing
DROP POLICY IF EXISTS owner_billing_select_own ON public.owner_billing;
CREATE POLICY owner_billing_select_own ON public.owner_billing
  FOR SELECT USING (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS owner_billing_insert_own ON public.owner_billing;
CREATE POLICY owner_billing_insert_own ON public.owner_billing
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS owner_billing_update_own ON public.owner_billing;
CREATE POLICY owner_billing_update_own ON public.owner_billing
  FOR UPDATE USING (owner_id = public.current_owner_id())
  WITH CHECK (owner_id = public.current_owner_id());

-- property_terms
DROP POLICY IF EXISTS property_terms_select_own ON public.property_terms;
CREATE POLICY property_terms_select_own ON public.property_terms
  FOR SELECT USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS property_terms_insert_own ON public.property_terms;
CREATE POLICY property_terms_insert_own ON public.property_terms
  FOR INSERT WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS property_terms_update_own ON public.property_terms;
CREATE POLICY property_terms_update_own ON public.property_terms
  FOR UPDATE USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

-- support_staff
DROP POLICY IF EXISTS support_staff_select_own ON public.support_staff;
CREATE POLICY support_staff_select_own ON public.support_staff
  FOR SELECT USING (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS support_staff_insert_own ON public.support_staff;
CREATE POLICY support_staff_insert_own ON public.support_staff
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS support_staff_update_own ON public.support_staff;
CREATE POLICY support_staff_update_own ON public.support_staff
  FOR UPDATE USING (owner_id = public.current_owner_id())
  WITH CHECK (owner_id = public.current_owner_id());

-- property_billing
DROP POLICY IF EXISTS property_billing_select_own ON public.property_billing;
CREATE POLICY property_billing_select_own ON public.property_billing
  FOR SELECT USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS property_billing_insert_own ON public.property_billing;
CREATE POLICY property_billing_insert_own ON public.property_billing
  FOR INSERT WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

DROP POLICY IF EXISTS property_billing_update_own ON public.property_billing;
CREATE POLICY property_billing_update_own ON public.property_billing
  FOR UPDATE USING (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  )
  WITH CHECK (
    hostel_id IN (SELECT id FROM public.hostels WHERE owner_id = public.current_owner_id())
  );

-- invoices
DROP POLICY IF EXISTS invoices_owner_all ON public.invoices;
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

DROP POLICY IF EXISTS invoices_tenant_select ON public.invoices;
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

-- payment_orders
DROP POLICY IF EXISTS payment_orders_select_own ON public.payment_orders;
CREATE POLICY payment_orders_select_own ON public.payment_orders
  FOR SELECT USING (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS payment_orders_insert_own ON public.payment_orders;
CREATE POLICY payment_orders_insert_own ON public.payment_orders
  FOR INSERT WITH CHECK (owner_id = public.current_owner_id());

DROP POLICY IF EXISTS payment_orders_update_own ON public.payment_orders;
CREATE POLICY payment_orders_update_own ON public.payment_orders
  FOR UPDATE USING (owner_id = public.current_owner_id())
  WITH CHECK (owner_id = public.current_owner_id());

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_hostels_updated_at
  BEFORE UPDATE ON public.hostels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_floors_updated_at
  BEFORE UPDATE ON public.floors
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_notices_updated_at
  BEFORE UPDATE ON public.notices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_maintenance_requests_updated_at
  BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_data_deletion_requests_updated_at
  BEFORE UPDATE ON public.data_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_owner_billing_updated_at
  BEFORE UPDATE ON public.owner_billing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_property_terms_updated_at
  BEFORE UPDATE ON public.property_terms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_support_staff_updated_at
  BEFORE UPDATE ON public.support_staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_property_billing_updated_at
  BEFORE UPDATE ON public.property_billing
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMIT;
BEGIN;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT chk_subscriptions_valid_period
  CHECK (ends_at IS NULL OR ends_at >= starts_at);

CREATE INDEX IF NOT EXISTS idx_subscriptions_owner_status_ends_at
  ON public.subscriptions(owner_id, status, ends_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_owner_single_active
  ON public.subscriptions(owner_id)
  WHERE status = 'active';

  ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS aadhar_number_hash TEXT;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS aadhar_last4 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_aadhar_number_hash_unique
  ON public.tenants(aadhar_number_hash)
  WHERE aadhar_number_hash IS NOT NULL
    AND deleted_at IS NULL;


COMMIT;

-- Migration to add Aadhaar encryption support to the tenants table

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS aadhar_number_hash TEXT;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS aadhar_last4 TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_aadhar_number_hash_unique
  ON public.tenants(aadhar_number_hash)
  WHERE aadhar_number_hash IS NOT NULL
    AND deleted_at IS NULL;


-- Add UPI ID support for property billing details
ALTER TABLE public.property_billing
  ADD COLUMN IF NOT EXISTS upi_id TEXT;


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


-- Migration to allow downgrade-generated credit transaction events.

ALTER TABLE public.credit_transactions
  DROP CONSTRAINT IF EXISTS credit_transactions_event_type_check;

ALTER TABLE public.credit_transactions
  ADD CONSTRAINT credit_transactions_event_type_check
  CHECK (event_type IN ('admin_credit_added', 'credit_used', 'downgrade_credit_added'));


CREATE TABLE IF NOT EXISTS public.custom_institution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL DEFAULT 'institution' CHECK (code = 'institution'),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  monthly_price_paise INT NOT NULL CHECK (monthly_price_paise >= 0),
  yearly_price_paise INT NOT NULL CHECK (yearly_price_paise >= 0),
  max_properties INT NOT NULL CHECK (max_properties >= 1),
  max_tenants INT NOT NULL CHECK (max_tenants >= 1),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_institution_plans_code
  ON public.custom_institution_plans(code)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.owner_custom_institution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  custom_plan_id UUID NOT NULL REFERENCES public.custom_institution_plans(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_owner_custom_institution_plans_active_owner_id
  ON public.owner_custom_institution_plans(owner_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_owner_custom_institution_plans_plan_id
  ON public.owner_custom_institution_plans(custom_plan_id);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS custom_plan_id UUID REFERENCES public.custom_institution_plans(id) ON DELETE SET NULL;

ALTER TABLE public.payment_orders
  ADD COLUMN IF NOT EXISTS custom_plan_id UUID REFERENCES public.custom_institution_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subscriptions_custom_plan_id
  ON public.subscriptions(custom_plan_id);

CREATE INDEX IF NOT EXISTS idx_payment_orders_custom_plan_id
  ON public.payment_orders(custom_plan_id);


CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL CHECK (code IN ('free', 'micro', 'starter', 'pro', 'institution')),
  name TEXT NOT NULL,
  description TEXT,
  monthly_price_paise INT NOT NULL CHECK (monthly_price_paise >= 0),
  yearly_price_paise INT NOT NULL CHECK (yearly_price_paise >= 0),
  max_properties INT NOT NULL CHECK (max_properties >= 1),
  max_tenants INT NOT NULL CHECK (max_tenants >= 1),
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rank INT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_code_unique
  ON public.subscription_plans(code)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_code_active
  ON public.subscription_plans(code, is_active);

CREATE INDEX IF NOT EXISTS idx_subscription_plans_rank
  ON public.subscription_plans(rank)
  WHERE is_active = TRUE;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'free',
  'Free',
  'For trying NestDesk with one property.',
  0,
  0,
  1,
  15,
  FALSE,
  TRUE,
  NULL,
  1
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'free'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'starter',
  'Starter',
  'For established hostels and PGs.',
  49900,
  538920,
  1,
  50,
  FALSE,
  TRUE,
  NULL,
  2
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'starter'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'micro',
  'Micro',
  'For growing hostels and PGs.',
  94900,
  1024920,
  2,
  120,
  FALSE,
  TRUE,
  NULL,
  3
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'micro'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'pro',
  'Pro',
  'For multi-property operators.',
  139900,
  1510920,
  3,
  150,
  FALSE,
  TRUE,
  NULL,
  4
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'pro'
);

INSERT INTO public.subscription_plans (
  code,
  name,
  description,
  monthly_price_paise,
  yearly_price_paise,
  max_properties,
  max_tenants,
  is_custom,
  is_active,
  created_by,
  rank
)
SELECT
  'institution',
  'Institution',
  'For institutions that need custom rollout and onboarding.',
  0,
  0,
  100,
  10000,
  TRUE,
  TRUE,
  NULL,
  5
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscription_plans p
  WHERE p.code = 'institution'
);


ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS active_plan_id UUID,
  ADD COLUMN IF NOT EXISTS active_plan_name TEXT;

CREATE INDEX IF NOT EXISTS idx_owners_active_plan_id
  ON public.owners(active_plan_id)
  WHERE active_plan_id IS NOT NULL;

ALTER TABLE public.custom_institution_plans
  ADD COLUMN IF NOT EXISTS base_fee_inr INT NOT NULL DEFAULT 100 CHECK (base_fee_inr >= 0),
  ADD COLUMN IF NOT EXISTS property_fee_inr INT NOT NULL DEFAULT 900 CHECK (property_fee_inr >= 0),
  ADD COLUMN IF NOT EXISTS tenant_fee_inr INT NOT NULL DEFAULT 7 CHECK (tenant_fee_inr >= 0),
  ADD COLUMN IF NOT EXISTS tenant_threshold INT NOT NULL DEFAULT 150 CHECK (tenant_threshold >= 0),
  ADD COLUMN IF NOT EXISTS pricing_property_count INT,
  ADD COLUMN IF NOT EXISTS pricing_tenant_count INT,
  ADD COLUMN IF NOT EXISTS formula_version TEXT NOT NULL DEFAULT 'v1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_institution_plans_pricing_property_count_check'
  ) THEN
    ALTER TABLE public.custom_institution_plans
      ADD CONSTRAINT custom_institution_plans_pricing_property_count_check
      CHECK (pricing_property_count IS NULL OR pricing_property_count >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_institution_plans_pricing_tenant_count_check'
  ) THEN
    ALTER TABLE public.custom_institution_plans
      ADD CONSTRAINT custom_institution_plans_pricing_tenant_count_check
      CHECK (pricing_tenant_count IS NULL OR pricing_tenant_count >= 0);
  END IF;
END $$;

WITH latest_active AS (
  SELECT DISTINCT ON (s.owner_id)
    s.owner_id,
    s.plan,
    s.custom_plan_id,
    COALESCE(cp.name, sp.name) AS resolved_plan_name,
    COALESCE(cp.id, sp.id) AS resolved_plan_id
  FROM public.subscriptions s
  LEFT JOIN public.custom_institution_plans cp
    ON cp.id = s.custom_plan_id
  LEFT JOIN public.subscription_plans sp
    ON sp.code = s.plan
   AND sp.is_active = TRUE
  WHERE s.status IN ('active', 'grace_period')
  ORDER BY s.owner_id, s.starts_at DESC
)
UPDATE public.owners o
SET
  active_plan_id = l.resolved_plan_id,
  active_plan_name = l.resolved_plan_name,
  updated_at = NOW()
FROM latest_active l
WHERE o.id = l.owner_id;

UPDATE public.owners o
SET
  active_plan_id = sp.id,
  active_plan_name = sp.name,
  updated_at = NOW()
FROM public.subscription_plans sp
WHERE sp.code = o.plan
  AND sp.is_active = TRUE
  AND o.active_plan_id IS NULL;


DROP INDEX IF EXISTS public.idx_subscription_plans_owner_code_unique;
DROP INDEX IF EXISTS public.idx_subscription_plans_code_owner_active;
DROP INDEX IF EXISTS public.idx_subscription_plans_owner_id_active;
DROP INDEX IF EXISTS public.idx_subscription_plans_global_code_unique;

ALTER TABLE public.subscription_plans
  DROP COLUMN IF EXISTS owner_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_plans_code_unique
  ON public.subscription_plans(code)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_code_active
  ON public.subscription_plans(code, is_active);


CREATE TABLE IF NOT EXISTS public.rent_reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  hostel_id UUID NOT NULL REFERENCES public.hostels(id) ON DELETE CASCADE,
  reminder_month TEXT NOT NULL,
  template_name TEXT NOT NULL DEFAULT 'rent_reminder',
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, reminder_month, template_name)
);

CREATE INDEX IF NOT EXISTS idx_rent_reminder_logs_tenant_month
  ON public.rent_reminder_logs (tenant_id, reminder_month);


INSERT INTO "public"."subscription_plans" ("id", "code", "name", "description", "monthly_price_paise", "yearly_price_paise", "max_properties", "max_tenants", "is_custom", "is_active", "created_by", "created_at", "updated_at", "rank") VALUES ('2bfee0d9-5584-4060-8394-e8a934f02b63', 'free', 'Free', 'For trying NestDesk with one property.', 0, 0, 1, 15, false, true, null, '2026-06-11 22:53:47.978641+00', '2026-06-11 23:15:09.085084+00', 1), ('74c063f0-9fa1-4142-9d81-68dbe77ae6f3', 'institution', 'Institution', 'For institutions that need custom rollout and onboarding.', 0, 0, 100, 10000, true, true, null, '2026-06-11 22:53:47.978641+00', '2026-06-11 23:15:25.511113+00', 5), ('9ba40544-0b4a-4bbc-a533-94b490855f04', 'starter', 'Starter', 'For established hostels and PGs.', 49900, 538920, 1, 50, false, true, null, '2026-06-11 22:53:47.978641+00', '2026-06-11 23:15:14.375406+00', 2), ('cd67a890-19ab-4493-ac3e-daea2bde4870', 'pro', 'Pro', 'For multi-property operators.', 139900, 1510920, 3, 150, false, true, null, '2026-06-11 22:53:47.978641+00', '2026-06-11 23:15:22.460811+00', 4), ('ea72bdd8-a820-4e58-961f-4d0cfad8be08', 'micro', 'Micro', 'For growing hostels and PGs.', 94900, 1024920, 2, 120, false, true, null, '2026-06-11 22:53:47.978641+00', '2026-06-11 23:15:20.318396+00', 3) ON CONFLICT (code) WHERE is_active = TRUE DO NOTHING;