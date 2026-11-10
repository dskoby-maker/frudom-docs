/* ================= Отмена и возврат действий: кнопка «Отменить» внизу слева, Ctrl+Z / Ctrl+Shift+Z =================
   Как работает: у каждой записи (заказчик, товар, цена, документ, задача…) хранится «последний известный вид» (тень).
   Когда сайт отмечает правку (dirty / dirtyPrice / dirtySpec), прежний вид из тени попадает в шаг отмены.
   Черновик документа, заявка, закупка и личные настройки сравниваются с тенью после каждого действия пользователя.
   Действия группируются: одно нажатие = один шаг; набор текста в одном поле подряд = один шаг.
   Сохранение документа в журнал, загрузка из таблицы и автоматические правки в шаги не попадают.
   Отмена сама проверяет, что запись с тех пор не менял кто-то другой — иначе этот кусок пропускается. */
var UNDO=null;
const UN_TABLES=["suppliers","customers","products","contracts","journal","costs","doccosts","psettings","daytasks","prices","specs","purchases","pother","debts","cats","invoices"];
const UN_NOISE=["seen","_new","updated"];   /* служебные поля: «прочитано», время правки — сами по себе не повод для отмены */
const UN_GEN={invoices:"счёта на оплату",suppliers:"поставщика",customers:"заказчика",products:"товара",contracts:"контракта",journal:"документа",costs:"закупочной цены",doccosts:"себестоимости накладной",psettings:"налога",daytasks:"задачи",prices:"цены",specs:"СТЕ/СПГЗ",purchases:"закупки",pother:"прочего дохода/расхода",debts:"долга",cats:"категории"};
const UN_ORDER=["L:draft","L:order","L:zk","journal","customers","products","suppliers","contracts","prices","specs","costs","doccosts","purchases","pother","debts","cats","invoices","psettings","L:prefs","daytasks"];
const UN_DF={supplierId:"поставщик",customerId:"заказчик",branchId:"ОП",contractId:"договор",noCtr:"договор",number:"номер",date:"дата",basis:"основание",shipSel:"адрес доставки",ship:"адрес доставки",buyer:"покупатель",bphone:"телефон покупателя",sign:"печать и подпись",stamp:"печать и подпись"};
const unPj = j => { try{ return j==null?null:JSON.parse(j); }catch(e){ return null; } };
const unPN = l => (l && ((l.name&&String(l.name).trim()) || (prod(l.productId)||{}).name)) || "товар";
function unDraftLabel(b,a){
  if(!b || !a) return "правка документа";
  if(b.id!==a.id){ const j=(D.journal||[]).find(x=>x.id===a.id); return j ? "открытие документа № "+j.number+" на правку" : "новый документ (форма очищена)"; }
  const bl=b.lines||[], al=a.lines||[], bf=bl.filter(l=>l.productId), af=al.filter(l=>l.productId);
  const cnt=L=>{ const m={}; L.forEach(l=>{ m[l.productId]=(m[l.productId]||0)+1; }); return m; }, cb=cnt(bf), ca=cnt(af);
  if(af.length<bf.length){ const gone=Object.keys(cb).filter(k=>(ca[k]||0)<cb[k]); return gone.length===1 && bf.length-af.length===1 ? "удаление «"+unPN(bf.find(l=>l.productId===gone[0]))+"»" : "удаление товаров ("+(bf.length-af.length)+")"; }
  if(af.length>bf.length){ const add=Object.keys(ca).filter(k=>ca[k]>(cb[k]||0)); return add.length===1 && af.length-bf.length===1 ? "добавление «"+unPN(af.find(l=>l.productId===add[0]))+"»" : "добавление товаров ("+(af.length-bf.length)+")"; }
  for(let i=0;i<Math.max(bl.length,al.length);i++){ const x=bl[i]||{}, y=al[i]||{};
    if(String(x.productId||"")!==String(y.productId||"")) return y.productId ? "товар в строке "+(i+1)+": «"+unPN(y)+"»" : "товар в строке "+(i+1);
    if(String(x.price)!==String(y.price)) return "цена «"+unPN(y)+"»";
    if(String(x.qty)!==String(y.qty)) return "количество «"+unPN(y)+"»";
    if(String(x.name||"")!==String(y.name||"")) return "название «"+unPN(y)+"»"; }
  if(al.length!==bl.length) return al.length>bl.length ? "новая строка" : "удаление пустой строки";
  for(const k of Object.keys(UN_DF)) if(JSON.stringify(b[k])!==JSON.stringify(a[k])) return "изменение: "+UN_DF[k];
  return "правка документа";
}
function unPrefsLabel(b,a){ b=b||{}; a=a||{}; const bt=b.tasks||[], at=a.tasks||[];
  if(at.length<bt.length) return "удаление задачи"; if(at.length>bt.length) return "добавление задачи";
  if(JSON.stringify(bt)!==JSON.stringify(at)) return "изменение задачи";
  if(JSON.stringify(b.hide||[])!==JSON.stringify(a.hide||[])) return "скрытие задачи";
  if(JSON.stringify(b.zk)!==JSON.stringify(a.zk)) return "запомненные названия закупки";
  if(JSON.stringify(b.ov)!==JSON.stringify(a.ov)) return "вид таблицы заявки";
  if(b.prSize!==a.prSize || b.skLogSize!==a.skLogSize) return "сколько строк показывать";
  return "личные настройки"; }
