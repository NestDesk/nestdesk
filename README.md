This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Environment Variables

Create `.env.local` (or update existing) with:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
MSG91_AUTH_KEY=...

NEXT_PUBLIC_RAZORPAY_KEY_ID=...
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...
```

Important:

1. Never expose `RAZORPAY_KEY_SECRET` in client-side code.
2. Use `NEXT_PUBLIC_RAZORPAY_KEY_ID` only for checkout initialization.
3. Set `RAZORPAY_WEBHOOK_SECRET` for Razorpay webhook verification.

## Razorpay Standard Checkout Integration

Owner subscription payment flow uses:

1. `POST /api/create-order` to create Razorpay orders.
2. Razorpay checkout modal on owner Subscriptions and Usage page.
3. `POST /api/verify-payment` to verify payment signature.

On successful verification:

1. A subscription row is inserted for the owner.
2. Existing active owner subscriptions are expired.
3. `owners.plan` is updated to the purchased plan.

## Manual Test Steps (Subscriptions)

1. Run `npm run dev`.
2. Sign in as an owner account.
3. Open dashboard and navigate to Subscriptions and Usage.
4. Click Buy Plan on any paid plan.
5. Complete Razorpay checkout with test payment details.
6. Confirm current plan updates in:
   - Topbar avatar dropdown
   - Dashboard subscription overview card
   - Subscriptions and Usage page

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
