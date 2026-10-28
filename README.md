# DigiBiashara

DigiBiashara is a Kenyan multi-business management platform by Digital Kingdom Solutions. It is built with Next.js, TypeScript, Supabase Auth/Postgres/RLS, and Vercel.

## Current implementation

- Public product landing page and password sign-in (public sign-up is not exposed).
- Role-based route selection for platform administrators and business members.
- Platform admin console for business registration, business account status, subscription status, payment recording, and subscription plan creation.
- Business inventory workspace for product setup, opening stock, stock valuation, and low-stock alerts.
- Sales checkout using an atomic database function: validates permissions and available stock, records sale lines/payments, reduces inventory, creates stock movements, and returns a receipt number.
- Printable 80 mm thermal receipt layout.
- Tenant and subscription gates enforced in PostgreSQL row-level security helper functions.
- Supabase publishable key and URL configured as Vercel environment variables. No service-role key is exposed to the browser.

## Production links

- Public website: https://digibiashara-francis9271057-3716.vercel.app
- GitHub: https://github.com/ayana79696-cell/digibiashara

## First platform administrator setup

The admin console requires an existing Supabase Auth user to be explicitly listed in `public.platform_admins`. See [docs/ADMIN_SETUP.md](docs/ADMIN_SETUP.md). Do not add an admin privilege through browser-side code.

## Local development

1. Install Node.js 20+.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Run `npm run dev`.

## Important remaining work

This is an active implementation, not yet a fully production-complete ERP or published Android APK. Before commercial onboarding, finish and test staff invitations and customizable staff permissions, customer and supplier workflows, purchase/expense tracking, full financial reports, payment reconciliation, audit review, automated database backup/restore, and end-to-end tenant-isolation tests. M-Pesa is currently a manual payment method; automatic Daraja/STK or statement reconciliation needs credentials and webhook configuration. Android packaging and Play Store release are not complete.

Never expose a Supabase service-role key in a browser bundle or public repository. Test with non-production data before using real business accounts.
