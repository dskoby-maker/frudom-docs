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
      <span class="invw"><b>${esc(cusNm(r.customerId)||"заказчик удалён")}${r.place?` <em>${esc(r.place)}</em>`:""}</b><small>${[r.period, n?`${n} ${plural(n,["накладная","накладные","накладных"])}`:"без накладных", esc(sup(r.supplierId).name||"")].filter(Boolean).join(" · ")}${invPayChip(r)}</small></span>
      <span class="invs">${fm(+r.sum||0)} ₽</span>
      <span class="inva"><button type="button" class="btn sm" data-invp="${r.id}">Открыть счёт</button><button type="button" class="btn ghost sm" data-inve="${r.id}">Изменить</button></span></div>`; }
let INVF={q:"", cus:"", per:"", arch:false};
function renderInvoices(){ if(!invCan() || !$("#inv-list")) return;
  const old=$("#inv-old"); old.innerHTML = D.invSrv===false ? `<div class="sknoteb">Чтобы счета сохранялись в таблице и были видны всем — обновите Code.gs (версия 14). До этого создать счёт нельзя: таблица его не сохранит. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>` : "";
  $("#inv-new").disabled = D.invSrv===false;
  const cs=$("#inv-cus"), used=[...new Set(invRows().map(r=>r.customerId))];
  cs.innerHTML=`<option value="">Все заказчики</option>`+opts(D.customers.filter(c=>used.includes(c.id)), INVF.cus);
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
  if(t.closest("#inv-new2")){ if(INV && !INV.id && document.getElementById("inv-wrap")){ invOpen(true); return; } invEdit(null); return; }
  if(t.closest("#inv-all")){ invAll(); return; }
  const r=t.closest("#inv-list [data-inv], #inv-dc [data-inv]"); if(r){ invCard(r.dataset.inv); return; } });
document.addEventListener("keydown", e=>{ const r=e.target; if(r.classList && r.classList.contains("invr") && (e.key==="Enter"||e.key===" ")){ e.preventDefault(); invCard(r.dataset.inv); } });

function invPreview(id){ const r=invRows().find(x=>x.id===id); if(!r) return; showPreview("invoice", invK(r)); }
/* карточка счёта */
function invCard(id){ const r=invRows().find(x=>x.id===id); if(!r) return; const d=invData(r), c=cus(r.customerId)||{}, ar=!!d.arch;
  const docs=(d.docs||[]).map(x=>D.journal.find(j=>j.id===x)).filter(Boolean);
  const info=[["Поставщик",sup(r.supplierId).name||""],["Заказчик",(cusNm(r.customerId)||"")+(r.place?", "+r.place:"")],["Период",r.period||""],["Основание",d.basis||""],["Комментарий",d.note||""],["Создал",(d.by||"")+(d.at?" · "+dtShort(d.at):"")]].filter(x=>x[1]);
  CARD_RE=()=>{ if(invRows().some(x=>x.id===id)) invCard(id); };
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Счёт на оплату${ar?" · в архиве":""}</div><h3>№ ${esc(r.number)} от ${fd(r.date)}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <dl class="dc-info">${info.map(([a,b])=>`<div><dt>${a}</dt><dd>${esc(b)}</dd></div>`).join("")}</dl>
    <div class="dc-tw"><table class="dc-t"><thead><tr><th>Товар</th><th class="num">Кол-во</th><th class="num">Цена, ₽</th><th class="num">Сумма, ₽</th></tr></thead><tbody>${(d.lines||[]).map(x=>`<tr><td><b>${esc(x.name)}</b></td><td class="num">${esc(nq3(+num(x.qty)||0))}&nbsp;${esc(x.unit||"")}</td><td class="num">${fm(+num(x.price)||0)}</td><td class="num"><b>${fm(invLineSum(x))}</b></td></tr>`).join("")}</tbody></table></div>
    <div class="dc-total"><span>${(d.lines||[]).length} ${posWord((d.lines||[]).length)}</span><b>${fm(+r.sum||0)} ₽</b></div>
    ${invPayHtml(r, docs)}
    ${docs.length?`<div class="invdocs"><b>Накладные в счёте</b><div>${docs.map(j=>{ const p=invPayOk()?payOf(j):null; return `<button type="button" class="invdc${p?" "+p.st:""}" data-dc="doc" data-id="${j.id}"${p&&p.st!=="due"?` title="${p.st==="paid"?"Оплачена":"Оплачено "+fm(p.s)+" из "+fm(p.tot)+" ₽"}${p.d?" · "+fd(p.d):""}"`:""}>${p&&p.st==="paid"?"✓ ":""}№ ${esc(j.number)} · ${fd(j.date)} · ${fm(j.sum)} ₽</button>`; }).join("")}</div></div>`:""}
    ${histHtml((d.hist||[]).map(x=>Object.assign({},x)))}
    <div class="dc-acts">${ar?`<button class="btn" data-dc="unarch">Вернуть из архива</button>`:`<button class="btn ghost danger" data-dc="arch">В архив</button><button class="btn" data-dc="copy">Сделать копию</button><button class="btn" data-dc="edit">Изменить</button>`}<button class="btn pri" data-dc="open">Открыть счёт</button></div>`, true, (a,b)=>{
    if(a==="open"){ invPreview(id); return; }
    if(a==="edit"){ invEdit(id); return; }
    if(a==="copy"){ invEdit(id, true); return; }
    if(a==="doc"){ const j=D.journal.find(x=>x.id===b.dataset.id); if(j) docCard(j, isArch(j)); return; }
    if(a==="pay"){ const s=+num($("#invpay-sum").value)||0, dt=$("#invpay-date").value||todayISO(); if(s<=0){ toast("warn","Впишите сумму оплаты",""); return; } invPay(id, s, dt); return; }
    if(a==="unpay"){ invUnpay(id); return; }
    if(a==="arch"||a==="unarch"){ invSetArch(id, a==="arch"); if(NAV.st.length) navBack(); } }); }   /* из списка — вернуться в список */
/* ---------- оплата по счёту: отметка «оплачено» ложится на все накладные счёта (с самой старой) ----------
   Оплата хранится у накладных (lines._pay в «Себестоимости накладных», как в «Прибыли»); статус счёта считается из них.
   Только admin: данные оплат приходят вместе с «Прибылью» (loadProfit). */
