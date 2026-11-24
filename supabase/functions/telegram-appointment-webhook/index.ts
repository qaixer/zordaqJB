import { createClient } from "npm:@supabase/supabase-js@2";

const MONTHS: Record<string, number> = {
  jan: 1, januari: 1, feb: 2, februari: 2, mac: 3, march: 3,
  apr: 4, april: 4, mei: 5, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, ogos: 8, aug: 8, august: 8, sep: 9, september: 9,
  okt: 10, october: 10, oktober: 10, nov: 11, november: 11, dis: 12, december: 12,
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

function parseDate(text: string) {
  const match = text.toLowerCase().match(/\b(\d{1,2})\s*(jan(?:uari)?|feb(?:ruari)?|mac|mar(?:ch)?|apr(?:il)?|mei|may|jun(?:e)?|jul(?:y)?|ogos|aug(?:ust)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|dis(?:ember)?|dec(?:ember)?)(?:\s*(\d{4}))?\b/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2]];
  if (!month) return null;
  let year = match[3] ? Number(match[3]) : Number(todayMalaysia().slice(0, 4));
  const candidate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (!match[3] && candidate < todayMalaysia()) year += 1;
  const result = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const valid = new Date(`${result}T00:00:00Z`);
  return valid.getUTCFullYear() === year && valid.getUTCMonth() + 1 === month && valid.getUTCDate() === day ? result : null;
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

function extractJob(text: string, date: string | null, plate: string, contactName = "") {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => {
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
  const directPlate = parsePlate(messageText);
  const staging = !directPlate
    ? await db.from("telegram_appointment_staging").select("contact_name, received_at").eq("chat_id", chatId).eq("sender_id", senderId).maybeSingle()
    : { data: null };
  const parsedContact = parseContactName(staging.data?.contact_name ?? "");
  const plate = directPlate || parsedContact.plate;
  const directIdentity = directPlate ? parseIdentity(messageText, directPlate) : null;
  const customerName = directPlate ? directIdentity.customerName : parsedContact.customerName;
  const carModel = directPlate ? directIdentity.carModel : parsedContact.carModel;
  const job = extractJob(messageText, date, plate, directIdentity?.sourceLine ?? staging.data?.contact_name ?? "");
  if (!date || !plate || !job) {
    await sendTelegram(botToken, chatId, "Format belum lengkap. Sila hantar: Tarikh + contact/plate + kerja appointment.");
    return json({ ok: true, rejected: "incomplete" });
  }

  const sourceMessageId = String(message.message_id);
  const existing = await db.from("appointments").select("id").eq("source", "telegram").eq("source_chat_id", chatId).eq("source_message_id", sourceMessageId).maybeSingle();
  if (!existing.data) {
    const { error } = await db.from("appointments").insert({ appointment_date: date, customer_name: customerName, plate_no: plate, car_model: carModel, job_description: job, status: "Pending Review", source: "telegram", source_chat_id: chatId, source_message_id: sourceMessageId, source_update_id: update.update_id ?? null, raw_message: messageText, created_by: null });
    if (error) { console.error("Appointment insert failed", error); return json({ error: "Appointment could not be saved" }, 500); }
  }
  await db.from("telegram_appointment_staging").delete().eq("chat_id", chatId).eq("sender_id", senderId);
  await sendTelegram(botToken, chatId, `Appointment diterima\n${plate} · ${date}\nStatus: Pending Review`);
  return json({ ok: true, appointment_date: date, plate_no: plate });
});
