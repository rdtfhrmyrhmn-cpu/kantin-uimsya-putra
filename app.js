(() => {
  'use strict';

  const TABLE = 'kantin_data';
  const $ = id => document.getElementById(id);
  const byId = id => $(id);
  const todayISO = () => {
    const d = new Date();
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0,10);
  };
  const addMonths = (iso, months) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().slice(0,10);
  };
  const money = value => new Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:0 }).format(Number(value || 0));
  const number = value => Math.round(Number(value || 0));
  const csvEscape = value => `"${String(value ?? '').replaceAll('"','""')}"`;
  const isFriday = iso => !!iso && new Date(`${iso}T00:00:00`).getDay() === 5;

  const state = { user:null, session:null, daily:[], expenses:[], withdrawals:[], period:'month', editDailyId:null };

  function getClient() {
    const candidates = [window.supabaseClient, window.supabase];
    const client = candidates.find(x => x && typeof x.from === 'function' && x.auth);
    if (!client) throw new Error('Supabase client tidak ditemukan. Pastikan supabase.js membuat window.supabaseClient atau window.supabase.');
    return client;
  }

  function alertBox(message, type='success') {
    const el = $('appAlert'); if (!el) return;
    el.className = `alert ${type === 'error' ? 'error' : 'success'}`;
    el.textContent = message;
    clearTimeout(alertBox._timer); alertBox._timer = setTimeout(() => el.classList.add('hidden'), 3500);
  }

  function setDefaultDates() {
    const t = todayISO();
    ['dailyDate','expenseDate','withdrawDate','printDate'].forEach(id => { if ($(id) && !$(id).value) $(id).value = t; });
    setDashboardPeriod('month', false);
  }

  async function requireSession() {
    const client = getClient();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    state.session = data.session;
    state.user = data.session?.user || null;
    if (!state.session) { window.location.href = 'index.html'; return false; }
    const display = state.user.user_metadata?.username || state.user.email || 'Pengguna';
    $('userBadge').textContent = display;
    return true;
  }

  async function loadData() {
    const client = getClient();
    const { data, error } = await client.from(TABLE).select('id,record_id,tipe,tgl,data,updated_at').order('tgl', { ascending:false });
    if (error) throw error;
    state.daily = (data || []).filter(x => x.tipe === 'harian');
    state.expenses = (data || []).filter(x => x.tipe === 'pengeluaran');
    state.withdrawals = (data || []).filter(x => x.tipe === 'penarikan');
    renderAll();
  }

  function dailyTotal(d) {
    const x = d || {};
    return number(x.pendI) + number(x.pendII) - number(x.titipI) - number(x.titipII) - number(x.titipIII) - number(x.tabungan);
  }

  function currentDailyData() {
    return {
      pendI:number($('pendI').value), pendII:number($('pendII').value), titipI:number($('titipI').value),
      titipII:number($('titipII').value), titipIII:number($('titipIII').value), tabungan:number($('savingDeposit').value)
    };
  }

  function updateDailyTotal() { $('dailyTotal').textContent = money(dailyTotal(currentDailyData())); }

  function setFridayState() {
    const date = $('dailyDate').value;
    const friday = isFriday(date);
    $('dailyStatus').value = friday ? 'Libur (Jumat)' : 'Aktif';
    $('fridayNotice').classList.toggle('hidden', !friday);
    ['pendI','pendII','titipI','titipII','titipIII','savingDeposit'].forEach(id => { $(id).disabled = friday; });
    $('saveDailyBtn').disabled = friday;
    if (friday) updateDailyTotal();
  }

  function resetDailyForm(keepDate = false) {
    const selectedDate = $('dailyDate').value || todayISO();
    state.editDailyId = null;
    ['pendI','pendII','titipI','titipII','titipIII','savingDeposit'].forEach(id => $(id).value = '');
    $('dailyDate').value = keepDate ? selectedDate : todayISO();
    $('saveDailyBtn').textContent = 'Simpan Laporan';
    setFridayState(); updateDailyTotal();
  }

  function fillDailyForm(row) {
    const d = row.data || {};
    state.editDailyId = row.id;
    $('dailyDate').value = row.tgl;
    $('pendI').value = d.pendI ?? '';
    $('pendII').value = d.pendII ?? '';
    $('titipI').value = d.titipI ?? '';
    $('titipII').value = d.titipII ?? '';
    $('titipIII').value = d.titipIII ?? '';
    $('savingDeposit').value = d.tabungan ?? '';
    $('saveDailyBtn').textContent = 'Perbarui Laporan';
    setFridayState(); updateDailyTotal(); switchTab('laporan'); window.scrollTo({top:0,behavior:'smooth'});
  }

  async function saveDaily() {
    const date = $('dailyDate').value; if (!date) return alertBox('Pilih tanggal terlebih dahulu.', 'error');
    if (isFriday(date)) return alertBox('Hari Jumat otomatis libur dan tidak bisa disimpan.', 'error');
    const data = currentDailyData();
    const client = getClient();
    const record_id = `harian:${date}`;
    const payload = { record_id, tipe:'harian', tgl:date, data };
    const { error } = state.editDailyId
      ? await client.from(TABLE).update({ tgl:date, data, updated_at:new Date().toISOString() }).eq('id', state.editDailyId)
      : await client.from(TABLE).upsert(payload, { onConflict:'record_id' });
    if (error) throw error;
    alertBox('Laporan harian berhasil disimpan.'); resetDailyForm(); await loadData();
  }

  async function deleteRecord(id, label) {
    if (!confirm(`Hapus ${label}?`)) return;
    const client = getClient();
    const { error } = await client.from(TABLE).delete().eq('id', id);
    if (error) throw error;
    alertBox(`${label} dihapus.`); await loadData();
  }

  function renderDailyTable() {
    const q = ($('dailySearch').value || '').toLowerCase();
    const rows = state.daily.filter(r => r.tgl.includes(q));
    $('dailyTable').querySelector('tbody').innerHTML = rows.map(r => {
      const d = r.data || {};
      return `<tr><td>${r.tgl}</td><td>${money(d.pendI)}</td><td>${money(d.pendII)}</td><td>${money(d.titipI)}</td><td>${money(d.titipII)}</td><td>${money(d.titipIII)}</td><td>${money(d.tabungan)}</td><td><strong>${money(dailyTotal(d))}</strong></td><td><div class="row-actions"><button class="mini-btn" data-action="edit" data-id="${r.id}">Edit</button><button class="mini-btn danger" data-action="delete" data-id="${r.id}">Hapus</button></div></td></tr>`;
    }).join('') || `<tr><td colspan="9" class="muted">Belum ada laporan.</td></tr>`;
  }

  function renderExpenseTable() {
    const q = ($('expenseSearch').value || '').toLowerCase();
    const rows = state.expenses.filter(r => `${r.tgl} ${r.data?.keterangan || ''}`.toLowerCase().includes(q));
    $('expenseTable').querySelector('tbody').innerHTML = rows.map(r => `<tr><td>${r.tgl}</td><td>${escapeHTML(r.data?.keterangan || '-')}</td><td><strong>${money(r.data?.jumlah)}</strong></td><td><button class="mini-btn danger" data-action="delete" data-id="${r.id}">Hapus</button></td></tr>`).join('') || `<tr><td colspan="4" class="muted">Belum ada pengeluaran.</td></tr>`;
  }

  function renderWithdrawTable() {
    $('withdrawTable').querySelector('tbody').innerHTML = state.withdrawals.map(r => `<tr><td>${r.tgl}</td><td>${escapeHTML(r.data?.keterangan || '-')}</td><td><strong>${money(r.data?.jumlah)}</strong></td><td><button class="mini-btn danger" data-action="delete" data-id="${r.id}">Hapus</button></td></tr>`).join('') || `<tr><td colspan="4" class="muted">Belum ada penarikan.</td></tr>`;
  }

  function escapeHTML(text) { return String(text).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

  async function saveExpense() {
    const tgl = $('expenseDate').value, jumlah = number($('expenseAmount').value), keterangan = $('expenseNote').value.trim();
    if (!tgl || jumlah <= 0) return alertBox('Tanggal dan jumlah pengeluaran wajib diisi.', 'error');
    const client = getClient(), record_id = `pengeluaran:${crypto.randomUUID()}`;
    const { error } = await client.from(TABLE).insert({record_id,tipe:'pengeluaran',tgl,data:{jumlah,keterangan}});
    if (error) throw error;
    $('expenseAmount').value=''; $('expenseNote').value=''; alertBox('Pengeluaran berhasil disimpan.'); await loadData();
  }

  async function saveWithdrawal() {
    const tgl = $('withdrawDate').value, jumlah = number($('withdrawAmount').value), keterangan = $('withdrawNote').value.trim();
    if (!tgl || jumlah <= 0) return alertBox('Tanggal dan jumlah penarikan wajib diisi.', 'error');
    const balance = getSavingsBalance();
    if (jumlah > balance) return alertBox(`Saldo tabungan tidak cukup. Saldo saat ini ${money(balance)}.`, 'error');
    const client = getClient(), record_id = `penarikan:${crypto.randomUUID()}`;
    const { error } = await client.from(TABLE).insert({record_id,tipe:'penarikan',tgl,data:{jumlah,keterangan}});
    if (error) throw error;
    $('withdrawAmount').value=''; $('withdrawNote').value=''; alertBox('Penarikan tabungan berhasil disimpan.'); await loadData();
  }

  function getSavingsDepositRows() { return state.daily; }
  function getSavingsTotal() { return getSavingsDepositRows().reduce((s,r) => s + number(r.data?.tabungan),0); }
  function getWithdrawalTotal() { return state.withdrawals.reduce((s,r) => s + number(r.data?.jumlah),0); }
  function getSavingsBalance() { return getSavingsTotal() - getWithdrawalTotal(); }

  function renderSavings() {
    const total = getSavingsTotal(), wd = getWithdrawalTotal(), bal = total-wd, month = monthKey(todayISO());
    const md = state.daily.filter(r => monthKey(r.tgl) === month).reduce((s,r)=>s+number(r.data?.tabungan),0);
    $('savingDepositTotal').textContent=money(total); $('savingWithdrawalTotal').textContent=money(wd); $('savingBalance').textContent=money(bal); $('savingMonthDeposit').textContent=money(md);
  }

  function monthKey(iso) { return iso.slice(0,7); }
  function monthLabel(key) { const [y,m]=key.split('-'); return new Intl.DateTimeFormat('id-ID',{month:'short',year:'numeric'}).format(new Date(Number(y),Number(m)-1,1)); }
  function inRange(date, from, to) { return date >= from && date <= to; }

  function getDashboardRange() {
    const to = $('dashTo').value || todayISO();
    let from = $('dashFrom').value;
    if (!from) {
      if (state.period === 'month') from = `${to.slice(0,7)}-01`;
      else from = addMonths(to, -(state.period==='3m'?2:state.period==='6m'?5:state.period==='1y'?11:23));
    }
    return {from,to};
  }

  function setDashboardPeriod(period, refresh=true) {
    state.period = period;
    document.querySelectorAll('.period-btn').forEach(b=>b.classList.toggle('active', b.dataset.period===period));
    const to = $('dashTo')?.value || todayISO();
    const from = period === 'month' ? `${to.slice(0,7)}-01` : addMonths(to, -(period==='3m'?2:period==='6m'?5:period==='1y'?11:23));
    $('dashFrom').value=from; $('dashTo').value=to;
    if(refresh) renderDashboard();
  }

  function aggregateDashboard(from,to) {
    const daily = state.daily.filter(r=>inRange(r.tgl,from,to));
    const expenses = state.expenses.filter(r=>inRange(r.tgl,from,to));
    const withdrawals = state.withdrawals.filter(r=>inRange(r.tgl,from,to));
    const totalDaily = daily.reduce((s,r)=>s+dailyTotal(r.data),0);
    const totalExpense = expenses.reduce((s,r)=>s+number(r.data?.jumlah),0);
    const totalDeposit = daily.reduce((s,r)=>s+number(r.data?.tabungan),0);
    const totalWithdraw = withdrawals.reduce((s,r)=>s+number(r.data?.jumlah),0);
    const byMonth = {};
    const ensure = key => byMonth[key] ||= {daily:0,expense:0,deposit:0,withdraw:0};
    daily.forEach(r=>ensure(monthKey(r.tgl)).daily += dailyTotal(r.data));
    expenses.forEach(r=>ensure(monthKey(r.tgl)).expense += number(r.data?.jumlah));
    daily.forEach(r=>ensure(monthKey(r.tgl)).deposit += number(r.data?.tabungan));
    withdrawals.forEach(r=>ensure(monthKey(r.tgl)).withdraw += number(r.data?.jumlah));
    return {daily,expenses,withdrawals,totalDaily,totalExpense,totalDeposit,totalWithdraw,byMonth};
  }

  function renderDashboard() {
    const {from,to}=getDashboardRange(), a=aggregateDashboard(from,to);
    $('dashDailyTotal').textContent=money(a.totalDaily); $('dashExpenseTotal').textContent=money(a.totalExpense); $('dashDepositTotal').textContent=money(a.totalDeposit); $('dashWithdrawTotal').textContent=money(a.totalWithdraw); $('dashPeriodLabel').textContent=`${from} s/d ${to}`;
    const months = Object.entries(a.byMonth).sort((x,y)=>x[0].localeCompare(y[0]));
    const max = Math.max(1,...months.map(([,v])=>Math.max(Math.abs(v.daily),Math.abs(v.expense))));
    $('monthChart').innerHTML = months.map(([k,v])=>`<div class="chart-row"><div>${monthLabel(k)}</div><div class="chart-track"><div class="chart-bar" style="width:${Math.min(100,Math.abs(v.daily)/max*100)}%"></div></div><div class="chart-value">${money(v.daily)}</div></div>`).join('') || `<div class="muted">Belum ada data pada periode ini.</div>`;
    $('dashboardTable').querySelector('tbody').innerHTML = months.map(([k,v])=>`<tr><td>${monthLabel(k)}</td><td>${money(v.daily)}</td><td>${money(v.expense)}</td><td>${money(v.deposit)}</td><td>${money(v.withdraw)}</td><td><strong>${money(v.daily-v.expense)}</strong></td></tr>`).join('') || `<tr><td colspan="6" class="muted">Belum ada data.</td></tr>`;
  }

  function renderHome() {
    const t=todayISO(), td=state.daily.find(r=>r.tgl===t); const mt=monthKey(t);
    const todayTotal=td?dailyTotal(td.data):0;
    const monthTotal=state.daily.filter(r=>monthKey(r.tgl)===mt).reduce((s,r)=>s+dailyTotal(r.data),0);
    const monthExpense=state.expenses.filter(r=>monthKey(r.tgl)===mt).reduce((s,r)=>s+number(r.data?.jumlah),0);
    $('homeTodayTotal').textContent=money(todayTotal); $('homeMonthTotal').textContent=money(monthTotal); $('homeMonthExpense').textContent=money(monthExpense); $('homeSavingsBalance').textContent=money(getSavingsBalance());
  }

  function renderAll() { renderDailyTable(); renderExpenseTable(); renderWithdrawTable(); renderSavings(); renderDashboard(); renderHome(); updatePrintPreview(); }

  function switchTab(tab) {
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active', p.id===`tab-${tab}`));
    document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='dashboard') renderDashboard();
  }

  function wireNavigation() { document.querySelectorAll('[data-tab]').forEach(el=>el.addEventListener('click',()=>switchTab(el.dataset.tab))); }

  function handleTableActions() {
    $('dailyTable').addEventListener('click', e=>{const b=e.target.closest('button');if(!b)return;const r=state.daily.find(x=>x.id===b.dataset.id);if(!r)return;b.dataset.action==='edit'?fillDailyForm(r):deleteRecord(r.id,'laporan harian').catch(err=>alertBox(err.message,'error'));});
    $('expenseTable').addEventListener('click', e=>{const b=e.target.closest('button');if(!b)return;deleteRecord(b.dataset.id,'pengeluaran').catch(err=>alertBox(err.message,'error'));});
    $('withdrawTable').addEventListener('click', e=>{const b=e.target.closest('button');if(!b)return;deleteRecord(b.dataset.id,'penarikan').catch(err=>alertBox(err.message,'error'));});
  }

  function downloadCSV(filename, rows) { const csv = '\uFEFF' + rows.map(r=>r.map(csvEscape).join(',')).join('\n'); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href); }
  function exportDailyCSV(){downloadCSV(`laporan-harian-${todayISO()}.csv`,[['Tanggal','Pendapatan I','Pendapatan II','Titipan I','Titipan II','Titipan III','Tabungan','Total'],...state.daily.sort((a,b)=>a.tgl.localeCompare(b.tgl)).map(r=>{const d=r.data||{};return[r.tgl,d.pendI,d.pendII,d.titipI,d.titipII,d.titipIII,d.tabungan,dailyTotal(d)]})]);}
  function exportExpenseCSV(){downloadCSV(`pengeluaran-${todayISO()}.csv`,[['Tanggal','Keterangan','Jumlah'],...state.expenses.sort((a,b)=>a.tgl.localeCompare(b.tgl)).map(r=>[r.tgl,r.data?.keterangan||'',r.data?.jumlah||0])]);}
  function exportSavingCSV(){const rows=[['Tanggal','Jenis','Keterangan','Jumlah','Saldo setelah transaksi']];let balance=0;const items=[...state.daily.map(r=>({tgl:r.tgl,jenis:'Setoran',ket:'Setoran tabungan dari laporan harian',jumlah:number(r.data?.tabungan)})),...state.withdrawals.map(r=>({tgl:r.tgl,jenis:'Penarikan',ket:r.data?.keterangan||'',jumlah:-number(r.data?.jumlah)}))].sort((a,b)=>a.tgl.localeCompare(b.tgl));items.forEach(i=>{balance+=i.jumlah;rows.push([i.tgl,i.jenis,i.ket,Math.abs(i.jumlah),balance])});downloadCSV(`tabungan-${todayISO()}.csv`,rows);}

  function buildPrintHtml(row) {
    const d=row?.data||{}; return `<html><head><title>Laporan ${row?.tgl||''}</title><style>@page{size:B5 portrait;margin:12mm}body{font-family:Arial,sans-serif;color:#111}.head{text-align:center;border-bottom:2px solid #111;padding-bottom:10px}.logo{max-height:65px;max-width:100px}.meta{margin-top:15px}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #555}.grid div{padding:8px;border-bottom:1px solid #ddd}.label{font-weight:700}.total{margin-top:14px;padding:14px;border:2px solid #111;text-align:center}.sig{margin-top:55px;text-align:right}.sig .line{width:170px;border-top:1px solid #111;margin-left:auto;margin-top:50px}</style></head><body><div class="head"><img class="logo" src="assets/logo.png"><h2>KANTIN UIMSYA PUTRA</h2><div>LAPORAN KEUANGAN HARIAN</div></div><div class="meta"><b>Tanggal:</b> ${row?.tgl||'-'}</div><div class="grid" style="margin-top:14px"><div class="label">Pendapatan I</div><div>${money(d.pendI)}</div><div class="label">Pendapatan II</div><div>${money(d.pendII)}</div><div class="label">Titipan I</div><div>${money(d.titipI)}</div><div class="label">Titipan II</div><div>${money(d.titipII)}</div><div class="label">Titipan III</div><div>${money(d.titipIII)}</div><div class="label">Tabungan</div><div>${money(d.tabungan)}</div></div><div class="total"><div>Total Harian</div><h2>${money(dailyTotal(d))}</h2><small>(Pend. I + Pend. II) - Titipan I - Titipan II - Titipan III - Tabungan</small></div><div class="sig">Mengetahui,<div class="line"></div></div><script>window.onload=()=>window.print()<\\/script></body></html>`;
  }
  function printRow(row){const w=window.open('','_blank','width=800,height=900');if(!w)return;w.document.write(buildPrintHtml(row));w.document.close();}
  function updatePrintPreview(){const r=state.daily.find(x=>x.tgl===$('printDate').value);$('printPreview').innerHTML=r?`<b>${r.tgl}</b> — Total ${money(dailyTotal(r.data))}`:'Tidak ada laporan pada tanggal tersebut.';}
  function printSelectedDate(){const r=state.daily.find(x=>x.tgl===$('printDate').value);if(!r)return alertBox('Tidak ada laporan untuk tanggal tersebut.','error');printRow(r);}

  async function changePassword(e){e.preventDefault();const p=$('newPassword').value,p2=$('newPassword2').value;if(p.length<6)return alertBox('Password minimal 6 karakter.','error');if(p!==p2)return alertBox('Konfirmasi password tidak sama.','error');const client=getClient();const {error}=await client.auth.updateUser({password:p});if(error)throw error;$('changePasswordForm').reset();alertBox('Password berhasil diganti.');}

  async function logout(){const client=getClient();await client.auth.signOut();window.location.href='index.html';}

  async function init(){
    try { if(!await requireSession()) return; setDefaultDates(); wireNavigation(); handleTableActions();
      document.querySelectorAll('.money').forEach(i=>i.addEventListener('input',updateDailyTotal));
      $('dailyDate').addEventListener('change',()=>{setFridayState(); const r=state.daily.find(x=>x.tgl===$('dailyDate').value); if(r) fillDailyForm(r); else resetDailyForm(true);});
      $('saveDailyBtn').addEventListener('click',()=>saveDaily().catch(e=>alertBox(e.message,'error'))); $('resetDailyBtn').addEventListener('click',resetDailyForm);
      $('saveExpenseBtn').addEventListener('click',()=>saveExpense().catch(e=>alertBox(e.message,'error'))); $('saveWithdrawBtn').addEventListener('click',()=>saveWithdrawal().catch(e=>alertBox(e.message,'error')));
      $('dailySearch').addEventListener('input',renderDailyTable); $('expenseSearch').addEventListener('input',renderExpenseTable);
      document.querySelectorAll('.period-btn').forEach(b=>b.addEventListener('click',()=>setDashboardPeriod(b.dataset.period))); $('dashFrom').addEventListener('change',renderDashboard); $('dashTo').addEventListener('change',renderDashboard);
      $('exportDailyBtn').addEventListener('click',exportDailyCSV); $('exportExpenseBtn').addEventListener('click',exportExpenseCSV); $('exportSavingBtn').addEventListener('click',exportSavingCSV);
      $('printCurrentDayBtn').addEventListener('click',()=>{const r=state.daily.find(x=>x.tgl===todayISO()); if(r) printRow(r); else alertBox('Belum ada laporan hari ini.','error');});
      $('printDate').addEventListener('change',updatePrintPreview); $('printDateBtn').addEventListener('click',printSelectedDate); $('changePasswordForm').addEventListener('submit',e=>changePassword(e).catch(err=>alertBox(err.message,'error'))); $('logoutBtn').addEventListener('click',()=>logout().catch(e=>alertBox(e.message,'error')));
      await loadData(); resetDailyForm();
    } catch (e) { console.error(e); alertBox(e.message || 'Gagal memuat aplikasi.','error'); }
  }
  document.addEventListener('DOMContentLoaded',init);
})();
