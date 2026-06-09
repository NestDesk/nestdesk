-- DELETE 49 DUMMY ACTIVE TENANTS
-- This removes only the dummy tenants created with the dummy+<number>@example.com pattern.
-- Run this in your Postgres database (psql, Supabase SQL editor, etc.).

DELETE FROM public.tenants
WHERE owner_id = 'f5d188ed-3f69-4b62-b9c1-24b22a7e2af3'::uuid
  AND hostel_id = '741efbbc-a2bf-4907-a63f-9a9f8954e522'::uuid
  AND email LIKE 'dummy+%@example.com'
  AND status = 'active';
