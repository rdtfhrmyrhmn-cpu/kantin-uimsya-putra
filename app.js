const NAV=[
 {k:'dashboard',label:'Dashboard',icon:'⌂',sub:'Ringkasan & analitik'},
 {k:'transactions',label:'Transaksi',icon:'↔',sub:'Pemasukan & pengeluaran'},
 {k:'daily',label:'Laporan Harian',icon:'▣',sub:'Rekap operasional'},
 {k:'cashbook',label:'Buku Kas',icon:'▤',sub:'Mutasi & saldo'},
 {k:'savings',label:'Tabungan',icon:'◇',sub:'Setoran & penarikan'},
 {k:'reports',label:'Laporan',icon:'▥',sub:'Export & cetak'},
 {k:'settings',label:'Pengaturan',icon:'⚙',sub:'Akun & sistem'}
];
const $=s=>document.querySelector(s);
const money=n=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(n)||0);
const num=n=>Number(n)||0;
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");
const today=()=>{const d=new Date(),l=new Date(d.getTime()-d.getTimezoneOffset()*60000);return l.toISOString().slice(0,10)};
const fmtDate=d=>d?new Date(`${d}T00:00:00`).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}):'-';
const isFriday=d=>new Date(`${d}T00:00:00`).getDay()===5;
const errText=e=>e?.message||String(e||'Kesalahan tidak diketahui');
let state={page:'dashboard',charts:{},session:null,profile:null};

