const P = {
  home: 'Beranda',
  transactions: 'Transaksi',
  daily: 'Laporan Harian',
  cashbook: 'Buku Kas',
  savings: 'Tabungan',
  summary: 'Ringkasan',
  reports: 'Laporan'
};

const $ = (s) => document.querySelector(s);
const money = (n) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(n) || 0);

const esc = (v) =>
  String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

function today() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function isFriday(value) {
  return new Date(`${value}T00:00:00`).getDay() === 5;
}

function table(headers, rows, empty = 'Belum ada data.') {
  if (!rows.length) {
    return `<div class="empty">${esc(empty)}</div>`;
  }
  return `<div class="table"><table>
    <thead><tr>${headers.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((x) => `<td>${x ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

function toast(message, type = 'info') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = `toast ${type}`;
  el.textContent = message;
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.remove(), 4500);
}

function showError(message) {
  toast(message, 'error');
}

function showSuccess(message) {
  toast(message, 'success');
}

function errorText(error) {
  if (!error) return 'Terjadi kesalahan yang tidak diketahui.';
  if (error.message) return error.message;
  return String(error);
}

function requireSupabase() {
  if (!window.supabaseClient) {
    throw new Error(
      'Supabase belum dikonfigurasi. Buka supabase.js lalu isi SUPABASE_URL dan SUPABASE_ANON_KEY.'
    );
  }
}

async function safeQuery(queryPromise) {
  const result = await queryPromise;
  if (result.error) throw result.error;
  return result.data ?? [];
}

async function start() {
  try {
    requireSupabase();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) {
      location.href = 'index.html';
      return;
    }

    $('#nav').innerHTML = Object.entries(P)
      .map(([k, v]) => `<button type="button" data-p="${k}">${esc(v)}</button>`)
      .join('');

    $('#bottom').innerHTML = ['home', 'transactions', 'daily', 'savings', 'summary', 'reports']
      .map((k) => `<button type="button" data-p="${k}">${esc(P[k])}</button>`)
      .join('');

    document.querySelectorAll('[data-p]').forEach((b) => {
      b.addEventListener('click', () => {
        load(b.dataset.p);
        document.querySelector('aside')?.classList.remove('open');
      });
    });

    $('#logout').addEventListener('click', async () => {
      const { error } = await supabaseClient.auth.signOut();
      if (error) return showError(errorText(error));
      location.href = 'index.html';
    });

    $('#menu').addEventListener('click', () => {
      $('aside').classList.toggle('open');
    });

    await load('home');
  } catch (error) {
    $('#app').innerHTML = `<section class="card"><div class="error"><b>Aplikasi belum siap</b><p>${esc(errorText(error))}</p></div></section>`;
  }
}

async function load(p) {
  $('#title').textContent = P[p] || 'Beranda';
  try {
    if (p === 'home') return await home();
    if (p === 'transactions') return await transactions();
    if (p === 'daily') return await daily();
    if (p === 'cashbook') return await cashbook();
    if (p === 'savings') return await savings();
    if (p === 'summary') return await summary();
    if (p === 'reports') return await reports();
  } catch (error) {
    $('#app').innerHTML = `<section class="card"><div class="error"><b>Gagal memuat fitur</b><p>${esc(errorText(error))}</p><button type="button" id="retry">Coba lagi</button></div></section>`;
    $('#retry')?.addEventListener('click', () => load(p));
  }
}

async function home() {
  $('#app').innerHTML = `
    <section class="hero">
      <small>KANTIN UIMSYA PUTRA</small>
      <h1>Selamat datang 👋</h1>
      <div>${esc(new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }))}</div>
    </section>
    <div id="stats" class="grid"></div>`;

  const data = await safeQuery(
    supabaseClient.from('putra_transaksi').select('jenis,nominal')
  );

  let income = 0, expense = 0;
  data.forEach((x) => {
    if (x.jenis === 'pemasukan') income += Number(x.nominal) || 0;
    else expense += Number(x.nominal) || 0;
  });

  $('#stats').innerHTML = `
    <div class="stat"><span>Pemasukan</span><b>${money(income)}</b></div>
    <div class="stat"><span>Pengeluaran</span><b>${money(expense)}</b></div>
    <div class="stat"><span>Saldo Kas</span><b>${money(income - expense)}</b></div>`;
}

