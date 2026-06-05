# NestDesk - Current Implementation Plan

## Product State

NestDesk is currently implemented as an owner-first property management app built on Next.js 14 App Router, Supabase Auth, Supabase Postgres, Tailwind CSS, and Radix-based UI primitives.

The active product flow is:

1. Owner registers with email and password.
2. Owner signs in.
3. Owner completes a simple onboarding form with profile and address details.
4. Owner reaches the dashboard.
5. Owner adds one or more properties.
6. Owner configures floors and rooms for each property.
7. Owner activates a property after at least one floor and one room exist.

## Recent Updates

1. Auth shell and login screen theming were simplified for reliable light/dark readability.
2. Theme selector was added to the auth top navbar so users can switch theme directly on login/register flows.

3. Tenant workspace visuals were upgraded with a branded portal shell.
4. Tenant navigation now has active-state highlighting and clearer section cues.
5. Tenant dashboard UI was refreshed with a professional hero panel, quick actions, and improved status/property hierarchy.
6. Maintenance workflow is now bi-directional:
   - Tenant-raised requests appear in owner dashboard as notification count.
   - Owners can open a dedicated Maintenance area, add comments, and change status.
   - Tenant maintenance view now shows owner comments and status changes.
7. Tenant maintenance requests are now editable and deletable from tenant portal.
8. Owner maintenance dashboard request count now correctly includes open requests by fixing owner-hostel lookup filters.
9. Tenant maintenance edit/delete is now restricted to open status only; owner actions remain unrestricted.
10. Owner portal now includes a complete Tenants management module:
    - Owner can list all tenants across properties.
    - Owner can filter/search by status, property, and tenant details.
    - Owner can update tenant profile info, status, join/move-out dates, room assignment, and agreed rent amount.
    - Room occupancy state is synchronized when tenant status or room assignment changes.
11. Notices module is now fully implemented:
    - Owner can create notices (draft or published) for any of their properties.
    - Owner can edit notice title and body.
    - Owner can publish or unpublish notices with a single toggle.
    - Owner can soft-delete notices.
    - Owner notices page supports search, property filter, and status filter (published / draft).
    - Published notices are immediately visible to all active tenants of the property.
    - Tenant notices page is refactored to use the /api/tenant/notices API (only active tenants see notices).
    - notices table now has is_published and published_at columns (migration 006).
12. Payments module is now fully implemented:

- Owner can record received payments for active tenants with amount, month, method, status, and notes.
- A receipt number (ND-YYYYMM-XXXXXX) is auto-generated when a payment is recorded or updated as paid.
- Owner can edit existing payment amount, status, method, and notes.
- Marking a payment as paid auto-stamps paid_at and generates receipt number.
- Owner can delete payments.
- Owner payments page supports search (by tenant/receipt), property filter, month filter, and status filter.
- Summary stats show total collected, pending, overdue, and disputed amounts.
- Tenant payments page is refactored to use the /api/tenant/payments API with summary totals.

11. Tenant registration and profile refinement is now implemented:

- Tenant signup now captures occupation type, institution name, and Aadhaar number.
- Tenant signup now captures gender via dropdown (male, female, rather not say).
- Aadhaar numbers are validated using checksum validation before tenant record creation/update.
- Tenant profile now supports uploads for profile photo, Aadhaar front, Aadhaar back, and alternate ID image.
- Client-side image pipeline auto-crops document boundaries and compresses uploads before storage.
- Profile completion percentage is visible in tenant portal (layout, dashboard, and profile screen).
- Profile completion percentage is also visible in owner tenants management.
- Tenant activation is now blocked unless profile completion is 100%.
- Tenant moved-out status is now blocked unless tenant was activated at least once before.

12. Owner tenant verification UX is now expanded:

- Owner tenants list now renders tenant profile pictures (signed URLs from private storage).
- Clicking tenant profile picture or review action opens full tenant profile review with uploaded KYC documents.
- Owner can approve tenant profile as active directly from review dialog by assigning room, agreed rent, and join date.

13. API TypeScript compatibility fixes were applied:

- Payments create schema now uses Zod v4-compatible number validation message options in /api/payments.
- Tenant profile upload API now uses a typed document-column map and static tenant column selection to avoid Supabase dynamic select parser typing errors.

14. Branding asset update was applied:

