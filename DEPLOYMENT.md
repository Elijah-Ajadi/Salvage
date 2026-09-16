# Deploy Salvage to Vercel — Step-by-Step Guide

## Contractor confirmation and interactive map

Migration `202609150008_pickup_confirmation.sql` requires contractors to confirm new pickup windows before buyers can accept items. Contractors may also extend the end time while preserving the original arrival time. Both participants receive updates, and unconfirmed windows cannot be used for no-show reports. Existing reservations retain their previously agreed windows.

Apply this migration and deploy the accompanying app together during a maintenance window:

```bash
node --env-file=.env scripts/upgrade-confirmation.mjs
```

Do not leave the previous app running against the new migration: it has no confirmation button. This migration has been tested locally; it has not been applied to the hosted database as part of the Devpost writeup changes.

The workspace map now uses Leaflet with OpenStreetMap tiles, selectable material pins, grouped overlapping locations, and category/search/distance filtering. Keep OpenStreetMap attribution visible. Public discovery continues to receive approximate listing coordinates from the existing API.

## Location visibility update

Migration `202609150007_listing_radius.sql` adds a contractor-selected visibility radius to each listing. Existing listings inherit their contractor's saved radius. It has been applied to the configured Salvage database; other installations can run `node --env-file=.env scripts/upgrade-location.mjs` after the pickup migration. Deploy the accompanying application changes together.

The store and buyer dashboard now use the same location-filtered feed. Signed-in users use their saved profile coordinates; visitors choose an area. Buyer notification radius and category preferences control alerts, while the listing's radius controls discovery. A listing beyond its contractor's radius will not appear even if the viewer increases their notification radius. Logout clears this browser's authentication cookies, including chunked or stale sessions.

## Payment integrity update (required for the hackathon)

### Pickup protection update

Migration `202609110006_pickup_protection.sql` builds on the payment migration below. For an existing installation, run `node --env-file=.env scripts/upgrade-pickups.mjs --schedule-payments --admin-email YOUR_ADMIN_EMAIL` after applying migration 005. This configures minute-by-minute reservation expiry and reminders, and payment reconciliation every five minutes through Supabase Cron. It stores the maintenance secret in Supabase Vault and writes `ADMIN_USER_IDS` and `CRON_SECRET` to the ignored local `.env`.

Copy both variables to Vercel as server-only production variables and redeploy the updated source. The configured Salvage database already has this migration and both schedules; the new deployment and environment settings are still required for payment reconciliation. `/reports` gives the configured account the review queue.

Run `node --env-file=.env scripts/configure-payments.mjs https://salvage-six.vercel.app` to register the additional `payment_intent.succeeded`, `payment_intent.canceled`, and `payment_intent.amount_capturable_updated` webhook events.

The current flow replaces instant purchases: reserve a pickup window, authorize a card for a priced item, inspect and accept the item on the existing receipt, then have the contractor confirm handover. Only explicit buyer acceptance captures payment. Earnings become available after contractor confirmation. Expired or canceled reservations release the item and card authorization; the next waiting buyer is notified. Reviews require a completed pickup; no-show penalties require admin review.

For the demo, use a buyer and contractor account to complete a free pickup first. For a priced item, use Stripe test Checkout to authorize, return to the receipt, accept during the pickup window, and confirm handover as the contractor. Also test cancellation, the waitlist, a report, and its admin decision. Card capture must be checked with Stripe test mode before submission; no real money is needed.

The payment fixes add migration `202609090005_payment_integrity.sql`. Existing projects can apply it with:

```bash
node --env-file=.env scripts/upgrade-payments.mjs
```

This preserves existing accounts and listings. Historical claimed listings are not counted as earnings without a verified payment order.

Register a Stripe **test-mode** webhook and save its signing secret into the ignored local `.env`:

```bash
node --env-file=.env scripts/configure-payments.mjs https://salvage-six.vercel.app
```

Copy `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_APP_URL` from `.env` into Vercel's production environment variables alongside the existing Stripe and Supabase variables. Redeploy the updated source. Never put the webhook secret in a `NEXT_PUBLIC_` variable.

