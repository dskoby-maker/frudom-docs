/* ================= СКЛАД (общий для всей команды) =================
   Данные склада — только на сервере (действие stock). Сайт показывает их и отправляет операции с постоянным номером (rid):
   повтор после обрыва связи не проводит операцию второй раз. Без связи операция ждёт в очереди «Ожидает отправки».
   Резерв по накладной сервер пересчитывает сам при каждом её сохранении (любой путь: документ, заявка, комплект, импорт). */
var SK_READY=false;
const SK_UNITS0=["кг","г","шт","л","упак","короб"];
const SK_T={in:"Приход", init:"Начальный остаток", ship:"Отгрузка", ret:"Возврат", wo:"Списание", inv:"Инвентаризация", rwout:"Перевзвешивание", rwin:"Перевзвешивание", fix:"Исправление прихода", close:"Остаток закрыт", direct:"От Саида"};
const SK_NOSTOCK={close:1, direct:1};
const SKKEY = () => "frudom-stock:"+(curUser()||"-"), SKQKEY = () => "frudom-stockq:"+(curUser()||"-");
let SK=null, SKC=null, skSrv=null, skLoading=false, skT=null; const SKQF={};
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
  const X={S, item:{}, batch:{}, link:{}, fact:{}, resB:{}, resL:{}, done:{}, byItem:{}, filesI:{}, units:[]};
  S.items.forEach(i=>{ X.item[i.id]=i; let L=[]; try{ L=JSON.parse(i.links||"[]")||[]; }catch(e){} i._links=L; L.forEach(pid=>X.link[pid]=i.id); X.byItem[i.id]=[]; });
  S.batches.forEach(b=>{ X.batch[b.id]=b; (X.byItem[b.itemId]=X.byItem[b.itemId]||[]).push(b); });
  S.moves.forEach(m=>{ if(!SK_NOSTOCK[m.type]) X.fact[m.batchId]=r3((X.fact[m.batchId]||0)+(+m.qty||0));
    if(m.docId){ const k=m.docId+"|"+m.lineId, o=X.done[k]||(X.done[k]={shipped:0, closed:0, ret:0, direct:0, cost:0, retCost:0});
      if(m.type==="ship"){ o.shipped=r3(o.shipped-(+m.qty||0)); o.cost+=(-(+m.qty||0))*(+m.cost||0); if(m.cost===""||m.cost==null) o.noCost=1; }
      else if(m.type==="close") o.closed=r3(o.closed+(+m.qty||0)); else if(m.type==="ret"){ o.ret=r3(o.ret+(+m.qty||0)); o.retCost+=(+m.qty||0)*(+m.cost||0); } else if(m.type==="direct") o.direct=r3(o.direct+(+m.qty||0)); } });
  S.res.forEach(r=>{ X.resB[r.batchId]=r3((X.resB[r.batchId]||0)+(+r.qty||0)); const k=r.docId+"|"+r.lineId; X.resL[k]=r3((X.resL[k]||0)+(+r.qty||0)); });
  S.files.forEach(f=>{ (X.filesI[f.itemId]=X.filesI[f.itemId]||[]).push(f); });
  Object.values(X.byItem).forEach(L=>L.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.at).localeCompare(String(b.at))||String(a.id).localeCompare(String(b.id))));
  const seen=new Set(); SK_UNITS0.concat(S.units.map(u=>u.name)).forEach(u=>{ const k=skK(u); if(u && !seen.has(k)){ seen.add(k); X.units.push(u); } });
  SKC=X; return X; }
const skFact = id => skIdx().fact[id]||0, skRes = id => skIdx().resB[id]||0, skFree = id => r3(skFact(id)-skRes(id));
const skRoot = b => { const X=skIdx(); let x=b, n=0; while(x && x.parent && X.batch[x.parent] && n++<20) x=X.batch[x.parent]; return x||b; };
const skExp = b => (skRoot(b)||b).exp||"";
const skItemOf = pid => { const X=skIdx(); return X.item[X.link[pid]]||null; };
function skUnitsOf(itemId){ const m={}, X=skIdx(); (X.byItem[itemId]||[]).forEach(b=>{ const k=skK(b.unit), o=m[k]||(m[k]={unit:b.unit, fact:0, res:0}); o.fact=r3(o.fact+skFact(b.id)); o.res=r3(o.res+skRes(b.id)); });
  return Object.values(m).map(o=>Object.assign(o,{free:r3(o.fact-o.res)})); }
const skFreeU = (itemId, unit) => { const u=skUnitsOf(itemId).find(o=>skK(o.unit)===skK(unit)); return u?u.free:0; };
/* строка накладной: сколько нужно со склада, в резерве, отгружено, нехватка (так же считает сервер) */
function skLineInfo(docId, l, unit){
  const src=l.stk||{}, qty=r3(+l.qty||0), req = src.m==="s" ? qty : src.m==="x" ? Math.min(qty, Math.max(0,r3(+src.q||0))) : 0;
  const X=skIdx(), lid=l.lid||"", d=X.done[docId+"|"+lid]||{shipped:0,closed:0,ret:0,direct:0,cost:0,retCost:0}, res=X.resL[docId+"|"+lid]||0;
  const need=r3(Math.max(0, req-d.shipped-d.closed));
  return {req, qty, res, need, short:r3(Math.max(0,need-res)), shipped:d.shipped, closed:d.closed, ret:d.ret, direct:d.direct, cost:d.cost, retCost:d.retCost, noCost:d.noCost, item:skItemOf(l.productId), unit, m:src.m||""}; }
function skDocLines(j){ if(!j||!j.snap||!j.snap.dr) return []; const P=j.snap.prods||{};
  return (j.snap.dr.lines||[]).filter(l=>l.productId && +l.qty>0).map(l=>Object.assign({l}, skLineInfo(j.id, l, (P[l.productId]||prod(l.productId)||{}).unit||""))); }
const skDocHas = j => { const X=skIdx(); return skDocLines(j).some(x=>x.req>0 || x.shipped>0 || x.res>0) || X.S.res.some(r=>r.docId===j.id); };
/* ---------- загрузка и отправка ---------- */
function skApply(S){ if(!S) return; SK=S; SKC=null; skSrv=true; try{ lsSet(SKKEY(), JSON.stringify(S)); }catch(e){}
  if(curTab==="stock") renderStock(); if(curTab==="doc") skDocHints(); skModalRefresh(); }
async function skLoad(quiet){
  if(!skCan() || skLoading) return; skLoading=true; skSyncLine();
  try{ const j=await api({action:"stock", op:"load"}); skApply(j.stock); skReport(); await skFlushQ(); }
  catch(e){ if(/unknown action/.test(e.message)){ skSrv=false; if(curTab==="stock") renderStock(); } else if(!quiet) toast("err","Склад не загрузился", e.message); }
  finally{ skLoading=false; skSyncLine(); } }
function skSoon(){ clearTimeout(skT); skT=setTimeout(()=>skLoad(true), 1800); }
const skQ = () => { try{ return JSON.parse(lsGet(SKQKEY())||"[]")||[]; }catch(e){ return []; } };
const skQSet = L => { try{ lsSet(SKQKEY(), L.length?JSON.stringify(L):null); }catch(e){} skSyncLine(); if(curTab==="stock") skDrawPending(); };
async function skRun(q){
  const d = q.op==="file" ? Object.assign({}, q.d, {data:SKQF[q.rid]}) : q.d;
  if(q.op==="file" && !SKQF[q.rid]){ skQSet(skQ().filter(x=>x.rid!==q.rid)); throw new Error("файл не сохранился на устройстве после перезагрузки — прикрепите его ещё раз"); }
  try{ const j=await api({action:"stock", op:q.op, rid:q.rid, d}); skQSet(skQ().filter(x=>x.rid!==q.rid)); delete SKQF[q.rid]; skApply(j.stock); return j; }
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
let SKM=null;
function skModal(render, wide){
  skClose(true); const d=document.createElement("dialog"); d.id="sk-dlg"; d.className="dcard sk"+(wide?" wide":"");
  document.getElementById("fd-app").appendChild(d); SKM={d, render}; skModalRefresh();
  d.addEventListener("cancel",e=>{ e.preventDefault(); skClose(); });
  d.addEventListener("click",e=>{ if(e.target===d){ const r=d.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) skClose(); } });
  d.showModal(); requestAnimationFrame(()=>d.classList.add("in")); return d; }
function skModalRefresh(){ if(!SKM) return; const d=SKM.d, st=d.scrollTop, act=document.activeElement, keep=act&&d.contains(act)&&act.dataset&&act.dataset.keep;
  if(keep) return;   /* пользователь печатает в поле — не перерисовываем под рукой */
  d.innerHTML=SKM.render(); d.scrollTop=st; }
function skClose(now){ if(!SKM) return; const d=SKM.d; SKM=null; if(now){ try{ d.close(); }catch(x){} d.remove(); return; } d.classList.add("out"); setTimeout(()=>{ try{ d.close(); }catch(x){} d.remove(); },180); }
const skHead = (kick, title, sub) => `<div class="dc-head"><div><div class="dc-kicker">${kick}</div><h3>${title}</h3>${sub?`<p class="muted sk-sub">${sub}</p>`:""}</div><button class="dc-x" data-sk="close" aria-label="Закрыть">×</button></div>`;
const skIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-5 9 5v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M7 20v-7h10v7M7 16h10"/></svg>`;