- App favicon file content at src/app/favicon.ico was replaced with the NestDesk icon logo SVG.

15. Owner profile section was added to owner portal navigation:

- Sidebar now includes a My Profile menu item directly above Settings.
- New owner profile screen is available at /profile under the dashboard route group.
- Owner profile page shows core account details, onboarding status, address, and property snapshot metrics.

16. Owner profile is now editable from the profile screen:

- Added inline Edit Profile action on /profile to update full name, phone, and address details.
- Added secure PATCH API at /api/owner/profile for owner-scoped profile updates.
- Profile updates are audit logged in audit_logs and reflected immediately after save.

15. Owner expense management module is now implemented end-to-end:

- New expenses schema migration adds owner-scoped operating expense tracking with category, status, payment mode, recurring schedule fields, and soft delete support.
- New owner APIs are added for expenses list/create/update/delete with strict owner-property access checks and request validation.
- Owner portal now includes a full Expenses dashboard for quick entry, filtering, editing, deleting, and analytics.
- Expenses dashboard includes property-wise totals, category breakdown totals, monthly trend, and total expense summary cards.
- Expenses are added to owner sidebar navigation for direct access.
- Dashboard overview now includes this-month expenses and net cash flow (paid rent minus expenses).

16. Owner occupancy visualization module is now implemented:

- New Occupancy page at /occupancy shows visual room allocation by property and floor.
- Each room card displays room type, status, bed capacity, occupied/available beds, and rent.
- Allocated tenant list is rendered per room with status, join date, phone, and agreed rent.
- Unassigned tenants are highlighted per property for quick operational follow-up.
- Occupancy module is added to the owner sidebar navigation.

17. Public legal policy surface is now implemented:

- Landing page footer legal links now open a detailed modal for Privacy Policy, Terms of Service, Cookie Policy, and Refund Policy.
- Standalone policy pages now exist at /privacy, /terms, /cookies, and /refund for direct access and consent flows.
- Policy content now covers data collection, retention, sharing, cookies, user rights, acceptable use, refunds, and service limitations.

18. Password recovery flow is now implemented:

- Public forgot-password screen now lets both owners and tenants request a password reset link.
- Supabase auth callback now supports password recovery tokens in addition to signup verification links.
- Recovery links establish a secure reset session and redirect to a dedicated reset-password screen.

19. Public landing page messaging and pricing clarity were refreshed:

- Landing features now reflect only live modules (tenants, occupancy, payments, notices, maintenance, expenses, profile, and KYC review).
- Removed unsupported marketing claims such as WhatsApp reminders, Razorpay-specific plan promises, and export/reporting promises not currently shipped.
- Paid plan cards now use clearer property/tenant scale limits and support tiers aligned to the current product surface.
- Reset-password submission validates strong passwords server-side and clears the recovery session after a successful change.

20. Owner payment recording is now consistent across payments and tenants screens:

- The Add Payment action on the owner tenants page now opens the same record-payment modal used on the payments page.
- Both entry points now share the same billing-period defaults, form fields, payload shape, receipt-generation behavior, and /api/payments create flow.
- The shared fixed overlay keeps the calendar popover in the same working layout as the payments page to avoid clipped or hidden date pickers.

21. Owner tenants property navigation is now tab-based:

- Removed property dropdown filter from the tenants management toolbar.
- Added property tabs so owners can switch directly between properties and view tenants per property.
- Added per-property tenant counts in the top Total card while keeping the overall total visible.

22. Owner expenses module was revamped for professional financial visibility:

- Expenses top cards now show onboarding-aware lifetime totals, current-month totals with date range, and recurring schedules.
- Current-month daily trend is now rendered as an ApexCharts bar chart for quick month-in-progress visibility.
- Property-wise totals are embedded directly into the top cards (lifetime and current-month), replacing the old secondary summary panels.
- Expenses table is now TanStack-based with sortable columns and a three-dot action menu per row.
- Delete action now uses a confirmation dialog before performing soft delete.
- Filters now auto-trigger API reload without Apply button.
- API now returns month options from property onboarding month to current month.
- Recurring expenses are now auto-materialized by API when due date is reached, and recurring templates advance their next due date automatically.

23. Auth registration and session flows were standardized:

