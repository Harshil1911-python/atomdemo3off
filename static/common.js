const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const toast=(m,t=1800)=>{let e=document.getElementById('atom-toast');if(!e){e=document.createElement('div');e.id='atom-toast';e.className='toast';document.body.appendChild(e)}e.textContent=m;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),t)};
const fmt=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const COLORS=['#dbeafe','#dcfce7','#fef3c7','#fce7f3','#e0e7ff','#ffedd5','#f3e8ff','#ecfdf5'];
let db,_dlgResolve=null;

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open('AtomBills',4);r.onupgradeneeded=e=>{const d=e.target.result;
  if(!d.objectStoreNames.contains('products')){const s=d.createObjectStore('products',{keyPath:'id',autoIncrement:true});s.createIndex('name','name')}
  if(!d.objectStoreNames.contains('transactions'))d.createObjectStore('transactions',{keyPath:'id'});
  if(!d.objectStoreNames.contains('held'))d.createObjectStore('held',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('variants')){const s=d.createObjectStore('variants',{keyPath:'id',autoIncrement:true});s.createIndex('productId','productId')}
  if(!d.objectStoreNames.contains('purchases'))d.createObjectStore('purchases',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('finance'))d.createObjectStore('finance',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('suppliers'))d.createObjectStore('suppliers',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('coupons'))d.createObjectStore('coupons',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('parties'))d.createObjectStore('parties',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('quotations'))d.createObjectStore('quotations',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('pricelists'))d.createObjectStore('pricelists',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('inventoryLogs'))d.createObjectStore('inventoryLogs',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('syncQueue'))d.createObjectStore('syncQueue',{keyPath:'id',autoIncrement:true});
  if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});
};r.onsuccess=e=>{db=e.target.result;res(db)};r.onerror=e=>rej(e.target.error)})}
const all=s=>new Promise((res,rej)=>{const t=db.transaction(s,'readonly').objectStore(s).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
const _putRaw=(s,d)=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).put(d);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});
const TRACK_STORES=['products','transactions','parties','purchases','finance','inventoryLogs','held','coupons','suppliers','quotations','pricelists'];
const put=async(s,d)=>{const id=await _putRaw(s,d);if(TRACK_STORES.includes(s)&&typeof enqueueSync==='function'){try{enqueueSync('put',s,{id:d&&d.id!=null?d.id:id});}catch(e){}}return id;};
const del=(s,id)=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).delete(id);t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});
const clearStore=s=>new Promise((res,rej)=>{const t=db.transaction(s,'readwrite').objectStore(s).clear();t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});
const getById=(s,id)=>new Promise((res,rej)=>{const t=db.transaction(s,'readonly').objectStore(s).get(id);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});

/* ===== Offline-first: sync queue + status (server only on explicit Sync) ===== */
async function enqueueSync(action, store, payload){
  try{
    if(!db) await openDB();
    await put('syncQueue', {action, store, payload, at: new Date().toISOString(), status:'pending'});
    updateOfflineBadge();
  }catch(e){ console.warn('enqueueSync', e); }
}
async function getPendingSyncCount(){
  try{
    if(!db) await openDB();
    const list = await all('syncQueue');
    return (list||[]).filter(x => x.status!=='done').length;
  }catch(e){ return 0; }
}
async function runExplicitSync(){
  /* Core POS never needs server. This only processes local queue + optional future endpoint. */
  try{
    if(!db) await openDB();
    const list = await all('syncQueue');
    const pending = (list||[]).filter(x => x.status!=='done');
    if(!pending.length){ toast('Nothing to sync — all local'); updateOfflineBadge(); return {ok:true, n:0}; }
    // Mark as synced locally (no server required). When you add a real API, POST here.
    for(const item of pending){
      item.status = 'done';
      item.syncedAt = new Date().toISOString();
      await put('syncQueue', item);
    }
    await put('meta', {key:'lastSync', at: new Date().toISOString(), count: pending.length});
    toast('Synced '+pending.length+' change(s) locally');
    updateOfflineBadge();
    return {ok:true, n:pending.length};
  }catch(e){
    toast('Sync failed — data safe offline');
    return {ok:false, error:String(e)};
  }
}
async function checkOfflineReady(){
  const need = ['/','/static/icon-192.png','/static/icon-512.png','/manifest.webmanifest','/sw.js'];
  let missing = [];
  if('caches' in window){
    try{
      const keys = await caches.keys();
      const cache = keys.length ? await caches.open(keys.sort().reverse()[0]) : null;
      if(cache){
        for(const u of need){
          const hit = await cache.match(u);
          if(!hit) missing.push(u);
        }
      } else missing = need.slice();
    }catch(e){ missing = need.slice(); }
  } else missing = need.slice();
  const pending = await getPendingSyncCount();
  const ready = missing.length === 0;
  return {ready, missing, pending, online: navigator.onLine};
}
function updateOfflineBadge(){
  checkOfflineReady().then(st => {
    document.querySelectorAll('.offline-badge').forEach(el => {
      if(st.ready){
        el.textContent = st.pending ? ('Offline · '+st.pending+' pending') : 'Offline-ready';
        el.className = 'offline-badge ok';
      } else {
        el.textContent = 'Caching… open once online';
        el.className = 'offline-badge warn';
      }
    });
  }).catch(()=>{});
}
// Wrap put to auto-queue important stores (non-breaking)


