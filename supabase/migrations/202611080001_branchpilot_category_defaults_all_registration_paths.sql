grant select on table public.business_category_templates to anon, authenticated;

drop policy if exists business_category_templates_public_active_read on public.business_category_templates;
create policy business_category_templates_public_active_read
on public.business_category_templates
for select
to anon, authenticated
using (is_active = true);

create or replace function public.create_owner_business(
  p_name text,
  p_business_type text,
  p_activities jsonb,
  p_modules jsonb,
  p_templates jsonb,
  p_phone text default null,
  p_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user uuid := auth.uid();
  v_count integer;
  v_business_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_type text := trim(coalesce(p_business_type, ''));
  v_template record;
  v_modules jsonb;
  v_setup_templates jsonb;
  v_snapshot jsonb;
begin
  if v_user is null then raise exception 'Please sign in before adding a business.'; end if;
  if v_name = '' then raise exception 'Enter a business name.'; end if;
  if length(v_name) > 120 then raise exception 'Business name must be 120 characters or fewer.'; end if;
  if v_type = '' then raise exception 'Choose a business category.'; end if;
  if jsonb_typeof(coalesce(p_activities, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_activities, '[]'::jsonb)) < 1 then
    raise exception 'Choose a business category.';
  end if;
  if jsonb_array_length(p_activities) > 30 then raise exception 'Choose no more than 30 activities for one business.'; end if;
  if jsonb_typeof(coalesce(p_modules, '[]'::jsonb)) <> 'array'
     or jsonb_typeof(coalesce(p_templates, '[]'::jsonb)) <> 'array' then
    raise exception 'Invalid business setup profile.';
  end if;
  if not exists (
    select 1 from public.business_memberships bm
    where bm.user_id = v_user and bm.is_active = true and bm.role = 'owner'
  ) then raise exception 'Only a business owner can add another business.'; end if;

  select t.id, t.group_id, t.group_label, t.category_label, t.configuration
    into v_template
  from public.business_category_templates t
  where t.is_active = true and lower(trim(t.category_label)) = lower(v_type)
  order by t.sort_order
  limit 1;
  if not found then
    raise exception 'The selected category template is unavailable. Refresh the category list and try again.';
  end if;

  v_modules := coalesce(v_template.configuration->'supported_modules', p_modules, '[]'::jsonb);
  v_setup_templates := coalesce(v_template.configuration->'features', p_templates, '[]'::jsonb);
  v_snapshot := jsonb_build_object(
    'template_id', v_template.id,
    'group_id', v_template.group_id,
    'group_label', v_template.group_label,
    'category_label', v_template.category_label,
    'configuration', coalesce(v_template.configuration, '{}'::jsonb),
    'applied_at', now()
  );

  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 0));
  select count(distinct bm.business_id) into v_count
  from public.business_memberships bm
  where bm.user_id = v_user and bm.role = 'owner';
  if v_count >= 5 then raise exception 'You have reached the maximum of 5 businesses per owner.'; end if;

  insert into public.businesses(
    name, business_type, business_activities, enabled_modules, setup_templates,
    business_category_template_id, business_template_snapshot,
    phone, email, status, created_by
  )
  values(
    v_name, v_type, coalesce(p_activities, '[]'::jsonb), v_modules, v_setup_templates,
    v_template.id, v_snapshot,
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    'pending', v_user
  )
  returning id into v_business_id;

  insert into public.business_memberships(business_id, user_id, role, permissions, is_active)
  values(v_business_id, v_user, 'owner', '{}'::jsonb, true);
  insert into public.business_subscriptions(business_id, monthly_fee, status, admin_notes)
  values(v_business_id, 0, 'pending',
    'Owner-created business. Platform administrator must set pricing and confirm subscription before workspace access is enabled.');

  return jsonb_build_object(
    'business_id', v_business_id, 'status', 'pending',
    'category_template_id', v_template.id,
    'businesses_used', v_count + 1, 'business_limit', 5
  );
end;
$function$;
