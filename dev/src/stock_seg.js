/* ================= СКЛАД (общий для всей команды) =================
   Данные склада — только на сервере (действие stock). Сайт показывает их и отправляет операции с постоянным номером (rid):
   повтор после обрыва связи не проводит операцию второй раз. Без связи операция ждёт в очереди «Ожидает отправки».
   Резерв по накладной сервер пересчитывает сам при каждом её сохранении (любой путь: документ, заявка, комплект, импорт). */
var SK_READY=false;
const SK_UNITS0=["кг","г","шт","л","упак","короб"];
const SK_T={in:"Приход", init:"Начальный остаток", ship:"Отгрузка", ret:"Возврат", wo:"Списание", inv:"Инвентаризация", rwout:"Перевзвешивание", rwin:"Перевзвешивание", rwund:"Отмена перевзвешивания", fix:"Исправление прихода", close:"Остаток закрыт", direct:"От Саида"};
const SK_NOSTOCK={close:1, direct:1};
const SKKEY = () => "frudom-stock:"+(curUser()||"-"), SKQKEY = () => "frudom-stockq:"+(curUser()||"-");
var SK=null, SKC=null, skSrv=null, skLoading=false, skT=null; const SKQF={};
try{ SK=JSON.parse(lsGet(SKKEY())||"null"); }catch(e){ SK=null; }
const skD = () => SK || {units:[],items:[],batches:[],moves:[],res:[],files:[],acts:[],log:[],at:""};
const skK = v => String(v==null?"":v).toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
const skN = v => String(v==null?"":v).replace(/\s+/g," ").trim();
const skQf = (q,u) => String(r3(q)).replace(".",",")+(u?" "+u:"");
const skDate = iso => iso ? fd(String(iso).slice(0,10)) : "";
const skWhen = iso => { if(!iso) return ""; const d=new Date(iso); return isNaN(d)?String(iso):d.toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}); };
const skCan = () => !!curUser() && !!pass();
/* ---------- расчётные справочники (пересчитываются, только когда пришли новые данные) ---------- */
function skIdx(){
  const S=skD(); if(SKC && SKC.S===S) return SKC;
  const ag=S.agg||{}, X={S, item:{}, batch:{}, link:{}, fact:Object.assign({}, ag.fact||{}), resB:{}, resL:{}, done:JSON.parse(JSON.stringify(ag.done||{})), byItem:{}, filesI:{}, units:[]};
  S.items.forEach(i=>{ X.item[i.id]=i; let L=[]; try{ L=JSON.parse(i.links||"[]")||[]; }catch(e){} L=L.map(String).filter(Boolean); i._lk=L; i._links=[...new Set(L.map(skLkP))]; L.forEach(e=>X.link[e]=i.id); X.byItem[i.id]=[]; });
  S.batches.forEach(b=>{ X.batch[b.id]=b; (X.byItem[b.itemId]=X.byItem[b.itemId]||[]).push(b); });
  S.moves.forEach(m=>{ if(!SK_NOSTOCK[m.type]) X.fact[m.batchId]=r3((X.fact[m.batchId]||0)+(+m.qty||0));
    if(m.docId){ const k=m.docId+"|"+m.lineId, o=X.done[k]||(X.done[k]={shipped:0, closed:0, ret:0, direct:0, cost:0, retCost:0});
      if(m.type==="ship"){ o.shipped=r3(o.shipped-(+m.qty||0)); o.cost+=(-(+m.qty||0))*(+m.cost||0); if(m.cost===""||m.cost==null) o.noCost=1; }
      else if(m.type==="close") o.closed=r3(o.closed+(+m.qty||0)); else if(m.type==="ret"){ o.ret=r3(o.ret+(+m.qty||0)); o.retCost+=(+m.qty||0)*(+m.cost||0); } else if(m.type==="direct") o.direct=r3(o.direct+(+m.qty||0)); } });
  S.res.forEach(r=>{ X.resB[r.batchId]=r3((X.resB[r.batchId]||0)+(+r.qty||0)); const k=r.docId+"|"+r.lineId; X.resL[k]=r3((X.resL[k]||0)+(+r.qty||0)); });
  S.files.forEach(f=>{ const I=dItems(f); I.forEach(id=>{ (X.filesI[id]=X.filesI[id]||[]).push(f); }); });
  Object.values(X.byItem).forEach(L=>L.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.at).localeCompare(String(b.at))||String(a.id).localeCompare(String(b.id))));
  const seen=new Set(); SK_UNITS0.concat(S.units.map(u=>u.name)).forEach(u=>{ const k=skK(u); if(u && !seen.has(k)){ seen.add(k); X.units.push(u); } });
  SKC=X; return X; }
const skFact = id => skIdx().fact[id]||0, skRes = id => skIdx().resB[id]||0, skFree = id => r3(skFact(id)-skRes(id));
const skRoot = b => { const X=skIdx(); let x=b, n=0; while(x && x.parent && X.batch[x.parent] && n++<20) x=X.batch[x.parent]; return x||b; };
const skExp = b => (skRoot(b)||b).exp||"";
/* связь «позиция документа → товар склада»: "pid" — для всех заказчиков, "pid@ID заказчика" — только для этого заказчика (Code.gs ≥ 43).
   skItemOf(pid, cid): cid — заказчик документа (сначала его связь, потом общая); "" — только общая; без cid — общая или любая (для справки) */
const skLkP = e => String(e||"").split("@")[0], skLkC = e => String(e||"").split("@")[1]||"";
const skLkKey = (pid, cid) => cid ? pid+"@"+cid : pid;
const skLkSrv = () => (D.srvVer||0)>=43;
const skItemOf = (pid, cid) => { const X=skIdx(); if(cid){ const c=X.item[X.link[pid+"@"+cid]]; if(c) return c; }
  const g=X.item[X.link[pid]]; if(g || cid!==undefined) return g||null; return X.S.items.find(i=>(i._links||[]).includes(pid))||null; };
/* заказчик накладной по её ID (для строк, где передан только ID документа) */
let SKJC=null;
function skDocCid(docId){ const J=D.journal||[]; let m=SKJC&&SKJC.J===J&&SKJC.n===J.length?SKJC.m:null, i=m?m[docId]:undefined;
  if(i==null || !J[i] || J[i].id!==docId){ m={}; J.forEach((j,k)=>m[j.id]=k); SKJC={J, n:J.length, m}; i=m[docId]; }
  const j=i!=null?J[i]:null; return j&&j.snap&&j.snap.dr ? j.snap.dr.customerId||"" : ""; }
const skLkScope = (it, pid, cid) => { const X=skIdx(); return cid && X.link[pid+"@"+cid]===it.id ? "cus" : "all"; };
const skLkName = e => { const p=prod(skLkP(e)), c=skLkC(e); return ((p||{}).name||skLkP(e)) + (c?" — только для «"+(cusNm(c)||c)+"»":""); };
function skUnitsOf(itemId){ const m={}, X=skIdx(); (X.byItem[itemId]||[]).forEach(b=>{ const k=skK(b.unit), o=m[k]||(m[k]={unit:b.unit, fact:0, res:0}); o.fact=r3(o.fact+skFact(b.id)); o.res=r3(o.res+skRes(b.id)); });
  return Object.values(m).map(o=>Object.assign(o,{free:r3(o.fact-o.res)})); }
/* фасовка партии: вес (объём) одной штуки в единице партии — только чтобы видеть штуки рядом с кг; остатки, резерв и списание остаются в кг.
   Со старым скриптом таблицы поле не сохраняется на сервере — тогда помним на устройстве (SKPL). */
var SKPL={}; try{ SKPL=JSON.parse(lsGet("frudom-stockpack")||"{}")||{}; }catch(e){ SKPL={}; }
const skPackSave = (id,v) => { if(!id) return; if(+v>0) SKPL[id]=String(v); else delete SKPL[id]; try{ lsSet("frudom-stockpack",JSON.stringify(SKPL)); }catch(e){} };
const skPack = b => { if(!b || skK(b.unit)==="шт") return 0; const v=+String(b.pack!=null&&b.pack!==""?b.pack:(SKPL[b.id]||"")).replace(",","."); if(v>0) return v;
  /* фасовка партии не указана — вес 1 шт товара (вписан руками в карточке товара), иначе из названия («Фасоль … 450г» → 0,45 кг) */
  if(skK(b.unit)==="кг"){ const ip=skIPack(b.itemId); if(ip) return ip; }
  const it=skIdx().item[b.itemId], w=miWeight((it&&it.name)||b.itemName||""); return w && skK(w.unit)===skK(b.unit) ? w.w : 0; };
/* вес 1 шт у товара склада, кг: вписан руками (поле pack товара, Code.gs ≥ 44; со старым скриптом — на устройстве SKIPL) */
var SKIPL={}; try{ SKIPL=JSON.parse(lsGet("frudom-stockipack")||"{}")||{}; }catch(e){ SKIPL={}; }
const skIPackSave = (id,v) => { if(!id) return; if(+v>0) SKIPL[id]=String(v); else delete SKIPL[id]; try{ lsSet("frudom-stockipack",JSON.stringify(SKIPL)); }catch(e){} };
const skIPackSrv = () => (D.srvVer||0)>=44;
const skIPack = id => { const it=skIdx().item[id]; const v=+String(it&&it.pack!=null&&it.pack!==""?it.pack:(SKIPL[id]||"")).replace(",","."); return v>0?v:0; };
/* вес 1 шт для расчёта «шт → кг»: вписанный руками, иначе из названия; {w, src:"own"|"name"} или null */
function skPcW(id){ const ip=skIPack(id); if(ip) return {w:ip, src:"own"}; const it=skIdx().item[id], w=miWeight(it&&it.name); return w&&w.unit==="кг"?{w:w.w, src:"name"}:null; }
const skGr = kg => { const g=kg*1000; return g<1000 ? String(Math.round(g*10)/10).replace(".",",")+" г" : skQf(kg,"кг"); };
/* штуки → килограммы (только для показа): «405 шт ≈ 202,5 кг» */
const skKgTxt = (id, n) => { const w=skPcW(id); return w && n>0 ? "≈ "+skQf(r3(n*w.w),"кг") : ""; };
const skPcN = n => { const k=Math.round(n); return (Math.abs(n-k)<0.01?String(k):"≈ "+String(Math.round(n*10)/10).replace(".",","))+" шт"; };
/* коробки: сколько штук в коробке у партии (поле box; со старым скриптом — на устройстве SKBX). Коробок может быть дробное число: 2,35 кор */
var SKBX={}; try{ SKBX=JSON.parse(lsGet("frudom-stockbox")||"{}")||{}; }catch(e){ SKBX={}; }
const skBoxSave = (id,v) => { if(!id) return; if(+String(v).replace(",",".")>0) SKBX[id]=String(v).replace(",","."); else delete SKBX[id]; try{ lsSet("frudom-stockbox",JSON.stringify(SKBX)); }catch(e){} };
const skBox = b => { if(!b) return 0; const v=+String(b.box!=null&&b.box!==""?b.box:(SKBX[b.id]||"")).replace(",","."); return v>0?v:0; };
const skBxN = n => { const k=Math.round(n); return (Math.abs(n-k)<0.005?String(k):String(Math.round(n*100)/100).replace(".",","))+" кор"; };
/* штук в количестве партии: в «шт» — само количество, иначе по весу 1 шт; null — неизвестно */
const skPcsOf = (b,q) => skK(b.unit)==="шт" ? q : (skPack(b) ? q/skPack(b) : null);
function skPcsBox(b, pc){ const out=[]; if(skK(b.unit)!=="шт") out.push(skPcN(pc)); const bx=skBox(b); if(bx) out.push(skBxN(pc/bx)); return out.join(" · "); }
const skBPcs = (b,q) => { if(!(q>0)) return ""; const pc=skPcsOf(b,q), kg=skK(b.unit)==="шт"?skKgTxt(b.itemId,q):""; return [kg, pc==null?"":skPcsBox(b,pc)].filter(Boolean).join(" · "); };
const skPackTxt = b => { const p=skPack(b), bx=skBox(b); return [p?"1 шт = "+skQf(p,b.unit):"", bx?"в коробке "+String(bx).replace(".",",")+" шт":""].filter(Boolean).join(" · "); };
/* штуки (и коробки) по товару в одной единице: только если у всех партий с остатком они известны (иначе число было бы неполным) */
function skUPcs(itemId, unit, key){ let n=0, nb=0, any=false, boxOk=true;
  for(const b of (skIdx().byItem[itemId]||[])){ if(b.cancel || skK(b.unit)!==skK(unit)) continue; const q=key==="free"?skFree(b.id):key==="res"?skRes(b.id):skFact(b.id); if(!(q>0)) continue;
    const pc=skPcsOf(b,q); if(pc==null){ if(skK(unit)!=="шт") return ""; boxOk=false; continue; } n+=pc; any=true; const bx=skBox(b); if(bx) nb+=pc/bx; else boxOk=false; }
  if(!any) return ""; const out=[]; if(skK(unit)!=="шт") out.push(skPcN(n)); else { const kg=skKgTxt(itemId,n); if(kg) out.push(kg); } if(boxOk && nb>0) out.push(skBxN(nb)); return out.join(" · "); }
/* сколько штук в количестве строки документа: по фасовке партии, из которой возьмём первой (самая ранняя с остатком) */
function skQPcs(itemId, unit, q){ if(!(q>0) || !itemId) return ""; const ok=x=>!x.cancel && skK(x.unit)===skK(unit) && (skK(unit)==="шт"?skBox(x):skPack(x));
  const b=(skIdx().byItem[itemId]||[]).find(x=>ok(x) && skFree(x.id)>0) || (skIdx().byItem[itemId]||[]).slice().reverse().find(ok);
  return b?skBPcs(b,q):""; }
const skFreeU = (itemId, unit) => { const u=skUnitsOf(itemId).find(o=>skK(o.unit)===skK(unit)); return u?u.free:0; };
/* строка накладной: сколько нужно со склада, в резерве, отгружено, нехватка (так же считает сервер) */
function skLineInfo(docId, l, unit, cid){
  const src=l.stk||{}, qty=r3(+l.qty||0), req = src.m==="s" ? qty : src.m==="x" ? Math.min(qty, Math.max(0,r3(+src.q||0))) : 0;
  const X=skIdx(), lid=l.lid||"", d=X.done[docId+"|"+lid]||{shipped:0,closed:0,ret:0,direct:0,cost:0,retCost:0}, res=X.resL[docId+"|"+lid]||0;
  const need=r3(Math.max(0, req-d.shipped-d.closed));
  return {req, qty, res, need, short:r3(Math.max(0,need-res)), shipped:d.shipped, closed:d.closed, ret:d.ret, direct:d.direct, cost:d.cost, retCost:d.retCost, noCost:d.noCost, item:skItemOf(l.productId, cid!==undefined?cid:skDocCid(docId)), unit, m:src.m||""}; }
function skDocLines(j){ if(!j||!j.snap||!j.snap.dr) return []; const P=j.snap.prods||{};
  return (j.snap.dr.lines||[]).filter(l=>l.productId && +l.qty>0).map(l=>Object.assign({l}, skLineInfo(j.id, l, (P[l.productId]||prod(l.productId)||{}).unit||"", j.snap.dr.customerId||""))); }
const skDocHas = j => { const X=skIdx(); return skDocLines(j).some(x=>x.req>0 || x.shipped>0 || x.res>0) || X.S.res.some(r=>r.docId===j.id); };
/* ---------- загрузка и отправка ---------- */
let skRaw="";
function skApply(S, quiet){ if(!S) return; let raw=""; try{ raw=JSON.stringify(Object.assign({}, S, {at:""})); }catch(e){}   /* at — время ответа, меняется всегда */
  if(quiet && raw && raw===skRaw && SK){ SK.at=S.at; try{ lsSet(SKKEY(), JSON.stringify(SK)); }catch(e){} return; } skRaw=raw; SK=S; SKC=null; skSrv=true; try{ lsSet(SKKEY(), JSON.stringify(S)); }catch(e){}
  if(curTab==="stock") renderStock(); if(curTab==="doc") skDocHints(); if(curTab==="calendar") renderCalendar(); if(curTab==="journal" && !document.querySelector("#jr-body details[open]")) renderJournal(); skModalRefresh(); if(quiet) fdCalm(); }
async function skLoad(quiet){
  if(!skCan() || skLoading) return; skLoading=true; skSyncLine();
  try{ const j=await api({action:"stock", op:"load"}); skApply(j.stock, quiet); skReport(); await skFlushQ(); setTimeout(()=>{ try{ pgStockAuto(); }catch(e){} }, 0); }
  catch(e){ if(/unknown action/.test(e.message)){ skSrv=false; if(curTab==="stock") renderStock(); } else if(!quiet) toast("err","Склад не загрузился", e.message); }
  finally{ skLoading=false; skSyncLine(); } }
function skSoon(){ clearTimeout(skT); skT=setTimeout(()=>skLoad(true), 1800); }
const skQ = () => { try{ return JSON.parse(lsGet(SKQKEY())||"[]")||[]; }catch(e){ return []; } };
const skQSet = L => { try{ lsSet(SKQKEY(), L.length?JSON.stringify(L):null); }catch(e){} skSyncLine(); if(curTab==="stock") skDrawPending(); };
async function skRun(q){
  const d = q.op==="file" ? Object.assign({}, q.d, {data:SKQF[q.rid]}) : q.d;
  if(q.op==="file" && !SKQF[q.rid]){ skQSet(skQ().filter(x=>x.rid!==q.rid)); throw new Error("файл не сохранился на устройстве после перезагрузки — прикрепите его ещё раз"); }
  try{ const j=await api({action:"stock", op:q.op, rid:q.rid, d}); skQSet(skQ().filter(x=>x.rid!==q.rid)); delete SKQF[q.rid]; skApply(j.stock); if(q.label && typeof logEvSoft==="function") logEvSoft("Склад", q.label); return j; }
  catch(e){ if(e.net){ const L=skQ(), x=L.find(y=>y.rid===q.rid); if(x){ x.err=e.message; x.tries=(x.tries||0)+1; skQSet(L); } e.queued=true; throw e; }
    skQSet(skQ().filter(x=>x.rid!==q.rid)); delete SKQF[q.rid]; if(/unknown action/.test(e.message)){ skSrv=false; e.message="складу нужен новый скрипт таблицы (Code.gs)"; } throw e; } }
/* операция: сразу в очередь (переживёт перезагрузку), затем отправка. Подтверждение — только после ответа таблицы */
async function skSend(op, d, label){
  const q={rid:"w"+Date.now().toString(36)+uid(), op, d: op==="file"?Object.assign({},d,{data:undefined}):d, label, at:new Date().toISOString(), by:curUser()};
  if(op==="file") SKQF[q.rid]=d.data;
  const L=skQ(); L.push(q); skQSet(L);
  return skRun(q); }
let skFlushing=false;
async function skFlushQ(){ if(skFlushing) return; skFlushing=true; try{ for(const q of skQ()){ try{ await skRun(q); toast("ok","Отправлено: "+q.label,""); }catch(e){ if(e.queued) break; toast("err","Не проведено: "+q.label, e.message); } } } finally{ skFlushing=false; } }
window.addEventListener("online",()=>{ if(skQ().length) skFlushQ(); });
/* ошибка операции: понятная причина, а для обрыва связи — «ждёт отправки» */
function skErr(e, what){ if(e.queued){ toast("info","Нет связи — «"+what+"» ждёт отправки","Отправлю сам, когда появится интернет. Остатки обновятся после ответа таблицы."); return; } toast("err","Не получилось: "+what, e.message); }
function skSyncLine(){ const el=$("#sk-sync"); if(!el) return; const q=skQ().length;
  el.innerHTML = skLoading ? `<i class="spin"></i>Сверяю с таблицей…` : q ? `<i class="w"></i>Ожидает отправки: ${q}` : SK&&SK.at ? `<i class="ok"></i>Сверено ${skWhen(SK.at)}` : ""; }

/* ---------- окно склада (своё, не закрывается от кнопок внутри) ---------- */
let SKM=null, SK_RE=null;   /* SK_RE — как открыть это окно заново (для «‹ Назад»); ставят окна-карточки, формы — нет */
function skModal(render, wide){
  const re=SK_RE; SK_RE=null; skClose(true); const prev=navPrev(); const d=document.createElement("dialog"); d.id="sk-dlg"; d.className="dcard sk"+(wide?" wide":"");
  document.getElementById("fd-app").appendChild(d); SKM={d, render}; skModalRefresh();
  d.addEventListener("cancel",e=>{ e.preventDefault(); if(document.getElementById("fd-help")){ closeHelp(); return; } if(NAV.st.length) navBack(); else skClose(); });   /* Esc сначала закрывает подсказку, потом — назад */
  d.addEventListener("close",()=>{ if(d._bye) return; d._bye=1; if(NAV.st.length&&navBack()) return; if(SKM&&SKM.d===d) SKM=null; navReset(); d.remove(); });   /* закрыли снаружи (кнопка «Назад» в приложении) */
  d.addEventListener("click",e=>{ if(e.target===d){ const r=d.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) skClose(); } });
  navOpen(d, re, prev);
  d.showModal(); requestAnimationFrame(()=>d.classList.add("in")); navAfter(d); return d; }
function skModalRefresh(){ if(!SKM) return; const d=SKM.d, st=d.scrollTop, act=document.activeElement, keep=act&&d.contains(act)&&act.dataset&&act.dataset.keep;
  if(keep) return;   /* пользователь печатает в поле — не перерисовываем под рукой */
  d.innerHTML=SKM.render(); if(d.dataset.nav) navDecorate(d); d.scrollTop=st; }
function skClose(now){ if(!SKM) return; const d=SKM.d; SKM=null; if(now) navStash(d); else navReset(); d._bye=1; if(now){ try{ d.close(); }catch(x){} d.remove(); return; } d.classList.add("out"); setTimeout(()=>{ try{ d.close(); }catch(x){} d.remove(); },180); }
const skHQ = k => HELP[k] ? `<button type="button" class="hq" data-hq="${esc(k)}" aria-label="Подсказка: ${esc(k)}">?</button>` : "";
const skHead = (kick, title, sub, help) => `<div class="dc-head"><div><div class="dc-kicker">${kick}</div><h3>${title}${help?skHQ(help):""}</h3>${sub?`<p class="muted sk-sub">${sub}</p>`:""}</div><button class="dc-x" data-sk="close" aria-label="Закрыть">×</button></div>`;
const skIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-5 9 5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 20v-7h10v7M7 16h10"/></svg>`;

/* ================= вкладка «Склад» ================= */
var SKV={tab:"items", q:"", det:"", hf:"", shown:60};
function renderStock(){
  if(!$("#tab-stock")) return;
  if(skSrv===null && !skLoading) skLoad(true);
  $("#sk-old").hidden = skSrv!==false;
  skSyncLine(); skDrawKpi(); skDrawPending(); skDrawList();
  $("#sk-segs").querySelectorAll("button").forEach(b=>{ const on=b.dataset.skt===SKV.tab; b.classList.toggle("on",on); b.setAttribute("aria-pressed",on); });
  $("#sk-segs").style.setProperty("--i", ["items","exp","files","log"].indexOf(SKV.tab));
}
function skItemsWith(){ const X=skIdx(); return X.S.items.filter(i=>skUnitsOf(i.id).some(u=>u.fact>0)); }
function skDocsRes(){ const X=skIdx(), by={}; X.S.res.forEach(r=>{ (by[r.docId]=by[r.docId]||[]).push(r); }); return by; }
function skShortDocs(){ const out=[]; (D.journal||[]).forEach(j=>{ if(!j.snap||isArch(j)) return; const L=skDocLines(j).filter(x=>x.short>0 && x.item); if(L.length) out.push({j, L}); }); return out; }
function skValue(){ const X=skIdx(); let v=0, unk=0; X.S.batches.forEach(b=>{ const f=skFact(b.id); if(f<=0) return; if(b.price===""||b.price==null) unk++; else v+=f*(+b.price); }); return {v:r2(v), unk}; }
function skDrawKpi(){
  const pos=skItemsWith(), rd=skDocsRes(), sd=skShortDocs(), val=skValue();
  const t=(k,lbl,v,sub)=>`<button type="button" class="skk${SKV.det===k?" on":""}" data-skdet="${k}" aria-expanded="${SKV.det===k}"><small>${lbl}</small><b>${v}</b>${sub?`<span>${sub}</span>`:""}<i aria-hidden="true">›</i></button>`;
  const W=skWaitDocs(), ov=W.filter(o=>o.late), ex=skExpBatches(), np=skIdx().S.batches.filter(b=>!b.cancel && skFact(b.id)>0 && (b.price===""||b.price==null));
  const a=(k,cls,txt)=>`<button type="button" class="ska ${cls}${SKV.det===k?" on":""}" data-skdet="${k}">${txt}</button>`;
  $("#sk-alerts").innerHTML = [W.length?a("wait",ov.length?"bad":"", `🚚 Ждут отгрузки: <b>${W.length}</b>${ov.length?" · просрочено "+ov.length:""}`):"", ex.bad.length?a("exp","bad",`⏰ Просрочено: <b>${ex.bad.length}</b>`):"", ex.soon.length?a("exp","warn",`⏳ Срок ≤ 7 дней: <b>${ex.soon.length}</b>`):"", np.length?a("noprice","",`💲 Без закупочной цены: <b>${np.length}</b>`):""].join("");
  $("#sk-kpi").innerHTML = t("pos","Товарных позиций",pos.length,"с остатком на складе")+t("res","Документов с резервом",Object.keys(rd).length,"")+t("short","Документов с нехваткой",sd.length, sd.length?"нужно докупить или пересчитать":"")+t("val","Стоимость запаса",fm(val.v).replace(/,00$/,"")+" ₽", val.unk?"без цены: "+val.unk+" парт.":"по закупочным ценам партий");
  const box=$("#sk-det"); let h="";
  if(SKV.det==="pos") h=pos.length?`<div class="skdl">${pos.map(i=>`<button type="button" class="skdr" data-skitem="${i.id}"><b>${esc(i.name)}</b><span>${skUnitsOf(i.id).filter(u=>u.fact>0).map(u=>skQf(u.fact,u.unit)).join(" · ")}</span></button>`).join("")}</div>`:`<p class="muted">На складе пусто.</p>`;
  if(SKV.det==="res"){ const X=skIdx(); h=Object.keys(rd).length?`<div class="skdl">${Object.keys(rd).map(id=>{ const j=D.journal.find(x=>x.id===id), L=rd[id], by={}; L.forEach(r=>{ const k=r.itemId+"|"+r.unit; by[k]=by[k]||{n:(X.item[r.itemId]||{}).name||r.itemName, u:r.unit, q:0}; by[k].q=r3(by[k].q+(+r.qty)); });
      return `<button type="button" class="skdr" data-skdoc="${id}"><b>${j?"№ "+esc(j.number)+" от "+fd(j.date)+" — "+esc(jWho(j).main):esc(L[0].doc||id)}</b><span>${Object.values(by).map(o=>esc(o.n)+" "+skQf(o.q,o.u)).join(" · ")}</span></button>`; }).join("")}</div>`:`<p class="muted">Резервов нет.</p>`; }
  if(SKV.det==="short") h=sd.length?`<div class="skdl">${sd.map(o=>`<button type="button" class="skdr bad" data-skdoc="${o.j.id}"><b>№ ${esc(o.j.number)} от ${fd(o.j.date)} — ${esc(jWho(o.j).main)}</b><span>${o.L.map(x=>"не хватает: "+esc(x.item.name)+" "+skQf(x.short,x.unit)).join(" · ")}</span></button>`).join("")}</div><p class="muted sk-hint">Проведите приход и откройте накладную → «Обновить резерв». Или поменяйте источник строки на «Часть со склада».</p>`:`<p class="muted">Нехватки нет.</p>`;
  if(SKV.det==="val"){ const X=skIdx(), rows=X.S.batches.filter(b=>skFact(b.id)>0); h=rows.length?`<div class="tbl"><table class="sk-vt"><thead><tr><th>Товар · партия</th><th class="num">Остаток</th><th class="num">Цена</th><th class="num">Сумма, ₽</th></tr></thead><tbody>${rows.map(b=>{ const f=skFact(b.id), ok=b.price!==""&&b.price!=null; return `<tr data-skbatch="${b.id}"><td><b>${esc((X.item[b.itemId]||{}).name||"")}</b><small>${esc(b.name)}</small></td><td class="num">${skQf(f,b.unit)}</td><td class="num">${ok?fm(+b.price):`<span class="miss">нет</span>`}</td><td class="num">${ok?fm(r2(f*b.price)):"—"}</td></tr>`; }).join("")}</tbody><tfoot><tr><td colspan="3">Итого${val.unk?` <small class="miss">(без ${val.unk} парт. без цены)</small>`:""}</td><td class="num">${fm(val.v)}</td></tr></tfoot></table></div>`:`<p class="muted">На складе пусто.</p>`; }
  if(SKV.det==="wait") h=W.length?`<div class="skdl">${W.map(o=>`<div class="skdr skw${o.late?" bad":""}"><b>№ ${esc(o.j.number)} от ${fd(o.j.date)} — ${esc(jWho(o.j).main)}</b><span>${o.L.map(x=>esc(x.item.name)+" "+skQf(x.need,x.unit)+(x.short?` <em class="miss">нехватка ${skQf(x.short)}</em>`:"")).join(" · ")}${o.late?` · <em class="miss">дата поставки прошла</em>`:""}</span><span class="skwa"><button type="button" class="btn sm" data-skdoc="${o.j.id}">Открыть</button><button type="button" class="btn pri sm" data-skwship="${o.j.id}"${o.L.some(x=>x.res>0)?"":" disabled"}>Отгрузить</button></span></div>`).join("")}</div><p class="muted sk-hint">Накладные, по которым товар со склада ещё не отгружен. Отгружайте, когда товар фактически уехал. Все накладные дня сразу — кнопкой в Календаре.</p>`:`<p class="muted">Всё отгружено.</p>`;
  if(SKV.det==="exp"){ const L=ex.bad.concat(ex.soon); h=L.length?`<div class="skdl">${L.map(b=>`<button type="button" class="skdr${skExpCls(skExp(b))==="bad"?" bad":""}" data-skbatch="${b.id}"><b>${esc((skIdx().item[b.itemId]||{}).name||"")} — ${esc(b.name)}</b><span>${skQf(skFact(b.id),b.unit)} · годен до ${fd(skExp(b))}</span></button>`).join("")}</div>`:`<p class="muted">Сроки в порядке.</p>`; }
  if(SKV.det==="noprice") h=np.length?`<div class="skdl">${np.map(b=>`<button type="button" class="skdr" data-skbatch="${b.id}"><b>${esc((skIdx().item[b.itemId]||{}).name||"")} — ${esc(b.name)}</b><span>${skQf(skFact(b.id),b.unit)} · откройте партию → «Изменить», впишите цену</span></button>`).join("")}</div><p class="muted sk-hint">Без цены себестоимость отгрузки неизвестна — прибыль по таким накладным будет «предварительной».</p>`:"";
  box.innerHTML = h ? `<div class="skdetin">${h}</div>` : ""; box.classList.toggle("open", !!h);
}
/* накладные, где складская часть ещё не отгружена; «просрочено» — дата поставки уже наступила */
function skWaitDocs(){ const out=[], t=todayISO(); (D.journal||[]).forEach(j=>{ if(!j.snap||isArch(j)) return; const L=skDocLines(j).filter(x=>x.item && x.need>0); if(L.length) out.push({j, L, late:j.date<t}); });
  return out.sort((a,b)=>a.j.date.localeCompare(b.j.date)||jNumSort(a.j,b.j)); }
function skExpBatches(){ const X=skIdx(), bad=[], soon=[]; X.S.batches.forEach(b=>{ if(b.cancel || skFact(b.id)<=0) return; const e=skExp(b); if(!e) return; const c=skExpCls(e); if(c==="bad") bad.push(b); else if(c==="warn") soon.push(b); });
  const so=(a,b)=>skExp(a).localeCompare(skExp(b)); return {bad:bad.sort(so), soon:soon.sort(so)}; }
function skDrawPending(){ const L=skQ(), el=$("#sk-pend"); if(!el) return;
  el.innerHTML = L.length ? `<div class="skpend"><b>Ожидает отправки (${L.length})</b>${L.map(q=>`<div><span>${esc(q.label)}</span><small>${skWhen(q.at)}${q.err?" · "+esc(q.err):""}</small></div>`).join("")}<button type="button" class="btn sm" data-sk="flush">Отправить сейчас</button></div>` : ""; }
/* «В наличии / Все» в списке товаров склада (19.11.2026, просьба Даниила): по умолчанию — только то, что есть (остаток или резерв); выбор помнится на устройстве */
const skStkAll = () => { try{ return localStorage.getItem("frudom-skall")==="1"; }catch(_){ return false; } };
function skStkBar(nIn, nAll, all){ if(nAll===nIn && !all) return ""; return `<div class="skstk" role="group" aria-label="Какие товары показать"><span class="skstk-p" style="--x:${all?1:0}"></span><button type="button" data-skstk="in" aria-pressed="${!all}">В наличии <em>${nIn}</em></button><button type="button" data-skstk="all" aria-pressed="${all}">Все товары <em>${nAll}</em></button></div>`; }
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-skstk]"); if(!b) return; const all=b.dataset.skstk==="all"; if(all===skStkAll()) return;
  try{ localStorage.setItem("frudom-skall", all?"1":"0"); }catch(_){}
  const p=document.querySelector(".skstk-p"); if(p) p.style.setProperty("--x", all?1:0);
  setTimeout(()=>{ SKV.cat="all"; skDrawList(); }, p?180:0); });
