import { createClient } from "npm:@supabase/supabase-js@2";

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mac: 3, mar: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, ogos: 8, aug: 8, august: 8, sep: 9, september: 9,
  okt: 10, october: 10, oktober: 10, nov: 11, november: 11, dis: 12, dec: 12, december: 12,
};

const FIELD_ALIASES: Record<string, string> = {
  tarikh: "date", date: "date", "appointment date": "date", "tarikh appointment": "date",
  masa: "time", time: "time", "appointment time": "time", "masa appointment": "time",
  tempoh: "duration", duration: "duration", durasi: "duration", "duration minutes": "duration",
  pelanggan: "customer", customer: "customer", "customer name": "customer", "nama pelanggan": "customer", nama: "customer",
  telefon: "phone", phone: "phone", "phone number": "phone", "no telefon": "phone", "nombor telefon": "phone",
  "no plat": "plate", "nombor plat": "plate", plate: "plate", "plate no": "plate", "plate number": "plate", pendaftaran: "plate",
  model: "model", "car model": "model", "model kereta": "model",
  kerja: "job", job: "job", servis: "job", service: "job", description: "job", keterangan: "job", "job description": "job",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function todayMalaysia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toDateValue(year: number, month: number, day: number, rollForward = false) {
  let finalYear = year;
  let result = `${finalYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const valid = new Date(`${result}T00:00:00Z`);
  if (valid.getUTCFullYear() !== finalYear || valid.getUTCMonth() + 1 !== month || valid.getUTCDate() !== day) return null;
  if (rollForward && result < todayMalaysia()) {
    finalYear += 1;
    result = `${finalYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return result;
}

function parseDate(text: string) {
  const value = text.trim().toLowerCase();
  const iso = value.match(/\b(20\d{2})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return toDateValue(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const numeric = value.match(/\b(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?\b/);
  if (numeric) {
    const yearText = numeric[3];
    const year = yearText ? (yearText.length === 2 ? 2000 + Number(yearText) : Number(yearText)) : Number(todayMalaysia().slice(0, 4));
    return toDateValue(year, Number(numeric[2]), Number(numeric[1]), !yearText);
  }

  const match = value.match(/\b(\d{1,2})\s*(jan(?:uari)?|feb(?:ruari)?|mac|mar(?:ch)?|apr(?:il)?|mei|may|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)(?:\s*(\d{4}))?\b/);
  if (!match) return null;
  const month = MONTHS[match[2]];
  if (!month) return null;
  return toDateValue(Number(match[3] || todayMalaysia().slice(0, 4)), month, Number(match[1]), !match[3]);
}

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function parsePlate(text: string) {
  const matches = [...text.toUpperCase().matchAll(/\b([A-Z]{1,3})[\s-]?(\d{1,4})[\s-]?([A-Z]{0,2})\b/g)];
  const candidate = matches.find((match) => !/^\d{1,2}(JAN|FEB|MAC|APR|MEI|JUN|JUL|OGOS|SEP|OKT|NOV|DIS)/.test(match[0]))?.[0];
  return candidate ? normalizePlate(candidate) : "";
}

function parseContactName(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  const plate = parsePlate(clean);
  const beforePlate = plate ? clean.replace(new RegExp(plate, "i"), "").trim() : clean;
  const [model, ...customerParts] = beforePlate.split(/\s*[-–—]\s*/);
  return { customerName: (customerParts.join("-") || model || "Telegram customer").trim(), carModel: customerParts.length ? model.trim() : "", plate };
}

function parseIdentity(text: string, plate: string) {
  const lines = text.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  const plateIndex = lines.findIndex((item) => normalizePlate(item).includes(plate));
  const line = plateIndex >= 0 && lines[plateIndex].replace(new RegExp(plate, "i"), "").trim()
    ? lines[plateIndex]
    : plateIndex > 0 ? lines[plateIndex - 1] : "";
  return { ...parseContactName(line ? line.replace(new RegExp(plate, "i"), "").trim() : ""), sourceLine: line };
}

function normalizeFieldLabel(value: string) {
  return value.toLowerCase().replace(/[._-]/g, " ").replace(/\s+/g, " ").trim();
}

function parseLabeledFields(text: string) {
  const fields: Record<string, string> = {};
  let current = "";
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(/^\/?\s*([^:]{2,32})\s*:\s*(.*)$/);
    const field = match ? FIELD_ALIASES[normalizeFieldLabel(match[1])] : "";
    if (field) {
      current = field;
      fields[field] = match[2].trim();
    } else if (current === "job" && !/^\/?appointment\b/i.test(line)) {
      fields.job = `${fields.job || ""} ${line}`.trim();
    }
  }
  return fields;
}

function parseTime(value: string) {
  const match = value.toLowerCase().trim().match(/\b(\d{1,2})(?:[:.]([0-5]\d))?\s*(am|pm|pagi|tengahari|tengah hari|petang|malam)?\b/);
  if (!match) return "09:00:00";
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3] || "";
  if ((period === "pm" || period === "petang" || period === "malam") && hour < 12) hour += 12;
  if ((period === "am" || period === "pagi") && hour === 12) hour = 0;
  if (period === "tengahari" || period === "tengah hari") hour = hour < 12 ? hour + 12 : hour;
  return hour >= 0 && hour <= 23 ? `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00` : "09:00:00";
}

function parseDuration(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, ".");
  const hours = normalized.match(/(\d+(?:\.\d+)?)\s*(?:jam|hour|hours)\b/);
  const minutes = normalized.match(/(\d+)\s*(?:min|mins|minute|minutes|minit)\b/);
  const total = hours || minutes
    ? Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0)
    : Number(normalized.match(/\d+/)?.[0] || 60);
  return Math.min(1440, Math.max(15, Math.round(total || 60)));
}

function parsePhone(value: string) {
  const phone = value.trim().replace(/[^\d+]/g, "");
  return /\d{7,}/.test(phone) ? phone : "";
}

function isAppointmentFieldLine(line: string) {
  const match = line.match(/^\/?\s*([^:]{2,32})\s*:/);
  return Boolean(match && FIELD_ALIASES[normalizeFieldLabel(match[1])]);
}

function extractJob(text: string, date: string | null, plate: string, contactName = "") {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => {
    if (isAppointmentFieldLine(line)) return false;
    if (date && line.toLowerCase().includes(`${Number(date.slice(8, 10))}`) && Object.keys(MONTHS).some((month) => line.toLowerCase().includes(month))) return false;
    if (plate && normalizePlate(line).includes(plate)) return false;
    if (contactName && line === contactName) return false;
    return !/^\/?appointment\b/i.test(line);
  }).join(" ").trim();
}

