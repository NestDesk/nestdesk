-- ============================================================
-- NestDesk - Repair tenant profile schema and cache
-- Purpose:
-- 1. Ensure tenant profile columns exist even if previous migration failed
-- 2. Ensure storage bucket and policies exist
-- 3. Reload PostgREST schema cache
-- ============================================================

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS occupation_type TEXT,
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_number TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_front_path TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_back_path TEXT,
  ADD COLUMN IF NOT EXISTS alternate_id_path TEXT,
  ADD COLUMN IF NOT EXISTS first_activated_at TIMESTAMPTZ;

ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_gender_check;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_gender_check
  CHECK (gender IN ('male', 'female', 'rather_not_say') OR gender IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'idx_tenants_aadhar_number_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_tenants_aadhar_number_unique
      ON public.tenants(aadhar_number)
      WHERE aadhar_number IS NOT NULL
        AND deleted_at IS NULL;
  END IF;
END
$$;

UPDATE public.tenants
SET first_activated_at = COALESCE(first_activated_at, created_at)
WHERE status = 'active'
  AND first_activated_at IS NULL;

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

-- Force PostgREST to refresh schema cache immediately.
NOTIFY pgrst, 'reload schema';

COMMIT;