/* цена в строке склада: за шт и за кг (по весу 1 шт) и стоимость остатка — по партиям с остатком, средняя по количеству */
function skRowPrice(it){ const B=(skIdx().byItem[it.id]||[]).filter(b=>!b.cancel&&skFact(b.id)>0), m=x=>fm(x).replace(/,00$/,"");
  let val=0, nop=0; const U={}; B.forEach(b=>{ const f=skFact(b.id); if(b.price===""||b.price==null||!(+b.price>0)){ nop++; return; } val+=f*(+b.price); const k=skK(b.unit)||"?", o=U[k]||(U[k]={q:0,s:0,w:0,wq:0}); o.q+=f; o.s+=f*(+b.price); const w=skPack(b); if(w>0){ o.w+=w*f; o.wq+=f; } });
  const ks=Object.keys(U).sort((a,b)=>U[b].q-U[a].q); if(!ks.length) return `<span class="skpr">${B.length?`<span class="muted">цена не указана</span>`:""}</span>`;
  const u=ks[0], o=U[u], avg=o.s/o.q, pw=skPcW(it.id), w=o.wq?o.w/o.wq:(pw?pw.w:0); let pc=null, kg=null;
  if(u==="шт"){ pc=avg; if(w>0) kg=Math.ceil(avg/w*100-1e-7)/100; } else if(u==="кг"){ kg=avg; if(w>0) pc=avg*w; }
  const line = pc!=null||kg!=null ? [pc!=null?`<b>${m(pc)} ₽</b><small>/шт</small>`:"", kg!=null?`<b>${m(kg)} ₽</b><small>/кг</small>`:""].filter(Boolean).join(`<i>·</i>`) : `<b>${m(avg)} ₽</b><small>/${esc(u)}</small>`;
  return `<span class="skpr" title="Средняя цена закупки партий с остатком${nop?" · без цены: "+nop+" парт.":""}"><span class="skpp">${line}</span><span class="skpv">остаток на ${m(r2(val))} ₽${nop?" +":""}</span></span>`; }
function skDrawList(){
  const X=skIdx(), q=skK(SKV.q), box=$("#sk-list"); let h=""; const qi=$("#sk-q"); if(qi) qi.placeholder=SKV.tab==="files"?"Поиск декларации: товар, номер, изготовитель":SKV.tab==="log"?"Поиск по истории":"Поиск: товар, другое название, позиция документа";
  const hitI = i => !q || [i.name, i.alt||"", ...(i._links||[]).map(pid=>(prod(pid)||{}).name||"")].some(t=>skK(t).includes(q));
  if(SKV.tab==="items"){ const A0=X.S.items.filter(hitI), inS=i=>skUnitsOf(i.id).some(u=>u.fact>0||u.res>0), nIn=A0.filter(inS).length, all=skStkAll();
    const L0=all?A0:A0.filter(inS); h=skStkBar(nIn, A0.length, all)+skCatChips(L0); const L=L0.filter(skCatOk).sort((a,b)=>{ const fa=skUnitsOf(a.id).some(u=>u.fact>0), fb=skUnitsOf(b.id).some(u=>u.fact>0); return (fb-fa)||a.name.localeCompare(b.name,"ru"); });
    h += L.length ? `<div class="skrows">`+L.map((i,k)=>{ const U=skUnitsOf(i.id), bs=(X.byItem[i.id]||[]).filter(b=>skFact(b.id)>0), ex=bs.map(skExp).filter(Boolean).sort()[0], F=skItemFiles(i);
      const dl = F.length ? `<button type="button" class="skib" data-skidecl="${i.id}" title="${F.length>1?"Деклараций: "+F.length+" — выбрать, какую скачать":"Скачать декларацию"}" aria-label="Скачать декларацию">${SKI_DL}${F.length>1?`<em>${F.length}</em>`:""}</button>`
        : `<button type="button" class="skib up" data-skiup="${i.id}" title="Декларации нет — загрузить" aria-label="Загрузить декларацию">${SKI_UP}</button>`;
      return `<div class="skrow" role="button" tabindex="0" data-skitem="${i.id}" style="--d:${Math.min(k,12)*25}ms"><span class="skn"><b>${esc(i.name)}${i.note?`<span class="skf" title="${esc(i.note)}"> 💬</span>`:""}</b><small>${i.alt?esc(i.alt)+" · ":""}${(i._links||[]).length?"в документах: "+esc(i._links.map(pid=>(prod(pid)||{}).name||"?").join(", ")):`<span class="miss">не связан с позициями документов</span>`}</small></span>
        <span class="sku">${U.filter(u=>u.fact||u.res).map(u=>`<span class="skuq"><b>${skQf(u.fact,u.unit)}</b>${(pc=>pc?`<i class="skpc">${pc}</i>`:"")(skUPcs(i.id,u.unit,"fact"))}${u.res?`<em>резерв ${skQf(u.res)} · свободно ${skQf(u.free)}</em>`:""}</span>`).join("")||`<span class="muted">нет в наличии</span>`}${ex?`<span class="skexp ${skExpCls(ex)}">до ${fd(ex)}</span>`:""}</span>
        ${skRowPrice(i)}<span class="skm"><button type="button" class="skib" data-skihist="${i.id}" title="История товара: приходы, отгрузки, списания, цены" aria-label="История товара">${SKI_HI}</button>${dl}</span></div>`; }).join("")+`</div>` : (!all && A0.length && !L0.length) ? `<div class="skempty"><b>${q?"В наличии ничего не нашлось":"Сейчас на складе пусто"}</b><span>${q?"Подходит товаров без остатка: "+A0.length+".":"Всего товаров в справочнике склада: "+A0.length+"."}</span><button type="button" class="btn sm" data-skstk="all">Показать все (${A0.length})</button></div>` : `<div class="skempty"><b>${q?"Ничего не найдено":"Склад пока пуст"}</b><span>${q?"Попробуйте другое название.":"Нажмите «+ Приход» или «Начальный остаток», чтобы завести товар."}</span></div>`; }
  if(SKV.tab==="exp"){ const L=X.S.batches.filter(b=>skFact(b.id)>0 && (!q||skK((X.item[b.itemId]||{}).name).includes(q))).sort((a,b)=>(skExp(a)||"9999").localeCompare(skExp(b)||"9999"));
    h = L.length ? L.map(b=>{ const e=skExp(b); return `<button type="button" class="skrow sm" data-skbatch="${b.id}"><span class="skn"><b>${esc((X.item[b.itemId]||{}).name||"")}</b><small>${esc(b.name)} · ${skQf(skFact(b.id),b.unit)}</small></span><span class="skm">${e?`<span class="skexp ${skExpCls(e)}">годен до ${fd(e)}</span>`:`<span class="muted">Срок годности не указан</span>`}</span></button>`; }).join("") : `<div class="skempty"><b>Нет партий с остатком</b></div>`; }
  if(SKV.tab==="files"){ h=skDeclList(SKV.q); }
  if(SKV.tab==="log"){ h=skLogHtml(q, X); }
  box.innerHTML=h;
}
/* ---------- история склада: период, кто, действие, порядок, по страницам ---------- */
const SKLG={per:"all", from:"", to:"", who:"", act:"", sort:"new", page:0};
const skLgSize = () => { const v=(getPrefs().skLogSize); return v===0?1e9:(+v||10); };
const skDay = iso => { const d=new Date(iso); if(isNaN(d)) return ""; return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const skActGroup = a => /^Резерв/.test(a||"") ? "Резерв" : (a||"");
const skActCls = a => /приход|остаток|возврат/i.test(a)&&!/отмен|закрыт/i.test(a)?"in":/отгруз/i.test(a)?"ship":/списан|отмен|удален|удалён|закрыт/i.test(a)?"bad":/инвент|исправл|перевзвеш/i.test(a)?"fix":/деклар/i.test(a)?"doc":/резерв/i.test(a)?"res":/ожидает/i.test(a)?"pend":"";
function skLogHtml(q, X){ const G=SKLG, pend=skQ().map(x=>({at:x.at, by:x.by, action:"Ожидает отправки", object:x.label, pend:1})), all=pend.concat(X.S.log.slice().reverse());
  const t=todayISO(), back=n=>{ const d=new Date(t+"T12:00:00"); d.setDate(d.getDate()-n); return skDay(d.toISOString()); };
  const [d1,d2]=G.per==="today"?[t,t]:G.per==="7"?[back(6),t]:G.per==="30"?[back(29),t]:G.per==="range"?[G.from||"0000-00-00",G.to||"9999-99-99"]:["0000-00-00","9999-99-99"];
  const inPer=l=>{ const d=skDay(l.at); return l.pend || (d>=d1 && d<=d2); }, inQ=l=>!q||skK([l.action,l.object,l.before,l.after,l.reason,l.by].join(" ")).includes(q);
  const base=all.filter(l=>inPer(l)&&inQ(l)), L=base.filter(l=>(!G.who||l.by===G.who) && (!G.act||skActGroup(l.action)===G.act));
  if(G.sort==="old") L.reverse();
  const acts={}; base.filter(l=>!G.who||l.by===G.who).forEach(l=>{ const a=skActGroup(l.action); acts[a]=(acts[a]||0)+1; });
  const whos={}; base.forEach(l=>{ if(l.by) whos[l.by]=(whos[l.by]||0)+1; });
  const size=skLgSize(), pages=Math.max(1,Math.ceil(L.length/size)); if(G.page>=pages) G.page=pages-1; const from=G.page*size, list=L.slice(from, from+size);
  const dayLbl=d=>d===t?"Сегодня":d===back(1)?"Вчера":fd(d)+" · "+new Date(d+"T12:00:00").toLocaleDateString("ru-RU",{weekday:"long"});
  let last="", rows=""; list.forEach((l,k)=>{ const d=l.pend?"pend":skDay(l.at); if(d!==last){ last=d; rows+=`<div class="sklday">${l.pend?"Ожидает отправки":esc(dayLbl(d))}</div>`; } rows+=skLogRow(l,k); });
  const per=[["all","Всё время","Всё"],["today","Сегодня","Сегодня"],["7","7 дней","7 дн."],["30","30 дней","30 дн."],["range","Период…","Период"]];
  if(!RPG.reg.sklg){ const K=()=>{ const t=todayISO(); return {today:[t,t], "7":[pvAddD(t,-6),t], "30":[pvAddD(t,-29),t]}; };
    rpgReg("sklg", { presets:()=>{ const k=K(), P=pvRpPresets(); return [["Сегодня",...k.today],["7 дней",...k["7"]],["30 дней",...k["30"]],P[0],P[1],["Всё время","all","all"]]; },
      get:()=>{ if(SKLG.per==="range") return (SKLG.from&&SKLG.to)?{a:SKLG.from,b:SKLG.to}:{a:"all"}; const k=K()[SKLG.per]; return k?{a:k[0],b:k[1]}:{a:"all"}; },
      set:(a,b)=>{ const k=K(), x=Object.keys(k).find(z=>k[z][0]===a&&k[z][1]===b); if(a==="all") SKLG.per="all"; else if(x) SKLG.per=x; else { SKLG.per="range"; SKLG.from=a; SKLG.to=b; } SKLG.page=0; skLgRedraw(); },
      dots:()=>{ try{ return new Set(SKLG._X.S.log.map(l=>skDay(l.at))); }catch(e){ return new Set(); } } }); }
  SKLG._X=X;
  return `<div class="sklg-bar">${rpgBar("sklg")}
      <div class="sklg-f"><select class="sklg-act" aria-label="Действие"><option value="">Все действия (${base.filter(l=>!G.who||l.by===G.who).length})</option>${Object.keys(acts).sort((a,b)=>a.localeCompare(b,"ru")).map(a=>`<option value="${esc(a)}"${G.act===a?" selected":""}>${esc(a)} (${acts[a]})</option>`).join("")}</select>
        <select class="sklg-who" aria-label="Кто"><option value="">Все сотрудники</option>${Object.keys(whos).sort().map(w=>`<option value="${esc(w)}"${G.who===w?" selected":""}>${esc(w)} (${whos[w]})</option>`).join("")}</select>
        <button type="button" class="btn ghost sm sklg-sort" data-sklg-sort="1" title="Порядок">${G.sort==="new"?"↓ Сначала новые":"↑ Сначала старые"}</button>
        ${G.per!=="all"||G.who||G.act||q?`<button type="button" class="btn ghost sm" data-sklg-reset="1">Сбросить</button>`:""}</div></div>`
    + (L.length ? `<div class="sklog">${rows}</div><div class="pager" id="sk-lgpager">${pagerHtml(G.page, pages, L.length, from, list.length, size)}</div>`
      : `<div class="skempty"><b>Записей нет</b><span>${base.length||all.length?"Поменяйте период или фильтр.":"Здесь появятся приходы, отгрузки, списания и другие действия со складом."}</span></div>`); }
function skLgRedraw(){ skDrawList(); const el=$("#sk-list .sklog"); if(el){ el.classList.remove("pgfade"); void el.offsetWidth; el.classList.add("pgfade"); } }
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest || !t.closest("#sk-list")) return; const G=SKLG;
  const p=t.closest("[data-sklg-per]"); if(p){ G.per=p.dataset.sklgPer; G.page=0; skLgRedraw(); return; }
  if(t.closest("[data-sklg-sort]")){ G.sort=G.sort==="new"?"old":"new"; G.page=0; skLgRedraw(); return; }
  if(t.closest("[data-sklg-reset]")){ Object.assign(G,{per:"all", from:"", to:"", who:"", act:"", page:0}); SKV.q=""; const qi=$("#sk-q"); if(qi) qi.value=""; skLgRedraw(); return; }
  const b=t.closest("#sk-lgpager [data-pg],#sk-lgpager [data-ps]"); if(b && !b.disabled){ if(b.dataset.ps!=null){ const pr=getPrefs(); pr.skLogSize=+b.dataset.ps; setPrefs(pr,true); G.page=0; } else G.page=+b.dataset.pg; skLgRedraw(); const top=$("#sk-segs"); if(top) top.scrollIntoView({behavior:"smooth", block:"start"}); } });
document.addEventListener("change", e=>{ const t=e.target; if(!t.closest || !t.closest("#sk-list")) return; const G=SKLG;
  if(t.classList.contains("sklg-act")){ G.act=t.value; G.page=0; skLgRedraw(); return; }
  if(t.classList.contains("sklg-who")){ G.who=t.value; G.page=0; skLgRedraw(); return; }
  if(t.classList.contains("sklg-from")||t.classList.contains("sklg-to")){ G[t.classList.contains("sklg-from")?"from":"to"]=t.value; G.page=0; skLgRedraw(); } });
const skExpCls = e => { const d=Math.round((new Date(e+"T12:00:00")-new Date(todayISO()+"T12:00:00"))/864e5); return d<0?"bad":d<=7?"warn":""; };
const skLogGo = l => { const X=skIdx(); return l.pend?"" : l.batchId&&X.batch[l.batchId] ? `data-sklgb="${esc(l.batchId)}"` : l.itemId&&X.item[l.itemId] ? `data-sklgi="${esc(l.itemId)}"` : l.docId ? `data-sklgd="${esc(l.docId)}"` : ""; };
const skLogUndo = l => { if(l.action!=="Перевзвешивание") return ""; const b=skIdx().batch[l.batchId]; return b && b.kind==="rw" && skCanRwUndo(b) ? `<button type="button" class="btn ghost sm danger sklu" data-skrwund="${esc(b.id)}">Отменить</button>` : b&&b.cancel?`<small class="muted sklu">отменено</small>`:""; };
const skLogRow = (l,k) => { const tm=l.at?new Date(l.at):null, hm=tm&&!isNaN(tm)?tm.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):"", go=skLogGo(l);
  return `<div class="sklr${l.pend?" pend":""}${go?" go":""}" ${go}${go?` role="button" tabindex="0" title="Открыть и при необходимости исправить"`:""} style="--d:${Math.min(k||0,10)*18}ms"><span class="sklt">${hm}</span><span class="skla ${skActCls(l.action)}" title="${esc(l.action)}">${esc(l.action)}</span><span class="sklo"><b>${esc(l.object||"")}</b>${l.before||l.after?`<small>${l.before&&l.before!=="—"?esc(l.before)+" → ":""}${esc(l.after||"")}</small>`:""}${l.reason?`<small class="muted">${esc(l.reason)}</small>`:""}</span><span class="sklw">${esc(l.by||"")}${skLogUndo(l)}${go?`<i class="sklgo" aria-hidden="true">›</i>`:""}</span></div>`; };
function skLogOpen(r){ if(r.dataset.sklgb) skBatchCard(r.dataset.sklgb); else if(r.dataset.sklgi) skItemCard(r.dataset.sklgi); else if(r.dataset.sklgd){ const j=D.journal.find(x=>x.id===r.dataset.sklgd); if(j) docCard(j, isArch(j)); else toast("info","Накладной нет на этом устройстве","Обновите страницу."); } }
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest || t.closest("button,a,select,input")) return; const r=t.closest(".sklr.go"); if(r) skLogOpen(r); });
document.addEventListener("keydown", e=>{ if(e.key!=="Enter"||!e.target.classList||!e.target.classList.contains("sklr")||!e.target.classList.contains("go")) return; e.preventDefault(); skLogOpen(e.target); });
function skFileRow(f){ return dRow(f); }   /* декларация — одна и та же строка везде (decl_seg.js) */

/* ---------- карточка товара ---------- */
let SKI={id:"", f:"", edit:false, linkQ:"", linkC:""};
function skItemCard(id){ SKMVN.i=10; SKPW=null; SKI={id, f:"", edit:false, linkQ:"", linkC:""}; SK_RE=()=>skItemCard(id); skModal(skItemHtml, true); }
function skItemHtml(){ const X=skIdx(), it=X.item[SKI.id]; if(!it) return skHead("Склад","Товар не найден","Обновите страницу.");
  const U=skUnitsOf(it.id), B=X.byItem[it.id]||[], ML=X.S.moves.filter(m=>m.itemId===it.id).slice().reverse(), types=[...new Set(ML.map(m=>m.type))];
  const RL=X.S.res.filter(r=>r.itemId===it.id), files=X.filesI[it.id]||[];
  return skHead("Товар склада", esc(it.name), it.alt?"Другие названия: "+esc(it.alt):"", "Товар склада")
  + `<div class="skuvw${skIdx().byItem[it.id]&&skIdx().byItem[it.id].some(b=>!b.cancel)?" on":""}"><div class="skuv">${U.length?U.map(u=>`<div><small>${esc(u.unit)}</small><b>${skQf(u.fact)}</b><span>на складе</span><button type="button" class="skres" data-skresl="${esc(u.unit)}" ${u.res?"":"disabled"}><b>${skQf(u.res)}</b><span>в резерве ›</span></button><span class="skfree"><b>${skQf(u.free)}</b> свободно</span>${(pc=>pc?`<span class="skpcs">${pc}${u.res?" · свободно "+skUPcs(it.id,u.unit,"free").replace(/^≈ /,""):""}</span>`:"")(skUPcs(it.id,u.unit,"fact"))}</div>`).join(""):`<p class="muted">Ещё не было приходов.</p>`}</div>`
  + skItemTiles(it) + `</div>`
  + (SKI.resU!=null?`<div class="skbox"><div class="skbh"><b>Резерв — ${esc(SKI.resU)}</b><button type="button" class="btn ghost sm" data-sk="resclose">Скрыть</button></div>${RL.filter(r=>skK(r.unit)===skK(SKI.resU)).reduce((a,r)=>{ const o=a.find(x=>x.docId===r.docId); if(o) o.q=r3(o.q+(+r.qty)); else a.push({docId:r.docId, q:+r.qty, doc:r.doc}); return a; },[]).map(o=>{ const j=D.journal.find(x=>x.id===o.docId); return `<button type="button" class="skdr" data-skdoc="${o.docId}"><b>${j?esc(jWho(j).main):"накладная"}</b><span>${j?"№ "+esc(j.number)+" от "+fd(j.date):esc(o.doc)} · ${skQf(o.q,SKI.resU)} — открыть накладную ›</span></button>`; }).join("")}</div>`:"")
  + `<div class="skbox"><div class="skbh"><b>Комментарий к товару</b><small class="muted">виден только здесь, в документы не попадает</small></div><textarea class="skcomment" rows="2" data-keep="1" placeholder="Например: «Этот кофейный напиток заказывает только ревматология»">${esc(it.note||"")}</textarea><div class="row"><button type="button" class="btn sm" data-sk="note">Сохранить комментарий</button>${it.note?`<button type="button" class="btn ghost sm" data-sk="noteclr">Очистить</button>`:""}</div></div>`
  + skPwBox(it)
  + `<div class="skbox"><div class="skbh"><b>Партии${skHQ("Партии")}</b><button type="button" class="btn sm" data-sk="inItem">+ Приход</button></div>${B.length?`<div class="skbl">${B.filter(b=>!(b.kind==="rw"&&b.cancel)).reverse().map(b=>{ const f=skFact(b.id), r=skRes(b.id), e=skExp(b); return `<button type="button" class="skbr${f>0?"":" empty"}${b.cancel?" cancel":""}" data-skbatch="${b.id}"><span><b>${esc(b.name)}${b.cancel?(b.kind==="rw"?" · перевзвешивание отменено":" · отменён"):""}</b><small>${esc(b.supplier||"—")}${b.docRef?" · "+esc(b.docRef):""}${b.kind==="init"?" · начальный остаток":""}</small></span><span class="num"><b>${skQf(f,b.unit)}</b>${skBPcs(b,f)?`<i class="skpc">${skBPcs(b,f)}</i>`:""}<small>из ${skQf(b.qty,b.unit)}${skPack(b)?" · "+skPackTxt(b):""}${r?" · резерв "+skQf(r):""}</small></span><span class="num">${b.price!==""&&b.price!=null?fm(+b.price)+" ₽":`<span class="miss">цена?</span>`}</span><span>${e?`<span class="skexp ${skExpCls(e)}">до ${fd(e)}</span>`:`<small class="muted">Срок годности не указан</small>`}</span></button>`; }).join("")}</div>`:`<p class="muted">Партий нет.</p>`}</div>`
  + `<div class="skbox"><div class="skbh"><b>Позиции в документах${skHQ("Позиции в документах")}</b><small class="muted">резерв и списание — только по этим связям</small></div>${(it._lk||[]).map(e=>{ const c=skLkC(e); return `<span class="sklink${c?" cus":""}" data-pid="${esc(skLkP(e))}" data-cid="${esc(c||"")}">${esc((prod(skLkP(e))||{}).name||skLkP(e))}${c?`<i>только для «${esc(cusNm(c)||c)}»</i>`:""}<button type="button" data-skunlink="${esc(e)}" aria-label="Убрать связь">×</button></span>`; }).join("")||`<p class="muted">Не связан — со склада его в документ не взять.</p>`}
      ${skLkSrv()?`<label class="sklc"><span>Связать для</span><select class="sklcs" data-keep="1" aria-label="Для какого заказчика связь"><option value="">всех заказчиков</option>${opts(D.customers.filter(c=>c.id!=="__private"&&!c.priv).slice().sort((a,b)=>cusNm(a.id).localeCompare(cusNm(b.id),"ru")), SKI.linkC||"")}</select></label>`:""}
      <div class="sklinkadd"><input class="sklq" data-keep="1" placeholder="Найти позицию документов, например «ягоды сушёные (шиповник)»" value="${esc(SKI.linkQ)}"><div class="sklsug">${skLinkSug(it)}</div></div></div>`
  + skDefBox(it)
  + `<div class="skbox"><div class="skbh"><b>Декларации</b><button type="button" class="btn sm" data-sk="attachItem">Прикрепить декларацию</button></div>${files.length?files.map(f=>skFileRow(f,false)).join(""):`<p class="muted">Файлов нет.</p>`}</div>`
  + `<div class="skbox"><div class="skbh"><b>История движений</b></div>${types.length>1?`<div class="pfchips skmf">${["",...types].map(t=>`<button type="button" data-skmf="${t}" class="${SKI.f===t?"on":""}">${t?SK_T[t]:"Все"}</button>`).join("")}</div>`:""}${skMoves(ML.filter(m=>!SKI.f||m.type===SKI.f),"i")}</div>`
  + (SKI.edit ? `<div class="skbox"><div class="skbh"><b>Название и единица</b></div><div class="skgrid"><label class="f">Название<input class="skin" data-keep="1" value="${esc(it.name)}"></label><label class="f">Другие названия (через ;)<input class="skalt" data-keep="1" value="${esc(it.alt||"")}"></label><label class="f">Основная единица${skUnitSel(it.unit,"skiu")}</label></div><div class="row"><button type="button" class="btn pri sm" data-sk="itemSave">Сохранить</button><button type="button" class="btn ghost sm" data-sk="itemEditOff">Отмена</button></div></div>` : "")
  + (SKI.merge ? skMergeBox(it) : "")
  + `<div class="dc-acts">${SKI.edit||SKI.merge?"":`<button class="btn ghost" data-sk="mergeOn">Объединить с другим…</button><button class="btn" data-sk="itemEdit">Изменить название</button>`}<button class="btn" data-sk="close">Закрыть</button></div>`; }
const SKMVN={};   /* сколько движений показано в окне (по 10) */
const skIdLike = v => /^[a-z0-9:_\-]{12,}$/i.test(String(v||"")) && !/\s/.test(String(v||""));
function skMoves(L, key){ if(!L.length) return `<p class="muted">Движений нет.</p>`; key=key||"m"; const n=SKMVN[key]||10, list=L.slice(0,n);
  return `<div class="skmv">${list.map((m,k)=>{ const q=+m.qty, sign=SK_NOSTOCK[m.type]?"":q>0?"+":"−", doc=m.doc&&!(!m.docId&&skIdLike(m.doc))?m.doc:"", party=skIdLike(m.party)?"":m.party||"";
    const tm=m.at?new Date(m.at):null, when=tm&&!isNaN(tm)?tm.toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}):"";
    return `<div class="skmr t-${m.type}" style="--d:${Math.min(k,10)*15}ms"><span class="skmt" title="${esc(SK_T[m.type]||m.typeName||"")}">${esc(SK_T[m.type]||m.typeName||"")}</span><span class="skmq"><b>${sign}${skQf(Math.abs(q),m.unit)}</b>${m.cost!==""&&m.cost!=null?`<small>себест. ${fm(+m.cost)} ₽</small>`:""}${m.price?`<small>продажа ${fm(+m.price)} ₽</small>`:""}</span><span class="skmd">${party?`<b>${esc(party)}</b>`:""}${doc?`<small>${m.docId?`<a href="#" data-skdoc="${m.docId}">${esc(doc)}</a>`:esc(doc)}</small>`:""}${m.reason?`<small class="muted">${esc(m.reason)}</small>`:""}${!party&&!doc&&!m.reason?`<small class="muted">—</small>`:""}</span><span class="sklw">${esc(m.by||"")}<small>${when}</small></span></div>`; }).join("")}</div>
    ${L.length>n?`<div class="skmv-more"><span class="muted">Показано ${n} из ${L.length}</span><button type="button" class="btn ghost sm" data-skmv="${key}" data-n="10">Ещё 10</button><button type="button" class="btn ghost sm" data-skmv="${key}" data-n="all">Все</button></div>`:""}`; }
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-skmv]"); if(!b) return; const k=b.dataset.skmv; SKMVN[k]=b.dataset.n==="all"?1e9:(SKMVN[k]||10)+10; skModalRefresh(); });
function skLinkSug(it){ const q=skK(SKI.linkQ); const words=q.split(" ").filter(Boolean), cid=skLkSrv()?SKI.linkC||"":"", X=skIdx(), has=p=>(it._lk||[]).includes(skLkKey(p.id,cid));
  const L=(words.length?D.products.filter(p=>!has(p) && words.every(w=>skK(p.name).includes(w))):skCandidates(it).filter(p=>!has(p))).slice(0,6);
  if(!L.length) return words.length?`<small class="muted">Ничего не найдено</small>`:"";
  const cn=cid?"«"+esc(cusNm(cid))+"»":"";
  return (words.length?"":`<small class="muted">Похоже по названию (связь появится только после нажатия):</small>`)+L.map(p=>{ const o=X.item[X.link[skLkKey(p.id,cid)]], g=cid?X.item[X.link[p.id]]:null;
    const t = o&&o.id!==it.id ? (cid?"для "+cn+" сейчас «"+esc(o.name)+"» — перенести сюда":"сейчас связан с «"+esc(o.name)+"» — перенести")
      : cid ? "связать только для "+cn+(g&&g.id!==it.id?" · другим заказчикам останется «"+esc(g.name)+"»":"") : "связать";
    return `<button type="button" class="sklsb" data-sklink="${esc(skLkKey(p.id,cid))}"><span>${esc(p.name)}</span><small>${t}</small></button>`; }).join(""); }
