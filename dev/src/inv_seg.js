/* ================= Счета на оплату (вкладка «Счета») =================
   Отдельный счёт — например, за месяц по одному подразделению МГУ. Это НЕ накладная: не попадает в журнал,
   не уменьшает остаток контракта, не влияет на прибыль, склад и задачи.
   Хранение: лист «Счета на оплату» (Code.gs ≥ 14), строка = {id, date, number, supplierId, customerId, place, period, sum, data, updated};
   data (JSON) = {branchId, contractId, basis, from, to, docs:[id накладных], mode:"goods"|"docs", lines:[{name,unit,qty,price,pid}], note, by, at, hist, arch}.
   Печать — та же форма «Счёт на оплату» (docInvoice), реквизиты поставщика/заказчика/подразделения — текущие. */
const INV_DC = {};   /* разобранный data по строке */
function invData(r){ if(!r) return {}; const c=INV_DC[r.id]; if(c && c.raw===r.data) return c.d; let d={}; try{ d=JSON.parse(r.data||"{}")||{}; }catch(e){} INV_DC[r.id]={raw:r.data, d}; return d; }
const invRows = () => D.invoices || [];
const invCan = () => !!me() && !isStaff();
const invArch = r => !!invData(r).arch;
const invNumN = v => { const m=String(v||"").match(/(\d+)\s*$/); return m ? +m[1] : 0; };
/* следующий номер: у поставщика за год, отдельная серия счетов */
function invNext(sid, date){ const y=String(date||todayISO()).slice(0,4); let mx=0; invRows().forEach(r=>{ if(r.supplierId===sid && String(r.date).slice(0,4)===y && !invArch(r)) mx=Math.max(mx, invNumN(r.number)); }); return String(mx+1); }
const invDup = (sid, date, number, id) => invRows().some(r=>r.id!==id && !invArch(r) && r.supplierId===sid && String(r.date).slice(0,4)===String(date).slice(0,4) && String(r.number).trim()===String(number).trim());
const invPlace = (cid, bid) => { const b=branches(cus(cid)||{}).find(x=>x.id===bid); return b ? (b.label||b.fullName||"").replace(/[«»"]/g,"") : ""; };
const invPeriod = (a,b) => !a&&!b ? "" : a&&b&&a.slice(0,7)===b.slice(0,7)&&a.slice(8)==="01"&&b===invMonthEnd(a) ? invMonthName(a) : (fd(a)+" – "+fd(b));
const invMonthEnd = iso => { const d=new Date(+iso.slice(0,4), +iso.slice(5,7), 0); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const INV_MON=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const invMonthName = iso => { const m=+iso.slice(5,7)-1; return INV_MON[m].charAt(0).toUpperCase()+INV_MON[m].slice(1)+" "+iso.slice(0,4); };
const invMonth = off => { const n=new Date(); const d=new Date(n.getFullYear(), n.getMonth()-off, 1); const a=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-01"; return [a, invMonthEnd(a)]; };
/* данные для печатной формы: те же расчёты, что у документов (НДС заказчика/поставщика) */
function invK(row, d){ d=d||invData(row); const dr={supplierId:row.supplierId, customerId:row.customerId, branchId:d.branchId||"", contractId:d.contractId||"", number:String(row.number||""), date:row.date, basis:d.basis||"", lines:[]};
  const prods={}; dr.lines=(d.lines||[]).filter(x=>+x.qty>0).map((x,i)=>{ const id="inv"+i, p=x.pid?prod(x.pid):null; prods[id]={name:x.name, unit:x.unit||"", code:(p&&p.code)||"", country:(p&&p.country)||""}; return {productId:id, qty:String(x.qty), price:String(x.price), name:x.name}; });
  return calc(dr, {s:sup(row.supplierId), c:liveCus(dr), prods}); }
/* накладные, которые подходят под счёт */
function invDocs(F){ return (D.journal||[]).filter(j=>j.snap && !isArch(j) && j.customerId===F.customerId && j.supplierId===F.supplierId && (!F.branchId || (j.snap.dr.branchId||"")===F.branchId)
    && (!F.contractId || !j.snap.dr.contractId || j.snap.dr.contractId===F.contractId) && (!F.from || j.date>=F.from) && (!F.to || j.date<=F.to))
  .sort((a,b)=>String(a.date).localeCompare(String(b.date)) || jNumSort(a,b)); }
/* в каких других счетах уже есть накладная */
function invUsed(jid, except){ return invRows().filter(r=>r.id!==except && !invArch(r) && (invData(r).docs||[]).includes(jid)); }
/* строки счёта из накладных: по товарам (товар + цена) или по накладным (одна строка — одна накладная) */
function invBuild(docs, mode){
  if(mode==="docs") return docs.map(j=>{ const k=calc(j.snap.dr, j.snap); return {name:"Поставка товара по товарной накладной № "+j.number+" от "+fd(j.date)+(kLbl(j)?" ("+kLbl(j)+")":""), unit:"шт", qty:"1", price:String(k.add?k.t.net:k.t.sum), doc:j.id}; });
  const by={}, out=[];
  docs.forEach(j=>{ const k=calc(j.snap.dr, j.snap); k.lines.forEach(l=>{ const pr=k.add?l.priceNet:l.price, key=l.pid+"|"+pr+"|"+l.unit+"|"+l.name; let o=by[key];
    if(!o){ o=by[key]={name:l.name, unit:l.unit, qty:0, price:String(pr), pid:l.pid}; out.push(o); } o.qty=r3(o.qty+l.qty); }); });
  return out.map(o=>Object.assign(o,{qty:String(o.qty)})); }
const invLineSum = x => r2((+num(x.qty)||0)*(+num(x.price)||0));

/* ---------- список ---------- */
function invRowHtml(r,i){ const d=invData(r), c=cus(r.customerId)||{}, n=(d.docs||[]).length;
    return `<div class="invr" role="button" tabindex="0" data-inv="${r.id}" style="--d:${Math.min(i,12)*22}ms">
      <span class="invd"><b>№ ${esc(r.number)}</b><small>${fd(r.date)}</small></span>
      <span class="invw"><b>${esc(c.name||"заказчик удалён")}${r.place?` <em>${esc(r.place)}</em>`:""}</b><small>${[r.period, n?`${n} ${plural(n,["накладная","накладные","накладных"])}`:"без накладных", esc(sup(r.supplierId).name||"")].filter(Boolean).join(" · ")}</small></span>
      <span class="invs">${fm(+r.sum||0)} ₽</span>
      <span class="inva"><button type="button" class="btn sm" data-invp="${r.id}">Открыть счёт</button><button type="button" class="btn ghost sm" data-inve="${r.id}">Изменить</button></span></div>`; }
let INVF={q:"", cus:"", per:"", arch:false};
function renderInvoices(){ if(!invCan() || !$("#inv-list")) return;
  const old=$("#inv-old"); old.innerHTML = D.invSrv===false ? `<div class="sknoteb">Чтобы счета сохранялись в таблице и были видны всем — обновите Code.gs (версия 14). До этого создать счёт нельзя: таблица его не сохранит. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>` : "";
  $("#inv-new").disabled = D.invSrv===false;
  const cs=$("#inv-cus"), used=[...new Set(invRows().map(r=>r.customerId))];
  cs.innerHTML=`<option value="">Все заказчики</option>`+D.customers.filter(c=>used.includes(c.id)).map(c=>`<option value="${c.id}"${INVF.cus===c.id?" selected":""}>${esc(c.name)}</option>`).join("");
  $("#inv-q").value=INVF.q; $("#inv-per").value=INVF.per; $("#inv-arch").checked=INVF.arch;
  invDrawList(); }
function invFiltered(){ const q=String(INVF.q||"").toLowerCase().replace(/ё/g,"е").trim(), w=q.split(/\s+/).filter(Boolean);
  let from="", to=""; if(INVF.per==="m0") [from,to]=invMonth(0); else if(INVF.per==="m1") [from,to]=invMonth(1); else if(INVF.per==="y"){ from=todayISO().slice(0,4)+"-01-01"; to=todayISO().slice(0,4)+"-12-31"; }
  return invRows().filter(r=>invArch(r)===INVF.arch && (!INVF.cus || r.customerId===INVF.cus) && (!from || (r.date>=from && r.date<=to)) && (!w.length || (()=>{ const d=invData(r), t=[r.number, (cus(r.customerId)||{}).name, r.place, r.period, d.basis, d.note, ...(d.lines||[]).map(x=>x.name)].join(" ").toLowerCase().replace(/ё/g,"е"); return w.every(x=>t.includes(x)); })()))
    .sort((a,b)=>String(b.date).localeCompare(String(a.date)) || invNumN(b.number)-invNumN(a.number)); }
function invDrawList(){ const L=invFiltered(), box=$("#inv-list"); if(!box) return; const tot=r2(L.reduce((a,r)=>a+(+r.sum||0),0));
  $("#inv-sum").textContent = L.length ? `Найдено: ${L.length} ${plural(L.length,["счёт","счёта","счетов"])} на ${fm(tot)} ₽` : "";
  if(!L.length){ box.innerHTML=`<div class="skempty"><b>${invRows().length?"Ничего не найдено":"Счетов пока нет"}</b><span>${invRows().length?"Измените поиск или фильтры.":"Нажмите «+ Новый счёт»: выберите заказчика, подразделение и месяц — сайт сам соберёт накладные."}</span></div>`; return; }
  box.innerHTML=`<div class="invl">${L.map(invRowHtml).join("")}</div>`;
  box.querySelector(".invl").classList.add("pgfade"); }
document.addEventListener("input", e=>{ if(e.target.id==="inv-q"){ INVF.q=e.target.value; invDrawList(); } });
document.addEventListener("change", e=>{ const id=e.target.id; if(id==="inv-cus"){ INVF.cus=e.target.value; invDrawList(); } else if(id==="inv-per"){ INVF.per=e.target.value; invDrawList(); } else if(id==="inv-arch"){ INVF.arch=e.target.checked; invDrawList(); } });
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest) return;
  if(t.closest("#inv-new")){ invEdit(null); return; }
  const p=t.closest("[data-invp]"); if(p){ e.stopPropagation(); invPreview(p.dataset.invp); return; }
  const ed=t.closest("[data-inve]"); if(ed){ e.stopPropagation(); invEdit(ed.dataset.inve); return; }
  if(t.closest("#inv-new2")){ invEdit(null); return; }
  if(t.closest("#inv-all")){ invAll(); return; }
  const r=t.closest("#inv-list [data-inv], #inv-dc [data-inv]"); if(r){ invCard(r.dataset.inv); return; } });
document.addEventListener("keydown", e=>{ const r=e.target; if(r.classList && r.classList.contains("invr") && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); invCard(r.dataset.inv); } });

function invPreview(id){ const r=invRows().find(x=>x.id===id); if(!r) return; showPreview("invoice", invK(r)); }
/* карточка счёта */
function invCard(id){ const r=invRows().find(x=>x.id===id); if(!r) return; const d=invData(r), c=cus(r.customerId)||{}, ar=!!d.arch;
  const docs=(d.docs||[]).map(x=>D.journal.find(j=>j.id===x)).filter(Boolean);
  const info=[["Поставщик",sup(r.supplierId).name||""],["Заказчик",(c.name||"")+(r.place?", "+r.place:"")],["Период",r.period||""],["Основание",d.basis||""],["Комментарий",d.note||""],["Создал",(d.by||"")+(d.at?" · "+dtShort(d.at):"")]].filter(x=>x[1]);
  CARD_RE=()=>{ if(invRows().some(x=>x.id===id)) invCard(id); };
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Счёт на оплату${ar?" · в архиве":""}</div><h3>№ ${esc(r.number)} от ${fd(r.date)}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <dl class="dc-info">${info.map(([a,b])=>`<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>
    <div class="dc-tw"><table class="dc-t"><thead><tr><th>Товар</th><th class="num">Кол-во</th><th class="num">Цена, ₽</th><th class="num">Сумма, ₽</th></tr></thead><tbody>${(d.lines||[]).map(x=>`<tr><td><b>${esc(x.name)}</b></td><td class="num">${esc(nq3(+num(x.qty)||0))}&nbsp;${esc(x.unit||"")}</td><td class="num">${fm(+num(x.price)||0)}</td><td class="num"><b>${fm(invLineSum(x))}</b></td></tr>`).join("")}</tbody></table></div>
    <div class="dc-total"><span>${(d.lines||[]).length} ${posWord((d.lines||[]).length)}</span><b>${fm(+r.sum||0)} ₽</b></div>
    ${docs.length?`<div class="invdocs"><b>Накладные в счёте</b><div>${docs.map(j=>`<button type="button" class="invdc" data-dc="doc" data-id="${j.id}">№ ${esc(j.number)} · ${fd(j.date)} · ${fm(j.sum)} ₽</button>`).join("")}</div></div>`:""}
    ${histHtml((d.hist||[]).map(x=>Object.assign({},x)))}
    <div class="dc-acts">${ar?`<button class="btn" data-dc="unarch">Вернуть из архива</button>`:`<button class="btn ghost danger" data-dc="arch">В архив</button><button class="btn" data-dc="copy">Сделать копию</button><button class="btn" data-dc="edit">Изменить</button>`}<button class="btn pri" data-dc="open">Открыть счёт</button></div>`, true, (a,b)=>{
    if(a==="open"){ invPreview(id); return; }
    if(a==="edit"){ invEdit(id); return; }
    if(a==="copy"){ invEdit(id, true); return; }
    if(a==="doc"){ const j=D.journal.find(x=>x.id===b.dataset.id); if(j) docCard(j, isArch(j)); return; }
    if(a==="arch"||a==="unarch"){ invSetArch(id, a==="arch"); if(NAV.st.length) navBack(); } }); }   /* из списка — вернуться в список */
function invHist(d, w){ const h=Array.isArray(d.hist)?d.hist.slice(-29):[]; h.push({at:new Date().toISOString(), by:curUser()||"", w}); d.hist=h; }
function invSetArch(id, on){ const r=invRows().find(x=>x.id===id); if(!r) return; const d=Object.assign({}, invData(r));
  if(on) d.arch=new Date().toISOString(); else delete d.arch; invHist(d, [on?"в архив":"возвращён из архива"]);
  r.data=JSON.stringify(d); r.updated=new Date().toISOString(); dirty("invoices", r.id); saveLocal();
  toast(on?"info":"ok", on?"Счёт убран в архив":"Счёт возвращён", "№ "+r.number+" от "+fd(r.date)+".", on?{action:{label:"Вернуть", fn:()=>invSetArch(id,false)}}:{});
  invViews(); }

/* ---------- создание и правка ---------- */
let INV=null;
function invEdit(id, copy){ if(!invCan()) return; if(D.invSrv===false){ toast("warn","Сначала обновите Code.gs","Без нового скрипта таблица не сохранит счёт."); return; }
  const r=id?invRows().find(x=>x.id===id):null;
  if(r){ const d=invData(r); INV={id:copy?"":r.id, supplierId:r.supplierId, customerId:r.customerId, branchId:d.branchId||"", contractId:d.contractId||"", from:d.from||"", to:d.to||"", docs:new Set(copy?[]:(d.docs||[])), mode:d.mode||"goods",
      lines:copy?[]:(d.lines||[]).map(x=>Object.assign({},x)), touched:!copy, number:copy?"":String(r.number), date:copy?todayISO():r.date, basis:d.basis||"", note:copy?"":(d.note||""), numAuto:!!copy, dirty:false};
    if(copy){ INV.docs=new Set(invDocs(INV).filter(j=>!invUsed(j.id).length).map(j=>j.id)); INV.lines=invBuild(invDocs(INV).filter(j=>INV.docs.has(j.id)), INV.mode); INV.number=invNext(INV.supplierId, INV.date); } }
  else { const [a,b]=invMonth(new Date().getDate()<=10?1:0); INV={id:"", supplierId:"", customerId:"", branchId:"", contractId:"", from:a, to:b, docs:new Set(), mode:"goods", lines:[], touched:false, number:"", date:b<todayISO()?b:todayISO(), basis:"", note:"", numAuto:true, dateAuto:true, dirty:false}; }
  invOpen(); }
/* заказчик выбран: поставщик и договор — как в последней накладной */
function invPickCus(cid){ INV.customerId=cid; INV.branchId=""; const last=(D.journal||[]).filter(j=>j.snap && !isArch(j) && j.customerId===cid).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  INV.supplierId = last ? last.supplierId : (INV.supplierId || (D.suppliers[0]||{}).id || "");
  invPickCtr(last && last.snap.dr.contractId && ctr(last.snap.dr.contractId) ? last.snap.dr.contractId : ((D.contracts||[]).find(x=>x.customerId===cid && (!x.supplierId || x.supplierId===INV.supplierId))||{}).id || ""); }
function invPickCtr(id){ INV.contractId=id||""; const x=ctr(INV.contractId); INV.basis = x ? (x.basis||"") : (INV.basis||""); }
function invRefresh(){ /* пересобрать список накладных; если строки не правили руками — пересобрать и строки */
  const L=invDocs(INV); INV.docs=new Set(L.filter(j=>!invUsed(j.id, INV.id).length).map(j=>j.id));
  if(!INV.touched) INV.lines=invBuild(L.filter(j=>INV.docs.has(j.id)), INV.mode);
  if(INV.numAuto && INV.supplierId) INV.number=invNext(INV.supplierId, INV.date); }
function invOpen(){ let d=document.getElementById("inv-dlg"); if(d) d.remove();
  d=document.createElement("dialog"); d.id="inv-dlg"; d.className="dcard wide invdlg"; document.getElementById("fd-app").appendChild(d);
  d.addEventListener("cancel", e=>{ e.preventDefault(); invClose(); });
  d.addEventListener("click", e=>{ if(e.target===d){ const r=d.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) invClose(); } });
  invDraw(); d.showModal(); requestAnimationFrame(()=>d.classList.add("in")); }
function invClose(force){ const d=document.getElementById("inv-dlg"); if(!d) return;
  if(!force && INV && INV.dirty && !confirm("Закрыть без сохранения? Изменения в счёте пропадут.")) return;
  d.classList.add("out"); setTimeout(()=>{ try{ d.close(); }catch(x){} d.remove(); }, matchMedia("(prefers-reduced-motion: reduce)").matches?0:200); }
function invTotal(){ return r2(INV.lines.reduce((a,x)=>a+invLineSum(x),0)); }
function invDraw(keepFocus){ const d=document.getElementById("inv-dlg"); if(!d||!INV) return; const F=INV, st=d.scrollTop;
  const c=cus(F.customerId), br=c?branches(c):[], ctrs=(D.contracts||[]).filter(x=>x.customerId===F.customerId && (!x.supplierId || x.supplierId===F.supplierId));
  const L=F.customerId&&F.supplierId?invDocs(F):[], selSum=r2(L.filter(j=>F.docs.has(j.id)).reduce((a,j)=>a+(+j.sum||0),0)), tot=invTotal(), dup=F.number&&F.supplierId&&invDup(F.supplierId, F.date, F.number, F.id);
  const mon=[invMonth(1), invMonth(0)], chip=(m,t)=>`<button type="button" class="${F.from===m[0]&&F.to===m[1]?"on":""}" data-invm="${m[0]}|${m[1]}">${t}</button>`;
  d.innerHTML=`<div class="dc-head"><div><div class="dc-kicker">Счёт на оплату</div><h3>${F.id?"Изменить счёт № "+esc(F.number):"Новый счёт"}</h3><p class="muted invsub">На сумму контракта и журнал не влияет — это только счёт.</p></div><button class="dc-x" data-invx aria-label="Закрыть">×</button></div>
    <div class="invg">
      <label class="f">Заказчик<select class="invi" data-f="customerId"><option value="">— выберите —</option>${D.customers.filter(x=>!isPriv(x.id)).map(x=>`<option value="${x.id}"${x.id===F.customerId?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label class="f">Подразделение / ОП<select class="invi" data-f="branchId"${br.length?"":" disabled"}><option value="">${br.length?"Все подразделения":"— у заказчика нет подразделений —"}</option>${br.map(b=>`<option value="${b.id}"${b.id===F.branchId?" selected":""}>${esc(b.label||b.fullName||"")}${b.kpp?" · КПП "+esc(b.kpp):""}</option>`).join("")}</select></label>
      <label class="f">Поставщик<select class="invi" data-f="supplierId">${D.suppliers.map(x=>`<option value="${x.id}"${x.id===F.supplierId?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label class="f">Договор<select class="invi" data-f="contractId"><option value="">— без договора —</option>${ctrs.map(x=>`<option value="${x.id}"${x.id===F.contractId?" selected":""}>${esc(x.basis||"")}</option>`).join("")}</select></label>
    </div>
    <div class="invper"><span class="lbl">Период</span><div class="pfchips">${chip(mon[0], invMonthName(mon[0][0]))}${chip(mon[1], invMonthName(mon[1][0]))}</div><label class="f">с<input type="date" class="invi" data-f="from" value="${esc(F.from)}"></label><label class="f">по<input type="date" class="invi" data-f="to" value="${esc(F.to)}"></label></div>
    <div class="invbox"><div class="invbh"><b>Накладные за период</b>${L.length?`<span class="muted">выбрано ${L.filter(j=>F.docs.has(j.id)).length} из ${L.length} · ${fm(selSum)} ₽</span><button type="button" class="btn ghost sm" data-invall="${L.every(j=>F.docs.has(j.id))?"0":"1"}">${L.every(j=>F.docs.has(j.id))?"Снять все":"Выбрать все"}</button>`:""}</div>
      ${!F.customerId?`<p class="muted">Выберите заказчика — сайт покажет его накладные за период.</p>`:!L.length?`<p class="muted">Накладных за этот период нет${F.branchId?" по этому подразделению":""}. Можно добавить строки счёта вручную ниже.</p>`:
      `<div class="invdl">${L.map(j=>{ const u=invUsed(j.id, F.id); return `<label class="invdr${F.docs.has(j.id)?" on":""}"><input type="checkbox" data-invd="${j.id}"${F.docs.has(j.id)?" checked":""}><span><b>№ ${esc(j.number)} · ${fd(j.date)}</b><small>${esc(kLbl(j)||jWho(j).main)}${u.length?` · <em class="miss">уже в счёте № ${esc(u.map(x=>x.number).join(", "))}</em>`:""}</small></span><i>${fm(j.sum)} ₽</i></label>`; }).join("")}</div>`}
    </div>
    <div class="invbox"><div class="invbh"><b>Строки счёта</b><div class="pfchips invmode"><button type="button" class="${F.mode==="goods"?"on":""}" data-invmode="goods">По товарам</button><button type="button" class="${F.mode==="docs"?"on":""}" data-invmode="docs">По накладным</button></div>${F.touched?`<button type="button" class="btn ghost sm" data-invrb>Пересобрать из накладных</button>`:""}</div>
      ${F.touched?`<p class="muted invnote">Строки изменены вручную — выбор накладных их больше не меняет. «Пересобрать» вернёт строки из выбранных накладных.</p>`:""}
      <div class="invlh"><span>Наименование</span><span>Кол-во</span><span>Ед.</span><span>Цена, ₽</span><span>Сумма, ₽</span><span></span></div>
      <div class="invls">${F.lines.map((x,i)=>`<div class="invln" data-i="${i}"><input class="invli" data-k="name" value="${esc(x.name)}" placeholder="Наименование" aria-label="Наименование"><input class="invli num" data-k="qty" inputmode="decimal" value="${esc(String(x.qty).replace(".",","))}" aria-label="Количество"><input class="invli" data-k="unit" value="${esc(x.unit||"")}" aria-label="Единица"><input class="invli num" data-k="price" inputmode="decimal" value="${esc(String(x.price).replace(".",","))}" aria-label="Цена"><b class="invlsum">${fm(invLineSum(x))}</b><button type="button" class="invdel" data-invdel="${i}" aria-label="Удалить строку">×</button></div>`).join("")||`<p class="muted">Строк нет.</p>`}</div>
      <button type="button" class="btn ghost sm" data-invadd>+ Строка вручную</button>
    </div>
    <div class="invg inv3">
      <label class="f">Номер счёта<input class="invi${dup?" bad":""}" data-f="number" value="${esc(F.number)}"><small class="${dup?"miss":"muted"}">${dup?"Такой номер у поставщика в этом году уже есть":"своя нумерация счетов у поставщика"}</small></label>
      <label class="f">Дата счёта<input type="date" class="invi" data-f="date" value="${esc(F.date)}"></label>
      <label class="f wide">Основание<input class="invi" data-f="basis" value="${esc(F.basis)}" placeholder="Договор № … от …"></label>
      <label class="f wide">Комментарий <small class="muted">(в счёт не печатается)</small><input class="invi" data-f="note" value="${esc(F.note)}" placeholder="например: отправлено бухгалтеру ОП 01.12"></label>
    </div>
    <div class="invfoot"><div><small class="muted">Итого к оплате</small><b id="inv-tot">${fm(tot)} ₽</b>${L.length&&!F.touched&&Math.abs(tot-selSum)>0.004?`<small class="miss">не равно сумме накладных (${fm(selSum)} ₽)</small>`:""}</div>
      <div class="row"><button type="button" class="btn" data-invx>Отмена</button><button type="button" class="btn" data-invsave="0">Сохранить</button><button type="button" class="btn pri" data-invsave="1">Сохранить и открыть счёт</button></div></div>`;
  d.scrollTop=st; if(keepFocus){ const f=d.querySelector(keepFocus); if(f){ f.focus(); try{ const n=f.value.length; f.setSelectionRange&&f.setSelectionRange(n,n); }catch(x){} } } }
document.addEventListener("change", e=>{ const el=e.target; if(!INV || !el.closest || !el.closest("#inv-dlg")) return;
  if(el.classList.contains("invi")){ const f=el.dataset.f, v=el.value; INV.dirty=true;
    if(f==="customerId"){ invPickCus(v); invRefresh(); invDraw(); return; }
    if(f==="supplierId"){ INV.supplierId=v; if(INV.contractId && ctr(INV.contractId) && ctr(INV.contractId).supplierId && ctr(INV.contractId).supplierId!==v) invPickCtr(""); invRefresh(); invDraw(); return; }
    if(f==="branchId"||f==="contractId"||f==="from"||f==="to"){ if(f==="contractId") invPickCtr(v); else INV[f]=v; if(INV.from&&INV.to&&INV.from>INV.to){ toast("warn","Период задом наперёд","«С» позже, чем «по»."); }
      if((f==="to") && INV.dateAuto) INV.date = INV.to && INV.to<todayISO() ? INV.to : todayISO(); invRefresh(); invDraw(); return; }
    if(f==="date"){ INV.date=v; INV.dateAuto=false; if(INV.numAuto && INV.supplierId) INV.number=invNext(INV.supplierId, v); invDraw(); return; }
    return; }
  const cb=el.closest("[data-invd]"); if(cb){ INV.dirty=true; if(el.checked) INV.docs.add(el.dataset.invd); else INV.docs.delete(el.dataset.invd); if(!INV.touched) INV.lines=invBuild(invDocs(INV).filter(j=>INV.docs.has(j.id)), INV.mode); invDraw(); } });
document.addEventListener("input", e=>{ const el=e.target; if(!INV || !el.closest || !el.closest("#inv-dlg")) return;
  if(el.classList.contains("invi")){ const f=el.dataset.f; if(["number","basis","note"].includes(f)){ INV[f]=el.value; INV.dirty=true; if(f==="number"){ INV.numAuto=false; const dup=invDup(INV.supplierId, INV.date, INV.number, INV.id), s=el.parentElement.querySelector("small"); el.classList.toggle("bad", !!dup); if(s){ s.className=dup?"miss":"muted"; s.textContent=dup?"Такой номер у поставщика в этом году уже есть":"своя нумерация счетов у поставщика"; } } } return; }
  if(el.classList.contains("invli")){ const i=+el.closest(".invln").dataset.i, x=INV.lines[i]; if(!x) return; x[el.dataset.k]=el.value; INV.touched=true; INV.dirty=true;
    const s=el.closest(".invln").querySelector(".invlsum"); if(s) s.textContent=fm(invLineSum(x)); const t=$("#inv-tot"); if(t) t.textContent=fm(invTotal())+" ₽";
    if(!document.querySelector("#inv-dlg [data-invrb]")){ const h=document.querySelector("#inv-dlg .invmode"); if(h) h.insertAdjacentHTML("afterend",`<button type="button" class="btn ghost sm" data-invrb>Пересобрать из накладных</button>`); } } });
document.addEventListener("click", async e=>{ const t=e.target; if(!INV || !t.closest || !t.closest("#inv-dlg")) return;
  if(t.closest("[data-invx]")){ invClose(); return; }
  const m=t.closest("[data-invm]"); if(m){ const [a,b]=m.dataset.invm.split("|"); INV.from=a; INV.to=b; INV.dirty=true; if(INV.dateAuto) INV.date=b<todayISO()?b:todayISO(); invRefresh(); invDraw(); return; }
  const all=t.closest("[data-invall]"); if(all){ const L=invDocs(INV); L.forEach(j=>{ if(all.dataset.invall==="1") INV.docs.add(j.id); else INV.docs.delete(j.id); }); INV.dirty=true; if(!INV.touched) INV.lines=invBuild(L.filter(j=>INV.docs.has(j.id)), INV.mode); invDraw(); return; }
  const md=t.closest("[data-invmode]"); if(md){ if(INV.mode===md.dataset.invmode) return; if(INV.touched && !confirm("Строки изменены вручную. Пересобрать их из накладных по-новому?")) return; INV.mode=md.dataset.invmode; INV.touched=false; INV.dirty=true; INV.lines=invBuild(invDocs(INV).filter(j=>INV.docs.has(j.id)), INV.mode); invDraw(); return; }
  if(t.closest("[data-invrb]")){ INV.touched=false; INV.dirty=true; INV.lines=invBuild(invDocs(INV).filter(j=>INV.docs.has(j.id)), INV.mode); invDraw(); toast("info","Строки собраны из накладных",""); return; }
  if(t.closest("[data-invadd]")){ INV.lines.push({name:"", unit:"шт", qty:"1", price:""}); INV.touched=true; INV.dirty=true; invDraw(`.invln[data-i="${INV.lines.length-1}"] [data-k="name"]`); return; }
  const dl=t.closest("[data-invdel]"); if(dl){ const i=+dl.dataset.invdel, x=INV.lines.splice(i,1)[0]; INV.touched=true; INV.dirty=true; const row=dl.closest(".invln"); if(row && row.animate && !matchMedia("(prefers-reduced-motion: reduce)").matches){ row.animate([{opacity:1,transform:"none"},{opacity:0,transform:"translateX(12px)"}],{duration:160,easing:"ease-in"}).onfinish=()=>invDraw(); } else invDraw(); if(x&&x.name) toast("info","Строка удалена","«"+x.name+"»",{action:{label:"Вернуть", fn:()=>{ if(!INV) return; INV.lines.splice(Math.min(i,INV.lines.length),0,x); invDraw(); }}}); return; }
  const sv=t.closest("[data-invsave]"); if(sv){ invSave(sv.dataset.invsave==="1"); } });
document.addEventListener("keydown", e=>{ if(e.key!=="Enter" || !INV || !e.target.classList || !e.target.classList.contains("invli")) return; e.preventDefault(); const row=e.target.closest(".invln"), i=+row.dataset.i, k=e.target.dataset.k;
  if(i===INV.lines.length-1){ document.querySelector("#inv-dlg [data-invadd]").click(); } else { const n=document.querySelector(`#inv-dlg .invln[data-i="${i+1}"] [data-k="${k}"]`); if(n) n.focus(); } });
function invSave(open){ const F=INV, lines=F.lines.map(x=>({name:String(x.name||"").trim(), unit:String(x.unit||"").trim(), qty:num(x.qty), price:num(x.price), pid:x.pid||undefined, doc:x.doc||undefined})).filter(x=>x.name||+x.qty||+x.price);
  const bad=[]; if(!F.customerId) bad.push("заказчик"); if(!F.supplierId) bad.push("поставщик"); if(!String(F.number).trim()) bad.push("номер счёта"); if(!F.date) bad.push("дата");
  if(!lines.length) bad.push("строки счёта");
  const lb=lines.findIndex(x=>!x.name || !(+x.qty>0) || isNaN(+x.price) || +x.price<0); if(lb>=0) bad.push("строка "+(lb+1)+": название, количество больше 0 и цена");
  if(bad.length){ toast("err","Заполните: "+bad.join(", "),""); return; }
  if(invDup(F.supplierId, F.date, F.number, F.id) && !confirm("Счёт № "+F.number+" у этого поставщика в "+String(F.date).slice(0,4)+" году уже есть. Сохранить с тем же номером?")) return;
  const old=F.id?invRows().find(x=>x.id===F.id):null, od=old?invData(old):{}, d=Object.assign({}, od, {branchId:F.branchId, contractId:F.contractId, basis:String(F.basis||"").trim(), from:F.from, to:F.to, docs:[...F.docs].filter(id=>invDocs(F).some(j=>j.id===id)), mode:F.mode, lines:lines.map(x=>{ const o={name:x.name, unit:x.unit, qty:String(+x.qty), price:String(+x.price)}; if(x.pid) o.pid=x.pid; if(x.doc) o.doc=x.doc; return o; }), note:String(F.note||"").trim()});
  if(!old){ d.by=curUser()||""; d.at=new Date().toISOString(); }
  const row={id:F.id||("inv"+uid()+uid()), date:F.date, number:String(F.number).trim(), supplierId:F.supplierId, customerId:F.customerId, place:invPlace(F.customerId, F.branchId), period:invPeriod(F.from, F.to), sum:"", data:"", updated:new Date().toISOString()};
  row.sum=String(invK(row, d).t.sum);
  if(old){ const w=[]; if(String(old.number)!==row.number) w.push("номер "+old.number+" → "+row.number); if(old.date!==row.date) w.push("дата "+fd(old.date)+" → "+fd(row.date)); if(String(+old.sum)!==String(+row.sum)) w.push("сумма "+fm(+old.sum)+" → "+fm(+row.sum)+" ₽"); if((od.docs||[]).join()!==d.docs.join()) w.push("накладные: "+d.docs.length); if(!w.length) w.push("изменён"); invHist(d, w); }
  else invHist(d, ["создан"]);
  row.data=JSON.stringify(d);
  D.invoices=D.invoices||[]; const i=D.invoices.findIndex(x=>x.id===row.id); if(i>=0) D.invoices[i]=Object.assign(D.invoices[i], row); else D.invoices.push(row);
  dirty("invoices", row.id); saveLocal(); INV.dirty=false; invClose(true);
  toast("ok", old?"Счёт изменён":"Счёт сохранён", "№ "+row.number+" от "+fd(row.date)+" · "+fm(+row.sum)+" ₽"+(row.place?" · "+row.place:"")+".");
  invViews(); if(open) setTimeout(()=>invPreview(row.id), 220); }
window.__inv = { rows:()=>invRows(), edit:invEdit, st:()=>INV };

/* ---------- счета живут во вкладке «Новый документ»: блок внизу + окно «Все счета» (вкладки «Счета» больше нет) ---------- */
function invViews(){ invDocCard(); if($("#inv-list")) renderInvoices(); }
function invDocCard(){ const box=$("#inv-dc"); if(!box) return; box.hidden=!invCan(); if(box.hidden) return;
  const live=invRows().filter(r=>!invArch(r)).sort((a,b)=>String(b.date).localeCompare(String(a.date)) || invNumN(b.number)-invNumN(a.number)), n=live.length;
  box.innerHTML=`<div class="invh"><div><h2>Отдельный счёт на оплату</h2><p class="muted">За месяц или период, по подразделению — сайт сам соберёт накладные. Это не новая накладная: на контракт, журнал и прибыль не влияет.</p></div>
    <div class="invbtn"><button class="btn" type="button" id="inv-all">Все счета${n?` <span class="invn">${n}</span>`:""}</button><button class="btn pri" type="button" id="inv-new2"${D.invSrv===false?" disabled":""}>+ Отдельный счёт</button></div></div>
    ${D.invSrv===false?`<div class="sknoteb" style="margin-top:10px">Чтобы счета сохранялись в таблице и были видны всем — обновите Code.gs (версия 14). <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`:""}
    ${n?`<div class="invmini"><div class="invmh">Последние счета</div><div class="invl">${live.slice(0,3).map(invRowHtml).join("")}</div></div>`:""}`; }
function invAll(){ if(!invCan()) return; CARD_RE=()=>invAll();
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Счета на оплату</div><h3>Все отдельные счета</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="invh invh2"><p class="muted">Например, за месяц по каждому подразделению. На сумму контракта, журнал и прибыль не влияют.</p><button class="btn pri" type="button" id="inv-new">+ Новый счёт</button></div>
    <div id="inv-old"></div>
    <div class="invf"><input id="inv-q" type="search" placeholder="Поиск: номер, заказчик, подразделение, товар" aria-label="Поиск счетов"><select id="inv-cus" aria-label="Заказчик"></select><select id="inv-per" aria-label="Период"><option value="">Всё время</option><option value="m0">Этот месяц</option><option value="m1">Прошлый месяц</option><option value="y">Этот год</option></select><label class="invarch"><input type="checkbox" id="inv-arch"> Архив</label></div>
    <div id="inv-sum" class="muted"></div>
    <div id="inv-list"></div>`, true, ()=>{});
  const d=$("#fd-dcard"); if(d) d.classList.add("xwide"); renderInvoices(); }