Webhook URL: `/api/payments/webhook`. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`. The raw request body and Stripe signature are verified before processing. Checkout completion is idempotent, so webhook retries and the buyer's return page cannot create duplicate claims.

Hackathon behavior: Stripe test-mode purchases produce clearly labelled test receipts and simulated withdrawals. No actual bank transfer occurs. Live-mode withdrawals create pending requests for manual processing; automated bank payouts require a separate Stripe Connect integration.

Checkout reserves an item for up to 40 minutes, with Stripe checkout expiring five minutes before the hold is released. Returning through Cancel releases the hold immediately. Late payments after a reservation has been replaced are refunded. Earnings use confirmed payment records less refunds, and test/live balances remain separate.

Email confirmation must be enabled in Supabase. Signup displays a check-inbox message, and unconfirmed accounts cannot log in. The resend action does not require a password. Previously auto-confirmed accounts are preserved; the fix does not retroactively prove inbox ownership for them.

Verification:

```bash
pnpm test
pnpm run build
```

To run service integration tests, start a local production build on port 3001, set its `NEXT_PUBLIC_APP_URL` to `http://localhost:3001`, then run `node --env-file=.env scripts/test-integration.mjs --run`. This creates temporary test accounts/listings and real Stripe test Checkout sessions, then removes its fixtures. It sends no emails and moves no real money.

For the submission demo, follow the pickup protection flow above. Earnings should remain unavailable until handover is confirmed. Check donation records separately on an available item.

Salvage is a Next.js App Router application powered by Supabase (PostgreSQL, Auth, Storage) and Stripe for payments. Follow these steps to deploy to Vercel.

---

## Step 1: Push Code to GitHub / Git Provider

1. Open your terminal in the project root (`c:\Users\STADIUM B C\Demola\Salvage`).
2. Make sure sensitive files are ignored (`.gitignore` already protects all `.env*` files).
3. Stage, commit, and push your changes:
   ```bash
   git add .
   git commit -m "feat: complete Salvage platform with Stripe payments, Gemini AI, and Vercel deployment prep"
   git push origin main
   ```

---

## Step 2: Import Project in Vercel

1. Log in to [Vercel](https://vercel.com).
2. Click **"Add New..."** > **"Project"**.
3. Select your Git repository and click **Import**.
4. Configure the build settings:
   - **Framework Preset**: Next.js (automatically detected)
   - **Root Directory**: `./` (leave default)
   - **Node.js Version**: 22.x or 24.x (Vercel Project Settings > General)

---

## Step 3: Add Environment Variables in Vercel

In the Vercel project configuration page (under **Environment Variables**), add the following keys:

| Variable | Value / Description |
| :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Your Vercel production domain (e.g. `https://your-salvage-project.vercel.app`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (`https://xggeghwargbxuwhsbxkv.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role secret key |
| `GEMINI_API_KEY` | Your Google Gemini API Key |
| `STRIPE_PUBLISHABLE_KEY` | Your Stripe publishable key (`pk_test_...` or live key) |
| `STRIPE_SECRET_KEY` | Your Stripe secret key (`sk_test_...` or live key) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the `/api/payments/webhook` endpoint |

> **Note**: Do not add `SUPABASE_ACCESS_TOKEN` to Vercel. It is only needed locally for database migration scripts.

---

## Step 4: Click "Deploy"

Click **Deploy**. Vercel will install dependencies using `pnpm`, run the build, and deploy your serverless functions and frontend pages.

---

## Step 5: Post-Deployment Supabase Configuration

Once your Vercel deployment URL is generated (e.g. `https://salvage-app.vercel.app`):

1. Go to your **[Supabase Dashboard](https://supabase.com/dashboard)**.
2. Select your project.
3. Navigate to **Authentication** > **URL Configuration**:
   - **Site URL**: `https://your-salvage-project.vercel.app`
   - **Redirect URLs**: Add both:
     - `https://your-salvage-project.vercel.app/auth/callback`
     - `https://your-salvage-project.vercel.app/auth/callback?next=/reset-password?update=1`
4. Click **Save**.

---

## Verification & Acceptance Checklist

Once deployed:
1. **Landing Page**: Visit `https://your-project.vercel.app` and check responsiveness and links.
2. **Signup & Login**: Create a new contractor and a new buyer account.
3. **AI Vision Listing**: From the contractor workspace, upload a salvage item photo and verify that Gemini auto-populates title, condition, and price suggestion.
4. **Publish**: Publish a free item and a priced item.
5. **Buyer Claim & Stripe Checkout**:
   - Reserve the free item and verify that its existing pickup receipt opens; accept and confirm handover from the two accounts.
   - Reserve the priced item and authorize through Stripe Checkout. Inspect and accept through the receipt, then confirm handover as the contractor.
6. **Earnings & Withdrawals**: From the contractor account, verify that earnings reflect the sale and submit a test withdrawal request.
