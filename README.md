# DigiBiashara

A Next.js + TypeScript starter for a Kenyan multi-business management platform by Digital Kingdom Solutions.

## Setup

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and add the Supabase project URL and publishable/anon key.
4. Run `npm run dev`.

## Current status

The public landing page and Supabase password sign-in UI are starter foundations. The business workspace, secure server-side session handling, admin business provisioning, subscriptions, sales, inventory transactions, payments, reporting, SMS/M-Pesa integrations and Android packaging are not yet production complete. Do not use this as a live business accounting system until these workflows and tenant-isolation policies are implemented and tested. Never expose a Supabase service-role key to the browser.
