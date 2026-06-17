# Agent Instructions

- This is a Next.js 14 App Router project; main code is in `src/app/api/**` and `src/lib/**`.
- Use existing helpers in `src/lib/` before adding new patterns.
- Keep messaging logic in `src/lib/messaging/`; keep notice and maintenance WhatsApp flows separate.
- Never expose Razorpay secrets or put client-side secrets in UI code.
- Use editor/type checks for normal changes; do not run `npm run build` for every small edit.
- IMPORTANT - Do not Run `npm run build` unless asked for release-ready verification.

Common paths:
- Tenant API: `src/app/api/tenant/**`
- Owner/dashboard UI: `src/app/(dashboard)/**` and `src/app/(tenant)/**`
- Shared logic: `src/lib/**`
