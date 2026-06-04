# NestDesk Architecture Reference

This file is a quick navigation guide to the current code structure, implemented functionality, and the main code entry points.

## Stack

1. Next.js 14 App Router
2. React 18
3. TypeScript
4. Supabase Auth + Postgres
5. Tailwind CSS
6. Radix UI primitives with local UI wrappers
7. next-themes for theme switching
8. sonner for toasts

## High-level Architecture

The app is split into five main layers:

1. App Router pages and layouts under src/app
2. Interactive client components under src/components
3. Shared utilities and service helpers under src/lib
4. Global providers and hooks under src/providers and src/hooks
5. Supabase schema and RLS setup under supabase/migrations

## Route Groups and Main Screens

### Public and Auth-facing Screens

1. src/app/page.tsx
   - Marketing landing page
   - Detects logged-in user server-side and adjusts account actions
   - Highlights only currently implemented modules and workflows in the features section
   - Pricing section is structured by operational scale with clearer paid plan limits
   - Footer legal links open a detailed policy modal for Privacy, Terms, Cookie, and Refund policies

2. src/app/(auth)/layout.tsx
   - Shared auth visual shell
   - Includes top navbar theme selector for light/dark/system switching

3. src/app/(auth)/login/page.tsx
   - Login form
   - Handles idle timeout message and rate-limit feedback

4. src/app/(auth)/register/page.tsx
   - Registration form
   - Strong password validation and strength meter

5. src/app/(auth)/verify-email/page.tsx
   - Post-registration verification instruction screen

6. src/app/(auth)/forgot-password/page.tsx
   - Public password recovery request screen
   - Uses the auth API to send reset links without exposing account existence

7. src/app/(auth)/reset-password/page.tsx
   - Secure password reset screen reached from email recovery links
   - Requires a recovery session established by the auth callback

8. src/app/auth/callback/route.ts
   - Exchanges Supabase email verification code for a session
   - Also verifies recovery tokens and redirects to the reset-password screen

9. src/app/privacy/page.tsx
   - Public Privacy Policy page

10. src/app/terms/page.tsx

- Public Terms of Service page

11. src/app/cookies/page.tsx

- Public Cookie Policy page

12. src/app/refund/page.tsx

- Public Refund Policy page

### Onboarding and Protected Screens

1. src/app/onboarding/page.tsx
   - Owner onboarding UI
   - Draft persistence and prefill logic

2. src/app/(dashboard)/layout.tsx
   - Protected dashboard layout
   - Enforces auth and onboarding completion before rendering dashboard pages

3. src/app/(dashboard)/dashboard/page.tsx
   - Dashboard overview
   - Currently uses guidance banners and placeholder summary cards

4. src/app/(dashboard)/hostels/page.tsx
   - Property list and activation readiness view

5. src/app/(dashboard)/hostels/new/page.tsx
   - Add property form

6. src/app/(dashboard)/hostels/[id]/setup/page.tsx
   - Floor/room setup hub for a single property

7. src/app/(tenant)/layout.tsx
   - Protected tenant portal layout
   - Enforces tenant role and renders branded tenant shell

8. src/app/(tenant)/tenant/dashboard/page.tsx
   - Tenant summary dashboard
   - Shows account status, property details, room details, and quick actions

9. src/app/(dashboard)/maintenance/page.tsx
   - Owner maintenance operations workspace
   - Lets owners review tenant issues, change status, and add comments

10. src/app/(dashboard)/tenants/page.tsx

- Owner tenant management workspace
- Supports tenant listing, filtering, and lifecycle operations (approve, activate, move out, reject)

11. src/app/(dashboard)/expenses/page.tsx

- Owner expense management workspace
- Supports expense creation, editing, soft delete confirmation, and recurring schedule setup
- Uses TanStack table with sortable columns and row-level action menu
- Includes onboarding-aware lifetime totals, current-month range totals, recurring overview, and ApexCharts daily trend for current month

12. src/app/api/expenses/route.ts