/* ================= вкладка «Склад» ================= */
let SKV={tab:"items", q:"", det:"", hf:"", shown:60};
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
  $("#sk-kpi").innerHTML = t("pos","Товарных позиций",pos.length,"с остатком на складе")+t("res","Документов с резервом",Object.keys(rd).length,"")+t("short","Документов с нехваткой",sd.length, sd.length?"нужно докупить или пересчитать":"")+t("val","Стоимость запаса",fm(val.v).replace(/,00$/,"")+" ₽", val.unk?"без цены: "+val.unk+" парт.":"по закупочным ценам партий");
  const box=$("#sk-det"); let h="";
  if(SKV.det==="pos") h=pos.length?`<div class="skdl">${pos.map(i=>`<button type="button" class="skdr" data-skitem="${i.id}"><b>${esc(i.name)}</b><span>${skUnitsOf(i.id).filter(u=>u.fact>0).map(u=>skQf(u.fact,u.unit)).join(" · ")}</span></button>`).join("")}</div>`:`<p class="muted">На складе пусто.</p>`;
  if(SKV.det==="res"){ const X=skIdx(); h=Object.keys(rd).length?`<div class="skdl">${Object.keys(rd).map(id=>{ const j=D.journal.find(x=>x.id===id), L=rd[id], by={}; L.forEach(r=>{ const k=r.itemId+"|"+r.unit; by[k]=by[k]||{n:(X.item[r.itemId]||{}).name||r.itemName, u:r.unit, q:0}; by[k].q=r3(by[k].q+(+r.qty)); });
      return `<button type="button" class="skdr" data-skdoc="${id}"><b>${j?"№ "+esc(j.number)+" от "+fd(j.date)+" — "+esc(jWho(j).main):esc(L[0].doc||id)}</b><span>${Object.values(by).map(o=>esc(o.n)+" "+skQf(o.q,o.u)).join(" · ")}</span></button>`; }).join("")}</div>`:`<p class="muted">Резервов нет.</p>`; }
  if(SKV.det==="short") h=sd.length?`<div class="skdl">${sd.map(o=>`<button type="button" class="skdr bad" data-skdoc="${o.j.id}"><b>№ ${esc(o.j.number)} от ${fd(o.j.date)} — ${esc(jWho(o.j).main)}</b><span>${o.L.map(x=>"не хватает: "+esc(x.item.name)+" "+skQf(x.short,x.unit)).join(" · ")}</span></button>`).join("")}</div><p class="muted sk-hint">Проведите приход и откройте накладную → «Обновить резерв». Или поменяйте источник строки на «Часть со склада».</p>`:`<p class="muted">Нехватки нет.</p>`;
  if(SKV.det==="val"){ const X=skIdx(), rows=X.S.batches.filter(b=>skFact(b.id)>0); h=rows.length?`<div class="tbl"><table class="sk-vt"><thead><tr><th>Товар · партия</th><th class="num">Остаток</th><th class="num">Цена</th><th class="num">Сумма, ₽</th></tr></thead><tbody>${rows.map(b=>{ const f=skFact(b.id), ok=b.price!==""&&b.price!=null; return `<tr data-skbatch="${b.id}"><td><b>${esc((X.item[b.itemId]||{}).name||"")}</b><small>${esc(b.name)}</small></td><td class="num">${skQf(f,b.unit)}</td><td class="num">${ok?fm(+b.price):`<span class="miss">нет</span>`}</td><td class="num">${ok?fm(r2(f*b.price)):"—"}</td></tr>`; }).join("")}</tbody><tfoot><tr><td colspan="3">Итого${val.unk?` <small class="miss">(без ${val.unk} парт. без цены)</small>`:""}</td><td class="num">${fm(val.v)}</td></tr></tfoot></table></div>`:`<p class="muted">На складе пусто.</p>`; }
  box.innerHTML = h ? `<div class="skdetin">${h}</div>` : ""; box.classList.toggle("open", !!h);
}
function skDrawPending(){ const L=skQ(), el=$("#sk-pend"); if(!el) return;
  el.innerHTML = L.length ? `<div class="skpend"><b>Ожидает отправки (${L.length})</b>${L.map(q=>`<div><span>${esc(q.label)}</span><small>${skWhen(q.at)}${q.err?" · "+esc(q.err):""}</small></div>`).join("")}<button type="button" class="btn sm" data-sk="flush">Отправить сейчас</button></div>` : ""; }
function skDrawList(){
  const X=skIdx(), q=skK(SKV.q), box=$("#sk-list"); let h="";
  const hitI = i => !q || [i.name, i.alt||"", ...(i._links||[]).map(pid=>(prod(pid)||{}).name||"")].some(t=>skK(t).includes(q));
  if(SKV.tab==="items"){ const L=X.S.items.filter(hitI).sort((a,b)=>{ const fa=skUnitsOf(a.id).some(u=>u.fact>0), fb=skUnitsOf(b.id).some(u=>u.fact>0); return (fb-fa)||a.name.localeCompare(b.name,"ru"); });
    h = L.length ? L.map((i,k)=>{ const U=skUnitsOf(i.id), bs=(X.byItem[i.id]||[]).filter(b=>skFact(b.id)>0), ex=bs.map(skExp).filter(Boolean).sort()[0], files=(X.filesI[i.id]||[]).length;
      return `<button type="button" class="skrow" data-skitem="${i.id}" style="--d:${Math.min(k,12)*25}ms"><span class="skn"><b>${esc(i.name)}</b><small>${i.alt?esc(i.alt)+" · ":""}${(i._links||[]).length?"в документах: "+esc(i._links.map(pid=>(prod(pid)||{}).name||"?").join(", ")):`<span class="miss">не связан с позициями документов</span>`}</small></span>
        <span class="sku">${U.filter(u=>u.fact||u.res).map(u=>`<span class="skuq"><b>${skQf(u.fact,u.unit)}</b>${u.res?`<em>резерв ${skQf(u.res)} · свободно ${skQf(u.free)}</em>`:""}</span>`).join("")||`<span class="muted">нет в наличии</span>`}</span>
        <span class="skm">${ex?`<span class="skexp ${skExpCls(ex)}">до ${fd(ex)}</span>`:""}${files?`<span class="skf">📄 ${files}</span>`:""}${i.note?`<span class="skf" title="${esc(i.note)}">💬</span>`:""}</span></button>`; }).join("") : `<div class="skempty"><b>${q?"Ничего не найдено":"Склад пока пуст"}</b><span>${q?"Попробуйте другое название.":"Нажмите «+ Приход» или «Начальный остаток», чтобы завести товар."}</span></div>`; }
  if(SKV.tab==="exp"){ const L=X.S.batches.filter(b=>skFact(b.id)>0 && (!q||skK((X.item[b.itemId]||{}).name).includes(q))).sort((a,b)=>(skExp(a)||"9999").localeCompare(skExp(b)||"9999"));
    h = L.length ? L.map(b=>{ const e=skExp(b); return `<button type="button" class="skrow sm" data-skbatch="${b.id}"><span class="skn"><b>${esc((X.item[b.itemId]||{}).name||"")}</b><small>${esc(b.name)} · ${skQf(skFact(b.id),b.unit)}</small></span><span class="skm">${e?`<span class="skexp ${skExpCls(e)}">годен до ${fd(e)}</span>`:`<span class="muted">Срок годности не указан</span>`}</span></button>`; }).join("") : `<div class="skempty"><b>Нет партий с остатком</b></div>`; }
  if(SKV.tab==="files"){ const L=X.S.files.filter(f=>!q||skK(f.itemName+" "+f.name).includes(q)).sort((a,b)=>String(b.at).localeCompare(String(a.at)));
    h = `<div class="row"><button type="button" class="btn pri sm" data-sk="attach">+ Прикрепить декларацию</button></div>` + (L.length ? L.map(f=>skFileRow(f, true)).join("") : `<div class="skempty"><b>Деклараций пока нет</b><span>Прикрепите файл при приходе или из карточки товара.</span></div>`); }
  if(SKV.tab==="log"){ const pend=skQ().map(x=>({at:x.at, by:x.by, action:"Ожидает отправки", object:x.label, pend:1}));
    const L=pend.concat(X.S.log.slice().reverse()).filter(l=>(!q||skK([l.action,l.object,l.before,l.after,l.reason,l.by].join(" ")).includes(q)) && (!SKV.hf||l.action===SKV.hf||(SKV.hf==="Резерв"&&/^Резерв/.test(l.action))));
    const acts=[...new Set(X.S.log.map(l=>/^Резерв/.test(l.action)?"Резерв":l.action))].sort();
    h = `<div class="pfchips">${["",...acts].map(a=>`<button type="button" data-skhf="${esc(a)}" class="${SKV.hf===a?"on":""}">${a?esc(a):"Все"}</button>`).join("")}</div>`
      + (L.length ? `<div class="sklog">${L.slice(0,SKV.shown).map(skLogRow).join("")}</div>${L.length>SKV.shown?`<div class="row"><button type="button" class="btn ghost sm" data-sk="more">Показать ещё (${L.length-SKV.shown})</button></div>`:""}` : `<div class="skempty"><b>Записей нет</b></div>`); }
  box.innerHTML=h;
}
const skExpCls = e => { const d=Math.round((new Date(e+"T12:00:00")-new Date(todayISO()+"T12:00:00"))/864e5); return d<0?"bad":d<=7?"warn":""; };
const skLogRow = l => `<div class="sklr${l.pend?" pend":""}"><span class="skla">${esc(l.action)}</span><span class="sklo"><b>${esc(l.object||"")}</b>${l.before||l.after?`<small>${l.before&&l.before!=="—"?esc(l.before)+" → ":""}${esc(l.after||"")}</small>`:""}${l.reason?`<small class="muted">${esc(l.reason)}</small>`:""}</span><span class="sklw">${esc(l.by||"")}<small>${skWhen(l.at)}</small></span></div>`;
function skFileRow(f, showItem){ const im=/^image\//.test(f.mime), pdf=f.mime==="application/pdf";
  return `<div class="skfile"><span class="skfi">${pdf?"PDF":im?"Фото":"Файл"}</span><span class="skfn"><b>${esc(f.name)}</b><small>${showItem?esc(f.itemName)+" · ":""}${f.batchId?esc(f.batchName):"весь товар"} · ${esc(f.by)} · ${skWhen(f.at)}</small></span>
    <span class="skfa">${im||pdf?`<button type="button" class="btn ghost sm" data-skfview="${f.id}">Открыть</button>`:""}<button type="button" class="btn ghost sm" data-skfget="${f.id}">Скачать</button><button type="button" class="btn ghost sm danger" data-skfdel="${f.id}" aria-label="Удалить">×</button></span></div>`; }

