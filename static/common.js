/* Atom Bills — shared UI (requires db.js first) */
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
  if(!inp){inp=document.createElement('input');inp.id='dlgInput';inp.type='text';inp.style.cssText='width:100%;margin:12px 0 4px;padding:12px;border:1px solid var(--bd,#e2e8f0);border-radius:10px;font-size:16px;font-family:inherit;font-weight:700';msgEl.after(inp)}inp.type=(def!=null&&def!==''&&!isNaN(+def)&&String(def).trim()!=='')?'number':'text';
  inp.style.display='block';inp.value=def!=null?def:'';
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
    window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;/* install banner removed */});
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
  return '<div class="panel-group"><button type="button" class="panel-toggle btn-change-panel">'+
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


function getBrand(){try{const s=JSON.parse(localStorage.getItem('atom_prefs')||'{}');return{store:s.store||'Atom Bills',phone:s.phone||'',addr:s.addr||'',gstin:s.gstin||'',state:s.state||'',gst:+(s.gst||0),gstEnabled:s.gstEnabled!==false,footer:s.footer||'Thank you!',color:s.color||'#4f46e5',logo:s.logo||'',layout:s.layout||'classic',paper:+(s.paper||80)}}catch(e){return{store:'Atom Bills',phone:'',addr:'',gstin:'',state:'',gst:0,gstEnabled:true,footer:'Thank you!',color:'#4f46e5',logo:'',layout:'classic',paper:80}}}

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
  const gstOn=b.gstEnabled!==false && !!(b.gstin||b.gst||tx.gst);
  const items=tx.items||[];
  const W=420,pad=18;
  const lineH=18;
  const headerH=gstOn?168:130;
  const taxRows=gstOn?4:0;
  const itemsH=Math.max(items.length,1)*lineH+48;
  const H=headerH+itemsH+120+taxRows*16+40;
  const c=document.createElement('canvas');c.width=W;c.height=H;const ctx=c.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
  // Header
  ctx.fillStyle='#0f172a';ctx.textAlign='center';
  ctx.font='bold 17px system-ui,sans-serif';ctx.fillText(b.store||'Atom Bills',W/2,26);
  ctx.font='11px system-ui,sans-serif';ctx.fillStyle='#64748b';
  let hy=42;
  if(b.addr){ctx.fillText(b.addr.slice(0,48),W/2,hy);hy+=14}
  if(b.phone){ctx.fillText('Ph: '+b.phone,W/2,hy);hy+=14}
  if(gstOn&&b.gstin){ctx.fillStyle='#0f172a';ctx.font='bold 11px system-ui';ctx.fillText('GSTIN: '+b.gstin,W/2,hy);hy+=14}
  if(gstOn){ctx.font='10px system-ui';ctx.fillStyle='#64748b';ctx.fillText('TAX INVOICE',W/2,hy);hy+=12}
  ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(pad,hy+4);ctx.lineTo(W-pad,hy+4);ctx.stroke();
  let y=hy+20;
  ctx.fillStyle='#0f172a';ctx.font='11px system-ui';ctx.textAlign='left';
  ctx.fillText('Bill: '+(tx.billNo||tx.id||''),pad,y);
  ctx.textAlign='right';ctx.fillText((tx.date||'').slice(0,16).replace('T',' '),W-pad,y);y+=14;
  ctx.textAlign='left';ctx.fillText('Buyer: '+(tx.title||'Cash Sale'),pad,y);
  ctx.textAlign='right';ctx.fillText((tx.payMethod||'cash').toUpperCase()+(tx.status==='unpaid'?' · UNPAID':tx.status==='partial'?' · PARTIAL':tx.status==='void'?' · VOID':''),W-pad,y);y+=10;
  ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=16;
  // Columns
  ctx.font='bold 10px system-ui';ctx.textAlign='left';ctx.fillStyle='#64748b';
  ctx.fillText('#',pad,y);
  ctx.fillText('ITEM',pad+18,y);
  if(gstOn)ctx.fillText('HSN',W*0.42,y);
  ctx.textAlign='center';ctx.fillText('QTY',W*0.58,y);
  ctx.textAlign='right';ctx.fillText('RATE',W*0.78,y);
  ctx.fillText('AMT',W-pad,y);
  y+=6;ctx.strokeStyle='#f1f5f9';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=14;
  ctx.font='11px system-ui';ctx.fillStyle='#0f172a';
  let i=1;
  items.forEach(it=>{
    const line=(+it.qty||0)*(+it.price||0);
    ctx.textAlign='left';ctx.fillText(String(i++),pad,y);
    ctx.fillText((it.name||'').slice(0,gstOn?16:22),pad+18,y);
    if(gstOn)ctx.fillText((it.hsn||'—').toString().slice(0,8),W*0.42,y);
    ctx.textAlign='center';ctx.fillText(String(it.qty||0),W*0.58,y);
    ctx.textAlign='right';ctx.fillText(Number(it.price||0).toFixed(2),W*0.78,y);
    ctx.fillText(Number(line).toFixed(2),W-pad,y);
    y+=lineH;
  });
  y+=6;ctx.strokeStyle='#e2e8f0';ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(W-pad,y);ctx.stroke();y+=18;
  const sub=+tx.subtotal||0,gst=+tx.gst||0,disc=+tx.discount||0,tot=+tx.amount||0;
  const taxable=sub||Math.max(0,tot-gst);
  const cgst=gst/2,sgst=gst/2;
  function row(label,val,bold,col){
    ctx.font=(bold?'bold ':'')+'11px system-ui';ctx.textAlign='left';ctx.fillStyle=col||'#64748b';
    ctx.fillText(label,pad,y);ctx.textAlign='right';ctx.fillStyle=col||'#0f172a';
    ctx.fillText('₹'+Number(val).toLocaleString('en-IN',{maximumFractionDigits:2}),W-pad,y);y+=16;
  }
  row('Taxable value',taxable);
  if(disc)row('Discount',-disc,false,'#dc2626');
  if(gstOn){
    const shopState=String(b.state||'').slice(0,2);
    const buyerState=String(tx.buyerState||tx.state||shopState).slice(0,2);
    const inter=shopState&&buyerState&&shopState!==buyerState;
    if(inter){
      row('IGST @ integrated',gst,true);
    } else {
      row('CGST',cgst);
      row('SGST',sgst);
      row('Total tax',gst,true);
    }
    ctx.font='9px system-ui';ctx.fillStyle='#94a3b8';ctx.textAlign='left';
    ctx.fillText(inter?('Inter-state · Place of supply: '+buyerState):('Intra-state · State '+shopState),pad,y);y+=12;
  } else if(gst){
    row('GST',gst);
  }
  ctx.font='bold 14px system-ui';ctx.textAlign='left';ctx.fillStyle='#0f172a';
  ctx.fillText('Grand Total',pad,y);ctx.textAlign='right';
  ctx.fillText('₹'+Number(tot).toLocaleString('en-IN',{maximumFractionDigits:2}),W-pad,y);y+=22;
  if(tx.received!=null&&tx.balanceDue>0){
    ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillStyle='#64748b';
    ctx.fillText('Received',pad,y);ctx.textAlign='right';ctx.fillStyle='#0f172a';ctx.fillText('₹'+Number(tx.received).toLocaleString('en-IN'),W-pad,y);y+=14;
    ctx.textAlign='left';ctx.fillStyle='#b45309';ctx.fillText('Balance due',pad,y);ctx.textAlign='right';ctx.fillText('₹'+Number(tx.balanceDue).toLocaleString('en-IN'),W-pad,y);y+=16;
  }
  if(gstOn){
    ctx.font='9px system-ui';ctx.fillStyle='#94a3b8';ctx.textAlign='center';
    ctx.fillText('Supply: '+(b.state?('State '+b.state):'Intra-state')+' · This is a computer generated invoice',W/2,y);y+=12;
  }
  ctx.font='11px system-ui';ctx.fillStyle='#94a3b8';ctx.textAlign='center';
  ctx.fillText(b.footer||'Thank you!',W/2,y);
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
