# NestDesk - Implementation Plan

## Current Focus

1. Keep owner onboarding simple for rapid development.
2. Keep OTP libraries in the codebase but disable OTP dependency in active flows.
3. Stabilize auth to onboarding to dashboard navigation.

## Latest Implementations

### Owner-Only Onboarding

1. Simplified onboarding to collect only owner profile details.
2. Removed first-property fields and second step from onboarding UI.
3. Updated onboarding API to stop creating/updating hostels during onboarding.
4. Owners now reach dashboard after onboarding and add properties later from /hostels/new.

### Migration Reset Simplification

1. Standardized to exactly two SQL migration files for fresh-start workflow.
2. Kept one destructive reset script: supabase/migrations/000_dev_drop_all.sql.
3. Kept one full schema creation script: supabase/migrations/001_init_simple.sql.
4. Removed extra SQL scripts: 000_dev_truncate_all.sql and 003_rooms_status_inactive.sql.
5. Merged the room status 'inactive' support into 001_init_simple.sql.

### Simple DB Bootstrap Script

1. Upgraded to a full SQL bootstrap script based on plan.txt core schema.
2. Includes all currently planned core tables and supporting indexes.
3. Keeps owners.user_id so it remains compatible with current app code.

File:

1. supabase/migrations/001_init_simple.sql

### Dev Speedup - Owner Mobile OTP Bypassed

1. Registration flow works without OTP requirement.
2. Onboarding flow does not enforce mobile verification.
3. Owner phone is still captured and saved.
4. OTP files remain available for future re-enable.

### Onboarding Flow Cleanup

1. Added onboarding prefill API for smoother resume behavior.
2. Added completed-onboarding redirect to dashboard.
3. Made onboarding submission idempotent.
4. Prevented duplicate first-property creation by updating existing first property.
5. Added input normalization and pincode sanitization.
6. Synced owner persistence with full schema by storing owner email during onboarding.
7. Added owner-linked audit logs for both owner and hostel writes.
8. Hardened login/callback/dashboard onboarding checks using maybeSingle for fresh accounts.

### Dev Request Noise Reduction

1. Optimized middleware to bypass auth checks for \_next, favicon, and /api/auth requests.
2. Removed redundant router.refresh calls after push redirects.
3. Added one-time effect guards on onboarding/bootstrap and topbar auth fetch in dev.
4. Disabled sidebar link prefetch to reduce background RSC traffic while developing.

### Landing Auth-Aware Header

1. Landing page now detects signed-in user server-side.
2. Replaced desktop Sign in button with avatar account menu for authenticated users.
3. Added account actions: Dashboard, Onboarding, Logout.
4. Updated mobile landing nav to show My Account/Onboarding/Logout when logged in.

### Properties Page (Dashboard)

1. Added dashboard route page at /hostels.
2. Integrated real data fetch from hostels table using authenticated server client.
3. Added empty state when owner has no properties yet.
4. Added property cards with name, type, status, rooms, and address.

### Add Property Flow

1. Enabled Add Property CTA on /hostels.
2. Added /hostels/new page with validated property form.
3. Added POST /api/hostels route with owner-auth checks and validation.
4. Added audit log entry for hostel creation.

### Property Activation Gating

1. New properties now always start as inactive.
2. Added floor-plan completeness check (at least one floor and one room).
3. Added secure POST /api/hostels/[id]/activate endpoint with owner checks.
4. Activation button appears only for inactive properties with complete floor plan.

### Properties UI Refresh + Setup Hub

1. Redesigned /hostels with improved visual header and quick stats.
2. Enhanced property cards with clearer setup progress indicators.
3. Added per-property "Setup Floor Plan & Rooms" action button.
4. Added dedicated setup hub route at /hostels/[id]/setup for floor, room, and other setup sections.

### Floor and Room CRUD (Implemented)

1. Added full floor CRUD APIs under /api/hostels/[id]/floors.
2. Added full room CRUD APIs under /api/hostels/[id]/rooms.
3. Added owner/property authorization checks on all setup APIs.
4. Wired setup page with live floor/room manager for create, edit, delete, and list operations.

### Setup Flow End-to-End Fix

1. Setup manager now syncs floors and rooms directly from DB-backed APIs.
2. Floor and room lists refresh after each create/edit/delete to stay source-of-truth with tables.
3. Replaced disabled setup card buttons with active actions that jump to Floors/Rooms sections.
4. Updated setup hub copy to clearly reflect live DB-backed behavior.

## Files Updated Recently

1. src/app/api/onboarding/route.ts
2. src/app/onboarding/page.tsx
3. src/app/api/auth/register/route.ts
4. src/app/(auth)/register/page.tsx

## Next Development Tasks

1. Improve onboarding validation and error UX.
2. Add dashboard starter widgets with real API-backed values.
3. Add onboarding success analytics/event hook.
4. Add regression tests for auth and onboarding routes.
5. Prepare a feature flag to re-enable OTP quickly when needed.

## Notes

1. Keep this file focused on implementation status and upcoming tasks.
2. Track flow decisions here whenever auth or onboarding behavior changes.
