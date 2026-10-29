import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ error: "Owner registration is not configured." }, 500);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Enter valid registration details." }, 400); }

  const fullName = String(body.full_name || "").trim();
  const businessName = String(body.business_name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phone = String(body.phone || "").trim();
  const password = String(body.password || "");
  const activities = Array.isArray(body.activities) ? body.activities.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 30) : [];
  const modules = Array.isArray(body.modules) ? body.modules.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 60) : [];
  const templates = Array.isArray(body.templates) ? body.templates.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 60) : [];
  if (!fullName || fullName.length > 120) return json({ error: "Enter your full name (up to 120 characters)." }, 400);
  if (!businessName || businessName.length > 120) return json({ error: "Enter your business name (up to 120 characters)." }, 400);
  if (!emailPattern.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 8) return json({ error: "Password must have at least 8 characters." }, 400);
  if (!activities.length) return json({ error: "Choose at least one business category/activity." }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: fullName, phone, account_type: "business_owner", registered_via: "branchpilot" },
  });
  if (createError || !created.user) return json({ error: createError?.message?.toLowerCase().includes("already") ? "An account with this email already exists. Please use Owner login or reset your password." : (createError?.message || "Owner account could not be created.") }, 400);

  const userId = created.user.id;
  const businessType = activities[0];
  const { data: business, error: businessError } = await admin.from("businesses").insert({
    name: businessName, business_type: businessType, business_activities: activities,
    enabled_modules: modules, setup_templates: templates,
    phone: phone || null, email, status: "pending", created_by: userId,
    currency: "KES", timezone: "Africa/Nairobi",
  }).select("id").single();
  if (businessError || !business) {
    await admin.auth.admin.deleteUser(userId);
    return json({ error: "Business workspace could not be created: " + (businessError?.message || "database error") }, 500);
  }
  const { error: profileError } = await admin.from("profiles").upsert({ user_id: userId, full_name: fullName, phone: phone || null }, { onConflict: "user_id" });
  const { error: membershipError } = await admin.from("business_memberships").insert({
    business_id: business.id, user_id: userId, role: "owner", permissions: {}, is_active: true,
  });
  const { error: subscriptionError } = await admin.from("business_subscriptions").insert({
    business_id: business.id, monthly_fee: 0, status: "pending",
    admin_notes: "BranchPilot owner registration. Platform administrator must configure subscription and activate the business.",
  });
  if (profileError || membershipError || subscriptionError) {
    await admin.from("businesses").delete().eq("id", business.id);
    await admin.auth.admin.deleteUser(userId);
    return json({ error: "Registration could not be completed safely: " + (profileError?.message || membershipError?.message || subscriptionError?.message) }, 500);
  }
  await admin.from("audit_logs").insert({
    business_id: business.id, actor_user_id: userId, action: "owner_registered",
    entity_type: "business", entity_id: business.id,
    details: { full_name: fullName, email, category_count: activities.length, registered_via: "branchpilot" },
  });
  return json({
    message: "Owner account and business were created. The workspace is pending activation by the platform administrator. Use Owner login after activation.",
    business_id: business.id,
    status: "pending",
  }, 201);
});
