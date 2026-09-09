# Salvage — Local Building Material Exchange

Salvage is a full-stack Next.js App Router application connecting renovators, contractors, and DIYers to exchange, sell, or donate reusable building materials.

## Features
- **Contractor Workspace**:
  - AI photo analysis (Google Gemini vision) automatically tags material, category, condition, and fair resale price.
  - Optional listing pricing: items default to free unless explicitly priced.
  - Earnings dashboard with sales history and withdrawal requests (ACH, Stripe, PayPal, Zelle).
  - 1-click nonprofit tax donation receipt generator.
- **Buyer Workspace**:
  - Distance & category-based discovery with interactive OpenStreetMap integration.
  - 1-click instant claiming for free items with auto-generated verified **Pickup Pass**.
  - Stripe Checkout integration for priced materials.
  - Full purchase & claim history with printable / downloadable PDF receipts.
- **Security & Privacy**:
  - Email confirmation and password reset.
  - Row Level Security: contractor contact info & pickup address only revealed after item is claimed/purchased.
  - Private Supabase storage bucket for uploaded item imagery.

---

## Deployment & Setup

Refer to **[DEPLOYMENT.md](file:///c:/Users/STADIUM%20B%20C/Demola/Salvage/DEPLOYMENT.md)** for the complete step-by-step Vercel deployment guide and required environment variables.

### Local Development Commands
```bash
pnpm dev        # Run Next.js development server
pnpm build      # Test production build
pnpm typecheck  # Run TypeScript checks
pnpm test       # Run database test suite
```

### Database Migrations
Migrations are located in `supabase/migrations/` in execution order:
1. `202609090001_salvage.sql`: Initial schema (users, listings, notifications, storage).
2. `202609090002_optional_profile_coordinates.sql`: Coordinates flexibility for user addresses.
3. `202609090003_add_listing_price.sql`: Price and Stripe session support on listings.
4. `202609090004_add_payout_requests.sql`: Payout requests table for contractor withdrawals.
