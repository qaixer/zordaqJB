import { createClient } from "npm:@supabase/supabase-js@2";

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = ["https://www.zordaqjb.my", "http://localhost:5173", "http://localhost:5175"].includes(origin)
    ? origin
    : "https://www.zordaqjb.my";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not supported." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "A login session is required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !publishableKey || !serviceKey) {
    return json(request, { error: "Supabase function configuration is incomplete." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "The login session is invalid." }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: requester, error: requesterError } = await adminClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  if (requesterError || !requester?.is_active || requester.role !== "admin") {
    return json(request, { error: "Admin access is required." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const staffId = String(body.staff_id ?? "").trim();
  const password = String(body.password ?? "");
  if (!staffId || password.length < 6) return json(request, { error: "A valid staff ID and password are required." }, 400);

  const { data: staff, error: staffError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", staffId)
    .single();
  if (staffError || staff?.role !== "staff") return json(request, { error: "Only staff passwords can be changed here." }, 400);

  const { error } = await adminClient.auth.admin.updateUserById(staffId, { password });
  if (error) return json(request, { error: error.message }, 400);
  return json(request, { ok: true });
});