/* черновик документа, заявка, закупка, личные настройки — то, что живёт на устройстве */
const UN_LOCAL={
  draft:{tab:"doc", get:()=>{ if(!D.draft) return null; const o=Object.assign({},D.draft); delete o._editBase; return o; },
    set:v=>{ if(!v) return; const c=D.draft||{}, j=(D.journal||[]).find(x=>x.id===v.id);
      if(c.id===v.id && Object.prototype.hasOwnProperty.call(c,"_editBase")) v._editBase=c._editBase;
      else if(j && c.id!==v.id) v._editBase=clone((BASE.journal||{})[j.id]||jRow(j));
      D.draft=v; saveLocal(); }, label:unDraftLabel},
  order:{tab:"order", get:()=>D.order||null, set:v=>{ D.order=v||{qty:{}, extra:[]}; saveLocal(); }, label:()=>"правка заявки"},
  zk:{tab:"purchase", get:()=>{ if(!D.zk) return null; const o=Object.assign({},D.zk); delete o.upd; delete o.synced; return o; },
    set:v=>{ const c=D.zk||{}; v=v||{text:"", date:todayISO(), st:{}};
      if(c.id && (!v.id || v.id===c.id)){ v.id=c.id; v.upd=c.upd; v.synced=c.synced; }
      else if(v.id){ const r=(D.purchases||[]).find(x=>x.id===v.id); if(r){ v.upd=r.updated; v.synced=D.zkSrv?1:0; } }
      D.zk=v; const ta=document.getElementById("zk-src"); if(ta) ta.value=v.text||""; saveLocal(); if(String(v.text||"").trim() && typeof zkAutoSave==="function") zkAutoSave(); },
    label:(b,a)=>(b&&b.id&&b.id!==(a&&a.id) ? (a&&a.id ? "переход к другой закупке" : "новая закупка") : "правка закупки")},
  prefs:{tab:null, get:()=>{ if(!curUser()) return null; const p=getPrefs(); delete p.pfSeen; delete p.skLogSize; return p; },   /* pfSeen — служебная отметка «был во вкладке Прибыль», не шаг отмены */
    set:v=>{ if(!curUser()) return; v=Object.assign({}, v||{}); const g=getPrefs(), ps=g.pfSeen; if(ps) v.pfSeen=ps; else delete v.pfSeen; if(g.skLogSize!=null) v.skLogSize=g.skLogSize; else delete v.skLogSize; setPrefs(v, true); try{ applyTabOrder(); }catch(e){} }, label:unPrefsLabel}
};
const unKey = (t,id) => t+"\u0001"+id;
function unRowJ(t,id){ const r=localRow(t,id); return r==null?null:JSON.stringify(r); }
const unIdx = (t,id) => (t==="prices"||t==="specs") ? -1 : (Array.isArray(D[t]) ? D[t].findIndex(x=>x&&x.id===id) : -1);
function unBuild(t){ const sh=UNDO.sh, p=t+"\u0001"; [...sh.keys()].forEach(k=>{ if(k.startsWith(p)) sh.delete(k); });
  if(t==="prices"||t==="specs"){ const o=D[t]||{}; Object.keys(o).forEach(c=>Object.keys(o[c]||{}).forEach(pp=>{ const id=c+"|"+pp; sh.set(unKey(t,id),{j:unRowJ(t,id), i:-1}); })); }
  else if(Array.isArray(D[t])) D[t].forEach((x,i)=>{ if(x && x.id!=null) sh.set(unKey(t,x.id),{j:JSON.stringify(t==="journal"?jRow(x):x), i}); });
  UNDO.ref[t]=D[t]; }