- New centralized auth module now handles registration, login, logout, callback exchange, cookie propagation, and post-login redirect resolution.
- Owner and tenant registration now create confirmed accounts immediately and start a session without email verification.
- Tenant registration now cleans up newly-created auth users when tenant profile insert fails to avoid orphan auth identities.
- Registration returns a clear duplicate-email message when the email already exists.

24. Owner phone verification is now implemented end-to-end with MSG91 WhatsApp OTP:

- Added owner-scoped OTP APIs at /api/owner/phone-otp/request and /api/owner/phone-otp/verify.
- Profile screen now supports WhatsApp OTP send and verify actions with verified/not-verified status visibility.
- Updating phone number in owner profile now auto-resets phone_verified and phone_verified_at.
- Dashboard sidebar now shows an exclamation warning on My Profile when phone is unverified, with hover tooltip.
- Property activation is now blocked until phone verification is complete, enforced in API and reflected in activation UI state.

25. Owner subscriptions and Razorpay checkout are now implemented:

- Added owner Subscriptions and Usage page under dashboard navigation.
- Added Razorpay Standard Checkout flow for paid plan purchase.
- Added POST /api/create-order to create Razorpay orders with owner context and amount guardrails.
- Added POST /api/verify-payment to validate HMAC signature and activate plans only on successful verification.
- Successful verification now writes to subscriptions and updates owners.plan.
- Added GET /api/owner/subscription/current for owner plan visibility in topbar and dashboard.
- Topbar avatar menu now shows current plan and includes quick links to My Account and Subscriptions.

26. Pricing and subscription catalog was simplified:

- Removed the test and business plan surfaces from the UI and payment backend.
- Reduced paid plan prices to micro = 5, starter = 7, and pro = 11.
- Replaced the old business card with a custom institution plan that routes users to sales instead of checkout.

## Implemented Modules

### 1. Auth and Session Management

Implemented:

1. Email/password registration with strong password validation.
2. Email/password registration without mandatory verification, with immediate post-signup session creation.
3. Centralized auth helper module in src/lib/auth.ts for registration, login, logout, callback exchange, and role-based redirect resolution.
4. Login API with Supabase cookie session handling.
5. Login rate limiting backed by the login_activity table.
6. Logout API that clears Supabase session cookies.
7. Middleware-based route protection with redirects for unauthenticated users.
8. Idle timeout logout after 30 minutes of inactivity in dashboard routes.
9. Forgot-password and reset-password flow for both owner and tenant accounts.

Current behavior notes:

1. Public routes include landing, login, register, verify-email, forgot-password, reset-password, auth callback, and auth APIs.
2. Authenticated users are redirected away from login, register, and forgot-password.
3. Non-public routes require a valid Supabase session.
4. Password reset requests use a generic success response to avoid exposing whether an email address exists.

### 2. Owner Onboarding

Implemented:

1. Single-step onboarding focused only on owner details.
2. Owner profile fields: phone, address lines, landmark, city, state, and pincode.
3. Onboarding prefill API for resumed sessions.
4. Local draft persistence in the browser.
5. Idempotent owner upsert keyed by owners.user_id.
6. Onboarding completion gate before dashboard access.
7. Audit log write on onboarding create/update.

Current behavior notes:

1. Onboarding no longer creates the first hostel.
2. Owner phone is captured but not verified in the active flow.
3. Phone OTP infrastructure still exists but is not required for registration or onboarding.

### 3. Dashboard Shell and Navigation

Implemented:

1. Shared dashboard layout that checks auth and onboarding completion server-side.
2. Sidebar navigation for dashboard, properties, tenants, occupancy, payments, notices, and settings.
3. Top bar with theme toggle, user menu, mobile nav, and logout action.
4. Landing page that detects signed-in users server-side and swaps CTA behavior.
5. Placeholder dashboard cards plus setup/activation guidance banners.

Current behavior notes:

1. The dashboard overview is still mostly static and onboarding/setup-driven.
2. Navigation entries for tenants, payments, notices, and settings exist in UI but their route implementations are not present yet.

### 4. Property Management

Implemented:

1. Properties listing page at /hostels.
2. Add property page at /hostels/new.
3. Property creation API with owner lookup, validation, and audit logging.
4. Property cards showing type, address, active status, floor count, and room count.
5. Property activation endpoint gated by setup completeness.
6. Activation UI for inactive properties once requirements are met.

