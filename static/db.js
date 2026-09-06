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
function resolveStore(s){
  if(s==='parties') return 'customers'; // default; put/all override for suppliers
  return STORE_ALIAS.hasOwnProperty(s)?STORE_ALIAS[s]:s;
}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open(IDB_NAME,IDB_VERSION);
r.onupgradeneeded=e=>{const d=e.target.result;
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
};
r.onsuccess=e=>{db=e.target.result;migrateLegacy().then(()=>res(db)).catch(()=>res(db))};
r.onerror=e=>rej(e.target.error)})}

async function migrateLegacy(){
  if(!db) return;
  const map=[['transactions','sales'],['parties','customers'],['held','heldBills'],['inventoryLogs','stockMovements'],['finance','expenses']];
  for(const [from,to] of map){
    if(!db.objectStoreNames.contains(from)||!db.objectStoreNames.contains(to)) continue;
    try{
      const rows=await new Promise((res,rej)=>{const t=db.transaction(from,'readonly').objectStore(from).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
      if(!rows.length) continue;
      const existing=await new Promise((res,rej)=>{const t=db.transaction(to,'readonly').objectStore(to).getAll();t.onsuccess=()=>res(t.result||[]);t.onerror=()=>rej(t.error)});
      if(existing.length) continue;
      const tx=db.transaction(to,'readwrite');const store=tx.objectStore(to);
      for(const row of rows){
        try{
          const copy=Object.assign({},row);
          // settings-like rows skipped in this map
          store.put(copy);
        }catch(x){}
      }
      await new Promise((res,rej)=>{tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)});
    }catch(e){console.warn('migrate',from,e)}
  }
}

function _rawAll(storeName){
  return new Promise((res,rej)=>{
    if(!db||!storeName||!db.objectStoreNames.contains(storeName)) return res([]);
    try{
      const t=db.transaction(storeName,'readonly').objectStore(storeName).getAll();
      t.onsuccess=()=>res(t.result||[]);
      t.onerror=()=>res([]); // never reject — avoid app crash
    }catch(e){res([])}
  });
}
function _rawPut(storeName,data){
  return new Promise((res)=>{
    if(!db||!storeName||!db.objectStoreNames.contains(storeName)) return res(null);
    try{
      const d=Object.assign({},data);
      // settings must have key
      if(storeName==='settings'){
        if(d.key==null&&d.id!=null){d.key=d.id;delete d.id}
        if(d.key==null) return res(null);
      } else {
        // strip invalid undefined id so autoIncrement works
        if(d.id===undefined||d.id===null||d.id==='') delete d.id;
      }
      const t=db.transaction(storeName,'readwrite').objectStore(storeName).put(d);
      t.onsuccess=()=>res(t.result);
      t.onerror=()=>{console.warn('put fail',storeName,t.error);res(null)};
    }catch(e){console.warn('put err',storeName,e);res(null)}
  });
}
function _rawGet(storeName,id){
  return new Promise((res)=>{
    if(!db||!storeName||!db.objectStoreNames.contains(storeName)) return res(undefined);
    try{
      const t=db.transaction(storeName,'readonly').objectStore(storeName).get(id);
      t.onsuccess=()=>res(t.result);
      t.onerror=()=>res(undefined);
    }catch(e){res(undefined)}
  });
}
function _rawDel(storeName,id){
  return new Promise((res)=>{
    if(!db||!storeName||!db.objectStoreNames.contains(storeName)) return res();
    try{
      const t=db.transaction(storeName,'readwrite').objectStore(storeName).delete(id);
      t.onsuccess=()=>res();t.onerror=()=>res();
    }catch(e){res()}
  });
}
function _rawClear(storeName){
  return new Promise((res)=>{
    if(!db||!storeName||!db.objectStoreNames.contains(storeName)) return res();
    try{
      const t=db.transaction(storeName,'readwrite').objectStore(storeName).clear();
      t.onsuccess=()=>res();t.onerror=()=>res();
    }catch(e){res()}
  });
}

/** parties → customers+suppliers merge; suppliers alias */
const all=async(s)=>{
  if(s==='parties'){
    const [c,sup]=await Promise.all([_rawAll('customers'),_rawAll('suppliers')]);
    return [
      ...c.map(x=>({...x,type:x.type||'customer'})),
      ...sup.map(x=>({...x,type:x.type||'supplier'}))
    ];
  }
  return _rawAll(resolveStore(s));
};
const put=async(s,d)=>{
  try{
    let store=s;
    if(s==='parties'){
      store=((d&&d.type)||'customer')==='supplier'?'suppliers':'customers';
    } else {
      store=resolveStore(s);
    }
    // never allow accidental full wipe via put
    if(!store||!d||typeof d!=='object') return null;
    const id=await _rawPut(store,d);
    return id;
  }catch(e){console.warn(e);return null}
};
const del=async(s,id)=>{
  if(s==='parties'){
    await _rawDel('customers',id);await _rawDel('suppliers',id);return;
  }
  return _rawDel(resolveStore(s),id);
};
const clearStore=async(s)=>{
  if(s==='parties'){await _rawClear('customers');await _rawClear('suppliers');return}
  return _rawClear(resolveStore(s));
};
const getById=async(s,id)=>{
  if(s==='parties'){
    const a=await _rawGet('customers',id);if(a)return {...a,type:a.type||'customer'};
    const b=await _rawGet('suppliers',id);if(b)return {...b,type:b.type||'supplier'};
    return undefined;
  }
  return _rawGet(resolveStore(s),id);
};

async function enqueueSync(){}
async function getPendingSyncCount(){return 0}
async function runExplicitSync(){toast('All data is local (IndexedDB)');return {ok:true,n:0}}
async function checkOfflineReady(){
  return {ready:true,missing:[],pending:0,online:navigator.onLine};
}
function updateOfflineBadge(){document.querySelectorAll('.offline-badge').forEach(el=>{el.style.display='none'})}

window.AtomDB={openDB,all,put,del,clearStore,getById,resolveStore,STORES_STRICT,migrateLegacy,updateOfflineBadge,checkOfflineReady};
