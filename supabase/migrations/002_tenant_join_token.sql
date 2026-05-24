-- ============================================================
-- NestDesk - Add tenant join token to hostels
-- Purpose: Each property gets a unique shareable link token
--          that tenants scan/visit to self-register.
-- ============================================================

BEGIN;

ALTER TABLE public.hostels
  ADD COLUMN IF NOT EXISTS tenant_join_token TEXT;

-- Ensures no two active properties share the same token
CREATE UNIQUE INDEX IF NOT EXISTS idx_hostels_tenant_join_token
  ON public.hostels(tenant_join_token)
  WHERE tenant_join_token IS NOT NULL;

COMMIT;
