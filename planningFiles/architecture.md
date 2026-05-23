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

2. src/app/(auth)/layout.tsx
   - Shared auth visual shell

3. src/app/(auth)/login/page.tsx
   - Login form
   - Handles idle timeout message and rate-limit feedback

4. src/app/(auth)/register/page.tsx
   - Registration form
   - Strong password validation and strength meter

5. src/app/(auth)/verify-email/page.tsx
   - Post-registration verification instruction screen

6. src/app/auth/callback/route.ts
   - Exchanges Supabase email verification code for a session
   - Redirects to onboarding or dashboard

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
   - Some nav entries are placeholders for future modules

3. src/components/layout/TopBar.tsx
   - Theme toggle, profile menu, logout action, and mobile nav trigger

4. src/components/auth/IdleTimeoutEnforcer.tsx
   - Invisible component that activates logout-on-idle

5. src/hooks/use-idle-timeout.ts
   - Watches browser events and triggers logout after 30 minutes

## Feature Modules

### Auth

Main files:

1. src/app/api/auth/register/route.ts
2. src/app/api/auth/login/route.ts
3. src/app/api/auth/logout/route.ts
4. src/app/auth/callback/route.ts
5. src/lib/rate-limiter.ts

Behavior:

1. Registration validates inputs with Zod.
2. Production flow relies on Supabase verification email.
3. Development flow can create confirmed users directly.
4. Login writes login_activity rows and enforces a 5-failures-in-15-minutes rule.
5. Successful login redirects based on onboarding completion.

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
4. Property creation and activation write audit log entries.

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
3. The active owner flow does not currently require OTP completion.

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
2. Tenant, payment, notices, maintenance, settings, and subscription flows are not yet implemented even though some menu items and tables already exist.
3. Audit logging is incomplete for setup mutations.
4. The app already assumes a deleted_at field for hostels in some places, but the schema does not define it yet.

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
