-- ============================================================
-- NestDesk - Tenant profile enrichment and document storage
-- Purpose:
-- 1. Add richer tenant registration/profile fields
-- 2. Track first activation timestamp for move-out guard
-- 3. Configure private storage bucket for tenant documents
-- ============================================================

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS occupation_type TEXT,
  ADD COLUMN IF NOT EXISTS institution_name TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_number TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_path TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_front_path TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_back_path TEXT,
  ADD COLUMN IF NOT EXISTS alternate_id_path TEXT,
  ADD COLUMN IF NOT EXISTS first_activated_at TIMESTAMPTZ;

-- Avoid duplicate Aadhaar assignment among non-deleted tenant records.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_aadhar_number_unique
  ON public.tenants(aadhar_number)
  WHERE aadhar_number IS NOT NULL
    AND deleted_at IS NULL;

-- Backfill first activation timestamp for already-active historical rows.
UPDATE public.tenants
SET first_activated_at = COALESCE(first_activated_at, created_at)
WHERE status = 'active'
  AND first_activated_at IS NULL;

-- Private bucket for tenant profile and ID documents.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-documents', 'tenant-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for direct authenticated access, scoped to own folder only.
-- Folder convention used by app: {auth_user_id}/{doc_type}/{file_name}
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

COMMIT;