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
  if (request.method !== "POST") return json(request, { error: "Kaedah tidak disokong." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "Sesi login diperlukan." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY") ?? "";
  if (!supabaseUrl || !publishableKey || !serviceKey) {
    return json(request, { error: "Konfigurasi Supabase function belum lengkap." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "Sesi login tidak sah." }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  if (profileError || !profile?.is_active || profile.role !== "admin") {
    return json(request, { error: "Akses admin diperlukan." }, 403);
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(request, { error: "Format email tidak sah." }, 400);
  }

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: "https://www.zordaqjb.my/?type=invite",
    data: { role: "staff" },
  });
  if (error) return json(request, { error: error.message }, 400);

  return json(request, { ok: true, user_id: data.user?.id, email });
});