async function sendTelegram(token: string, chatId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function syncGoogleCalendar(supabaseUrl: string, appointmentId: string) {
  const secret = Deno.env.get("GOOGLE_CALENDAR_INTERNAL_SECRET") || Deno.env.get("TELEGRAM_WEBHOOK_SECRET") || "";
  if (!secret) return { skipped: true, reason: "internal_secret_not_configured" };
  const functionUrl = Deno.env.get("GOOGLE_CALENDAR_FUNCTION_URL") || `${supabaseUrl}/functions/v1/google-calendar-appointments`;
  const response = await fetch(functionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Secret": secret },
    body: JSON.stringify({ action: "upsert", appointment_id: appointmentId }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) throw new Error(result.error || `Google Calendar sync failed (${response.status})`);
  return result;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);

  const expectedSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
  if (!expectedSecret || request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== expectedSecret) {
    return json({ error: "Invalid webhook secret" }, 401);
  }

  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const allowedChatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!botToken || !allowedChatId || !serviceRoleKey || !supabaseUrl) return json({ error: "Function configuration is incomplete" }, 500);

  const update = await request.json().catch(() => null);
  const message = update?.message;
  if (!message?.chat?.id || String(message.chat.id) !== allowedChatId) return json({ ok: true, ignored: "chat_not_allowed" });

  const chatId = String(message.chat.id);
  const senderId = String(message.from?.id ?? "");
  const contact = message.contact;
  const messageText = String(message.text ?? message.caption ?? "").trim();
  const contactLabel = contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "";
  const db = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  if (contact && !messageText) {
    await db.from("telegram_appointment_staging").upsert({ chat_id: chatId, sender_id: senderId, contact_name: contactLabel }, { onConflict: "chat_id,sender_id" });
    await sendTelegram(botToken, chatId, "Contact diterima. Hantar tarikh dan kerja appointment dalam mesej seterusnya.");
    return json({ ok: true, staged: true });
  }
  if (!messageText) return json({ ok: true, ignored: "no_text" });

  const date = parseDate(messageText);
  const labeled = parseLabeledFields(messageText);
  const directPlate = parsePlate(messageText);
  const staging = !directPlate
    ? await db.from("telegram_appointment_staging").select("contact_name, received_at").eq("chat_id", chatId).eq("sender_id", senderId).maybeSingle()
    : { data: null };
  const parsedContact = parseContactName(staging.data?.contact_name ?? "");
  const plate = normalizePlate(labeled.plate || directPlate || parsedContact.plate);
  const directIdentity = directPlate ? parseIdentity(messageText, directPlate) : null;
  const customerName = labeled.customer?.trim() || (directPlate ? directIdentity.customerName : parsedContact.customerName);
  const carModel = labeled.model?.trim() || (directPlate ? directIdentity.carModel : parsedContact.carModel);
  const job = labeled.job?.trim() || extractJob(messageText, date, plate, directIdentity?.sourceLine ?? staging.data?.contact_name ?? "");
  const phone = parsePhone(labeled.phone || "");
  const appointmentTime = labeled.time ? parseTime(labeled.time) : "09:00:00";
  const durationMinutes = labeled.duration ? parseDuration(labeled.duration) : 60;
  if (!date || !plate || !job) {
    await sendTelegram(botToken, chatId, "Format belum lengkap. Guna template: Tarikh, Masa, Tempoh, Pelanggan, Telefon, No Plat, Model, Kerja.");
    return json({ ok: true, rejected: "incomplete" });
  }

  const sourceMessageId = String(message.message_id);
  const existing = await db.from("appointments").select("id").eq("source", "telegram").eq("source_chat_id", chatId).eq("source_message_id", sourceMessageId).maybeSingle();
  let appointmentId = existing.data?.id;
  if (!appointmentId) {
    const { data: inserted, error } = await db.from("appointments").insert({ appointment_date: date, appointment_time: appointmentTime, duration_minutes: durationMinutes, customer_name: customerName, customer_phone: phone, plate_no: plate, car_model: carModel, job_description: job, status: "Pending Review", source: "telegram", source_chat_id: chatId, source_message_id: sourceMessageId, source_update_id: update.update_id ?? null, raw_message: messageText, created_by: null }).select("id").single();
    if (error) { console.error("Appointment insert failed", error); return json({ error: "Appointment could not be saved" }, 500); }
    appointmentId = inserted.id;
  }
  await db.from("telegram_appointment_staging").delete().eq("chat_id", chatId).eq("sender_id", senderId);
  let calendarStatus = "Belum diselaraskan";
  try {
    const syncResult = await syncGoogleCalendar(supabaseUrl, appointmentId);
    calendarStatus = syncResult.synced ? "Diselaraskan ke Google Calendar" : syncResult.reason === "not_connected" ? "Google Calendar belum disambungkan" : "Menunggu konfigurasi Google Calendar";
  } catch (error) {
    calendarStatus = `Sync Google Calendar gagal: ${error instanceof Error ? error.message : String(error)}`;
  }
  await sendTelegram(botToken, chatId, `Appointment diterima\n${plate} · ${date} · ${appointmentTime.slice(0, 5)}\nStatus: Pending Review\nGoogle Calendar: ${calendarStatus}`);
  return json({ ok: true, appointment_id: appointmentId, appointment_date: date, appointment_time: appointmentTime, plate_no: plate, google_calendar: calendarStatus });
});
