import { createClient } from "npm:@supabase/supabase-js@2";

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = [
    "https://www.zordaqjb.my",
    "http://localhost:5173",
    "http://localhost:5175",
  ].includes(origin)
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
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(request),
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  if (request.method !== "POST") return json(request, { error: "Method not supported." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json(request, { error: "A login session is required." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

  if (!supabaseUrl || !publishableKey || !telegramBotToken || !telegramChatId) {
    return json(request, { error: "Telegram notification configuration is incomplete." }, 500);
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(request, { error: "The login session is invalid." }, 401);

  const body = await request.json().catch(() => ({}));
  const jobId = String(body.job_id ?? "").trim();
  if (!jobId) return json(request, { error: "A job card ID is required." }, 400);

  const { data: job, error: jobError } = await userClient
    .from("job_cards")
    .select("id, plate_no, customer_complaint, status, notes, assigned_staff")
    .eq("id", jobId)
    .single();

  if (jobError || !job) return json(request, { error: "Job card could not be found." }, 404);
  if (job.status !== "Siap") return json(request, { error: "The job card is not Ready." }, 400);

  const [{ data: vehicle }, { data: staff }] = await Promise.all([
    userClient.from("vehicles").select("car_model").eq("plate_no", job.plate_no).maybeSingle(),
    job.assigned_staff
      ? userClient.from("profiles").select("nickname, full_name").eq("id", job.assigned_staff).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const staffName = staff?.nickname || staff?.full_name || "Unassigned";
  const message = [
    "🚗 Zordaq Motorsports JB",
    "Job Card: READY",
    `Plate: ${job.plate_no}`,
    `Model: ${vehicle?.car_model || "—"}`,
    `Complaint: ${job.customer_complaint}`,
    `Assigned: ${staffName}`,
  ].join("\n");

  const telegramResponse = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: telegramChatId, text: message }),
  });
  const telegramResult = await telegramResponse.json().catch(() => ({}));

  if (!telegramResponse.ok || !telegramResult.ok) {
    console.error("Telegram send failed", telegramResponse.status, telegramResult);
    return json(request, { error: "Telegram notification could not be sent." }, 502);
  }

  return json(request, { ok: true, job_id: job.id, telegram_message_id: telegramResult.result?.message_id });
});
