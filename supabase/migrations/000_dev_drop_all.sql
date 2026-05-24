-- ============================================================
-- DEV ONLY: FULL RESET / DROP ALL APP OBJECTS
-- Purpose: wipe app data and drop app-owned objects so you can start fresh.
-- WARNING: Destructive. Do NOT run in production.
-- ============================================================

BEGIN;

-- 1) Drop all tables in public schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE;', r.tablename);
  END LOOP;
END
$$;

-- 2) Drop views in public schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  LOOP
    EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE;', r.table_name);
  END LOOP;
END
$$;

-- 3) Drop materialized views in public schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT matviewname
    FROM pg_matviews
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP MATERIALIZED VIEW IF EXISTS public.%I CASCADE;', r.matviewname);
  END LOOP;
END
$$;

-- 4) Drop custom functions in public schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE;', r.fn);
  END LOOP;
END
$$;

-- 5) Drop custom types in public schema
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typtype IN ('e', 'c')
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE;', r.typname);
  END LOOP;
END
$$;

-- 6) Optional: clear all auth users (managed auth table, not dropped)
DELETE FROM auth.users;

COMMIT;