/* кандидаты по похожему названию — только подсказка, связь создаёт человек */
function skCandidates(it){ const tk=s=>skK(s).replace(/[()«»"',.]/g," ").split(" ").filter(w=>w.length>=4).map(w=>w.slice(0,5)), A=new Set([it.name,...String(it.alt||"").split(";")].flatMap(tk));
  return D.products.filter(p=>tk(p.name).some(w=>A.has(w))).slice(0,12); }
function skUnitSel(u, cls){ const X=skIdx(), L=X.units.slice(); if(u && !L.some(x=>skK(x)===skK(u))) L.push(u);
  return `<select class="${cls}">${L.map(x=>`<option${skK(x)===skK(u)?" selected":""}>${esc(x)}</option>`).join("")}<option value="__new">+ своя единица…</option></select>`; }

/* ---------- карточка партии ---------- */
let SKB={id:"", mode:""};
function skBatchCard(id){ SKMVN.b=10; SKB={id, mode:""}; SK_RE=()=>skBatchCard(id); skModal(skBatchHtml, true); }
function skBatchHtml(){ const X=skIdx(), b=X.batch[SKB.id]; if(!b) return skHead("Склад","Партия не найдена","");
  const it=X.item[b.itemId]||{}, f=skFact(b.id), r=skRes(b.id), root=skRoot(b), e=root.exp||"", ML=X.S.moves.filter(m=>m.batchId===b.id).slice().reverse(), files=(X.filesI[b.itemId]||[]).filter(x=>x.batchId===b.id||x.batchId===root.id);
  const lim=docLimited(), info=[["Дата приёмки",fd(b.date)],["Поставщик",b.supplier||"—"],["Входящий документ",b.docRef||"—"],["Пришло",skQf(b.qty,b.unit)+(skBPcs(b,+b.qty)?" ("+skBPcs(b,+b.qty)+")":"")],["Фасовка",skPack(b)?skPackTxt(b):skK(b.unit)==="шт"?((w=>w?"1 шт = "+skGr(w.w)+(w.src==="own"?" (у товара)":" (из названия)"):"вес 1 шт не указан — впишите в карточке товара")(skPcW(b.itemId))):"не указана"],["Закупочная цена",b.price!==""&&b.price!=null?fm(+b.price)+" ₽ за "+b.unit:"не указана"],["Сумма прихода",b.price!==""&&b.price!=null?fm(r2(b.qty*b.price))+" ₽":"—"],["Годен до",e?fd(e)+(root.id!==b.id?" (срок исходной партии)":""):"Срок годности не указан"]].concat(b.parent?[["Из партии",(X.batch[b.parent]||{}).name||""]]:[]);
  let form="";
  if(SKB.mode==="edit") form=`<div class="skbox"><div class="skbh"><b>Изменить партию</b></div><div class="skgrid">
      ${lim?"":`<label class="f">Закупочная цена за ${esc(b.unit)}, ₽<input class="skbp" data-keep="1" inputmode="decimal" value="${esc(String(b.price||"").replace(".",","))}"></label>`}
      <label class="f">Годен до${root.id!==b.id?" (у исходной партии)":""}<input type="date" class="skbe" data-keep="1" value="${esc(e)}" min="${esc(root.date)}"></label>
      <label class="f">Поставщик<input class="skbs" data-keep="1" value="${esc(b.supplier||"")}"></label><label class="f">Входящий документ<input class="skbd" data-keep="1" value="${esc(b.docRef||"")}"></label>
      ${skK(b.unit)==="шт"?"":`<label class="f">Вес 1 шт, ${esc(b.unit)} <small>(фасовка, необязательно)</small><input class="skbpk" data-keep="1" inputmode="decimal" value="${esc(String(skPack(b)||"").replace(".",","))}" placeholder="например 0,45"></label>`}
      <label class="f">Штук в коробке <small>(необязательно)</small><input class="skbbx" data-keep="1" inputmode="decimal" value="${esc(String(skBox(b)||"").replace(".",","))}" placeholder="например 20"></label>
      ${b.kind==="rw"?"":`<label class="f">Пришло, ${esc(b.unit)}<input class="skbq" data-keep="1" inputmode="decimal" value="${esc(String(b.qty).replace(".",","))}"></label><label class="f">Причина исправления количества<input class="skbr2" data-keep="1" placeholder="если меняете количество"></label>`}</div>
      <p class="muted sk-hint">Новая цена действует на остаток; себестоимость уже отгруженного не меняется. Чтобы очистить срок, сотрите дату.</p>
      <div class="row"><button type="button" class="btn pri sm" data-sk="batchSave">Сохранить</button><button type="button" class="btn ghost sm" data-sk="mode0">Отмена</button></div></div>`;
  if(SKB.mode==="wo") form=`<div class="skbox"><div class="skbh"><b>Списание</b><small class="muted">свободно ${skQf(r3(f-r),b.unit)}</small></div><div class="skgrid"><label class="f">Сколько, ${esc(b.unit)}<input class="skwq" data-keep="1" inputmode="decimal"></label><label class="f wide">Причина (обязательно)<input class="skwr" data-keep="1" placeholder="испортился, усушка, брак…"></label></div><div class="row"><button type="button" class="btn pri sm danger" data-sk="woSave">Списать</button><button type="button" class="btn ghost sm" data-sk="mode0">Отмена</button></div></div>`;
  if(SKB.mode==="cancel") form=`<div class="skbox"><div class="skbh"><b>Отменить приход${skHQ("Отменить приход")}</b></div><p class="muted sk-hint">Партия исчезнет из остатков (в истории останется запись). Можно, только если из неё ещё ничего не брали.</p><label class="f wide">Причина (обязательно)<input class="skcr" data-keep="1" placeholder="ошибся товаром, задвоил приход…"></label><div class="row"><button type="button" class="btn pri sm danger" data-sk="cancelSave">Отменить приход</button><button type="button" class="btn ghost sm" data-sk="mode0">Не отменять</button></div></div>`;
  if(SKB.mode==="rw"){ const fr=r3(f-r), pw=skPcW(b.itemId); if(!SKRW || SKRW.id!==b.id) SKRW={id:b.id, n:String(fr).replace(".",","), kg:pw?String(r3(fr*pw.w)).replace(".",","):"", kgA:!!pw};
    form=`<div class="skbox skrwf"><div class="skbh"><b>Перевзвешивание в кг${skHQ("Перевзвешивание")}</b><small class="muted">свободно ${skQf(fr,b.unit)}; зарезервированные не перевзвешиваются</small></div><div class="skgrid"><label class="f">Сколько ${esc(b.unit)}<input class="skrn" data-keep="1" inputmode="decimal" value="${esc(SKRW.n)}"></label><label class="f">Сколько это кг (взвесили)<input class="skrk" data-keep="1" inputmode="decimal" value="${esc(SKRW.kg)}" placeholder="${pw?"":"например 202,5"}"></label></div>
      <div class="skrwc" id="sk-rwc">${skRwCheckHtml(b)}</div>
      ${skIPack(b.itemId)?"":`<label class="ck skrwmem"><input type="checkbox" class="skrwm" data-keep="1" checked> Запомнить вес 1 шт у товара — дальше сайт будет считать штуки в кг сам</label>`}
      <p class="muted sk-hint">Стоимость упаковок перейдёт в новую партию в кг. Срок годности и декларации остаются от этой партии. Ошиблись — перевзвешивание можно отменить, пока из новой партии ничего не брали.</p><div class="row"><button type="button" class="btn pri sm" data-sk="rwSave">Перевзвесить</button><button type="button" class="btn ghost sm" data-sk="mode0">Отмена</button></div></div>`; }
  return skHead(esc(it.name||"Товар"), esc(b.name)+(b.cancel?" · приход отменён":""), "")
   + `<div class="skuv one"><div><small>${esc(b.unit)}</small><b>${skQf(f)}</b><span>на складе</span><span class="skfree">резерв <b>${skQf(r)}</b> · свободно <b>${skQf(r3(f-r))}</b></span>${skBPcs(b,f)?`<span class="skpcs">${skBPcs(b,f)}${r?" · свободно "+skBPcs(b,r3(f-r)).replace(/^≈ /,""):""}</span>`:""}</div></div>`
   + `<dl class="dc-info">${info.map(([a,v])=>`<div><dt>${a}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` + skRwBox(b) + form
   + `<div class="skbox"><div class="skbh"><b>Декларации партии</b><button type="button" class="btn sm" data-sk="attachBatch">Прикрепить</button></div>${files.length?files.map(x=>skFileRow(x,false)).join(""):`<p class="muted">Файлов нет.</p>`}</div>`
   + `<div class="skbox"><div class="skbh"><b>История партии</b></div>${skMoves(ML,"b")}</div>`
   + `<div class="dc-acts"><button class="btn" data-sk="item" data-id="${b.itemId}">‹ К товару</button>${SKB.mode?"":`<button class="btn" data-sk="mode" data-m="edit">Изменить</button><button class="btn" data-sk="mode" data-m="wo"${f-r>0?"":" disabled"}>Списать</button>${skK(b.unit)!=="кг"?`<button class="btn" data-sk="mode" data-m="rw"${f-r>0?"":" disabled"}>Перевзвесить</button>`:""}${skCanCancel(b)?`<button class="btn ghost danger" data-sk="mode" data-m="cancel">Отменить приход</button>`:""}`}<button class="btn pri" data-sk="close">Готово</button></div>`; }

/* ---------- приход / начальный остаток ---------- */
let SKIN=null;
function skInForm(kind, itemId, pre, onDone){ const X=skIdx(), it=itemId?X.item[itemId]:null;
  SKIN=Object.assign({kind:kind||"in", itemId:itemId||"", name:it?it.name:"", unit:it?it.unit:"кг", qty:"", price:"", date:todayISO(), supplier:"", docRef:"", exp:"", file:null, sugOpen:false, pcs:"", pack:it?skLastPack(it.id, it.unit):"", ppc:"", bx:it?skLastBox(it.id, it.unit):"", bn:""}, pre||{}, {onDone});
  skModal(skInHtml, true); setTimeout(()=>{ const f=$("#sk-dlg .skf-name"); if(f && !itemId) f.focus(); else { const q=$("#sk-dlg .skf-qty"); q&&q.focus(); } },120); }
function skInHtml(){ const X=skIdx(), F=SKIN, init=F.kind==="init", sups=[...new Set(X.S.batches.map(b=>b.supplier).filter(Boolean))].slice(-30);
  return skHead(init?"Начальный остаток":"Приход на склад", init?"Ввод начального остатка":"Новый приход", init?"Сколько товара уже лежит на складе на сегодня. Старые накладные не резервируются и не списываются.":"Каждый приход — отдельная партия, даже если в тот же день.", init?"Начальный остаток":"Приход на склад")
  + `<div class="skgrid skin">
      <label class="f wide skname">Товар<input class="skf-name" data-keep="1" autocomplete="off" value="${esc(F.name)}" placeholder="Начните вводить — покажу похожие"><div class="sksug" id="sk-sug">${skInSug()}</div></label>
      <label class="f">Единица${skUnitSel(F.unit,"skf-unit")}</label>
      <label class="f">Количество<input class="skf-qty" data-keep="1" inputmode="decimal" value="${esc(F.qty)}" placeholder="0"></label>
      <label class="f">Закупочная цена за ед., ₽<input class="skf-price" data-keep="1" inputmode="decimal" value="${esc(F.price)}" placeholder="не знаю — оставить пустым"></label>
      ${skInPackBox()}
      <label class="f">Дата приёмки<input type="date" class="skf-date" data-keep="1" value="${esc(F.date)}"></label>
      <label class="f">Поставщик<input class="skf-sup" data-keep="1" list="sk-sups" value="${esc(F.supplier)}" placeholder="${init?"Начальный остаток":"Саид, рынок, ООО…"}"><datalist id="sk-sups">${sups.map(s=>`<option value="${esc(s)}">`).join("")}</datalist></label>
      <label class="f">Входящий документ (№ или ссылка)<input class="skf-doc" data-keep="1" value="${esc(F.docRef)}"></label>
      <label class="f">Годен до (необязательно)<input type="date" class="skf-exp" data-keep="1" value="${esc(F.exp)}"></label>
      <label class="f wide">Декларация (необязательно)<input type="file" class="skf-file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.rtf,.odt,.ods,.odp,.ppt,.pptx,.txt,.csv"></label>
    </div><div class="sksum" id="sk-insum">${skInSum()}</div>
    <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="inSave">${init?"Провести остаток":"Провести приход"}</button></div>`; }
function skInSug(){ const F=SKIN, q=skK(F.name), X=skIdx(); if(!q || !F.sugOpen) return "";
  const L=X.S.items.filter(i=>[i.name,i.alt||""].some(t=>skK(t).includes(q))).slice(0,6), exact=X.S.items.some(i=>skK(i.name)===q);
  return L.map(i=>`<button type="button" data-skpick="${i.id}"><span>${esc(i.name)}</span><small>${skUnitsOf(i.id).map(u=>skQf(u.fact,u.unit)).join(" · ")||"нет в наличии"}</small></button>`).join("")+(exact?"":`<button type="button" class="new" data-skpick=""><span>+ Новый товар «${esc(skN(F.name))}»</span><small>сохранится в справочнике склада после проведения</small></button>`); }
function skInSum(){ const F=SKIN, q=+String(F.qty).replace(",","."), p=String(F.price).trim()===""?null:+String(F.price).replace(",","."), pk=skNum(F.pack);
  if(!(q>0)) return ""; return `<span>${skQf(q,F.unit)}${pk>0&&skK(F.unit)!=="шт"?" ("+skPcN(q/pk)+")":""}${p!=null&&p>=0?" × "+fm(p)+" ₽ = <b>"+fm(r2(q*p))+" ₽</b>":" · <span class=\"miss\">цена не указана — себестоимость будет неизвестна</span>"}</span>`; }
const skNum = v => { const x=+String(v==null?"":v).replace(/\s/g,"").replace(",","."); return String(v==null?"":v).trim()!==""&&isFinite(x)?x:NaN; };
const skFmtN = (x,d) => String(+x.toFixed(d)).replace(".",",");
/* фасовка прошлой партии этого товара в той же единице — подставляется в новый приход (можно стереть) */
function skLastBox(itemId, unit){ const b=(skIdx().byItem[itemId]||[]).slice().reverse().find(x=>!x.cancel && skK(x.unit)===skK(unit) && skBox(x)); return b?skFmtN(skBox(b),3):""; }
function skLastPack(itemId, unit){ const b=(skIdx().byItem[itemId]||[]).slice().reverse().find(x=>!x.cancel && skK(x.unit)===skK(unit) && skPack(x)); return b?skFmtN(skPack(b),6):""; }
function skInPackBox(){ const F=SKIN, u=esc(F.unit||"кг"), sht=skK(F.unit)==="шт";
  const bxg=`<div class="skpackg sk2"><label class="f">Штук в коробке<input class="skf-bx" data-keep="1" inputmode="decimal" value="${esc(F.bx||"")}" placeholder="например 20"></label>
    <label class="f">Сколько коробок<input class="skf-bn" data-keep="1" inputmode="decimal" value="${esc(F.bn||"")}" placeholder="можно 2,35"></label></div>`;
  return `<div class="f wide skpackb"><div class="skpackh"><b>${sht?"Коробки":"Штуки и коробки"}${skHQ("Штуки в приходе")}</b><small>необязательно — если купили поштучно или коробками</small></div>
    ${sht?"":`<div class="skpackg"><label class="f">Сколько штук<input class="skf-pcs" data-keep="1" inputmode="decimal" value="${esc(F.pcs)}" placeholder="например 40"></label>
    <label class="f">Вес 1 шт, ${u}<input class="skf-pack" data-keep="1" inputmode="decimal" value="${esc(F.pack)}" placeholder="например 0,45"></label>
    <label class="f">Цена за 1 шт, ₽<input class="skf-ppc" data-keep="1" inputmode="decimal" value="${esc(F.ppc)}" placeholder="как в накладной"></label></div>`}
    ${bxg}
    <small class="muted skpackn">${sht?"Коробки × штук в коробке = количество. Коробок может быть дробное число.":"Впишите штуки и вес одной — сайт сам посчитает "+u+" и цену за "+u+". Коробки × штук в коробке = штуки. На складе рядом с "+u+" будет видно штуки и коробки."}</small></div>`; }
/* связь полей прихода: штуки × вес 1 шт = количество; цена за шт ÷ вес 1 шт = цена за ед. Пересчитывается то, что не трогали */
function skInLink(cls){ const d=$("#sk-dlg"); if(!d||!SKIN) return; const g=c=>d.querySelector(c), set=(c,v)=>{ const el=g(c); if(el && el!==document.activeElement) el.value=v; };
  skInRead(); const F=SKIN, n=skNum(F.pcs), pk=skNum(F.pack), q=skNum(F.qty), ppc=skNum(F.ppc), pr=skNum(F.price);
  if(cls==="skf-pcs"||cls==="skf-pack"){ if(n>0 && pk>0) set(".skf-qty", skFmtN(n*pk,3)); else if(cls==="skf-pcs" && n>0 && q>0 && !(pk>0)) set(".skf-pack", skFmtN(q/n,6)); else if(cls==="skf-pack" && pk>0 && q>0 && !(n>0)) set(".skf-pcs", skFmtN(q/pk,1)); }
  if(cls==="skf-qty" && n>0 && q>0) set(".skf-pack", skFmtN(q/n,6));
  skInRead(); const pk2=skNum(SKIN.pack);
  if(cls==="skf-price"){ if(pk2>0 && pr>=0) set(".skf-ppc", skFmtN(pr*pk2,2)); }
  else if(ppc>=0 && pk2>0) set(".skf-price", skFmtN(ppc/pk2,4));
  skInBoxLink(cls); skInRead(); const s=$("#sk-insum"); if(s) s.innerHTML=skInSum(); }
function skInBoxLink(cls){ const d=$("#sk-dlg"); if(!d||!SKIN) return; const set=(c,v)=>{ const el=d.querySelector(c); if(el && el!==document.activeElement) el.value=v; };
  skInRead(); const F=SKIN, sht=skK(F.unit)==="шт", bx=skNum(F.bx), bn=skNum(F.bn), pc=sht?skNum(F.qty):(skNum(F.pcs)>0?skNum(F.pcs):(skNum(F.pack)>0&&skNum(F.qty)>0?skNum(F.qty)/skNum(F.pack):NaN));
  if(cls==="skf-bx") F._bxA=0;
  if(cls!=="skf-bx" && (!(bx>0) || F._bxA) && pc>0 && bn>0){ set(".skf-bx", skFmtN(pc/bn,3)); F._bxA=1; return; }
  if(!(bx>0)) return;
  if(cls==="skf-bn" || (cls==="skf-bx" && !(pc>0))){ if(bn>0){ const n=bn*bx; if(sht) set(".skf-qty",skFmtN(n,3)); else { set(".skf-pcs",skFmtN(n,3)); skInRead(); const pk=skNum(SKIN.pack); if(pk>0) set(".skf-qty",skFmtN(n*pk,3)); } } return; }
  if(pc>0) set(".skf-bn", skFmtN(pc/bx,3)); }
function skInRead(){ const d=$("#sk-dlg"); if(!d||!SKIN) return; const v=c=>{ const el=d.querySelector(c); return el?el.value:""; };
  Object.assign(SKIN,{name:v(".skf-name"), qty:v(".skf-qty"), price:v(".skf-price"),  date:v(".skf-date"), supplier:v(".skf-sup"), docRef:v(".skf-doc"), exp:v(".skf-exp")}); const u=v(".skf-unit"); if(u && u!=="__new") SKIN.unit=u;
  if(d.querySelector(".skf-pcs")) Object.assign(SKIN,{pcs:v(".skf-pcs"), pack:v(".skf-pack"), ppc:v(".skf-ppc")});
  if(d.querySelector(".skf-bx")) Object.assign(SKIN,{bx:v(".skf-bx"), bn:v(".skf-bn")});   /* для «шт» блока нет — введённое раньше не теряем */
  const it=skIdx().item[SKIN.itemId]; if(it && skK(it.name)!==skK(SKIN.name)) SKIN.itemId=""; }
async function skInSave(force){ skInRead(); const F=SKIN, d=$("#sk-dlg"), file=(d.querySelector(".skf-file")||{}).files; const fl=file&&file[0];
  if(!skN(F.name)){ toast("err","Укажите товар",""); return; } if(!(+String(F.qty).replace(",",".")>0)){ toast("err","Укажите количество",""); return; }
  if(F.exp && F.date && F.exp<F.date){ toast("err","Срок годности раньше даты приёмки","Проверьте даты."); return; }
  if(fl && !skFileOk(fl)) return;
  const exact=F.itemId?null:skIdx().S.items.find(i=>skK(i.name)===skK(F.name));
  const body={kind:F.kind, itemId:F.itemId||(exact?exact.id:""), newName:F.itemId||exact?"":skN(F.name), unit:F.unit, qty:F.qty, price:String(F.price).trim(), date:F.date, supplier:F.supplier, docRef:F.docRef, exp:F.exp, force:!!force}; const pk=skNum(F.pack);
  if(skK(F.unit)!=="шт" && String(F.pack).trim()!=="" && !(pk>0)){ toast("err","Вес 1 шт — число больше нуля","Или сотрите его, если фасовка не нужна."); return; }
  if(pk>0 && skK(F.unit)!=="шт") body.pack=String(pk);
  if(String(F.bx||"").trim()!=="" && !(skNum(F.bx)>0)){ toast("err","Штук в коробке — число больше нуля","Или сотрите, если коробок нет."); return; } if(skNum(F.bx)>0) body.box=String(skNum(F.bx));
  const btn=d.querySelector('[data-sk="inSave"]'); btn.disabled=true; btn.textContent="Провожу…";
  try{ const j=await skSend("in", body, (F.kind==="init"?"Начальный остаток: ":"Приход: ")+skN(F.name)+" "+skQf(+String(F.qty).replace(",","."),F.unit));
    toast("ok", F.kind==="init"?"Остаток проведён":"Приход проведён", skN(F.name)+" — "+skQf(+String(F.qty).replace(",","."),F.unit));
    const out=j.out||{}, cb=F.onDone; if(body.pack && out.batchId) skPackSave(out.batchId, body.pack); if(body.box && out.batchId) skBoxSave(out.batchId, body.box); skClose(true);
    if(fl && out.batchId) await skAttach(fl, out.itemId, out.batchId);
    if(cb) cb(out); else if(out.itemId) skItemCard(out.itemId);
  }catch(e){ if(e.resp && e.resp.code==="similar"){ btn.disabled=false; btn.textContent=F.kind==="init"?"Провести остаток":"Провести приход";
      if(confirm(e.message+".\n\nЭто другой, отдельный приход? Нажмите «ОК», чтобы провести его отдельно.")) return skInSave(true); return; }
    if(e.queued){ skErr(e,"приход"); skClose(); return; } skErr(e,"приход"); btn.disabled=false; btn.textContent=F.kind==="init"?"Провести остаток":"Провести приход"; } }
/* ---------- декларации ---------- */
const SK_EXT=/\.(pdf|jpe?g|png|webp|heic|heif|gif|docx?|docm|xlsx?|xlsm|txt|rtf|odt|ods|odp|pptx?|csv)$/i;
function skFileOk(f){ if(!SK_EXT.test(f.name)){ toast("err","Такой файл не подходит","Можно PDF, фото (JPG, PNG, WEBP, HEIC), Word, Excel, PowerPoint, RTF, ODT или TXT."); return false; } if(f.size>20*1024*1024){ toast("err","Файл больше 20 МБ","Сожмите или разделите файл."); return false; } return true; }
const skMime = f => (SK_MIMEX[(f.name.split(".").pop()||"").toLowerCase()]) || f.type || "";
const SK_MIMEX=({pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif",gif:"image/gif",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",txt:"text/plain",rtf:"application/rtf",odt:"application/vnd.oasis.opendocument.text",ods:"application/vnd.oasis.opendocument.spreadsheet",odp:"application/vnd.oasis.opendocument.presentation",ppt:"application/vnd.ms-powerpoint",pptx:"application/vnd.openxmlformats-officedocument.presentationml.presentation",csv:"text/csv",docm:"application/vnd.ms-word.document.macroenabled.12",xlsm:"application/vnd.ms-excel.sheet.macroenabled.12"});
async function skAttach(f, itemId, batchId){ if(!skFileOk(f)) return;
  const data=await new Promise((ok,bad)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]||""); r.onerror=()=>bad(new Error("не получилось прочитать файл")); r.readAsDataURL(f); });
  const t=toast("info","Загружаю декларацию…", f.name, {sticky:true});
  try{ await skSend("file", {itemId, batchId:batchId||"", name:f.name, mime:skMime(f), size:f.size, data}, "Декларация: "+f.name); toast("ok","Декларация прикреплена", f.name); }
  catch(e){ if(e.queued){ toast("warn","Декларация не загрузилась — нет связи","Файл «"+f.name+"» ждёт отправки. Не перезагружайте страницу, отправлю сам."); } else skErr(e,"декларация"); } }
function skPickFile(itemId, batchId){ const inp=document.createElement("input"); inp.type="file"; inp.accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.rtf,.odt,.ods,.odp,.ppt,.pptx,.txt,.csv"; inp.onchange=()=>{ const f=inp.files[0]; if(f) skAttach(f, itemId, batchId); }; inp.click(); }
async function skFile(id, view){ const t0=toast("info","Открываю файл…","");
  try{ const j=await api({action:"stock", op:"fileGet", d:{id}}); const bin=atob(j.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const blob=new Blob([u8],{type:j.mime||"application/octet-stream"}), url=URL.createObjectURL(blob);
    if(view){ const im=/^image\//.test(j.mime); const v=document.createElement("dialog"); v.className="dcard wide skview"; v.innerHTML=`<div class="dc-head"><div><div class="dc-kicker">Декларация</div><h3>${esc(j.name)}</h3></div><button class="dc-x" aria-label="Закрыть">×</button></div>${im?`<img src="${url}" alt="${esc(j.name)}">`:`<iframe src="${url}" title="${esc(j.name)}"></iframe>`}<div class="dc-acts"><button class="btn" data-skfprn="${esc(id)}">${D_PRN} Печать</button><a class="btn" href="${url}" download="${esc(j.name)}">Скачать</a></div>`;
      document.getElementById("fd-app").appendChild(v); v.querySelector("[data-skfprn]").onclick=()=>dPrint(id); v.querySelector(".dc-x").onclick=()=>{ v.close(); v.remove(); URL.revokeObjectURL(url); }; v.addEventListener("close",()=>v.remove()); v.showModal(); requestAnimationFrame(()=>v.classList.add("in")); }
    else { const a=document.createElement("a"); a.href=url; a.download=j.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000); }
  }catch(e){ toast("err","Файл не открылся", e.message); } }
/* выбор товара для декларации (из раздела «Декларации») */
function skAttachPick(){ const X=skIdx(); if(!X.S.items.length){ toast("info","Сначала заведите товар","Проведите приход."); return; }
  skModal(()=>skHead("Декларации","Прикрепить декларацию","Выберите товар — потом файл. Партию можно выбрать в карточке товара.")+`<div class="skdl">${X.S.items.slice().sort((a,b)=>a.name.localeCompare(b.name,"ru")).map(i=>`<button type="button" class="skdr" data-skattach="${i.id}"><b>${esc(i.name)}</b><span>${(X.filesI[i.id]||[]).length} файл(ов)</span></button>`).join("")}</div>`); }

/* ---------- инвентаризация ---------- */
let SKINV={all:false, f:{}};
function skInv(){ SKINV={all:false, f:{}}; skModal(skInvHtml, true); }
function skInvHtml(){ const X=skIdx(), L=X.S.batches.filter(b=>SKINV.all||skFact(b.id)!==0).sort((a,b)=>((X.item[a.itemId]||{}).name||"").localeCompare((X.item[b.itemId]||{}).name||"","ru")||String(a.date).localeCompare(b.date));
  const n=Object.keys(SKINV.f).filter(k=>SKINV.f[k]!=="").length;
  return skHead("Склад","Инвентаризация","Впишите фактическое количество по партиям. Пустая строка — пропуск, 0 — значит товара нет. Проводится только разница.","Инвентаризация")
   + `<label class="chk"><input type="checkbox" class="skinvall"${SKINV.all?" checked":""}> показать и пустые партии</label>`
   + `<div class="tbl"><table class="skinvt"><thead><tr><th>Товар · партия</th><th class="num">По учёту</th><th class="num">Резерв</th><th>Факт</th><th class="num">Разница</th></tr></thead><tbody>${L.map(b=>{ const f=skFact(b.id), v=SKINV.f[b.id]==null?"":SKINV.f[b.id], d=v===""?null:r3(+String(v).replace(",",".")-f);
     return `<tr><td><b>${esc((X.item[b.itemId]||{}).name||"")}</b><small>${esc(b.name)}</small></td><td class="num">${skQf(f,b.unit)}</td><td class="num">${skRes(b.id)?skQf(skRes(b.id)):"—"}</td><td><input class="skinvf" data-keep="1" data-b="${b.id}" inputmode="decimal" value="${esc(v)}" placeholder="—"></td><td class="num skinvd" data-d="${b.id}">${d==null?"":d===0?`<span class="muted">0</span>`:`<b class="${d<0?"neg":"pos"}">${d>0?"+":""}${skQf(d)}</b>`}</td></tr>`; }).join("")||`<tr><td colspan="5" class="muted">Партий нет.</td></tr>`}</tbody></table></div>`
   + `<label class="f wide">Комментарий к акту<input class="skinvn" data-keep="1"></label>`
   + `<div class="dc-acts"><span class="muted" style="margin-right:auto">Заполнено: ${n}</span><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="invSave">Провести акт</button></div>`; }

/* ---------- накладная: строка «откуда товар» ---------- */
function skLineBtn(i){ if(!SK_READY) return ""; if(skSrv===false) return ""; const l=D.draft.lines[i]; if(!l||!l.productId||!skCan()) return ""; const it=skItemOf(l.productId, D.draft.customerId||""), m=(l.stk||{}).m||"";
  const free=it?skFreeU(it.id, (prod(l.productId)||{}).unit):0;
  return `<button type="button" class="skb${m?" on":free>0?" has":""}" data-skl="${i}" title="${m?"Источник: "+(m==="s"?"со склада":"часть со склада"):it?"На складе свободно "+skQf(free,(prod(l.productId)||{}).unit)+" — нажмите, чтобы выбрать источник":"Источник товара: от Саида или со склада"}" aria-label="Источник товара">${skIcon}</button>`; }
function skLineNote(i){ if(!SK_READY) return ""; if(skSrv===false) return ""; const l=D.draft.lines[i], p=l&&prod(l.productId); if(!p||!skCan()) return ""; const it=skItemOf(p.id, D.draft.customerId||""), src=l.stk||{}, m=src.m||"", q=+l.qty||0;
  const gov = !UNITS[p.unit] && typeof isGovCus==="function" && isGovCus(D.draft.customerId) ? `<div class="sknote bad" role="note">${skIcon}<span>У единицы «${esc(p.unit)}» нет кода ОКЕИ — для госконтракта и ЕИС выберите кг, шт или другую стандартную единицу.</span></div>` : "";
  if(!m){ const free=it?skFreeU(it.id,p.unit):0; return gov + (it && free>0 ? `<div class="sknote" role="note">${skIcon}<span>На складе свободно <b>${skQf(free,p.unit)}</b> — «${esc(it.name)}»${skStale()}. По умолчанию товар от Саида.</span></div>` : ""); }
  if(!it) return gov + `<div class="sknote bad" role="note">${skIcon}<span>Выбран склад, но позиция не связана со складским товаром — резерва не будет. Нажмите значок склада.</span></div>`;
  const j=D.journal.find(x=>x.id===D.draft.id), saved=j&&!j.snap.meta?.arch, req=m==="s"?q:Math.min(q,+src.q||0), inf=saved?skLineInfo(j.id, (j.snap.dr.lines||[]).find(x=>x.lid===l.lid)||l, p.unit):null, um=!skUnitsOf(it.id).some(u=>skK(u.unit)===skK(p.unit));
  let s=`Со склада: <b>${skQf(req,p.unit)}</b> «${esc(it.name)}»`+(m==="x"?` · от Саида: <b>${skQf(Math.max(0,q-req),p.unit)}</b>`:"");
  if(um) s+=` · <span class="miss">на складе нет этой единицы (${esc(p.unit)})</span>`;
  else if(inf && inf.req===req) s+= (inf.shipped?` · отгружено ${skQf(inf.shipped)}`:"") + (inf.res?` · в резерве <b>${skQf(inf.res)}</b>`:"") + (inf.short?` · <span class="miss">нехватка ${skQf(inf.short,p.unit)}</span>`:"") + (!inf.res&&!inf.short&&!inf.shipped&&inf.need===0&&inf.closed?" · остаток закрыт":"");
  else { const fr=skFreeU(it.id,p.unit); s+=` · <span class="muted">резерв появится после сохранения (свободно ${skQf(fr,p.unit)})</span>`+(fr<req?` · <span class="miss">не хватит ${skQf(r3(req-fr),p.unit)}</span>`:""); }
  return gov + `<div class="sknote on" role="note">${skIcon}<span>${s}${l.stkA?` · <span class="muted">выбрано само по настройке товара</span>`:""}</span></div>`; }
function skDocHints(){ if(!SK_READY) return ""; if(curTab!=="doc") return; skAllBtn(); document.querySelectorAll("#d-lines .line[data-i]").forEach(el=>{ const i=+el.dataset.i, b=el.querySelector(".skb"), n=el.querySelector(".sknote"), h=skLineNote(i), bh=skLineBtn(i);
  if(b) b.outerHTML=bh||""; else if(bh){ const pc=el.querySelector(".pc"); pc&&pc.insertAdjacentHTML("beforeend",bh); }
  if(n) n.outerHTML=h||""; else if(h) el.insertAdjacentHTML("beforeend",h); }); }
let SKL=null;
function skLineCard(i){ const l=D.draft.lines[i]; if(!l||!l.productId) return; SKL={i, linkQ:"", sc:"", relink:false}; skModal(skLineHtml); }
/* «для всех заказчиков | только для «…»» — для какого заказчика запомнить связь */
function skScopeHtml(cid, sc, attr){ if(!skLkSrv() || !cid) return ""; const b=(k,t)=>`<button type="button" class="${sc===k?"on":""}" ${attr}="${k}" aria-pressed="${sc===k}">${t}</button>`;
  return `<div class="sklsc" role="group" aria-label="Для кого связь"><small>Связь:</small>${b("all","для всех заказчиков")}${b("cus","только для «"+esc(cusNm(cid))+"»")}</div>`; }
function skLineHtml(){ const l=D.draft.lines[SKL.i]; if(!l) return skHead("Склад","Строка удалена",""); const p=prod(l.productId)||{}, cid=D.draft.customerId||"", it=SKL.relink?null:skItemOf(p.id, cid), it1=skItemOf(p.id, cid), src=l.stk||{}, m=src.m||"", q=+l.qty||0, lim=docLimited();
  if(!it){ if(!SKL.sc) SKL.sc=it1&&cid?"cus":"all";
    return skHead("Откуда товар", esc(p.name), SKL.relink&&it1?"Сейчас эта позиция берётся со склада как «"+esc(it1.name)+"»"+(skLkScope(it1,p.id,cid)==="cus"?" — только для «"+esc(cusNm(cid))+"»":"")+". Выберите другой товар склада.":"Эта позиция документа ещё не связана со складским товаром. Связь создаётся только вручную — похожее название само ничего не списывает.", "Откуда товар")
    + `<div class="skbox"><div class="skbh"><b>Связать со складским товаром</b>${SKL.relink?`<button type="button" class="btn ghost sm" data-sk="relinkOff">Отмена</button>`:""}</div>${skScopeHtml(cid, SKL.sc, "data-sklsc")}<input class="sklq2" data-keep="1" placeholder="Найти товар на складе" value="${esc(SKL.linkQ)}"><div class="sklsug">${skItemSug(p)}</div></div><div class="dc-acts"><button class="btn" data-sk="close">Закрыть</button></div>`; }
  const free=skFreeU(it.id,p.unit), um=!skUnitsOf(it.id).some(u=>skK(u.unit)===skK(p.unit));
  const opt=(k,t,s)=>`<label class="skopt${m===k?" on":""}"><input type="radio" name="sksrc" value="${k}"${m===k?" checked":""}><span><b>${t}</b><small>${s}</small></span></label>`;
  const rwB=um ? (skIdx().byItem[it.id]||[]).filter(b=>!b.cancel && skFree(b.id)>0 && skK(b.unit)!==skK(p.unit) && skK(p.unit)==="кг") : [];
  return skHead("Откуда товар", esc(p.name), `На складе: «${esc(it.name)}» — свободно <b>${skQf(free,p.unit)}</b>${(pc=>pc?" ("+pc+")":"")(skUPcs(it.id,p.unit,"free"))}`+(um?` · <span class="miss">на складе нет единицы «${esc(p.unit)}»</span>`:"")+skStale(), "Откуда товар")
   + (rwB.length?`<div class="sknoteb">На складе этот товар лежит в других единицах: ${rwB.map(b=>esc(skQf(skFree(b.id),b.unit))).join(", ")}. Чтобы взять его в кг, сначала перевзвесьте: <button type="button" class="btn sm" data-skrwgo="${rwB[0].id}">Перевзвесить…</button></div>`:"")
   + `<div class="skopts">${opt("","От Саида","закупка под эту поставку (по умолчанию)")}${opt("s","Со склада","все "+skQf(q,p.unit)+(skQPcs(it.id,p.unit,q)?" ("+skQPcs(it.id,p.unit,q)+")":"")+(free<q?" — свободно только "+skQf(free)+", нехватка будет "+skQf(r3(q-free),p.unit):""))}${opt("x","Часть со склада","остальное — от Саида")}</div>
     <div class="skmix"${m==="x"?"":" hidden"}><div class="skgrid"><label class="f">Со склада, ${esc(p.unit)}<input class="skmq" data-keep="1" inputmode="decimal" value="${esc(String(src.q||"").replace(".",","))}" placeholder="${esc(String(Math.min(free,q)).replace(".",","))}"></label>${lim?"":`<label class="f">Цена у Саида за ${esc(p.unit)}, ₽ <small>(для прибыли)</small><input class="skmp" data-keep="1" inputmode="decimal" value="${esc(String(src.pd||"").replace(".",","))}" placeholder="необязательно"></label>`}</div></div>
     ${skLkSrv()&&cid&&!lim?`<p class="sklre"><span>${skLkScope(it,p.id,cid)==="cus"?"Связь только для «"+esc(cusNm(cid))+"»":"Связь для всех заказчиков"}.</span><button type="button" class="btn ghost sm" data-sk="relink">Другой товар склада…</button></p>`:""}
     <p class="muted sk-hint">Резерв появится после сохранения документа. Нехватка сама не превращается в закупку у Саида — можно выбрать «Часть со склада» или провести приход и обновить резерв.</p>
     <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="lineSave">Готово</button></div>`; }
function skItemSug(p){ const q=skK(SKL.linkQ), X=skIdx(), words=q.split(" ").filter(Boolean);
  const tk=s=>skK(s).replace(/[()«»"',.]/g," ").split(" ").filter(w=>w.length>=4).map(w=>w.slice(0,5)), P=new Set(tk(p.name));
  const L=words.length?X.S.items.filter(i=>words.every(w=>skK(i.name+" "+(i.alt||"")).includes(w))):X.S.items.filter(i=>tk(i.name+" "+(i.alt||"")).some(w=>P.has(w)));
  return (!words.length&&L.length?`<small class="muted">Похоже по названию (связь — только после нажатия):</small>`:"")+L.slice(0,6).map(i=>`<button type="button" class="sklsb" data-sklinkto="${i.id}"><span>${esc(i.name)}</span><small>${skUnitsOf(i.id).map(u=>skQf(u.free,u.unit)+" свободно").join(" · ")||"нет в наличии"} · связать</small></button>`).join("")||(words.length?`<small class="muted">Не найдено. Заведите товар приходом во вкладке «Склад».</small>`:""); }

/* ---------- накладная в журнале: блок «Склад» в окне документа ---------- */
function skDocBlock(j){ if(!SK_READY) return ""; if(!skCan() || !j || !j.snap || !skDocHas(j)) return ""; const L=skDocLines(j).filter(x=>x.req>0||x.shipped>0||x.res>0);
  const can=!isArch(j); const anyNeed=L.some(x=>x.need>0), anyShip=L.some(x=>x.shipped-x.ret>0);
  return `<div class="skdoc"><div class="skbh"><b>${skIcon}Склад${skHQ("Склад в документе")}</b><small class="muted">${L.some(x=>x.short>0)?`<span class="miss">есть нехватка</span>`:anyNeed?"зарезервировано, ждёт отгрузки":"отгружено со склада"}</small></div>
    ${L.map(x=>`<div class="skdl1"><span><b>${esc(x.item?x.item.name:(x.l.name||(prod(x.l.productId)||{}).name||""))}</b><small>со склада ${skQf(x.req,x.unit)}${x.item&&skQPcs(x.item.id,x.unit,x.req)?" ("+skQPcs(x.item.id,x.unit,x.req)+")":""}${x.m==="x"?" из "+skQf(x.qty):""}</small></span><span class="skst">${x.res?`<em class="r">резерв ${skQf(x.res)}</em>`:""}${x.short?`<em class="s">нехватка ${skQf(x.short)}</em>`:""}${x.shipped?`<em class="o">отгружено ${skQf(x.shipped)}</em>`:""}${x.ret?`<em>возврат ${skQf(x.ret)}</em>`:""}${x.closed?`<em>закрыто ${skQf(x.closed)}</em>`:""}</span></div>`).join("")}
    ${can?`<div class="row"><button type="button" class="btn pri sm" data-skd="ship" data-doc="${j.id}"${L.some(x=>x.res>0)||L.some(x=>x.m!=="s")?"":" disabled"}>Отгрузить</button><button type="button" class="btn sm" data-skd="reserve" data-doc="${j.id}">Обновить резерв</button>${anyNeed?`<button type="button" class="btn ghost sm" data-skd="close" data-doc="${j.id}">Закрыть остаток</button>`:""}${anyShip?`<button type="button" class="btn ghost sm" data-skd="ret" data-doc="${j.id}">Возврат</button>`:""}</div>`:""}</div>`; }
let SKS=null;
function skShipForm(j, mode){ SKS={id:j.id, mode}; skModal(skShipHtml, true); }
function skShipHtml(){ const j=D.journal.find(x=>x.id===SKS.id); if(!j) return skHead("Склад","Накладная не найдена",""); const all=skDocLines(j), M=SKS.mode, lbl="№ "+esc(j.number)+" от "+fd(j.date)+" — "+esc(jWho(j).main);
  if(M==="ship") return skHead("Отгрузка", lbl, "Подтвердите, что товар фактически уехал. Со склада — не больше резерва. Печать, повторное сохранение и скачивание ничего не списывают.","Отгрузка")
    + `<div class="tbl"><table class="skshipt"><thead><tr><th>Товар</th><th class="num">В резерве</th><th>Со склада</th><th>От Саида</th></tr></thead><tbody>${all.map(x=>{ const nm=x.l.name||(j.snap.prods[x.l.productId]||{}).name||"", dir=r3(Math.max(0,x.qty-x.req-x.direct));
      return `<tr><td><b>${esc(nm)}</b><small>${skQf(x.qty,x.unit)}${x.item&&x.req&&skQPcs(x.item.id,x.unit,x.req)?" · со склада "+skQPcs(x.item.id,x.unit,x.req):""}${x.item?" · склад: «"+esc(x.item.name)+"»":""}</small></td><td class="num">${x.req?skQf(x.res,x.unit)+(x.short?`<small class="miss">нехватка ${skQf(x.short)}</small>`:""):"—"}</td><td>${x.req&&x.item?`<input class="skshq" data-keep="1" data-l="${esc(x.l.lid||"")}" inputmode="decimal" value="${esc(String(x.res).replace(".",","))}">`:"—"}</td><td><input class="skshd" data-keep="1" data-l="${esc(x.l.lid||"")}" inputmode="decimal" value="${dir?esc(String(dir).replace(".",",")):""}" placeholder="0"></td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted sk-hint">Если отгрузили меньше резерва — остаток останется в резерве к допоставке. Закрыть его можно кнопкой «Закрыть остаток».</p>
      <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="shipSave">Подтвердить отгрузку</button></div>`;
  if(M==="close") return skHead("Закрыть остаток", lbl, "Недопоставленная складская часть больше не нужна: резерв по ней снимется.","Закрыть остаток")
    + `<div class="skdl">${all.filter(x=>x.need>0).map(x=>`<div class="skdr"><b>${esc(x.item?x.item.name:"")}</b><span>к допоставке ${skQf(x.need,x.unit)}</span></div>`).join("")}</div><label class="f wide">Причина (обязательно)<input class="skclr" data-keep="1" placeholder="заказчик отказался, заменили товар…"></label>
      <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="closeSave">Закрыть остаток</button></div>`;
  if(M==="ret") return skHead("Возврат на склад", lbl, "Товар вернётся в те же партии по той же себестоимости. Не больше, чем отгружено и ещё не возвращено.","Возврат на склад")
    + `<div class="tbl"><table class="skshipt"><thead><tr><th>Товар</th><th class="num">Можно вернуть</th><th>Вернуть</th></tr></thead><tbody>${all.filter(x=>x.shipped-x.ret>0).map(x=>`<tr><td><b>${esc(x.item?x.item.name:"")}</b></td><td class="num">${skQf(r3(x.shipped-x.ret),x.unit)}</td><td><input class="skretq" data-keep="1" data-l="${esc(x.l.lid||"")}" inputmode="decimal" placeholder="0"></td></tr>`).join("")}</tbody></table></div>
      <label class="f wide">Причина<input class="skretr" data-keep="1" placeholder="брак, пересорт…"></label><div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="retSave">Провести возврат</button></div>`;
  return ""; }

/* ---------- обработчики ---------- */
const skVal = (sel) => { const el=$("#sk-dlg "+sel); return el?el.value:""; };
const skBusy = (b, on, t) => { if(!b) return; if(on){ b.dataset.t0=b.textContent; b.disabled=true; b.textContent=t||"Отправляю…"; } else { b.disabled=false; if(b.dataset.t0) b.textContent=b.dataset.t0; } };
document.addEventListener("change", e=>{ const el=e.target; if(!el.classList||!el.classList.contains("sklcs")) return; SKI.linkC=el.value; const b=el.closest(".skbox"), s=b&&b.querySelector(".sklsug"), it=skIdx().item[SKI.id]; if(s&&it) s.innerHTML=skLinkSug(it); });
/* связать позиции документов с товаром склада: scope "cus" — только для заказчика cid, иначе для всех
   (для всех — заодно снимаем свою связь этого заказчика с другим товаром, иначе она бы перебивала общую). Возвращает записанные связи */
async function skLinkTo(itemId, pids, cid, scope){ const X=skIdx(), it=X.item[itemId]; if(!it) return [];
  const cus=skLkSrv() && cid && scope==="cus", E=pids.map(p=>skLkKey(p, cus?cid:""));
  const links=[...new Set((it._lk||[]).concat(E))]; await skSend("item",{itemId, links},"Связь: "+it.name+(cus?" (для «"+cusNm(cid)+"»)":""));
  if(!cus && cid){ const drop={}; pids.forEach(p=>{ const o=skIdx().link[p+"@"+cid]; if(o && o!==itemId) (drop[o]=drop[o]||[]).push(p+"@"+cid); });
    for(const o of Object.keys(drop)){ const x=skIdx().item[o]; if(x) await skSend("item",{itemId:o, links:(x._lk||[]).filter(e=>!drop[o].includes(e))},"Связь: "+x.name); } }
  return E; }
/* связь поменялась — пересчитать резерв открытых накладных с этой позицией (у заказчика связи или у всех), чтобы резерв встал на новый товар склада */
async function skRelinkReserve(entries, except){ if(!SK_READY || !online()) return; const want=entries.map(e=>({pid:skLkP(e), cid:skLkC(e)}));
  const L=(D.journal||[]).filter(j=>j.id!==except && j.snap && j.snap.dr && !(j.snap.meta||{}).arch && (j.snap.dr.lines||[]).some(l=>(l.stk||{}).m && want.some(w=>w.pid===l.productId && (!w.cid || w.cid===(j.snap.dr.customerId||"")))))
    .filter(j=>skDocLines(j).some(x=>x.need>0 || x.res>0)).slice(0,30);
  for(const j of L){ try{ await skSend("reserve",{docId:j.id},"Резерв № "+j.number+" (связь изменена)"); }catch(e){} } }
async function skDo(op, d, label, okT, b){ skBusy(b,true); try{ const j=await skSend(op,d,label); toast("ok",okT||"Готово",""); return j; }catch(e){ skErr(e,label); if(e.queued) skClose(); return null; } finally{ skBusy(b,false); } }
document.addEventListener("click", async e=>{
  const t=e.target; if(!t.closest) return;
  const det=t.closest("[data-skdet]"); if(det){ SKV.det=SKV.det===det.dataset.skdet?"":det.dataset.skdet; skDrawKpi(); return; }
  const seg=t.closest("#sk-segs [data-skt]"); if(seg){ SKV.tab=seg.dataset.skt; SKV.shown=60; renderStock(); return; }
  const hf=t.closest("[data-skhf]"); if(hf){ SKV.hf=hf.dataset.skhf; skDrawList(); return; }
  const doc=t.closest("[data-skdoc]"); if(doc){ e.preventDefault(); const j=D.journal.find(x=>x.id===doc.dataset.skdoc); if(!j){ toast("info","Накладной нет на этом устройстве","Обновите страницу."); return; } skClose(true); docCard(j, isArch(j)); return; }
  const ih=t.closest("[data-skihist]"); if(ih){ e.stopPropagation(); skItemHist(ih.dataset.skihist); return; }
  const idl=t.closest("[data-skidecl]"); if(idl){ e.stopPropagation(); skItemDecl(idl.dataset.skidecl); return; }
  const iup=t.closest("[data-skiup]"); if(iup){ e.stopPropagation(); const it=skIdx().item[iup.dataset.skiup]; if(it) dForm({chips:[{t:it.name, item:it.id}]}, ()=>{ if(curTab==="stock") skDrawList(); }); return; }
  const hff=t.closest("[data-skhff]"); if(hff){ SKH.f=hff.dataset.skhff; SKH.n=20; skModalRefresh(); return; }
  const hmo=t.closest("[data-skhmore]"); if(hmo){ SKH.n=hmo.dataset.skhmore==="all"?1e9:SKH.n+20; skModalRefresh(); return; }
  const itb=t.closest("[data-skitem]"); if(itb){ skItemCard(itb.dataset.skitem); return; }
  const bb=t.closest("[data-skbatch]"); if(bb){ skBatchCard(bb.dataset.skbatch); return; }
  const fp=t.closest("[data-skfprn]"); if(fp){ dPrint(fp.dataset.skfprn); return; }
  const fv=t.closest("[data-skfview],[data-skfget]"); if(fv){ skFile(fv.dataset.skfview||fv.dataset.skfget, !!fv.dataset.skfview); return; }
  const fdl=t.closest("[data-skfdel]"); if(fdl){ if(!armed(fdl,"Удалить?")) return; skDo("fileDel",{id:fdl.dataset.skfdel},"Удаление декларации","Декларация удалена"); return; }
  const ap=t.closest("[data-skattach]"); if(ap){ const id=ap.dataset.skattach; skClose(true); skItemCard(id); skPickFile(id,""); return; }
  const sl=t.closest("[data-skl]"); if(sl){ skLineCard(+sl.dataset.skl); return; }
  const kd=t.closest("[data-skd]"); if(kd){ const j=D.journal.find(x=>x.id===kd.dataset.doc); if(!j) return; const a=kd.dataset.skd;
    if(a==="reserve"){ skBusy(kd,true,"Проверяю…"); try{ await skSend("reserve",{docId:j.id},"Обновить резерв № "+j.number); const L=skDocLines(j), sh=L.filter(x=>x.short>0); toast(sh.length?"warn":"ok", sh.length?"Резерв обновлён, но не хватает":"Резерв обновлён", sh.map(x=>x.item.name+" — "+skQf(x.short,x.unit)).join("; ")); const c=document.getElementById("fd-dcard"); if(c) docCard(j); }catch(er){ skErr(er,"обновление резерва"); } finally{ skBusy(kd,false); } return; }
    const c=document.getElementById("fd-dcard"); if(c){ c.remove(); } skShipForm(j, a); return; }
  const lk=t.closest("[data-sklink]"); if(lk){ const it=skIdx().item[SKI.id]; if(!it) return; SKI.linkQ=""; const e=lk.dataset.sklink; skBusy(lk,true,"Связываю…"); try{ await skSend("item",{itemId:it.id, links:(it._lk||[]).concat(e)},"Связь: "+it.name); toast("ok","Связано","«"+skLkName(e)+"» → «"+it.name+"»"); skRelinkReserve([e]); }catch(er){ skErr(er,"связь"); } return; }
  const ul=t.closest("[data-skunlink]"); if(ul){ if(!armed(ul,"Убрать?")) return; const it=skIdx().item[SKI.id], e=ul.dataset.skunlink; const r=await skDo("item",{itemId:it.id, links:(it._lk||[]).filter(x=>x!==e)},"Связь: "+it.name,"Связь убрана"); if(r) skRelinkReserve([e]); return; }
  const lt=t.closest("[data-sklinkto]"); if(lt){ const it=skIdx().item[lt.dataset.sklinkto], l=D.draft.lines[SKL.i]; if(!it||!l) return; const cid=D.draft.customerId||"", e=skLkKey(l.productId, skLkSrv()&&SKL.sc==="cus"&&cid?cid:""); skBusy(lt,true,"Связываю…");
    try{ await skSend("item",{itemId:it.id, links:(it._lk||[]).concat(e)},"Связь: "+it.name); SKL.relink=false; toast("ok","Связано","Теперь «"+((prod(l.productId)||{}).name||"")+"» берётся со склада как «"+it.name+"»"+(skLkC(e)?" — только для «"+cusNm(cid)+"»":"")+"."); skRelinkReserve([e], D.draft.id); }catch(er){ skErr(er,"связь"); } return; }
  const lsc=t.closest("[data-sklsc]"); if(lsc){ SKL.sc=lsc.dataset.sklsc; skModalRefresh(); return; }
  const pk=t.closest("[data-skpick]"); if(pk){ skInRead(); const it=skIdx().item[pk.dataset.skpick]; if(it){ SKIN.itemId=it.id; SKIN.name=it.name; SKIN.unit=it.unit||SKIN.unit; if(!skNum(SKIN.pack)) SKIN.pack=skLastPack(it.id,SKIN.unit); if(!skNum(SKIN.bx)) SKIN.bx=skLastBox(it.id,SKIN.unit); } else SKIN.itemId=""; SKIN.sugOpen=false; skModalRefresh(); const q=$("#sk-dlg .skf-qty"); q&&q.focus(); return; }
  const mf=t.closest("[data-skmf]"); if(mf){ SKI.f=mf.dataset.skmf; SKMVN.i=10; skModalRefresh(); return; }
  const rl=t.closest("[data-skresl]"); if(rl){ SKI.resU=SKI.resU===rl.dataset.skresl?null:rl.dataset.skresl; skModalRefresh(); return; }
  const ws=t.closest("[data-skwship]"); if(ws){ const j=D.journal.find(x=>x.id===ws.dataset.skwship); if(j) skShipForm(j,"ship"); return; }
  const dy=t.closest("[data-skday]"); if(dy){ skDayShip(dy.dataset.skday); return; }
  const rg=t.closest("[data-skrwgo]"); if(rg){ skBatchCard(rg.dataset.skrwgo); SKB.mode="rw"; SKRW=null; skModalRefresh(); return; }
  const b=t.closest("[data-sk]"); if(!b) return; const a=b.dataset.sk;
  if(a==="bulk"){ skBulk(); return; }
  if(a==="bulkParse"){ SKBULK.text=skVal(".skbkt"); SKBULK.date=skVal(".skbkd")||todayISO(); skBulkParse(); skModalRefresh(); return; }
  if(a==="bulkSave"){ const R=(SKBULK.rows||[]).filter(r=>!r.err.length); if(!R.length) return;
    const rows=R.map(r=>({itemId:r.it?r.it.id:"", newName:r.it?"":r.name, unit:r.unit, qty:String(r.qty), price:r.price, date:r.date, exp:r.exp, supplier:"", docRef:""}));
    const j=await skDo("bulk",{kind:SKBULK.kind, rows},(SKBULK.kind==="init"?"Начальные остатки":"Приход списком")+": "+rows.length+" "+plural(rows.length,["строка","строки","строк"]),"Проведено: "+rows.length+" "+plural(rows.length,["строка","строки","строк"]),b); if(j) skClose(); return; }
  if(a==="mergeOn"){ SKI.merge=true; skModalRefresh(); return; } if(a==="mergeOff"){ SKI.merge=false; skModalRefresh(); return; }
  if(a==="mergeSave"){ const to=skVal(".skmto"); if(!to){ toast("err","Выберите товар, который оставить",""); return; } if(!armed(b,"Точно объединить?")) return;
    const from=SKI.id, j=await skDo("merge",{fromId:from, toId:to},"Объединение товаров","Товары объединены",b); if(j){ SKI.merge=false; skItemCard(to); } return; }
  if(a==="defSave"){ const r=document.querySelector('#sk-dlg input[name="skdef"]:checked'), v=r?r.value:"", C=[...document.querySelectorAll("#sk-dlg .skdefcb:checked")].map(x=>x.value);
    if(v==="some" && !C.length){ toast("err","Отметьте заказчиков","Или выберите «во всех новых документах»."); return; }
    await skDo("item",{itemId:SKI.id, def:v?"s":"", defC:v==="some"?C:[]},"Источник по умолчанию", v?"Теперь в новых документах — со склада":"Теперь по умолчанию — от Саида",b); return; }
  if(a==="cancelSave"){ const r=skN(skVal(".skcr")); if(!r){ toast("err","Укажите причину",""); return; } const j=await skDo("cancelIn",{batchId:SKB.id, reason:r},"Отмена прихода","Приход отменён",b); if(j){ SKB.mode=""; skModalRefresh(); } return; }
  if(a==="dayShipSave"){ const L=skDayDocs(SKDAY.date).filter(o=>!SKDAY.off[o.j.id]); if(!L.length) return; skBusy(b,true,"Отгружаю…"); let ok=0, q=0;
    for(const o of L){ const lines=o.L.map(x=>({lineId:x.l.lid, qty:String(x.res)})); try{ await skSend("ship",{docId:o.j.id, lines},"Отгрузка № "+o.j.number); ok++; }catch(e){ if(e.queued){ q++; continue; } toast("err","№ "+o.j.number+": не отгружено", e.message); } }
    skBusy(b,false); toast(q?"warn":"ok", ok?"Отгружено со склада: "+ok+" "+plural(ok,["накладная","накладные","накладных"]):"Ничего не отгружено", q?q+" ждут отправки — нет связи.":""); skClose(); if(curTab==="calendar") renderCalendar(); return; }
  if(a==="close"){ skClose(); return; }
  if(a==="relink"||a==="relinkOff"){ if(!SKL) return; SKL.relink=a==="relink"; SKL.sc=""; SKL.linkQ=""; skModalRefresh(); if(SKL.relink){ const f=document.querySelector("#sk-dlg .sklq2"); f&&f.focus(); } return; }
  if(a==="in"){ skMultiIn(); return; }
  if(a==="init"){ skInForm(a); return; }
  if(a==="inv"){ skInv(); return; }
  if(a==="rcv"){ skRcv(""); return; }
  if(a==="flush"){ skFlushQ(); return; }
  if(a==="more"){ SKV.shown+=100; skDrawList(); return; }
  if(a==="attach"){ dForm(); return; }
  if(a==="reload"){ skLoad(); return; }
  if(a==="item"){ skItemCard(b.dataset.id); return; }
  if(a==="inItem"){ const id=SKI.id; skInForm("in", id); return; }
  if(a==="attachItemDecl"){ const it=skIdx().item[SKID.id], back=SKID.id; if(it) dForm({chips:[{t:it.name, item:it.id}]}, ()=>skItemDecl(back)); return; }
  if(a==="attachItem"){ const it=skIdx().item[SKI.id], back=SKI.id; if(it) dForm({chips:[{t:it.name, item:it.id}]}, ()=>skItemCard(back)); return; }
  if(a==="attachBatch"){ const bt=skIdx().batch[SKB.id], it=bt&&skIdx().item[bt.itemId], back=SKB.id; if(it) dForm({chips:[{t:it.name, item:it.id}], batchId:bt.id}, ()=>skBatchCard(back)); return; }
  if(a==="resclose"){ SKI.resU=null; skModalRefresh(); return; }
  if(a==="itemEdit"){ SKI.edit=true; skModalRefresh(); return; } if(a==="itemEditOff"){ SKI.edit=false; skModalRefresh(); return; }
  if(a==="itemSave"){ const u=skVal(".skiu"); const j=await skDo("item",{itemId:SKI.id, name:skVal(".skin"), alt:skVal(".skalt"), unit:u==="__new"?undefined:u},"Товар склада","Сохранено",b); if(j){ SKI.edit=false; skModalRefresh(); } return; }
  if(a==="pwSave"||a==="pwClr"){ const v=$("#sk-dlg .skpwv"); if(v&&SKPW) SKPW.v=v.value; await skPwSave(b, a==="pwClr"); return; }
  if(a==="note"||a==="noteclr"){ const v=a==="noteclr"?"":skVal(".skcomment"); await skDo("item",{itemId:SKI.id, note:v},"Комментарий к товару",v?"Комментарий сохранён":"Комментарий очищен",b); return; }
  if(a==="mode"){ SKB.mode=b.dataset.m; if(SKB.mode==="rw") SKRW=null; skModalRefresh(); return; } if(a==="mode0"){ SKB.mode=""; skModalRefresh(); return; }
  if(a==="batchSave"){ const bt=skIdx().batch[SKB.id], d={batchId:SKB.id}; if(!bt) return;
    if(!docLimited()){ const p=skVal(".skbp").replace(",",".").replace(/\s/g,""); if(p!==String(bt.price||"")){ d.price=p;
      if(p!=="" && !(+p>=0)){ toast("err","Цена — число","Например 39,20. Или сотрите, если цены нет."); return; }
      const o=+bt.price; if(p!=="" && o>0 && +p>0 && (+p/o>3 || o/(+p)>3) && !armed(b,"Цена верная — сохранить")){ toast("warn","Цена сильно отличается","Было "+fm(o)+" ₽, стало "+fm(+p)+" ₽ за "+bt.unit+". Если всё верно — нажмите ещё раз."); return; }
      if(p==="" && o>0 && !armed(b,"Убрать цену — сохранить")){ toast("warn","Цена будет пустой","Без цены себестоимость и прибыль по этому товару не посчитаются. Если так и нужно — нажмите ещё раз."); return; } } }
    const ev=skVal(".skbe"), root=skRoot(bt); if(ev!==(root.exp||"")){ if(ev && ev<root.date){ toast("err","Срок годности раньше даты приёмки",""); return; } d.exp=ev; }
    if(skK(bt.unit)!=="шт"){ const pk=skVal(".skbpk").replace(",",".").trim(); if(pk!=="" && !(+pk>0)){ toast("err","Вес 1 шт — число больше нуля","Или сотрите, если фасовки нет."); return; } if(Math.abs((+pk||0)-skPack(bt))>1e-9){ const w=skPcW(bt.itemId); if(+pk>0 && w && skK(bt.unit)==="кг" && (+pk/w.w<0.75 || +pk/w.w>1.33) && !armed(b,"Вес верный — сохранить")){ toast("warn","Проверьте вес 1 шт","Вы вписали "+skGr(+pk)+", а "+(w.src==="own"?"у товара":"в названии")+" — "+skGr(w.w)+". Если всё верно — нажмите ещё раз."); return; } d.pack=pk; skPackSave(bt.id,pk); } }
    { const bx=skVal(".skbbx").replace(",",".").trim(); if(bx!=="" && !(+bx>0)){ toast("err","Штук в коробке — число больше нуля","Или сотрите, если коробок нет."); return; } if(Math.abs((+bx||0)-skBox(bt))>1e-9){ d.box=bx; skBoxSave(bt.id,bx); } }
    if(skVal(".skbs")!==(bt.supplier||"")) d.supplier=skVal(".skbs"); if(skVal(".skbd")!==(bt.docRef||"")) d.docRef=skVal(".skbd");
    const qv=skVal(".skbq"); if(qv && r3(+qv.replace(",","."))!==r3(bt.qty)){ d.qty=qv.replace(",","."); d.reason=skVal(".skbr2"); if(!skN(d.reason)){ toast("err","Укажите причину исправления количества",""); return; } }
    if(Object.keys(d).length===1){ SKB.mode=""; skModalRefresh(); return; }
    const j=await skDo("batch",d,"Партия: "+bt.name,"Партия изменена",b); if(j){ SKB.mode=""; skModalRefresh(); } return; }
  if(a==="woSave"){ const bt=skIdx().batch[SKB.id]; if(!bt) return; const q=skNum(skVal(".skwq")), fr=r3(skFree(bt.id));
    if(!(q>0)){ toast("err","Сколько списать?","Впишите количество, например 2,5."); return; }
    if(skK(bt.unit)==="шт" && Math.round(q)!==q){ toast("err","Штуки — только целым числом",""); return; }
    if(q>fr+0.0005){ toast("err","Столько нет","Свободно только "+skQf(fr,bt.unit)+(skRes(bt.id)?" — остальное в резерве накладных.":".")); return; }
    const r=skN(skVal(".skwr")); if(!r){ toast("err","Укажите причину списания","Например: испортился, усушка, брак."); return; }
    if(Math.abs(q-fr)<0.0005 && !armed(b,"Списать всё: "+skQf(q,bt.unit)+"?")) return; const j=await skDo("wo",{batchId:SKB.id, qty:skVal(".skwq").replace(",","."), reason:r},"Списание","Списано",b); if(j){ SKB.mode=""; skModalRefresh(); } return; }
  if(a==="rwSave"){ const bt=skIdx().batch[SKB.id]; if(!bt) return; SKRW=SKRW&&SKRW.id===bt.id?SKRW:{id:bt.id}; SKRW.n=skVal(".skrn"); SKRW.kg=skVal(".skrk"); const c=skRwCheck(bt), box=$("#sk-rwc"); if(box) box.innerHTML=skRwCheckHtml(bt);
    if(c.err.length){ toast("err","Проверьте перевзвешивание",c.err[0]); return; }
    if(c.warn.length && !armed(b,"Вес верный — перевзвесить")){ toast("warn","Проверьте вес","Если всё верно — нажмите ещё раз."); return; }
    const mem=!!(document.querySelector("#sk-dlg .skrwm")||{}).checked, per=Math.round(c.per*1e6)/1e6, it=skIdx().item[bt.itemId]||{};
    const j=await skDo("rw",{batchId:bt.id, n:String(c.n), kg:String(c.kg)},"Перевзвешивание: "+(it.name||""),"Перевзвешено",b); if(!j || !j.out) return;
    skPackSave(j.out.batchId, per); SKRW=null;
    if(mem && !c.warn.length && !skIPack(bt.itemId)){   /* вес, который сайт счёл странным, у товара не запоминаем */ if(skIPackSrv()){ try{ await skSend("item",{itemId:bt.itemId, pack:String(per)},"Вес 1 шт: "+(it.name||"")); }catch(er){ skErr(er,"вес 1 шт"); } } else skIPackSave(bt.itemId, per); }
    skRwDone(j, skQf(c.n,bt.unit)+" → "+skQf(c.kg,"кг")); skBatchCard(j.out.batchId); return; }
  if(a==="inSave"){ skInSave(false); return; }
  if(a==="invSave"){ const rows=Object.keys(SKINV.f).filter(k=>SKINV.f[k]!=="").map(k=>({batchId:k, fact:String(SKINV.f[k]).replace(",",".")})); if(!rows.length){ toast("err","Впишите факт хотя бы по одной партии",""); return; }
    const j=await skDo("inv",{rows, note:skVal(".skinvn")},"Инвентаризация ("+rows.length+" парт.)","Акт проведён",b); if(j){ toast("ok","Акт инвентаризации сохранён", (j.out&&j.out.diffN)?"Расхождений: "+j.out.diffN+" — остатки поправлены":"Расхождений нет"); skClose(); } return; }
  if(a==="lineSave"){ const l=D.draft.lines[SKL.i], r=document.querySelector('#sk-dlg input[name="sksrc"]:checked'), m=r?r.value:""; if(!l) return;
    if(!m) delete l.stk; else if(m==="s") l.stk={m:"s"}; else { const qv=+skVal(".skmq").replace(",","."), pd=skVal(".skmp").replace(",",".").trim();
      if(!(qv>0)){ toast("err","Сколько взять со склада?","Впишите количество складской части."); return; } if(qv>=(+l.qty||0)){ l.stk={m:"s"}; toast("info","Всё количество — со склада","Выбрано «Со склада»."); } else l.stk=Object.assign({m:"x", q:String(r3(qv))}, pd&&+pd>=0?{pd}:{}); }
    l.stkSet=1; delete l.stkA; if(!l.lid) l.lid=uid()+uid(); saveLocal(); skClose(); renderLines(); toast("ok", m?"Источник: "+(m==="s"?"со склада":"часть со склада"):"Источник: от Саида", m?"Резерв появится после сохранения документа.":""); return; }
  if(a==="shipSave"){ const lines=[]; $("#sk-dlg").querySelectorAll(".skshq,.skshd").forEach(el=>{ const lid=el.dataset.l; let o=lines.find(x=>x.lineId===lid); if(!o){ o={lineId:lid}; lines.push(o); } o[el.classList.contains("skshq")?"qty":"direct"]=el.value.replace(",","."); });
    const j=await skDo("ship",{docId:SKS.id, lines},"Отгрузка № "+(D.journal.find(x=>x.id===SKS.id)||{}).number,"Отгрузка проведена",b); if(j) skClose(); return; }
  if(a==="closeSave"){ const r=skN(skVal(".skclr")); if(!r){ toast("err","Укажите причину",""); return; } const j=await skDo("close",{docId:SKS.id, reason:r},"Закрыть остаток","Остаток закрыт, резерв снят",b); if(j) skClose(); return; }
  if(a==="retSave"){ const L=[...$("#sk-dlg").querySelectorAll(".skretq")].filter(el=>+el.value.replace(",",".")>0); if(!L.length){ toast("err","Сколько вернуть?",""); return; }
    for(const el of L){ const j=await skDo("ret",{docId:SKS.id, lineId:el.dataset.l, qty:el.value.replace(",","."), reason:skVal(".skretr")},"Возврат","Возврат проведён",b); if(!j) return; } skClose(); return; }
});
document.addEventListener("input", e=>{ const t=e.target; if(!t.closest) return;
  if(t.id==="sk-q"){ SKV.q=t.value; SKV.shown=60; skDrawList(); return; }
  if(t.classList.contains("skf-name")){ SKIN.name=t.value; SKIN.sugOpen=true; SKIN.itemId=""; const s=$("#sk-sug"); if(s) s.innerHTML=skInSug(); return; }
  if(t.closest("#sk-dlg") && SKIN){ const m=String(t.className).match(/skf-(qty|price|pcs|pack|ppc|bx|bn)\b/); if(m){ skInLink("skf-"+m[1]); return; } }
  if(t.classList.contains("sklq")){ SKI.linkQ=t.value; const s=t.parentNode.querySelector(".sklsug"), it=skIdx().item[SKI.id]; if(s&&it) s.innerHTML=skLinkSug(it); return; }
  if(t.classList.contains("sklq2")){ SKL.linkQ=t.value; const s=t.parentNode.querySelector(".sklsug"), l=D.draft.lines[SKL.i]; if(s&&l) s.innerHTML=skItemSug(prod(l.productId)||{}); return; }
  if(t.classList.contains("skinvf")){ SKINV.f[t.dataset.b]=t.value; const f=skFact(t.dataset.b), td=$("#sk-dlg").querySelector(`[data-d="${t.dataset.b}"]`), v=t.value.trim(); const d=v===""?null:r3(+v.replace(",",".")-f);
    if(td) td.innerHTML = d==null||isNaN(d) ? "" : d===0?`<span class="muted">0</span>`:`<b class="${d<0?"neg":"pos"}">${d>0?"+":""}${skQf(d)}</b>`; return; }
});
document.addEventListener("change", async e=>{ const t=e.target; if(!t.closest || !t.closest("#sk-dlg, #tab-stock")) return;
  if(t.name==="sksrc"){ const mx=$("#sk-dlg .skmix"); if(mx) mx.hidden=t.value!=="x"; $("#sk-dlg").querySelectorAll(".skopt").forEach(o=>o.classList.toggle("on", o.querySelector("input").checked)); return; }
  if(t.classList.contains("skinvall")){ SKINV.all=t.checked; skModalRefresh(); return; }
  if(t.name==="skdef"){ const c=$("#sk-dlg .skdefc"); if(c) c.hidden=t.value!=="some"; t.closest(".skopts").querySelectorAll(".skopt").forEach(o=>o.classList.toggle("on", o.querySelector("input").checked)); return; }
  if(t.name==="skbk"){ SKBULK.kind=t.value; SKBULK.text=skVal(".skbkt"); skModalRefresh(); return; }
  if(t.classList.contains("skdaycb")){ SKDAY.off[t.value]=!t.checked; const n=skDayDocs(SKDAY.date).filter(o=>!SKDAY.off[o.j.id]).length, bb=$("#sk-dlg [data-sk=\"dayShipSave\"]"); if(bb){ bb.disabled=!n; bb.textContent="Отгрузить "+n+" "+plural(n,["накладную","накладные","накладных"]); } return; }
  if(t.tagName==="SELECT" && t.value==="__new"){ const u=skN(prompt("Новая единица измерения (например, «мешок»):")||""); if(!u){ t.value=t.options[0].value; return; }
    const known=skIdx().units.find(x=>skK(x)===skK(u)); if(known){ t.value=known; if(SKIN && t.classList.contains("skf-unit")){ skInRead(); SKIN.unit=known; skModalRefresh(); } toast("info","Такая единица уже есть","Выбрана «"+known+"»."); return; }
    try{ await skSend("unit",{name:u},"Новая единица «"+u+"»"); toast("ok","Единица «"+u+"» добавлена","Она доступна всем после синхронизации."); if(SKIN && t.classList.contains("skf-unit")){ skInRead(); SKIN.unit=u; } skModalRefresh(); }
    catch(er){ skErr(er,"единица"); t.value=t.options[0].value; } return; }
  if(t.classList.contains("skf-unit") && SKIN && t.value!=="__new"){ skInRead(); SKIN.unit=t.value; if(SKIN.itemId && !skNum(SKIN.pack)) SKIN.pack=skLastPack(SKIN.itemId,SKIN.unit); t.focus(); skModalRefresh(); }
});
document.addEventListener("focusin", e=>{ const t=e.target; if(t.classList && t.classList.contains("skf-name") && SKIN){ SKIN.sugOpen=true; const s=$("#sk-sug"); if(s) s.innerHTML=skInSug(); } });
/* вкладка: при открытии — сверка с таблицей, раз в минуту — снова, пока вкладка открыта */
setInterval(()=>{ if(curTab==="stock" && document.visibilityState==="visible" && skCan()) skLoad(true); }, 60000);
/* после сохранения/архивации накладной сервер сам пересчитал резерв — подтягиваем свежие остатки */
let skWatch=new Set();
function skAfterSave(e){ if(!SK_READY) return ""; if(!skCan() || !e || !e.snap) return; const st=(e.snap.dr.lines||[]).some(l=>l.stk&&l.stk.m);
  if(st || skIdx().S.res.some(r=>r.docId===e.id)){ if(st) skWatch.add(e.id); skSoon(); } }
/* после ответа таблицы — коротко, что зарезервировано и чего не хватает (подтверждение только от сервера) */
function skReport(){ if(!skWatch.size) return; const ids=[...skWatch]; skWatch.clear();
  ids.forEach(id=>{ const j=D.journal.find(x=>x.id===id); if(!j) return; const L=skDocLines(j).filter(x=>x.req>0); if(!L.length) return;
    const sh=L.filter(x=>x.short>0), txt=L.map(x=>(x.item?x.item.name:"не связан со складом")+": резерв "+skQf(x.res,x.unit)+(x.short?", нехватка "+skQf(x.short,x.unit):"")).join("; ");
    toast(sh.length?"warn":"ok", "Склад, № "+j.number+(sh.length?" — не хватает товара":" — товар зарезервирован"), txt); }); }
function skAfterArch(list, on){ if(!SK_READY) return ""; if(!skCan()) return; const X=skIdx(), hit=list.filter(j=>X.S.res.some(r=>r.docId===j.id) || skDocLines(j).some(x=>x.shipped>0));
  if(!hit.length) return; skSoon();
  if(on){ const sh=hit.filter(j=>skDocLines(j).some(x=>x.shipped-x.ret>0)); toast(sh.length?"warn":"info", "Резерв склада снимается", sh.length?"По № "+sh.map(j=>j.number).join(", ")+" товар уже отгружен со склада. Если он вернулся на склад — проведите возврат.":"Товар снова свободен на складе.", sh.length?{ms:15000, action:{label:"Провести возврат", fn:()=>skShipForm(sh[0],"ret")}}:{}); } }

/* названия склада для поиска товара в документе: «шиповник» находит договорную позицию «ягоды сушёные (шиповник)» */
function skNamesOf(pid){ if(!SK_READY) return []; const it=skItemOf(pid, (D.draft||{}).customerId||""); return it ? [it.name, ...String(it.alt||"").split(";").map(skN).filter(Boolean)] : []; }
function skPsTag(pid){ if(!SK_READY) return ""; const it=skItemOf(pid, (D.draft||{}).customerId||""), p=prod(pid)||{}; if(!it) return ""; const free=skFreeU(it.id,p.unit);
  return `<small class="pssk">${skK(it.name)!==skK(p.name)?"склад: «"+esc(it.name)+"» · ":"на складе: "}${skQf(free,p.unit)} свободно</small>`; }
/* себестоимость строки накладной со складской частью: фактическая по отгруженным партиям, по резерву — оценка; прямая часть — по цене Саида */
function skLineCost(j, l){ if(!SK_READY || !l.stk || !l.stk.m) return null;
  const si=skLineInfo(j.id, {productId:l.pid, qty:l.qty, lid:l.lid, stk:l.stk}, l.unit, (j.snap&&j.snap.dr||{}).customerId||""); if(!si.req || !si.item) return null;
  const X=skIdx(); let est=0, unk=!!si.noCost;
  X.S.res.filter(r=>r.docId===j.id && r.lineId===l.lid).forEach(r=>{ const b=X.batch[r.batchId]; if(!b || b.price===""||b.price==null) unk=true; else est+=(+r.qty)*(+b.price); });
  const actual=si.cost-si.retCost, prelim = si.need>0 || unk;
  return {stockQ:si.req, directQ:r3(Math.max(0,l.qty-si.req)), stockCost:r2(actual+est), short:si.short, prelim, shipped:si.shipped, pd:l.stk.pd!=null&&l.stk.pd!==""?+l.stk.pd:null}; }
/* единицы для товара в документе: стандартные (с кодом ОКЕИ) + добавленные на складе */
function skDocUnits(cur){ const L=Object.keys(UNITS); (SK_READY?skIdx().units:[]).forEach(u=>{ if(!L.some(x=>skK(x)===skK(u))) L.push(u); }); if(cur && !L.some(x=>skK(x)===skK(cur))) L.push(cur); return L; }
async function skNewUnit(){ const u=skN(prompt("Новая единица измерения (например, «мешок»):")||""); if(!u) return null;
  const known=skDocUnits().find(x=>skK(x)===skK(u)); if(known) return known;
  try{ await skSend("unit",{name:u},"Новая единица «"+u+"»"); toast("ok","Единица «"+u+"» добавлена","Она доступна всем после синхронизации."); return u; }
  catch(e){ if(e.queued){ skErr(e,"единица"); return u; } skErr(e,"единица"); return null; } }

/* ================= удобства склада ================= */
/* «данные на 14:20» — если сверка с таблицей была давно или есть неотправленное */
function skStale(){ if(!SK || !SK.at) return ""; const age=Date.now()-new Date(SK.at).getTime(); if(age<10*60000 && !skQ().length) return "";
  return ` <span class="muted skstale" title="Остатки на устройстве. Таблица проверит наличие ещё раз при сохранении.">(данные на ${new Date(SK.at).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})})</span>`; }
/* ---------- источник по умолчанию у товара ---------- */
const skDefC = it => { try{ const a=JSON.parse(it.defC||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } };
const skDefFor = (it, cid) => !!it && it.def==="s" && (!skDefC(it).length || skDefC(it).includes(cid));
function skDefBox(it){ const on=it.def==="s", L=skDefC(it), used=new Set(); (it._links||[]).forEach(pid=>Object.keys(D.prices||{}).forEach(c=>{ const v=(D.prices[c]||{})[pid]; if(v!=null&&v!=="") used.add(c); }));
  const C=D.customers.filter(c=>used.has(c.id)||L.includes(c.id)).sort((a,b)=>a.name.localeCompare(b.name,"ru")), mode=!on?"":L.length?"some":"all";
  return `<div class="skbox"><div class="skbh"><b>Брать со склада автоматически${skHQ("Брать со склада автоматически")}</b></div>
    <div class="skopts sm">${[["","Нет — по умолчанию от Саида"],["all","Да — во всех новых документах"],["some","Да — только для выбранных заказчиков"]].map(([k,t])=>`<label class="skopt${mode===k?" on":""}"><input type="radio" name="skdef" value="${k}"${mode===k?" checked":""}><span><b>${t}</b></span></label>`).join("")}</div>
    <div class="skdefc"${mode==="some"?"":" hidden"}>${C.length?C.map(c=>`<label class="chk"><input type="checkbox" class="skdefcb" value="${c.id}"${L.includes(c.id)?" checked":""}> ${esc(c.name)}</label>`).join(""):`<p class="muted">Сначала свяжите товар с позициями документов — здесь появятся заказчики, у которых эти позиции в прайсе.</p>`}</div>
    <div class="row"><button type="button" class="btn sm" data-sk="defSave">Сохранить</button><small class="muted">Действует на новые документы: если товар свободен — строка сама станет «Со склада», если его мало — «Часть со склада».</small></div></div>`; }
/* новый документ: строки без явного выбора получают источник по настройке товара (старые накладные не трогаем) */
function skAutoSrc(dr){ if(!SK_READY || skSrv===false || !dr || !dr.lines) return; const take={};
  dr.lines.forEach(l=>{ if(!l.productId || l.stk || l.stkSet || !(+l.qty>0)) return; const it=skItemOf(l.productId, dr.customerId||""), p=prod(l.productId)||{}; if(!skDefFor(it, dr.customerId)) return;
    const k=it.id+"|"+skK(p.unit), free=r3(skFreeU(it.id,p.unit)-(take[k]||0)), q=r3(+l.qty); if(free<=0) return;
    if(free>=q){ l.stk={m:"s"}; take[k]=r3((take[k]||0)+q); } else { l.stk={m:"x", q:String(free)}; take[k]=r3((take[k]||0)+free); } l.stkA=1; }); }
/* кнопка в форме документа: «Со склада всё, что есть» */
function skFillAll(){ const dr=D.draft, take={}; let n=0, part=0;
  dr.lines.forEach(l=>{ if(!l.productId || !(+l.qty>0)) return; const it=skItemOf(l.productId, dr.customerId||""), p=prod(l.productId)||{}; if(!it) return;
    const k=it.id+"|"+skK(p.unit), free=r3(skFreeU(it.id,p.unit)-(take[k]||0)), q=r3(+l.qty); if(free<=0) return;
    if(free>=q){ l.stk={m:"s"}; take[k]=r3((take[k]||0)+q); } else { l.stk={m:"x", q:String(free)}; take[k]=r3((take[k]||0)+free); part++; }
    l.stkSet=1; delete l.stkA; if(!l.lid) l.lid=uid()+uid(); n++; });
  saveLocal(); renderLines();
  toast(n?"ok":"info", n?"Со склада: "+n+" "+plural(n,["строка","строки","строк"]):"На складе нечего взять", n?(part?part+" — частично, остальное от Саида. ":"")+"Резерв появится после сохранения документа.":"Свободного товара по позициям этого документа нет (или они не связаны со складом)."); }
function skAllBtn(){ const b=document.getElementById("d-skall"); if(!b) return; const dr=D.draft;
  const can=SK_READY && skSrv!==false && !dr.qtyOnly && dr.lines.some(l=>{ if(!l.productId||!(+l.qty>0)) return false; const it=skItemOf(l.productId, dr.customerId||""); return it && skFreeU(it.id,(prod(l.productId)||{}).unit)>0 && (l.stk||{}).m!=="s"; });
  b.hidden=!can; }
/* ---------- вес 1 шт у товара (вписывается руками) ---------- */
let SKPW=null;   /* {id, v, u:"г"|"кг"} — что набрано в поле */
function skPwBox(it){ const own=skIPack(it.id), nm=miWeight(it.name), pw=skPcW(it.id);
  if(!SKPW || SKPW.id!==it.id) SKPW={id:it.id, v:own?(own<1?String(Math.round(own*1e4)/10):String(own)).replace(".",","):"", u:own&&own>=1?"кг":"г"};
  return `<div class="skbox skpwb"><div class="skbh"><b>Вес 1 шт</b><small class="muted">сайт сам переведёт штуки в кг: например, 405 шт ≈ 202,5 кг</small></div>
    <div class="skpw"><input class="skpwv" data-keep="1" inputmode="decimal" value="${esc(SKPW.v)}" placeholder="${nm&&nm.unit==="кг"?"из названия: "+esc(skGr(nm.w)):"например 500"}" aria-label="Вес 1 шт"><div class="fdseg skpwu" role="group" aria-label="Единица"><i style="--x:${SKPW.u==="кг"?"100%":"0%"}"></i><button type="button" data-skpwu="г" class="${SKPW.u==="г"?"on":""}">г</button><button type="button" data-skpwu="кг" class="${SKPW.u==="кг"?"on":""}">кг</button></div><button type="button" class="btn sm pri" data-sk="pwSave">Сохранить</button>${own?`<button type="button" class="btn ghost sm" data-sk="pwClr">Убрать</button>`:""}</div>
    <div class="skpwc" id="sk-pwc">${skPwCheckHtml(it)}</div>
    ${!own&&pw&&pw.src==="name"?`<small class="muted">Сейчас вес берётся из названия: 1 шт = ${esc(skGr(pw.w))}. Впишите, если в названии не тот вес.</small>`:""}${own&&!skIPackSrv()?`<small class="muted">Сохранено только на этом устройстве — обновите скрипт таблицы, чтобы вес видели все.</small>`:""}</div>`; }
function skPwCheck(it){ const v=skNum(SKPW?SKPW.v:""), kg=v>0?(SKPW.u==="г"?v/1000:v):0, nm=miWeight(it.name), warn=[]; let sw="";
  if(String(SKPW?SKPW.v:"").trim()!=="" && !(v>0)) return {kg:0, err:"Вес — число больше нуля, например 500 г или 0,5 кг.", warn};
  if(SKPW && SKPW.u==="г" && v>0 && v<1){ warn.push("Меньше 1 грамма за штуку? Возможно, это килограммы."); sw="кг"; }
  if(SKPW && SKPW.u==="кг" && v>30){ warn.push(`${esc(skQf(v,"кг"))} за одну штуку? Возможно, это граммы (${esc(String(v).replace(".",","))} г).`); sw="г"; }
  if(kg>1000) return {kg:0, err:"Больше 1000 кг за штуку — так не бывает. Проверьте единицу (г или кг).", warn};
  if(kg && nm && nm.unit==="кг"){ const k=kg/nm.w; if(k<0.75||k>1.33) warn.push(`В названии товара указано ${esc(skGr(nm.w))}, а вы вписываете ${esc(skGr(kg))}. Проверьте.`); }
  return {kg, err:"", warn, sw}; }
function skPwCheckHtml(it){ const c=skPwCheck(it); if(c.err) return `<div class="skrw-e">${esc(c.err)}</div>`;
  const U=skUnitsOf(it.id).find(u=>skK(u.unit)==="шт"), n=U?U.fact:0;
  return (c.kg?`<div class="skrw-ok">1 шт = <b>${esc(skGr(c.kg))}</b>${n>0?` · на складе ${esc(skQf(n,"шт"))} ≈ <b>${esc(skQf(r3(n*c.kg),"кг"))}</b>`:""}</div>`:"")
    + c.warn.map(t=>`<div class="skrw-w"><span>${t}</span>${c.sw?`<button type="button" class="btn sm" data-skpwu="${c.sw}">Это ${c.sw}</button>`:""}</div>`).join(""); }
document.addEventListener("input", e=>{ const t=e.target; if(!t.classList || !t.classList.contains("skpwv") || !SKPW) return; SKPW.v=t.value; const it=skIdx().item[SKPW.id], c=$("#sk-pwc"); if(it&&c) c.innerHTML=skPwCheckHtml(it); });
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-skpwu]"); if(!b || !SKPW || !b.closest("#sk-dlg")) return; SKPW.u=b.dataset.skpwu; const v=$("#sk-dlg .skpwv"); if(v) SKPW.v=v.value; skModalRefresh(); });
async function skPwSave(b, clr){ const it=skIdx().item[SKPW&&SKPW.id]; if(!it) return; let kg="";
  if(!clr){ const c=skPwCheck(it); if(c.err){ toast("err","Проверьте вес 1 шт",c.err); return; } if(!c.kg){ toast("err","Впишите вес 1 шт","Например 500 г."); return; }
    if(c.warn.length && !armed(b,"Да, верно")){ toast("warn","Проверьте вес","Если всё верно — нажмите ещё раз."); return; } kg=String(Math.round(c.kg*1e6)/1e6); }
  if(!skIPackSrv()){ skIPackSave(it.id, kg); SKPW=null; skModalRefresh(); if(curTab==="stock") skDrawList(); toast("info", kg?"Вес 1 шт сохранён на этом устройстве":"Вес 1 шт убран", "Чтобы вес видели все, обновите скрипт таблицы (Code.gs)."); return; }
  const j=await skDo("item",{itemId:it.id, pack:kg},"Вес 1 шт: "+it.name, kg?"Вес 1 шт сохранён: "+skGr(+kg):"Вес 1 шт убран", b); if(j){ skIPackSave(it.id,""); SKPW=null; skModalRefresh(); } }
/* ---------- объединение двух товаров ---------- */
function skMergeBox(it){ const X=skIdx(), L=X.S.items.filter(i=>i.id!==it.id).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  return `<div class="skbox"><div class="skbh"><b>Объединить с другим товаром${skHQ("Объединить товары")}</b></div><p class="muted sk-hint">«${esc(it.name)}» исчезнет, его партии, остатки, резервы, декларации и связи перейдут в выбранный товар. Название «${esc(it.name)}» станет его другим названием.</p>
    <label class="f wide">Оставить товар<select class="skmto"><option value="">— выберите —</option>${L.map(i=>`<option value="${i.id}">${esc(i.name)}${skUnitsOf(i.id).length?" · "+skUnitsOf(i.id).map(u=>skQf(u.fact,u.unit)).join(", "):""}</option>`).join("")}</select></label>
    <div class="row"><button type="button" class="btn pri sm" data-sk="mergeSave">Объединить</button><button type="button" class="btn ghost sm" data-sk="mergeOff">Отмена</button></div></div>`; }
/* ---------- отмена прихода ---------- */
function skCanCancel(b){ if(!b || b.cancel || b.kind==="rw") return false; const X=skIdx();
  const rwNet=r3(X.S.moves.filter(m=>m.batchId===b.id && (m.type==="rwout"||m.type==="rwund")).reduce((a,m)=>a+(+m.qty||0),0));
  return !skRes(b.id) && !rwNet && !X.S.moves.some(m=>m.batchId===b.id && !["in","init","fix","rwout","rwund"].includes(m.type)) && !X.S.batches.some(x=>x.parent===b.id && !x.cancel) && skFact(b.id)===r3(+b.qty); }
/* ---------- перевзвешивание: проверка перед проведением и отмена ---------- */
let SKRW=null;   /* {id, n, kg, kgA — кг подставлены сайтом и пересчитываются за штуками} */
function skRwCheck(b){ const fr=r3(skFree(b.id)), n=skNum(SKRW?SKRW.n:""), kg=skNum(SKRW?SKRW.kg:""), pw=skPcW(b.itemId), err=[], warn=[];
  if(!(n>0)) err.push("Впишите, сколько "+b.unit+" перевзвешиваете.");
  else if(n>fr+0.0005) err.push("Свободно только "+skQf(fr,b.unit)+" — больше перевзвесить нельзя"+(skRes(b.id)?" (остальное в резерве накладных).":"."));
  else if(skK(b.unit)==="шт" && Math.round(n)!==n) err.push("Штуки — только целым числом.");
  if(!(kg>0)) err.push("Впишите, сколько вышло кг.");
  const per=n>0&&kg>0?kg/n:0; let fix=0;
  if(per && pw){ const k=per/pw.w; if(k<0.75||k>1.33){ fix=r3(n*pw.w);
    warn.push(`Получается 1 ${esc(b.unit)} = <b>${skGr(per)}</b>, а ${pw.src==="own"?"у товара указано":"в названии товара"} 1 шт = <b>${skGr(pw.w)}</b> — ${skTimes(k<1?1/k:k)} ${k<1?"меньше":"больше"}. Проверьте вес.`); } }
  if(per && !pw && (per<0.001||per>50)) warn.push(`Получается 1 ${esc(b.unit)} = <b>${skGr(per)}</b> — так бывает редко. Проверьте, не перепутаны ли граммы и килограммы.`);
  return {n, kg, per, pw, fix, err, warn}; }
const skTimes = x => { const r=Math.round(x*10)/10, n=Math.round(r); return Math.abs(r-n)<0.05 ? "в "+n+" "+plural(n,["раз","раза","раз"]) : "в "+String(r).replace(".",",")+" раза"; };
function skRwCheckHtml(b){ const c=skRwCheck(b);
  return (c.per&&!c.err.length?`<div class="skrw-ok${c.warn.length?" neu":""}">${esc(skQf(c.n,b.unit))} → <b>${esc(skQf(c.kg,"кг"))}</b> · 1 ${esc(b.unit)} = ${skGr(c.per)}${b.price!==""&&b.price!=null?` · цена станет ${fm(r2(c.n*(+b.price)/c.kg))} ₽/кг`:""}</div>`:"")
    + c.err.map(t=>`<div class="skrw-e">${esc(t)}</div>`).join("")
    + c.warn.map(t=>`<div class="skrw-w"><span>${t}</span>${c.fix?`<button type="button" class="btn sm" data-skrwfix="${c.fix}">Поставить ${esc(skQf(c.fix,"кг"))}</button>`:""}</div>`).join(""); }
document.addEventListener("input", e=>{ const t=e.target; if(!t.closest || !t.closest("#sk-dlg .skrwf") || !SKRW) return; const b=skIdx().batch[SKRW.id]; if(!b) return;
  if(t.classList.contains("skrn")){ SKRW.n=t.value; const pw=skPcW(b.itemId), n=skNum(t.value); if(SKRW.kgA && pw){ SKRW.kg=n>0?String(r3(n*pw.w)).replace(".",","):""; const k=$("#sk-dlg .skrk"); if(k) k.value=SKRW.kg; } }
  else if(t.classList.contains("skrk")){ SKRW.kg=t.value; SKRW.kgA=false; } else return;
  const c=$("#sk-rwc"); if(c) c.innerHTML=skRwCheckHtml(b); });
/* можно ли отменить перевзвешивание (партия в кг, из которой ещё ничего не брали) */
function skRwWhy(b){ if(!b || b.kind!=="rw" || b.cancel) return "нет"; const X=skIdx();
  if(skRes(b.id)>0) return "из новой партии уже зарезервировано "+skQf(skRes(b.id),b.unit)+" под накладные";
  if(X.S.moves.some(m=>m.batchId===b.id && m.type!=="rwin")) return "из новой партии уже брали товар (отгрузка, списание или инвентаризация)";
  if(X.S.batches.some(x=>x.parent===b.id && !x.cancel)) return "новую партию уже перевзвешивали дальше";
  if(r3(skFact(b.id))!==r3(+b.qty)) return "остаток новой партии уже менялся";
  if(!X.batch[b.parent]) return "исходная партия не найдена";
  return ""; }
const skCanRwUndo = b => !skRwWhy(b);
/* блок в карточке партии: «это перевзвешено — отменить?» и «из этой партии перевзвешивали» */
function skRwBox(b){ if(SKB.mode) return ""; const X=skIdx();
  if(b.kind==="rw"){ if(b.cancel) return `<div class="skrwbox off"><b>Перевзвешивание отменено</b><span>Упаковки вернулись в «${esc((X.batch[b.parent]||{}).name||"исходную партию")}».</span></div>`;
    const why=skRwWhy(b), p=X.batch[b.parent]||{}, out=X.S.moves.find(m=>m.batchId===p.id && m.type==="rwout" && m.id===String(b.id).replace(/:b$/,":m1")), n=out?-(+out.qty):null;
    return `<div class="skrwbox${why?" off":""}"><b>${why?"Отменить перевзвешивание уже нельзя":"Ошиблись при перевзвешивании?"}</b><span>${why?esc(why)+". Исправьте остаток инвентаризацией.":`«Отменить» уберёт эту партию (${esc(skQf(+b.qty,b.unit))}) и вернёт ${n!=null?"<b>"+esc(skQf(n,p.unit))+"</b>":"упаковки"} в «${esc(p.name||"исходную партию")}». Потом можно перевзвесить заново.`}</span>${why?"":`<button type="button" class="btn sm danger" data-skrwund="${esc(b.id)}">Отменить перевзвешивание</button>`}</div>`; }
  const K=X.S.batches.filter(x=>x.parent===b.id && x.kind==="rw" && !x.cancel); if(!K.length) return "";
  return `<div class="skrwbox kids"><b>Перевзвешено из этой партии</b>${K.map(k=>{ const why=skRwWhy(k); return `<div class="skrwk"><button type="button" class="lnk" data-skbatch="${esc(k.id)}">${esc(skQf(+k.qty,k.unit))} · ${esc(skWhen(k.at))} ›</button>${why?`<small class="muted" title="${esc(why)}">отменить нельзя</small>`:`<button type="button" class="btn ghost sm danger" data-skrwund="${esc(k.id)}">Отменить</button>`}</div>`; }).join("")}</div>`; }
async function skRwUndo(id, btn){ const X=skIdx(), b=X.batch[id]; if(!b) return; const why=skRwWhy(b); if(why){ toast("err","Отменить нельзя",why); return; }
  if(!skIPackSrv()){ toast("err","Нужен новый скрипт таблицы","Отмена перевзвешивания появится после обновления Code.gs (Данные → «Скрипт таблицы старый» → «Как обновить»)."); return; }
  if(btn && !armed(btn,"Да, отменить")) return;
  const p=X.batch[b.parent]||{}, out=X.S.moves.find(m=>m.batchId===p.id && m.type==="rwout" && m.id===String(b.id).replace(/:b$/,":m1")), n=out?-(+out.qty):0; let j=null;
  skBusy(btn,true); try{ j=await skSend("rwUndo",{batchId:id},"Отмена перевзвешивания: "+((X.item[b.itemId]||{}).name||"")); }catch(e){ skErr(e,"отмена перевзвешивания"); } finally{ skBusy(btn,false); }
  if(!j) return; toast("ok","Перевзвешивание отменено", (n?skQf(n,p.unit)+" вернулись в ":"Упаковки вернулись в ")+"«"+(p.name||"партию")+"». Можно перевзвесить заново.");
  if(SKM && document.getElementById("sk-dlg")) skBatchCard(p.id||id); else if(curTab==="stock") skDrawList(); }
/* после перевзвешивания: уведомление с «Отменить» */
function skRwDone(j, label){ const id=j&&j.out&&j.out.batchId; if(!id) return;
  toast("ok","Перевзвешено", label||"", {action:{label:"Отменить", fn:()=>skRwUndo(id)}, ms:12000}); }
document.addEventListener("click", e=>{ const u=e.target.closest && e.target.closest("[data-skrwund]"); if(u){ e.preventDefault(); e.stopPropagation(); skRwUndo(u.dataset.skrwund, u); return; }
  const fx=e.target.closest && e.target.closest("[data-skrwfix]"); if(fx && SKRW){ SKRW.kg=String(fx.dataset.skrwfix).replace(".",","); SKRW.kgA=true; const k=$("#sk-dlg .skrk"); if(k) k.value=SKRW.kg; const b=skIdx().batch[SKRW.id], c=$("#sk-rwc"); if(b&&c) c.innerHTML=skRwCheckHtml(b); } }, true);
/* ---------- ввод остатков (или приходов) списком ---------- */
let SKBULK=null;
function skBulk(){ SKBULK={kind:"init", text:"", rows:null, date:todayISO()}; skModal(skBulkHtml, true); }
function skBulkParse(){ const X=skIdx(), out=[];
  String(SKBULK.text||"").split(/\r?\n/).map(s=>s.trim()).filter(Boolean).forEach((line,i)=>{
    const a=line.includes("\t")?line.split("\t"):line.includes(";")?line.split(";"):null; let name, qty, unit, price, date, exp;
    if(a){ [name, qty, unit, price, date, exp]=a.map(x=>String(x||"").trim()); }
    else { const m=line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*([а-яёa-z.]+)?(?:\s+(?:по\s+)?(\d+(?:[.,]\d+)?))?/i); if(m){ name=m[1]; qty=m[2]; unit=m[3]; price=m[4]; } else name=line; }
    if(i===0 && /товар|наименован/i.test(name||"") && !/\d/.test(qty||"")) return;   /* заголовок таблицы */
    const dt=s=>{ const m=String(s||"").match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/); return m?(m[3].length===2?"20"+m[3]:m[3])+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):/^\d{4}-\d{2}-\d{2}$/.test(String(s||""))?s:""; };
    const it=X.S.items.find(x=>skK(x.name)===skK(name)||String(x.alt||"").split(";").some(y=>skK(y)===skK(name)));
    const u0=skN(unit||"").replace(/\.$/,""), uu=X.units.find(x=>skK(x)===skK(u0))||u0||(it&&it.unit)||"кг";
    const q=+String(qty||"").replace(",","."), pr=String(price||"").replace(",",".").replace(/[^\d.]/g,""), err=[];
    if(!skN(name)) err.push("нет названия"); if(!(q>0)) err.push("нет количества"); if(skK(uu)==="шт" && Math.round(q)!==q) err.push("штуки — целым числом");
    const d=dt(date)||SKBULK.date, e=dt(exp); if(e && e<d) err.push("срок раньше даты");
    const dupe=it && X.S.batches.some(b=>b.itemId===it.id && !b.cancel && b.date===d && r3(+b.qty)===r3(q));
    out.push({n:i+1, name:skN(name), it, qty:q, unit:uu, price:pr, date:d, exp:e, err, dupe, newUnit:!X.units.some(x=>skK(x)===skK(uu))}); });
  SKBULK.rows=out; }
function skBulkHtml(){ const B=SKBULK, R=B.rows, ok=R?R.filter(r=>!r.err.length):[], sum=ok.reduce((a,r)=>a+(r.price!==""?r.qty*(+r.price):0),0);
  return skHead("Склад","Ввести списком","Вставьте строки из Excel или напишите по одной на строку: товар, количество, единица, цена (по желанию — дата и «годен до»).", "Ввести списком")
   + `<div class="skopts sm row2">${[["init","Начальный остаток"],["in","Приход"]].map(([k,t])=>`<label class="skopt${B.kind===k?" on":""}"><input type="radio" name="skbk" value="${k}"${B.kind===k?" checked":""}><span><b>${t}</b></span></label>`).join("")}</div>
     <div class="skgrid"><label class="f">Дата (если в строке её нет)<input type="date" class="skbkd" data-keep="1" value="${esc(B.date)}"></label></div>
     <label class="f wide">Список<textarea class="skbkt" data-keep="1" rows="7" placeholder="Курага	50	кг	180&#10;Шиповник сушёный; 12; кг; 210; 01.11.26; 01.06.27&#10;Картофель 4 мешок 1000">${esc(B.text)}</textarea></label>
     <div class="row"><button type="button" class="btn" data-sk="bulkParse">Проверить список</button>${R?`<span class="muted">Строк: ${R.length} · готово: ${ok.length}${R.length-ok.length?` · <span class="miss">с ошибкой: ${R.length-ok.length}</span>`:""}</span>`:""}</div>
     ${R&&R.length?`<div class="tbl"><table class="skbkr"><thead><tr><th>#</th><th>Товар</th><th class="num">Кол-во</th><th class="num">Цена</th><th>Дата</th><th></th></tr></thead><tbody>${R.map(r=>`<tr class="${r.err.length?"bad":""}"><td>${r.n}</td><td><b>${esc(r.name)}</b><small>${r.it?"есть на складе":"<span class=\"pos\">новый товар</span>"}${r.newUnit?` · новая единица «${esc(r.unit)}»`:""}${r.dupe?` · <span class="miss">похоже на уже проведённый приход</span>`:""}</small></td><td class="num">${skQf(r.qty||0,r.unit)}</td><td class="num">${r.price!==""?fm(+r.price):`<span class="miss">нет</span>`}</td><td>${fd(r.date)}${r.exp?`<small>годен до ${fd(r.exp)}</small>`:""}</td><td>${r.err.length?`<span class="miss">${esc(r.err.join(", "))}</span>`:"✓"}</td></tr>`).join("")}</tbody></table></div>
       <p class="muted sk-hint">Итого по строкам с ценой: <b>${fm(r2(sum))} ₽</b>. Строки с ошибкой не проведутся — исправьте текст и нажмите «Проверить список» ещё раз.</p>`:""}
     <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="bulkSave"${ok.length&&ok.length===R.length?"":" disabled"}>${ok.length?"Провести "+ok.length+" "+plural(ok.length,["строку","строки","строк"]):"Провести"}</button></div>`; }
/* ---------- журнал: значок склада и фильтр ---------- */
function skJState(j){ if(!SK_READY || !j || !j.snap) return ""; const L=skDocLines(j).filter(x=>x.item && x.req>0); if(!L.length) return "";
  if(L.some(x=>x.short>0)) return "short"; if(L.some(x=>x.need>0)) return "wait"; return "done"; }
function skJBadge(j){ if(isArch(j)) return ""; const s=skJState(j); if(!s) return "";
  const L=skDocLines(j).filter(x=>x.item && x.req>0), sh=L.filter(x=>x.short>0);
  const t = s==="short" ? "нехватка: "+sh.map(x=>x.item.name+" "+skQf(x.short,x.unit)).join(", ") : s==="wait" ? "ждёт отгрузки со склада" : "отгружено со склада";
  return `<span class="skjb ${s==="done"?"sent":s}" title="Склад: ${esc(t)}">${skIcon}${s==="short"?"нехватка":s==="wait"?"резерв":"отгружено"}</span>`; }
/* ---------- календарь: отгрузить всё за день ---------- */
let SKDAY=null;
function skDayDocs(date){ return (D.journal||[]).filter(j=>j.snap && !isArch(j) && j.date===date).map(j=>({j, L:skDocLines(j).filter(x=>x.item && x.req>0 && x.res>0)})).filter(o=>o.L.length).sort((a,b)=>jNumSort(a.j,b.j)); }
function skDayShip(date){ SKDAY={date, off:{}}; SK_RE=()=>skDayShip(date); skModal(skDayHtml, true); }
function skDayHtml(){ const L=skDayDocs(SKDAY.date), n=L.filter(o=>!SKDAY.off[o.j.id]).length;
  return skHead("Склад","Отгрузить со склада за "+fd(SKDAY.date),"Всё, что зарезервировано по накладным этого дня, спишется со склада. Отметьте только то, что фактически уехало.", "Отгрузить за день")
   + (L.length?`<div class="skdl">${L.map(o=>`<label class="skdr skday"><span class="skdh2"><input type="checkbox" class="skdaycb" value="${o.j.id}"${SKDAY.off[o.j.id]?"":" checked"}><b>№ ${esc(o.j.number)} — ${esc(jWho(o.j).main)}</b></span><span>${o.L.map(x=>esc(x.item.name)+" "+skQf(x.res,x.unit)+(x.short?` <em class="miss">(нехватка ${skQf(x.short)} останется к допоставке)</em>`:"")).join(" · ")}</span></label>`).join("")}</div>`:`<p class="muted">На этот день нечего отгружать со склада.</p>`)
   + `<div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="dayShipSave"${n?"":" disabled"}>Отгрузить ${n} ${plural(n,["накладную","накладные","накладных"])}</button></div>`; }
function skDayBtn(date){ if(!SK_READY || skSrv===false) return ""; const n=skDayDocs(date).length; return n?`<button class="btn sm" type="button" data-skday="${date}">${skIcon}Отгрузить со склада (${n})</button>`:""; }
/* ---------- «Сайт нашёл сам»: склад ---------- */
function skAutoTasks(add){ if(!SK_READY || skSrv===false || !SK) return; const W=skWaitDocs(), late=W.filter(o=>o.late), sh=W.filter(o=>o.L.some(x=>x.short>0)), ex=skExpBatches();
  const go=k=>({tab:"stock", skdet:k, q:"#sk-det"}), nm=o=>"№ "+o.j.number+" ("+cusShort(jWho(o.j).main)+")";
  if(late.length) add("Склад",{key:"sk-late-"+late.map(o=>o.j.id).join(","), lvl:"warn", title:"Не отгружено со склада: "+late.length+" "+plural(late.length,["накладная","накладные","накладных"]), text:"Дата поставки прошла, а отгрузка со склада не отмечена — остатки не уменьшились. "+late.slice(0,4).map(nm).join(", ")+(late.length>4?" и ещё "+(late.length-4):"")+".", go:go("wait")});
  if(sh.length) add("Склад",{key:"sk-short-"+sh.map(o=>o.j.id).join(","), lvl:"err", title:"Не хватает товара на складе: "+sh.length+" "+plural(sh.length,["накладная","накладные","накладных"]), text:sh.slice(0,4).map(o=>nm(o)+": "+o.L.filter(x=>x.short>0).map(x=>x.item.name+" "+skQf(x.short,x.unit)).join(", ")).join("; ")+". Проведите приход и «Обновить резерв» или смените источник строки.", go:go("short")});
  if(ex.bad.length) add("Склад",{key:"sk-expbad-"+ex.bad.map(b=>b.id).join(","), lvl:"err", title:"Просрочен товар на складе: "+ex.bad.length+" парт.", text:ex.bad.slice(0,4).map(b=>(skIdx().item[b.itemId]||{}).name+" — годен до "+fd(skExp(b))).join("; ")+". Спишите или проверьте дату.", go:go("exp")});
  if(ex.soon.length) add("Склад",{key:"sk-expsoon-"+ex.soon.map(b=>b.id).join(","), lvl:"warn", title:"Срок годности кончается: "+ex.soon.length+" парт.", text:ex.soon.slice(0,4).map(b=>(skIdx().item[b.itemId]||{}).name+" — до "+fd(skExp(b))).join("; ")+".", go:go("exp")}); }
/* складская часть строки накладной (для маршрута водителя и закупки Саида): только по связанным товарам */
function skStockQ(j, l){ if(!SK_READY || !l || !l.stk || !l.stk.m) return 0; const it=skItemOf(l.pid||l.productId, (j&&j.snap&&j.snap.dr||{}).customerId||""); if(!it) return 0; const q=+l.qty||0; return r3(l.stk.m==="s"?q:Math.min(q, Math.max(0,+l.stk.q||0))); }
/* ---------- после сохранения: количество стало меньше уже отгруженного — предложить возврат ---------- */
function skAfterEdit(e){ if(!SK_READY || !e || !e.snap) return; const L=skDocLines(e).filter(x=>x.shipped-x.ret>x.req+0.0005);
  if(!L.length) return; const j=e;
  toast("warn","Со склада отгружено больше, чем теперь в документе", L.map(x=>(x.item?x.item.name:"")+": отгружено "+skQf(x.shipped-x.ret,x.unit)+", в документе со склада "+skQf(x.req,x.unit)).join("; ")+". Если товар вернулся — проведите возврат.", {ms:15000, action:{label:"Провести возврат", fn:()=>skShipForm(j,"ret")}}); }

/* ================= ПРИХОД ПО НАКЛАДНОЙ: много позиций за раз =================
   Шапка (поставщик, дата, № документа, сумма по накладной) — один раз, ниже строки товаров. Можно: вписать руками (Enter — следующая строка),
   вставить строки из Excel, прочитать фото/PDF накладной через ИИ. Проводится одной операцией bulk — целиком или никак. Черновик хранится на устройстве. */
let SKMI=null;
const MIKEY = () => "frudom-stockin:"+(curUser()||"-");
const miRow = o => Object.assign({k:uid(), name:"", itemId:"", unit:"кг", qty:"", price:"", sum:"", by:"price", exp:"", pcs:"", pack:"", ppc:"", bx:"", bn:"", ppb:"", open:false, note:"", unsure:false}, o||{});
function miSaveDraft(){ if(!SKMI) return; try{ const R=SKMI.rows.map(r=>{ const x=Object.assign({},r); delete x.file; return x; }); lsSet(MIKEY(), JSON.stringify({sup:SKMI.sup, date:SKMI.date, doc:SKMI.doc, total:SKMI.total, rows:R, at:Date.now()})); }catch(e){} }
const miHas = () => SKMI && SKMI.rows.some(r=>skN(r.name)||String(r.qty).trim());
function skMultiIn(){ let dr=null; try{ dr=JSON.parse(lsGet(MIKEY())||"null"); }catch(e){}
  const fresh={sup:"", date:todayISO(), doc:"", total:"", rows:[miRow(),miRow(),miRow()], ai:null, restored:false};
  SKMI = dr && (dr.rows||[]).some(r=>skN(r.name)) ? Object.assign(fresh, dr, {rows:dr.rows.map(miRow), restored:true}) : fresh;
  skModal(miHtml, true); SKM.d.classList.add("xwide"); if(matchMedia("(pointer:fine)").matches) setTimeout(()=>{ const f=$("#sk-dlg "+(SKMI.restored?".mi-name":".mi-sup")); f&&f.focus(); },120); }   /* на телефоне клавиатура не выскакивает сама */
/* сумма строки и цена: что вписали последним, от того и считаем */
function miCalc(r){ const q=skNum(r.qty), p=skNum(r.price), sm=skNum(r.sum);
  if(r.by==="sum"){ return {q, price:q>0&&sm>=0?sm/q:NaN, sum:sm}; } return {q, price:p, sum:q>0&&p>=0?q*p:NaN}; }
function miItem(r){ const X=skIdx(), k=skK(r.name); if(!k) return null; return X.item[r.itemId] && skK(X.item[r.itemId].name)===k ? X.item[r.itemId] : X.S.items.find(i=>skK(i.name)===k || String(i.alt||"").split(";").some(a=>skK(a)===k)) || null; }
/* вес одной штуки из названия: «Лапша 450г», «Сок 0,2 л», «Мука 2 кг» */
function miWeight(name){ const m=String(name||"").replace(",",".").match(/(\d+(?:\.\d+)?)\s*(кг|гр|г|мл|л)(?=$|[^а-яёa-z]|[хx]\s*\d)/i); if(!m) return null; const v=+m[1], u=m[2].toLowerCase();
  return u==="кг"?{unit:"кг",w:v}:u==="л"?{unit:"л",w:v}:u==="мл"?{unit:"л",w:v/1000}:{unit:"кг",w:v/1000}; }
function miCheck(r, i){ const it=miItem(r), c=miCalc(r), out=[]; if(!skN(r.name) && !String(r.qty).trim()) return {empty:true, it, c, err:[]};
  if(!skN(r.name)) out.push("нет товара"); if(!(c.q>0)) out.push("нет количества"); if(skK(r.unit)==="шт" && c.q>0 && Math.round(c.q)!==c.q) out.push("штуки — целым числом");
  if(r.exp && SKMI.date && r.exp<SKMI.date) out.push("срок раньше даты приёмки");
  if(String(r.pack).trim()!=="" && !(skNum(r.pack)>0)) out.push("вес 1 шт — число больше нуля");
  if(String(r.bx).trim()!=="" && !(skNum(r.bx)>0)) out.push("штук в коробке — число больше нуля");
  return {empty:false, it, c, err:out}; }
function miTagHtml(r){ const it=miItem(r); const X=skIdx(); let h="";
  if(!skN(r.name)) h=""; else if(it){ const U=skUnitsOf(it.id).filter(u=>u.fact>0); h=`<span class="mi-ok">на складе: ${U.length?U.map(u=>skQf(u.fact,u.unit)+((pc=>pc?" · "+pc:"")(skUPcs(it.id,u.unit,"fact")))).join(", "):"нет остатка"}</span>`; }
  else h=`<span class="mi-new">новый товар</span>`;
  const w=miWeight(r.name); if(skK(r.unit)==="шт" && w && skNum(r.qty)>0) h+=` <button type="button" class="mi-conv" data-mi="conv">в ${w.unit}: 1 шт = ${skFmtN(w.w,3)} ${w.unit} ›</button>`;
  if(r.note) h+=` <span class="mi-src" title="Как написано в накладной">${r.unsure?"⚠ ":""}в накладной: «${esc(r.note)}»</span>`; else if(r.unsure) h+=` <span class="mi-src">⚠ ИИ не уверен — сверьте</span>`;
  return h; }
/* сколько штук в строке: в «шт» — количество, иначе штуки из блока (или кол-во ÷ вес 1 шт) */
function miPcN(r){ if(skK(r.unit)==="шт") return skNum(r.qty); const n=skNum(r.pcs); if(n>0) return n; const pk=skNum(r.pack), q=skNum(r.qty); return pk>0&&q>0?q/pk:NaN; }
function miPcsTxt(r){ const pc=miPcN(r), bx=skNum(r.bx), out=[]; if(!(pc>0)) return "";
  if(skK(r.unit)!=="шт" && skNum(r.pack)>0) out.push(skPcN(pc)); if(bx>0) out.push(skBxN(pc/bx)); return out.join(" · "); }
const miHasPk = r => skNum(r.pack)>0 || skNum(r.bx)>0;
function miRowHtml(r, i){ const c=miCalc(r), u=esc(r.unit||"кг"), k=r.k, pcs=miPcsTxt(r);
  const unitSel=`<select class="mi-unit" data-k="${k}">${skIdx().units.concat(skIdx().units.some(x=>skK(x)===skK(r.unit))||!r.unit?[]:[r.unit]).map(x=>`<option${skK(x)===skK(r.unit)?" selected":""}>${esc(x)}</option>`).join("")}</select>`;
  return `<div class="mi-row${r.unsure?" unsure":""}" data-k="${k}" style="--d:${Math.min(i,10)*20}ms">
    <span class="mi-n">${i+1}</span>
    <label class="mi-c mi-cn"><small>Товар</small><input class="mi-name" data-k="${k}" data-keep="1" list="mi-items" autocomplete="off" enterkeyhint="next" value="${esc(r.name)}" placeholder="Название товара"><span class="mi-tag" data-tag="${k}">${miTagHtml(r)}</span></label>
    <label class="mi-c mi-cu"><small>Ед.</small>${unitSel}</label>
    <label class="mi-c mi-cq"><small>Кол-во</small><input class="mi-qty" data-k="${k}" data-keep="1" inputmode="decimal" value="${esc(r.qty)}" placeholder="0"><span class="mi-pcs" data-pcs="${k}">${pcs}</span></label>
    <label class="mi-c mi-cp"><small>Цена за ед., ₽</small><input class="mi-price" data-k="${k}" data-keep="1" inputmode="decimal" value="${esc(r.by==="sum"?(c.price>=0&&isFinite(c.price)?skFmtN(c.price,4):""):r.price)}" placeholder="—"></label>
    <label class="mi-c mi-cs"><small>Сумма, ₽</small><input class="mi-sum" data-k="${k}" data-keep="1" inputmode="decimal" value="${esc(r.by==="sum"?r.sum:(isFinite(c.sum)?skFmtN(c.sum,2):""))}" placeholder="—"></label>
    <label class="mi-c mi-ce"><small>Годен до</small><input type="date" class="mi-exp" data-k="${k}" data-keep="1" value="${esc(r.exp)}"></label>
    <span class="mi-c mi-ca"><button type="button" class="mi-pk${r.open||miHasPk(r)?" on":""}" data-mi="pcs" data-k="${k}" title="Штуки и коробки: сколько штук, вес 1 шт, штук в коробке, сколько коробок"><span class="mi-desk">шт</span><span class="mi-mob">${r.open||miHasPk(r)?"Штуки и коробки ▴":"+ Штуки и коробки"}</span></button><button type="button" class="mi-x" data-mi="del" data-k="${k}" aria-label="Удалить строку">×</button></span>
    ${r.open?miPcsBox(r):""}
  </div>`; }
function miPcsBox(r){ const k=r.k, u=esc(r.unit||"кг"), sht=skK(r.unit)==="шт", f=(cls,lbl,v,ph)=>`<label class="f"><small>${lbl}</small><input class="${cls}" data-k="${k}" data-keep="1" inputmode="decimal" value="${esc(v)}" placeholder="${ph}"></label>`;
  return `<div class="mi-pcsb${sht?" sht":""}">
    ${sht?"":`<div class="mi-pg"><span class="mi-pgh">Штуки</span>${f("mi-pcs-n","Сколько штук",r.pcs,"например 40")}${f("mi-pcs-w","Вес 1 шт, "+u,r.pack,"например 0,45")}${f("mi-pcs-p","Цена за 1 шт, ₽",r.ppc,"как в накладной")}</div>`}
    <div class="mi-pg mi-pgb"><span class="mi-pgh">Коробки</span>${f("mi-box-x","Штук в коробке",r.bx,"например 20")}${f("mi-box-n","Сколько коробок",r.bn,"можно 2,35")}${f("mi-box-p","Цена за коробку, ₽",r.ppb,"если в накладной за коробку")}</div>
    <small class="mi-pgn">${sht?"Количество в штуках = коробки × штук в коробке. Коробок может быть дробное число.":"Впишите что знаете — остальное посчитается: штуки × вес = "+u+", коробки × штук в коробке = штуки."}</small></div>`; }
function miFootHtml(){ const M=SKMI, R=M.rows.map((r,i)=>Object.assign({r},miCheck(r,i))).filter(x=>!x.empty), bad=R.filter(x=>x.err.length), sum=R.reduce((a,x)=>a+(isFinite(x.c.sum)?x.c.sum:0),0), np=R.filter(x=>!isFinite(x.c.sum)).length;
  const tot=skNum(M.total), diff=tot>=0 && R.length ? r2(tot-sum) : null;
  return `<div class="mi-sum1"><span>Позиций: <b>${R.length}</b>${R.filter(x=>!x.it&&skN(x.r.name)).length?` · новых товаров: ${R.filter(x=>!x.it&&skN(x.r.name)).length}`:""}</span><span>Итого по строкам: <b>${fm(r2(sum))} ₽</b>${np?` <small class="miss">(без цены: ${np})</small>`:""}</span>
    ${diff==null?"":Math.abs(diff)<0.005?`<span class="mi-okb">✓ сходится с накладной</span>`:`<span class="mi-bad">не сходится с накладной: ${diff>0?"не хватает":"лишние"} ${fm(Math.abs(diff))} ₽</span>`}</div>
    ${bad.length?`<div class="mi-errs">${bad.slice(0,4).map(x=>`<span>Строка ${M.rows.indexOf(x.r)+1}${skN(x.r.name)?" («"+esc(skN(x.r.name))+"»)":""}: ${x.err.join(", ")}</span>`).join("")}</div>`:""}`; }
function miHtml(){ const M=SKMI, X=skIdx(), sups=[...new Set(X.S.batches.map(b=>b.supplier).filter(Boolean))].slice(-40), n=M.rows.filter(r=>skN(r.name)).length;
  return skHead("Приход на склад","Приход по накладной","Шапку — один раз, ниже все товары. Можно вписать руками, вставить из Excel или прочитать фото накладной.","Приход по накладной")
  + (M.restored?`<div class="mi-rest">Черновик восстановлен — продолжайте, где остановились. <button type="button" class="btn ghost sm" data-mi="clear">Начать заново</button></div>`:"")
  + `<div class="mi-head"><label class="f">Поставщик<input class="mi-sup" data-keep="1" list="mi-sups" autocomplete="off" value="${esc(M.sup)}" placeholder="Кто продал"></label>
      <label class="f">Дата приёмки<input type="date" class="mi-date" data-keep="1" value="${esc(M.date)}"></label>
      <label class="f">№ накладной<input class="mi-doc" data-keep="1" value="${esc(M.doc)}" placeholder="№ и дата"></label>
      <label class="f mi-tot">Итого по накладной, ₽<input class="mi-total" data-keep="1" inputmode="decimal" value="${esc(M.total)}" placeholder="для сверки, необязательно"></label></div>
    <datalist id="mi-sups">${sups.map(s=>`<option value="${esc(s)}">`).join("")}</datalist><datalist id="mi-items">${X.S.items.map(i=>`<option value="${esc(i.name)}">`).join("")}</datalist>
    <div class="mi-tools"><label class="btn sm mi-ai${M.ai&&M.ai.busy?" busy":""}">${M.ai&&M.ai.busy?`<i class="spin"></i>ИИ читает накладную…`:`<span class="mi-ai-i">📷</span><span><b>Фото накладной</b><small>ИИ сам заполнит строки</small></span>`}<input type="file" class="mi-aif" accept="image/*,application/pdf" hidden ${M.ai&&M.ai.busy?"disabled":""}></label>${skHQ("Приход по накладной")}<span class="muted mi-tip mi-desk">или скопируйте строки из Excel и вставьте в поле «Товар»</span></div>
    ${M.ai&&M.ai.err?`<div class="mi-errs"><span>ИИ не прочитал: ${esc(M.ai.err)}</span></div>`:""}${M.ai&&M.ai.done?`<div class="mi-rest ok">${esc(M.ai.done)}</div>`:""}
    <div class="mi-tbl"><div class="mi-hd"><span>#</span><span>Товар</span><span>Ед.</span><span>Кол-во</span><span>Цена за ед., ₽</span><span>Сумма, ₽</span><span>Годен до</span><span></span></div>
      <div class="mi-rows">${M.rows.map(miRowHtml).join("")}</div></div>
    <div class="mi-addr"><button type="button" class="btn sm mi-add" data-mi="add">+ Ещё товар</button><button type="button" class="btn ghost sm mi-desk" data-mi="add5">+ 5 строк</button><span class="muted mi-tip mi-desk">Enter — следующая строка</span><button type="button" class="btn ghost sm mi-one" data-mi="one">Один товар с декларацией ›</button></div>
    <div class="mi-bar"><div class="mi-foot" id="mi-foot">${miFootHtml()}</div>
    <div class="dc-acts"><button class="btn" data-mi="close">Закрыть</button><button class="btn pri" data-mi="save"${n?"":" disabled"}>${n?"Провести · "+n+" "+plural(n,["позиция","позиции","позиций"]):"Провести приход"}</button></div></div>`; }
function miRedraw(focus){ if(!SKM || SKM.render!==miHtml) return; const d=SKM.d, st=d.scrollTop; d.innerHTML=miHtml(); d.scrollTop=st; if(focus){ const el=d.querySelector(focus); if(el){ el.focus(); try{ el.select&&el.select(); }catch(e){} } } }
function miSync(r){ const d=SKM&&SKM.d; if(!d) return; const k=r.k, c=miCalc(r), set=(sel,v)=>{ const el=d.querySelector(sel+`[data-k="${k}"]`); if(el && el!==document.activeElement) el.value=v; };
  if(r.by==="sum") set(".mi-price", c.price>=0&&isFinite(c.price)?skFmtN(c.price,4):""); else set(".mi-sum", isFinite(c.sum)?skFmtN(c.sum,2):"");
  const t=d.querySelector(`[data-tag="${k}"]`); if(t) t.innerHTML=miTagHtml(r); const pc=d.querySelector(`[data-pcs="${k}"]`); if(pc) pc.textContent=miPcsTxt(r);
  const f=$("#mi-foot"); if(f) f.innerHTML=miFootHtml(); const n=SKMI.rows.filter(x=>skN(x.name)).length, b=d.querySelector('[data-mi="save"]'); if(b){ b.disabled=!n; b.textContent=n?"Провести · "+n+" "+plural(n,["позиция","позиции","позиций"]):"Провести приход"; }
  miSaveDraft(); }
/* штуки и коробки в строке: коробки × штук в коробке = штуки; штуки × вес = количество; цена за коробку ÷ штук в коробке = цена за шт; цена за шт ÷ вес = цена за ед.
   Пересчитывается то, что сейчас не вводят. Штук в коробке поменяли — при известных штуках пересчитываются коробки. */
function miSetF(d,r,c,v,f){ r[f]=v; const el=d.querySelector(c+`[data-k="${r.k}"]`); if(el && el!==document.activeElement && el.value!==v){ el.value=v; el.classList.remove("fl"); void el.offsetWidth; el.classList.add("fl"); setTimeout(()=>el.classList.remove("fl"),450); } }
/* «Штук в коробке» пустое (или посчитано сайтом, r.bxA) — считается из штук и коробок: штуки ÷ коробки. Вписали руками — дальше от него считаются коробки */
const miBxAuto = r => !(skNum(r.bx)>0) || !!r.bxA;
function miBxFrom(r){ const pc=miPcN(r), bn=skNum(r.bn); if(!(pc>0 && bn>0)) return false; miSetF(SKM.d,r,".mi-box-x",skFmtN(pc/bn,3),"bx"); r.bxA=1; return true; }
function miPcsLink(r, cls){ const d=SKM.d, sht=skK(r.unit)==="шт", set=(c,v,f)=>miSetF(d,r,c,v,f);
  if(cls==="bx") r.bxA=0;
  let fromPb=false; if(cls==="pb" && miBxAuto(r) && (r.bxA==="p" || !(miPcN(r)>0 && skNum(r.bn)>0))){ const pp=sht?miCalc(r).price:skNum(r.ppc), pb=skNum(r.ppb); if(pp>0 && pb>0){ set(".mi-box-x",skFmtN(pb/pp,3),"bx"); r.bxA="p"; fromPb=true; } }
  const fromBn = cls==="bn" && miBxAuto(r) && miBxFrom(r);
  const bx=skNum(r.bx), bn=skNum(r.bn), ppb=skNum(r.ppb);
  if(!fromBn && bx>0 && (cls==="bn" || (cls==="bx" && !(miPcN(r)>0))) && bn>0){ const pc=bn*bx; if(sht) set(".mi-qty",skFmtN(pc,3),"qty"); else { set(".mi-pcs-n",skFmtN(pc,3),"pcs"); cls="n"; } }
  if(bx>0 && !fromPb && (cls==="pb" || (cls==="bx" && ppb>=0 && !(sht?miCalc(r).price>=0:skNum(r.ppc)>=0)))){ const v=ppb/bx; if(sht){ r.by="price"; set(".mi-price",skFmtN(v,4),"price"); } else { set(".mi-pcs-p",skFmtN(v,2),"ppc"); } }
  if(!sht){ const n=skNum(r.pcs), pk=skNum(r.pack), q=skNum(r.qty);
    if(cls==="n"||cls==="w"){ if(n>0&&pk>0) set(".mi-qty",skFmtN(n*pk,3),"qty"); else if(cls==="n"&&n>0&&q>0&&!(pk>0)) set(".mi-pcs-w",skFmtN(q/n,6),"pack"); }
    const ppc=skNum(r.ppc), pk2=skNum(r.pack); if(ppc>=0 && pk2>0){ r.by="price"; set(".mi-price",skFmtN(ppc/pk2,4),"price"); } }
  miBoxTail(r, cls); }
/* штуки → коробки, цена за шт → цена за коробку (кроме поля, которое сейчас вводят) */
function miBoxTail(r, cls){ const d=SKM.d, set=(c,v,f)=>miSetF(d,r,c,v,f); let auto=false;
  if(cls!=="bx" && cls!=="bn" && cls!=="pb" && miBxAuto(r)) auto=miBxFrom(r);
  const bx=skNum(r.bx); if(!(bx>0)) return;
  const pc=miPcN(r); if(pc>0 && cls!=="bn" && !auto) set(".mi-box-n",skFmtN(pc/bx,3),"bn");
  const pp=skK(r.unit)==="шт" ? miCalc(r).price : skNum(r.ppc); if(pp>=0 && isFinite(pp) && cls!=="pb") set(".mi-box-p",skFmtN(pp*bx,2),"ppb"); }
/* когда строка — новый товар: подставить единицу и вес 1 шт из склада */
function miPickItem(r){ const it=miItem(r); if(!it){ r.itemId=""; return; } if(r.itemId===it.id) return; r.itemId=it.id; r.name=it.name;
  if(!String(r.qty).trim()) r.unit=it.unit||r.unit; if(!skNum(r.pack)){ const lp=skLastPack(it.id, r.unit); if(lp){ r.pack=lp; } } if(!skNum(r.bx)){ const lb=skLastBox(it.id, r.unit); if(lb) r.bx=lb; } }
function miConv(r){ const w=miWeight(r.name); if(!w) return; const n=skNum(r.qty), c=miCalc(r); r.pcs=String(n).replace(".",","); r.pack=skFmtN(w.w,6); if(c.price>=0&&isFinite(c.price)) r.ppc=skFmtN(c.price,2);
  r.unit=w.unit; r.qty=skFmtN(n*w.w,3); if(r.by==="sum"){ /* сумма та же */ } else if(c.price>=0&&isFinite(c.price)) r.price=skFmtN(c.price/w.w,4); r.open=true; }
/* вставка из Excel: товар, кол-во, ед., цена, сумма (что есть) */
function miPaste(txt, at){ const L=String(txt||"").replace(/\r/g,"").split("\n").map(s=>s.trim()).filter(Boolean); if(L.length<2 && !/\t/.test(txt)) return false;
  const X=skIdx(), rows=[];
  L.forEach((line,i)=>{ const a=line.split(/\t|;/).map(x=>x.trim()); if(i===0 && /товар|наимен/i.test(a[0]||"") ) return; const nm=a[0]; if(!nm) return;
    const nums=a.slice(1).map(x=>({x, v:skNum(String(x).replace(/[\s ']/g,""))})), unitCell=a.slice(1).find(x=>/^[а-яёa-z.]{1,6}$/i.test(x));
    const vals=nums.filter(o=>isFinite(o.v)).map(o=>o.v), u0=unitCell?skN(unitCell).replace(/\.$/,""):"", uu=X.units.find(x=>skK(x)===skK(u0))||u0||"кг";
    const r=miRow({name:nm, unit:uu, qty:vals[0]!=null?String(vals[0]).replace(".",","):"", price:vals[1]!=null?String(vals[1]).replace(".",","):""});
    if(vals.length>=3 && vals[1]>0 && Math.abs(vals[0]*vals[1]-vals[2])>0.05 && vals[0]>0){ r.by="sum"; r.sum=String(vals[2]).replace(".",","); }
    miPickItem(r); rows.push(r); });
  if(!rows.length) return false;
  const M=SKMI, before=M.rows.slice(0,at), after=M.rows.slice(at).filter(r=>skN(r.name)||String(r.qty).trim()); M.rows=before.concat(rows, after, [miRow()]);
  toast("ok","Вставлено строк: "+rows.length,"Проверьте единицы и цены."); return true; }
/* ИИ: фото/PDF накладной → шапка и строки */
async function miAi(f){ const M=SKMI; if(!f) return; if(!/^(image\/|application\/pdf)/.test(f.type||"") && !/\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name)){ toast("err","Нужен PDF или фото","");  return; }
  M.ai={busy:1}; miRedraw();
  try{ const d=await aiPrep(f); if(d.data.length>18e6) throw new Error("файл больше 13 МБ");
    let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:150000, body:JSON.stringify({key:pass(), user:curUser(), action:"aiRead", kind:"in", mime:d.mime, data:d.data})}); }
    catch(e){ const m=e.message||""; if(m==="nokey"||m==="badkey") throw new Error(m==="nokey"?"не вставлен ключ Gemini — Даниил вставляет его во вкладке «Данные» → «ИИ»":"ключ Gemini не подходит — Даниил меняет его во вкладке «Данные» → «ИИ»"); if(m==="unknown action") throw new Error("скрипт таблицы старый — нужно обновить Code.gs"); throw e; }
    let x; try{ x=JSON.parse(String(j.text).replace(/^```(json)?|```$/g,"").trim()); }catch(e){ throw new Error("ИИ ответил не по форме — попробуйте ещё раз"); }
    const its=(Array.isArray(x.items)?x.items:[]).filter(it=>it&&it.name); if(!its.length) throw new Error("в файле не нашлось строк с товарами");
    const dt=s=>{ const m=String(s||"").match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/); return m?(m[3].length===2?"20"+m[3]:m[3])+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):""; };
    if(x.supplier && !skN(M.sup)) M.sup=skN(x.supplier); if((x.number||x.request) && !skN(M.doc)) M.doc=skN((x.number||x.request)+(x.date?" от "+x.date:""));
    if(x.total>0 && !String(M.total).trim()) M.total=String(x.total).replace(".",",");
    const X=skIdx(), rows=its.map(it=>{ const u0=skN(it.unit||"").replace(/\.$/,""), uu=X.units.find(v=>skK(v)===skK(u0))||u0||"кг";
      const r=miRow({name:skN(it.name), unit:uu, qty:it.qty!=null?String(it.qty).replace(".",","):"", price:it.price!=null?String(it.price).replace(".",","):"", unsure:!!it.unsure});
      if(it.sum!=null && (it.price==null || (+it.qty>0 && Math.abs(it.qty*it.price-it.sum)>0.05))){ r.by="sum"; r.sum=String(it.sum).replace(".",","); }
      /* название из накладной → складской товар: точное, другое название, похожее */
      let hit=miItem(r); if(!hit && typeof stems==="function"){ const T=stems(r.name); let bs=0; X.S.items.forEach(i=>{ [i.name,...String(i.alt||"").split(";")].forEach(nm=>{ const U=stems(nm); if(!U.length) return; const k=U.filter(w=>T.includes(w)).length/Math.max(U.length,T.length); if(k>bs){ bs=k; hit=i; } }); }); if(bs<0.6) hit=null; }
      if(hit){ if(skK(hit.name)!==skK(r.name)) r.note=r.name; r.name=hit.name; r.itemId=hit.id;
        /* поштучно в накладной, а на складе в кг с известным весом 1 шт — сразу переводим */
        const lp=skNum(skLastPack(hit.id, hit.unit)); if(skK(r.unit)==="шт" && skK(hit.unit)!=="шт" && lp>0){ const n=skNum(r.qty), c=miCalc(r); r.pcs=String(n).replace(".",","); r.pack=skFmtN(lp,6); if(c.price>=0&&isFinite(c.price)) r.ppc=skFmtN(c.price,2); r.unit=hit.unit; r.qty=skFmtN(n*lp,3); if(r.by!=="sum" && c.price>=0) r.price=skFmtN(c.price/lp,4); r.open=true; } }
      return r; });
    const keep=M.rows.filter(r=>skN(r.name)||String(r.qty).trim()); M.rows=keep.concat(rows,[miRow()]);
    M.ai={done:"ИИ заполнил "+rows.length+" "+plural(rows.length,["строку","строки","строк"])+(rows.some(r=>r.unsure)?" — строки с ⚠ сверьте особенно внимательно":"")+". Проверьте товары, количество и цены с бумагой."};
    logEv("Склад","Накладная «"+f.name+"» прочитана ИИ для прихода");
  }catch(e){ M.ai={err:e.message||String(e)}; }
  miRedraw(); miSaveDraft(); }
async function miSave(){ const M=SKMI, d=SKM.d; skInReadHead();
  const R=M.rows.map((r,i)=>Object.assign({r,i},miCheck(r,i))).filter(x=>!x.empty);
  if(!R.length){ toast("err","Добавьте хотя бы один товар",""); return; }
  const bad=R.filter(x=>x.err.length); if(bad.length){ toast("err","Проверьте строки", bad.slice(0,3).map(x=>"строка "+(x.i+1)+": "+x.err.join(", ")).join("; ")); const el=d.querySelector(`.mi-row[data-k="${bad[0].r.k}"]`); el&&el.scrollIntoView({block:"center",behavior:"smooth"}); el&&el.classList.add("bad"); return; }
  if(!M.date){ toast("err","Укажите дату приёмки",""); return; }
  const X=skIdx(), dupDoc=skN(M.doc) && X.S.batches.find(b=>!b.cancel && skK(b.docRef)===skK(M.doc) && skK(b.supplier)===skK(M.sup));
  if(dupDoc && !confirm("Приход по накладной «"+M.doc+"» от «"+(M.sup||"—")+"» уже проводили ("+dupDoc.date.split("-").reverse().join(".")+").\n\nПровести ещё раз?")) return;
  const tot=skNum(M.total), sum=R.reduce((a,x)=>a+(isFinite(x.c.sum)?x.c.sum:0),0);
  if(tot>=0 && Math.abs(tot-sum)>=0.01 && !confirm("Итого по строкам "+fm(r2(sum))+" ₽, а в накладной "+fm(tot)+" ₽.\n\nВсё равно провести?")) return;
  const rows=R.map(x=>{ const r=x.r, it=x.it, pk=skNum(r.pack); const o={itemId:it?it.id:"", newName:it?"":skN(r.name), unit:r.unit, qty:String(x.c.q), price:isFinite(x.c.price)&&x.c.price>=0?String(Math.round(x.c.price*1e4)/1e4):"", date:M.date, supplier:skN(M.sup), docRef:skN(M.doc), exp:r.exp||""};
    if(pk>0 && skK(r.unit)!=="шт") o.pack=String(pk); const bx=skNum(r.bx); if(bx>0) o.box=String(bx); return o; });
  const b=d.querySelector('[data-mi="save"]'); b.disabled=true; b.textContent="Провожу…";
  try{ const j=await skSend("bulk",{kind:"in", rows},"Приход по накладной"+(M.doc?" "+M.doc:"")+": "+rows.length+" "+plural(rows.length,["позиция","позиции","позиций"]));
    const out=(j.out||{}).rows||[]; out.forEach((o,i)=>{ if(o && o.batchId && rows[i].pack) skPackSave(o.batchId, rows[i].pack); if(o && o.batchId && rows[i].box) skBoxSave(o.batchId, rows[i].box); });
    toast("ok","Приход проведён", rows.length+" "+plural(rows.length,["позиция","позиции","позиций"])+(sum>0?" на "+fm(r2(sum))+" ₽":"")+". Декларации можно прикрепить в карточке товара.");
    lsSet(MIKEY(), null); SKMI=null; skClose(true);
  }catch(e){ if(e.queued){ lsSet(MIKEY(), null); SKMI=null; skErr(e,"приход по накладной"); skClose(); return; }
    skErr(e,"приход по накладной"); b.disabled=false; b.textContent="Провести приход"; } }
function skInReadHead(){ const d=SKM&&SKM.d; if(!d||!SKMI) return; const v=c=>{ const el=d.querySelector(c); return el?el.value:null; };
  ["sup","date","doc","total"].forEach(f=>{ const x=v(".mi-"+f); if(x!=null) SKMI[f]=x; }); }
const miFind = k => SKMI && SKMI.rows.find(r=>r.k===k);
document.addEventListener("input", e=>{ const t=e.target; if(!SKMI || !SKM || SKM.render!==miHtml || !t.closest || !t.closest("#sk-dlg")) return;
  if(/mi-(sup|date|doc|total)\b/.test(t.className)){ skInReadHead(); if(/mi-(total|date)/.test(t.className)){ const f=$("#mi-foot"); if(f) f.innerHTML=miFootHtml(); } miSaveDraft(); return; }
  const r=miFind(t.dataset.k); if(!r) return; const cl=t.className;
  if(cl.includes("mi-name")){ r.name=t.value; r.note=""; r.unsure=false; const was=r.itemId; miPickItem(r); if(r.itemId!==was && r.itemId){ const us=SKM.d.querySelector(`.mi-unit[data-k="${r.k}"]`); if(us && !String(r.qty).trim()) us.value=r.unit; } }
  else if(cl.includes("mi-qty")){ r.qty=t.value; if(skNum(r.pcs)>0 && skNum(r.qty)>0) { r.pack=skFmtN(skNum(r.qty)/skNum(r.pcs),6); const w=SKM.d.querySelector(`.mi-pcs-w[data-k="${r.k}"]`); if(w) w.value=r.pack; } miBoxTail(r,"q"); }
  else if(cl.includes("mi-price")){ r.price=t.value; r.by="price"; const pk=skNum(r.pack); if(pk>0 && skNum(r.price)>=0){ r.ppc=skFmtN(skNum(r.price)*pk,2); const w=SKM.d.querySelector(`.mi-pcs-p[data-k="${r.k}"]`); if(w) w.value=r.ppc; } miBoxTail(r,"q"); }
  else if(cl.includes("mi-sum")){ r.sum=t.value; r.by=String(t.value).trim()===""?"price":"sum"; if(r.by==="price") r.price=""; if(skK(r.unit)==="шт") miBoxTail(r,"q"); }
  else if(cl.includes("mi-box-x")){ r.bx=t.value; miPcsLink(r,"bx"); }
  else if(cl.includes("mi-box-n")){ r.bn=t.value; miPcsLink(r,"bn"); }
  else if(cl.includes("mi-box-p")){ r.ppb=t.value; miPcsLink(r,"pb"); }
  else if(cl.includes("mi-exp")){ r.exp=t.value; }
  else if(cl.includes("mi-pcs-n")){ r.pcs=t.value; miPcsLink(r,"n"); }
  else if(cl.includes("mi-pcs-w")){ r.pack=t.value; miPcsLink(r,"w"); }
  else if(cl.includes("mi-pcs-p")){ r.ppc=t.value; miPcsLink(r,"p"); }
  t.closest(".mi-row") && t.closest(".mi-row").classList.remove("bad");
  miSync(r); });
document.addEventListener("change", e=>{ const t=e.target; if(!SKMI || !SKM || SKM.render!==miHtml || !t.closest || !t.closest("#sk-dlg")) return;
  if(t.classList.contains("mi-unit")){ const r=miFind(t.dataset.k); if(!r) return; r.unit=t.value; if(skK(r.unit)!=="шт" && r.itemId && !skNum(r.pack)) r.pack=skLastPack(r.itemId,r.unit); if(r.itemId && !skNum(r.bx)) r.bx=skLastBox(r.itemId,r.unit); miSaveDraft(); miRedraw(`.mi-qty[data-k="${r.k}"]`); return; }
  if(t.classList.contains("mi-aif")){ const f=t.files&&t.files[0]; t.value=""; skInReadHead(); miAi(f); return; }
  if(t.classList.contains("mi-name")){ const r=miFind(t.dataset.k); if(r){ miPickItem(r); miSync(r); } } });
document.addEventListener("paste", e=>{ const t=e.target; if(!SKMI || !t.classList || !t.classList.contains("mi-name")) return; const txt=(e.clipboardData||window.clipboardData).getData("text");
  if(!/\n|\t/.test(String(txt).trim())) return; e.preventDefault(); skInReadHead(); const at=SKMI.rows.findIndex(r=>r.k===t.dataset.k); const cur=SKMI.rows[at]; if(cur && !skN(cur.name) && !String(cur.qty).trim()) SKMI.rows.splice(at,1);
  if(miPaste(txt, Math.max(0,at))){ miSaveDraft(); miRedraw(); } });
document.addEventListener("keydown", e=>{ const t=e.target; if(!SKMI || e.key!=="Enter" || !t.closest || !t.closest("#sk-dlg .mi-row") || e.isComposing) return;
  e.preventDefault(); const k=t.dataset.k, i=SKMI.rows.findIndex(r=>r.k===k); if(i<0) return; const r=SKMI.rows[i];
  if(t.classList.contains("mi-name")) miPickItem(r);
  if(i===SKMI.rows.length-1){ SKMI.rows.push(miRow()); miSaveDraft(); miRedraw(`.mi-name[data-k="${SKMI.rows[i+1].k}"]`); }
  else { const n=SKM.d.querySelector(`.mi-name[data-k="${SKMI.rows[i+1].k}"]`); n&&n.focus(); }
}, true);
document.addEventListener("click", async e=>{ const b=e.target.closest && e.target.closest("[data-mi]"); if(!b || !SKMI || !SKM || SKM.render!==miHtml) return; const a=b.dataset.mi; skInReadHead();
  if(a==="close"){ skClose(); if(miHas()) toast("info","Черновик прихода сохранён","Откройте «+ Приход» — продолжите с того же места."); return; }
  if(a==="save"){ miSave(); return; }
  if(a==="one"){ miSaveDraft(); skInForm("in"); return; }
  if(a==="add"||a==="add5"){ const n=a==="add"?1:5; for(let i=0;i<n;i++) SKMI.rows.push(miRow()); miSaveDraft(); miRedraw(`.mi-name[data-k="${SKMI.rows[SKMI.rows.length-n].k}"]`); return; }
  if(a==="clear"){ if(miHas() && !confirm("Очистить все строки и начать новый приход?")) return; lsSet(MIKEY(), null); SKMI=null; skMultiIn(); SKMI.restored=false; miRedraw(".mi-sup"); return; }
  const r=miFind(b.dataset.k)||miFind((b.closest(".mi-row")||{}).dataset&&b.closest(".mi-row").dataset.k);
  if(a==="del" && r){ const i=SKMI.rows.indexOf(r); SKMI.rows.splice(i,1); if(!SKMI.rows.length) SKMI.rows.push(miRow()); miSaveDraft(); miRedraw();
    if(skN(r.name)) toast("info","Строка удалена", "«"+skN(r.name)+"»", {action:{label:"Вернуть", fn:()=>{ if(!SKMI) return; SKMI.rows.splice(Math.min(i,SKMI.rows.length),0,r); miSaveDraft(); miRedraw(); }}}); return; }
  if(a==="pcs" && r){ r.open=!r.open; if(r.open && r.itemId && !skNum(r.pack) && skK(r.unit)!=="шт") r.pack=skLastPack(r.itemId,r.unit); if(r.open && r.itemId && !skNum(r.bx)){ r.bx=skLastBox(r.itemId,r.unit); } if(r.open && skNum(r.bx)>0) miBoxTail(Object.assign(r),"open");
    miSaveDraft(); miRedraw(r.open?(skK(r.unit)==="шт"?`.mi-box-x[data-k="${r.k}"]`:`.mi-pcs-n[data-k="${r.k}"]`):null); return; }
  if(a==="conv" && r){ miConv(r); miSaveDraft(); miRedraw(`.mi-pcs-p[data-k="${r.k}"]`); toast("ok","Переведено в "+r.unit, r.pcs+" шт × "+r.pack+" "+r.unit+" = "+r.qty+" "+r.unit); return; }
});
/* ---------- «Закупка по накладной» в окне документа: что из накладной уехало со склада (документ уже сохранён) ----------
   DZ.s[ключ строки] = {m:""|"s"|"x", q:"со склада (для «Часть»)", itemId:"товар склада", m0/q0/it0 — как сохранено}.
   Сохранение: связь с товаром склада → источник в накладной (commitDoc, только количество/источник) → резерв → отгрузка. */
let DZ=null;
const dzKey = l => l.lid || ("p:"+l.pid);
const dzOn = () => SK_READY && skSrv!==false && skCan() && !!SK;
function dzInit(j){ const k=calc(j.snap.dr, j.snap); DZ={doc:j.id, s:{}, ship:j.date<=todayISO(), v:null};
  if(!dzOn()) return; const cid=j.snap.dr.customerId||""; k.lines.forEach(l=>{ const it=skItemOf(l.pid, cid), st=l.stk||{}, q=st.m==="x"?String(st.q||"").replace(".",","):"";
    DZ.s[dzKey(l)]={m:st.m||"", q, itemId:it?it.id:"", m0:st.m||"", q0:q, it0:it?it.id:"", pd0:st.pd!=null&&st.pd!==""?String(st.pd):""}; }); }
function dzSt(j, l){ return DZ && DZ.doc===j.id ? DZ.s[dzKey(l)] : null; }
/* сохранённое состояние строки на складе: сколько уже уехало со склада */
function dzDone(j, l){ const si=skLineInfo(j.id, {productId:l.pid, qty:l.qty, lid:l.lid, stk:l.stk}, l.unit, j.snap.dr.customerId||""); return si; }
const dzLocked = (j, l) => { const si=dzDone(j,l); return r3(si.shipped-si.ret)>0 ? si : null; };
/* сколько и почём можно взять со склада под эту строку: партии с самой ранней даты, свой резерв строки считается свободным */
function dzEst(j, l, itemId, q){ const X=skIdx(), own={}; X.S.res.forEach(r=>{ if(r.docId===j.id && r.lineId===l.lid) own[r.batchId]=(own[r.batchId]||0)+(+r.qty||0); });
  let left=r3(q), cost=0, unk=false, got=0, avail=0;
  (X.byItem[itemId]||[]).filter(b=>!b.cancel && skK(b.unit)===skK(l.unit)).forEach(b=>{ const f=r3(Math.max(0, skFree(b.id)+(own[b.id]||0))); avail=r3(avail+f); if(left<=0) return;
    const t=r3(Math.min(left, f)); if(t<=0) return; left=r3(left-t); got=r3(got+t); if(b.price===""||b.price==null) unk=true; else cost+=t*(+b.price); });
  const unitOk=(X.byItem[itemId]||[]).some(b=>!b.cancel && skK(b.unit)===skK(l.unit));
  return {got, short:r3(left), cost:r2(cost), unk, avail, unitOk}; }
/* сколько по строке берётся со склада по выбору в блоке */
function dzQ(l, s){ if(!s||!s.m) return 0; if(s.m==="s") return r3(+l.qty||0); const v=skNum(s.q); return isFinite(v)&&v>0 ? r3(Math.min(+l.qty||0, v)) : 0; }
/* себестоимость строки для живого расчёта: {cost|null, prelim} или null, если склад не участвует */
function dzCost(j, l, priceVal){ const s=dzSt(j,l); if(!s) return null; const lk=dzLocked(j,l);
  if(lk){ const sk=skLineCost(j, l); if(!sk) return null; const dq=sk.directQ; if(dq>0 && priceVal==null) return {cost:null, stock:sk.stockCost};
    return {cost:r2(sk.stockCost+(dq>0?priceVal*dq:0)), stock:sk.stockCost}; }
  if(!s.m) return null; const sq=dzQ(l,s); if(!s.itemId || !(sq>0)) return {cost:null};
  const e=dzEst(j,l,s.itemId,sq), dq=r3((+l.qty||0)-sq); if(e.short>0 || e.unk || (dq>0 && priceVal==null)) return {cost:null, e};
  return {cost:r2(e.cost+(dq>0?priceVal*dq:0)), e}; }
function dzItemOpts(l, cur){ const X=skIdx(), tk=s=>skK(s).replace(/[()«»"',.]/g," ").split(" ").filter(w=>w.length>=4).map(w=>w.slice(0,5)), P=new Set(tk(l.name));
  const sc=i=>tk(i.name+" "+(i.alt||"")).filter(w=>P.has(w)).length, fr=i=>skFreeU(i.id,l.unit);
  const L=X.S.items.filter(i=>i.id===cur || sc(i)>0 || fr(i)>0).sort((a,b)=>sc(b)-sc(a) || (fr(b)>0)-(fr(a)>0) || a.name.localeCompare(b.name,"ru"));
  return `<option value="">— какой товар на складе? —</option>`+L.map(i=>`<option value="${i.id}"${i.id===cur?" selected":""}>${esc(i.name)} · ${fr(i)>0?"свободно "+skQf(fr(i),l.unit):"нет в наличии"}</option>`).join(""); }
/* ---------- выбор товара склада поиском (как поиск товара в документе): вводишь — появляются подсказки ----------
   scope: "dz" (окно накладной) / "bz" (окно комплекта); k — ключ строки; l — {name, unit}; cur — выбранный товар склада */
const SKPQ={};
/* похожесть названий: общие основы слов (первые 5 букв — полное совпадение, первые 4 — половина), «макароны» ~ «Изделия макаронные» */
const skStems = s => skK(s).replace(/ё/g,"е").replace(/[()«»"'.,;:\/\-]/g," ").split(" ").filter(x=>x.length>=4 && !/\d/.test(x));
function skSim(a, b){ const A=skStems(a), B=skStems(b); if(!A.length||!B.length) return 0; let sc=0;
  A.forEach(x=>{ if(B.some(y=>y.slice(0,5)===x.slice(0,5))) sc+=1; else if(B.some(y=>y.slice(0,4)===x.slice(0,4))) sc+=0.5; }); return sc; }
const skItemTxt = i => i.name+" "+(i.alt||"")+" "+(i._links||[]).map(pid=>(prod(pid)||{}).name||"").join(" ");
/* сколько товара: свободно в единице строки; иначе — что есть в других единицах */
function skPickAvail(i, unit){ const fr=skFreeU(i.id,unit); if(fr>0) return {cls:"", t:"свободно "+skQf(fr,unit), ok:2};
  const U=skUnitsOf(i.id).filter(u=>u.free>0); if(U.length) return {cls:"oth", t:"нет в «"+unit+"» · есть "+U.map(u=>skQf(u.free,u.unit)+(skK(u.unit)==="шт"&&skKgTxt(i.id,u.free)?" "+skKgTxt(i.id,u.free):"")).join(", "), ok:1};
  return {cls:"miss", t:"закончился", ok:0}; }
function skPickList(l, q){ const X=skIdx(), w=skK(q).split(" ").filter(Boolean), av=i=>skPickAvail(i,l.unit).ok, nm=(a,b)=>a.name.localeCompare(b.name,"ru");
  if(w.length) return X.S.items.filter(i=>w.every(x=>skK(skItemTxt(i)).includes(x))).sort((a,b)=>av(b)-av(a) || nm(a,b)).slice(0,40);
  const sc=i=>Math.max(skSim(l.name, i.name+" "+(i.alt||"")), skSim(l.name, skItemTxt(i)));
  return X.S.items.map(i=>[i,sc(i)]).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1] || av(b[0])-av(a[0]) || nm(a[0],b[0])).slice(0,6).map(x=>x[0]); }
const SKPA={};   /* «Показать всё на складе» раскрыто у строки */
const skPickRow = (i, sc, k, l, n) => { const a=skPickAvail(i,l.unit); return `<button type="button" class="skpk-i${n===0?" act":""}${a.ok?"":" off"}" data-skpk="${i.id}" data-sc="${sc}" data-k="${esc(k)}"><b>${esc(i.name)}</b><small class="${a.cls}">${esc(a.t)}</small></button>`; };
function skPickSug(sc, k, l, q){ const key=sc+"|"+k, X=skIdx(), qq=(q||"").trim();
  if(qq){ const L=skPickList(l, qq); return L.length ? L.map((i,n)=>skPickRow(i,sc,k,l,n)).join("") : `<small class="muted skpk-h">Не найдено. Попробуйте другое слово${X.S.items.length?" или нажмите «Показать всё на складе»":" или заведите товар приходом на складе"}.</small>${X.S.items.length?`<button type="button" class="skpk-all" data-skpkall="${esc(k)}" data-sc="${sc}">Показать всё на складе (${X.S.items.length}) ›</button>`:""}`; }
  const S=skPickList(l,""), seen=new Set(S.map(i=>i.id)), all=SKPA[key], nm=(a,b)=>a.name.localeCompare(b.name,"ru");
  const has=X.S.items.filter(i=>!seen.has(i.id) && skPickAvail(i,l.unit).ok>0).sort(nm), gone=X.S.items.filter(i=>!seen.has(i.id) && !skPickAvail(i,l.unit).ok).sort(nm);
  let n=0, h=S.length ? `<small class="muted skpk-h">Похоже по названию «${esc(l.name)}»:</small>`+S.map(i=>skPickRow(i,sc,k,l,n++)).join("")
    : `<small class="muted skpk-h">${X.S.items.length?"Похожих по названию нет — посмотрите всё, что есть на складе, или начните вводить название.":"На складе пока нет товаров — сначала оформите приход."}</small>`;
  if(!X.S.items.length || (!has.length && !gone.length)) return h;
  if(!all) return h+`<button type="button" class="skpk-all" data-skpkall="${esc(k)}" data-sc="${sc}">Показать всё на складе (${has.length+gone.length}) ›</button>`;
  return h + (has.length?`<small class="muted skpk-h skpk-g">Всё на складе — есть в наличии (${has.length}):</small>`+has.map(i=>skPickRow(i,sc,k,l,n++)).join(""):"")
    + (gone.length?`<small class="muted skpk-h skpk-g">Закончились (${gone.length}):</small>`+gone.map(i=>skPickRow(i,sc,k,l,n++)).join(""):"")
    + `<button type="button" class="skpk-all" data-skpkall="${esc(k)}" data-sc="${sc}">Свернуть список</button>`; }
document.addEventListener("click", e=>{ const b=e.target.closest&&e.target.closest("[data-skpkall]"); if(!b) return; e.preventDefault(); const sc=b.dataset.sc, k=b.dataset.skpkall, key=sc+"|"+k, C=typeof skPickCtx==="function"?skPickCtx(sc):null; if(!C) return;
  const box=b.closest(".skpk-l"), inp=box&&box.parentElement.querySelector(".skpq"), l=C.line(k); if(!box||!l) return;
  const open=!SKPA[key]; SKPA[key]=open; if(open && inp && inp.value){ inp.value=""; SKPQ[key]=""; }
  box.innerHTML=skPickSug(sc, k, l, inp?inp.value:""); if(open){ box.classList.add("big"); const g=box.querySelector(".skpk-g"); if(g) box.scrollTo({top:Math.max(0,g.offsetTop-6), behavior:"smooth"}); } else box.classList.remove("big");
  if(inp) inp.focus({preventScroll:true}); });
function skPickHtml(sc, k, l, cur, o){ const it=cur?skIdx().item[cur]:null, key=sc+"|"+k, st=o&&o.s, cid=(o&&o.cid)||"";
  if(it){ const was=st&&st.it0===it.id, cus=cid && (was ? skLkScope(it, o.pid, cid)==="cus" : st&&st.sc==="cus");
    const lbl=!skLkSrv()||!cid ? "" : was ? `<small class="skpk-sc">${cus?"связь только для «"+esc(cusNm(cid))+"»":"связь для всех заказчиков"}</small>` : "";
    return `<div class="skpk on"><small>Товар на складе <i>(связь запомнится)</i></small><div class="skpk-sel"><b>${esc(it.name)}</b><span>свободно ${skQf(skFreeU(it.id,l.unit),l.unit)}</span><button type="button" class="btn ghost sm" data-skpkclr="${esc(k)}" data-sc="${sc}">Сменить</button></div>${lbl}${!was&&st?skScopeHtml(cid, st.sc||"all", `data-skpksc="${esc(k)}" data-sc="${sc}" data-v`):""}</div>`; }
  return `<div class="skpk"><small>Товар на складе <i>(связь запомнится)</i></small><input class="skpq" data-sc="${sc}" data-k="${esc(k)}" autocomplete="off" placeholder="Начните вводить: рис, фасоль, Макфа…" value="${esc(SKPQ[key]||"")}" aria-label="Найти товар на складе"><div class="skpk-l${SKPA[key]?" big":""}" data-for="${esc(k)}">${skPickSug(sc, k, l, SKPQ[key]||"")}</div></div>`; }
/* нехватка в кг, а товар лежит в штуках (приход в «шт»): подсказка + «Перевести в кг» одним нажатием (то же, что «Перевзвесить» партии) */
function skRwPack(it){ const ip=skIPack(it.id); if(ip) return ip; const X=skIdx(), B=(X.byItem[it.id]||[]).filter(b=>!b.cancel && skK(b.unit)==="кг" && skPack(b)>0).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  if(B.length) return skPack(B[0]); const w=miWeight(it.name); return w && w.unit==="кг" ? w.w : 0; }
function skRwHint(itemId, unit, short){ if(!(short>0) || skK(unit)!=="кг" || docLimited()) return ""; const X=skIdx(), it=X.item[itemId]; if(!it) return "";
  const B=(X.byItem[itemId]||[]).filter(b=>!b.cancel && b.kind!=="rw" && skK(b.unit)==="шт" && skFree(b.id)>0); if(!B.length) return "";
  const pk=skRwPack(it);
  return B.map(b=>{ const n=skFree(b.id), kg=pk?r3(n*pk):0;
    return `<div class="dzrw"><span>На складе этот товар лежит в штуках: <b>${skQf(n,b.unit)}</b> (партия от ${esc(fd(b.date))})${kg?` ≈ <b>${skQf(kg,"кг")}</b> по ${skQf(pk,"кг")} за 1 шт`:""}.</span>${kg?`<button type="button" class="btn sm" data-skrwq="${esc(b.id)}" data-n="${n}" data-kg="${kg}">Перевести в кг</button>`:`<small class="muted">Вес 1 шт неизвестен — перевзвесьте партию на складе («Склад» → товар → партия → «Перевзвесить»).</small>`}</div>`; }).join(""); }
document.addEventListener("click", async e=>{ const b=e.target.closest&&e.target.closest("[data-skrwq]"); if(!b || b.disabled) return; e.preventDefault();
  const n=+b.dataset.n, kg=+b.dataset.kg;
  if(!b.classList.contains("arm")){ b.classList.add("arm"); b.textContent=`Да, ${skQf(n,"шт")} → ${skQf(kg,"кг")}`; clearTimeout(b._t); b._t=setTimeout(()=>{ if(b.isConnected){ b.classList.remove("arm"); b.textContent="Перевести в кг"; } },5000); return; }
  const j=await skDo("rw",{batchId:b.dataset.skrwq, n:String(n), kg:String(kg)},"Перевзвешивание","Переведено в кг: "+skQf(kg,"кг"),b);
  if(!j) return;
  if(j.out && j.out.batchId && n>0) skPackSave(j.out.batchId, Math.round(kg/n*10000)/10000);
  skRwDone(j, skQf(n,"шт")+" → "+skQf(kg,"кг"));
  if(b.closest("#dc-zki")){ const wrap=$("#dc-zk"), d=wrap&&D.journal.find(x=>x.id===wrap.dataset.doc); if(d) dcZkKeep(d); }
  else if(b.closest("#bz-zki") && typeof bzKeep==="function") bzKeep(); });
/* строка источника под товаром в блоке закупки */
function dzSrcHtml(j, l){ if(!dzOn() || !DZ || DZ.doc!==j.id) return ""; const s=dzSt(j,l); if(!s) return ""; const X=skIdx(); if(!X.S.items.length && !s.m0) return "";
  const k=esc(dzKey(l)), u=esc(l.unit||""), lk=dzLocked(j,l);
  if(lk){ const sk=skLineCost(j,l)||{}, sq=lk.req||0;
    return `<div class="dzsk lock" data-k="${k}">${skIcon}<span>Со склада отгружено <b>${skQf(r3(lk.shipped-lk.ret),l.unit)}</b>${sq>lk.shipped-lk.ret+0.0005?` из ${skQf(sq,l.unit)}`:""}${sk.stockCost!=null?` · себестоимость <b>${fm(sk.stockCost)} ₽</b>`:""}${s.m0==="x"?` · остальное (${skQf(r3((+l.qty||0)-sq),l.unit)}) — по цене справа`:""}<small>Изменить — через «Возврат» в блоке «Склад» выше.</small></span></div>`; }
  const b=(m,t)=>`<button type="button" class="${s.m===m?"on":""}" data-dzm="${m}" data-k="${k}" aria-pressed="${s.m===m}">${t}</button>`;
  let det="";
  if(s.m){ const it=s.itemId?X.item[s.itemId]:null, sq=dzQ(l,s);
    const pick = !s.it0 || skLkSrv() ? skPickHtml("dz", k, l, s.itemId, {s, cid:j.snap.dr.customerId||"", pid:l.pid}) : "";
    const qf = s.m==="x" ? `<label class="dzpq"><small>Со склада, ${u}</small><input class="dzq" data-k="${k}" inputmode="decimal" value="${esc(s.q)}" placeholder="из ${esc(nq3(l.qty))}"></label>` : "";
    let info="";
    if(!it) info=`<span class="miss">Выберите, какой товар взяли со склада.</span>`;
    else { const e=dzEst(j,l,it.id,sq||0);
      if(!e.unitOk) info=`<span class="miss">На складе «${esc(it.name)}» нет в единицах «${u}» — сначала перевзвесьте на складе.</span>`+skRwHint(it.id,l.unit,1);
      else if(s.m==="x" && !(sq>0 && sq<(+l.qty||0))) info=`<span class="muted">Свободно ${skQf(e.avail,l.unit)}. Впишите, сколько взяли со склада (меньше ${esc(nq3(l.qty))}).</span>`;
      else if(e.short>0) info=`<span class="miss">На складе свободно только ${skQf(e.avail,l.unit)} — не хватает ${skQf(e.short,l.unit)}. Проведите приход или выберите «Часть».</span>`+skRwHint(it.id,l.unit,e.short);
      else info=`<span>«${esc(it.name)}»: ${skQf(sq,l.unit)} со склада · себестоимость ${e.unk?`<span class="miss">у партии нет цены</span>`:`<b>${fm(e.cost)} ₽</b> (${fm(r2(e.cost/sq))} ₽/${u})`}${s.m==="x"?` · от Саида ${skQf(r3((+l.qty||0)-sq),l.unit)} — цена справа`:""}</span>`; }
    det=`<div class="dzskd">${pick}${qf}<div class="dzinf">${info}</div></div>`; }
  return `<div class="dzsk" data-k="${k}"><div class="dzseg" role="group" aria-label="Откуда товар">${b("","Закупка")}${b("s","Со склада")}${b("x",`Часть<span class="dzlong"> со склада</span>`)}</div>${det}</div>`; }
/* что поменялось по складу и всё ли можно провести */
function dzChanges(j){ if(!dzOn() || !DZ || DZ.doc!==j.id) return {list:[]}; const k=calc(j.snap.dr, j.snap), list=[], X=skIdx();
  for(const l of k.lines){ const s=dzSt(j,l); if(!s || dzLocked(j,l)) continue; const sq=dzQ(l,s);
    const same = s.m===s.m0 && (s.m!=="x" || r3(skNum(s.q))===r3(skNum(s.q0))) && (!s.m || s.itemId===s.it0);
    if(same) continue;
    if(s.m){ const it=X.item[s.itemId]; if(!it) return {err:"«"+l.name+"»: выберите товар на складе"};
      if(s.m==="x" && !(sq>0 && sq<(+l.qty||0))) return {err:"«"+l.name+"»: впишите, сколько взяли со склада — больше 0 и меньше "+nq3(l.qty)};
      const e=dzEst(j,l,it.id,sq); if(!e.unitOk) return {err:"«"+l.name+"»: на складе нет единицы «"+l.unit+"» — сначала перевзвесьте"};
      if(e.short>0) return {err:"«"+l.name+"»: на складе свободно только "+skQf(e.avail,l.unit)+" — не хватает "+skQf(e.short,l.unit)}; }
    list.push({l, s, sq}); }
  return {list}; }
/* провести: связь → источник в накладной → резерв → отгрузка */
async function dzApply(j, list, ship){
  if(!online()) throw new Error("нет связи с таблицей — склад меняется только онлайн");
  const X=skIdx(), add={};
  const cid=j.snap.dr.customerId||"", ent=[];
  list.forEach(c=>{ if(c.s.m && c.s.itemId!==c.s.it0){ (add[c.s.itemId]=add[c.s.itemId]||[]).push(c.l.pid); } });
  for(const id of Object.keys(add)){ const sc=list.find(c=>c.s.itemId===id && c.s.m)?.s.sc; ent.push(...await skLinkTo(id, add[id], cid, sc)); }
  if(ent.length) skRelinkReserve(ent, j.id);
  const lines=clone(j.snap.dr.lines||[]), used=new Set(), what=[];
  list.forEach(c=>{ let i=lines.findIndex((x,n)=>!used.has(n) && c.l.lid && x.lid===c.l.lid); if(i<0) i=lines.findIndex((x,n)=>!used.has(n) && !x.lid && x.productId===c.l.pid); if(i<0) return; used.add(i);
    const x=lines[i]; if(!x.lid) x.lid=uid()+uid(); c.lid=x.lid;
    if(!c.s.m) delete x.stk; else if(c.s.m==="s") x.stk={m:"s"}; else x.stk={m:"x", q:String(c.sq)};
    x.stkSet=1; delete x.stkA;
    what.push(c.l.name+": "+(!c.s.m?"от Саида (не со склада)":c.s.m==="s"?"со склада "+nq3(c.sq)+" "+c.l.unit:"со склада "+nq3(c.sq)+" из "+nq3(c.l.qty)+" "+c.l.unit)); });
  const meta=clone(j.snap.meta||{}); histPush(meta, what);
  const note=await commitDoc({id:j.id, qtyOnly:true, supplierId:j.supplierId, customerId:j.customerId, number:String(j.number), date:j.date, lines}, {meta:{hist:meta.hist}});
  if(/на этом устройстве/.test(note||"")) throw new Error("накладная не дошла до таблицы — проверьте связь и сохраните ещё раз");
  const lbl="№ "+j.number+" от "+fd(j.date);
  /* сервер уже пересчитал резерв при сохранении накладной — берём свежие остатки; если резерва нет (старый скрипт / сбой) — просим явно */
  const j2=D.journal.find(x=>x.id===j.id)||j, ids=new Set(list.filter(c=>c.s.m).map(c=>c.lid));
  try{ const st=await api({action:"stock", op:"load"}); skApply(st.stock); }catch(e){}
  if(skDocLines(j2).some(x=>ids.has(x.l.lid) && x.short>0) || list.some(c=>!c.s.m)) await skSend("reserve",{docId:j.id},"Резерв "+lbl);
  const L=skDocLines(j2).filter(x=>ids.has(x.l.lid));
  let shipped=[];
  if(ship){ const sl=L.filter(x=>x.res>0).map(x=>({lineId:x.l.lid, qty:String(r3(Math.min(x.res, x.need)))})).filter(x=>+x.qty>0);
    if(sl.length){ await skSend("ship",{docId:j.id, lines:sl},"Отгрузка "+lbl); shipped=sl; } }
  const short=skDocLines(j2).filter(x=>ids.has(x.l.lid) && x.short>0);
  return {n:list.length, shipped:shipped.length, short}; }
/* ---------- строка товара на складе: «История товара» и «Скачать / Загрузить декларацию» ---------- */
const SKI_HI='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>';
const SKI_DL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
const SKI_UP='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7 9l5-5 5 5M5 20h14"/></svg>';
/* декларации товара: привязанные к товару склада или к его позициям документов; сначала действующие, с самым дальним сроком */
function skItemFiles(it){ if(!it) return []; const P=new Set(it._links||[]); const L=skD().files.filter(f=>dItems(f).includes(it.id) || [...dProds(f)].some(p=>P.has(p)));
  const rank=f=>{ const st=dState(f); return st==="bad"?2:0; };
  return L.sort((a,b)=>rank(a)-rank(b) || String(b.validTo||"0").localeCompare(String(a.validTo||"0")) || String(b.at||"").localeCompare(String(a.at||""))); }
let SKID=null;
function skItemDecl(id){ const it=skIdx().item[id], F=skItemFiles(it); if(!it) return;
  const ok=F.filter(f=>dState(f)!=="bad"); if(F.length===1 || ok.length===1){ skFile((ok[0]||F[0]).id, false); return; }
  SKID={id}; SK_RE=()=>skItemDecl(id); skModal(skItemDeclHtml, true); }
function skItemDeclHtml(){ const it=skIdx().item[SKID.id], F=skItemFiles(it); if(!it) return skHead("Декларации","Товар не найден","");
  return skHead("Декларации", esc(it.name), "К товару привязано несколько деклараций — скачайте нужную.", "Декларации")+`<div class="dcl-list">${F.map((f,i)=>dRow(f,i)).join("")}</div><div class="dc-acts"><button class="btn" data-sk="attachItemDecl">Загрузить ещё</button><button class="btn pri" data-sk="close">Готово</button></div>`; }
/* история товара: всё, что с ним было — приходы, куда ушло, списания, правки цены и срока */
let SKH=null;
const SKH_F=[["","Все"],["in","Пришло"],["out","Ушло"],["wo","Списания и правки"],["price","Цена"]];
const skhKind = m => m.kind==="log" ? (/цена/i.test(m.action)?"price":"wo") : (m.type==="in"||m.type==="init"||m.type==="ret"||m.type==="rwin") ? "in" : (m.type==="ship"||m.type==="direct") ? "out" : "wo";
const SKH_SKIP=/^(Приход|Начальный остаток|Отгрузка|Списание|Возврат|Инвентаризация|Перевзвешивание|Исправление прихода|Остаток закрыт|Резерв|Новый товар склада)/;
function skItemHist(id, f){ SKH={id, f:f||"", n:20}; SK_RE=()=>skItemHist(id, SKH.f); skModal(skItemHistHtml, true); }
function skhRows(it){ const X=skIdx(), B=X.byItem[it.id]||[];
  const mv=X.S.moves.filter(m=>m.itemId===it.id).map(m=>Object.assign({kind:"mv"}, m));
  const lg=X.S.log.filter(l=>l.itemId===it.id && !SKH_SKIP.test(l.action||"")).map(l=>Object.assign({kind:"log"}, l));
  return {B, L:mv.concat(lg).sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")))}; }
function skhPrices(B){ return B.filter(b=>!b.cancel && b.kind!=="rw" && b.price!==""&&b.price!=null).map(b=>({d:b.date||String(b.at||"").slice(0,10), p:+b.price, u:b.unit, sup:b.supplier||"", q:+b.qty, id:b.id})).sort((a,b)=>String(a.d).localeCompare(String(b.d))); }
function skhSpark(P){ if(P.length<2) return ""; const W=260, H=54, ps=P.map(x=>x.p), mn=Math.min(...ps), mx=Math.max(...ps), sp=mx-mn||1;
  const pt=P.map((x,i)=>[Math.round(6+i*(W-12)/(P.length-1)), Math.round(H-8-(x.p-mn)/sp*(H-16))]);
  return `<svg class="skh-spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Цена закупки по приходам: от ${fm(mn)} до ${fm(mx)} ₽"><polyline points="${pt.map(p=>p.join(",")).join(" ")}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${pt.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="${i===pt.length-1?3.5:2.5}"><title>${fd(P[i].d)} — ${fm(P[i].p)} ₽</title></circle>`).join("")}</svg>`; }
/* в журнале склада связи записаны ID позиций — показываем названия */
const skhIds = t => String(t||"").split(/,\s*/).map(x=>{ const p=prod(x.trim()); return p&&p.name?p.name:x; }).join(", ");
function skItemHistHtml(){ const X=skIdx(), it=X.item[SKH.id]; if(!it) return skHead("История товара","Товар не найден","Обновите страницу.");
  const {B, L}=skhRows(it), U=skUnitsOf(it.id), P=skhPrices(B);
  const sum=t=>{ const o={}; L.filter(m=>m.kind==="mv" && t(m)).forEach(m=>{ const k=m.unit||""; o[k]=r3((o[k]||0)+Math.abs(+m.qty||0)); }); return Object.keys(o).map(k=>skQf(o[k],k)).join(" · ")||"—"; };
  const inS=sum(m=>m.type==="in"||m.type==="init"), outS=sum(m=>m.type==="ship"), woS=sum(m=>(m.type==="wo"||m.type==="inv"||m.type==="fix") && +m.qty<0);
  const now=U.filter(u=>u.fact).map(u=>skQf(u.fact,u.unit)).join(" · ")||"0";
  const last=P[P.length-1], prev=P[P.length-2], ch=last&&prev&&prev.p? (last.p-prev.p)/prev.p*100 : null;
  const old=(X.S.agg&&X.S.agg.n)||0, keep=X.S.keepDays||180;
  const F=SKH.f, LF=L.filter(m=>!F || skhKind(m)===F), cnt=k=>L.filter(m=>!k||skhKind(m)===k).length;
  const days=[]; LF.slice(0,SKH.n).forEach(m=>{ const d=skDay(m.at)||""; let g=days[days.length-1]; if(!g||g.d!==d){ g={d, L:[]}; days.push(g); } g.L.push(m); });
  const dname=d=>{ if(!d) return "Без даты"; const t=todayISO(), y=new Date(Date.now()-864e5); const yi=y.getFullYear()+"-"+String(y.getMonth()+1).padStart(2,"0")+"-"+String(y.getDate()).padStart(2,"0"); return d===t?"Сегодня":d===yi?"Вчера":fd(d); };
  const row=m=>{ const tm=m.at?new Date(m.at):null, hm=tm&&!isNaN(tm)?tm.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):"";
    if(m.kind==="log") return `<div class="skh-r k-${skhKind(m)}"><span class="skh-t">${hm}</span><span class="skh-i" aria-hidden="true"></span><span class="skh-m"><b>${esc(m.action)}</b><small>${m.before&&m.before!=="—"?esc(skhIds(m.before))+" → ":""}${esc(skhIds(m.after||""))}${m.object&&m.object.includes(" — ")?" · "+esc(m.object.split(" — ").slice(1).join(" — ")):""}</small>${m.reason?`<small class="muted">${esc(m.reason)}</small>`:""}</span><span class="skh-q"></span><span class="skh-w">${esc(m.by||"")}</span></div>`;
    const q=+m.qty, st=!SK_NOSTOCK[m.type], sign=st?(q>0?"+":"−"):"", b=X.batch[m.batchId], party=skIdLike(m.party)?"":m.party||"", doc=m.doc&&!(!m.docId&&skIdLike(m.doc))?m.doc:"";
    const where = m.type==="ship"||m.type==="direct" ? (party?`<b>${esc(party)}</b>`:"<b>Отгрузка</b>") : m.type==="in"||m.type==="init" ? `<b>${esc(SK_T[m.type])}${b&&b.supplier?" от "+esc(b.supplier):""}</b>` : `<b>${esc(SK_T[m.type]||m.typeName||"")}</b>`;
    const det=[m.type==="ship"||m.type==="direct"?esc(SK_T[m.type]):"", doc?(m.docId?`<a href="#" data-skdoc="${m.docId}">${esc(doc)}</a>`:esc(doc)):"", b&&(m.type==="in"||m.type==="init")&&b.docRef&&!doc?"накл. "+esc(b.docRef):"", m.reason?esc(m.reason):""].filter(Boolean).join(" · ");
    return `<div class="skh-r k-${skhKind(m)}"><span class="skh-t">${hm}</span><span class="skh-i" aria-hidden="true"></span><span class="skh-m">${where}${det?`<small>${det}</small>`:""}</span><span class="skh-q"><b class="${st?(q>0?"pos":"neg"):""}">${sign}${skQf(Math.abs(q),m.unit)}</b>${m.cost!==""&&m.cost!=null&&st?`<small>${m.type==="in"||m.type==="init"?"цена":"себест."} ${fm(+m.cost)} ₽</small>`:""}${m.price?`<small>продажа ${fm(+m.price)} ₽</small>`:""}</span><span class="skh-w">${esc(m.by||"")}</span></div>`; };
  return skHead("История товара", esc(it.name), (it.alt?"Другие названия: "+esc(it.alt)+" · ":"")+"всё, что приходило, уходило и менялось", "")
    + `<div class="skh-kpi"><div><small>Сейчас на складе</small><b>${now}</b></div><div><small>Пришло</small><b>${inS}</b></div><div><small>Ушло заказчикам</small><b>${outS}</b></div><div><small>Списано</small><b>${woS}</b></div></div>`
    + (P.length?`<div class="skbox skh-price"><div class="skbh"><b>Цена закупки</b>${last?`<small class="muted">последняя <b>${fm(last.p)} ₽/${esc(last.u)}</b>${ch!=null&&Math.abs(ch)>=0.05?` <span class="${ch>0?"miss":"okc"}">${ch>0?"▲":"▼"} ${String(Math.abs(Math.round(ch*10)/10)).replace(".",",")}%</span>`:""}</small>`:""}</div>
        <div class="skh-pw">${skhSpark(P)}<div class="skh-pl">${P.slice().reverse().slice(0,6).map((x,i,A)=>{ const nx=A[i+1], d=nx&&nx.p?(x.p-nx.p)/nx.p*100:null; return `<button type="button" class="skh-pr" data-skbatch="${x.id}"><span>${fd(x.d)}${x.sup?` · ${esc(x.sup)}`:""}</span><b>${fm(x.p)} ₽</b>${d!=null&&Math.abs(d)>=0.05?`<em class="${d>0?"up":"dn"}">${d>0?"+":"−"}${String(Math.abs(Math.round(d*10)/10)).replace(".",",")}%</em>`:`<em></em>`}</button>`; }).join("")}${P.length>6?`<small class="muted">и ещё ${P.length-6} ${plural(P.length-6,["приход","прихода","приходов"])} раньше</small>`:""}</div></div>
        <p class="muted skh-note">Мин. ${fm(Math.min(...P.map(x=>x.p)))} ₽ · средняя ${fm(r2(P.reduce((a,x)=>a+x.p*x.q,0)/Math.max(1e-9,P.reduce((a,x)=>a+x.q,0))))} ₽ (по весу приходов) · макс. ${fm(Math.max(...P.map(x=>x.p)))} ₽</p></div>`:"")
    + `<div class="pfchips skh-f">${SKH_F.map(([k,t])=>{ const n=k==="price"?cnt("price"):cnt(k); return k&&!n?"":`<button type="button" data-skhff="${k}" class="${F===k?"on":""}">${t} <em>${n}</em></button>`; }).join("")}</div>`
    + (days.length?`<div class="skh-list">${days.map(g=>`<div class="skh-d"><div class="skh-dh">${dname(g.d)}</div>${g.L.map(row).join("")}</div>`).join("")}</div>`:`<div class="skempty"><b>Записей нет</b><span>${F?"Выберите «Все».":"С этим товаром ещё ничего не происходило."}</span></div>`)
    + (LF.length>SKH.n?`<div class="skmv-more"><span class="muted">Показано ${SKH.n} из ${LF.length}</span><button type="button" class="btn ghost sm" data-skhmore="20">Ещё 20</button><button type="button" class="btn ghost sm" data-skhmore="all">Все</button></div>`:"")
    + (old?`<p class="muted skh-note">Движения старше ${keep} дней по складу показаны в остатках итогом, здесь — только за последние ${keep} дней.</p>`:"")
    + `<div class="dc-acts"><button class="btn" data-skitem="${it.id}">Карточка товара</button><button class="btn pri" data-sk="close">Закрыть</button></div>`; }
document.addEventListener("keydown", e=>{ const r=e.target; if(!(r.classList&&r.classList.contains("skrow")) || r.tagName==="BUTTON") return; if(e.key==="Enter"||e.key===" "){ e.preventDefault(); skItemCard(r.dataset.skitem); } });
window.__sk = { send:(op,d,l)=>skSend(op,d,l||op), linkTo:(id,p,c,s)=>skLinkTo(id,p,c,s), item:(p,c)=>skItemOf(p,c), idx:()=>skIdx(), logN:()=>skQ().length+skD().log.length, state:()=>skD(), fact:id=>skFact(id), canCancel:id=>skCanCancel(skIdx().batch[id]), batch:id=>skBatchCard(id), item2:id=>skItemCard(id) };
window.__mi = { open: skMultiIn, st: () => SKMI };
SK_READY=true;

/* ================= «Приходы» — все приходы на склад одним окном (16.11.2026, просьба Даниила) =================
   Приход = одна операция (op): накладная поставщика с несколькими товарами или один товар. Перевзвешивание (rw, parent) — не приход. */
var SKRC={q:"", k:"", per:"all", from:"", to:"", n:30, open:{}, cx:false};
function skRcvAll(){ const X=skIdx(), g={};
  X.S.batches.forEach(b=>{ if(b.parent || b.kind==="rw") return; const kind=b.kind==="init"?"init":"in", k=b.op||b.id;
    const r=g[k]||(g[k]={k, date:String(b.date||b.at||"").slice(0,10), sup:skN(b.supplier), doc:skN(b.docRef), by:b.by||"", at:b.at||"", kind, L:[]}); r.L.push(b); });
  return Object.values(g).map(r=>{ r.sum=r2(r.L.reduce((s,b)=>s+(!b.cancel&&b.price!==""&&b.price!=null?(+b.qty)*(+b.price):0),0)); r.np=r.L.filter(b=>!b.cancel&&(b.price===""||b.price==null)).length;
      r.cancel=r.L.every(b=>b.cancel); r.left=r.L.some(b=>skFact(b.id)>0); return r; })
    .sort((a,b)=>b.date.localeCompare(a.date)||String(b.at).localeCompare(String(a.at))); }
function skRcvSel(){ const q=skK(SKRC.q), R=rpgR("skrc"), all=!R.a||R.a==="all", X=skIdx();
  return skRcvAll().filter(r=>(!SKRC.k||r.kind===SKRC.k) && (SKRC.cx||!r.cancel) && (all||(r.date>=R.a&&r.date<=R.b))
    && (!q || q.split(" ").every(w=>[r.sup, r.doc, r.by, ...r.L.map(b=>(X.item[b.itemId]||{}).name||b.itemName||"")].some(t=>skK(t).includes(w))))); }
function skRcv(q){ SKRC.q=q||""; SKRC.n=30; SKRC.open={}; SK_RE=()=>skRcv(SKRC.q); skModal(skRcvHtml, true); }
if(typeof rpgReg==="function") rpgReg("skrc", { get:()=>SKRC.per==="all"?{a:"all"}:{a:SKRC.from,b:SKRC.to},
  set:(a,b)=>{ if(a==="all"){ SKRC.per="all"; } else { SKRC.per="r"; SKRC.from=a; SKRC.to=b; } SKRC.n=30; skModalRefresh(); },
  dots:()=>new Set(skRcvAll().map(r=>r.date)) });
function skRcvHtml(){ const L=skRcvSel(), X=skIdx(), A=skRcvAll(), sum=r2(L.reduce((s,r)=>s+r.sum,0)), np=L.reduce((s,r)=>s+r.np,0);
  const items=new Set(), sups={}; L.forEach(r=>{ r.L.forEach(b=>items.add(b.itemId)); if(r.sup) sups[r.sup]=(sups[r.sup]||0)+1; });
  const top=Object.entries(sups).sort((a,b)=>b[1]-a[1])[0], nIn=A.filter(r=>r.kind==="in"&&!r.cancel).length, nInit=A.filter(r=>r.kind==="init"&&!r.cancel).length, nCx=A.filter(r=>r.cancel).length;
  const chip=(k,t,n)=>`<button type="button" data-skrck="${k}" class="${SKRC.k===k?"on":""}">${t} <em>${n}</em></button>`;
  let last="", rows="";
  L.slice(0,SKRC.n).forEach((r,i)=>{ if(r.date!==last){ last=r.date; const d=new Date(r.date+"T12:00:00"), t=todayISO(); rows+=`<div class="skrcd"><b>${r.date===t?"Сегодня":fd(r.date)}</b><span>${isNaN(d)?"":d.toLocaleDateString("ru-RU",{weekday:"long"})}</span></div>`; }
    const op=!!SKRC.open[r.k], nm=b=>(X.item[b.itemId]||{}).name||b.itemName||"";
    rows+=`<div class="skrc${op?" open":""}${r.cancel?" cx":""}" style="--d:${Math.min(i,12)*18}ms">
      <button type="button" class="skrch" data-skrco="${esc(r.k)}" aria-expanded="${op}">
        <span class="skrci" aria-hidden="true">${r.kind==="init"?"≡":"↓"}</span>
        <span class="skrcm"><b>${esc(r.sup||(r.kind==="init"?"Начальный остаток":"Поставщик не указан"))}</b><small>${[r.doc?"накл. "+esc(r.doc):"", r.L.length+" "+plural(r.L.length,["товар","товара","товаров"]), r.by?esc(r.by):"", r.cancel?"отменён":""].filter(Boolean).join(" · ")}</small>
          ${op?"":`<small class="skrcn">${esc(r.L.slice(0,3).map(nm).join(", "))}${r.L.length>3?" и ещё "+(r.L.length-3):""}</small>`}</span>
        <span class="skrcs"><b>${r.sum?fm(r.sum)+" ₽":"—"}</b>${r.np?`<small class="miss">без цены: ${r.np}</small>`:r.left?`<small>есть остаток</small>`:`<small>весь израсходован</small>`}</span><i class="skrcv" aria-hidden="true">⌄</i></button>
      <div class="skrcb"><div>${op?r.L.map(b=>{ const f=skFact(b.id), ok=b.price!==""&&b.price!=null; return `<button type="button" class="skrcl${b.cancel?" cx":""}" data-skbatch="${b.id}"><span><b>${esc(nm(b))}</b><small>${skQf(b.qty,b.unit)}${skBPcs(b,+b.qty)?" · "+skBPcs(b,+b.qty):""}${ok?" × "+fm(+b.price)+" ₽":""}${skExp(b)?" · годен до "+fd(skExp(b)):""}</small></span><span class="num"><b>${ok?fm(r2(b.qty*b.price))+" ₽":`<span class="miss">нет цены</span>`}</b><small>${b.cancel?"отменён":f>0?"осталось "+skQf(f,b.unit):"израсходован"}</small></span><i aria-hidden="true">›</i></button>`; }).join(""):""}</div></div></div>`; });
  return skHead("Склад", "Приходы", "Все поступления на склад — по накладным поставщиков и начальные остатки", "")
  + `<div class="skrct">${rpgBar("skrc")}<label class="skrcq"><input type="search" data-keep="1" placeholder="Поставщик, № накладной, товар" value="${esc(SKRC.q)}" aria-label="Поиск по приходам"></label></div>`
  + `<div class="pfchips skrcf">${chip("","Все",nIn+nInit)}${nInit?chip("in","Приходы",nIn)+chip("init","Начальные остатки",nInit):""}${nCx?`<button type="button" data-skrccx class="${SKRC.cx?"on":""}">Отменённые <em>${nCx}</em></button>`:""}</div>`
  + `<div class="skrck"><div><small>Приходов</small><b>${L.length}</b></div><div><small>На сумму</small><b>${fm(sum).replace(/,00$/,"")} ₽</b>${np?`<span class="miss">без цены: ${np}</span>`:""}</div><div><small>Разных товаров</small><b>${items.size}</b></div>${top&&top[1]>1?`<button type="button" data-skrcsup="${esc(top[0])}" title="Показать приходы только от него"><small>Чаще всего от</small><b class="sm">${esc(top[0])}</b><span>${top[1]} ${plural(top[1],["приход","прихода","приходов"])} ›</span></button>`:`<div><small>Поставщиков</small><b>${Object.keys(sups).length}</b></div>`}</div>`
  + (L.length?`<div class="skrcl0">${rows}</div>${L.length>SKRC.n?`<div class="skmv-more"><span class="muted">Показано ${SKRC.n} из ${L.length}</span><button type="button" class="btn ghost sm" data-skrcn="30">Ещё 30</button><button type="button" class="btn ghost sm" data-skrcn="all">Все</button></div>`:""}`
      :`<p class="muted skrc0">${A.length?"По этим условиям приходов нет.":"Приходов пока не было."}${SKRC.q||SKRC.k||SKRC.per!=="all"?` <button type="button" class="dvlnk" data-skrcreset>Сбросить фильтры</button>`:""}</p>`)
  + `<div class="dc-acts"><button class="btn pri" data-sk="in">+ Приход</button><button class="btn" data-sk="close">Закрыть</button></div>`; }
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest || !SKM || !SKM.d.contains(t)) return;
  const o=t.closest("[data-skrco]"); if(o){ const k=o.dataset.skrco, c=o.closest(".skrc"); SKRC.open[k]=!SKRC.open[k];
    if(SKRC.open[k]){ skModalRefresh(); } else { c.classList.remove("open"); setTimeout(()=>{ if(!SKRC.open[k]) skModalRefresh(); },260); } return; }
  const k=t.closest("[data-skrck]"); if(k){ SKRC.k=k.dataset.skrck; SKRC.n=30; skModalRefresh(); return; }
  if(t.closest("[data-skrccx]")){ SKRC.cx=!SKRC.cx; skModalRefresh(); return; }
  const s=t.closest("[data-skrcsup]"); if(s){ SKRC.q=SKRC.q===s.dataset.skrcsup?"":s.dataset.skrcsup; SKRC.n=30; skModalRefresh(); return; }
  const n=t.closest("[data-skrcn]"); if(n){ SKRC.n=n.dataset.skrcn==="all"?1e9:SKRC.n+30; skModalRefresh(); return; }
  if(t.closest("[data-skrcreset]")){ SKRC.q=""; SKRC.k=""; SKRC.per="all"; SKRC.n=30; skModalRefresh(); return; } });
document.addEventListener("input", e=>{ const i=e.target; if(!i.closest || !i.closest(".skrcq")) return; SKRC.q=i.value; SKRC.n=30; clearTimeout(SKRC.t);
  SKRC.t=setTimeout(()=>{ const pos=i.selectionStart; delete i.dataset.keep; skModalRefresh(); const ni=SKM&&SKM.d.querySelector(".skrcq input"); if(ni){ ni.focus(); try{ ni.setSelectionRange(pos,pos); }catch(_){} } },220); });

/* ================= плитки в карточке товара склада ================= */
function skItemTiles(it){ const X=skIdx(), B=(X.byItem[it.id]||[]).filter(b=>!b.cancel), U=skUnitsOf(it.id).sort((a,b)=>b.fact-a.fact);
  if(!B.length) return ""; const u=(U[0]||{}).unit||B[B.length-1].unit, inU=b=>skK(b.unit)===skK(u), today=todayISO(), d30=(()=>{ const d=new Date(today+"T12:00:00"); d.setDate(d.getDate()-30); return d.toISOString().slice(0,10); })();
  const P=B.filter(b=>inU(b)&&!b.parent&&b.kind!=="rw"&&b.price!==""&&b.price!=null), qp=P.reduce((s,b)=>s+(+b.qty),0), avg=qp?P.reduce((s,b)=>s+(+b.qty)*(+b.price),0)/qp:null;
  const lastP=P[P.length-1], prevP=P[P.length-2], ch=lastP&&prevP&&+prevP.price?Math.round((lastP.price-prevP.price)/prevP.price*100):null;
  const roots=B.filter(b=>!b.parent&&b.kind!=="rw"), lastB=roots[roots.length-1], sups=new Set(roots.map(b=>skN(b.supplier)).filter(Boolean));
  const out=X.S.moves.filter(m=>m.itemId===it.id&&m.type==="ship"&&skK(m.unit)===skK(u)&&String(m.at).slice(0,10)>=d30), q30=r3(out.reduce((s,m)=>s-(+m.qty),0)), docs30=new Set(out.map(m=>m.docId||m.id)).size;
  const free=(U.find(x=>skK(x.unit)===skK(u))||{}).free||0, days=q30>0?Math.floor(free/(q30/30)):null;
  let val=0, vu=0; B.forEach(b=>{ const f=skFact(b.id); if(f<=0) return; if(b.price===""||b.price==null) vu++; else val+=f*(+b.price); });
  const ex=B.filter(b=>skFact(b.id)>0&&skExp(b)).sort((a,b)=>skExp(a).localeCompare(skExp(b)))[0];
  const t=(act,lbl,v,sub,cls)=>`<${act?"button type=\"button\" data-skit=\""+act+"\"":"div"} class="skt${cls?" "+cls:""}"><small>${lbl}</small><b>${v}</b>${sub?`<span>${sub}</span>`:""}${act?`<i aria-hidden="true">›</i>`:""}</${act?"button":"div"}>`;
  const ago=d=>{ const n=Math.round((new Date(today+"T12:00:00")-new Date(d+"T12:00:00"))/864e5); return n<=0?"сегодня":n===1?"вчера":n+" "+plural(n,["день","дня","дней"])+" назад"; };
  return `<div class="skts">`
    + (avg!=null?t("price","Средняя закупка", fm(avg)+" ₽", "за 1 "+esc(u)+(lastP?" · последняя "+fm(+lastP.price)+(ch?` <em class="${ch>0?"up":"dn"}">${ch>0?"▲":"▼"} ${Math.abs(ch)}%</em>`:""):"")):t("", "Средняя закупка","—","цены в партиях не указаны"))
    + (lastB?t("last:"+lastB.id,"Последний приход", ago(String(lastB.date||lastB.at).slice(0,10)), esc(skQf(lastB.qty,lastB.unit))+(lastB.supplier?" · от "+esc(lastB.supplier):"")):"")
    + t("out","Ушло за 30 дней", q30>0?skQf(q30,u):"0", q30>0?docs30+" "+plural(docs30,["отгрузка","отгрузки","отгрузок"])+" · ≈ "+skQf(r3(q30/30),u)+" в день":"отгрузок не было")
    + t("", "На сколько хватит", days==null?"—":days>365?"больше года":days+" "+plural(days,["день","дня","дней"]), days==null?"нет отгрузок за 30 дней":"по расходу последних 30 дней", days!=null&&days<7?"warn":"")
    + (val||vu?t("batches","Стоимость остатка", fm(r2(val)).replace(/,00$/,"")+" ₽", vu?"без цены: "+vu+" парт.":"по ценам партий"):"")
    + (ex?t("last:"+ex.id,"Ближайший срок", fd(skExp(ex)), skQf(skFact(ex.id),ex.unit)+" в этой партии", skExpCls(skExp(ex))):"")
    + t("rcv","Приходов", roots.length, sups.size?"от "+sups.size+" "+plural(sups.size,["поставщика","поставщиков","поставщиков"]):"")
    + `</div>`; }
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-skit]"); if(!b || !SKM || !SKM.d.contains(b)) return; const a=b.dataset.skit, id=SKI&&SKI.id, it=skIdx().item[id]; if(!it) return;
  if(a==="price") skItemHist(id,"price"); else if(a==="out") skItemHist(id,"out"); else if(a==="rcv") skRcv(it.name);
  else if(a.startsWith("last:")) skBatchCard(a.slice(5));
  else if(a==="batches"){ const x=SKM.d.querySelector(".skbl"); if(x){ x.scrollIntoView({behavior:"smooth", block:"center"}); x.classList.remove("skflash"); void x.offsetWidth; x.classList.add("skflash"); } } });