Current behavior notes:

1. New properties are created as inactive by the app layer.
2. A property becomes eligible for activation only after at least one floor and one room exist.

### 6. Occupancy Visualization

Implemented:

1. Occupancy page at /occupancy for owner users.
2. Owner-scoped aggregation of hostels, floors, rooms, and tenants.
3. Property-level occupancy summary with occupied beds vs total beds and vacancy count.
4. Floor-wise room grids with tenant allocation visibility.
5. Room-level details including type label, operational status, capacity, and rent.
6. Unassigned tenant listing by property to support allocation actions.

Current behavior notes:

1. Occupancy is read-only and reflects real-time allocation from room_id on tenant records.
2. Bed occupancy counts use active tenants assigned to each room.

### 5. Floor and Room Setup

Implemented:

1. Dedicated setup hub at /hostels/[id]/setup.
2. Building shell step to create floors in sequence.
3. Add-rooms step with bulk room generation by prefix and range.
4. Blueprint step to edit and delete floors and rooms.
5. Floor CRUD APIs.
6. Room CRUD APIs.
7. Bulk room insert API that skips duplicate room numbers.
8. Soft delete behavior for floors and rooms using deleted_at.
9. DB re-sync after every setup mutation so the UI stays source-of-truth with the database.

Current behavior notes:

1. Duplicate room numbers are blocked per property.
2. Deleting a floor soft-deletes its child rooms.
3. Floor and room mutations currently do not write audit log rows.
4. Setup flow now hardens room generation with locked-after-save state, bounded range inputs, sanitized prefixes, and reset-to-next-batch behavior.
5. Floor and room API routes now enforce case-insensitive duplicate checks before create/update operations.
6. Blueprint destructive actions now require explicit user confirmation before delete calls.
7. Setup wizard now shows per-step guidance, explicit done criteria, guarded step transitions, and clearer CTA labels to reduce user confusion.
8. Add-rooms step now provides batch save preview context, explicit Start Next Batch action, and quick navigation to the next floor that still needs rooms.
9. Blueprint now warns about unsaved edits and blocks step navigation unless the user confirms discarding in-progress changes.
10. Setup wizard now includes a dedicated Final Review step with checklist-driven readiness, activation controls, and in-flow invite sharing after activation.

## Database-backed Features That Are Live

The following tables are actively used by the application code today:

1. owners
2. hostels
3. floors
4. rooms
5. tenants
6. login_activity
7. audit_logs
8. phone_otp_challenges

The following tables exist in the schema but do not yet have active UI or full feature flows:

1. payments
2. notices
3. maintenance_requests
4. subscriptions
5. invite_codes
6. consent_records
7. data_deletion_requests

## Current Gaps and Known Follow-up Work

### Immediate Product Gaps

1. Dashboard stats are still placeholder values, not live aggregates.
2. No payment collection, receipt, or reconciliation flows are wired yet.
3. Notices and subscription modules are not fully implemented yet.
4. Owner settings page is still placeholder-level.
5. Phone OTP is available in isolation but not integrated into the main owner flow.

### Technical / Architecture Gaps

1. Audit logging is partial and currently covers onboarding, property creation, and property activation only.
2. The TypeScript Hostel shape and one dashboard query assume a hostel deleted_at field, but the current hostels table does not define it.
3. There are no automated regression tests yet for auth, onboarding, or property setup flows.
4. Some navigation items are ahead of implementation and should be treated as placeholders.

## Recommended Next Tasks

### Priority 1

1. Replace dashboard placeholder stats with live queries.
2. Add tenant management routes, forms, and owner-scoped APIs.
3. Extend audit logging to floor and room mutations.
4. Resolve the hostel soft-delete mismatch between schema, types, and queries.

### Priority 2

1. Add payments module basics using existing schema tables.
2. Add notices and maintenance request flows.
3. Add tests for login, onboarding, property creation, activation, and setup APIs.

### Priority 3

1. Re-enable phone OTP behind a feature flag if required.
2. Add subscription enforcement and billing UX.
3. Add consent and data deletion user flows on top of the existing schema.

## Planning Notes

1. Treat this file as the implementation status summary.
2. Keep it aligned with actual routes, APIs, and schema behavior.
3. Use architecture.md for file-level references and code navigation.