function unRefs(){ UN_TABLES.forEach(t=>{ if(UNDO.ref[t]!==D[t]) unBuild(t); }); }
function unSyncLocal(){ Object.keys(UN_LOCAL).forEach(n=>{ let j=null; try{ j=JSON.stringify(UN_LOCAL[n].get()); }catch(e){} UNDO.sh.set("L\u0001"+n,{j, i:-1}); }); }
function unResync(){ if(!UNDO || UNDO.paused) return; unRefs(); unSyncLocal(); }
const unSt = tab => (UNDO.st[tab] = UNDO.st[tab] || {u:[], r:[]});
function unUser(){ if(UNDO.user===curUser()) return; UNDO.user=curUser(); UNDO.st={}; UNDO.open=null; UN_TABLES.forEach(unBuild); unSyncLocal(); }
const unLive = () => !!(UNDO.open && Date.now()-UNDO.open.last<2500);
const unRec = () => !UNDO.applying && !UNDO.paused && unLive();
function unStrip(j){ if(j==null) return null; const o=unPj(j); if(!o||typeof o!=="object") return j; UN_NOISE.forEach(f=>delete o[f]); return JSON.stringify(o); }
/* закупке номер (id) присваивается сам при автосохранении — это не правка */
function unNoop(it){ if(!it.loc) return unStrip(it.b)===unStrip(it.a); if(it.b===it.a) return true;
  if(it.loc!=="zk") return false; const x=unPj(it.b), y=unPj(it.a); if(!x || !y || x.id) return false; delete y.id; return JSON.stringify(x)===JSON.stringify(y); }
const unEff = g => [...g.items.values()].filter(it=>!unNoop(it));
/* запись изменилась (вызывается из dirty / dirtyPrice / dirtySpec) */
function undoNote(t,id){ if(!UNDO) return; try{
  const k=unKey(t,id), old=UNDO.sh.get(k), j=unRowJ(t,id), i=unIdx(t,id), known=!!old || UNDO.ref[t]===D[t];
  UNDO.sh.set(k,{j, i:i>=0?i:(old?old.i:-1)});
  if(!known || !unRec()) return; const b=old?old.j:null; if(b===j) return;
  unAdd(k,{t,id},b,j,old?old.i:-1); }catch(e){} }
function unAdd(k, m, b, a, idx){
  const L=m.loc&&UN_LOCAL[m.loc], tab=(L&&L.tab)||UNDO.open.tab;
  let g=UNDO.open.g[tab]; if(!g){ g=UNDO.open.g[tab]={tab, items:new Map(), at:Date.now()}; const s=unSt(tab); s.u.push(g); if(s.u.length>60) s.u.shift(); }
  const it=g.items.get(k); if(it) it.a=a; else g.items.set(k, Object.assign({k, b, a, i:idx}, m));
  g.label=null; unDrawSoon(); }
/* сравнить черновик/заявку/закупку/настройки с тенью; rec — записать разницу в текущий шаг */
function unTick(rec){ if(!UNDO || UNDO.paused) return; unUser();
  Object.keys(UN_LOCAL).forEach(n=>{ let j; try{ j=JSON.stringify(UN_LOCAL[n].get()); }catch(e){ return; }
    const k="L\u0001"+n, old=UNDO.sh.get(k); if(old && old.j===j) return; UNDO.sh.set(k,{j, i:-1});
    if(old && rec && unRec()) unAdd(k,{loc:n},old.j,j,-1); });
  unRefs(); }
function unClose(){ const o=UNDO.open; if(!o) return; UNDO.open=null; clearTimeout(UNDO.ct);
  Object.values(o.g).forEach(g=>{ const s=unSt(g.tab), eff=unEff(g);
    if(!eff.length){ const i=s.u.indexOf(g); if(i>=0) s.u.splice(i,1); } else { s.r=[]; g.label=unLabel(g); } });
  unDrawSoon(); }
function unSig(el){ if(!el || !el.closest) return ""; const r=el.closest("[data-i],[data-id],[data-k],tr,li");
  return [el.tagName, el.id, el.name, el.className, el.dataset&&JSON.stringify(el.dataset), r&&r.dataset&&JSON.stringify(r.dataset)].join("|"); }
