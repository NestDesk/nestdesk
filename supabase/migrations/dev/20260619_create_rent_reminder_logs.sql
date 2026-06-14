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