- Owner expense list/create API
- Returns hostels, onboarding-aware month options, summary analytics, recurring templates, property totals, and current-month daily trend data
- Auto-materializes due recurring expenses and advances template next due dates on list fetch

12. src/app/(dashboard)/occupancy/page.tsx

- Owner occupancy visualization workspace
- Renders property -> floor -> room hierarchy with live tenant allocation details
- Shows room type, capacity, room status, bed occupancy, rent, and unassigned tenants

13. src/app/(dashboard)/profile/page.tsx

- Owner account profile workspace
- Displays owner details, contact information, onboarding status, and property snapshot counts
- Includes inline edit action for owner full name, phone, and address details
- Includes WhatsApp OTP phone verification controls and verification status

14. src/app/(dashboard)/subscriptions/page.tsx

- Owner subscriptions and usage workspace
- Renders plan catalog and current plan summary
- Initiates Razorpay Standard Checkout for paid plans

15. src/app/api/create-order/route.ts

- Owner-authenticated API to create Razorpay orders
- Validates minimum amount and handles provider auth/provider failures

16. src/app/api/verify-payment/route.ts

- Owner-authenticated API to verify Razorpay payment signature
- Activates subscription only on valid HMAC signature match
- Updates owners.plan and writes subscription audit trail

17. src/app/api/owner/subscription/current/route.ts

- Owner-authenticated API to fetch current plan and latest subscription snapshot
- Used by topbar avatar menu and subscriptions/dashboard surfaces

14. src/app/api/owner/phone-otp/request/route.ts

- Owner-authenticated API to request WhatsApp OTP for phone verification
- Uses OTP service and MSG91 provider integration

15. src/app/api/owner/phone-otp/verify/route.ts

- Owner-authenticated API to verify OTP challenge
- Marks owners.phone_verified true and records phone_verified_at timestamp

## Layout and UI Shell Components

### Global Shell

1. src/app/layout.tsx
   - Root layout
   - Adds ThemeProvider and Toaster

2. src/providers/ThemeProvider.tsx
   - Wraps next-themes provider

### Dashboard Shell

1. src/components/layout/DashboardShell.tsx
   - Main authenticated shell
   - Includes sidebar, top bar, and idle timeout enforcement

2. src/components/layout/Sidebar.tsx
   - Desktop and mobile navigation source for dashboard areas
   - Includes owner modules for properties, tenants, occupancy, maintenance, payments, expenses, notices, profile, and settings
   - Shows profile warning indicator when owner phone is not verified

3. src/components/profile/OwnerProfileEditor.tsx
   - Client-side owner profile edit form with validation and save/cancel actions
   - Calls owner profile API and refreshes server-rendered profile data after successful save
   - Sends and verifies WhatsApp OTP from profile context for phone verification

4. src/components/layout/TopBar.tsx
   - Theme toggle, profile menu, logout action, and mobile nav trigger

5. src/components/auth/IdleTimeoutEnforcer.tsx
   - Invisible component that activates logout-on-idle

6. src/hooks/use-idle-timeout.ts
   - Watches browser events and triggers logout after 30 minutes

### Tenant Shell

1. src/components/layout/TenantNav.tsx
   - Tenant-specific navigation with active-route highlighting and hints

2. src/app/(tenant)/layout.tsx
   - Branded tenant portal frame with top header, status chip, and responsive nav rail

### Maintenance Workflow

1. src/app/api/tenant/maintenance/route.ts
   - Tenant creates requests and reads their own request timeline
   - Includes owner comments in tenant response payload

1. src/app/api/tenant/maintenance/[id]/route.ts
   - Tenant edits and soft-deletes own maintenance requests
   - Enforces tenant ownership before mutation
   - Allows edit/delete only when request status is open

1. src/app/api/maintenance/route.ts
   - Owner reads maintenance requests across owned properties
   - Returns tenant/property context and owner comment timeline

1. src/app/api/maintenance/[id]/route.ts
   - Owner updates request status (open, in_progress, rejected, completed)

