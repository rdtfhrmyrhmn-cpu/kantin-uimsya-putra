// ─── NAVIGASI ────────────────────────────────────────────────────────────────
const P = {
  home:         'Beranda',
  transactions: 'Transaksi',
  daily:        'Laporan Harian',
  cashbook:     'Buku Kas',
  savings:      'Tabungan',
  kategori:     'Rekap Kategori',   // BARU
  summary:      'Ringkasan',
  reports:      'Laporan'
};

// ─── UTILITAS ─────────────────────────────────────────────────────────────────
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
  if (!rows.length) return `<div class="empty">${esc(empty)}</div>`;
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

function showError(message)   { toast(message, 'error'); }
function showSuccess(message) { toast(message, 'success'); }

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

// ─── START ────────────────────────────────────────────────────────────────────
async function start() {
  try {
    requireSupabase();
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) { location.href = 'index.html'; return; }

    // Sidebar nav (semua halaman)
    $('#nav').innerHTML = Object.entries(P)
      .map(([k, v]) => `<button type="button" data-p="${k}">${esc(v)}</button>`)
      .join('');

    // Bottom nav mobile (6 item paling sering dipakai)
    $('#bottom').innerHTML = ['home', 'transactions', 'daily', 'savings', 'kategori', 'reports']
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

    $('#menu').addEventListener('click', () => $('aside').classList.toggle('open'));

    await load('home');
  } catch (error) {
    $('#app').innerHTML = `<section class="card"><div class="error"><b>Aplikasi belum siap</b><p>${esc(errorText(error))}</p></div></section>`;
  }
}

async function load(p) {
  $('#title').textContent = P[p] || 'Beranda';

  // Hancurkan chart sebelumnya agar tidak konflik dengan Chart.js
  if (window.__chartInstance) {
    window.__chartInstance.destroy();
    window.__chartInstance = null;
  }

  try {
    if (p === 'home')         return await home();
    if (p === 'transactions') return await transactions();
    if (p === 'daily')        return await daily();
    if (p === 'cashbook')     return await cashbook();
    if (p === 'savings')      return await savings();
    if (p === 'kategori')     return await categoryBreakdown(); // BARU
    if (p === 'summary')      return await summary();
    if (p === 'reports')      return await reports();
  } catch (error) {
    $('#app').innerHTML = `<section class="card"><div class="error"><b>Gagal memuat fitur</b><p>${esc(errorText(error))}</p><button type="button" id="retry">Coba lagi</button></div></section>`;
    $('#retry')?.addEventListener('click', () => load(p));
  }
}

