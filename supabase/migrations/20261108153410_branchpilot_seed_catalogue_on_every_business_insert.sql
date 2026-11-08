-- Database trigger guarantees category starter catalogue creation for every insertion path.
CREATE OR REPLACE FUNCTION branchpilot_private.seed_business_catalogue_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.business_category_template_id IS NOT NULL THEN
    PERFORM branchpilot_private.seed_template_examples(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION branchpilot_private.seed_business_catalogue_after_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS branchpilot_seed_category_catalogue_after_insert ON public.businesses;
CREATE TRIGGER branchpilot_seed_category_catalogue_after_insert
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION branchpilot_private.seed_business_catalogue_after_insert();

CREATE OR REPLACE FUNCTION public.create_owner_business(
  p_name text,
  p_business_type text,
  p_activities jsonb,
  p_modules jsonb,
  p_templates jsonb,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_count integer;
  v_business_id uuid;
  v_name text := trim(coalesce(p_name, ''));
  v_type text := trim(coalesce(p_business_type, ''));
  v_template record;
  v_modules jsonb;
  v_setup_templates jsonb;
  v_snapshot jsonb;
  v_seeded integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Please sign in before adding a business.'; END IF;
  IF v_name = '' THEN RAISE EXCEPTION 'Enter a business name.'; END IF;
  IF length(v_name) > 120 THEN RAISE EXCEPTION 'Business name must be 120 characters or fewer.'; END IF;
  IF v_type = '' THEN RAISE EXCEPTION 'Choose a business category.'; END IF;
  IF jsonb_typeof(coalesce(p_activities, '[]'::jsonb)) <> 'array'
     OR jsonb_array_length(coalesce(p_activities, '[]'::jsonb)) < 1 THEN
    RAISE EXCEPTION 'Choose a business category.';
  END IF;
  IF jsonb_array_length(p_activities) > 30 THEN RAISE EXCEPTION 'Choose no more than 30 activities for one business.'; END IF;
  IF jsonb_typeof(coalesce(p_modules, '[]'::jsonb)) <> 'array'
     OR jsonb_typeof(coalesce(p_templates, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Invalid business setup profile.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.business_memberships bm
    WHERE bm.user_id = v_user AND bm.is_active = true AND bm.role = 'owner'
  ) THEN RAISE EXCEPTION 'Only a business owner can add another business.'; END IF;

  SELECT t.id,t.group_id,t.group_label,t.category_label,t.configuration INTO v_template
  FROM public.business_category_templates t
  WHERE t.is_active = true AND lower(trim(t.category_label)) = lower(v_type)
  ORDER BY t.sort_order LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'The selected category template is unavailable. Refresh and try again.'; END IF;

  v_modules := coalesce(v_template.configuration->'supported_modules',p_modules,'[]'::jsonb);
  v_setup_templates := coalesce(v_template.configuration->'features',p_templates,'[]'::jsonb);
  v_snapshot := jsonb_build_object(
    'template_id',v_template.id,'group_id',v_template.group_id,'group_label',v_template.group_label,
    'category_label',v_template.category_label,
    'template_version',coalesce((v_template.configuration->>'template_version')::integer,1),
    'configuration',coalesce(v_template.configuration,'{}'::jsonb),'applied_at',now()
  );
  v_seeded := CASE
    WHEN jsonb_typeof(v_template.configuration->'product_examples') = 'array'
      THEN jsonb_array_length(v_template.configuration->'product_examples')
    ELSE 0
  END;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::text,0));
  SELECT count(DISTINCT bm.business_id) INTO v_count
  FROM public.business_memberships bm WHERE bm.user_id=v_user AND bm.role='owner';
  IF v_count>=5 THEN RAISE EXCEPTION 'You have reached the maximum of 5 businesses per owner.'; END IF;

  INSERT INTO public.businesses(
    name,business_type,business_activities,enabled_modules,setup_templates,
    business_category_template_id,business_template_snapshot,phone,email,status,created_by
  )
  VALUES(
    v_name,v_type,coalesce(p_activities,'[]'::jsonb),v_modules,v_setup_templates,
    v_template.id,v_snapshot,nullif(trim(coalesce(p_phone,'')),''),
    nullif(trim(coalesce(p_email,'')),''),'pending',v_user
  ) RETURNING id INTO v_business_id;

  INSERT INTO public.business_memberships(business_id,user_id,role,permissions,is_active)
  VALUES(v_business_id,v_user,'owner','{}'::jsonb,true);
  INSERT INTO public.business_subscriptions(business_id,monthly_fee,status,admin_notes)
  VALUES(v_business_id,0,'pending',
    'Owner-created business. Platform administrator must set pricing and confirm subscription before workspace access is enabled.');

  RETURN jsonb_build_object(
    'business_id',v_business_id,'status','pending','category_template_id',v_template.id,
    'businesses_used',v_count+1,'business_limit',5,'starter_examples_added',v_seeded
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.create_owner_business(text, text, jsonb, jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_owner_business(text, text, jsonb, jsonb, jsonb, text, text) TO authenticated;
