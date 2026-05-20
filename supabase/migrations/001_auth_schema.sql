-- ============================================================
-- NestDesk - Auth Schema (Day 3)
-- Idempotent one-shot script for Supabase SQL Editor
-- Safe to run multiple times.
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- OWNERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.owners (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT NOT NULL,
  phone                TEXT,
  address_line1        TEXT,
  address_line2        TEXT,
  landmark             TEXT,
  city                 TEXT,
  state                TEXT,
  pincode              TEXT,
  kyc_address_verified BOOLEAN NOT NULL DEFAULT FALSE,
  onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.owners
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS landmark TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS kyc_address_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.owners
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Backfill user_id from legacy auth_user_id when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'owners'
      AND column_name = 'auth_user_id'
  ) THEN
    UPDATE public.owners
    SET user_id = auth_user_id
    WHERE user_id IS NULL
      AND auth_user_id IS NOT NULL;
  END IF;
END
$$;

-- Ensure user_id has FK to auth.users even on pre-existing schemas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'owners_user_id_fkey'
      AND conrelid = 'public.owners'::regclass
  ) THEN
    ALTER TABLE public.owners
      ADD CONSTRAINT owners_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Ensure required constraints/indexes exist even if table pre-existed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_user_id_unique ON public.owners (user_id);

-- ============================================================
-- HOSTELS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.hostels (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  name          TEXT NOT NULL,
  property_type TEXT NOT NULL,
  address       TEXT NOT NULL,
  city          TEXT NOT NULL,
  state         TEXT NOT NULL,
  pincode       TEXT NOT NULL,
  total_rooms   INTEGER NOT NULL DEFAULT 0,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS owner_id UUID,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS property_type TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS total_rooms INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Add FK only if not present.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hostels_owner_id_fkey'
      AND conrelid = 'public.hostels'::regclass
  ) THEN
    ALTER TABLE public.hostels
      ADD CONSTRAINT hostels_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES public.owners(id) ON DELETE RESTRICT;
  END IF;
END
$$;

-- Ensure checks exist and are current.
ALTER TABLE public.hostels DROP CONSTRAINT IF EXISTS hostels_property_type_check;
ALTER TABLE public.hostels
  ADD CONSTRAINT hostels_property_type_check
  CHECK (property_type IN ('pg', 'hostel', 'coliving', 'rental'));

ALTER TABLE public.hostels DROP CONSTRAINT IF EXISTS hostels_total_rooms_check;
ALTER TABLE public.hostels
  ADD CONSTRAINT hostels_total_rooms_check
  CHECK (total_rooms >= 0);

-- ============================================================
-- LOGIN ACTIVITY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.login_activity (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email          TEXT NOT NULL,
  ip_address     TEXT,
  user_agent     TEXT,
  success        BOOLEAN NOT NULL,
  failure_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.login_activity
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS success BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS failure_reason TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'login_activity_user_id_fkey'
      AND conrelid = 'public.login_activity'::regclass
  ) THEN
    ALTER TABLE public.login_activity
      ADD CONSTRAINT login_activity_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_login_activity_email_created
  ON public.login_activity (email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_activity_ip_created
  ON public.login_activity (ip_address, created_at DESC);

-- ============================================================
-- AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id  UUID,
  old_value  JSONB,
  new_value  JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS user_id UUID,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS table_name TEXT,
  ADD COLUMN IF NOT EXISTS record_id UUID,
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'audit_logs_user_id_fkey'
      AND conrelid = 'public.audit_logs'::regclass
  ) THEN
    ALTER TABLE public.audit_logs
      ADD CONSTRAINT audit_logs_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs (user_id, created_at DESC);

-- ============================================================
-- updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_owners_updated_at ON public.owners;
CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_hostels_updated_at ON public.hostels;
CREATE TRIGGER trg_hostels_updated_at
  BEFORE UPDATE ON public.hostels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS + policies (drop/recreate to avoid "policy already exists")
-- ============================================================
ALTER TABLE public.owners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hostels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS owners_select_own ON public.owners;
CREATE POLICY owners_select_own ON public.owners
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS owners_update_own ON public.owners;
CREATE POLICY owners_update_own ON public.owners
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS hostels_select_own ON public.hostels;
CREATE POLICY hostels_select_own ON public.hostels
  FOR SELECT USING (
    owner_id IN (SELECT id FROM public.owners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS hostels_insert_own ON public.hostels;
CREATE POLICY hostels_insert_own ON public.hostels
  FOR INSERT WITH CHECK (
    owner_id IN (SELECT id FROM public.owners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS hostels_update_own ON public.hostels;
CREATE POLICY hostels_update_own ON public.hostels
  FOR UPDATE USING (
    owner_id IN (SELECT id FROM public.owners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS hostels_delete_own ON public.hostels;
CREATE POLICY hostels_delete_own ON public.hostels
  FOR DELETE USING (
    owner_id IN (SELECT id FROM public.owners WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS login_activity_select_own ON public.login_activity;
CREATE POLICY login_activity_select_own ON public.login_activity
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS audit_logs_select_own ON public.audit_logs;
CREATE POLICY audit_logs_select_own ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid());

COMMIT;
