CREATE OR REPLACE FUNCTION public.get_latest_paid_billing_end(p_tenant_ids UUID[])
RETURNS TABLE (tenant_id UUID, billing_end DATE)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    payments.tenant_id,
    MAX(payments.billing_end)::DATE AS billing_end
  FROM public.payments AS payments
  WHERE payments.tenant_id = ANY(p_tenant_ids)
    AND payments.status = 'paid'
    AND payments.billing_end IS NOT NULL
  GROUP BY payments.tenant_id;
$$;

REVOKE ALL ON FUNCTION public.get_latest_paid_billing_end(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_latest_paid_billing_end(UUID[]) TO service_role;