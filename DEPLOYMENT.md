# Deploy Salvage to Vercel — Step-by-Step Guide

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
   - Claim the free item and verify that the auto-generated pickup pass opens.
   - Buy the priced item, verify Stripe Checkout redirection, and check that the official receipt auto-generates upon return.
6. **Earnings & Withdrawals**: From the contractor account, verify that earnings reflect the sale and submit a test withdrawal request.