const invPayOk = () => !!(me()&&me().admin) && pfLoaded;
const invDocsOf = r => (invData(r).docs||[]).map(x=>D.journal.find(j=>j.id===x)).filter(j=>j && j.snap && !isArch(j)).sort((a,b)=>String(a.date).localeCompare(String(b.date))||jNumSort(a,b));
function invPayState(r, docs){ docs=docs||invDocsOf(r); let tot=0, s=0, k=0, last="";
  docs.forEach(j=>{ const p=payOf(j); tot+=p.tot; s+=p.s; if(p.st==="paid") k++; if(p.d>last) last=p.d; });
  tot=r2(tot); s=r2(s); return {n:docs.length, k, tot, s, left:r2(tot-s), last, st: !docs.length ? "" : s>=tot-0.005 ? "paid" : s>0 ? "part" : "due"}; }
function invPayChip(r){ if(!invPayOk() || invArch(r)) return ""; const p=invPayState(r); if(!p.st) return "";
  return ` <i class="invps ${p.st}">${p.st==="paid"?"оплачен"+(p.last?" "+fd(p.last).slice(0,5):""):p.st==="part"?"оплачен частично":"не оплачен"}</i>`; }
function invPayHtml(r, docs){ if(!(me()&&me().admin)) return "";
  if(!pfLoaded){ loadProfit(true).then(()=>{ const c=$("#fd-dcard"); if(pfLoaded && c && c.open && c.querySelector(`[data-invcard="${r.id}"]`)) invCard(r.id); }); return `<div class="invpay" data-invcard="${r.id}"><span class="muted">Загружаю оплаты…</span></div>`; }
  const L=invDocsOf(r); if(!L.length) return `<div class="invpay" data-invcard="${r.id}"><span class="muted">В счёте нет накладных — отмечайте оплату у самих накладных в «Прибыли».</span></div>`;
  const p=invPayState(r, L), pc=p.tot>0?Math.round(p.s/p.tot*100):100, diff=Math.abs(r2((+r.sum||0)-p.tot))>0.005;
  return `<div class="invpay ${p.st}" data-invcard="${r.id}">
    <div class="invpay-h"><b>Оплата по счёту</b><i class="invps ${p.st}">${p.st==="paid"?"Оплачен":p.st==="part"?"Частично":"Не оплачен"}</i></div>
    <div class="invpay-bar"><span style="width:${pc}%"></span></div>
    <div class="invpay-t">Оплачено <b>${p.k} из ${p.n}</b> ${plural(p.n,["накладной","накладных","накладных"])} · <b>${fm(p.s)}</b> из ${fm(p.tot)} ₽${p.left>0.005?` · осталось <b>${fm(p.left)} ₽</b>`:""}</div>
    ${diff?`<div class="invpay-n">Сумма счёта ${fm(+r.sum||0)} ₽ не равна сумме накладных ${fm(p.tot)} ₽ (строки счёта правили вручную) — оплата ложится на накладные.</div>`:""}
    ${p.left>0.005&&!invArch(r)?`<div class="invpay-f"><label>Пришло, ₽<input id="invpay-sum" type="text" inputmode="decimal" data-money value="${p.left}" aria-label="Сумма оплаты"></label><label>Дата оплаты<input id="invpay-date" type="date" value="${todayISO()}"></label><button type="button" class="btn pri" data-dc="pay">Отметить оплату</button></div>
    <small class="muted">Отметится оплата у всех накладных счёта. Сумма меньше — закроет накладные по порядку, с самой старой, остаток ляжет частичной оплатой.</small>`:""}
    ${p.s>0&&!invArch(r)?`<button type="button" class="btn ghost sm invpay-x" data-dc="unpay">Снять оплату со всех накладных счёта</button>`:""}</div>`; }
function invPayDone(r, w, ev, t){ const d=Object.assign({}, invData(r)); invHist(d, [w]); r.data=JSON.stringify(d); r.updated=new Date().toISOString(); dirty("invoices", r.id);
  logEv("Счета", ev+": счёт № "+r.number+" от "+fd(r.date)+" — "+(cus(r.customerId).name||"")); saveLocal(); invCard(r.id); invViews(); if(curTab==="profit") drawProfit(); toast("ok", t[0], t[1]+" Отменить — кнопка «Отменить» внизу."); }
function invPay(id, sum, date){ const r=invRows().find(x=>x.id===id); if(!r||!invPayOk()) return; let left=r2(sum), n=0;
  for(const j of invDocsOf(r)){ if(left<=0.004) break; const p=payOf(j); if(p.st==="paid") continue; const put=Math.min(p.left,left); setPay(j, r2(p.s+put), date, true); left=r2(left-put); n++; }
  const put=r2(sum-left); if(!n){ toast("info","Все накладные счёта уже оплачены",""); return; }
  invPayDone(r, "оплата "+fm(put)+" ₽ от "+fd(date)+" ("+n+" накл.)", "Оплата "+fm(put)+" ₽ от "+fd(date)+" разнесена на "+n+" накл.",
    ["Оплата по счёту отмечена", n+" "+plural(n,["накладная","накладные","накладных"])+" · "+fm(put)+" ₽"+(left>0.004?". Лишние "+fm(left)+" ₽ — некуда: все накладные счёта оплачены.":".")]); }
function invUnpay(id){ const r=invRows().find(x=>x.id===id); if(!r||!invPayOk()) return; let n=0;
  invDocsOf(r).forEach(j=>{ if(payOf(j).s>0){ setPay(j, 0, "", true); n++; } }); if(!n) return;
  invPayDone(r, "оплата снята ("+n+" накл.)", "Снята оплата с "+n+" накл.", ["Оплата снята", n+" "+plural(n,["накладная","накладные","накладных"])+" снова ждут оплату."]); }
