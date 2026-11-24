# Zordaq Motorsports JB

## Keputusan Penting

| Tarikh | Keputusan | Sebab |
| --- | --- | --- |
| 2026-11-22 | Bina PWA mobile-first untuk login, kehadiran GPS, cuti MC/EL, dan paparan admin. | Ini ialah aliran kerja berulang yang perlukan rekod tunggal, kawalan akses, kelulusan, dan audit. |
| 2026-11-22 | Guna React + Vite + Tailwind dengan Supabase Auth, Postgres, RLS, dan Storage. | Selari dengan stack diminta dan mudah disambung kepada modul Job Card kemudian. |
| 2026-11-22 | Logo lebar digunakan sebagai identiti utama; logo bulat digunakan sebagai ikon PWA. | Logo lebar lebih jelas pada header, logo bulat lebih sesuai untuk ikon aplikasi. |
| 2026-11-22 | Vercel/Netlify-neutral; konfigurasi build kekal boleh deploy ke kedua-duanya. | Pengguna meminta kedua-dua sasaran deployment tanpa mengikat projek kepada vendor tertentu. |

## Update Projek

### 2026-11-23 — Production deploy

- Deploy production Vercel berjaya dan domain utama ialah https://www.zordaqjb.my.
- HTTP 200, app shell, tajuk aplikasi, dan login screen LIVE disahkan melalui browser.
- Env Supabase production digunakan melalui `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY`; login staff/admin sebenar masih perlu diuji dengan akaun operasi sebenar.

### 2026-11-23 — English PWA production update

- UI production ditukar kepada English dan background image login dibuang; tona navy dikekalkan.
- PWA manifest production disahkan menggunakan `display: standalone` supaya pemasangan Chrome membuka app window, bukan shortcut URL.
- Frontend redeploy ke Vercel dan Edge Function `invite-staff` aktif dengan JWT verification.
- Tambah Edge Function `admin-update-password` dengan JWT verification untuk reset password staff oleh admin.

### 2026-11-23 — Password management

- Semua user boleh menukar password sendiri melalui menu `Account` selepas mengesahkan current password.
- Admin boleh menetapkan password staff dari dialog `Edit staff`; password diproses server-side melalui Supabase Edge Function.

### 2026-11-24 — Staff boleh tambah Job Card

- Semua user yang telah login boleh buka `Job Cards` dan tambah rekod baharu.
- Staff baharu akan ditetapkan sebagai `assigned_staff` secara lalai; admin masih boleh urus assignment, parts, dan medan admin.
- RLS ditambah supaya user authenticated boleh mencipta kenderaan, Job Card miliknya, serta work items untuk Job Card yang dicipta.
- Smoke test demo staff lulus dan frontend production dideploy ke https://www.zordaqjb.my.

### 2026-11-24 — Semua user boleh edit Job Card dengan audit trail

- Semua user authenticated boleh edit detail, work items, parts dan foto Job Card.
- Tambah `job_card_audit_log` dengan database trigger untuk merekod action, field yang berubah, nilai lama/baharu, user editor dan masa Malaysia.
- Smoke test edit + `Edit history` lulus; migration audit dan frontend production dideploy ke https://www.zordaqjb.my.

### 2026-11-24 — Admin boleh masukkan cuti staff

- Tambah borang `Add leave for staff` dalam `Leave Requests` untuk admin memilih staff aktif, MC/EL, tarikh, sebab, status dan remark.
- Baki cuti disemak sebelum rekod Pending atau Approved disimpan; rekod Rejected tidak menggunakan baki.
- Smoke test admin lulus dan frontend production dideploy ke https://www.zordaqjb.my.

### 2026-11-23 — Admin boleh edit detail staff

- Tambah butang `Edit` pada senarai Kakitangan untuk ubah nama penuh dan nama panggilan.
- Simpan ke `profiles` dengan RLS admin sedia ada; email login dikunci supaya profil Auth tidak lari daripada rekod login.

### 2026-11-23 — Jemputan staff melalui email

- Buang menu daftar staff dari halaman login utama.
- Tambah ruang `Jemput staff` di menu Kakitangan untuk admin memasukkan email dan menghantar link pendaftaran.
- Tambah skrin penerima jemputan untuk melengkapkan nama penuh, nama panggilan, dan kata laluan.
- Tambah Edge Function server-side supaya `service_role` tidak pernah dihantar ke browser; hanya admin aktif boleh menghantar jemputan.

### 2026-11-22 — Asas projek dimulakan

- Aliran V1: staff login → clock in/out berasaskan radius GPS → mohon/cancel cuti; admin urus staff, tetapan lokasi, rekod attendance, cuti, dan eksport CSV.
- Langkah yang kekal manual: admin semak koordinat awal workshop dan keputusan pengecualian GPS; sistem merekod sebab serta audit trail.
- Analytics V1: kehadiran, jam kerja, MC/EL, ketidakhadiran, dan baki cuti untuk bantu owner buat keputusan staffing dan follow-up.