/* ---------- карточка товара ---------- */
let SKI={id:"", f:"", edit:false, linkQ:""};
function skItemCard(id){ SKI={id, f:"", edit:false, linkQ:""}; skModal(skItemHtml, true); }
function skItemHtml(){ const X=skIdx(), it=X.item[SKI.id]; if(!it) return skHead("Склад","Товар не найден","Обновите страницу.");
  const U=skUnitsOf(it.id), B=X.byItem[it.id]||[], ML=X.S.moves.filter(m=>m.itemId===it.id).slice().reverse(), types=[...new Set(ML.map(m=>m.type))];
  const RL=X.S.res.filter(r=>r.itemId===it.id), files=X.filesI[it.id]||[];
  return skHead("Товар склада", esc(it.name), it.alt?"Другие названия: "+esc(it.alt):"")
  + `<div class="skuv">${U.length?U.map(u=>`<div><small>${esc(u.unit)}</small><b>${skQf(u.fact)}</b><span>на складе</span><button type="button" class="skres" data-skresl="${esc(u.unit)}" ${u.res?"":"disabled"}><b>${skQf(u.res)}</b><span>в резерве ›</span></button><span class="skfree"><b>${skQf(u.free)}</b> свободно</span></div>`).join(""):`<p class="muted">Ещё не было приходов.</p>`}</div>`
  + (SKI.resU!=null?`<div class="skbox"><div class="skbh"><b>Резерв — ${esc(SKI.resU)}</b><button type="button" class="btn ghost sm" data-sk="resclose">Скрыть</button></div>${RL.filter(r=>skK(r.unit)===skK(SKI.resU)).reduce((a,r)=>{ const o=a.find(x=>x.docId===r.docId); if(o) o.q=r3(o.q+(+r.qty)); else a.push({docId:r.docId, q:+r.qty, doc:r.doc}); return a; },[]).map(o=>{ const j=D.journal.find(x=>x.id===o.docId); return `<button type="button" class="skdr" data-skdoc="${o.docId}"><b>${j?esc(jWho(j).main):"накладная"}</b><span>${j?"№ "+esc(j.number)+" от "+fd(j.date):esc(o.doc)} · ${skQf(o.q,SKI.resU)} — открыть накладную ›</span></button>`; }).join("")}</div>`:"")
  + `<div class="skbox"><div class="skbh"><b>Комментарий к товару</b><small class="muted">виден только здесь, в документы не попадает</small></div><textarea class="skcomment" rows="2" data-keep="1" placeholder="Например: «Этот кофейный напиток заказывает только ревматология»">${esc(it.note||"")}</textarea><div class="row"><button type="button" class="btn sm" data-sk="note">Сохранить комментарий</button>${it.note?`<button type="button" class="btn ghost sm" data-sk="noteclr">Очистить</button>`:""}</div></div>`
  + `<div class="skbox"><div class="skbh"><b>Партии</b><button type="button" class="btn sm" data-sk="inItem">+ Приход</button></div>${B.length?`<div class="skbl">${B.slice().reverse().map(b=>{ const f=skFact(b.id), r=skRes(b.id), e=skExp(b); return `<button type="button" class="skbr${f>0?"":" empty"}" data-skbatch="${b.id}"><span><b>${esc(b.name)}</b><small>${esc(b.supplier||"—")}${b.docRef?" · "+esc(b.docRef):""}${b.kind==="init"?" · начальный остаток":""}</small></span><span class="num"><b>${skQf(f,b.unit)}</b><small>из ${skQf(b.qty,b.unit)}${r?" · резерв "+skQf(r):""}</small></span><span class="num">${b.price!==""&&b.price!=null?fm(+b.price)+" ₽":`<span class="miss">цена?</span>`}</span><span>${e?`<span class="skexp ${skExpCls(e)}">до ${fd(e)}</span>`:`<small class="muted">Срок годности не указан</small>`}</span></button>`; }).join("")}</div>`:`<p class="muted">Партий нет.</p>`}</div>`
  + `<div class="skbox"><div class="skbh"><b>Позиции в документах</b><small class="muted">резерв и списание — только по этим связям</small></div>${(it._links||[]).map(pid=>`<span class="sklink">${esc((prod(pid)||{}).name||pid)}<button type="button" data-skunlink="${pid}" aria-label="Убрать связь">×</button></span>`).join("")||`<p class="muted">Не связан — со склада его в документ не взять.</p>`}
      <div class="sklinkadd"><input class="sklq" data-keep="1" placeholder="Найти позицию документов, например «ягоды сушёные (шиповник)»" value="${esc(SKI.linkQ)}"><div class="sklsug">${skLinkSug(it)}</div></div></div>`
  + `<div class="skbox"><div class="skbh"><b>Декларации</b><button type="button" class="btn sm" data-sk="attachItem">Прикрепить декларацию</button></div>${files.length?files.map(f=>skFileRow(f,false)).join(""):`<p class="muted">Файлов нет.</p>`}</div>`
  + `<div class="skbox"><div class="skbh"><b>История движений</b></div><div class="pfchips">${["",...types].map(t=>`<button type="button" data-skmf="${t}" class="${SKI.f===t?"on":""}">${t?SK_T[t]:"Все"}</button>`).join("")}</div>${skMoves(ML.filter(m=>!SKI.f||m.type===SKI.f))}</div>`
  + (SKI.edit ? `<div class="skbox"><div class="skbh"><b>Название и единица</b></div><div class="skgrid"><label class="f">Название<input class="skin" data-keep="1" value="${esc(it.name)}"></label><label class="f">Другие названия (через ;)<input class="skalt" data-keep="1" value="${esc(it.alt||"")}"></label><label class="f">Основная единица${skUnitSel(it.unit,"skiu")}</label></div><div class="row"><button type="button" class="btn pri sm" data-sk="itemSave">Сохранить</button><button type="button" class="btn ghost sm" data-sk="itemEditOff">Отмена</button></div></div>` : "")
  + `<div class="dc-acts">${SKI.edit?"":`<button class="btn" data-sk="itemEdit">Изменить название</button>`}<button class="btn" data-sk="close">Закрыть</button></div>`; }
function skMoves(L){ if(!L.length) return `<p class="muted">Движений нет.</p>`;
  return `<div class="skmv">${L.slice(0,80).map(m=>{ const q=+m.qty, sign=SK_NOSTOCK[m.type]?"":q>0?"+":"−";
    return `<div class="skmr t-${m.type}"><span class="skmt">${SK_T[m.type]||m.typeName}</span><span><b>${sign}${skQf(Math.abs(q),m.unit)}</b>${m.cost!==""&&m.cost!=null?`<small>себест. ${fm(+m.cost)} ₽</small>`:""}${m.price?`<small>продажа ${fm(+m.price)} ₽</small>`:""}</span><span>${m.party?esc(m.party):""}${m.doc?`<small>${m.docId?`<a href="#" data-skdoc="${m.docId}">${esc(m.doc)}</a>`:esc(m.doc)}</small>`:""}${m.reason?`<small class="muted">${esc(m.reason)}</small>`:""}</span><span class="sklw">${esc(m.by)}<small>${skWhen(m.at)}</small></span></div>`; }).join("")}</div>`; }
function skLinkSug(it){ const q=skK(SKI.linkQ); const words=q.split(" ").filter(Boolean);
  const L=(words.length?D.products.filter(p=>!(it._links||[]).includes(p.id) && words.every(w=>skK(p.name).includes(w))):skCandidates(it)).slice(0,6);
  if(!L.length) return words.length?`<small class="muted">Ничего не найдено</small>`:"";
  return (words.length?"":`<small class="muted">Похоже по названию (связь появится только после нажатия):</small>`)+L.map(p=>{ const o=skItemOf(p.id); return `<button type="button" class="sklsb" data-sklink="${p.id}"><span>${esc(p.name)}</span><small>${o&&o.id!==it.id?"сейчас связан с «"+esc(o.name)+"» — перенести":"связать"}</small></button>`; }).join(""); }