async function transactions() {
  $('#app').innerHTML = `
    <section class="card">
      <div class="section-head"><div><small>KEUANGAN</small><h2>Transaksi Kas</h2></div></div>
      <form id="transactionForm" class="form">
        <label>Tanggal<input id="date" type="date" required></label>
        <label>Jenis<select id="jenis"><option value="pemasukan">Pemasukan</option><option value="pengeluaran">Pengeluaran</option></select></label>
        <label>Kategori<select id="kat"><option>Penjualan</option><option>Pembelian</option><option>Operasional</option><option>Transportasi</option><option>Listrik</option><option>Air</option><option>Gaji</option><option>Lainnya</option></select></label>
        <label>Akun<select id="akun"><option>Kas Kantin</option><option>Bank</option></select></label>
        <label>Nominal<input id="nominal" type="number" min="1" step="1" placeholder="Rp 0" required></label>
        <label>Keterangan<input id="ket" maxlength="200" placeholder="Keterangan"></label>
        <div class="form-actions"><button type="submit">Simpan Transaksi</button></div>
      </form>
      <div id="list"></div>
    </section>`;

  $('#date').value = today();

  $('#transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = $('#date').value;
    const nominal = Number($('#nominal').value);

    if (isFriday(date)) return showError('Jumat adalah hari libur operasional.');
    if (!date) return showError('Tanggal wajib diisi.');
    if (!Number.isFinite(nominal) || nominal <= 0) return showError('Nominal harus lebih dari 0.');

    const button = e.submitter;
    button.disabled = true;
    try {
      const payload = {
        unit: 'putra',
        tanggal: date,
        jenis: $('#jenis').value,
        kategori: $('#kat').value,
        akun: $('#akun').value,
        nominal,
        keterangan: $('#ket').value.trim(),
        no_transaksi: `TRX-${Date.now()}`
      };
      const { error } = await supabaseClient.from('putra_transaksi').insert(payload);
      if (error) throw error;
      showSuccess('Transaksi berhasil disimpan.');
      await transactions();
    } catch (error) {
      showError(`Transaksi gagal disimpan: ${errorText(error)}`);
      button.disabled = false;
    }
  });

  try {
    const data = await safeQuery(
      supabaseClient.from('putra_transaksi').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false })
    );
    $('#list').innerHTML = table(
      ['Tanggal', 'No', 'Jenis', 'Kategori', 'Nominal'],
      data.map((x) => [
        esc(x.tanggal),
        esc(x.no_transaksi),
        esc(x.jenis),
        esc(x.kategori),
        money(x.nominal)
      ])
    );
  } catch (error) {
    $('#list').innerHTML = `<div class="error">Gagal memuat transaksi: ${esc(errorText(error))}</div>`;
  }
}

async function daily() {
  $('#app').innerHTML = `
    <section class="card">
      <div class="section-head"><div><small>OPERASIONAL</small><h2>Laporan Harian</h2></div></div>
      <form id="dailyForm" class="form daily-form">
        <label>Tanggal<input id="dd" type="date" required></label>
        <label>Pendapatan I<input id="p1" type="number" min="0" step="1" placeholder="0"></label>
        <label>Pendapatan II<input id="p2" type="number" min="0" step="1" placeholder="0"></label>
        <label>Titipan I<input id="t1" type="number" min="0" step="1" placeholder="0"></label>
        <label>Titipan II<input id="t2" type="number" min="0" step="1" placeholder="0"></label>
        <label>Titipan III<input id="t3" type="number" min="0" step="1" placeholder="0"></label>
        <label>Tabungan<input id="tb" type="number" min="0" step="1" placeholder="0"></label>
        <div class="form-actions"><button type="submit">Simpan Laporan</button></div>
      </form>
      <div class="formula">Total = Pendapatan I + Pendapatan II − Titipan I − Titipan II − Titipan III − Tabungan</div>
      <div id="dl"></div>
    </section>`;

  $('#dd').value = today();

  $('#dailyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = $('#dd').value;
    if (!date) return showError('Tanggal wajib diisi.');
    if (isFriday(date)) return showError('Jumat adalah hari libur operasional.');

    const n = (id) => Math.max(0, Number($(id).value) || 0);
    const payload = {
      unit: 'putra',
      tanggal: date,
      pendapatan_i: n('#p1'),
      pendapatan_ii: n('#p2'),
      titipan_i: n('#t1'),
      titipan_ii: n('#t2'),
      titipan_iii: n('#t3'),
      tabungan: n('#tb')
    };
    payload.total =
      payload.pendapatan_i +
      payload.pendapatan_ii -
      payload.titipan_i -
      payload.titipan_ii -
      payload.titipan_iii -
      payload.tabungan;

    const button = e.submitter;
    button.disabled = true;
    try {
      const { error } = await supabaseClient.from('putra_laporan_harian').insert(payload);
      if (error) throw error;
      showSuccess('Laporan harian berhasil disimpan.');
      await daily();
    } catch (error) {
      showError(`Laporan gagal disimpan: ${errorText(error)}`);
      button.disabled = false;
    }
  });

  try {
    const data = await safeQuery(
      supabaseClient.from('putra_laporan_harian').select('*').order('tanggal', { ascending: false })
    );
    $('#dl').innerHTML = table(
      ['Tanggal', 'Pend I', 'Pend II', 'Titip I', 'Titip II', 'Titip III', 'Tabungan', 'Total'],
      data.map((x) => [
        esc(x.tanggal),
        money(x.pendapatan_i),
        money(x.pendapatan_ii),
        money(x.titipan_i),
        money(x.titipan_ii),
        money(x.titipan_iii),
        money(x.tabungan),
        money(x.total)
      ])
    );
  } catch (error) {
    $('#dl').innerHTML = `<div class="error">Gagal memuat laporan: ${esc(errorText(error))}</div>`;
  }
}

