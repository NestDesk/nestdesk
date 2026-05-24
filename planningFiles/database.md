# Database Setup

NestDesk currently uses a simple two-file development database workflow:

1. Optional destructive reset for a clean start.
2. Full schema bootstrap for the current app and planned modules.
3. Incremental feature migrations for post-bootstrap enhancements.

## Migration Files

1. Reset script: supabase/migrations/000_dev_drop_all.sql
2. Full schema bootstrap: supabase/migrations/001_init_simple.sql
3. Tenant join token enhancement: supabase/migrations/002_tenant_join_token.sql
4. Property code enhancement: supabase/migrations/003_property_code.sql
5. Maintenance owner workflow: supabase/migrations/004_maintenance_owner_workflow.sql
6. Tenant agreed rent amount: supabase/migrations/005_tenants_agreed_rent.sql
7. Notices published state: supabase/migrations/006_notices_published.sql
8. Tenant profile document support: supabase/migrations/007_tenant_profile_docs.sql
9. Tenant gender support: supabase/migrations/008_tenant_gender.sql
10. Tenant profile schema repair: supabase/migrations/009_repair_tenant_profile_schema.sql
11. Owner expense management: supabase/migrations/010_expenses_management.sql

Run order in Supabase SQL Editor:

1. Run 000_dev_drop_all.sql only when a clean reset is needed.
2. Run 001_init_simple.sql to recreate the current schema, indexes, RLS policies, and triggers.

## Auth Model and Ownership Model

The application is owner-centric.

1. Supabase Auth stores the primary auth identity in auth.users.
2. public.owners.user_id references auth.users.id and is the app's bridge from auth identity to business data.
3. The SQL helper public.current_owner_id() resolves the current authenticated owner row for RLS checks.
4. Most app-level mutations use the Supabase service-role admin client and still enforce ownership manually in API routes.

This is important because the application code depends on owners.user_id in:

1. Dashboard onboarding gate
2. Onboarding upsert flow
3. Login redirect routing
4. Auth callback redirect routing
5. Property, floor, and room ownership checks

## Tables in the Current Bootstrap

### Actively Used by Application Code

1. owners
   - Stores owner profile, plan, phone verification flags, address, and onboarding_completed.
   - Written by onboarding POST.
   - Read by dashboard layout, onboarding prefill, login redirect logic, and auth callback logic.

2. hostels
   - Stores owner-scoped properties.
   - Written by POST /api/hostels and activation endpoint.
   - Read by dashboard, properties list, and setup page.

3. floors
   - Stores property floors.
   - Supports soft delete via deleted_at.
   - Used by floor CRUD APIs and setup UI.

4. rooms
   - Stores rooms per floor and property.
   - Supports capacity, status, and soft delete via deleted_at.
   - Used by room CRUD APIs, bulk generator, activation checks, and setup UI.

5. tenants
   - Stores tenant profile, status, and property/room linkage.
   - Stores agreed_rent_amount for finalized owner-tenant commercial terms.
   - Stores occupation_type, institution_name, gender, aadhar_number, profile_photo_path, aadhar_front_path, aadhar_back_path, alternate_id_path, and first_activated_at for richer KYC/profile lifecycle checks.
   - Written by tenant registration and owner tenant management APIs.
   - Read by tenant dashboard/profile flows and owner tenant management screen.
   - Owner tenant management now also reads profile_photo_path / document paths to generate short-lived signed URLs for owner review.

6. login_activity
   - Stores login attempts with email, IP, user agent, and success/failure.
   - Used by the login rate limiter and login audit flow.

7. audit_logs
   - Stores app audit events.
   - Currently written for onboarding create/update, property creation, and property activation.

8. phone_otp_challenges
9. maintenance_request_comments
   - Stores hashed OTP challenges.
   - Used by phone OTP request/verify endpoints and OTP service helpers.
   - Present even though OTP is not required in the active owner flow.
10. expenses

- Stores owner-scoped property running expenses across utility, staffing, maintenance, compliance, and operational categories.
- Supports paid/pending/disputed states, recurring expense schedules, payment mode capture, and soft delete.
- Used by owner expense APIs and the owner expenses dashboard for property-wise and total analytics.