// ─── BERANDA — dengan Grafik Tren + Target Bulanan ───────────────────────────
async function home() {
  $('#app').innerHTML = `
    <section class="hero">
      <small>KANTIN UIMSYA PUTRA</small>
      <h1>Selamat datang 👋</h1>
      <div>${esc(new Date().toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' }))}</div>
    </section>

    <div id="stats" class="grid"></div>

    <section class="card">
      <div class="section-head">
        <div><small>TREN</small><h2>Grafik Keuangan</h2></div>
        <select id="chartRange" style="width:auto">
          <option value="6">6 Bulan</option>
          <option value="3">3 Bulan</option>
          <option value="12">12 Bulan</option>
        </select>
      </div>
      <div class="chart-wrap"><canvas id="trendChart"></canvas></div>
    </section>

    <section class="card">
      <div class="section-head">
        <div><small>TARGET</small><h2>Target Pemasukan Bulan Ini</h2></div>
        <button type="button" id="editTargetBtn">Ubah Target</button>
      </div>
      <div id="targetContent"></div>
    </section>`;

  // Ambil semua data transaksi
  const data = await safeQuery(
    supabaseClient.from('putra_transaksi').select('tanggal,jenis,nominal')
  );

  // ── Stat total ──
  let totalIncome = 0, totalExpense = 0;
  data.forEach((x) => {
    if (x.jenis === 'pemasukan') totalIncome  += Number(x.nominal) || 0;
    else                         totalExpense += Number(x.nominal) || 0;
  });

  $('#stats').innerHTML = `
    <div class="stat"><span>Pemasukan</span><b>${money(totalIncome)}</b></div>
    <div class="stat"><span>Pengeluaran</span><b>${money(totalExpense)}</b></div>
    <div class="stat"><span>Saldo Kas</span><b>${money(totalIncome - totalExpense)}</b></div>`;

  // ── Grafik tren ──
  function renderChart(nMonths) {
    if (window.__chartInstance) {
      window.__chartInstance.destroy();
      window.__chartInstance = null;
    }

    // Kelompokkan per bulan
    const byMonth = {};
    data.forEach(x => {
      const m = x.tanggal.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { pemasukan: 0, pengeluaran: 0 };
      byMonth[m][x.jenis] += Number(x.nominal) || 0;
    });

    const months = Object.keys(byMonth).sort().slice(-nMonths);
    if (!months.length) {
      const canvas = $('#trendChart');
      if (canvas) canvas.closest('.card').querySelector('h2').insertAdjacentHTML(
        'afterend', '<p class="muted">Belum ada data transaksi untuk ditampilkan.</p>'
      );
      return;
    }

    if (typeof Chart === 'undefined') return; // Chart.js belum load

    const labels = months.map(m => {
      const [y, mo] = m.split('-');
      return new Date(y, mo - 1).toLocaleString('id-ID', { month: 'short', year: '2-digit' });
    });

    window.__chartInstance = new Chart($('#trendChart'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Pemasukan',
            data: months.map(m => byMonth[m]?.pemasukan || 0),
            backgroundColor: '#4a8c5c',
            borderRadius: 6
          },
          {
            label: 'Pengeluaran',
            data: months.map(m => byMonth[m]?.pengeluaran || 0),
            backgroundColor: '#c0392b',
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${money(ctx.raw)}`
            }
          }
        },
        scales: {
          y: {
            ticks: { callback: v => `${(v / 1000000).toFixed(0)}jt` },
            grid: { color: '#d8e4d5' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  renderChart(6);
  $('#chartRange')?.addEventListener('change', (e) => renderChart(Number(e.target.value)));

  // ── Target bulanan ──
  const TARGET_KEY = 'target_bulanan_putra';
  let target = Number(localStorage.getItem(TARGET_KEY)) || 0;

  function renderTarget() {
    const currentMonth = today().slice(0, 7);
    const monthIncome = data
      .filter(x => x.jenis === 'pemasukan' && x.tanggal.startsWith(currentMonth))
      .reduce((s, x) => s + (Number(x.nominal) || 0), 0);

    if (!target) {
      $('#targetContent').innerHTML = `<p class="muted">Belum ada target. Klik "Ubah Target" untuk menetapkan target pemasukan bulan ini.</p>`;
      return;
    }

    const pct = Math.min(100, Math.round(monthIncome / target * 100));
    const color = pct >= 100 ? '#4a8c5c' : pct >= 70 ? '#738a6e' : '#c0392b';
    const msg   = pct >= 100
      ? '🎉 Target bulan ini sudah tercapai!'
      : `Sisa ${money(target - monthIncome)} lagi untuk mencapai target.`;

    $('#targetContent').innerHTML = `
      <div class="target-info">
        <span class="muted">${money(monthIncome)} dari ${money(target)}</span>
        <b style="color:${color}">${pct}%</b>
      </div>
      <div class="progress-bg">
        <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
      </div>
      <p class="muted" style="margin-top:8px;font-size:13px">${msg}</p>`;
  }

  renderTarget();

  $('#editTargetBtn').addEventListener('click', () => {
    const val = prompt('Masukkan target pemasukan bulan ini (angka tanpa titik/koma):', target || '');
    if (val === null) return;
    const n = Number(String(val).replace(/[^0-9]/g, ''));
    if (!Number.isFinite(n) || n < 0) return showError('Nominal tidak valid.');
    localStorage.setItem(TARGET_KEY, n);
    target = n;
    renderTarget();
    showSuccess('Target berhasil diperbarui.');
  });
}

// ─── TRANSAKSI — dengan Filter Bulan/Jenis/Cari + Hapus ─────────────────────
async function transactions() {
  const thisMonth = today().slice(0, 7);

  $('#app').innerHTML = `
    <section class="card">
      <div class="section-head"><div><small>KEUANGAN</small><h2>Transaksi Kas</h2></div></div>

      <form id="transactionForm" class="form">
        <label>Tanggal<input id="date" type="date" required></label>
        <label>Jenis<select id="jenis">
          <option value="pemasukan">Pemasukan</option>
          <option value="pengeluaran">Pengeluaran</option>
        </select></label>
        <label>Kategori<select id="kat">
          <option>Penjualan</option><option>Pembelian</option><option>Operasional</option>
          <option>Transportasi</option><option>Listrik</option><option>Air</option>
          <option>Gaji</option><option>Lainnya</option>
        </select></label>
        <label>Akun<select id="akun"><option>Kas Kantin</option><option>Bank</option></select></label>
        <label>Nominal<input id="nominal" type="number" min="1" step="1" placeholder="Rp 0" required></label>
        <label>Keterangan<input id="ket" maxlength="200" placeholder="Keterangan"></label>
        <div class="form-actions"><button type="submit">Simpan Transaksi</button></div>
      </form>

      <div class="filter-row">
        <label>Bulan<input id="filterBulan" type="month" value="${esc(thisMonth)}"></label>
        <label>Jenis<select id="filterJenis">
          <option value="semua">Semua</option>
          <option value="pemasukan">Pemasukan</option>
          <option value="pengeluaran">Pengeluaran</option>
        </select></label>
        <label>Cari<input id="search" placeholder="Keterangan / kategori..."></label>
        <button type="button" id="applyFilter" class="btn-apply">Terapkan</button>
      </div>

      <div id="filterSummary"></div>
      <div id="list"></div>
    </section>`;

  $('#date').value = today();

  // ── Render daftar transaksi sesuai filter ──
  async function loadList() {
    const bulan  = $('#filterBulan').value;
    const jenis  = $('#filterJenis').value;
    const search = ($('#search').value || '').trim().toLowerCase();

    let q = supabaseClient.from('putra_transaksi').select('*')
      .order('tanggal',    { ascending: false })
      .order('created_at', { ascending: false });

    if (bulan) {
      const [y, m] = bulan.split('-');
      const lastDay = new Date(y, m, 0).getDate();
      q = q.gte('tanggal', `${bulan}-01`).lte('tanggal', `${bulan}-${lastDay}`);
    }
    if (jenis !== 'semua') q = q.eq('jenis', jenis);

    try {
      let data = await safeQuery(q);

      // Filter lokal (keterangan/kategori tidak bisa difilter di Supabase tanpa full-text)
      if (search) data = data.filter(x =>
        (x.keterangan || '').toLowerCase().includes(search) ||
        (x.kategori   || '').toLowerCase().includes(search)
      );

      // Ringkasan filter
      const totalIn  = data.filter(x => x.jenis === 'pemasukan').reduce((s, x) => s + Number(x.nominal), 0);
      const totalOut = data.filter(x => x.jenis === 'pengeluaran').reduce((s, x) => s + Number(x.nominal), 0);
      $('#filterSummary').innerHTML = `
        <div class="fs-row">
          <div class="fs-item fs-in"><span>Pemasukan</span><b>${money(totalIn)}</b></div>
          <div class="fs-item fs-out"><span>Pengeluaran</span><b>${money(totalOut)}</b></div>
          <div class="fs-item"><span>Selisih</span><b>${money(totalIn - totalOut)}</b></div>
        </div>`;

      if (!data.length) {
        $('#list').innerHTML = `<div class="empty">Belum ada data sesuai filter.</div>`;
        return;
      }

      // Tabel dengan badge jenis + tombol hapus
      $('#list').innerHTML = `<div class="table"><table>
        <thead><tr>
          <th>Tanggal</th><th>No</th><th>Jenis</th><th>Kategori</th><th>Nominal</th><th>Aksi</th>
        </tr></thead>
        <tbody>
          ${data.map(x => `
            <tr data-id="${esc(x.id)}">
              <td>${esc(x.tanggal)}</td>
              <td><small>${esc(x.no_transaksi)}</small></td>
              <td><span class="badge ${x.jenis === 'pemasukan' ? 'badge-in' : 'badge-out'}">${esc(x.jenis)}</span></td>
              <td>${esc(x.kategori)}</td>
              <td>${money(x.nominal)}</td>
              <td><button type="button" class="btn-del" data-id="${esc(x.id)}" title="Hapus transaksi ini">🗑️</button></td>
            </tr>`).join('')}
        </tbody>
      </table></div>`;
    } catch (error) {
      $('#list').innerHTML = `<div class="error">Gagal memuat transaksi: ${esc(errorText(error))}</div>`;
    }
  }

  // ── Form simpan ──
  $('#transactionForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date    = $('#date').value;
    const nominal = Number($('#nominal').value);

    if (isFriday(date)) return showError('Jumat adalah hari libur operasional.');
    if (!date)          return showError('Tanggal wajib diisi.');
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
      e.target.reset();
      $('#date').value = today();
      await loadList();
    } catch (error) {
      showError(`Transaksi gagal disimpan: ${errorText(error)}`);
      button.disabled = false;
    }
  });

  // ── Filter ──
  $('#applyFilter').addEventListener('click', loadList);
  $('#search').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadList(); });

  // ── Hapus transaksi (event delegation di container #list) ──
  // Delegasi ke #list agar tidak perlu re-attach setiap kali loadList() dipanggil
  $('#list').addEventListener('click', async (e) => {
    // Klik tombol hapus pertama kali → tampilkan konfirmasi inline
    const delBtn = e.target.closest('.btn-del');
    if (delBtn) {
      const id = delBtn.dataset.id;
      const td = delBtn.closest('td');
      td.innerHTML = `
        <div class="del-confirm">
          <span>Hapus?</span>
          <button type="button" class="btn-del-confirm" data-id="${esc(id)}">Ya</button>
          <button type="button" class="btn-del-cancel" data-id="${esc(id)}">Tidak</button>
        </div>`;
      return;
    }

    // Batal → kembalikan tombol hapus
    const cancelBtn = e.target.closest('.btn-del-cancel');
    if (cancelBtn) {
      const id = cancelBtn.dataset.id;
      cancelBtn.closest('td').innerHTML =
        `<button type="button" class="btn-del" data-id="${esc(id)}" title="Hapus transaksi ini">🗑️</button>`;
      return;
    }

    // Konfirmasi Ya → hapus dari Supabase
    const confirmBtn = e.target.closest('.btn-del-confirm');
    if (confirmBtn) {
      const id = confirmBtn.dataset.id;
      confirmBtn.disabled = true;
      confirmBtn.textContent = '...';
      try {
        const { error } = await supabaseClient.from('putra_transaksi').delete().eq('id', id);
        if (error) throw error;
        showSuccess('Transaksi berhasil dihapus.');
        await loadList();
      } catch (error) {
        showError(`Hapus gagal: ${errorText(error)}`);
        await loadList();
      }
    }
  });

  await loadList();
}

// ─── LAPORAN HARIAN ──────────────────────────────────────────────────────────
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
    if (!date)          return showError('Tanggal wajib diisi.');
    if (isFriday(date)) return showError('Jumat adalah hari libur operasional.');

    const n = (id) => Math.max(0, Number($(id).value) || 0);
    const payload = {
      unit: 'putra',
      tanggal: date,
      pendapatan_i:   n('#p1'),
      pendapatan_ii:  n('#p2'),
      titipan_i:      n('#t1'),
      titipan_ii:     n('#t2'),
      titipan_iii:    n('#t3'),
      tabungan:       n('#tb')
    };
    payload.total =
      payload.penda