function productIcon(p){
  if(p&&p.photo)return '<img src="'+p.photo+'" alt="" loading="lazy">';
  const c=(p&&p.color)||COLORS[0];
  return '<div class="ico" style="background:'+c+'"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg></div>';
}

function ensureDlg(){
  if($('#appDlg'))return;
  const d=document.createElement('div');
  d.id='appDlg';d.className='dlg';
  d.innerHTML='<div class="dlg-box"><h3 id="dlgTitle">Confirm</h3><p id="dlgMsg"></p><div class="dlg-actions"><button type="button" class="dlg-cancel" id="dlgCancel">Cancel</button><button type="button" class="dlg-ok" id="dlgOk">OK</button></div></div>';
  ($('.app')||document.body).appendChild(d);
  $('#dlgCancel').onclick=()=>{d.classList.remove('on');if(_dlgResolve)_dlgResolve(false);_dlgResolve=null};
  $('#dlgOk').onclick=()=>{d.classList.remove('on');if(_dlgResolve)_dlgResolve(true);_dlgResolve=null};
}
function appPrompt(title,msg,def){
  ensureDlg();
  $('#dlgTitle').textContent=title;
  const msgEl=$('#dlgMsg');msgEl.textContent=msg||'';
  let inp=$('#dlgInput');
  if(!inp){inp=document.createElement('input');inp.id='dlgInput';inp.type='number';inp.style.cssText='width:100%;margin:12px 0 4px;padding:12px;border:1px solid var(--bd,#e2e8f0);border-radius:10px;font-size:16px;font-family:inherit;font-weight:700';msgEl.after(inp)}
  inp.style.display='block';inp.value=def!=null?def:'0';
  const ok=$('#dlgOk');ok.textContent='Continue';ok.className='dlg-ok primary';
  $('#appDlg').classList.add('on');
  return new Promise(r=>{_dlgResolve=v=>{r(v===false?null:inp.value);_dlgResolve=null}});
}
function appConfirm(title,msg,okLabel,danger){
  ensureDlg();
  $('#dlgTitle').textContent=title;
  const msgEl=$('#dlgMsg');msgEl.innerHTML='';msgEl.textContent=msg;
  const ok=$('#dlgOk');ok.textContent=okLabel||'OK';ok.className='dlg-ok'+(danger===false?' primary':'');
  $('#appDlg').classList.add('on');
  return new Promise(r=>{_dlgResolve=r});
}

function closeShell(){
  document.querySelectorAll('.dr.on, .ov.on').forEach(e=>e.classList.remove('on'));
  document.querySelectorAll('.panel-opts').forEach(e=>e.classList.remove('show'));
  document.querySelectorAll('.panel-toggle').forEach(e=>e.classList.remove('open'));
}
function initShell(root){
  root = root || document;
  const menu=root.querySelector('#btnMenu')||root.querySelector('[id$="-btnMenu"]')||root.querySelector('.ib');
  const ov=root.querySelector('#ov')||root.querySelector('[id$="-ov"]')||root.querySelector('.ov');
  const dr=root.querySelector('#dr')||root.querySelector('[id$="-dr"]')||root.querySelector('.dr');
  closeShell();
  if(menu&&dr){
    menu.onclick=e=>{
      e.preventDefault();e.stopPropagation();
      if(dr.classList.contains('on'))closeShell();
      else{dr.classList.add('on');if(ov)ov.classList.add('on')}
    };
  }
  if(ov)ov.onclick=()=>closeShell();
  // bind panel toggle after drawer HTML injected — use event delegation once
  if(!window.__panelToggleBound){
    window.__panelToggleBound=1;
    document.addEventListener('click',function(e){
      const tog=e.target.closest&&e.target.closest('.btn-change-panel, .panel-toggle');
      if(!tog)return;
      const group=tog.closest('.panel-group');
      const opts=group&&group.querySelector('.panel-opts');
      if(opts){opts.classList.toggle('show');tog.classList.toggle('open')}
    });
  }
  if(!window.__installBound){
    window.__installBound=1;
    let deferred=null;
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;document.querySelectorAll('.install-banner').forEach(b=>b.classList.add('show'))});
    document.addEventListener('click',async e=>{
      const ib=e.target.closest&&e.target.closest('.btn-install-pwa');
      if(!ib)return;
      if(!deferred){toast('Use browser menu: Install app');return}
      document.querySelectorAll('.install-banner').forEach(b=>b.classList.remove('show'));
      deferred.prompt();await deferred.userChoice;deferred=null;
    });
  }
  if('serviceWorker' in navigator && !window.__swReg){window.__swReg=1;navigator.serviceWorker.register('/sw.js').catch(()=>{})}
  if(!window.__visBound){window.__visBound=1;document.addEventListener('visibilitychange',()=>{if(!document.hidden)closeShell()})}
}