11. storage.buckets + storage.objects (Supabase managed)

- Bucket tenant-documents is used for tenant profile and ID image storage.
- Object naming convention is user-scoped: {auth_user_id}/{doc_type}/{file_name}.
- Private bucket with RLS policies scoped to authenticated user folder ownership.
- Owner review APIs use service-role storage access to issue signed URLs for tenant document review in owner portal.

### Present in Schema but Not Yet Wired into Active UI Flows

1. payments
2. notices
3. maintenance_requests
4. subscriptions
5. invite_codes
6. consent_records
7. data_deletion_requests

These tables are already part of the bootstrap, but the corresponding screens and route flows are still pending.

Maintenance is now partially wired:

1. Tenants can create and view maintenance requests.
2. Owners can view tenant-raised requests, update status, and add comments.
3. Tenant maintenance timelines now include owner comments.
4. Tenants can edit and soft-delete their own maintenance requests (deleted_at based).

## Important Constraints and Design Choices

1. All primary keys use UUID with gen_random_uuid().
2. owners.plan is constrained to free, starter, pro, business, enterprise.
3. hostels.property_type is constrained to pg, hostel, coliving, rental.
4. rooms.status is constrained to vacant, occupied, maintenance, inactive.
5. rooms enforce unique room_number per hostel where deleted_at is null.
6. floors and rooms use deleted_at soft deletes instead of hard deletes in the implemented flows.
7. updated_at triggers are installed for mutable entities.
8. maintenance_requests status constraint now supports owner workflow statuses including rejected and completed (plus legacy resolved/closed values).
9. tenants.first_activated_at tracks first time a tenant reaches active state to enforce move-out lifecycle rules.

## RLS Coverage

RLS is enabled for all main tables created by the bootstrap.

High-level policy model:

1. owners rows are scoped to the authenticated auth.uid().
2. hostels, floors, rooms, subscriptions, and invite_codes are scoped through current_owner_id().
3. tenants, payments, notices, and maintenance_requests allow owner-scoped access and limited tenant-scoped access where relevant.
4. login_activity is readable only by the matching user_id.
5. audit_logs are readable by the owner who owns the event context.
6. consent_records and data_deletion_requests are scoped to the requesting auth user.
7. phone_otp_challenges are blocked from direct client access through a deny-all policy.
8. expenses rows are scoped to current_owner_id() through owner_id-based policies.

## Current App-to-Table Mapping

### Auth and Session

1. Login API reads and writes login_activity.
2. Auth callback reads owners to decide whether to redirect to onboarding or dashboard.
3. Middleware relies on Supabase Auth session state, not direct table reads.

### Onboarding

1. GET /api/onboarding reads owners and may inspect the first hostel.
2. POST /api/onboarding upserts owners and writes audit_logs.

### Properties and Setup

1. POST /api/hostels inserts hostels and writes audit_logs.
2. POST /api/hostels/[id]/activate updates hostels and writes audit_logs.
3. Floor APIs read and mutate floors.
4. Room APIs read and mutate rooms.
5. Bulk room API inserts rooms in batches and skips duplicates.

### Expenses

1. GET /api/expenses lists owner-scoped expenses with property/month/category/status/search filters.
2. POST /api/expenses creates owner expense rows with full validation and recurring support.
3. PATCH /api/expenses/[id] updates owner expense rows.
4. DELETE /api/expenses/[id] soft-deletes owner expense rows.

## Known Schema / Code Mismatches

1. The hostels table currently does not define deleted_at.
2. The TypeScript Hostel interface includes deleted_at.
3. The dashboard page already filters hostels with is("deleted_at", null).

This should be treated as a follow-up item. Either add deleted_at to hostels and implement soft delete consistently, or remove the deleted_at assumptions from the app layer until that feature is added.

## Notes for Future Work

1. Payment, notices, subscription, consent, and deletion-request modules can build directly on the existing schema.
2. If phone verification is re-enabled, the existing phone_otp_challenges table and OTP service can be reused.
3. Storage bucket policies and document storage flows are not yet defined in migrations and should be added separately when document upload work starts.