/* начало любого действия пользователя (ловим раньше обработчиков сайта) */
function unEvStart(e){ if(!UNDO) return;
  if(e.type==="keydown" && (!(e.key==="Enter" || e.key==="Delete") || (e.target && e.target.tagName==="TEXTAREA"))) return;
  if(e.target && e.target.closest && e.target.closest("#fd-undo")){ unTick(unLive()); unClose(); return; }
  unUser(); const now=Date.now(), o=UNDO.open, live=unLive(), sig=unSig(e.target);
  unTick(live); unRefs();
  if(live && o && o.sig===sig && (e.type==="input" || e.type==="change" || e.type==="paste")) o.last=now;
  else { unClose(); UNDO.open={tab:curTab, sig, last:now, g:{}}; }
  setTimeout(()=>{ unTick(true); unDelToast(); },0);
  clearTimeout(UNDO.ct); UNDO.ct=setTimeout(()=>{ unTick(true); unClose(); },1800); }
/* подписи шагов: «цена «Апельсины»», «удаление заказчика «…»» */
function unName(t,o){ if(!o) return ""; const pn=id=>"«"+((prod(id)||{}).name||"товар")+"»";
  if(t==="journal") return "№ "+o.number+(o.date?" от "+fd(o.date):"");
  if(t==="prices"||t==="specs"||t==="costs") return pn(o.productId);
  if(t==="daytasks") return o.text?"«"+String(o.text).replace(/\s+/g," ").slice(0,40)+"»":"";
  if(t==="contracts") return o.basis?"«"+o.basis+"»":"";
  if(t==="psettings") return o.id?"«"+(sup(o.id).name||"")+"»":"";
  if(t==="purchases") return o.date?"от "+fd(o.date):"";
  if(t==="pother") return (o.note?"«"+o.note+"» ":"")+(o.sum?fm(+o.sum)+" ₽":"");
  if(t==="debts") return (o.name?"«"+o.name+"» ":"")+(o.sum?fm(+o.sum)+" ₽":"");
  if(t==="doccosts"){ const j=(D.journal||[]).find(x=>x.id===o.id); return j?"№ "+j.number:""; }
  return o.name?"«"+o.name+"»":""; }
function unItemLabel(it){ const b=unPj(it.b), a=unPj(it.a);
  if(it.loc) return UN_LOCAL[it.loc].label(b,a);
  const t=it.t, nm=unName(t,a||b);
  if(t==="journal" && a && b){ const ar=x=>{ const s=unPj(x.snap); return !!(s&&s.meta&&s.meta.arch); };
    if(!ar(b) && ar(a)) return "в архив: документ "+nm; if(ar(b) && !ar(a)) return "возврат из архива: документ "+nm; }
  if(t==="daytasks" && a && b && String(a.done||"")!==String(b.done||"")) return (a.done?"отметка «сделано»":"снятие отметки «сделано»")+(nm?" "+nm:"");
  if(t==="prices" && a && b) return "цена "+nm;
  return (!b?"добавление ":!a?"удаление ":"изменение ")+UN_GEN[t]+(nm?" "+nm:""); }
function unLabel(g){ const eff=unEff(g); if(!eff.length) return ""; const kk=it=>it.loc?"L:"+it.loc:it.t, pr=it=>{ const i=UN_ORDER.indexOf(kk(it)); return i<0?99:i; };
  eff.sort((x,y)=>pr(x)-pr(y)); const f=eff[0], same=eff.filter(it=>kk(it)===kk(f)).length-1;
  let s=""; try{ s=unItemLabel(f); }catch(e){ s="последнее действие"; } return s+(same>0 && !f.loc?" и ещё "+same:""); }
const unGL = g => g.label || (g.label=unLabel(g));
const unIsDel = g => unEff(g).some(it=>{ const b=unPj(it.b), a=unPj(it.a);
  if(it.loc==="draft") return b && a && b.id===a.id && (a.lines||[]).filter(l=>l.productId).length<(b.lines||[]).filter(l=>l.productId).length;
  if(it.loc==="prefs") return ((a||{}).tasks||[]).length<((b||{}).tasks||[]).length;
  return !it.loc && b && !a; });
