-- Alter rent_reminder_logs to support multiple reminder attempts per tenant/month

ALTER TABLE public.rent_reminder_logs
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;

UPDATE public.rent_reminder_logs
SET attempt_count = 1
WHERE attempt_count IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'rent_reminder_logs_tenant_id_reminder_month_template_name_key'
  ) THEN
    ALTER TABLE public.rent_reminder_logs
      DROP CONSTRAINT rent_reminder_logs_tenant_id_reminder_month_template_name_key;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rent_reminder_logs_tenant_month_status
  ON public.rent_reminder_logs (tenant_id, reminder_month, status);
