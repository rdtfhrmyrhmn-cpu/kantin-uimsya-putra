# PANDUAN SETUP KANTIN UIMSYA PUTRA

## Supabase
Jika `kantin_data` sudah ada, tambahkan unit:

```sql
alter table kantin_data add column if not exists unit text default 'putri';
update kantin_data set unit='putri' where unit is null;
alter table kantin_data alter column unit set not null;
create index if not exists kantin_data_unit_tgl_idx on kantin_data(unit,tgl);
```

Jika tabel belum ada:
```sql
create extension if not exists pgcrypto;
create table kantin_data(id uuid default gen_random_uuid() primary key,record_id text unique not null,unit text not null default 'putri',tipe text not null,tgl text not null,data jsonb not null,updated_at timestamptz default now());
```

Aplikasi Putra selalu memakai `unit='putra'`. Jangan hapus data Putri. Aktifkan RLS dan buat policy sesuai kebutuhan login. Jangan masukkan service_role key ke frontend.

## supabase.js
Isi URL dan publishable/anon key dari Supabase Project Settings > API.

## Auth
Buat user Auth dengan email internal, misalnya `admin@kantin-uimsya.local`. Login di website cukup memakai username `admin` dan password.

## Lokal
Jangan membuka HTML dengan `file://`. Gunakan Live Server atau `python -m http.server 5500` lalu buka `http://localhost:5500`.

## Deploy
Upload folder ini ke repository GitHub baru `kantin-uimsya-putra`, lalu Netlify > Import existing project > pilih repository > publish directory `.` > Deploy.

## Fitur
Login, Beranda, Ringkasan, Transaksi, Buku Kas, Laporan Harian, Piutang, Hutang, Persediaan, Pemasok, Tabungan, Dashboard 1/3/6/12/24 bulan, CSV UTF-8 BOM, cetak B5, ganti password, responsive, dan Jumat otomatis libur.
