-- Restrict the owner-add-business SECURITY DEFINER RPC to signed-in users.
-- The function itself still verifies an active owner membership before creating a tenant.
REVOKE ALL ON FUNCTION public.create_owner_business(text, text, jsonb, jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_owner_business(text, text, jsonb, jsonb, jsonb, text, text) TO authenticated;
