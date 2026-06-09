-- INSERT 49 DUMMY ACTIVE TENANTS
-- Replace OWNER_UUID and HOSTEL_UUID with your actual owner and hostel IDs.
-- Run this in your Postgres database (psql, Supabase SQL editor, etc.).

INSERT INTO public.tenants (
  owner_id,
  hostel_id,
  full_name,
  email,
  phone,
  status,
  join_date,
  rent_start_date,
  first_activated_at,
  agreed_rent_amount,
  created_at,
  updated_at
)
SELECT
  'f5d188ed-3f69-4b62-b9c1-24b22a7e2af3'::uuid AS owner_id,
  '741efbbc-a2bf-4907-a63f-9a9f8954e522'::uuid AS hostel_id,
  format('Dummy Tenant %s', i) AS full_name,
  format('dummy+%s@example.com', i) AS email,
  format('9000000%04s', i) AS phone,
  'active' AS status,
  CURRENT_DATE - (49 - i) AS join_date,
  CURRENT_DATE - (49 - i) AS rent_start_date,
  NOW() - ((49 - i) * interval '1 day') AS first_activated_at,
  1000.00 AS agreed_rent_amount,
  NOW() AS created_at,
  NOW() AS updated_at
FROM generate_series(1, 49) AS s(i);