/* после удаления — всплывающее «Удалено · Отменить» */
function unDelToast(){ const o=UNDO.open; if(!o) return; Object.values(o.g).forEach(g=>{ if(g.toasted || g.tab!==curTab || !unIsDel(g)) return; g.toasted=1; g.label=null;
  toast("info","Удалено", unLabel(g).replace(/^удаление\s*/,"")+". Можно вернуть.", {action:{label:"Отменить", fn:()=>unApply(g.tab,false)}}); }); }
function unCur(it){ return it.loc ? null : unStrip(unRowJ(it.t,it.id)); }
function unPut(t,id,j,idx){ const r=unPj(j);
  if(t==="prices"||t==="specs"){ const [c,p]=id.split("|"); D[t]=D[t]||{};
    if(r==null){ if(D[t][c]) delete D[t][c][p]; } else (D[t][c]=D[t][c]||{})[p] = t==="prices" ? r.price : {spec:r.spec||"", ste:r.ste||"", art:r.art||""};
    if(t==="prices") dirtyPrice(c,p); else dirtySpec(c,p); return; }
  const L=D[t]=Array.isArray(D[t])?D[t]:[], i=L.findIndex(x=>x&&x.id===id);
  if(r && t==="journal"){ r.snap=unPj(r.snap); r.sum=+r.sum||0; if(!r.snap) return; }
  if(r){ if(i>=0) L[i]=r; else L.splice(idx>=0?Math.min(idx,L.length):L.length, 0, r); } else if(i>=0) L.splice(i,1);
  dirty(t,id,!r); }
