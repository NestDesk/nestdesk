-- ============================================================
-- NestDesk Migration 006 — Add published state to notices
-- ============================================================

BEGIN;

ALTER TABLE public.notices
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notices_hostel_published
  ON public.notices(hostel_id, is_published)
  WHERE deleted_at IS NULL;

COMMIT;