function toast(msg,type='info'){let root=$('#toastRoot');root.innerHTML=`<div class="toast ${type}">${esc(msg)}</div>`;setTimeout(()=>root.innerHTML='',4200)}
function requireSB(){if(!window.supabaseClient)throw new Error('Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY di supabase.js.')}
async function query(p){const r=await p;if(r.error)throw r.error;return r.data||[]}
function pageHead(eyebrow,title,desc,action=''){return `<div class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p class="muted">${desc}</p></div>${action}</div>`}
function table(headers,rows,empty='Belum ada data.'){if(!rows.length)return `<div class="empty">${esc(empty)}</div>`;return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`}
function badge(j){return `<span class="badge ${j==='pemasukan'?'in':'out'}">${j==='pemasukan'?'Pemasukan':'Pengeluaran'}</span>`}
function navRender(){
 $('#nav').innerHTML=NAV.map(n=>`<button data-nav="${n.k}" class="${state.page===n.k?'active':''}"><span class="nav-icon">${n.icon}</span>${n.label}</button>`).join('');
 $('#bottomNav').innerHTML=NAV.filter(n=>['dashboard','transactions','cashbook','savings','reports'].includes(n.k)).map(n=>`<button data-nav="${n.k}" class="${state.page===n.k?'active':''}">${n.icon}<br>${n.label}</button>`).join('');
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>load(b.dataset.nav));
}
function setHeader(){const n=NAV.find(x=>x.k===state.page)||NAV[0];$('#pageTitle').textContent=n.label;$('#pageSub').textContent=n.sub;navRender()}
async function init(){
 try{
  requireSB();const {data,error}=await supabaseClient.auth.getSession();if(error)throw error;if(!data.session){location.href='index.html';return}
  state.session=data.session;
  const email=data.session.user.email||'operator@kantin-uimsya.local';
  const name=email.split('@')[0];$('#userName').textContent=name;$('#avatar').textContent=name[0]?.toUpperCase()||'A';
  $('#logout').onclick=async()=>{await supabaseClient.auth.signOut();location.href='index.html'};
  $('#menu').onclick=()=>{$('#sidebar').classList.toggle('open');$('#overlay').classList.toggle('show')};
  $('#overlay').onclick=()=>{$('#sidebar').classList.remove('open');$('#overlay').classList.remove('show')};
  $('#refresh').onclick=()=>load(state.page);
  await load('dashboard');
 }catch(e){$('#app').innerHTML=`<section class="card section"><div class="empty"><b>Aplikasi belum siap</b><p>${esc(errText(e))}</p></div></section>`}
}
async function load(p){
 state.page=p;setHeader();$('#sidebar').classList.remove('open');$('#overlay').classList.remove('show');
 try{
  if(p==='dashboard')await dashboard();else if(p==='transactions')await transactions();else if(p==='daily')await daily();else if(p==='cashbook')await cashbook();else if(p==='savings')await savings();else if(p==='reports')await reports();else await settings();
 }catch(e){$('#app').innerHTML=`<section class="card section"><div class="empty"><b>Gagal memuat halaman</b><p>${esc(errText(e))}</p><button class="primary" onclick="load('${p}')">Coba lagi</button></div></section>`}
}
async function getAllTransactions(){
 return query(supabaseClient.from('putra_transaksi').select('*').order('tanggal',{ascending:false}).order('created_at',{ascending:false}))
}
async function dashboard(){
 const [tx,sav]=await Promise.all([getAllTransactions(),query(supabaseClient.from('putra_tabungan').select('*'))]);
 let income=0,expense=0;tx.forEach(x=>x.jenis==='pemasukan'?income+=num(x.nominal):expense+=num(x.nominal));
 let saved=0; sav.forEach(x=>x.jenis==='setoran'?saved+=num(x.nominal):saved-=num(x.nominal));
 const balance=income-expense;
 const last30=new Date();last30.setDate(last30.getDate()-29);
 const recent=tx.filter(x=>new Date(x.tanggal)>=last30);
 const dailyMap={};recent.forEach(x=>{dailyMap[x.tanggal]=(dailyMap[x.tanggal]||0)+(x.jenis==='pemasukan'?num(x.nominal):-num(x.nominal))});
 const labels=Object.keys(dailyMap).sort(), vals=labels.map(k=>dailyMap[k]);
 const latest=tx.slice(0,6);
 $('#app').innerHTML=`
 <div class="hero"><div><span class="eyebrow" style="color:#bfe4ce">KANTIN UIMSYA PUTRA • PRO</span><h1>Selamat datang kembali 👋</h1><p>Pantau arus kas dan operasional dalam satu dashboard.</p></div><div class="hero-date">${new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}<br>${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</div></div>
 <div class="kpis">
  <div class="card kpi"><div class="kpi-top"><span>Total pemasukan</span><span class="kpi-icon">↗</span></div><b>${money(income)}</b><span class="trend">Semua transaksi tercatat</span></div>
  <div class="card kpi"><div class="kpi-top"><span>Total pengeluaran</span><span class="kpi-icon">↘</span></div><b>${money(expense)}</b><span class="trend negative">Kontrol biaya operasional</span></div>
  <div class="card kpi"><div class="kpi-top"><span>Saldo kas</span><span class="kpi-icon">◉</span></div><b>${money(balance)}</b><span class="trend ${balance<0?'negative':''}">${balance>=0?'Posisi kas positif':'Perlu perhatian'}</span></div>
  <div class="card kpi"><div class="kpi-top"><span>Tabungan bersih</span><span class="kpi-icon">◇</span></div><b>${money(saved)}</b><span class="trend">Setoran dikurangi penarikan</span></div>
 </div>
 <div class="dashboard-grid">
  <section class="card panel"><div class="panel-head"><div><span class="eyebrow">ANALITIK</span><h2>Arus kas 30 hari</h2></div><span class="muted">Net cashflow</span></div><div class="chart-wrap"><canvas id="cashChart"></canvas></div></section>
  <section class="card panel"><div class="panel-head"><div><span class="eyebrow">AKSI CEPAT</span><h2>Shortcut</h2></div></div><div class="quick-actions">
   <button data-quick="transactions">↔<b>Catat transaksi</b></button><button data-quick="daily">▣<b>Laporan harian</b></button><button data-quick="cashbook">▤<b>Buka buku kas</b></button><button data-quick="reports">⇩<b>Export laporan</b></button>
  </div><div style="margin-top:18px" class="metric"><small>Transaksi tercatat</small><b>${tx.length} transaksi</b></div></section>
 </div>
 <section class="card section" style="margin-top:16px"><div class="panel-head"><div><span class="eyebrow">AKTIVITAS</span><h2>Transaksi terbaru</h2></div><button class="secondary" data-quick="transactions">Lihat semua</button></div>
 ${table(['Tanggal','Nomor','Kategori','Jenis','Nominal'],latest.map(x=>`<tr><td>${fmtDate(x.tanggal)}</td><td>${esc(x.no_transaksi)}</td><td>${esc(x.kategori)}</td><td>${badge(x.jenis)}</td><td><b>${money(x.nominal)}</b></td></tr>`))}</section>`;
 document.querySelectorAll('[data-quick]').forEach(b=>b.onclick=()=>load(b.dataset.quick));
 if(state.charts.cash)state.charts.cash.destroy();
 state.charts.cash=new Chart($('#cashChart'),{type:'line',data:{labels:labels.map(fmtDate),datasets:[{label:'Net cashflow',data:vals,tension:.35,fill:true}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>money(v)}}}}});
}
async function transactions(){
 $('#app').innerHTML=pageHead('KEUANGAN','Transaksi','Catat, cari, filter, ubah, dan hapus transaksi dengan cepat.','<button class="primary" id="addTx">+ Transaksi baru</button>')+
 `<section class="card section"><div class="toolbar"><input class="grow" id="q" placeholder="Cari nomor, kategori, keterangan…"><select id="type"><option value="">Semua jenis</option><option value="pemasukan">Pemasukan</option><option value="pengeluaran">Pengeluaran</option></select><input id="from" type="date"><input id="to" type="date"></div><div id="txList"></div></section>`;
 const data=await getAllTransactions();let rows=data;
 const render=()=>{const q=$('#q').value.toLowerCase(),t=$('#type').value,f=$('#from').value,to=$('#to').value;
  rows=data.filter(x=>(!q||`${x.no_transaksi} ${x.kategori} ${x.keterangan||''}`.toLowerCase().includes(q))&&(!t||x.jenis===t)&&(!f||x.tanggal>=f)&&(!to||x.tanggal<=to));
  $('#txList').innerHTML=table(['Tanggal','Nomor','Kategori','Akun','Jenis','Nominal','Aksi'],rows.map(x=>`<tr><td>${fmtDate(x.tanggal)}</td><td>${esc(x.no_transaksi)}</td><td>${esc(x.kategori)}</td><td>${esc(x.akun)}</td><td>${badge(x.jenis)}</td><td><b>${money(x.nominal)}</b></td><td><button class="icon-btn edit" data-id="${x.id}">✎</button> <button class="icon-btn del" data-id="${x.id}">×</button></td></tr>`))};
 ['q','type','from','to'].forEach(id=>$( '#'+id).addEventListener('input',render));render();
 $('#addTx').onclick=()=>openTxModal();document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>openTxModal(data.find(x=>x.id===b.dataset.id)));
 document.querySelectorAll('.del').forEach(b=>b.onclick=async()=>{if(!confirm('Hapus transaksi ini?'))return;const {error}=await supabaseClient.from('putra_transaksi').delete().eq('id',b.dataset.id);if(error)return toast(errText(error),'error');toast('Transaksi dihapus','success');transactions()});
}
function openTxModal(item=null){
 const cats=['Penjualan','Pembelian','Operasional','Transportasi','Listrik','Air','Gaji','Stok Barang','Lainnya'];
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal card"><button class="icon-btn close" id="close">×</button><span class="eyebrow">TRANSAKSI</span><h2>${item?'Edit transaksi':'Transaksi baru'}</h2>
 <form id="txForm" class="form-grid"><label class="field">Tanggal<input id="mdate" type="date" value="${item?.tanggal||today()}" required></label><label class="field">Jenis<select id="mjenis"><option value="pemasukan" ${item?.jenis==='pemasukan'?'selected':''}>Pemasukan</option><option value="pengeluaran" ${item?.jenis==='pengeluaran'?'selected':''}>Pengeluaran</option></select></label><label class="field">Kategori<select id="mkat">${cats.map(c=>`<option ${item?.kategori===c?'selected':''}>${c}</option>`).join('')}</select></label><label class="field">Akun<select id="makun"><option ${item?.akun==='Kas Kantin'?'selected':''}>Kas Kantin</option><option ${item?.akun==='Bank'?'selected':''}>Bank</option><option ${item?.akun==='E-Wallet'?'selected':''}>E-Wallet</option></select></label><label class="field">Nominal<input id="mnom" type="number" min="1" value="${item?.nominal||''}" required></label><label class="field">Keterangan<input id="mket" maxlength="200" value="${esc(item?.keterangan||'')}" placeholder="Opsional"></label><div class="field full actions"><button class="primary" type="submit">${item?'Simpan perubahan':'Simpan transaksi'}</button></div></form></div></div>`);
 $('#close').onclick=()=>$('#modal').remove();$('#txForm').onsubmit=async e=>{e.preventDefault();const d=$('#mdate').value,n=num($('#mnom').value);if(!d||n<=0)return toast('Tanggal dan nominal harus valid','error');if(isFriday(d))return toast('Jumat adalah hari libur operasional.','error');const payload={unit:'putra',tanggal:d,jenis:$('#mjenis').value,kategori:$('#mkat').value,akun:$('#makun').value,nominal:n,keterangan:$('#mket').value.trim()};try{let r;if(item)r=await supabaseClient.from('putra_transaksi').update(payload).eq('id',item.id);else r=await supabaseClient.from('putra_transaksi').insert({...payload,no_transaksi:`TRX-${Date.now()}-${Math.floor(Math.random()*90+10)}`});if(r.error)throw r.error;$('#modal').remove();toast(item?'Transaksi diperbarui':'Transaksi tersimpan','success');transactions()}catch(e){toast(errText(e),'error')}}}
