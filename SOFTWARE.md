# Zordaq Motorsports JB

## Keputusan Penting

| Tarikh | Keputusan | Sebab |
| --- | --- | --- |
| 2026-11-22 | Bina PWA mobile-first untuk login, kehadiran GPS, cuti MC/EL, dan paparan admin. | Ini ialah aliran kerja berulang yang perlukan rekod tunggal, kawalan akses, kelulusan, dan audit. |
| 2026-11-22 | Guna React + Vite + Tailwind dengan Supabase Auth, Postgres, RLS, dan Storage. | Selari dengan stack diminta dan mudah disambung kepada modul Job Card kemudian. |
| 2026-11-22 | Logo lebar digunakan sebagai identiti utama; logo bulat digunakan sebagai ikon PWA. | Logo lebar lebih jelas pada header, logo bulat lebih sesuai untuk ikon aplikasi. |
| 2026-11-22 | Vercel/Netlify-neutral; konfigurasi build kekal boleh deploy ke kedua-duanya. | Pengguna meminta kedua-dua sasaran deployment tanpa mengikat projek kepada vendor tertentu. |

## Update Projek

### 2026-11-22 — Asas projek dimulakan

- Aliran V1: staff login → clock in/out berasaskan radius GPS → mohon/cancel cuti; admin urus staff, tetapan lokasi, rekod attendance, cuti, dan eksport CSV.
- Langkah yang kekal manual: admin semak koordinat awal workshop dan keputusan pengecualian GPS; sistem merekod sebab serta audit trail.
- Analytics V1: kehadiran, jam kerja, MC/EL, ketidakhadiran, dan baki cuti untuk bantu owner buat keputusan staffing dan follow-up.
