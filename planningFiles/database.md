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

5. login_activity
   - Stores login attempts with email, IP, user agent, and success/failure.
   - Used by the login rate limiter and login audit flow.

6. audit_logs
   - Stores app audit events.
   - Currently written for onboarding create/update, property creation, and property activation.

7. phone_otp_challenges
8. maintenance_request_comments
   - Stores hashed OTP challenges.
   - Used by phone OTP request/verify endpoints and OTP service helpers.
   - Present even though OTP is not required in the active owner flow.

### Present in Schema but Not Yet Wired into Active UI Flows

1. tenants
2. payments
3. notices
4. maintenance_requests
5. subscriptions
6. invite_codes
7. consent_records
8. data_deletion_requests

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

## Known Schema / Code Mismatches

1. The hostels table currently does not define deleted_at.
2. The TypeScript Hostel interface includes deleted_at.
3. The dashboard page already filters hostels with is("deleted_at", null).

This should be treated as a follow-up item. Either add deleted_at to hostels and implement soft delete consistently, or remove the deleted_at assumptions from the app layer until that feature is added.

## Notes for Future Work

1. Tenant, payment, notices, maintenance, subscription, consent, and deletion-request modules can build directly on the existing schema.
2. If phone verification is re-enabled, the existing phone_otp_challenges table and OTP service can be reused.
3. Storage bucket policies and document storage flows are not yet defined in migrations and should be added separately when document upload work starts.
