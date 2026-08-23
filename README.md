# Kantin UIMSYA Putra Pro

Versi upgrade dari project `kantin-uimsya-putra-fixed`.

## Upgrade utama
- Dashboard profesional dengan KPI: pemasukan, pengeluaran, saldo kas, tabungan.
- Grafik arus kas 30 hari menggunakan Chart.js.
- Transaksi: tambah, edit, hapus, pencarian, filter jenis dan rentang tanggal.
- Laporan Harian dengan form modal dan rekap metrik.
- Buku Kas otomatis menghitung saldo berjalan.
- Tabungan dengan saldo bersih, setoran dan penarikan.
- Export CSV transaksi.
- Backup JSON seluruh data.
- Cetak laporan dengan CSS print B5.
- UI responsive desktop/tablet/HP dengan bottom navigation.
- Toast notification dan modal form.
- Supabase Auth tetap kompatibel dengan pola username@kantin-uimsya.local.
- RLS V2 menambahkan `created_by` untuk isolasi data baru per akun; data lama NULL tetap dapat diakses untuk migrasi.

## Setup
1. Isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` di `supabase.js`.
2. Jalankan seluruh `schema_putra.sql` di Supabase SQL Editor.
3. Pastikan user Auth sudah dibuat dengan email seperti `admin@kantin-uimsya.local`.
4. Deploy folder ini ke Netlify/GitHub Pages/server statis.
5. Jangan pernah memasukkan `service_role` key ke browser.

## Catatan
Project menggunakan CDN Supabase JS dan Chart.js, jadi koneksi internet diperlukan saat aplikasi dimuat.
