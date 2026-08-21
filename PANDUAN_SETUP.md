# KANTIN UIMSYA PUTRA — PANDUAN SETUP

> Paket ini dipisahkan dari website Putri. Gunakan project/database Supabase PUTRA sendiri.

# Panduan Setup Kantin Uimsya Putra — Supabase + Netlify

Dokumen ini untuk menyiapkan versi web tanpa framework. Struktur folder yang disarankan:

```text
kantin-uimsya-web/
├── index.html           # file login milik Anda
├── supabase.js          # file koneksi + Auth milik Anda
├── app.html
├── app.js
├── home.js
├── style.css
├── netlify.toml
├── PANDUAN_SETUP.md
└── assets/
    └── logo.png
```

## 1. Siapkan Supabase

Buat project baru di Supabase. Untuk browser, gunakan **publishable key/anon key**, bukan `service_role`. Supabase JS memang dirancang dapat digunakan dari browser, tetapi tabel/function tetap harus dilindungi dengan RLS dan privilege yang tepat. Lihat dokumentasi resmi Supabase untuk inisialisasi client dan Data API. 

Setelah project jadi, buka **SQL Editor**.

> Catatan penting tentang autentikasi: file `app.js` menggunakan `supabase.auth` untuk session dan ganti password. Jadi `index.html` sebaiknya login melalui Supabase Auth, bukan membaca `kantin_users.password_hash` langsung dari browser. Ini jauh lebih aman daripada membuka hash password ke role `anon`.

## 2. Buat tabel utama

Jalankan SQL berikut:

```sql
create extension if not exists pgcrypto;

create table if not exists public.kantin_data (
  id uuid default gen_random_uuid() primary key,
  record_id text unique not null,
  tipe text not null check (tipe in ('harian','pengeluaran','penarikan')),
  tgl text not null,
  data jsonb not null,
  updated_at timestamptz default now()
);
```

Tabel user lama Anda tetap bisa dipertahankan, tetapi jangan digunakan sebagai tempat login browser bila Anda sudah memakai Supabase Auth:

```sql
create table if not exists public.kantin_users (
  id uuid default gen_random_uuid() primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz default now()
);
```

Untuk implementasi yang lebih rapi, username dapat disimpan di metadata Auth atau di tabel profil yang terkait dengan `auth.users.id`.

## 3. Aktifkan RLS

Minimal untuk data utama:

```sql
alter table public.kantin_data enable row level security;

create policy "kantin_data_select_authenticated"
on public.kantin_data
for select
to authenticated
using (true);

create policy "kantin_data_insert_authenticated"
on public.kantin_data
for insert
 to authenticated
with check (true);

create policy "kantin_data_update_authenticated"
on public.kantin_data
for update
 to authenticated
using (true)
with check (true);

create policy "kantin_data_delete_authenticated"
on public.kantin_data
for delete
 to authenticated
using (true);
```

Grant Data API setelah RLS/policy siap bila project Anda memerlukan grant eksplisit:

```sql
grant select, insert, update, delete on public.kantin_data to authenticated;
```

**Jangan** memberi `select` anonim ke `kantin_users` hanya untuk membuat login username/password bekerja. Itu akan membuat hash password dapat dibaca client.

## 4. Konfigurasi Supabase Auth

Buka **Authentication → Providers → Email** dan pastikan Email provider aktif.

Aplikasi ini menggunakan Supabase Auth untuk:

- session login
- persist session di browser
- logout
- ganti password melalui `supabase.auth.updateUser({ password })`

Jika sistem Anda memang ingin login dengan **username** dan bukan alamat email, ada dua pendekatan aman:

### Opsi A — mapping username ke email Auth

Simpan username di `user_metadata`, tetapi akun Auth tetap menggunakan email internal yang tidak dibagikan di UI.

Contoh metadata user:

```json
{
  "username": "kantin_putri"
}
```

Kemudian `index.html` dapat melakukan mapping username → email internal sebelum `signInWithPassword`.

### Opsi B — gunakan Edge Function untuk login username/password

Edge Function menerima username/password lalu melakukan verifikasi server-side. Ini paling cocok bila Anda harus benar-benar mempertahankan tabel `kantin_users` sebagai sumber autentikasi.

