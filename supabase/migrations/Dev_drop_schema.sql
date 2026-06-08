-- ============================================================
-- Dev_drop_schema
-- Purpose: drop all existing app tables and related objects
-- WARNING: destructive. Only use in development.
-- ============================================================

BEGIN;

SET TIME ZONE 'Asia/Kolkata';

DROP TABLE IF EXISTS public.institution_sales_leads CASCADE;
DROP TABLE IF EXISTS public.sales_leads CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.property_billing CASCADE;
DROP TABLE IF EXISTS public.support_staff CASCADE;
DROP TABLE IF EXISTS public.property_terms CASCADE;
DROP TABLE IF EXISTS public.owner_billing CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.phone_otp_challenges CASCADE;
DROP TABLE IF EXISTS public.data_deletion_requests CASCADE;
DROP TABLE IF EXISTS public.consent_records CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.login_activity CASCADE;
DROP TABLE IF EXISTS public.invite_codes CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.maintenance_request_comments CASCADE;
DROP TABLE IF EXISTS public.maintenance_requests CASCADE;
DROP TABLE IF EXISTS public.notices CASCADE;
DROP TABLE IF EXISTS public.payments CASCADE;
DROP TABLE IF EXISTS public.tenants CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.floors CASCADE;
DROP TABLE IF EXISTS public.hostels CASCADE;
DROP TABLE IF EXISTS public.owners CASCADE;

DROP EVENT TRIGGER IF EXISTS trg_auto_enable_rls_new_tables;
DROP TRIGGER IF EXISTS trg_owners_updated_at ON public.owners;
DROP TRIGGER IF EXISTS trg_hostels_updated_at ON public.hostels;
DROP TRIGGER IF EXISTS trg_floors_updated_at ON public.floors;
DROP TRIGGER IF EXISTS trg_rooms_updated_at ON public.rooms;
DROP TRIGGER IF EXISTS trg_tenants_updated_at ON public.tenants;
DROP TRIGGER IF EXISTS trg_payments_updated_at ON public.payments;
DROP TRIGGER IF EXISTS trg_notices_updated_at ON public.notices;
DROP TRIGGER IF EXISTS trg_maintenance_requests_updated_at ON public.maintenance_requests;
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON public.subscriptions;
DROP TRIGGER IF EXISTS trg_data_deletion_requests_updated_at ON public.data_deletion_requests;
DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
DROP TRIGGER IF EXISTS trg_owner_billing_updated_at ON public.owner_billing;
DROP TRIGGER IF EXISTS trg_property_terms_updated_at ON public.property_terms;
DROP TRIGGER IF EXISTS trg_support_staff_updated_at ON public.support_staff;
DROP TRIGGER IF EXISTS trg_property_billing_updated_at ON public.property_billing;
DROP TRIGGER IF EXISTS trg_invoices_updated_at ON public.invoices;

DROP FUNCTION IF EXISTS public.current_owner_id;
DROP FUNCTION IF EXISTS public.set_updated_at;


COMMIT;
