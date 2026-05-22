# Database Setup

This project now uses a two-step database workflow for development:

1. Optional full wipe (dev only)
2. Full schema bootstrap

## SQL Scripts

1. Reset script (destructive): supabase/migrations/000_dev_drop_all.sql
2. Full schema bootstrap: supabase/migrations/001_init_simple.sql

All other SQL migration scripts were removed to keep a clean two-file workflow.

## Run Order

Use this order in Supabase SQL Editor:

1. Run reset only if you want a clean start:
   - supabase/migrations/000_dev_drop_all.sql
2. Run schema creation:
   - supabase/migrations/001_init_simple.sql

## Tables Created by Current Bootstrap

The full bootstrap script currently creates:

1. owners
2. hostels
3. floors
4. rooms
5. tenants
6. payments
7. notices
8. maintenance_requests
9. subscriptions
10. invite_codes
11. login_activity
12. audit_logs
13. consent_records
14. data_deletion_requests
15. phone_otp_challenges

## Compatibility Note

The schema keeps owners.user_id mapped to auth.users(id), which is required by current app code in onboarding, login, dashboard gating, and auth callback flows.

## Included DB Features

1. UUID primary keys with pgcrypto/gen_random_uuid
2. Foreign key constraints between core entities
3. Check constraints for plan/property/status fields
4. Performance indexes for current query paths
5. updated_at trigger automation for mutable tables

## Current Scope

The bootstrap now includes:

1. Table creation
2. Constraints and indexes
3. updated_at trigger automation
4. RLS enablement and table policies (based on plan.txt)

Storage bucket policies can still be added in a separate follow-up script when needed.
