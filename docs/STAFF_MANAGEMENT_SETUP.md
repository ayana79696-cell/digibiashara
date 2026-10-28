# DigiBiashara staff management deployment

The staff management screen is at `/business/staff`. It supports separate worker invitations, role selection, module permission selection, permission edits, and deactivation while retaining business records.

## Required backend deployment

The screen calls the Supabase Edge Function `manage-business-staff`. The function source is in `supabase/functions/manage-business-staff/index.ts`. It uses the Supabase service role only on the server, checks the signed-in caller, restricts management to an active business owner/admin, verifies the paid subscription, and scopes changes to that business.

Deploy it to Supabase project `jzhkwulfnftkgkczdcqg` with the Supabase CLI:

```sh
supabase login
supabase link --project-ref jzhkwulfnftkgkczdcqg
supabase functions deploy manage-business-staff
```

Ensure the project has its normal Supabase Edge Function secrets configured: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never be placed in a `NEXT_PUBLIC_*` variable, client component, GitHub source, or APK.

## Verify before production use

1. Sign in as a business owner whose subscription is paid and active.
2. Open `/business/staff` and invite a test worker email that you control.
3. Accept the invitation and set a password using the secure email link.
4. Confirm the worker appears in the team list with the chosen role.
5. Edit permissions, deactivate the worker, and confirm the worker cannot access the business workspace.
6. Test unpaid/expired subscription, another business's user ID, and a cashier trying to manage staff. All must be denied.

The function must be deployed before invitations and staff-management actions can work. Fine-grained enforcement of every module permission must also be applied to protected database operations/RLS policies before relying on those permission checkboxes as a security boundary.
