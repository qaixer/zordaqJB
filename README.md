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
3. Daftar user pertama melalui app, kemudian jalankan SQL ini untuk jadikan admin:

   `update public.profiles set role = 'admin' where email = 'paan@zordaq.my';`

4. Pastikan Email Auth dikonfigurasi mengikut keperluan. Bucket private `leave-attachments` dicipta oleh migration.
5. Isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dalam env hosting.

## Deploy Vercel atau Netlify

Build command: `npm run build`  
Output directory: `dist`  
Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

Untuk SPA fallback, Vercel akan guna `vercel.json` jika ditambah kemudian; Netlify boleh guna `_redirects` dengan kandungan `/* /index.html 200`.

## Nota operasi

- Semua masa disimpan sebagai `timestamptz` dan dipaparkan dalam `Asia/Kuala_Lumpur`.
- Staff hanya melihat rekod sendiri. Admin melihat semua rekod.
- Clock in/out memerlukan lokasi dalam radius workshop.
- Setiap override attendance perlu sebab dan ditanda `Diedit oleh admin`.
- Job Card boleh ditambah sebagai modul baharu tanpa mengubah aliran auth asas.
