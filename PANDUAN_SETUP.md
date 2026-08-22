# Kantin Uimsya Putra — Versi Diperbaiki

## 1. Konfigurasi Supabase
Buka `supabase.js` dan isi:

- `SUPABASE_URL` = Project URL Supabase.
- `SUPABASE_ANON_KEY` = Publishable/anon key dari Supabase.

Jangan masukkan `service_role` key ke website.

## 2. Database
Jalankan seluruh isi `schema_putra.sql` di SQL Editor Supabase.

## 3. Auth
Buat user di Supabase Authentication dengan email:
`username@kantin-uimsya.local`

Contoh:
- Username: `admin`
- Email Auth: `admin@kantin-uimsya.local`

## 4. Perbaikan pada versi ini
- Tampilan Laporan Harian sudah responsif untuk HP.
- Form tidak lagi melebar keluar layar.
- Tabel tetap bisa digeser horizontal tanpa merusak halaman.
- Error Supabase ditampilkan dengan pesan yang lebih jelas.
- Ada validasi nominal dan tanggal.
- Tombol simpan dikunci saat proses berlangsung untuk mencegah klik ganda.
- Login memiliki status proses dan pesan error.
- Logout dan navigasi lebih aman.
- Export CSV diperbaiki.
- Cetak B5 diperbaiki.
- Aplikasi menampilkan pesan konfigurasi jika Supabase belum diisi.
- HTML output tabel diamankan dari karakter HTML yang tidak diinginkan.

## 5. Deploy Netlify
Upload isi folder project ini ke repository GitHub lalu hubungkan repository tersebut ke Netlify.

File utama:
- `index.html`
- `app.html`
- `app.js`
- `style.css`
- `supabase.js`
- `schema_putra.sql`
- `netlify.toml`
