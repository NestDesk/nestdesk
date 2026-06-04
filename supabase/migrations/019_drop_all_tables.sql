-- ============================================================
-- NestDesk - Drop all NestDesk public tables
-- Purpose: remove all application tables in one pass for development reset.
-- WARNING: destructive. Run only in dev or test environments.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.payment_orders CASCADE;
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

COMMIT;
