# DigiBiashara — first platform administrator

The application deliberately does not let an ordinary user promote themselves to platform administrator. Set up the first admin using the trusted Supabase dashboard:

1. Open the DigiBiashara Supabase project `jzhkwulfnftkgkczdcqg` in the Supabase dashboard.
2. Go to **Authentication → Users** and add/invite the email address that will own the platform. Use a real inbox and complete the verification/invitation process. Do not share the password in chat or source control.
3. Open **SQL Editor** in the same Supabase project.
4. Replace `YOUR_ADMIN_EMAIL@example.com` in the following statement with that exact Auth email and run it:

```sql
insert into public.platform_admins (user_id)
select id
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL@example.com')
on conflict (user_id) do nothing;
```

5. Confirm the statement inserted one row, then sign in at the DigiBiashara website. The sign-in page should route this account to `/admin`.
6. Create subscription plans if needed. Register each business as pending. The admin console now sends an owner invitation or links an existing Auth account to the business. Do not mark a business active until its account and subscription are properly set up.

## Subscription access rule

Business data access is allowed only while all of these are true: the business is active, the membership is active, the subscription is marked paid, and `paid_until` is today or later. The admin's **Confirm paid** action records a subscription payment, marks the subscription paid, and renews it for 30 days. Verify the amount, method and reference entered before confirming.

Never insert arbitrary user IDs, expose service-role credentials, or allow a browser to grant platform-admin privileges.