/* отменить (redo=false) или вернуть (redo=true) последний шаг на вкладке */
function unApply(tab, redo){ if(!UNDO) return; tab=tab||curTab;
  if(syncBlocked){ showConflicts(conflictList); return; }
  unTick(unLive()); unClose();
  const s=unSt(tab), from=redo?s.r:s.u, to=redo?s.u:s.r; let g=null;
  while(from.length){ const x=from.pop(); if(unEff(x).length){ g=x; break; } }
  if(!g){ unDraw(); return; }
  const its=unEff(g), want=redo?"a":"b", have=redo?"b":"a", lab=unGL(g);
  const bad=its.filter(it=>!it.loc && unCur(it)!==unStrip(it[have])), ok=its.filter(it=>!bad.includes(it));
  if(!ok.length){ unDraw(); toast("warn", redo?"Не получилось вернуть":"Не получилось отменить", "«"+lab+"» — эти данные уже изменились после этого (возможно, на другом устройстве). Шаг пропущен."); return; }
  UNDO.applying=true; const dates=new Set(); let tasksDone=false;
  try{
    ok.forEach(it=>{
      if(it.loc){ UN_LOCAL[it.loc].set(unPj(it[want])); return; }
      unPut(it.t, it.id, it[want], it.i);
      if(it.t==="daytasks") tasksDone=true;
      if(it.t==="journal") [it.a,it.b].forEach(x=>{ const o=unPj(x); if(o&&o.date) dates.add(o.date); });
    });
    if(dates.size && !tasksDone) docTasks([...dates], true);
    saveLocal();
  }catch(e){ toast("err","Ошибка отмены", String(e&&e.message||e)); }
  finally{ UNDO.applying=false; }
  to.push(g);
  try{ rerender(); }catch(e){}
  if(tab==="purchase" && typeof drawHist==="function"){ try{ drawHist(); }catch(e){} }
  unResync(); unDraw();
  logEv("Отмена", (redo?"Возвращено: ":"Отменено: ")+lab);
  toast(bad.length?"warn":"ok", redo?"Возвращено":"Отменено", lab+(bad.length?". Часть уже изменилась после этого — её не трогал.":""), {ms:bad.length?7000:3000});
}
/* кнопки «Отменить» / «Вернуть» внизу слева */
const UN_IC={u:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/></svg>',
  r:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/></svg>'};
function unBar(){ let el=document.getElementById("fd-undo"); if(el) return el;
  el=document.createElement("div"); el.id="fd-undo"; el.hidden=true; el.setAttribute("role","toolbar"); el.setAttribute("aria-label","Отмена действий");
  el.innerHTML=`<button type="button" class="u">${UN_IC.u}<span><b>Отменить</b><small></small></span></button><button type="button" class="r">${UN_IC.r}<span><b>Вернуть</b><small></small></span></button>`;
  el.querySelector(".u").onclick=()=>unApply(curTab,false); el.querySelector(".r").onclick=()=>unApply(curTab,true);
  (document.getElementById("fd-app")||document.body).appendChild(el); return el; }
const unTop = arr => { for(let i=arr.length-1;i>=0;i--) if(unEff(arr[i]).length) return arr[i]; return null; };
let unDrawT=0;
function unDrawSoon(){ if(unDrawT) return; unDrawT=setTimeout(()=>{ unDrawT=0; unDraw(); },30); }
function unDraw(){ if(!UNDO) return; const el=unBar(), s=unSt(curTab), u=unTop(s.u), r=unTop(s.r);
  const main=document.getElementById("fd-main"), login=document.getElementById("fd-login");
  const vis=!!(u||r) && !(main&&main.hidden) && (!login||login.hidden);
  el.hidden=!vis; document.body.classList.toggle("fd-undo-on", vis); if(!vis) return;
  const mac=/Mac|iPhone|iPad/.test(navigator.platform||""), kz=mac?"⌘Z":"Ctrl+Z", ky=mac?"⇧⌘Z":"Ctrl+Shift+Z";
  const bu=el.querySelector(".u"), br=el.querySelector(".r");
  bu.hidden=!u; br.hidden=!r;
  if(u){ const l=unGL(u); bu.querySelector("small").textContent=l; bu.title="Отменить: "+l+" ("+kz+")"; bu.setAttribute("aria-label","Отменить: "+l); }
  if(r){ const l=unGL(r); br.querySelector("small").textContent=l; br.title="Вернуть: "+l+" ("+ky+")"; br.setAttribute("aria-label","Вернуть: "+l); br.classList.toggle("only", !u); }
}
/* служебные места сайта, правки которых не отменяются кнопкой (загрузка из таблицы, сохранение документа) */
(function(){
  const quiet=fn=>function(){ if(UNDO) UNDO.paused++; try{ return fn.apply(this,arguments); } finally{ if(UNDO){ UNDO.paused--; unResync(); } } };
  applyServer=quiet(applyServer); serverPrefs=quiet(serverPrefs); zkMerge=quiet(zkMerge); zkAdopt=quiet(zkAdopt); patchAll=quiet(patchAll);
  const cd=commitDoc; commitDoc=async function(){ if(UNDO) UNDO.paused++; try{ return await cd.apply(this,arguments); } finally{ if(UNDO){ UNDO.paused--; unResync(); unDraw(); } } };
  const pl=putLocalRow; putLocalRow=function(t,id){ const r=pl.apply(this,arguments); if(UNDO){ try{ UNDO.sh.set(unKey(t,id),{j:unRowJ(t,id), i:unIdx(t,id)}); }catch(e){} } return r; };
  const st=showTab; showTab=function(){ const r=st.apply(this,arguments); if(UNDO) unDraw(); return r; };
  const ar=applyRole; applyRole=function(){ const r=ar.apply(this,arguments); if(UNDO){ unUser(); unDraw(); } return r; };
})();
UNDO={sh:new Map(), ref:{}, st:{}, open:null, paused:0, applying:false, user:curUser(), ct:0};
UN_TABLES.forEach(unBuild); unSyncLocal();
["click","input","change","paste","drop","keydown"].forEach(t=>document.addEventListener(t, unEvStart, true));
/* Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y. В поле, где вы сейчас печатаете, Ctrl+Z работает как обычно (отменяет набранные буквы) */
document.addEventListener("focusin", e=>{ const el=e.target; if(el && "value" in el) el._unV=el.value; }, true);
document.addEventListener("keydown", e=>{ if(!UNDO || !(e.ctrlKey||e.metaKey) || e.altKey) return;
  const k=String(e.key||"").toLowerCase(), z=e.code==="KeyZ"||k==="z"||k==="я", y=e.code==="KeyY"||k==="y"||k==="н"; if(!z && !y) return;
  const el=e.target, txt=el && (el.isContentEditable || el.tagName==="TEXTAREA" || (el.tagName==="INPUT" && !/^(checkbox|radio|button|submit|file|range|color)$/i.test(el.type||"")));
  if(txt && el.value!==el._unV) return;   /* в поле уже что-то напечатано — пусть браузер отменит буквы */
  if(document.querySelector("#pv:not([hidden]), dialog[open], #fd-app .modal:not([hidden])")) return;
  const main=document.getElementById("fd-main"); if(main && main.hidden) return;
  e.preventDefault(); unApply(curTab, y || e.shiftKey);
}, true);
unDraw();
