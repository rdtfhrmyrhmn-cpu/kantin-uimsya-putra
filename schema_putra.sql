-- KANTIN UIMSYA PUTRA PRO - DATABASE V2
create extension if not exists pgcrypto;

create table if not exists public.putra_transaksi(
  id uuid primary key default gen_random_uuid(),
  unit text not null default 'putra',
  tanggal date not null,
  no_transaksi text unique not null,
  jenis text not null check(jenis in('pemasukan','pengeluaran')),
  kategori text not null,
  akun text not null,
  nominal numeric not null default 0 check(nominal >= 0),
  keterangan text,
  created_at timestamptz default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.putra_laporan_harian(
  id uuid primary key default gen_random_uuid(),
  unit text not null default 'putra',
  tanggal date not null,
  pendapatan_i numeric default 0,
  pendapatan_ii numeric default 0,
  titipan_i numeric default 0,
  titipan_ii numeric default 0,
  titipan_iii numeric default 0,
  tabungan numeric default 0,
  total numeric default 0,
  created_at timestamptz default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.putra_tabungan(
  id uuid primary key default gen_random_uuid(),
  unit text not null default 'putra',
  tanggal date not null,
  jenis text not null check(jenis in('setoran','penarikan')),
  nominal numeric not null default 0 check(nominal >= 0),
  keterangan text,
  created_at timestamptz default now(),
  created_by uuid default auth.uid()
);

-- Aman dijalankan pada database versi lama.
alter table public.putra_transaksi add column if not exists created_by uuid default auth.uid();
alter table public.putra_laporan_harian add column if not exists created_by uuid default auth.uid();
alter table public.putra_tabungan add column if not exists created_by uuid default auth.uid();

create index if not exists idx_putra_transaksi_tanggal on public.putra_transaksi(tanggal desc);
create index if not exists idx_putra_transaksi_jenis on public.putra_transaksi(jenis);
create index if not exists idx_putra_transaksi_created_by on public.putra_transaksi(created_by);
create index if not exists idx_putra_harian_tanggal on public.putra_laporan_harian(tanggal desc);
create index if not exists idx_putra_tabungan_tanggal on public.putra_tabungan(tanggal desc);

alter table public.putra_transaksi enable row level security;
alter table public.putra_laporan_harian enable row level security;
alter table public.putra_tabungan enable row level security;

drop policy if exists "putra transaksi auth" on public.putra_transaksi;
drop policy if exists "putra laporan auth" on public.putra_laporan_harian;
drop policy if exists "putra tabungan auth" on public.putra_tabungan;
drop policy if exists "putra transaksi owner" on public.putra_transaksi;
drop policy if exists "putra laporan owner" on public.putra_laporan_harian;
drop policy if exists "putra tabungan owner" on public.putra_tabungan;

-- Baris lama yang created_by masih NULL tetap terbaca agar migrasi tidak memutus data lama.
create policy "putra transaksi owner" on public.putra_transaksi
for all to authenticated
using (unit='putra' and (created_by is null or created_by=auth.uid()))
with check (unit='putra' and (created_by is null or created_by=auth.uid()));

create policy "putra laporan owner" on public.putra_laporan_harian
for all to authenticated
using (unit='putra' and (created_by is null or created_by=auth.uid()))
with check (unit='putra' and (created_by is null or created_by=auth.uid()));

create policy "putra tabungan owner" on public.putra_tabungan
for all to authenticated
using (unit='putra' and (created_by is null or created_by=auth.uid()))
with check (unit='putra' and (created_by is null or created_by=auth.uid()));

-- Catatan: untuk multi-operator penuh, setelah seluruh data lama dipetakan ke user,
-- Anda dapat menghapus pengecualian created_by is null pada tiga policy di atas.