1. src/app/api/maintenance/[id]/comments/route.ts
   - Owner adds comments to maintenance requests for tenant visibility

### Owner Tenant Management Workflow

1. src/app/api/tenants/route.ts
   - Owner reads tenant roster across owned properties
   - Returns list data, summary counts, property filters, and assignable room options

2. src/app/api/tenants/[id]/route.ts
   - GET returns owner-scoped full tenant profile + signed document URLs for review
   - Owner updates tenant profile fields, status, room assignment, agreed rent, and key dates
   - Enforces owner scope and room occupancy validation
   - Enforces profile-completion gate for active status transitions
   - Enforces first-activation prerequisite before moved_out transition
   - Synchronizes room status transitions when assignments change

3. src/app/(dashboard)/tenants/page.tsx
   - Owner list shows tenant profile pictures from signed URLs
   - Clicking avatar/review opens a full tenant profile review dialog
   - Review dialog renders tenant KYC documents and supports approve-as-active action
   - Property selection is rendered as tabs (no property dropdown), with tenant list scoped by selected property tab
   - Top-level total summary also shows per-property tenant counts for quick property-wise visibility

### Tenant Profile and KYC Workflow

1. src/app/tenant/register/page.tsx
   - Public tenant account creation form from invite link
   - Captures occupation type, institution name, and Aadhaar number with checksum validation

2. src/app/api/tenant/register/route.ts
   - Creates tenant auth account and tenant row with enriched profile fields
   - Validates Aadhaar checksum and stores normalized Aadhaar + last4

3. src/app/(tenant)/tenant/profile/page.tsx
   - Tenant self-service profile screen with personal info + KYC upload slots
   - Shows profile completion percentage and missing requirements
   - Applies client-side image crop/compression before upload

4. src/app/api/tenant/profile/route.ts
   - GET returns tenant profile, completion percentage, and signed URLs for private docs
   - PATCH updates editable fields including Aadhaar with checksum validation

5. src/app/api/tenant/profile/upload/route.ts
   - Receives processed image uploads and stores them in tenant-documents bucket
   - Maintains per-doc path pointers on tenant record and rotates old files on replace

### Notices Workflow

1. src/app/(dashboard)/notices/page.tsx
   - Owner notices management workspace
   - Create, edit, publish/unpublish, and soft-delete notices per property
   - Filters by property, status (published/draft), and search query

2. src/app/api/notices/route.ts
   - GET: Owner lists all notices across owned properties (draft + published)
   - POST: Owner creates a new notice, optionally publishing immediately

3. src/app/api/notices/[id]/route.ts
   - PATCH: Owner edits title, body, or publish state; sets published_at on first publish
   - DELETE: Owner soft-deletes a notice

4. src/app/api/tenant/notices/route.ts
   - GET: Active tenant reads published notices for their hostel only
   - Returns empty with inactive flag if tenant status is not active

5. src/app/(tenant)/tenant/notices/page.tsx
   - Tenant notices view (client component, uses /api/tenant/notices)
   - Shows inactive prompt when tenancy is not yet approved

### Payments Workflow

1. src/app/(dashboard)/payments/page.tsx
   - Owner payments management workspace
   - Record new payments, edit status/method/amount, delete payments
   - Filters by property, month, status, and search by tenant name or receipt number
   - Summary cards for collected, pending, overdue, and disputed totals

2. src/app/api/payments/route.ts
   - GET: Owner lists all payments across owned properties with hostel/tenant context; supports hostel_id, month, status query params
   - POST: Owner records a new payment; receipt number auto-generated when status is paid

3. src/app/api/payments/[id]/route.ts
   - PATCH: Owner edits amount, status, method, notes; auto-stamps paid_at and receipt on first paid transition
   - DELETE: Owner hard-deletes a payment record

4. src/app/api/tenant/payments/route.ts
   - GET: Tenant reads own payment history with summary totals (totalPaid, pendingAmount)

5. src/app/(tenant)/tenant/payments/page.tsx
   - Tenant payment history view (client component, uses /api/tenant/payments)
   - Shows summary totals and itemized receipt list