function panelLinks(active){
  return '<div class="offline-badge">Checking offline…</div>'+
'<div class="install-banner"><p>Install for offline use</p><button type="button" class="btn-install-pwa">Install App</button><p style="margin-top:8px;font-size:11px;opacity:.9;font-weight:500">Chrome: menu → Install app · iOS: Share → Add to Home Screen · Needs HTTPS</p></div>'+
'<button type="button" class="dr-link btn-sync-now" style="margin-bottom:8px;background:#ecfdf5;color:#059669;font-weight:700">↻ Sync / Update (optional)</button>'+
'<div class="panel-group"><button type="button" class="panel-toggle btn-change-panel">'+
'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>'+
'Change Panel<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg></button>'+
'<div class="panel-opts">'+
'<a href="/proprietor" data-panel="proprietor"'+(active==='proprietor'?' class="active"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Proprietor</span></a>'+
'<a href="/billing" data-panel="billing"'+(active==='billing'?' class="active"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>Billing</span></a>'+
'<a href="/accountant" data-panel="accountant"'+(active==='accountant'?' class="active"':'')+'><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>Accountant</span></a>'+
'</div></div>';
}

// SPA: intercept panel links
document.addEventListener('click', function(e){
  const a = e.target.closest && e.target.closest('a[data-panel]');
  if(!a) return;
  e.preventDefault();
  if(typeof showPanel==='function') showPanel(a.getAttribute('data-panel'));
}, true);


function getBrand(){try{const s=JSON.parse(localStorage.getItem('atom_prefs')||'{}');return{store:s.store||'Atom Bills',phone:s.phone||'',addr:s.addr||'',gstin:s.gstin||'',state:s.state||'',gst:+(s.gst||0),footer:s.footer||'Thank you!',color:s.color||'#4f46e5',logo:s.logo||'',layout:s.layout||'classic',paper:+(s.paper||80)}}catch(e){return{store:'Atom Bills',phone:'',addr:'',gstin:'',state:'',gst:0,footer:'Thank you!',color:'#4f46e5',logo:'',layout:'classic',paper:80}}}

function logSession(panel){
  try{
    const key='atom_sessions';
    const list=JSON.parse(localStorage.getItem(key)||'[]');
    const now=new Date();
    const ist=now.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    list.unshift({panel,at:now.toISOString(),ist});
    localStorage.setItem(key,JSON.stringify(list.slice(0,200)));
  }catch(e){}
}

function playBeep(){
  try{
    const a=playBeep._a||(playBeep._a=new Audio('/static/sounds/beep.mp3'));
    a.currentTime=0;a.volume=1;a.play().catch(()=>{});
  }catch(e){
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.connect(g);g.connect(ctx.destination);o.frequency.value=880;
      g.gain.setValueAtTime(0.15,ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.12);
      o.start(ctx.currentTime);o.stop(ctx.currentTime+0.12);
    }catch(x){}
  }
}

async function renderInvoicePng(tx){
  const b=getBrand();
  const items=tx.items||[];
  const W=400,pad=20;
  const lineH=22,headerH=140,footerH=120,itemsH=Math.max(items.length,1)*lineH+40;
  const H=headerH+itemsH+footerH+80;
  const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#0f172a';ctx.textAlign='center';
  ctx.font='bold 18px system-ui,sans-serif';ctx.fillText(b.store||'Atom Bills',W/2,32);
  ctx.font='12px system-ui,sans-serif';ctx.fillStyle='#64748b';
  if(b.addr)ctx.fillText(b.addr,W/2,50);
  if(b.phone)ctx.fillText(b.phone,W/2,66);
  if(b.gstin)ctx.fillText('GSTIN: '+b.gstin,W/2,82);
  ctx.fillStyle='#0f172a';ctx.font='12px system-ui,sans-serif';ctx.textAlign='left';
  ctx.fillText('Bill: '+(tx.id||'').slice(-10),pad,110);
  ctx.fillText((tx.date||'').slice(0,16).replace('T',' '),pad,126);
  ctx.textAlign='right';ctx.fillText(tx.title||'Cash Sale',W-pad,110);
  ctx.fillText((tx.payMethod||'cash').toUpperCase()+(tx.status==='unpaid'?' · UNPAID':''),W-pad,126);
  ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(pad,138);ctx.lineTo(W-pad,138);ctx.stroke();
  let y=158;ctx.font='bold 11px system-ui';ctx.textAlign='left';
  ctx.fillText('ITEM',pad,y);ctx.textAlign='center';ctx.fillText('QTY',W*0.55,y);ctx.textAlign='right';ctx.fillText('AMT',W-pad,y);
  y+=8;ctx.strokeStyle='#f1f5f9';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=18;
  ctx.font='12px system-ui';
  items.forEach(it=>{
    const line=(+it.qty||0)*(+it.price||0);
    ctx.textAlign='left';ctx.fillStyle='#0f172a';
    const nm=(it.name||'').slice(0,28);ctx.fillText(nm,pad,y);
    ctx.textAlign='center';ctx.fillText(String(it.qty||0),W*0.55,y);
    ctx.textAlign='right';ctx.fillText('₹'+Number(line).toLocaleString('en-IN'),W-pad,y);
    y+=lineH;
  });
  y+=10;ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=22;
  const sub=+tx.subtotal||0,gst=+tx.gst||0,disc=+tx.discount||0,tot=+tx.amount||0;
  ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillStyle='#64748b';
  ctx.fillText('Subtotal',pad,y);ctx.textAlign='right';ctx.fillStyle='#0f172a';ctx.fillText('₹'+sub.toLocaleString('en-IN',{maximumFractionDigits:2}),W-pad,y);y+=20;
  ctx.textAlign='left';ctx.fillStyle='#64748b';ctx.fillText('GST',pad,y);ctx.textAlign='right';ctx.fillStyle='#0f172a';ctx.fillText('₹'+gst.toLocaleString('en-IN',{maximumFractionDigits:2}),W-pad,y);y+=20;
  if(disc){ctx.textAlign='left';ctx.fillStyle='#64748b';ctx.fillText('Discount',pad,y);ctx.textAlign='right';ctx.fillStyle='#dc2626';ctx.fillText('- ₹'+disc.toLocaleString('en-IN',{maximumFractionDigits:2}),W-pad,y);y+=20}
  ctx.font='bold 15px system-ui';ctx.textAlign='left';ctx.fillStyle='#0f172a';ctx.fillText('Total',pad,y);ctx.textAlign='right';ctx.fillText('₹'+tot.toLocaleString('en-IN',{maximumFractionDigits:2}),W-pad,y);y+=28;
  ctx.font='11px system-ui';ctx.fillStyle='#94a3b8';ctx.textAlign='center';ctx.fillText(b.footer||'Thank you!',W/2,y);
  return c.toDataURL('image/png');
}
async function sharePngDataUrl(dataUrl,filename){
  try{
    const res=await fetch(dataUrl);const blob=await res.blob();
    const file=new File([blob],filename||'invoice.png',{type:'image/png'});
    if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:'Invoice'});return true;
    }
  }catch(e){}
  const a=document.createElement('a');a.href=dataUrl;a.download=filename||'invoice.png';a.click();return false;
}

async function putTracked(store, data){
  const id = await put(store, data);
  if(['products','transactions','parties','purchases','finance','inventoryLogs','held','coupons','suppliers','quotations','pricelists'].includes(store)){
    enqueueSync('put', store, {id: data.id || id, data});
  }
  return id;
}

document.addEventListener('click', function(e){
  const s = e.target.closest && e.target.closest('.btn-sync-now');
  if(!s) return;
  e.preventDefault();
  if(typeof runExplicitSync==='function') runExplicitSync();
}, true);
document.addEventListener('DOMContentLoaded', function(){ if(typeof updateOfflineBadge==='function') updateOfflineBadge(); });
window.addEventListener('online', function(){ if(typeof updateOfflineBadge==='function') updateOfflineBadge(); });
window.addEventListener('offline', function(){ if(typeof updateOfflineBadge==='function') updateOfflineBadge(); });