function invHist(d, w){ const h=Array.isArray(d.hist)?d.hist.slice(-29):[]; h.push({at:new Date().toISOString(), by:curUser()||"", w}); d.hist=h; }
function invSetArch(id, on){ const r=invRows().find(x=>x.id===id); if(!r) return; const d=Object.assign({}, invData(r));
  if(on) d.arch=new Date().toISOString(); else delete d.arch; invHist(d, [on?"в архив":"возвращён из архива"]);
  r.data=JSON.stringify(d); r.updated=new Date().toISOString(); dirty("invoices", r.id); saveLocal();
  toast(on?"info":"ok", on?"Счёт убран в архив":"Счёт возвращён", "№ "+r.number+" от "+fd(r.date)+".", on?{action:{label:"Вернуть", fn:()=>invSetArch(id,false)}}:{});
  invViews(); }

/* ---------- создание и правка ---------- */
let INV=null;
function invEdit(id, copy){ if(!invCan()) return; if(D.invSrv===false){ toast("warn","Сначала обновите Code.gs","Без нового скрипта таблица не сохранит счёт."); return; }
  if(INV && INV.dirty && document.getElementById("inv-dlg") && !confirm("Сейчас открыт другой счёт с несохранёнными изменениями. Закрыть его и открыть этот?")){ invOpen(true); return; }
  const r=id?invRows().find(x=>x.id===id):null;
  if(r){ const d=invData(r); INV={id:copy?"":r.id, supplierId:r.supplierId, customerId:r.customerId, branchId:d.branchId||"", contractId:d.contractId||"", from:d.from||"", to:d.to||"", docs:new Set(copy?[]:(d.docs||[])), mode:d.mode||"goods",
      lines:copy?[]:(d.lines||[]).map(x=>Object.assign({},x)), touched:!copy, number:copy?"":String(r.number), date:copy?todayISO():r.date, basis:d.basis||"", note:copy?"":(d.note||""), numAuto:!!copy, dirty:false};
    if(copy){ INV.docs=new Set(invDocs(INV).filter(j=>!invUsed(j.id).length).map(j=>j.id)); INV.lines=invBuild(invDocs(INV).filter(j=>INV.docs.has(j.id)), INV.mode); INV.number=invNext(INV.supplierId, INV.date); } }
  else { const [a,b]=invMonth(new Date().getDate()<=20?1:0); INV={id:"", supplierId:"", customerId:"", branchId:"", contractId:"", from:a, to:b, docs:new Set(), mode:"goods", lines:[], touched:false, number:"", date:todayISO(), basis:"", note:"", numAuto:true, dateAuto:true, dirty:false}; }
  /* откуда пришли: из окна «Все счета» или карточки счёта — после «Сохранить»/«Отмена» вернём туда */
  const dc=document.getElementById("fd-dcard"); INV.back = dc && !dc._bye && dc.querySelector("#inv-list") ? "all" : dc && r && !copy ? "card:"+r.id : "";
  invOpen(); }
function invGoBack(b, id){ if(b==="all") setTimeout(()=>invAll(), 0); else if(b && b.startsWith("card:")){ const x=id||b.slice(5); if(invRows().some(r=>r.id===x)) setTimeout(()=>invCard(x), 0); } }
/* заказчик выбран: поставщик и договор — как в последней накладной */
function invPickCus(cid){ INV.customerId=cid; INV.branchId=""; const last=(D.journal||[]).filter(j=>j.snap && !isArch(j) && j.customerId===cid).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
  INV.supplierId = last ? last.supplierId : (INV.supplierId || (D.suppliers[0]||{}).id || "");
  invPickCtr(last && last.snap.dr.contractId && ctr(last.snap.dr.contractId) ? last.snap.dr.contractId : ((D.contracts||[]).find(x=>x.customerId===cid && (!x.supplierId || x.supplierId===INV.supplierId))||{}).id || ""); }
function invPickCtr(id){ INV.contractId=id||""; const x=ctr(INV.contractId); INV.basis = x ? (x.basis||"") : (INV.basis||""); }
function invRefresh(){ /* пересобрать список накладных; если строки не правили руками — пересобрать и строки */
  const L=invDocs(INV); INV.docs=new Set(L.filter(j=>!invUsed(j.id, INV.id).length).map(j=>j.id));
  if(!INV.touched) INV.lines=invBuild(L.filter(j=>INV.docs.has(j.id)), INV.mode);
  if(INV.numAuto && INV.supplierId) INV.number=invNext(INV.supplierId, INV.date); }
/* форма счёта — не окно, а блок на вкладке «Новый документ» под «Отдельным счётом»: раскрывается плавно */
const invRM = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function invOpen(keep){
  const dc=document.getElementById("fd-dcard"); if(dc){ navReset(); dc._bye=1; dc.classList.add("out"); setTimeout(()=>{ try{ dc.close(); }catch(x){} dc.remove(); }, invRM()?0:200); }   /* открыли из окна «Все счета» / карточки счёта */
  if(typeof curTab!=="undefined" && curTab!=="doc") showTab("doc");
  let w=document.getElementById("inv-wrap"), fresh=!w;
  if(!w){ const host=$("#inv-dc"); if(!host) return; w=document.createElement("div"); w.id="inv-wrap"; w.className="invwrap"; w.innerHTML=`<div class="invwi"><section class="card invform" id="inv-dlg" aria-label="Отдельный счёт"></section></div>`; host.after(w); }
  clearTimeout(w._t); w.classList.remove("closing");
  if(!keep) invDraw();
  if(fresh){ void w.offsetHeight; w.classList.add("open"); w._t=setTimeout(()=>w.classList.add("ivx"), invRM()?0:420); }
  else { w.classList.add("open","ivx"); const f=$("#inv-dlg"); if(f && f.animate && !invRM()) f.animate([{opacity:.4},{opacity:1}],{duration:220,easing:"ease-out"}); }
  invMb(); invBtn(); setTimeout(()=>invGoTo($("#inv-dlg")), fresh&&!invRM()?400:0); }
/* прокрутить к блоку так, чтобы его шапку не закрывала прилипшая шапка сайта */
function invGoTo(el){ if(!el) return; const hd=document.querySelector("#fd-app header.top"), hh=hd && getComputedStyle(hd).position!=="static" ? hd.getBoundingClientRect().bottom : 0;
  scrollTo({top:Math.max(0, scrollY+el.getBoundingClientRect().top-Math.max(0,hh)-12), behavior:invRM()?"auto":"smooth"}); }
