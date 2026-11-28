# Zordaq Motorsports JB

PWA mobile-first untuk kehadiran GPS dan permohonan cuti staf bengkel.

## Jalankan di komputer

1. Pasang Node.js 20 atau lebih baharu.
2. Jalankan `npm install`.
3. Salin `.env.example` kepada `.env.local` dan isi URL + anon key Supabase. Jika env belum diisi, app akan dibuka dalam **mod demo**.
4. Jalankan `npm run dev` dan buka URL yang dipaparkan.

Mod demo: `paan@zordaq.my` atau `staff@zordaq.my`, kata laluan `12345678`.

## Setup Supabase

1. Cipta projek baharu di Supabase.
2. Buka SQL Editor dan jalankan `supabase/migrations/001_initial.sql`.
3. Cipta user pertama melalui Supabase Dashboard > Authentication > Users > Add user, kemudian jalankan SQL ini untuk jadikan admin:

   `update public.profiles set role = 'admin' where email = 'paan@zordaq.my';`

4. Pastikan Email Auth dikonfigurasi mengikut keperluan. Bucket private `leave-attachments` dicipta oleh migration.
5. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` dalam env hosting. Projek lama boleh guna `VITE_SUPABASE_ANON_KEY`.
6. Deploy `supabase/functions/invite-staff/index.ts` sebagai Edge Function `invite-staff` dan `supabase/functions/admin-update-password/index.ts` sebagai `admin-update-password`. Pastikan secret function mempunyai `SUPABASE_SERVICE_ROLE_KEY` (atau `SUPABASE_SECRET_KEY`) dan jangan letak secret ini dalam frontend.
7. Untuk notification Job Card, deploy `supabase/functions/notify-telegram-ready/index.ts` sebagai `notify-telegram-ready`. Tetapkan secret Edge Function `TELEGRAM_BOT_TOKEN` kepada token bot Telegram dan `TELEGRAM_CHAT_ID` kepada ID group Telegram. Token Telegram mesti kekal sebagai secret server-side.
8. Jalankan migration `supabase/migrations/013_google_calendar.sql` selepas migration appointment.
   Selepas semua migration sehingga `014_google_calendar_private_policies.sql`, jalankan `supabase/migrations/015_move_appointment_to_job_card.sql` untuk mengaktifkan pemindahan appointment hari ini ke Job Card secara atomik.
9. Untuk Google Calendar, cipta OAuth Client ID jenis Web application dalam Google Cloud, aktifkan Google Calendar API, dan tambah redirect URI berikut:

   `https://uazvibzsttcazxdbzlwr.supabase.co/functions/v1/google-calendar-appointments?action=oauth_callback`

   Tetapkan secret Edge Function `google-calendar-appointments` berikut: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`, dan `SUPABASE_SERVICE_ROLE_KEY`. Tiga setting ini mempunyai default: `GOOGLE_OAUTH_SUCCESS_REDIRECT=https://workshop.zordaqjb.my`, `GOOGLE_CALENDAR_ID=primary`, dan `GOOGLE_CALENDAR_TIMEZONE=Asia/Kuala_Lumpur`; hanya tambahkannya jika mahu override. `GOOGLE_TOKEN_ENCRYPTION_KEY` juga wajib ditetapkan sebagai secret rawak panjang dan tidak boleh diletakkan dalam frontend.
10. Deploy function Google Calendar:

   `supabase functions deploy google-calendar-appointments --project-ref uazvibzsttcazxdbzlwr`

11. Tambah `https://workshop.zordaqjb.my/?type=invite` ke Auth > URL Configuration > Redirect URLs. Untuk keserasian domain lama, `https://www.zordaqjb.my/?type=invite` juga boleh dikekalkan. Untuk ujian tempatan, tambah `http://localhost:5175/?type=invite` juga.

### Telegram appointment → database → Google Calendar

Deploy webhook Telegram selepas migration appointment:

```bash
supabase functions deploy telegram-appointment-webhook --project-ref uazvibzsttcazxdbzlwr
```

Tetapkan secret `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, dan `SUPABASE_SERVICE_ROLE_KEY` pada function Telegram. Function boleh guna `TELEGRAM_WEBHOOK_SECRET` yang sama untuk panggilan internal; jika mahu asingkan secret, tetapkan `GOOGLE_CALENDAR_INTERNAL_SECRET` dengan nilai sama pada kedua-dua function. Webhook Telegram menggunakan URL function Google Calendar secara default; jika perlu override, tambah `GOOGLE_CALENDAR_FUNCTION_URL`.

Format posting yang disokong:

```text
/appointment
Tarikh: 28/11/2026
Masa: 10:30
Tempoh: 90 minit
Pelanggan: Ahmad bin Ali
Telefon: 012-3456789
No Plat: JQK 1234
Model: Toyota Vios
Kerja: Tukar minyak hitam dan pemeriksaan brek
```

`Tarikh` juga boleh ditulis `28 Nov 2026` atau `2026-11-28`. `Tempoh` boleh ditulis dalam minit atau jam. Format lama yang hanya mengandungi tarikh, contact/plat, dan kerja masih diterima; masa default ialah `09:00` dan tempoh default ialah `60` minit. Selepas rekod masuk, webhook akan cuba sync terus ke Google Calendar dan membalas status sync dalam Telegram.

### Deploy Edge Function jemputan

Gunakan Supabase CLI yang telah login:

```bash
supabase functions deploy invite-staff --project-ref uazvibzsttcazxdbzlwr
supabase functions deploy admin-update-password --project-ref uazvibzsttcazxdbzlwr
```

Function ini mengesahkan sesi pemanggil dan peranan admin sebelum memanggil `inviteUserByEmail`. Link email akan membuka skrin lengkapkan nama, nama panggilan, dan kata laluan staff.

## Deploy Vercel atau Netlify

Build command: `npm run build`  
Output directory: `dist`  
Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` atau `VITE_SUPABASE_ANON_KEY`

Untuk SPA fallback, Vercel akan guna `vercel.json` jika ditambah kemudian; Netlify boleh guna `_redirects` dengan kandungan `/* /index.html 200`.

## Nota operasi

- Semua masa disimpan sebagai `timestamptz` dan dipaparkan dalam `Asia/Kuala_Lumpur`.
- Staff hanya melihat rekod sendiri. Admin melihat semua rekod.
- Clock in/out memerlukan lokasi dalam radius workshop.
- Setiap override attendance perlu sebab dan ditanda `Diedit oleh admin`.
- Semua user yang login boleh tambah Job Card; staff mula dengan tugasan kepada dirinya sendiri.
- Semua user authenticated boleh edit semua maklumat Job Card, termasuk items, parts dan foto.
- Setiap perubahan direkod dalam `job_card_audit_log` bersama nama user dan masa Malaysia.
- Admin boleh masukkan rekod cuti bagi pihak staff dengan status Pending, Approved, atau Rejected.
- Job Card boleh ditambah sebagai modul baharu tanpa mengubah aliran auth asas.