### Expenses Workflow

1. src/app/(dashboard)/expenses/page.tsx
   - Owner expense operations workspace
   - Supports fast add/edit/delete, filters, and operational analytics

2. src/app/api/expenses/route.ts
   - GET: Owner lists expenses across owned properties with property/month/category/status/search filters
   - POST: Owner records property running expenses with recurring schedule support

3. src/app/api/expenses/[id]/route.ts
   - PATCH: Owner updates existing expense details
   - DELETE: Owner soft-deletes expense rows

4. src/lib/expenses.ts
   - Shared expense categories, statuses, payment mode constants, and labels

## Feature Modules

### Auth

Main files:

1. src/app/api/auth/register/route.ts
2. src/app/api/auth/login/route.ts
3. src/app/api/auth/logout/route.ts
4. src/app/auth/callback/route.ts
5. src/lib/auth.ts
6. src/lib/rate-limiter.ts

Behavior:

1. Registration validates inputs with Zod.
2. Owner and tenant registration both create confirmed accounts immediately with email/password.
3. Shared auth helpers centralize sign-up, sign-in, sign-out, callback exchange, cookie propagation, and role-based redirect resolution.
4. Login writes login_activity rows and enforces a 5-failures-in-15-minutes rule.
5. Successful login redirects based on owner onboarding state or tenant role.
6. Duplicate email registration attempts return clear conflict responses for owner and tenant signup APIs.

### Owner Onboarding

Main files:

1. src/app/onboarding/page.tsx
2. src/app/api/onboarding/route.ts

Behavior:

1. Only owner profile details are collected in the active flow.
2. GET returns existing owner data for prefill.
3. POST upserts the owner row and marks onboarding_completed true.
4. Audit log is written after onboarding save.

### Properties

Main files:

1. src/app/(dashboard)/hostels/page.tsx
2. src/app/(dashboard)/hostels/new/page.tsx
3. src/app/api/hostels/route.ts
4. src/components/hostels/ActivatePropertyButton.tsx
5. src/app/api/hostels/[id]/activate/route.ts

Behavior:

1. Properties are owner-scoped.
2. App flow creates new properties as inactive.
3. Activation is blocked until floors and rooms exist.
4. Activation is blocked until owner phone is verified.
5. Property creation and activation write audit log entries.

### Floor and Room Setup

Main files:

1. src/app/(dashboard)/hostels/[id]/setup/page.tsx
2. src/components/hostels/PropertySetupManager.tsx
3. src/components/hostels/setup/FloorRoomGenerator.tsx
4. src/components/hostels/setup/BuildingBlueprint.tsx
5. src/components/hostels/setup/helpers.ts
6. src/components/hostels/setup/types.ts
7. src/app/api/hostels/[id]/floors/route.ts
8. src/app/api/hostels/[id]/floors/[floorId]/route.ts
9. src/app/api/hostels/[id]/rooms/route.ts
10. src/app/api/hostels/[id]/rooms/[roomId]/route.ts
11. src/app/api/hostels/[id]/rooms/bulk/route.ts

Behavior:

1. Setup is a three-step flow: building shell, add rooms, blueprint.
2. The UI always re-syncs from the database after a mutation.
3. Floors and rooms use soft delete via deleted_at.
4. Bulk room generation skips duplicates instead of failing the entire request.
5. Add-rooms generator enforces bounded ranges, sanitized prefixes, and a lock-then-reset flow to prevent accidental re-edit after save.
6. Floor and room mutations include case-insensitive duplicate guards on both client and API layers.
7. Blueprint delete actions require explicit user confirmation before soft-delete operations.
8. The setup manager adds explicit step guidance, done criteria, and guarded step navigation to keep the wizard self-explanatory.
9. The add-rooms UI includes save-impact summaries and a next-pending-floor helper action to guide floor-by-floor completion.
10. Blueprint edit sessions propagate a dirty-state flag to the wizard, and step changes prompt before discarding unsaved edits.

