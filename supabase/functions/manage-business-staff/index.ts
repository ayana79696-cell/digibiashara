import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const allowedRoles = new Set(["manager", "cashier", "stock_manager", "accountant", "custom"]);
const allowedModules = new Set(["sales", "inventory", "finance", "customers", "reports", "purchases", "staff"]);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST required." }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!url || !anon || !service || !authHeader) return json({ error: "Staff service is not configured." }, 500);
  const callerClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const { data: auth, error: authError } = await callerClient.auth.getUser();
  if (authError || !auth.user) return json({ error: "Sign in again to manage staff." }, 401);
  const admin = createClient(url, service, { auth: { persistSession: false } });
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }
  const requestedBusinessId = String(body.business_id || "");
  let membershipQuery = admin.from("business_memberships")
    .select("business_id,role,is_active").eq("user_id", auth.user.id).eq("is_active", true);
  if (requestedBusinessId) membershipQuery = membershipQuery.eq("business_id", requestedBusinessId);
  const { data: memberships, error: membershipError } = await membershipQuery.limit(1);
  if (membershipError) return json({ error: "Could not verify business permissions." }, 500);
  const ownerMembership = memberships?.[0];
  if (!ownerMembership || !["owner", "business_owner", "admin"].includes(String(ownerMembership.role).toLowerCase())) {
    return json({ error: "Only the business owner or business administrator can manage staff." }, 403);
  }
  const { data: business, error: businessError } = await admin.from("businesses").select("id,status").eq("id", ownerMembership.business_id).maybeSingle();
  const { data: subscription, error: subError } = await admin.from("business_subscriptions").select("status,paid_until").eq("business_id", ownerMembership.business_id).maybeSingle();
  if (businessError || subError) return json({ error: "Could not verify subscription access." }, 500);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  if (!business || business.status !== "active" || subscription?.status !== "paid" || !subscription.paid_until || subscription.paid_until < today) {
    return json({ error: "Staff management is locked until the business subscription is paid and active." }, 403);
  }
  const action = String(body.action || "");
  const permissions = body.permissions && typeof body.permissions === "object"
    ? Object.fromEntries(Object.entries(body.permissions).filter(([k, v]) => allowedModules.has(k) && typeof v === "boolean"))
    : {};
  if (action === "create" || action === "invite") {
    const branchId = String(body.branch_id || "");
    if (branchId) {
      const { data: branch, error: branchError } = await admin.from("branches").select("id").eq("id", branchId).eq("business_id", ownerMembership.business_id).eq("is_active", true).maybeSingle();
      if (branchError || !branch) return json({ error: "Select an active branch belonging to this business." }, 400);
    }
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || "").trim();
    const role = String(body.role || "cashier");
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName) return json({ error: "Enter a valid worker name and email." }, 400);
    if (!allowedRoles.has(role)) return json({ error: "Select a valid staff role." }, 400);
    let worker: any = null;
    if (action === "create") {
      if (password.length < 8) return json({ error: "Initial password must be at least 8 characters." }, 400);
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName, created_by_owner: auth.user.id } });
      if (error || !data.user) return json({ error: error?.message || "Staff login could not be created." }, 400);
      worker = data.user;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName, business_id: ownerMembership.business_id, invited_by: auth.user.id } });
      if (error || !data.user) return json({ error: error?.message || "Invitation could not be sent." }, 400);
      worker = data.user;
    }
    const { error: insertError } = await admin.from("business_memberships").upsert({
      business_id: ownerMembership.business_id, user_id: worker.id, role, permissions, is_active: true,
    }, { onConflict: "business_id,user_id" });
    if (insertError) {
      if (action === "create") await admin.auth.admin.deleteUser(worker.id);
      return json({ error: "Account could not be linked to this business: " + insertError.message }, 500);
    }
    if (branchId) {
      const { error: employeeError } = await admin.from("employees").upsert({
        business_id: ownerMembership.business_id, user_id: worker.id, branch_id: branchId,
        full_name: fullName, email, phone: String(body.phone || "").trim() || null,
        role, is_active: true,
      }, { onConflict: "business_id,user_id" });
      if (employeeError) {
        await admin.from("business_memberships").delete().eq("business_id", ownerMembership.business_id).eq("user_id", worker.id);
        if (action === "create") await admin.auth.admin.deleteUser(worker.id);
        return json({ error: "The login was created, but its branch assignment could not be saved: " + employeeError.message }, 500);
      }
    }
    await admin.from("audit_logs").insert({ business_id: ownerMembership.business_id, actor_user_id: auth.user.id, action: "employee_created", entity_type: "employee", entity_id: worker.id, details: { full_name: fullName, email, branch_id: branchId || null, role } });
    return json({ message: action === "create" ? "Employee login created." : "Invitation sent to " + email + ". They must accept the email invitation and set a password.", user_id: worker.id });
  }
  if (action === "list") {
    const { data: team, error: teamError } = await admin.from("business_memberships")
      .select("user_id,role,permissions,is_active").eq("business_id", ownerMembership.business_id).order("role");
    if (teamError) return json({ error: "Could not load staff list." }, 500);
    const { data: authUsers, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) return json({ error: "Could not load staff contact details." }, 500);
    const byId = new Map((authUsers.users || []).map((u: any) => [u.id, u]));
    const rows = (team || []).map((m: any) => {
      const u: any = byId.get(m.user_id);
      return { ...m, email: u?.email || "", full_name: u?.user_metadata?.full_name || u?.user_metadata?.name || "" };
    });
    return json({ staff: rows });
  }
  const target = String(body.user_id || "");
  if (!target || target === auth.user.id) return json({ error: "Select another staff account." }, 400);
  const { data: targetMembership, error: targetError } = await admin.from("business_memberships").select("user_id,role").eq("business_id", ownerMembership.business_id).eq("user_id", target).maybeSingle();
  if (targetError || !targetMembership) return json({ error: "That user is not a member of this business." }, 404);
  if (["owner", "business_owner"].includes(String(targetMembership.role).toLowerCase())) return json({ error: "The business owner account cannot be changed here." }, 403);
  if (action === "update") {
    const role = String(body.role || "custom");
    if (!allowedRoles.has(role)) return json({ error: "Select a valid staff role." }, 400);
    const branchId = String(body.branch_id || "");
    if (branchId) {
      const { data: branch, error: branchError } = await admin.from("branches").select("id").eq("id", branchId).eq("business_id", ownerMembership.business_id).eq("is_active", true).maybeSingle();
      if (branchError || !branch) return json({ error: "Select an active branch belonging to this business." }, 400);
    }
    const { error } = await admin.from("business_memberships").update({ role, permissions, is_active: true }).eq("business_id", ownerMembership.business_id).eq("user_id", target);
    if (error) return json({ error: "Could not update permissions: " + error.message }, 400);
    if (branchId) {
      const { data: authUser } = await admin.auth.admin.getUserById(target);
      const { error: employeeError } = await admin.from("employees").upsert({
        business_id: ownerMembership.business_id, user_id: target, branch_id: branchId,
        full_name: String(body.full_name || authUser.user?.user_metadata?.full_name || authUser.user?.email || "Employee"),
        email: String(body.email || authUser.user?.email || "").toLowerCase(),
        phone: String(body.phone || "").trim() || null, role, is_active: true,
      }, { onConflict: "business_id,user_id" });
      if (employeeError) return json({ error: "Permissions changed but branch assignment failed: " + employeeError.message }, 400);
    }
    await admin.from("audit_logs").insert({ business_id: ownerMembership.business_id, actor_user_id: auth.user.id, action: "employee_updated", entity_type: "employee", entity_id: target, details: { role, branch_id: branchId || null, permissions } });
    return json({ message: "Staff permissions and branch assignment updated." });
  }
  if (action === "deactivate") {
    const { error } = await admin.from("business_memberships").update({ is_active: false }).eq("business_id", ownerMembership.business_id).eq("user_id", target);
    if (error) return json({ error: "Could not deactivate staff account: " + error.message }, 400);
    await admin.from("employees").update({ is_active: false }).eq("business_id", ownerMembership.business_id).eq("user_id", target);
    await admin.from("audit_logs").insert({ business_id: ownerMembership.business_id, actor_user_id: auth.user.id, action: "employee_deactivated", entity_type: "employee", entity_id: target, details: {} });
    return json({ message: "Staff access deactivated. Historical records are preserved." });
  }
  return json({ error: "Unknown staff action." }, 400);
});
