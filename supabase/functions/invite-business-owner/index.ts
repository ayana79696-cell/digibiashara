import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

function branchPilotRedirect(req: Request): string {
  const candidates = [
    req.headers.get("origin") || "",
    Deno.env.get("APP_URL") || "",
    "https://digibiashara-tau.vercel.app",
  ];
  for (const candidate of candidates) {
    try {
      const appUrl = new URL(candidate);
      const host = appUrl.hostname.toLowerCase();
      const allowed =
        host === "digibiashara-tau.vercel.app" ||
        (host.startsWith("digibiashara-") && host.endsWith(".vercel.app")) ||
        host === "localhost" ||
        host === "127.0.0.1";
      if (allowed && (appUrl.protocol === "https:" || host === "localhost" || host === "127.0.0.1")) {
        return new URL("/reset-password", appUrl.origin).toString();
      }
    } catch {
      // Try the next trusted app URL.
    }
  }
  return "https://digibiashara-tau.vercel.app/reset-password";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply(405, { error: "Use POST." });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return reply(401, { error: "Sign in is required." });
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply(500, { error: "Server-side Supabase configuration is missing." });

  const caller = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await caller.auth.getUser();
  if (authError || !authData.user) return reply(401, { error: "Your session is invalid or expired." });
  const { data: isAdmin, error: adminError } = await caller.rpc("is_platform_admin");
  if (adminError || isAdmin !== true) return reply(403, { error: "Only platform administrators can invite business owners." });

  let body: { business_id?: string; email?: string; full_name?: string };
  try { body = await req.json(); } catch { return reply(400, { error: "Request body must be valid JSON." }); }
  const businessId = String(body.business_id || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.full_name || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(businessId)) {
    return reply(400, { error: "A valid business ID is required." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Enter a valid owner email address." });
  if (fullName.length < 2 || fullName.length > 120) return reply(400, { error: "Enter the owner's full name (2–120 characters)." });

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: business, error: businessError } = await admin
    .from("businesses").select("id,name").eq("id", businessId).maybeSingle();
  if (businessError || !business) return reply(404, { error: "Business was not found." });

  const { data: users, error: userListError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userListError) return reply(500, { error: "Could not check whether the owner already has an account." });
  let targetUser: any = users.users.find((user) => (user.email || "").toLowerCase() === email) || null;
  let inviteSent = false;
  let passwordLinkSent = false;
  let passwordLinkWarning: string | null = null;

  if (!targetUser) {
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, account_type: "business_owner", registered_via: "branchpilot" },
      redirectTo: branchPilotRedirect(req),
    });
    if (inviteError || !invited.user) {
      const { data: after } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const accidentallyCreated = after?.users.find((user) => (user.email || "").toLowerCase() === email);
      if (accidentallyCreated) await admin.auth.admin.deleteUser(accidentallyCreated.id);
      return reply(400, { error: inviteError?.message || "Invitation could not be sent. Check the Supabase Auth email settings and redirect URL allowlist." });
    }
    targetUser = invited.user;
    inviteSent = true;
    passwordLinkSent = true;
  }

  const { data: existing, error: existingError } = await admin.from("business_memberships")
    .select("id").eq("business_id", businessId).eq("user_id", targetUser.id).maybeSingle();
  if (existingError) return reply(500, { error: "Could not check whether this owner is already linked." });
  if (existing) return reply(409, { error: "This account is already linked to the business." });

  const { error: profileError } = await admin.from("profiles").upsert(
    { user_id: targetUser.id, full_name: fullName, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  if (profileError) {
    if (inviteSent) await admin.auth.admin.deleteUser(targetUser.id);
    return reply(500, { error: "Profile setup failed: " + profileError.message });
  }
  const { error: memberError } = await admin.from("business_memberships").insert({
    business_id: businessId, user_id: targetUser.id, role: "owner", permissions: {}, is_active: true,
  });
  if (memberError) {
    if (inviteSent) await admin.auth.admin.deleteUser(targetUser.id);
    return reply(500, { error: "Business membership setup failed: " + memberError.message });
  }

  if (!inviteSent) {
    const passwordClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: resetError } = await passwordClient.auth.resetPasswordForEmail(email, {
      redirectTo: branchPilotRedirect(req),
    });
    if (resetError) passwordLinkWarning = resetError.message;
    else passwordLinkSent = true;
  }

  await admin.from("audit_logs").insert({
    business_id: businessId,
    actor_user_id: authData.user.id,
    action: "business_owner_invited",
    entity_type: "business_membership",
    entity_id: targetUser.id,
    details: {
      email,
      invite_sent: inviteSent,
      password_link_sent: passwordLinkSent,
      business_name: business.name,
      invitation_redirect: passwordLinkSent ? branchPilotRedirect(req) : null,
    },
  });
  return reply(200, {
    ok: true,
    business_id: businessId,
    business_name: business.name,
    owner_email: email,
    invite_sent: inviteSent,
    password_link_sent: passwordLinkSent,
    password_link_warning: passwordLinkWarning,
    redirect_to: passwordLinkSent ? branchPilotRedirect(req) : null,
    message: inviteSent
      ? "Owner invitation email sent with the BranchPilot password setup link."
      : passwordLinkSent
        ? "Existing owner account linked. A fresh BranchPilot password setup/recovery link was sent."
        : "Existing owner account linked, but the password email could not be sent: " + (passwordLinkWarning || "Please ask the owner to use password recovery."),
  });
});