/* нижняя панель вкладок на телефоне: итог с кнопками прилипает над ней */
function invMb(){ const w=document.getElementById("inv-wrap"), mb=document.getElementById("mbar"); if(!w) return; const h=mb && getComputedStyle(mb).display!=="none" && getComputedStyle(mb).position==="fixed" ? mb.getBoundingClientRect().height : 0; w.style.setProperty("--mbh", Math.round(h)+"px"); }
addEventListener("resize", ()=>{ clearTimeout(invMb.t); invMb.t=setTimeout(invMb, 150); });
function invClose(force){ const w=document.getElementById("inv-wrap"); if(!w){ INV=null; return; }
  if(!force && INV && INV.dirty && !confirm("Закрыть без сохранения? Изменения в счёте пропадут.")) return;
  const back=!force && INV ? INV.back : ""; INV=null; clearTimeout(w._t); w.classList.remove("ivx"); if(back) invGoBack(back); void w.offsetHeight; w.classList.remove("open"); w.classList.add("closing");
  const host=$("#inv-dc"); if(host && host.getBoundingClientRect().top<0) invGoTo(host);
  w._t=setTimeout(()=>{ w.remove(); invBtn(); }, invRM()?0:380); invBtn(); }
/* кнопка «+ Отдельный счёт», пока форма открыта, показывает это */
function invBtn(){ const b=$("#inv-new2"); if(!b) return; const on=!!INV && !!document.getElementById("inv-wrap"); b.classList.toggle("on", on); b.setAttribute("aria-expanded", on); }
function invTotal(){ return r2(INV.lines.reduce((a,x)=>a+invLineSum(x),0)); }
function invDraw(keepFocus){ const d=document.getElementById("inv-dlg"); if(!d||!INV) return; const F=INV, sy=scrollY;
  const c=cus(F.customerId), br=c?branches(c):[], ctrs=(D.contracts||[]).filter(x=>x.customerId===F.customerId && (!x.supplierId || x.supplierId===F.supplierId));
  const L=F.customerId&&F.supplierId?invDocs(F):[], selSum=r2(L.filter(j=>F.docs.has(j.id)).reduce((a,j)=>a+(+j.sum||0),0)), tot=invTotal(), dup=F.number&&F.supplierId&&invDup(F.supplierId, F.date, F.number, F.id);
  const mon=[invMonth(1), invMonth(0)], chip=(m,t)=>`<button type="button" class="${F.from===m[0]&&F.to===m[1]?"on":""}" data-invm="${m[0]}|${m[1]}">${t}</button>`;
  d.innerHTML=`<div class="invfh"><div><div class="dc-kicker">Счёт на оплату</div><h2>${F.id?"Изменить счёт № "+esc(F.number):"Новый счёт"}</h2><p class="muted invsub">На сумму контракта и журнал не влияет — это только счёт.</p></div><button type="button" class="dc-x" data-invx aria-label="Закрыть" title="Закрыть">×</button></div>
    <div class="invg">
      <label class="f">Заказчик<select class="invi" data-f="customerId"><option value="">— выберите —</option>${opts(D.customers.filter(x=>!isPriv(x.id)), F.customerId)}</select></label>
      <label class="f">Подразделение / ОП<select class="invi" data-f="branchId"${br.length?"":" disabled"}><option value="">${br.length?"Все подразделения":"— у заказчика нет подразделений —"}</option>${br.map(b=>`<option value="${b.id}"${b.id===F.branchId?" selected":""}>${esc(b.label||b.fullName||"")}${b.kpp?" · КПП "+esc(b.kpp):""}</option>`).join("")}</select></label>
      <label class="f">Поставщик<select class="invi" data-f="supplierId">${D.suppliers.map(x=>`<option value="${x.id}"${x.id===F.supplierId?" selected":""}>${esc(x.name)}</option>`).join("")}</select></label>
      <label class="f">Договор<select class="invi" data-f="contractId"><option value="">— без договора —</option>${ctrs.map(x=>`<option value="${x.id}"${x.id===F.contractId?" selected":""}>${esc(x.basis||"")}</option>`).join("")}</select></label>
    </div>
    <div class="invper"><span class="lbl">Период</span><div class="pfchips">${chip(mon[0], invMonthName(mon[0][0]))}${chip(mon[1], invMonthName(mon[1][0]))}</div><label class="f">с<input type="date" class="invi" data-f="from" value="${esc(F.from)}"></label><label class="f">по<input type="date" class="invi" data-f="to" value="${esc(F.to)}"></label></div>
    <div class="invbox"><div class="invbh"><b>Накладные за период</b>${L.length?`<span class="muted">выбрано ${L.filter(j=>F.docs.has(j.id)).length} из ${L.length} · ${fm(selSum)} ₽</span><button type="button" class="btn ghost sm" data-invall="${L.every(j=>F.docs.has(j.id))?"0":"1"}">${L.every(j=>F.docs.has(j.id))?"Снять все":"Выбрать все"}</button>`:""}</div>
      ${!F.customerId?`<p class="muted">Выберите заказчика — сайт покажет его накладные за период.</p>`:!L.length?`<p class="muted">Накладных за этот период нет${F.branchId?" по этому подразделению":""}. Можно добавить строки счёта вручную ниже.</p>`:
      `<div class="invdl">${L.map(j=>{ const u=invUsed(j.id, F.id); return `<label class="invdr${F.docs.has(j.id)?" on":""}"><input type="checkbox" data-invd="${j.id}"${F.docs.has(j.id)?" checked":""}><span><b>№ ${esc(j.number)} · ${fd(j.date)}</b><small>${esc(kLbl(j)||jWho(j).main)}${u.length?` · <em class="miss">уже в счёте № ${esc(u.map(x=>x.number).join(", "))}</em>`:""}</small></span><i>${fm(j.sum)} ₽</i></label>`; }).join("")}</div>`}
    </div>
    <div class="invbox invlines"><div class="invbh"><b>Строки счёта</b><div class="pfchips invmode"><button type="button" class="${F.mode==="goods"?"on":""}" data-invmode="goods">По товарам</button><button type="button" class="${F.mode==="docs"?"on":""}" data-invmode="docs">По накладным</button></div>${F.touched?`<button type="button" class="btn ghost sm" data-invrb>Пересобрать из накладных</button>`:""}<span class="invbh-sp"></span><button type="button" class="btn sm invfb" data-invfile title="Excel, PDF, Word, текст или фото — сайт распознает строки и впишет их, как в файле"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 10.5V2.5M4.8 5.6L8 2.4l3.2 3.2M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="invfw">Загрузить по шаблону</span><span class="invfm">Файл-шаблон</span></button><button type="button" class="btn ghost sm invfb invtpl" data-invtpl title="Excel с прайсом заказчика: впишите количество и загрузите обратно кнопкой «Загрузить по шаблону»"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v8M4.8 7.4L8 10.6l3.2-3.2M2.5 10.5v2a1 1 0 001 1h9a1 1 0 001-1v-2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="invfw">Скачать шаблон</span><span class="invfm">Шаблон</span></button><input type="file" id="inv-fin" hidden accept=".xlsx,.xls,.csv,.pdf,.docx,.txt,image/*"></div>
      ${F.busy?`<div class="invfn busy"><span class="invspin" aria-hidden="true"></span>${esc(F.busy)}</div>`:""}
      ${F.paste&&!F.busy?`<div class="invpaste"><textarea id="inv-pta" rows="5" placeholder="Вставьте строки счёта или заявки: «Яблоки 12 кг 150», таблицу из Excel или письма…"></textarea><div class="row"><button type="button" class="btn ghost sm" data-invpaste>Отмена</button><button type="button" class="btn pri sm" data-invptgo>Распознать</button></div></div>`:""}
      ${F.fnote&&!F.busy?invFileNote(F.fnote):""}
      ${F.touched?`<p class="muted invnote">Строки изменены вручную — выбор накладных их больше не меняет. «Пересобрать» вернёт строки из выбранных накладных.</p>`:""}
      <div class="invlh"><span></span><span>Наименование</span><span>Кол-во</span><span>Ед.</span><span>Цена, ₽</span><span>Сумма, ₽</span><span></span></div>
      <div class="invls${F.calm?" calm":""}">${F.lines.map((x,i)=>`<div class="invln" data-i="${i}"><button type="button" class="invgrip" data-invgrip aria-label="Переместить строку ${i+1} (перетащите или стрелки ↑↓)" title="Потяните, чтобы переставить"><svg viewBox="0 0 12 16" aria-hidden="true"><circle cx="3.5" cy="3" r="1.4"/><circle cx="8.5" cy="3" r="1.4"/><circle cx="3.5" cy="8" r="1.4"/><circle cx="8.5" cy="8" r="1.4"/><circle cx="3.5" cy="13" r="1.4"/><circle cx="8.5" cy="13" r="1.4"/></svg></button><input class="invli" data-k="name" value="${esc(x.name)}" placeholder="Наименование" aria-label="Наименование"><input class="invli num" data-k="qty" inputmode="decimal" value="${esc(String(x.qty).replace(".",","))}" aria-label="Количество"><input class="invli" data-k="unit" value="${esc(x.unit||"")}" aria-label="Единица"><input class="invli num" data-k="price" inputmode="decimal" value="${esc(String(x.price).replace(".",","))}" aria-label="Цена"><b class="invlsum">${fm(invLineSum(x))}</b><button type="button" class="invdel" data-invdel="${i}" aria-label="Удалить строку">×</button></div>`).join("")||`<p class="muted">Строк нет.</p>`}</div>
      <button type="button" class="btn ghost sm" data-invadd>+ Строка вручную</button>
    </div>
    <div class="invg inv3">
      <label class="f">Номер счёта<input class="invi${dup?" bad":""}" data-f="number" value="${esc(F.number)}"><small class="${dup?"miss":"muted"}">${dup?"Такой номер у поставщика в этом году уже есть":"своя нумерация счетов у поставщика"}</small></label>
      <label class="f">Дата счёта<input type="date" class="invi" data-f="date" value="${esc(F.date)}"></label>
      <label class="f wide">Основание<input class="invi" data-f="basis" value="${esc(F.basis)}" placeholder="Договор № … от …"></label>
      <label class="f wide">Комментарий <small class="muted">(в счёт не печатается)</small><input class="invi" data-f="note" value="${esc(F.note)}" placeholder="например: отправлено бухгалтеру ОП 01.12"></label>
    </div>
    <div class="invfoot"><div><small class="muted">Итого к оплате</small><b id="inv-tot">${fm(tot)} ₽</b>${L.length&&F.docs.size&&Math.abs(tot-selSum)>0.004?`<small class="miss">не равно сумме выбранных накладных (${fm(selSum)} ₽)${F.touched?" — строки счёта правили или накладные изменились; «Пересобрать из накладных» выровняет":""}</small>`:""}</div>
      <div class="row"><button type="button" class="btn" data-invx>Отмена</button><button type="button" class="btn" data-invsave="0">Сохранить</button><button type="button" class="btn pri" data-invsave="1">Сохранить и открыть счёт</button></div></div>`;
  F.calm=false; if(Math.abs(scrollY-sy)>1) scrollTo(0, sy); if(keepFocus){ const f=d.querySelector(keepFocus); if(f){ f.focus(); try{ const n=f.value.length; f.setSelectionRange&&f.setSelectionRange(n,n); }catch(x){} } } }
