/* Atom Bills — IndexedDB layer (single source of truth) */
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const toast=(m,t=1800)=>{let e=document.getElementById('atom-toast');if(!e){e=document.createElement('div');e.id='atom-toast';e.className='toast';document.body.appendChild(e)}e.textContent=m;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),t)};
const fmt=n=>'₹'+Number(n||0).toLocaleString('en-IN');
const COLORS=['#dbeafe','#dcfce7','#fef3c7','#fce7f3','#e0e7ff','#ffedd5','#f3e8ff','#ecfdf5'];
let db,_dlgResolve=null;

const IDB_NAME='AtomBills';
const IDB_VERSION=5;
const STORES_STRICT=['products','categories','customers','suppliers','sales','saleItems','purchases','purchaseItems','payments','expenses','stockMovements','returns','heldBills','users','settings','auditLogs','coupons','quotations','pricelists'];
const STORE_ALIAS={
  transactions:'sales', parties:'customers', held:'heldBills', inventoryLogs:'stockMovements',
  finance:'expenses', meta:'settings', syncQueue:null
};
function resolveStore(s){return STORE_ALIAS.hasOwnProperty(s)?STORE_ALIAS[s]:s}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(IDB_NAME,IDB_VERSION);
r.onupgradeneeded=e=>{const d=e.target.result;const old=e.oldVersion;
  const defs={
    products:{keyPath:'id',autoIncrement:true,indexes:[['name','name'],['barcode','barcode'],['cat','cat']]},
    categories:{keyPath:'id',autoIncrement:true,indexes:[['name','name']]},
    customers:{keyPath:'id',autoIncrement:true,indexes:[['name','name'],['phone','phone']]},
    suppliers:{keyPath:'id',autoIncrement:true,indexes:[['name','name'],['phone','phone']]},
    sales:{keyPath:'id',autoIncrement:true,indexes:[['date','date'],['customerId','customerId'],['status','status']]},
    saleItems:{keyPath:'id',autoIncrement:true,indexes:[['saleId','saleId'],['productId','productId']]},
    purchases:{keyPath:'id',autoIncrement:true,indexes:[['date','date'],['supplierId','supplierId']]},
    purchaseItems:{keyPath:'id',autoIncrement:true,indexes:[['purchaseId','purchaseId'],['productId','productId']]},
    payments:{keyPath:'id',autoIncrement:true,indexes:[['date','date'],['partyId','partyId'],['refType','refType']]},
    expenses:{keyPath:'id',autoIncrement:true,indexes:[['date','date'],['category','category']]},
    stockMovements:{keyPath:'id',autoIncrement:true,indexes:[['productId','productId'],['at','at'],['reason','reason']]},
    returns:{keyPath:'id',autoIncrement:true,indexes:[['date','date'],['type','type'],['refId','refId']]},
    heldBills:{keyPath:'id',autoIncrement:true,indexes:[['at','at']]},
    users:{keyPath:'id',autoIncrement:true,indexes:[['username','username']]},
    settings:{keyPath:'key'},
    auditLogs:{keyPath:'id',autoIncrement:true,indexes:[['at','at'],['action','action']]},
    coupons:{keyPath:'id',autoIncrement:true,indexes:[['code','code']]},
    quotations:{keyPath:'id',autoIncrement:true,indexes:[['date','date']]},
    pricelists:{keyPath:'id',autoIncrement:true,indexes:[['partyId','partyId'],['productId','productId']]}
  };
  for(const [name,cfg] of Object.entries(defs)){
    if(!d.objectStoreNames.contains(name)){
      const s=d.createObjectStore(name,{keyPath:cfg.keyPath,autoIncrement:!!cfg.autoIncrement});
      (cfg.indexes||[]).forEach(([n,k])=>{try{s.createIndex(n,k)}catch(x){}});
    }
  }
  // one-time migrate from v4 store names if present in same DB upgrade path
  // (data copy happens after open via migrateLegacy)
};
r.onsuccess=e=>{db=e.target.result;migrateLegacy().then(()=>res(db)).catch(()=>res(db))};
r.onerror=e=>rej(e.target.error)})}

async function migrateLegacy(){
  if(!db) return;
  const map=[['transactions','sales'],['parties','customers'],['held','heldBills'],['inventoryLogs','stockMovements'],['finance','expenses'],['meta','settings']];
  for(const [from,to] of map){
    if(!db.objectStoreNames.contains(from)||!db.objectStoreNames.contains(to)) continue;
    try{
      const rows=await new Promise((res,rej)=>{const t=db.transaction(from,'readonly').objectStore(from).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
      if(!rows.length) continue;
      const existing=await new Promise((res,rej)=>{const t=db.transaction(to,'readonly').objectStore(to).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
      if(existing.length) continue; // already migrated
      const tx=db.transaction(to,'readwrite');const store=tx.objectStore(to);
      for(const row of rows){try{store.put(row)}catch(x){}}
      await new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)});
    }catch(e){console.warn('migrate',from,e)}
  }
}

const all=s=>new Promise((res,rej)=>{s=resolveStore(s);if(!s||!db.objectStoreNames.contains(s))return res([]);const t=db.transaction(s,'readonly').objectStore(s).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
const _putRaw=(s,d)=>new Promise((res,rej)=>{s=resolveStore(s);if(!s||!db.objectStoreNames.contains(s))return res(null);const t=db.transaction(s,'readwrite').objectStore(s).put(d);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});
const TRACK_STORES=STORES_STRICT.slice();
const put=async(s,d)=>{const id=await _putRaw(s,d);return id;};
const del=(s,id)=>new Promise((res,rej)=>{s=resolveStore(s);if(!s)return res();const t=db.transaction(s,'readwrite').objectStore(s).delete(id);t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});
const clearStore=s=>new Promise((res,rej)=>{s=resolveStore(s);if(!s||!db.objectStoreNames.contains(s))return res();const t=db.transaction(s,'readwrite').objectStore(s).clear();t.onsuccess=()=>res();t.onerror=()=>rej(t.error)});
const getById=(s,id)=>new Promise((res,rej)=>{s=resolveStore(s);if(!s)return res(undefined);const t=db.transaction(s,'readonly').objectStore(s).get(id);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)});

/* ===== Offline badge only (no server sync) ===== */
async function enqueueSync(){/* no-op: pure offline IndexedDB */}
async function getPendingSyncCount(){return 0}
async function runExplicitSync(){toast('All data is local (IndexedDB)');return {ok:true,n:0}}
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
  return {ready: missing.length===0, missing, pending:0, online: navigator.onLine};
}
function updateOfflineBadge(){ document.querySelectorAll('.offline-badge').forEach(el=>{el.style.display='none'}); }


// Wrap put to auto-queue important stores (non-breaking)



window.AtomDB={openDB,all,put,del,clearStore,getById,resolveStore,STORES_STRICT,migrateLegacy,updateOfflineBadge,checkOfflineReady};