async function daily(){
 const data=await query(supabaseClient.from('putra_laporan_harian').select('*').order('tanggal',{ascending:false}));
 $('#app').innerHTML=pageHead('OPERASIONAL','Laporan Harian','Rekap pendapatan, titipan dan tabungan harian.','<button class="primary" id="addDaily">+ Laporan baru</button>')+
 `<section class="card section"><div class="metric-strip"><div class="metric"><small>Jumlah laporan</small><b>${data.length}</b></div><div class="metric"><small>Total nilai bersih</small><b>${money(data.reduce((a,x)=>a+num(x.total),0))}</b></div><div class="metric"><small>Hari aktif</small><b>${new Set(data.map(x=>x.tanggal)).size}</b></div></div><div id="dailyList"></div></section>`;
 $('#dailyList').innerHTML=table(['Tanggal','Pend. I','Pend. II','Titip I','Titip II','Titip III','Tabungan','Total','Aksi'],data.map(x=>`<tr><td>${fmtDate(x.tanggal)}</td><td>${money(x.pendapatan_i)}</td><td>${money(x.pendapatan_ii)}</td><td>${money(x.titipan_i)}</td><td>${money(x.titipan_ii)}</td><td>${money(x.titipan_iii)}</td><td>${money(x.tabungan)}</td><td><b>${money(x.total)}</b></td><td><button class="icon-btn deldaily" data-id="${x.id}">×</button></td></tr>`));
 $('#addDaily').onclick=()=>openDailyModal();
 document.querySelectorAll('.deldaily').forEach(b=>b.onclick=async()=>{if(!confirm('Hapus laporan ini?'))return;const r=await supabaseClient.from('putra_laporan_harian').delete().eq('id',b.dataset.id);if(r.error)return toast(errText(r.error),'error');toast('Laporan dihapus','success');daily()});
}
function openDailyModal(){
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal card"><button class="icon-btn close" id="close">×</button><span class="eyebrow">LAPORAN HARIAN</span><h2>Tambah laporan</h2><form id="df" class="form-grid"><label class="field">Tanggal<input id="dd" type="date" value="${today()}" required></label><label class="field">Pendapatan I<input id="p1" type="number" min="0" value="0"></label><label class="field">Pendapatan II<input id="p2" type="number" min="0" value="0"></label><label class="field">Titipan I<input id="t1" type="number" min="0" value="0"></label><label class="field">Titipan II<input id="t2" type="number" min="0" value="0"></label><label class="field">Titipan III<input id="t3" type="number" min="0" value="0"></label><label class="field">Tabungan<input id="tb" type="number" min="0" value="0"></label><div class="field full"><small class="muted">Total = Pendapatan I + II − Titipan I − II − III − Tabungan</small></div><div class="field full actions"><button class="primary">Simpan laporan</button></div></form></div></div>`);
 $('#close').onclick=()=>$('#modal').remove();$('#df').onsubmit=async e=>{e.preventDefault();const d=$('#dd').value;if(!d||isFriday(d))return toast(!d?'Tanggal wajib diisi.':'Jumat adalah hari libur operasional.','error');const n=id=>Math.max(0,num($('#'+id).value));const p={unit:'putra',tanggal:d,pendapatan_i:n('p1'),pendapatan_ii:n('p2'),titipan_i:n('t1'),titipan_ii:n('t2'),titipan_iii:n('t3'),tabungan:n('tb')};p.total=p.pendapatan_i+p.pendapatan_ii-p.titipan_i-p.titipan_ii-p.titipan_iii-p.tabungan;const r=await supabaseClient.from('putra_laporan_harian').insert(p);if(r.error)return toast(errText(r.error),'error');$('#modal').remove();toast('Laporan tersimpan','success');daily()}
}
async function cashbook(){
 const data=await query(supabaseClient.from('putra_transaksi').select('*').order('tanggal',{ascending:true}).order('created_at',{ascending:true}));
 let bal=0, totalIn=0,totalOut=0;const rows=data.map(x=>{const n=num(x.nominal);if(x.jenis==='pemasukan'){bal+=n;totalIn+=n}else{bal-=n;totalOut+=n}return `<tr><td>${fmtDate(x.tanggal)}</td><td>${esc(x.no_transaksi)}</td><td>${esc(x.keterangan||x.kategori)}</td><td>${x.jenis==='pemasukan'?money(n):'-'}</td><td>${x.jenis==='pengeluaran'?money(n):'-'}</td><td><b>${money(bal)}</b></td></tr>`});
 $('#app').innerHTML=pageHead('KEUANGAN','Buku Kas','Mutasi kas dari seluruh transaksi yang tercatat.')+`<section class="card section"><div class="metric-strip"><div class="metric"><small>Kas masuk</small><b>${money(totalIn)}</b></div><div class="metric"><small>Kas keluar</small><b>${money(totalOut)}</b></div><div class="metric"><small>Saldo akhir</small><b>${money(bal)}</b></div></div>${table(['Tanggal','Nomor','Keterangan','Masuk','Keluar','Saldo'],rows)}</section>`;
}
async function savings(){
 const data=await query(supabaseClient.from('putra_tabungan').select('*').order('tanggal',{ascending:false}).order('created_at',{ascending:false}));
 let net=0;data.forEach(x=>x.jenis==='setoran'?net+=num(x.nominal):net-=num(x.nominal));
 $('#app').innerHTML=pageHead('SIMPANAN','Tabungan','Kelola setoran, penarikan dan saldo tabungan.','<button class="primary" id="addSave">+ Catat tabungan</button>')+`<section class="card section"><div class="metric-strip"><div class="metric"><small>Saldo tabungan</small><b>${money(net)}</b></div><div class="metric"><small>Setoran</small><b>${money(data.filter(x=>x.jenis==='setoran').reduce((a,x)=>a+num(x.nominal),0))}</b></div><div class="metric"><small>Penarikan</small><b>${money(data.filter(x=>x.jenis==='penarikan').reduce((a,x)=>a+num(x.nominal),0))}</b></div></div>${table(['Tanggal','Jenis','Nominal','Keterangan','Aksi'],data.map(x=>`<tr><td>${fmtDate(x.tanggal)}</td><td><span class="badge ${x.jenis==='setoran'?'in':'out'}">${esc(x.jenis)}</span></td><td><b>${money(x.nominal)}</b></td><td>${esc(x.keterangan||'-')}</td><td><button class="icon-btn delsave" data-id="${x.id}">×</button></td></tr>`))}</section>`;
 $('#addSave').onclick=()=>openSaveModal();document.querySelectorAll('.delsave').forEach(b=>b.onclick=async()=>{if(!confirm('Hapus catatan tabungan?'))return;const r=await supabaseClient.from('putra_tabungan').delete().eq('id',b.dataset.id);if(r.error)return toast(errText(r.error),'error');toast('Catatan dihapus','success');savings()});
}
function openSaveModal(){
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal card"><button class="icon-btn close" id="close">×</button><span class="eyebrow">TABUNGAN</span><h2>Catat tabungan</h2><form id="sf" class="form-grid"><label class="field">Tanggal<input id="sd" type="date" value="${today()}" required></label><label class="field">Jenis<select id="sj"><option value="setoran">Setoran</option><option value="penarikan">Penarikan</option></select></label><label class="field">Nominal<input id="sn" type="number" min="1" required></label><label class="field full">Keterangan<input id="sk" maxlength="200" placeholder="Opsional"></label><div class="field full actions"><button class="primary">Simpan</button></div></form></div></div>`);
 $('#close').onclick=()=>$('#modal').remove();$('#sf').onsubmit=async e=>{e.preventDefault();const n=num($('#sn').value);if(n<=0)return toast('Nominal harus lebih dari 0','error');const r=await supabaseClient.from('putra_tabungan').insert({unit:'putra',tanggal:$('#sd').value,jenis:$('#sj').value,nominal:n,keterangan:$('#sk').value.trim()});if(r.error)return toast(errText(r.error),'error');$('#modal').remove();toast('Tabungan tersimpan','success');savings()}
}
async function reports(){
 $('#app').innerHTML=pageHead('DOKUMEN','Laporan & Export','Unduh data untuk arsip, audit atau pengolahan lanjutan.')+`<section class="card section"><div class="quick-actions"><button id="csv">⇩<b>Export CSV transaksi</b><span class="muted">Format spreadsheet</span></button><button id="json">{}<b>Backup JSON</b><span class="muted">Semua data aplikasi</span></button><button id="print">▤<b>Cetak halaman</b><span class="muted">Format printer B5</span></button><button id="refreshReport">↻<b>Refresh data</b><span class="muted">Sinkronisasi terbaru</span></button></div></section>`;
 $('#csv').onclick=async()=>{try{const data=await getAllTransactions();const cols=['tanggal','no_transaksi','jenis','kategori','akun','nominal','keterangan'];const out='\ufeff'+[cols.join(','),...data.map(x=>cols.map(k=>`"${String(x[k]??'').replaceAll('"','""')}"`).join(','))].join('\\n');download(out,`transaksi-putra-${today()}.csv`,'text/csv;charset=utf-8');toast('CSV berhasil dibuat','success')}catch(e){toast(errText(e),'error')}};
 $('#json').onclick=async()=>{try{const [a,b,c]=await Promise.all([getAllTransactions(),query(supabaseClient.from('putra_laporan_harian').select('*')),query(supabaseClient.from('putra_tabungan').select('*'))]);download(JSON.stringify({exported_at:new Date().toISOString(),transaksi:a,laporan_harian:b,tabungan:c},null,2),`backup-putra-${today()}.json`,'application/json');toast('Backup JSON berhasil dibuat','success')}catch(e){toast(errText(e),'error')}};
 $('#print').onclick=()=>window.print();$('#refreshReport').onclick=()=>load('reports');
}
function download(content,name,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
async function settings(){
 const email=state.session?.user?.email||'-';
 $('#app').innerHTML=pageHead('SISTEM','Pengaturan','Informasi koneksi, akun dan panduan penggunaan.')+`<div class="dashboard-grid"><section class="card section"><span class="eyebrow">AKUN</span><h2>Operator aktif</h2><p><b>${esc(email.split('@')[0])}</b></p><p class="muted">${esc(email)}</p><div class="metric"><small>Status sesi</small><b>● Terautentikasi</b></div></section><section class="card section"><span class="eyebrow">SISTEM</span><h2>Kantin UIMSYA Pro</h2><p class="muted">Versi profesional dengan dashboard analitik, pencarian transaksi, CRUD, buku kas, tabungan dan export.</p><div class="metric"><small>Supabase</small><b>${window.supabaseClient?'Terhubung':'Belum dikonfigurasi'}</b></div></section></div><section class="card section"><span class="eyebrow">PANDUAN</span><h2>Alur kerja yang disarankan</h2><ol class="muted" style="line-height:2"><li>Catat semua pemasukan dan pengeluaran di <b>Transaksi</b>.</li><li>Gunakan <b>Laporan Harian</b> untuk rekonsiliasi operasional.</li><li>Periksa <b>Buku Kas</b> untuk saldo dan mutasi.</li><li>Gunakan <b>Export</b> untuk arsip rutin.</li></ol></section>`;
}
init();
