BEGIN;

-- Add owner comments table for maintenance request collaboration.
CREATE TABLE IF NOT EXISTS public.maintenance_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  comment TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_request_comments_request_id
  ON public.maintenance_request_comments(maintenance_request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_maintenance_request_comments_owner_id
  ON public.maintenance_request_comments(owner_id, created_at DESC);

-- Expand status options to support owner workflow labels used in UI.
ALTER TABLE public.maintenance_requests
  DROP CONSTRAINT IF EXISTS maintenance_requests_status_check;

ALTER TABLE public.maintenance_requests
  ADD CONSTRAINT maintenance_requests_status_check
  CHECK (status IN (
    'open',
    'in_progress',
    'rejected',
    'completed',
    'resolved',
    'closed'
  ));

COMMIT;
