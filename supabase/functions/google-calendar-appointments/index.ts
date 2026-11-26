import { createClient } from "npm:@supabase/supabase-js@2";

const TIME_ZONE = Deno.env.get("GOOGLE_CALENDAR_TIMEZONE") || "Asia/Kuala_Lumpur";
const DEFAULT_CALENDAR_ID = Deno.env.get("GOOGLE_CALENDAR_ID") || "primary";

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigin = [
    "https://www.zordaqjb.my",
    "http://localhost:5173",
    "http://localhost:5175",
  ].includes(origin) ? origin : "https://www.zordaqjb.my";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function redirect(request: Request, location: string) {
  return new Response(null, { status: 302, headers: { ...corsHeaders(request), Location: location }});
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name) ?? "";
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function serviceClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function authenticatedUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization) return null;
  const client = createClient(requiredEnv("SUPABASE_URL"), Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || requiredEnv("SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  return error || !data.user ? null : data.user;
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function tokenKey() {
  const secret = requiredEnv("GOOGLE_TOKEN_ENCRYPTION_KEY");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptToken(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await tokenKey(), new TextEncoder().encode(value));
  const payload = new Uint8Array(iv.length + encrypted.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(encrypted), iv.length);
  return base64(payload);
}

async function decryptToken(value: string) {
  const payload = fromBase64(value);
  const iv = payload.slice(0, 12);
  const ciphertext = payload.slice(12);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, await tokenKey(), ciphertext);
  return new TextDecoder().decode(decrypted);
}

async function exchangeAuthorizationCode(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.refresh_token) throw new Error(result.error_description || "Google authorization failed");
  return result;
}

async function accessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.access_token) throw new Error(result.error_description || "Google access token refresh failed");
  return result.access_token as string;
}

async function googleRequest(token: string, url: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error?.message || result.error_description || `Google Calendar request failed (${response.status})`);
  return result;
}

function localDateTime(date: string, time: string) {
  return `${date}T${time || "09:00:00"}`;
}

function calendarEvent(appointment: Record<string, unknown>) {
  const start = localDateTime(String(appointment.appointment_date), String(appointment.appointment_time || "09:00:00"));
  const duration = Number(appointment.duration_minutes || 60);
  const startDate = new Date(`${start}+08:00`);
  const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
  const end = endDate.toISOString().replace(".000Z", "Z");
  const status = String(appointment.status || "Pending Review");
  return {
    summary: `Appointment - ${appointment.customer_name} - ${appointment.plate_no}`,
    description: [
      "ZORDAQ_APPOINTMENT",
      `Appointment ID: ${appointment.id}`,
      `Customer: ${appointment.customer_name}`,
      `Phone: ${appointment.customer_phone || ""}`,
      `Plate: ${appointment.plate_no}`,
      `Car: ${appointment.car_model || ""}`,
      `Job: ${appointment.job_description}`,
      `Status: ${status}`,
    ].join("\n"),
    start: { dateTime: start, timeZone: TIME_ZONE },
    end: { dateTime: end, timeZone: "UTC" },
    extendedProperties: { private: { appointment_id: String(appointment.id), source: "zordaq" } },
    colorId: status === "Cancelled" ? "11" : undefined,
  };
}