document.addEventListener("change", e=>{ const el=e.target; if(!INV || !el.closest || !el.closest("#inv-dlg")) return;
  if(el.id==="inv-fin"){ const f=el.files&&el.files[0]; el.value=""; if(f) invFile(f); return; }
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
  if(t.closest("[data-invfile]")){ const i=$("#inv-fin"); if(i) i.click(); return; }
  if(t.closest("[data-invtpl]")){ invTpl(); return; }
  if(t.closest("[data-invpaste]")){ INV.paste=!INV.paste; invDraw(INV.paste?"#inv-pta":""); return; }
  if(t.closest("[data-invptgo]")){ const v=($("#inv-pta")||{}).value||""; if(!v.trim()){ toast("warn","Вставьте текст",""); return; } INV.paste=false; invFile({name:"вставленный текст", txt:1, text:async()=>v}); return; }
  if(t.closest("[data-invfnx]")){ INV.fnote=null; invDraw(); return; }
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
  invViews(); if(open) setTimeout(()=>invPreview(row.id), 220); else if(F.back) invGoBack(F.back==="all"?"all":"card:"+row.id, row.id); }
window.__inv = { rows:()=>invRows(), edit:invEdit, st:()=>INV };

/* ---------- счета живут во вкладке «Новый документ»: блок внизу + окно «Все счета» (вкладки «Счета» больше нет) ---------- */
function invViews(){ invDocCard(); if($("#inv-list")) renderInvoices(); }
function invDocCard(){ const box=$("#inv-dc"); if(!box) return; box.hidden=!invCan(); if(box.hidden) return;
  const live=invRows().filter(r=>!invArch(r)).sort((a,b)=>String(b.date).localeCompare(String(a.date)) || invNumN(b.number)-invNumN(a.number)), n=live.length;
  box.innerHTML=`<div class="invh"><div><h2>Отдельный счёт на оплату</h2><p class="muted">За месяц или период, по подразделению — сайт сам соберёт накладные. Это не новая накладная: на контракт, журнал и прибыль не влияет.</p></div>
    <div class="invbtn"><button class="btn" type="button" id="inv-all">Все счета${n?` <span class="invn">${n}</span>`:""}</button><button class="btn pri" type="button" id="inv-new2"${D.invSrv===false?" disabled":""}>+ Отдельный счёт</button></div></div>
    ${D.invSrv===false?`<div class="sknoteb" style="margin-top:10px">Чтобы счета сохранялись в таблице и были видны всем — обновите Code.gs (версия 14). <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`:""}
    ${n?`<div class="invmini"><div class="invmh">Последние счета</div><div class="invl">${live.slice(0,3).map(invRowHtml).join("")}</div></div>`:""}`; invBtn(); }
function invAll(){ if(!invCan()) return; CARD_RE=()=>invAll();
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Счета на оплату</div><h3>Все отдельные счета</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="invh invh2"><p class="muted">Например, за месяц по каждому подразделению. На сумму контракта, журнал и прибыль не влияют.</p><button class="btn pri" type="button" id="inv-new">+ Новый счёт</button></div>
    <div id="inv-old"></div>
    <div class="invf"><input id="inv-q" type="search" placeholder="Поиск: номер, заказчик, подразделение, товар" aria-label="Поиск счетов"><select id="inv-cus" aria-label="Заказчик"></select><select id="inv-per" aria-label="Период"><option value="">Всё время</option><option value="m0">Этот месяц</option><option value="m1">Прошлый месяц</option><option value="y">Этот год</option></select><label class="invarch"><input type="checkbox" id="inv-arch"> Архив</label></div>
    <div id="inv-sum" class="muted"></div>
    <div id="inv-list"></div>`, true, ()=>{});
  const d=$("#fd-dcard"); if(d) d.classList.add("xwide"); renderInvoices();
  if(me().admin && !pfLoaded) loadProfit(true).then(()=>{ if(pfLoaded){ if($("#inv-list")) invDrawList(); invDocCard(); } }); }

/* ---------- строки счёта: перетаскивание за «ручку» слева (мышь и палец), стрелки ↑↓ на ручке ---------- */
const invRows3 = () => [...document.querySelectorAll("#inv-dlg .invls > .invln")];
function invMoveLine(from, to, focus){ if(!INV || from===to || to<0 || to>=INV.lines.length) return; const x=INV.lines.splice(from,1)[0]; INV.lines.splice(to,0,x); INV.touched=true; INV.dirty=true; INV.calm=true;
  invDraw(focus?`.invln[data-i="${to}"] [data-invgrip]`:""); }
let INVDG=null;
document.addEventListener("pointerdown", e=>{ const g=e.target.closest&&e.target.closest("#inv-dlg [data-invgrip]"); if(!g || !INV || e.button>0) return;
  e.preventDefault(); const row=g.closest(".invln"), rows=invRows3(), from=rows.indexOf(row); if(from<0 || rows.length<2) return;
  const R=rows.map(r=>r.getBoundingClientRect()), top0=R[0].top+scrollY, gap=rows.length>1?Math.max(0,R[1].top-R[0].bottom):4;
  INVDG={g, row, rows, from, to:from, R:R.map(r=>({top:r.top+scrollY, h:r.height})), y0:e.clientY+scrollY, cy:e.clientY, id:e.pointerId, gap, top0};
  try{ g.setPointerCapture(e.pointerId); }catch(x){}
  row.classList.add("dragging"); row.closest(".invls").classList.add("sorting"); document.body.classList.add("invdrag");
  rows.forEach(r=>{ if(r!==row) r.style.transition="transform .22s cubic-bezier(.2,.7,.2,1)"; });
  invDgLoop(); });
function invDgPlace(){ const G=INVDG; if(!G) return; const dy=G.cy+scrollY-G.y0, me=G.R[G.from], mid=me.top+dy+me.h/2, sh=me.h+G.gap;
  let to=G.from; G.R.forEach((r,i)=>{ if(i<G.from && mid<r.top+r.h/2) to=Math.min(to,i); if(i>G.from && mid>r.top+r.h/2) to=Math.max(to,i); });
  G.to=to; G.row.style.transform=`translateY(${dy}px) scale(1.01)`;
  G.rows.forEach((r,i)=>{ if(i===G.from) return; const s2=(G.from<to && i>G.from && i<=to) ? -sh : (G.from>to && i>=to && i<G.from) ? sh : 0; r.style.transform=s2?`translateY(${s2}px)`:""; }); }
function invDgLoop(){ const G=INVDG; if(!G) return; if(Math.abs(G.cy+scrollY-G.y0)>6) G.mv=1; const edge=G.mv?70:-1e4, vh=innerHeight, foot=document.querySelector("#inv-dlg .invfoot"), fb=foot?foot.getBoundingClientRect().top:vh;
  let v=0; if(G.cy<edge) v=-Math.ceil((edge-G.cy)/6); else if(G.cy>Math.min(vh,fb)-edge) v=Math.ceil((G.cy-(Math.min(vh,fb)-edge))/6); if(v) scrollBy(0, Math.max(-18,Math.min(18,v)));
  invDgPlace(); G.raf=requestAnimationFrame(invDgLoop); }
document.addEventListener("pointermove", e=>{ if(!INVDG || e.pointerId!==INVDG.id) return; e.preventDefault(); INVDG.cy=e.clientY; }, {passive:false});
function invDgEnd(e, cancel){ const G=INVDG; if(!G || (e && e.pointerId!==G.id)) return; INVDG=null; cancelAnimationFrame(G.raf); document.body.classList.remove("invdrag");
  const to=cancel?G.from:G.to, fin=()=>{ G.rows.forEach(r=>{ r.style.transition=""; r.style.transform=""; }); G.row.classList.remove("dragging","drop"); const ls=G.row.closest(".invls"); if(ls) ls.classList.remove("sorting"); if(to!==G.from) invMoveLine(G.from, to); };
  if(to===G.from){ G.row.classList.add("drop"); G.row.style.transform=""; G.rows.forEach(r=>{ r.style.transform=""; }); setTimeout(fin, invRM()?0:200); return; }
  /* плавно поставить строку на новое место, потом пересобрать список без мигания */
  let off=0; if(to>G.from){ for(let i=G.from+1;i<=to;i++) off+=G.R[i].h+G.gap; } else { for(let i=to;i<G.from;i++) off-=G.R[i].h+G.gap; }
  G.row.classList.add("drop"); G.row.style.transform=`translateY(${off}px)`; setTimeout(fin, invRM()?0:200); }
document.addEventListener("pointerup", e=>invDgEnd(e)); document.addEventListener("pointercancel", e=>invDgEnd(e, true));
document.addEventListener("keydown", e=>{ if(INVDG && e.key==="Escape"){ e.preventDefault(); invDgEnd(null, true); return; }
  const g=e.target.closest&&e.target.closest("#inv-dlg [data-invgrip]"); if(!g || !INV || !["ArrowUp","ArrowDown"].includes(e.key)) return; e.preventDefault();
  const i=+g.closest(".invln").dataset.i; invMoveLine(i, i+(e.key==="ArrowUp"?-1:1), true); });

/* ---------- «Скачать шаблон»: Excel с прайсом заказчика — вписать количество и загрузить обратно ---------- */
async function invTpl(){ if(!INV) return; const F=INV;
  try{ const X=await loadXLSX(), c=cus(F.customerId)||{}, s=sup(F.supplierId)||{}, k=F.contractId?ctr(F.contractId):null, b=F.branchId?branches(c).find(x=>x.id===F.branchId):null;
    const P=c.id?D.products.filter(p=>{ const v=custPrice(c.id,p.id); return v!=null&&v!==""; }).sort((a,b)=>a.name.localeCompare(b.name,"ru")):[];
    const aoa=[["Счёт на оплату — шаблон для сайта «Фруктовый Дом · документы»"],["Впишите количество в столбец «Количество». Строки без количества сайт пропустит. Цену можно поправить, строки — удалить или добавить."],[],
      ["Заказчик",c.name||""],["ИНН заказчика",c.inn||""],["Подразделение",b?(b.label||""):""],["Договор",k?(k.basis||""):""],["Поставщик",s.name||""],["ИНН поставщика",s.inn||""],[],
      ["Наименование","Количество","Ед.","Цена, ₽","Сумма, ₽"]];
    const h=aoa.length; P.forEach((p,i)=>{ const r=h+i+1; aoa.push([p.name,"",p.unit||"кг",r2(+custPrice(c.id,p.id)),{f:`IF(B${r}="","",B${r}*D${r})`}]); });
    if(!P.length) for(let i=0;i<10;i++){ const r=h+i+1; aoa.push(["","","кг","",{f:`IF(B${r}="","",B${r}*D${r})`}]); }
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:50},{wch:12},{wch:6},{wch:11},{wch:12}];
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Счёт");
    X.writeFile(wb,"Шаблон счёта"+(c.id?" — "+cusNm(c.id):"")+".xlsx");
    toast("ok","Шаблон скачан", P.length?"В нём прайс заказчика ("+P.length+" "+posWord(P.length)+"). Впишите количество и загрузите файл кнопкой «Загрузить по шаблону».":"Заказчик не выбран — в шаблоне пустые строки. Лучше сначала выберите заказчика: тогда в шаблоне будет его прайс.");
  }catch(e){ toast("err","Не получилось сделать шаблон", e.message||String(e)); } }

/* ---------- «Загрузить по шаблону»: файл или текст → строки счёта как в файле (по аналогии с «Заказом из файла») ---------- */
async function invSrcOf(f){ const n=f.name||"";
  if(/\.(xlsx|xls|csv)$/i.test(n)){ const X=await loadXLSX(), wb=X.read(await f.arrayBuffer(),{type:"array", cellDates:true}), T=wb.SheetNames.map(s=>X.utils.sheet_to_json(wb.Sheets[s],{header:1, raw:true, defval:""}));
    return {how:"Прочитано из Excel — без ИИ.", tables:T, lines:T.flat().map(r=>r.map(x=>x instanceof Date?fd(impDate(x)):String(x==null?"":x)).join("\t"))}; }
  try{ const r=await ftRead(f);   /* текст со столбцами через Tab (скопировано из Excel / шаблона) — читаем как таблицу */
    if(r && !(r.tables&&r.tables.length) && (r.lines||[]).filter(l=>String(l).includes("\t")).length>=2) r.tables=[r.lines.map(l=>String(l).split("\t"))];
    return r; }
  catch(e){ if(!e.scan) throw e;
    INV.busy="Читаю фото через ИИ…"; invDraw();
    const d=await aiPrep(f); if(d.data.length>18e6) throw new Error("файл больше 13 МБ — для ИИ слишком большой");
    let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:150000, body:JSON.stringify({key:pass(), user:curUser(), action:"aiRead", mime:d.mime, data:d.data})}); }
    catch(x){ const m=x.message||""; if(m==="nokey"||m==="badkey") throw new Error("для фото нужен ключ ИИ — «Данные» → «ИИ»"); if(m==="unknown action") throw new Error("скрипт таблицы старый — обновите Code.gs"); throw x; }
    let o; try{ o=JSON.parse(String(j.text).replace(/^```(json)?|```$/g,"").trim()); }catch(x){ throw new Error("ИИ ответил не по форме — попробуйте ещё раз"); }
    const src=aiSrc(o); src.how="Фото прочитано ИИ"+(j.model?" ("+j.model+")":"")+" — сверьте строки с оригиналом."; return src; } }
async function invFile(f){ if(!INV) return; const F=INV, name=f.name||"файл";
  F.busy="Читаю «"+name+"»…"; F.fnote=null; invDraw();
  try{ const src=await invSrcOf(f); if(INV!==F) return;
    const P=ftParse(src, F.customerId), cid=P.meta.cid, c=cus(cid)||{}, warn=(P.meta.warn||[]).filter(w=>!/дата поставки/i.test(w.m));
    if(cid && cid!==F.customerId){ invPickCus(cid); if(P.meta.kid && ctr(P.meta.kid)) invPickCtr(P.meta.kid); invRefresh(); }
    if(P.meta.branch){ const b=branches(c).find(x=>norm(x.label)===norm(P.meta.branch)); if(b && b.id!==F.branchId){ F.branchId=b.id; invRefresh(); } }
    /* строки — как в файле: название, количество, единица, цена из файла; нет цены — цена заказчика по найденному товару */
    const out=[], by={}, miss=[], nopr=[], diff=[];
    P.lines.forEach(l=>{ const p=impMatch(l.name, cid, l.price), pid=p&&!p.__amb?p.id:"";
      if((l.qty===""||l.qty==null) && l.price!=="" && l.price!=null) return;   /* строка шаблона: цена есть, количество не вписали — не брать вес из названия («ж/б 400») */
      let qty=l.qty, unit=String(l.unit||"").trim(); const pk=l.orig?parsePack(l.orig):null;
      if((qty===""||!(+qty>0)) && pk){ qty=pk.n; unit=unit||pk.u; }
      if(!(+qty>0)) return;   /* пустое количество (строка шаблона, которую не заполнили) — пропускаем */
      unit=/^кг|^килогр/i.test(unit)?"кг":/^шт/i.test(unit)?"шт":unit||(p&&p.unit)||"";
      const cp=pid?custPrice(cid,pid):null; let price=l.price!==""&&l.price!=null?+l.price:(cp!=null&&cp!==""?+cp:"");
      if(price==="" ) nopr.push(l.name); else if(l.price!=="" && cp!=null && cp!=="" && Math.abs(+cp-price)>0.005) diff.push("«"+l.name+"»: в файле "+fm(price)+" ₽, у заказчика "+fm(+cp)+" ₽");
      if(!pid) miss.push(l.name);
      const k=norm(l.name)+"|"+unit+"|"+price; let o=by[k];
      if(!o){ o=by[k]={name:String(l.name).trim(), unit, qty:0, price:price===""?"":String(price)}; if(pid) o.pid=pid; out.push(o); }
      o.qty=r3((+o.qty||0)+(+qty||0)); });
    if(!out.length) throw new Error("в файле не нашёл ни одной строки с товаром");
    if(F.lines.some(x=>x.name||+num(x.qty)) && !confirm("Заменить строки счёта ("+F.lines.length+") строками из файла ("+out.length+")?")){ F.busy=""; invDraw(); return; }
    F.lines=out.map(o=>Object.assign(o,{qty:String(o.qty)})); F.mode="goods"; F.touched=true; F.dirty=true;
    const tot=invTotal(); F.busy=""; F.fnote={file:name, n:out.length, tot, how:warn.filter(w=>w.t!=="w").map(w=>w.m).concat(warn.filter(w=>w.t==="w"&&/заказчик/i.test(w.m)).map(w=>w.m)),
      w:[].concat(miss.length?["Не нашёл на сайте (вписано как в файле): "+miss.slice(0,6).join("; ")+(miss.length>6?" и ещё "+(miss.length-6):"")]:[], nopr.length?["Без цены — впишите: "+nopr.slice(0,6).join("; ")+(nopr.length>6?" и ещё "+(nopr.length-6):"")]:[], diff.slice(0,4))};
    invDraw(); toast(nopr.length?"warn":"ok","Строки из файла вписаны", out.length+" "+posWord(out.length)+" · "+fm(tot)+" ₽"+(cid?" · "+cusNm(cid):""));
    logEv("Счета","Строки счёта из файла «"+name+"»: "+out.length+" поз., "+fm(tot)+" ₽");
  }catch(e){ if(INV!==F) return; F.busy=""; F.fnote={err:e.message||String(e), file:name}; invDraw(); toast("err","Не получилось прочитать файл", (e.message||String(e))+"."); } }
function invFileNote(N){ if(N.err) return `<div class="invfn err"><div><b>«${esc(N.file)}» не прочитан</b><span>${esc(N.err)}.</span></div><button type="button" class="invfnx" data-invfnx aria-label="Скрыть">×</button></div>`;
  return `<div class="invfn${N.w.length?" warn":""}"><div><b>Из «${esc(N.file)}»: ${N.n} ${posWord(N.n)} · ${fm(N.tot)} ₽</b>${N.how.map(x=>`<span>${esc(x)}</span>`).join("")}${N.w.map(x=>`<span class="w">${esc(x)}</span>`).join("")}<span>Порядок строк — как в файле; можно переставить, потянув за ручку слева.</span></div><button type="button" class="invfnx" data-invfnx aria-label="Скрыть">×</button></div>`; }
/* файл можно просто перетащить на «Строки счёта» */
["dragenter","dragover"].forEach(ev=>document.addEventListener(ev, e=>{ const b=e.target.closest&&e.target.closest("#inv-dlg .invlines"); if(!b || !e.dataTransfer || ![...(e.dataTransfer.types||[])].includes("Files")) return; e.preventDefault(); b.classList.add("over"); }));
["dragleave","drop"].forEach(ev=>document.addEventListener(ev, e=>{ const b=e.target.closest&&e.target.closest("#inv-dlg .invlines"); if(!b) return; if(ev==="dragleave" && b.contains(e.relatedTarget)) return; b.classList.remove("over");
  if(ev==="drop" && e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]){ e.preventDefault(); invFile(e.dataTransfer.files[0]); } }));
window.__inv.file = f => invFile(f);