async function cashbook() {
  const data = await safeQuery(
    supabaseClient.from('putra_transaksi').select('*').order('tanggal').order('created_at')
  );
  let balance = 0;
  const rows = data.map((x) => {
    const n = Number(x.nominal) || 0;
    x.jenis === 'pemasukan' ? balance += n : balance -= n;
    return [
      esc(x.tanggal),
      esc(x.no_transaksi),
      esc(x.keterangan),
      x.jenis === 'pemasukan' ? money(n) : '',
      x.jenis === 'pengeluaran' ? money(n) : '',
      money(balance)
    ];
  });

  $('#app').innerHTML = `<section class="card"><div class="section-head"><div><small>KEUANGAN</small><h2>Buku Kas</h2></div></div>${table(
    ['Tanggal', 'No', 'Keterangan', 'Masuk', 'Keluar', 'Saldo'], rows
  )}</section>`;
}

async function savings() {
  $('#app').innerHTML = `
    <section class="card">
      <div class="section-head"><div><small>SIMPANAN</small><h2>Tabungan</h2></div></div>
      <form id="savingForm" class="form">
        <label>Tanggal<input id="sd" type="date" required></label>
        <label>Jenis<select id="sj"><option value="setoran">Setoran</option><option value="penarikan">Penarikan</option></select></label>
        <label>Nominal<input id="sn" type="number" min="1" step="1" required placeholder="0"></label>
        <label>Keterangan<input id="sk" maxlength="200" placeholder="Keterangan"></label>
        <div class="form-actions"><button type="submit">Simpan</button></div>
      </form>
      <div id="sl"></div>
    </section>`;

  $('#sd').value = today();

  $('#savingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nominal = Number($('#sn').value);
    if (!Number.isFinite(nominal) || nominal <= 0) return showError('Nominal harus lebih dari 0.');

    const button = e.submitter;
    button.disabled = true;
    try {
      const { error } = await supabaseClient.from('putra_tabungan').insert({
        unit: 'putra',
        tanggal: $('#sd').value,
        jenis: $('#sj').value,
        nominal,
        keterangan: $('#sk').value.trim()
      });
      if (error) throw error;
      showSuccess('Tabungan berhasil disimpan.');
      await savings();
    } catch (error) {
      showError(`Tabungan gagal disimpan: ${errorText(error)}`);
      button.disabled = false;
    }
  });

  try {
    const data = await safeQuery(
      supabaseClient.from('putra_tabungan').select('*').order('tanggal', { ascending: false }).order('created_at', { ascending: false })
    );
    $('#sl').innerHTML = table(
      ['Tanggal', 'Jenis', 'Nominal', 'Keterangan'],
      data.map((x) => [esc(x.tanggal), esc(x.jenis), money(x.nominal), esc(x.keterangan)])
    );
  } catch (error) {
    $('#sl').innerHTML = `<div class="error">Gagal memuat tabungan: ${esc(errorText(error))}</div>`;
  }
}

async function summary() {
  const data = await safeQuery(
    supabaseClient.from('putra_transaksi').select('jenis,nominal')
  );
  let income = 0, expense = 0;
  data.forEach((x) => {
    x.jenis === 'pemasukan'
      ? income += Number(x.nominal) || 0
      : expense += Number(x.nominal) || 0;
  });

  $('#app').innerHTML = `
    <section class="card">
      <div class="section-head"><div><small>RINGKASAN</small><h2>Ringkasan Keuangan</h2></div></div>
      <div class="grid">
        <div class="stat"><span>Pemasukan</span><b>${money(income)}</b></div>
        <div class="stat"><span>Pengeluaran</span><b>${money(expense)}</b></div>
        <div class="stat"><span>Saldo</span><b>${money(income - expense)}</b></div>
      </div>
    </section>`;
}

async function reports() {
  $('#app').innerHTML = `
    <section class="card">
      <div class="section-head"><div><small>DOKUMEN</small><h2>Laporan</h2></div></div>
      <div class="report-actions">
        <button type="button" id="csv">Export CSV</button>
        <button type="button" id="printBtn">Cetak B5</button>
      </div>
      <p class="muted">Export mengambil seluruh data transaksi yang tersedia untuk akun yang sedang login.</p>
    </section>`;

  $('#printBtn').addEventListener('click', () => window.print());
  $('#csv').addEventListener('click', async () => {
    try {
      const data = await safeQuery(supabaseClient.from('putra_transaksi').select('*').order('tanggal'));
      const columns = ['tanggal', 'no_transaksi', 'jenis', 'kategori', 'akun', 'nominal', 'keterangan'];
      const out = '\ufeff' + [
        columns.join(','),
        ...data.map((x) => columns.map((k) =>
          `"${String(x[k] ?? '').replaceAll('"', '""')}"`
        ).join(','))
      ].join('\n');

      const url = URL.createObjectURL(new Blob([out], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-putra-${today()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showSuccess('CSV berhasil dibuat.');
    } catch (error) {
      showError(`Export gagal: ${errorText(error)}`);
    }
  });
}

start();