/* кандидаты по похожему названию — только подсказка, связь создаёт человек */
function skCandidates(it){ const tk=s=>skK(s).replace(/[()«»"',.]/g," ").split(" ").filter(w=>w.length>=4).map(w=>w.slice(0,5)), A=new Set([it.name,...String(it.alt||"").split(";")].flatMap(tk));
  return D.products.filter(p=>!(it._links||[]).includes(p.id) && tk(p.name).some(w=>A.has(w))).slice(0,6); }
function skUnitSel(u, cls){ const X=skIdx(), L=X.units.slice(); if(u && !L.some(x=>skK(x)===skK(u))) L.push(u);
  return `<select class="${cls}">${L.map(x=>`<option${skK(x)===skK(u)?" selected":""}>${esc(x)}</option>`).join("")}<option value="__new">+ своя единица…</option></select>`; }

/* ---------- карточка партии ---------- */
let SKB={id:"", mode:""};
function skBatchCard(id){ SKB={id, mode:""}; skModal(skBatchHtml, true); }
function skBatchHtml(){ const X=skIdx(), b=X.batch[SKB.id]; if(!b) return skHead("Склад","Партия не найдена","");
  const it=X.item[b.itemId]||{}, f=skFact(b.id), r=skRes(b.id), root=skRoot(b), e=root.exp||"", ML=X.S.moves.filter(m=>m.batchId===b.id).slice().reverse(), files=(X.filesI[b.itemId]||[]).filter(x=>x.batchId===b.id||x.batchId===root.id);
  const lim=docLimited(), info=[["Дата приёмки",fd(b.date)],["Поставщик",b.supplier||"—"],["Входящий документ",b.docRef||"—"],["Пришло",skQf(b.qty,b.unit)],["Закупочная цена",b.price!==""&&b.price!=null?fm(+b.price)+" ₽ за "+b.unit:"не указана"],["Сумма прихода",b.price!==""&&b.price!=null?fm(r2(b.qty*b.price))+" ₽":"—"],["Годен до",e?fd(e)+(root.id!==b.id?" (срок исходной партии)":""):"Срок годности не указан"]].concat(b.parent?[["Из партии",(X.batch[b.parent]||{}).name||""]]:[]);
  let form="";
  if(SKB.mode==="edit") form=`<div class="skbox"><div class="skbh"><b>Изменить партию</b></div><div class="skgrid">
      ${lim?"":`<label class="f">Закупочная цена за ${esc(b.unit)}, ₽<input class="skbp" data-keep="1" inputmode="decimal" value="${esc(String(b.price||"").replace(".",","))}"></label>`}
      <label class="f">Годен до${root.id!==b.id?" (у исходной партии)":""}<input type="date" class="skbe" data-keep="1" value="${esc(e)}" min="${esc(root.date)}"></label>
      <label class="f">Поставщик<input class="skbs" data-keep="1" value="${esc(b.supplier||"")}"></label><label class="f">Входящий документ<input class="skbd" data-keep="1" value="${esc(b.docRef||"")}"></label>
      ${b.kind==="rw"?"":`<label class="f">Пришло, ${esc(b.unit)}<input class="skbq" data-keep="1" inputmode="decimal" value="${esc(String(b.qty).replace(".",","))}"></label><label class="f">Причина исправления количества<input class="skbr2" data-keep="1" placeholder="если меняете количество"></label>`}</div>
      <p class="muted sk-hint">Новая цена действует на остаток; себестоимость уже отгруженного не меняется. Чтобы очистить срок, сотрите дату.</p>
      <div class="row"><button type="button" class="btn pri sm" data-sk="batchSave">Сохранить</button><button type="button" class="btn ghost sm" data-sk="mode0">Отмена</button></div></div>`;
  if(SKB.mode==="wo") form=`<div class="skbox"><div class="skbh"><b>Списание</b><small class="muted">свободно ${skQf(r3(f-r),b.unit)}</small></div><div class="skgrid"><label class="f">Сколько, ${esc(b.unit)}<input class="skwq" data-keep="1" inputmode="decimal"></label><label class="f wide">Причина (обязательно)<input class="skwr" data-keep="1" placeholder="испортился, усушка, брак…"></label></div><div class="row"><button type="button" class="btn pri sm danger" data-sk="woSave">Списать</button><button type="button" class="btn ghost sm" data-sk="mode0">Отмена</button></div></div>`;
  if(SKB.mode==="rw") form=`<div class="skbox"><div class="skbh"><b>Перевзвешивание в кг</b><small class="muted">свободно ${skQf(r3(f-r),b.unit)}; зарезервированные не перевзвешиваются</small></div><div class="skgrid"><label class="f">Сколько ${esc(b.unit)}<input class="skrn" data-keep="1" inputmode="decimal"></label><label class="f">Фактический вес, кг<input class="skrk" data-keep="1" inputmode="decimal"></label></div><p class="muted sk-hint">Стоимость упаковок перейдёт в новую партию в кг. Срок годности и декларации остаются от этой партии.</p><div class="row"><button type="button" class="btn pri sm" data-sk="rwSave">Перевзвесить</button><button type="button" class="btn ghost sm" data-sk="mode0">Отмена</button></div></div>`;
  return skHead(esc(it.name||"Товар"), esc(b.name), "")
   + `<div class="skuv one"><div><small>${esc(b.unit)}</small><b>${skQf(f)}</b><span>на складе</span><span class="skfree">резерв <b>${skQf(r)}</b> · свободно <b>${skQf(r3(f-r))}</b></span></div></div>`
   + `<dl class="dc-info">${info.map(([a,v])=>`<div><dt>${a}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` + form
   + `<div class="skbox"><div class="skbh"><b>Декларации партии</b><button type="button" class="btn sm" data-sk="attachBatch">Прикрепить</button></div>${files.length?files.map(x=>skFileRow(x,false)).join(""):`<p class="muted">Файлов нет.</p>`}</div>`
   + `<div class="skbox"><div class="skbh"><b>История партии</b></div>${skMoves(ML)}</div>`
   + `<div class="dc-acts"><button class="btn" data-sk="item" data-id="${b.itemId}">‹ К товару</button>${SKB.mode?"":`<button class="btn" data-sk="mode" data-m="edit">Изменить</button><button class="btn" data-sk="mode" data-m="wo"${f-r>0?"":" disabled"}>Списать</button>${skK(b.unit)!=="кг"?`<button class="btn" data-sk="mode" data-m="rw"${f-r>0?"":" disabled"}>Перевзвесить</button>`:""}`}<button class="btn pri" data-sk="close">Готово</button></div>`; }

/* ---------- приход / начальный остаток ---------- */
let SKIN=null;
function skInForm(kind, itemId){ const X=skIdx(), it=itemId?X.item[itemId]:null;
  SKIN={kind:kind||"in", itemId:itemId||"", name:it?it.name:"", unit:it?it.unit:"кг", qty:"", price:"", date:todayISO(), supplier:"", docRef:"", exp:"", file:null, sugOpen:false};
  skModal(skInHtml, true); setTimeout(()=>{ const f=$("#sk-dlg .skf-name"); if(f && !itemId) f.focus(); else { const q=$("#sk-dlg .skf-qty"); q&&q.focus(); } },120); }
function skInHtml(){ const X=skIdx(), F=SKIN, init=F.kind==="init", sups=[...new Set(X.S.batches.map(b=>b.supplier).filter(Boolean))].slice(-30);
  return skHead(init?"Начальный остаток":"Приход на склад", init?"Ввод начального остатка":"Новый приход", init?"Отдельная операция с датой, количеством, единицей и себестоимостью. Старые накладные не резервируются и не списываются.":"Каждый приход — отдельная партия, даже если в тот же день.")
  + `<div class="skgrid skin">
      <label class="f wide skname">Товар<input class="skf-name" data-keep="1" autocomplete="off" value="${esc(F.name)}" placeholder="Начните вводить — покажу похожие"><div class="sksug" id="sk-sug">${skInSug()}</div></label>
      <label class="f">Единица${skUnitSel(F.unit,"skf-unit")}</label>
      <label class="f">Количество<input class="skf-qty" data-keep="1" inputmode="decimal" value="${esc(F.qty)}" placeholder="0"></label>
      <label class="f">Закупочная цена за ед., ₽<input class="skf-price" data-keep="1" inputmode="decimal" value="${esc(F.price)}" placeholder="не знаю — оставить пустым"></label>
      <label class="f">Дата приёмки<input type="date" class="skf-date" data-keep="1" value="${esc(F.date)}"></label>
      <label class="f">Поставщик<input class="skf-sup" data-keep="1" list="sk-sups" value="${esc(F.supplier)}" placeholder="${init?"Начальный остаток":"Саид, рынок, ООО…"}"><datalist id="sk-sups">${sups.map(s=>`<option value="${esc(s)}">`).join("")}</datalist></label>
      <label class="f">Входящий документ (№ или ссылка)<input class="skf-doc" data-keep="1" value="${esc(F.docRef)}"></label>
      <label class="f">Годен до (необязательно)<input type="date" class="skf-exp" data-keep="1" value="${esc(F.exp)}"></label>
      <label class="f wide">Декларация (необязательно)<input type="file" class="skf-file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx"></label>
    </div><div class="sksum" id="sk-insum">${skInSum()}</div>
    <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="inSave">${init?"Провести остаток":"Провести приход"}</button></div>`; }
function skInSug(){ const F=SKIN, q=skK(F.name), X=skIdx(); if(!q || !F.sugOpen) return "";
  const L=X.S.items.filter(i=>[i.name,i.alt||""].some(t=>skK(t).includes(q))).slice(0,6), exact=X.S.items.some(i=>skK(i.name)===q);
  return L.map(i=>`<button type="button" data-skpick="${i.id}"><span>${esc(i.name)}</span><small>${skUnitsOf(i.id).map(u=>skQf(u.fact,u.unit)).join(" · ")||"нет в наличии"}</small></button>`).join("")+(exact?"":`<button type="button" class="new" data-skpick=""><span>+ Новый товар «${esc(skN(F.name))}»</span><small>сохранится в справочнике склада после проведения</small></button>`); }
function skInSum(){ const F=SKIN, q=+String(F.qty).replace(",","."), p=String(F.price).trim()===""?null:+String(F.price).replace(",",".");
  if(!(q>0)) return ""; return `<span>${skQf(q,F.unit)}${p!=null&&p>=0?" × "+fm(p)+" ₽ = <b>"+fm(r2(q*p))+" ₽</b>":" · <span class=\"miss\">цена не указана — себестоимость будет неизвестна</span>"}</span>`; }
function skInRead(){ const d=$("#sk-dlg"); if(!d||!SKIN) return; const v=c=>{ const el=d.querySelector(c); return el?el.value:""; };
  Object.assign(SKIN,{name:v(".skf-name"), qty:v(".skf-qty"), price:v(".skf-price"), date:v(".skf-date"), supplier:v(".skf-sup"), docRef:v(".skf-doc"), exp:v(".skf-exp")}); const u=v(".skf-unit"); if(u && u!=="__new") SKIN.unit=u;
  const it=skIdx().item[SKIN.itemId]; if(it && skK(it.name)!==skK(SKIN.name)) SKIN.itemId=""; }
async function skInSave(force){ skInRead(); const F=SKIN, d=$("#sk-dlg"), file=(d.querySelector(".skf-file")||{}).files; const fl=file&&file[0];
  if(!skN(F.name)){ toast("err","Укажите товар",""); return; } if(!(+String(F.qty).replace(",",".")>0)){ toast("err","Укажите количество",""); return; }
  if(F.exp && F.date && F.exp<F.date){ toast("err","Срок годности раньше даты приёмки","Проверьте даты."); return; }
  if(fl && !skFileOk(fl)) return;
  const exact=F.itemId?null:skIdx().S.items.find(i=>skK(i.name)===skK(F.name));
  const body={kind:F.kind, itemId:F.itemId||(exact?exact.id:""), newName:F.itemId||exact?"":skN(F.name), unit:F.unit, qty:F.qty, price:String(F.price).trim(), date:F.date, supplier:F.supplier, docRef:F.docRef, exp:F.exp, force:!!force};
  const btn=d.querySelector('[data-sk="inSave"]'); btn.disabled=true; btn.textContent="Провожу…";
  try{ const j=await skSend("in", body, (F.kind==="init"?"Начальный остаток: ":"Приход: ")+skN(F.name)+" "+skQf(+String(F.qty).replace(",","."),F.unit));
    toast("ok", F.kind==="init"?"Остаток проведён":"Приход проведён", skN(F.name)+" — "+skQf(+String(F.qty).replace(",","."),F.unit));
    const out=j.out||{}; skClose(true);
    if(fl && out.batchId) await skAttach(fl, out.itemId, out.batchId);
    if(out.itemId) skItemCard(out.itemId);
  }catch(e){ if(e.resp && e.resp.code==="similar"){ btn.disabled=false; btn.textContent=F.kind==="init"?"Провести остаток":"Провести приход";
      if(confirm(e.message+".\n\nЭто другой, отдельный приход? Нажмите «ОК», чтобы провести его отдельно.")) return skInSave(true); return; }
    if(e.queued){ skErr(e,"приход"); skClose(); return; } skErr(e,"приход"); btn.disabled=false; btn.textContent=F.kind==="init"?"Провести остаток":"Провести приход"; } }
/* ---------- декларации ---------- */
const SK_EXT=/\.(pdf|jpe?g|png|webp|heic|heif|gif|docx?|xlsx?|txt)$/i;
function skFileOk(f){ if(!SK_EXT.test(f.name)){ toast("err","Такой файл не подходит","Можно PDF, фото (JPG, PNG, WEBP, HEIC), Word или Excel."); return false; } if(f.size>20*1024*1024){ toast("err","Файл больше 20 МБ","Сожмите или разделите файл."); return false; } return true; }
const skMime = f => f.type || ({pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif",gif:"image/gif",doc:"application/msword",docx:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",xls:"application/vnd.ms-excel",xlsx:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",txt:"text/plain"})[(f.name.split(".").pop()||"").toLowerCase()] || "";
async function skAttach(f, itemId, batchId){ if(!skFileOk(f)) return;
  const data=await new Promise((ok,bad)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]||""); r.onerror=()=>bad(new Error("не получилось прочитать файл")); r.readAsDataURL(f); });
  const t=toast("info","Загружаю декларацию…", f.name, {sticky:true});
  try{ await skSend("file", {itemId, batchId:batchId||"", name:f.name, mime:skMime(f), size:f.size, data}, "Декларация: "+f.name); toast("ok","Декларация прикреплена", f.name); }
  catch(e){ if(e.queued){ toast("warn","Декларация не загрузилась — нет связи","Файл «"+f.name+"» ждёт отправки. Не перезагружайте страницу, отправлю сам."); } else skErr(e,"декларация"); } }
function skPickFile(itemId, batchId){ const inp=document.createElement("input"); inp.type="file"; inp.accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx"; inp.onchange=()=>{ const f=inp.files[0]; if(f) skAttach(f, itemId, batchId); }; inp.click(); }
async function skFile(id, view){ const t0=toast("info","Открываю файл…","");
  try{ const j=await api({action:"stock", op:"fileGet", d:{id}}); const bin=atob(j.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const blob=new Blob([u8],{type:j.mime||"application/octet-stream"}), url=URL.createObjectURL(blob);
    if(view){ const im=/^image\//.test(j.mime); const v=document.createElement("dialog"); v.className="dcard wide skview"; v.innerHTML=`<div class="dc-head"><div><div class="dc-kicker">Декларация</div><h3>${esc(j.name)}</h3></div><button class="dc-x" aria-label="Закрыть">×</button></div>${im?`<img src="${url}" alt="${esc(j.name)}">`:`<iframe src="${url}" title="${esc(j.name)}"></iframe>`}<div class="dc-acts"><a class="btn" href="${url}" download="${esc(j.name)}">Скачать</a></div>`;
      document.getElementById("fd-app").appendChild(v); v.querySelector(".dc-x").onclick=()=>{ v.close(); v.remove(); URL.revokeObjectURL(url); }; v.addEventListener("close",()=>v.remove()); v.showModal(); requestAnimationFrame(()=>v.classList.add("in")); }
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
  return skHead("Склад","Инвентаризация","Впишите фактическое количество по партиям. Пустая строка — пропуск, 0 — значит товара нет. Проводится только разница.")
   + `<label class="chk"><input type="checkbox" class="skinvall"${SKINV.all?" checked":""}> показать и пустые партии</label>`
   + `<div class="tbl"><table class="skinvt"><thead><tr><th>Товар · партия</th><th class="num">По учёту</th><th class="num">Резерв</th><th>Факт</th><th class="num">Разница</th></tr></thead><tbody>${L.map(b=>{ const f=skFact(b.id), v=SKINV.f[b.id]==null?"":SKINV.f[b.id], d=v===""?null:r3(+String(v).replace(",",".")-f);
     return `<tr><td><b>${esc((X.item[b.itemId]||{}).name||"")}</b><small>${esc(b.name)}</small></td><td class="num">${skQf(f,b.unit)}</td><td class="num">${skRes(b.id)?skQf(skRes(b.id)):"—"}</td><td><input class="skinvf" data-keep="1" data-b="${b.id}" inputmode="decimal" value="${esc(v)}" placeholder="—"></td><td class="num skinvd" data-d="${b.id}">${d==null?"":d===0?`<span class="muted">0</span>`:`<b class="${d<0?"neg":"pos"}">${d>0?"+":""}${skQf(d)}</b>`}</td></tr>`; }).join("")||`<tr><td colspan="5" class="muted">Партий нет.</td></tr>`}</tbody></table></div>`
   + `<label class="f wide">Комментарий к акту<input class="skinvn" data-keep="1"></label>`
   + `<div class="dc-acts"><span class="muted" style="margin-right:auto">Заполнено: ${n}</span><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="invSave">Провести акт</button></div>`; }

/* ---------- накладная: строка «откуда товар» ---------- */
function skLineBtn(i){ if(!SK_READY) return ""; if(skSrv===false) return ""; const l=D.draft.lines[i]; if(!l||!l.productId||!skCan()) return ""; const it=skItemOf(l.productId), m=(l.stk||{}).m||"";
  const free=it?skFreeU(it.id, (prod(l.productId)||{}).unit):0;
  return `<button type="button" class="skb${m?" on":free>0?" has":""}" data-skl="${i}" title="${m?"Источник: "+(m==="s"?"со склада":"часть со склада"):it?"На складе свободно "+skQf(free,(prod(l.productId)||{}).unit)+" — нажмите, чтобы выбрать источник":"Источник товара: от Саида или со склада"}" aria-label="Источник товара">${skIcon}</button>`; }
function skLineNote(i){ if(!SK_READY) return ""; if(skSrv===false) return ""; const l=D.draft.lines[i], p=l&&prod(l.productId); if(!p||!skCan()) return ""; const it=skItemOf(p.id), src=l.stk||{}, m=src.m||"", q=+l.qty||0;
  if(!m){ const free=it?skFreeU(it.id,p.unit):0; return it && free>0 ? `<div class="sknote" role="note">${skIcon}<span>На складе свободно <b>${skQf(free,p.unit)}</b> — «${esc(it.name)}». По умолчанию товар от Саида.</span></div>` : ""; }
  if(!it) return `<div class="sknote bad" role="note">${skIcon}<span>Выбран склад, но позиция не связана со складским товаром — резерва не будет. Нажмите значок склада.</span></div>`;
  const j=D.journal.find(x=>x.id===D.draft.id), saved=j&&!j.snap.meta?.arch, req=m==="s"?q:Math.min(q,+src.q||0), inf=saved?skLineInfo(j.id, (j.snap.dr.lines||[]).find(x=>x.lid===l.lid)||l, p.unit):null, um=!skUnitsOf(it.id).some(u=>skK(u.unit)===skK(p.unit));
  let s=`Со склада: <b>${skQf(req,p.unit)}</b> «${esc(it.name)}»`+(m==="x"?` · от Саида: <b>${skQf(Math.max(0,q-req),p.unit)}</b>`:"");
  if(um) s+=` · <span class="miss">на складе нет этой единицы (${esc(p.unit)})</span>`;
  else if(inf && inf.req===req) s+= (inf.shipped?` · отгружено ${skQf(inf.shipped)}`:"") + (inf.res?` · в резерве <b>${skQf(inf.res)}</b>`:"") + (inf.short?` · <span class="miss">нехватка ${skQf(inf.short,p.unit)}</span>`:"") + (!inf.res&&!inf.short&&!inf.shipped&&inf.need===0&&inf.closed?" · остаток закрыт":"");
  else { const fr=skFreeU(it.id,p.unit); s+=` · <span class="muted">резерв появится после сохранения (свободно ${skQf(fr,p.unit)})</span>`+(fr<req?` · <span class="miss">не хватит ${skQf(r3(req-fr),p.unit)}</span>`:""); }
  return `<div class="sknote on" role="note">${skIcon}<span>${s}</span></div>`; }
function skDocHints(){ if(!SK_READY) return ""; if(curTab!=="doc") return; document.querySelectorAll("#d-lines .line[data-i]").forEach(el=>{ const i=+el.dataset.i, b=el.querySelector(".skb"), n=el.querySelector(".sknote"), h=skLineNote(i), bh=skLineBtn(i);
  if(b) b.outerHTML=bh||""; else if(bh){ const pc=el.querySelector(".pc"); pc&&pc.insertAdjacentHTML("beforeend",bh); }
  if(n) n.outerHTML=h||""; else if(h) el.insertAdjacentHTML("beforeend",h); }); }
let SKL=null;
function skLineCard(i){ const l=D.draft.lines[i]; if(!l||!l.productId) return; SKL={i, linkQ:""}; skModal(skLineHtml); }
function skLineHtml(){ const l=D.draft.lines[SKL.i]; if(!l) return skHead("Склад","Строка удалена",""); const p=prod(l.productId)||{}, it=skItemOf(p.id), src=l.stk||{}, m=src.m||"", q=+l.qty||0, lim=docLimited();
  if(!it) return skHead("Откуда товар", esc(p.name), "Эта позиция документа ещё не связана со складским товаром. Связь создаётся только вручную — похожее название само ничего не списывает.")
    + `<div class="skbox"><div class="skbh"><b>Связать со складским товаром</b></div><input class="sklq2" data-keep="1" placeholder="Найти товар на складе" value="${esc(SKL.linkQ)}"><div class="sklsug">${skItemSug(p)}</div></div><div class="dc-acts"><button class="btn" data-sk="close">Закрыть</button></div>`;
  const free=skFreeU(it.id,p.unit), um=!skUnitsOf(it.id).some(u=>skK(u.unit)===skK(p.unit));
  const opt=(k,t,s)=>`<label class="skopt${m===k?" on":""}"><input type="radio" name="sksrc" value="${k}"${m===k?" checked":""}><span><b>${t}</b><small>${s}</small></span></label>`;
  return skHead("Откуда товар", esc(p.name), `На складе: «${esc(it.name)}» — свободно <b>${skQf(free,p.unit)}</b>`+(um?` · <span class="miss">на складе нет единицы «${esc(p.unit)}»</span>`:""))
   + `<div class="skopts">${opt("","От Саида","закупка под эту поставку (по умолчанию)")}${opt("s","Со склада","все "+skQf(q,p.unit)+(free<q?" — свободно только "+skQf(free)+", нехватка будет "+skQf(r3(q-free),p.unit):""))}${opt("x","Часть со склада","остальное — от Саида")}</div>
     <div class="skmix"${m==="x"?"":" hidden"}><div class="skgrid"><label class="f">Со склада, ${esc(p.unit)}<input class="skmq" data-keep="1" inputmode="decimal" value="${esc(String(src.q||"").replace(".",","))}" placeholder="${esc(String(Math.min(free,q)).replace(".",","))}"></label>${lim?"":`<label class="f">Цена у Саида за ${esc(p.unit)}, ₽ <small>(для прибыли)</small><input class="skmp" data-keep="1" inputmode="decimal" value="${esc(String(src.pd||"").replace(".",","))}" placeholder="необязательно"></label>`}</div></div>
     <p class="muted sk-hint">Резерв появится после сохранения документа. Нехватка сама не превращается в закупку у Саида — можно выбрать «Часть со склада» или провести приход и обновить резерв.</p>
     <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="lineSave">Готово</button></div>`; }
function skItemSug(p){ const q=skK(SKL.linkQ), X=skIdx(), words=q.split(" ").filter(Boolean);
  const tk=s=>skK(s).replace(/[()«»"',.]/g," ").split(" ").filter(w=>w.length>=4).map(w=>w.slice(0,5)), P=new Set(tk(p.name));
  const L=words.length?X.S.items.filter(i=>words.every(w=>skK(i.name+" "+(i.alt||"")).includes(w))):X.S.items.filter(i=>tk(i.name+" "+(i.alt||"")).some(w=>P.has(w)));
  return (!words.length&&L.length?`<small class="muted">Похоже по названию (связь — только после нажатия):</small>`:"")+L.slice(0,6).map(i=>`<button type="button" class="sklsb" data-sklinkto="${i.id}"><span>${esc(i.name)}</span><small>${skUnitsOf(i.id).map(u=>skQf(u.free,u.unit)+" свободно").join(" · ")||"нет в наличии"} · связать</small></button>`).join("")||(words.length?`<small class="muted">Не найдено. Заведите товар приходом во вкладке «Склад».</small>`:""); }

/* ---------- накладная в журнале: блок «Склад» в окне документа ---------- */
function skDocBlock(j){ if(!SK_READY) return ""; if(!skCan() || !j || !j.snap || !skDocHas(j)) return ""; const L=skDocLines(j).filter(x=>x.req>0||x.shipped>0||x.res>0);
  const can=!isArch(j); const anyNeed=L.some(x=>x.need>0), anyShip=L.some(x=>x.shipped-x.ret>0);
  return `<div class="skdoc"><div class="skbh"><b>${skIcon}Склад</b><small class="muted">${L.some(x=>x.short>0)?`<span class="miss">есть нехватка</span>`:anyNeed?"зарезервировано, ждёт отгрузки":"отгружено со склада"}</small></div>
    ${L.map(x=>`<div class="skdl1"><span><b>${esc(x.item?x.item.name:(x.l.name||(prod(x.l.productId)||{}).name||""))}</b><small>со склада ${skQf(x.req,x.unit)}${x.m==="x"?" из "+skQf(x.qty):""}</small></span><span class="skst">${x.res?`<em class="r">резерв ${skQf(x.res)}</em>`:""}${x.short?`<em class="s">нехватка ${skQf(x.short)}</em>`:""}${x.shipped?`<em class="o">отгружено ${skQf(x.shipped)}</em>`:""}${x.ret?`<em>возврат ${skQf(x.ret)}</em>`:""}${x.closed?`<em>закрыто ${skQf(x.closed)}</em>`:""}</span></div>`).join("")}
    ${can?`<div class="row"><button type="button" class="btn pri sm" data-skd="ship" data-doc="${j.id}"${L.some(x=>x.res>0)||L.some(x=>x.m!=="s")?"":" disabled"}>Отгрузить</button><button type="button" class="btn sm" data-skd="reserve" data-doc="${j.id}">Обновить резерв</button>${anyNeed?`<button type="button" class="btn ghost sm" data-skd="close" data-doc="${j.id}">Закрыть остаток</button>`:""}${anyShip?`<button type="button" class="btn ghost sm" data-skd="ret" data-doc="${j.id}">Возврат</button>`:""}</div>`:""}</div>`; }
let SKS=null;
function skShipForm(j, mode){ SKS={id:j.id, mode}; skModal(skShipHtml, true); }
function skShipHtml(){ const j=D.journal.find(x=>x.id===SKS.id); if(!j) return skHead("Склад","Накладная не найдена",""); const all=skDocLines(j), M=SKS.mode, lbl="№ "+esc(j.number)+" от "+fd(j.date)+" — "+esc(jWho(j).main);
  if(M==="ship") return skHead("Отгрузка", lbl, "Подтвердите, что товар фактически уехал. Со склада — не больше резерва. Печать, повторное сохранение и скачивание ничего не списывают.")
    + `<div class="tbl"><table class="skshipt"><thead><tr><th>Товар</th><th class="num">В резерве</th><th>Со склада</th><th>От Саида</th></tr></thead><tbody>${all.map(x=>{ const nm=x.l.name||(j.snap.prods[x.l.productId]||{}).name||"", dir=r3(Math.max(0,x.qty-x.req-x.direct));
      return `<tr><td><b>${esc(nm)}</b><small>${skQf(x.qty,x.unit)}${x.item?" · склад: «"+esc(x.item.name)+"»":""}</small></td><td class="num">${x.req?skQf(x.res,x.unit)+(x.short?`<small class="miss">нехватка ${skQf(x.short)}</small>`:""):"—"}</td><td>${x.req&&x.item?`<input class="skshq" data-keep="1" data-l="${esc(x.l.lid||"")}" inputmode="decimal" value="${esc(String(x.res).replace(".",","))}">`:"—"}</td><td><input class="skshd" data-keep="1" data-l="${esc(x.l.lid||"")}" inputmode="decimal" value="${dir?esc(String(dir).replace(".",",")):""}" placeholder="0"></td></tr>`; }).join("")}</tbody></table></div>
      <p class="muted sk-hint">Если отгрузили меньше резерва — остаток останется в резерве к допоставке. Закрыть его можно кнопкой «Закрыть остаток».</p>
      <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="shipSave">Подтвердить отгрузку</button></div>`;
  if(M==="close") return skHead("Закрыть остаток", lbl, "Недопоставленная складская часть больше не нужна: резерв по ней снимется.")
    + `<div class="skdl">${all.filter(x=>x.need>0).map(x=>`<div class="skdr"><b>${esc(x.item?x.item.name:"")}</b><span>к допоставке ${skQf(x.need,x.unit)}</span></div>`).join("")}</div><label class="f wide">Причина (обязательно)<input class="skclr" data-keep="1" placeholder="заказчик отказался, заменили товар…"></label>
      <div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="closeSave">Закрыть остаток</button></div>`;
  if(M==="ret") return skHead("Возврат на склад", lbl, "Товар вернётся в те же партии по той же себестоимости. Не больше, чем отгружено и ещё не возвращено.")
    + `<div class="tbl"><table class="skshipt"><thead><tr><th>Товар</th><th class="num">Можно вернуть</th><th>Вернуть</th></tr></thead><tbody>${all.filter(x=>x.shipped-x.ret>0).map(x=>`<tr><td><b>${esc(x.item?x.item.name:"")}</b></td><td class="num">${skQf(r3(x.shipped-x.ret),x.unit)}</td><td><input class="skretq" data-keep="1" data-l="${esc(x.l.lid||"")}" inputmode="decimal" placeholder="0"></td></tr>`).join("")}</tbody></table></div>
      <label class="f wide">Причина<input class="skretr" data-keep="1" placeholder="брак, пересорт…"></label><div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-sk="retSave">Провести возврат</button></div>`;
  return ""; }

/* ---------- обработчики ---------- */
const skVal = (sel) => { const el=$("#sk-dlg "+sel); return el?el.value:""; };
const skBusy = (b, on, t) => { if(!b) return; if(on){ b.dataset.t0=b.textContent; b.disabled=true; b.textContent=t||"Отправляю…"; } else { b.disabled=false; if(b.dataset.t0) b.textContent=b.dataset.t0; } };
async function skDo(op, d, label, okT, b){ skBusy(b,true); try{ const j=await skSend(op,d,label); toast("ok",okT||"Готово",""); return j; }catch(e){ skErr(e,label); if(e.queued) skClose(); return null; } finally{ skBusy(b,false); } }
document.addEventListener("click", async e=>{
  const t=e.target; if(!t.closest) return;
  const det=t.closest("[data-skdet]"); if(det){ SKV.det=SKV.det===det.dataset.skdet?"":det.dataset.skdet; skDrawKpi(); return; }
  const seg=t.closest("#sk-segs [data-skt]"); if(seg){ SKV.tab=seg.dataset.skt; SKV.shown=60; renderStock(); return; }
  const hf=t.closest("[data-skhf]"); if(hf){ SKV.hf=hf.dataset.skhf; skDrawList(); return; }
  const doc=t.closest("[data-skdoc]"); if(doc){ e.preventDefault(); const j=D.journal.find(x=>x.id===doc.dataset.skdoc); if(!j){ toast("info","Накладной нет на этом устройстве","Обновите страницу."); return; } skClose(true); docCard(j, isArch(j)); return; }
  const itb=t.closest("[data-skitem]"); if(itb){ skItemCard(itb.dataset.skitem); return; }
  const bb=t.closest("[data-skbatch]"); if(bb){ skBatchCard(bb.dataset.skbatch); return; }
  const fv=t.closest("[data-skfview],[data-skfget]"); if(fv){ skFile(fv.dataset.skfview||fv.dataset.skfget, !!fv.dataset.skfview); return; }
  const fdl=t.closest("[data-skfdel]"); if(fdl){ if(!armed(fdl,"Удалить?")) return; skDo("fileDel",{id:fdl.dataset.skfdel},"Удаление декларации","Декларация удалена"); return; }
  const ap=t.closest("[data-skattach]"); if(ap){ const id=ap.dataset.skattach; skClose(true); skItemCard(id); skPickFile(id,""); return; }
  const sl=t.closest("[data-skl]"); if(sl){ skLineCard(+sl.dataset.skl); return; }
  const kd=t.closest("[data-skd]"); if(kd){ const j=D.journal.find(x=>x.id===kd.dataset.doc); if(!j) return; const a=kd.dataset.skd;
    if(a==="reserve"){ skBusy(kd,true,"Проверяю…"); try{ await skSend("reserve",{docId:j.id},"Обновить резерв № "+j.number); const L=skDocLines(j), sh=L.filter(x=>x.short>0); toast(sh.length?"warn":"ok", sh.length?"Резерв обновлён, но не хватает":"Резерв обновлён", sh.map(x=>x.item.name+" — "+skQf(x.short,x.unit)).join("; ")); const c=document.getElementById("fd-dcard"); if(c) docCard(j); }catch(er){ skErr(er,"обновление резерва"); } finally{ skBusy(kd,false); } return; }
    const c=document.getElementById("fd-dcard"); if(c){ c.remove(); } skShipForm(j, a); return; }
  const lk=t.closest("[data-sklink]"); if(lk){ const it=skIdx().item[SKI.id]; if(!it) return; SKI.linkQ=""; skBusy(lk,true,"Связываю…"); try{ await skSend("item",{itemId:it.id, links:(it._links||[]).concat(lk.dataset.sklink)},"Связь: "+it.name); toast("ok","Связано","«"+((prod(lk.dataset.sklink)||{}).name||"")+"» → «"+it.name+"»"); }catch(er){ skErr(er,"связь"); } return; }
  const ul=t.closest("[data-skunlink]"); if(ul){ if(!armed(ul,"Убрать?")) return; const it=skIdx().item[SKI.id]; await skDo("item",{itemId:it.id, links:(it._links||[]).filter(x=>x!==ul.dataset.skunlink)},"Связь: "+it.name,"Связь убрана"); return; }
  const lt=t.closest("[data-sklinkto]"); if(lt){ const it=skIdx().item[lt.dataset.sklinkto], l=D.draft.lines[SKL.i]; if(!it||!l) return; skBusy(lt,true,"Связываю…"); try{ await skSend("item",{itemId:it.id, links:(it._links||[]).concat(l.productId)},"Связь: "+it.name); toast("ok","Связано","Теперь «"+((prod(l.productId)||{}).name||"")+"» берётся со склада как «"+it.name+"»."); }catch(er){ skErr(er,"связь"); } return; }
  const pk=t.closest("[data-skpick]"); if(pk){ skInRead(); const it=skIdx().item[pk.dataset.skpick]; if(it){ SKIN.itemId=it.id; SKIN.name=it.name; SKIN.unit=it.unit||SKIN.unit; } else SKIN.itemId=""; SKIN.sugOpen=false; skModalRefresh(); const q=$("#sk-dlg .skf-qty"); q&&q.focus(); return; }
  const mf=t.closest("[data-skmf]"); if(mf){ SKI.f=mf.dataset.skmf; skModalRefresh(); return; }
  const rl=t.closest("[data-skresl]"); if(rl){ SKI.resU=SKI.resU===rl.dataset.skresl?null:rl.dataset.skresl; skModalRefresh(); return; }
  const b=t.closest("[data-sk]"); if(!b) return; const a=b.dataset.sk;
  if(a==="close"){ skClose(); return; }
  if(a==="in"||a==="init"){ skInForm(a); return; }
  if(a==="inv"){ skInv(); return; }
  if(a==="flush"){ skFlushQ(); return; }
  if(a==="more"){ SKV.shown+=100; skDrawList(); return; }
  if(a==="attach"){ skAttachPick(); return; }
  if(a==="reload"){ skLoad(); return; }
  if(a==="item"){ skItemCard(b.dataset.id); return; }
  if(a==="inItem"){ const id=SKI.id; skInForm("in", id); return; }
  if(a==="attachItem"){ skPickFile(SKI.id,""); return; }
  if(a==="attachBatch"){ const bt=skIdx().batch[SKB.id]; if(bt) skPickFile(bt.itemId, bt.id); return; }
  if(a==="resclose"){ SKI.resU=null; skModalRefresh(); return; }
  if(a==="itemEdit"){ SKI.edit=true; skModalRefresh(); return; } if(a==="itemEditOff"){ SKI.edit=false; skModalRefresh(); return; }
  if(a==="itemSave"){ const u=skVal(".skiu"); const j=await skDo("item",{itemId:SKI.id, name:skVal(".skin"), alt:skVal(".skalt"), unit:u==="__new"?undefined:u},"Товар склада","Сохранено",b); if(j){ SKI.edit=false; skModalRefresh(); } return; }
  if(a==="note"||a==="noteclr"){ const v=a==="noteclr"?"":skVal(".skcomment"); await skDo("item",{itemId:SKI.id, note:v},"Комментарий к товару",v?"Комментарий сохранён":"Комментарий очищен",b); return; }
  if(a==="mode"){ SKB.mode=b.dataset.m; skModalRefresh(); return; } if(a==="mode0"){ SKB.mode=""; skModalRefresh(); return; }
  if(a==="batchSave"){ const bt=skIdx().batch[SKB.id], d={batchId:SKB.id}; if(!bt) return;
    if(!docLimited()){ const p=skVal(".skbp").replace(",","."); if(p!==String(bt.price||"")) d.price=p; }
    const ev=skVal(".skbe"), root=skRoot(bt); if(ev!==(root.exp||"")){ if(ev && ev<root.date){ toast("err","Срок годности раньше даты приёмки",""); return; } d.exp=ev; }
    if(skVal(".skbs")!==(bt.supplier||"")) d.supplier=skVal(".skbs"); if(skVal(".skbd")!==(bt.docRef||"")) d.docRef=skVal(".skbd");
    const qv=skVal(".skbq"); if(qv && r3(+qv.replace(",","."))!==r3(bt.qty)){ d.qty=qv.replace(",","."); d.reason=skVal(".skbr2"); if(!skN(d.reason)){ toast("err","Укажите причину исправления количества",""); return; } }
    if(Object.keys(d).length===1){ SKB.mode=""; skModalRefresh(); return; }
    const j=await skDo("batch",d,"Партия: "+bt.name,"Партия изменена",b); if(j){ SKB.mode=""; skModalRefresh(); } return; }
  if(a==="woSave"){ const r=skN(skVal(".skwr")); if(!r){ toast("err","Укажите причину списания",""); return; } const j=await skDo("wo",{batchId:SKB.id, qty:skVal(".skwq").replace(",","."), reason:r},"Списание","Списано",b); if(j){ SKB.mode=""; skModalRefresh(); } return; }
  if(a==="rwSave"){ const j=await skDo("rw",{batchId:SKB.id, n:skVal(".skrn").replace(",","."), kg:skVal(".skrk").replace(",",".")},"Перевзвешивание","Перевзвешено",b); if(j && j.out){ skBatchCard(j.out.batchId); } return; }
  if(a==="inSave"){ skInSave(false); return; }
  if(a==="invSave"){ const rows=Object.keys(SKINV.f).filter(k=>SKINV.f[k]!=="").map(k=>({batchId:k, fact:String(SKINV.f[k]).replace(",",".")})); if(!rows.length){ toast("err","Впишите факт хотя бы по одной партии",""); return; }
    const j=await skDo("inv",{rows, note:skVal(".skinvn")},"Инвентаризация ("+rows.length+" парт.)","Акт проведён",b); if(j){ toast("ok","Акт инвентаризации сохранён", (j.out&&j.out.diffN)?"Расхождений: "+j.out.diffN+" — остатки поправлены":"Расхождений нет"); skClose(); } return; }
  if(a==="lineSave"){ const l=D.draft.lines[SKL.i], r=document.querySelector('#sk-dlg input[name="sksrc"]:checked'), m=r?r.value:""; if(!l) return;
    if(!m) delete l.stk; else if(m==="s") l.stk={m:"s"}; else { const qv=+skVal(".skmq").replace(",","."), pd=skVal(".skmp").replace(",",".").trim();
      if(!(qv>0)){ toast("err","Сколько взять со склада?","Впишите количество складской части."); return; } if(qv>=(+l.qty||0)){ l.stk={m:"s"}; toast("info","Всё количество — со склада","Выбрано «Со склада»."); } else l.stk=Object.assign({m:"x", q:String(r3(qv))}, pd&&+pd>=0?{pd}:{}); }
    if(!l.lid) l.lid=uid()+uid(); saveLocal(); skClose(); renderLines(); toast("ok", m?"Источник: "+(m==="s"?"со склада":"часть со склада"):"Источник: от Саида", m?"Резерв появится после сохранения документа.":""); return; }
  if(a==="shipSave"){ const lines=[]; $("#sk-dlg").querySelectorAll(".skshq,.skshd").forEach(el=>{ const lid=el.dataset.l; let o=lines.find(x=>x.lineId===lid); if(!o){ o={lineId:lid}; lines.push(o); } o[el.classList.contains("skshq")?"qty":"direct"]=el.value.replace(",","."); });
    const j=await skDo("ship",{docId:SKS.id, lines},"Отгрузка № "+(D.journal.find(x=>x.id===SKS.id)||{}).number,"Отгрузка проведена",b); if(j) skClose(); return; }
  if(a==="closeSave"){ const r=skN(skVal(".skclr")); if(!r){ toast("err","Укажите причину",""); return; } const j=await skDo("close",{docId:SKS.id, reason:r},"Закрыть остаток","Остаток закрыт, резерв снят",b); if(j) skClose(); return; }
  if(a==="retSave"){ const L=[...$("#sk-dlg").querySelectorAll(".skretq")].filter(el=>+el.value.replace(",",".")>0); if(!L.length){ toast("err","Сколько вернуть?",""); return; }
    for(const el of L){ const j=await skDo("ret",{docId:SKS.id, lineId:el.dataset.l, qty:el.value.replace(",","."), reason:skVal(".skretr")},"Возврат","Возврат проведён",b); if(!j) return; } skClose(); return; }
});
document.addEventListener("input", e=>{ const t=e.target; if(!t.closest) return;
  if(t.id==="sk-q"){ SKV.q=t.value; SKV.shown=60; skDrawList(); return; }
  if(t.classList.contains("skf-name")){ SKIN.name=t.value; SKIN.sugOpen=true; SKIN.itemId=""; const s=$("#sk-sug"); if(s) s.innerHTML=skInSug(); return; }
  if(t.closest("#sk-dlg") && SKIN && /skf-(qty|price)/.test(t.className)){ skInRead(); const s=$("#sk-insum"); if(s) s.innerHTML=skInSum(); return; }
  if(t.classList.contains("sklq")){ SKI.linkQ=t.value; const s=t.parentNode.querySelector(".sklsug"), it=skIdx().item[SKI.id]; if(s&&it) s.innerHTML=skLinkSug(it); return; }
  if(t.classList.contains("sklq2")){ SKL.linkQ=t.value; const s=t.parentNode.querySelector(".sklsug"), l=D.draft.lines[SKL.i]; if(s&&l) s.innerHTML=skItemSug(prod(l.productId)||{}); return; }
  if(t.classList.contains("skinvf")){ SKINV.f[t.dataset.b]=t.value; const f=skFact(t.dataset.b), td=$("#sk-dlg").querySelector(`[data-d="${t.dataset.b}"]`), v=t.value.trim(); const d=v===""?null:r3(+v.replace(",",".")-f);
    if(td) td.innerHTML = d==null||isNaN(d) ? "" : d===0?`<span class="muted">0</span>`:`<b class="${d<0?"neg":"pos"}">${d>0?"+":""}${skQf(d)}</b>`; return; }
});
document.addEventListener("change", async e=>{ const t=e.target; if(!t.closest || !t.closest("#sk-dlg, #tab-stock")) return;
  if(t.name==="sksrc"){ const mx=$("#sk-dlg .skmix"); if(mx) mx.hidden=t.value!=="x"; $("#sk-dlg").querySelectorAll(".skopt").forEach(o=>o.classList.toggle("on", o.querySelector("input").checked)); return; }
  if(t.classList.contains("skinvall")){ SKINV.all=t.checked; skModalRefresh(); return; }
  if(t.tagName==="SELECT" && t.value==="__new"){ const u=skN(prompt("Новая единица измерения (например, «мешок»):")||""); if(!u){ t.value=t.options[0].value; return; }
    const known=skIdx().units.find(x=>skK(x)===skK(u)); if(known){ t.value=known; if(SKIN && t.classList.contains("skf-unit")){ skInRead(); SKIN.unit=known; skModalRefresh(); } toast("info","Такая единица уже есть","Выбрана «"+known+"»."); return; }
    try{ await skSend("unit",{name:u},"Новая единица «"+u+"»"); toast("ok","Единица «"+u+"» добавлена","Она доступна всем после синхронизации."); if(SKIN && t.classList.contains("skf-unit")){ skInRead(); SKIN.unit=u; } skModalRefresh(); }
    catch(er){ skErr(er,"единица"); t.value=t.options[0].value; } return; }
  if(t.classList.contains("skf-unit") && SKIN){ SKIN.unit=t.value; const s=$("#sk-insum"); if(s){ skInRead(); s.innerHTML=skInSum(); } }
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
  if(on){ const sh=hit.filter(j=>skDocLines(j).some(x=>x.shipped-x.ret>0)); toast(sh.length?"warn":"info", "Резерв склада снимается", sh.length?"По № "+sh.map(j=>j.number).join(", ")+" товар уже отгружен со склада — если он вернулся, проведите возврат в окне документа (до архивации).":"Товар снова свободен на складе."); } }

/* названия склада для поиска товара в документе: «шиповник» находит договорную позицию «ягоды сушёные (шиповник)» */
function skNamesOf(pid){ if(!SK_READY) return []; const it=skItemOf(pid); return it ? [it.name, ...String(it.alt||"").split(";").map(skN).filter(Boolean)] : []; }
function skPsTag(pid){ if(!SK_READY) return ""; const it=skItemOf(pid), p=prod(pid)||{}; if(!it) return ""; const free=skFreeU(it.id,p.unit);
  return `<small class="pssk">${skK(it.name)!==skK(p.name)?"склад: «"+esc(it.name)+"» · ":"на складе: "}${skQf(free,p.unit)} свободно</small>`; }
/* себестоимость строки накладной со складской частью: фактическая по отгруженным партиям, по резерву — оценка; прямая часть — по цене Саида */
function skLineCost(j, l){ if(!SK_READY || !l.stk || !l.stk.m) return null;
  const si=skLineInfo(j.id, {productId:l.pid, qty:l.qty, lid:l.lid, stk:l.stk}, l.unit); if(!si.req || !si.item) return null;
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
SK_READY=true;