### OTP Infrastructure

Main files:

1. src/app/api/auth/phone-otp/request/route.ts
2. src/app/api/auth/phone-otp/verify/route.ts
3. src/lib/otp/service.ts
4. src/lib/otp/token.ts
5. src/lib/otp/config.ts
6. src/lib/otp/providers/msg91.ts
7. src/lib/phone.ts

Behavior:

1. OTP challenge request and verification APIs are implemented.
2. OTPs are stored as hashed challenges in the database.
3. Owner profile now uses OTP completion to verify phone numbers.
4. MSG91 is used for WhatsApp OTP delivery when enabled.

## Supabase Integration Pattern

### Browser and Server Clients

1. src/lib/supabase/client.ts
   - Browser client for client components

2. src/lib/supabase/server.ts
   - Server client for server components and route handlers using request cookies

3. src/lib/supabase/admin.ts
   - Service-role client for privileged server-only operations

4. src/lib/supabase/env-check.ts
   - Early validation for required env vars
5. src/lib/auth.ts
   - Shared route-level auth helpers for registration, login, logout, callback exchange, and redirect decisions

### Common Access Pattern

1. Server components read with the standard Supabase server client.
2. Route handlers validate auth, then use the admin client for business operations that must bypass RLS safely.
3. Ownership is still enforced explicitly inside API routes before writes.

## Database Architecture Summary

Main schema file:

1. supabase/migrations/001_init_simple.sql

Important tables used today:

1. owners
2. hostels
3. floors
4. rooms
5. login_activity
6. audit_logs
7. phone_otp_challenges

Important schema behavior:

1. current_owner_id() enables owner-scoped RLS policies.
2. RLS is enabled on all core tables.
3. updated_at triggers are present for mutable entities.
4. Room numbers are unique per hostel for active rows.

## Conventions Used in the Codebase

1. Zod is the standard validation layer for route handlers and forms.
2. Server mutations return JSON objects with success or error messages.
3. Owner authorization is checked in each property/floor/room API.
4. Floors and rooms use deleted_at soft deletes.
5. Dashboard navigation includes future routes ahead of implementation.

## Known Architecture Gaps

1. Dashboard metrics are still placeholder values.
2. Payment, notices, settings, and subscription flows remain partially implemented.
3. Audit logging is incomplete for setup mutations.
4. The app already assumes a deleted_at field for hostels in some places, but the schema does not define it yet.
5. Owner maintenance counting previously under-reported requests due to hostels deleted_at filter assumptions; owner queries were updated to avoid this mismatch.

## Fast Lookup by Task

If you need to work on a specific area, start here:

1. Login issues: src/app/api/auth/login/route.ts and src/lib/rate-limiter.ts
2. Registration issues: src/app/api/auth/register/route.ts and src/app/auth/callback/route.ts
3. Onboarding issues: src/app/onboarding/page.tsx and src/app/api/onboarding/route.ts
4. Dashboard access issues: src/middleware.ts and src/app/(dashboard)/layout.tsx
5. Property creation issues: src/app/(dashboard)/hostels/new/page.tsx and src/app/api/hostels/route.ts
6. Activation issues: src/components/hostels/ActivatePropertyButton.tsx and src/app/api/hostels/[id]/activate/route.ts
7. Floor setup issues: src/app/api/hostels/[id]/floors/route.ts and src/app/api/hostels/[id]/floors/[floorId]/route.ts
8. Room setup issues: src/app/api/hostels/[id]/rooms/route.ts, src/app/api/hostels/[id]/rooms/[roomId]/route.ts, and src/app/api/hostels/[id]/rooms/bulk/route.ts
9. Theme/provider issues: src/app/layout.tsx and src/providers/ThemeProvider.tsx
10. Database ownership or RLS issues: supabase/migrations/001_init_simple.sql

- Wizard now has a terminal "Finalize" stage that centralizes readiness checklist, activation trigger, and tenant invite distribution so the setup lifecycle ends in one canonical flow.