Untuk versi ringan/operasional internal, Opsi A biasanya paling sederhana.

## 5. Pastikan `supabase.js` kompatibel

`app.html` akan memuat `supabase.js` setelah CDN Supabase JS.

File `supabase.js` harus menghasilkan salah satu global berikut:

```js
window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
```

atau:

```js
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
```

**Jangan** menaruh `service_role key` di `supabase.js`, karena file ini dikirim ke browser.

## 6. Login dari `index.html`

Karena `app.js` memeriksa:

```js
await supabaseClient.auth.getSession();
```

maka setelah login berhasil, Supabase Auth harus mempunyai session.

Pola login dasar:

```js
const { data, error } = await supabaseClient.auth.signInWithPassword({
  email,
  password
});

if (error) throw error;

window.location.href = 'app.html';
```

Jika Anda sudah mempunyai `index.html` + `supabase.js`, tidak perlu mengganti seluruh desain login; cukup pastikan login menghasilkan session Supabase Auth.

## 7. Upload file

Pastikan `logo.png` berada di:

```text
assets/logo.png
```

Kemudian folder proyek harus berisi:

```text
index.html
supabase.js
app.html
app.js
home.js
style.css
netlify.toml
PANDUAN_SETUP.md
assets/logo.png
```

## 8. Jalankan lokal

Karena aplikasi memakai module/API browser dan Supabase, lebih aman menjalankannya melalui local web server daripada membuka `file://` langsung.

Dengan Python:

```bash
python -m http.server 5500
```

Buka:

```text
http://localhost:5500/
```

Atau gunakan extension Live Server di VS Code.

## 9. Deploy Netlify

Cara paling mudah:

1. Buat repository GitHub dan upload semua file.
2. Buka Netlify.
3. Pilih **Add new project / Import an existing project**.
4. Pilih GitHub repository.
5. Karena ini website statis tanpa proses build, `netlify.toml` menggunakan root (`.`) sebagai publish directory.
6. Deploy site.
7. Setelah deploy selesai, buka domain Netlify dan tes login.

Netlify mendukung konfigurasi routing/header melalui `netlify.toml`; file yang disediakan di paket ini juga menambahkan rewrite `/app` ke `app.html`. 

## 10. Checklist setelah deploy

- Login berhasil dan session tetap ada ketika halaman di-refresh.
- Laporan harian dapat disimpan.
- Tanggal Jumat otomatis nonaktif.
- Pengeluaran dapat disimpan dan dihapus.
- Setoran tabungan berasal dari field **Tabungan** pada laporan harian.
- Penarikan tidak dapat melebihi saldo tabungan.
- Dashboard 1 bulan, 3 bulan, 6 bulan, 1 tahun, dan 2 tahun berubah sesuai tanggal.
- CSV dapat diunduh.
- Cetak B5 membuka dialog print dengan ukuran B5 portrait.
- Ganti password berhasil.
- Tombol Keluar mengakhiri Supabase Auth session.

## 11. Struktur data yang disimpan

### Laporan harian

`tipe = harian`

```json
{
  "pendI": 100000,
  "pendII": 50000,
  "titipI": 10000,
  "titipII": 5000,
  "titipIII": 0,
  "tabungan": 5000
}
```

Total dihitung di frontend dengan rumus:

```text
(Pend. I + Pend. II)
- Titipan I
- Titipan II
- Titipan III
- Tabungan
```

### Pengeluaran

`tipe = pengeluaran`

```json
{
  "jumlah": 25000,
  "keterangan": "Belanja stok"
}
```

### Penarikan

`tipe = penarikan`

```json
{
  "jumlah": 50000,
  "keterangan": "Kebutuhan operasional"
}
```

## 12. Catatan keamanan penting

Frontend statis di Netlify aman untuk menyimpan URL project Supabase + publishable/anon key karena key tersebut memang ditujukan untuk sisi client. Keamanan sebenarnya datang dari **RLS**, policy, dan autentikasi. Jangan pernah memasukkan service-role key ke HTML/JS yang di-deploy.

Untuk data finansial yang sensitif, gunakan Auth + RLS dengan policy yang lebih ketat lagi berdasarkan user/role, misalnya setiap row memiliki `owner_id = auth.uid()` dan hanya user terkait yang dapat membaca/mengubah row tersebut.