async function connection(db: ReturnType<typeof serviceClient>) {
  const { data, error } = await db.from("google_calendar_connections").select("*").order("connected_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function syncAppointment(db: ReturnType<typeof serviceClient>, appointmentId: string, remove = false) {
  const { data: appointment, error: appointmentError } = await db.from("appointments").select("*").eq("id", appointmentId).single();
  if (appointmentError || !appointment) throw new Error("Appointment could not be found");
  const calendar = await connection(db);
  if (!calendar) return { skipped: true, reason: "not_connected" };

  try {
    const token = await accessToken(await decryptToken(calendar.refresh_token_encrypted));
    const calendarId = encodeURIComponent(calendar.calendar_id || DEFAULT_CALENDAR_ID);
    if (remove) {
      if (appointment.google_event_id) {
        const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(appointment.google_event_id)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok && response.status !== 404) throw new Error(`Google Calendar delete failed (${response.status})`);
      }
      return { deleted: true };
    }

    const event = calendarEvent(appointment);
    const result = appointment.google_event_id
      ? await googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(appointment.google_event_id)}`, { method: "PUT", body: JSON.stringify(event) })
      : await googleRequest(token, `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?sendUpdates=none`, { method: "POST", body: JSON.stringify(event) });

    const { error: updateError } = await db.from("appointments").update({ google_event_id: result.id, google_sync_status: "synced", google_sync_error: null, google_synced_at: new Date().toISOString() }).eq("id", appointmentId);
    if (updateError) throw updateError;
    return { synced: true, google_event_id: result.id };
  } catch (error) {
    await db.from("appointments").update({ google_sync_status: "error", google_sync_error: error instanceof Error ? error.message : String(error) }).eq("id", appointmentId);
    throw error;
  }
}

async function oauthCallback(request: Request) {
  const url = new URL(request.url);
  const appUrl = Deno.env.get("GOOGLE_OAUTH_SUCCESS_REDIRECT") || "https://www.zordaqjb.my";
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  const db = serviceClient();
  const { data: oauthState } = await db.from("google_calendar_oauth_states").select("*").eq("state", state).gt("expires_at", new Date().toISOString()).maybeSingle();
  await db.from("google_calendar_oauth_states").delete().eq("state", state);
  if (!oauthState || !code) return redirect(request, `${appUrl}/?google_calendar=error`);

  try {
    const token = await exchangeAuthorizationCode(code);
    const access = token.access_token as string;
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${access}` } });
    const profile = await profileResponse.json().catch(() => ({}));
    const encrypted = await encryptToken(token.refresh_token as string);
    const { error } = await db.from("google_calendar_connections").upsert({ connected_by: oauthState.user_id, calendar_id: DEFAULT_CALENDAR_ID, google_account_email: profile.email || null, refresh_token_encrypted: encrypted, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "connected_by" });
    if (error) throw error;
    return redirect(request, `${appUrl}/?google_calendar=connected`);
  } catch (error) {
    console.error("Google OAuth callback failed", error);
    return redirect(request, `${appUrl}/?google_calendar=error`);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(request) });
  const url = new URL(request.url);
  if (request.method === "GET" && url.searchParams.get("action") === "oauth_callback") return oauthCallback(request);
  if (request.method !== "POST") return json(request, { error: "POST required" }, 405);

  const user = await authenticatedUser(request);
  if (!user) return json(request, { error: "A login session is required." }, 401);
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "");
  const db = serviceClient();

  try {
    if (action === "get_connect_url") {
      const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") return json(request, { error: "Only an admin can connect Google Calendar." }, 403);
      const state = crypto.randomUUID();
      await db.from("google_calendar_oauth_states").delete().lt("expires_at", new Date().toISOString());
      const { error } = await db.from("google_calendar_oauth_states").insert({ state, user_id: user.id, expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
      if (error) throw error;
      const params = new URLSearchParams({ client_id: requiredEnv("GOOGLE_CLIENT_ID"), redirect_uri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"), response_type: "code", access_type: "offline", prompt: "consent", scope: "https://www.googleapis.com/auth/calendar.events", state });
      return json(request, { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
    }
    if (action === "status") {
      const current = await connection(db);
      return json(request, { connected: Boolean(current), email: current?.google_account_email || null, calendar_id: current?.calendar_id || DEFAULT_CALENDAR_ID });
    }
    if (action === "upsert") {
      const result = await syncAppointment(db, String(body.appointment_id || ""));
      return json(request, result);
    }
    if (action === "delete") {
      const result = await syncAppointment(db, String(body.appointment_id || ""), true);
      return json(request, result);
    }
    return json(request, { error: "Unknown action." }, 400);
  } catch (error) {
    console.error("Google Calendar action failed", error);
    return json(request, { error: error instanceof Error ? error.message : "Google Calendar operation failed." }, 500);
  }
});
