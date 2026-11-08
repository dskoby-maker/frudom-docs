/* ================= «Прибыль»: разделы «Обзор · По заказчикам · Расходы и доходы» ================= */
/* Быстрая закупка накладной «от кого — сумма»: lines._src=[{n,s}] в «Себестоимости накладных» (работает и со старым скриптом).
   Категории прочих расходов/доходов: список — в личных настройках (prefs.poCats), у записи — поля cat/catName (Code.gs ≥ 15). */
const PV = () => (D.pfv = D.pfv || {v:"ov", m:"", fcat:"", q:"", fk:"", fv:"list", fday:""});
/* линейные иконки вместо эмодзи (строгий вид); старые эмодзи в сохранённых категориях переводятся в иконки */
const PV_SVG = {
  workers:'<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18 15c1.7.6 2.7 2.2 3 5"/>',
  fuel:'<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10"/><path d="M14 8h2a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  car:'<path d="M4 16v-4l2-5h12l2 5v4zM6 16v3M18 16v3"/><path d="M8 13h.01M16 13h.01"/>',
  home:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M10 20v-6h4v6"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  phone:'<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
  laptop:'<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  megaphone:'<path d="M3 10v4l12 5V5zM15 9a3 3 0 0 1 0 6M6 15l1 4h3l-1-3.5"/>',
  alert:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
  truck:'<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  bank:'<path d="M3 9l9-5 9 5M5 10v7M10 10v7M14 10v7M19 10v7M3 20h18"/>',
  card:'<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  box:'<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  cart:'<path d="M3 4h2.5l2.2 11h10.6L20.5 7H7"/><circle cx="9.5" cy="19.5" r="1.4"/><circle cx="17" cy="19.5" r="1.4"/>',
  coins:'<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.6-2.4-2.9-5.5-3"/>',
  back:'<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  apple:'<path d="M12 7c-2-1.5-7-1-7 5 0 4 3 8 5 8 1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-8 0-6-5-6.5-7-5zM12 7c0-2 1-3.5 3-4"/>',
  leaf:'<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15M5 19l8-8"/>',
  wrench:'<path d="M15 4a5 5 0 0 0-5.6 6.6L3 17l4 4 6.4-6.4A5 5 0 0 0 20 9l-3 3-3-3 3-3a5 5 0 0 0-2-2z"/>',
  food:'<path d="M7 3v8a2 2 0 0 0 2 2v8M5 3v5M9 3v5M17 21V3c-2 1-3 4-3 8h3"/>',
  send:'<path d="M3 11l18-7-7 18-3-8z"/><path d="M11 14l4-4"/>',
  gift:'<rect x="3" y="8" width="18" height="4"/><path d="M5 12v9h14v-9M12 8v13M12 8c-1-3-5-4-5-1.5S12 8 12 8s5 0 5-2.5S13 5 12 8z"/>',
  doc:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  bolt:'<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  drop:'<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  broom:'<path d="M14 4l6 6M17 7l-7 7M10 14l-6 2-1 5 5-1z"/>',
  health:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>',
  study:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
  tag:'<path d="M3 12V4h8l10 10-8 8z"/><path d="M7.5 8.5h.01"/>',
  chart:'<path d="M3 20h18M5 16l5-5 4 3 6-7"/>',
  deal:'<path d="M3 12l4-4 5 2 5-2 4 4-7 7z"/><path d="M9 13l2 2M12 12l2 2"/>',
  tools:'<path d="M4 20l7-7M14 4l6 6-3 3-6-6zM5 5l4 4"/>',
  basket:'<path d="M3 10h18l-2 10H5zM8 10l3-6M16 10l-3-6M9 14v3M15 14v3"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12h.01"/>',
  question:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01"/>',
  /* служебные */
  ov:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', cus:'<circle cx="9" cy="8" r="3"/><path d="M3 20c.8-3.4 3.2-5 6-5s5.2 1.6 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5.6M18 15c1.7.6 2.7 2.2 3 5"/>',
  fin:'<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4"/>', search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', folder:'<path d="M3 6h6l2 2h10v11H3z"/>', check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
};
const PV_EMO = {"👷":"workers","⛽":"fuel","🚗":"car","🏠":"home","🧾":"receipt","📱":"phone","💻":"laptop","📣":"megaphone","⚠️":"alert","⚠":"alert","🚚":"truck","🏦":"bank","💳":"card","👤":"user","📦":"box","🛒":"cart","💰":"coins","↩️":"back","↩":"back","🍎":"apple","🥕":"leaf","🔧":"wrench","🍽️":"food","🍽":"food","✈️":"send","✈":"send","🎁":"gift","📄":"doc","⚡":"bolt","💧":"drop","🧹":"broom","🏥":"health","🎓":"study","🏷️":"tag","🏷":"tag","📈":"chart","🤝":"deal","🛠️":"tools","🛠":"tools","🧺":"basket","📮":"mail","🎯":"target","❔":"question"};
const pvIk = i => PV_SVG[i] ? i : (PV_EMO[i] || "tag");
const pvIco = (i, cls) => `<svg class="pvi${cls?" "+cls:""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PV_SVG[pvIk(i)]}</svg>`;
const PV_ICONS = ["workers","fuel","car","home","receipt","phone","laptop","megaphone","alert","truck","bank","card","user","box","cart","coins","back","apple","leaf","wrench","food","send","gift","doc","bolt","drop","broom","health","study","tag","chart","deal","tools","basket","mail","target"];
const PV_HUES = [8, 28, 45, 95, 150, 175, 200, 225, 255, 285, 320, 340];
const PV_CATS_DEF = [
  {id:"c-zp", n:"Зарплата", i:"workers", h:225, k:"exp"}, {id:"c-fuel", n:"Бензин и машина", i:"fuel", h:28, k:"exp"},
  {id:"c-rent", n:"Аренда", i:"home", h:285, k:"exp"}, {id:"c-tax", n:"Налоги", i:"receipt", h:8, k:"exp"},
  {id:"c-tel", n:"Связь и интернет", i:"phone", h:200, k:"exp"}, {id:"c-soft", n:"Сервисы и подписки", i:"laptop", h:255, k:"exp"},
  {id:"c-ads", n:"Реклама", i:"megaphone", h:320, k:"exp"}, {id:"c-fine", n:"Штрафы", i:"alert", h:45, k:"exp"},
  {id:"c-dlv", n:"Доставка", i:"truck", h:175, k:"exp"}, {id:"c-bank", n:"Банк и кредит", i:"bank", h:340, k:"exp"},
  {id:"c-me", n:"Личные", i:"user", h:95, k:"exp"}, {id:"c-etc", n:"Прочее", i:"box", h:200, k:"both"},
  {id:"c-mp", n:"Маркетплейсы", i:"cart", h:150, k:"inc"}, {id:"c-inc", n:"Прочий доход", i:"coins", h:95, k:"inc"}, {id:"c-ret", n:"Возвраты", i:"back", h:175, k:"inc"}];
const PV_NOCAT = {id:"", n:"Без категории", i:"question", h:null, k:"both"};
const pvCats = () => { const p=getPrefs(); return Array.isArray(p.poCats) ? p.poCats : PV_CATS_DEF.map(c=>Object.assign({},c)); };
const pvCatsSave = list => { const p=getPrefs(); p.poCats=list; setPrefs(p, true); };
const pvCat = id => pvCats().find(c=>c.id===id) || PV_NOCAT;
const pvCatOk = () => (D.srvVer||0) >= 15;
const pvCol = (h, a) => h==null ? `rgba(101,112,106,${a})` : `hsla(${h},62%,${a>.5?42:55}%,${a})`;
const pvBubble = c => `<span class="pvb" style="--h:${c.h==null?"0":c.h};--s:${c.h==null?"0%":"62%"}">${pvIco(c.i)}</span>`;
const PV_MON = ["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
const PV_MONG = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const PV_DOW = ["вс","пн","вт","ср","чт","пт","сб"];
const pvMon = m => PV_MON[+m.slice(5,7)-1]+" "+m.slice(0,4);
const pvMonth = () => { const f=PV(); if(!f.m) f.m=todayISO().slice(0,7); return f.m; };
function pvRange(){ const m=pvMonth(); if(m==="all") return ["0000","9999"]; const [y,mo]=m.split("-").map(Number); return [m+"-01", jIso(new Date(y,mo,0))]; }
const pvShift = (m, d) => { const [y,mo]=m.split("-").map(Number), x=new Date(y, mo-1+d, 1); return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0"); };
const pvDay = iso => { const x=new Date(iso+"T12:00:00"); return x.getDate()+" "+PV_MONG[x.getMonth()]+", "+PV_DOW[x.getDay()]; };
const pvMoney = (v, sign) => `${sign&&v>0?"+":v<0?"−":""}${fm(Math.abs(v))}`;
const pvSrc = j => { const L=dcLines(docCost(j.id)); return Array.isArray(L._src) && L._src.length ? L._src : null; };

/* ---------- каркас: переключатель и две новые карточки ---------- */
function pvInit(){
  const tab=$("#tab-profit"); if(!tab || $("#pv-seg")) return;
  tab.insertAdjacentHTML("afterbegin", `<div class="pvseg" id="pv-seg" role="tablist" aria-label="Раздел прибыли"><i></i>
    <button type="button" role="tab" data-pv="ov">${pvIco("ov")}<span>Обзор</span></button>
    <button type="button" role="tab" data-pv="cus">${pvIco("cus")}<span class="pvl">По заказчикам</span><span class="pvs">Заказчики</span></button>
    <button type="button" role="tab" data-pv="fin">${pvIco("fin")}<span class="pvl">Расходы и доходы</span><span class="pvs">Расходы</span></button>
    <button type="button" role="tab" data-pv="bank">${pvIco("bank")}<span class="pvl">Поступления</span><span class="pvs">Банк</span><em id="pv-bkn" hidden></em></button></div>`);
  tab.insertAdjacentHTML("beforeend", `<div class="card pfv-cus" id="pv-cus"></div><div class="card pfv-fin" id="pv-fin"></div><div class="card pfv-bank" id="pv-bank"></div>`);
  $("#pv-seg").addEventListener("click", e=>{ const b=e.target.closest("[data-pv]"); if(!b) return; PV().v=b.dataset.pv; saveLocal(); pvDraw(); window.scrollTo({top:0, behavior:"smooth"}); });
  $("#pv-cus").addEventListener("click", pvCusClick); $("#pv-cus").addEventListener("input", e=>{ if(e.target.id==="pv-q"){ PV().q=e.target.value; pvCusDraw(true); } });
  $("#pv-fin").addEventListener("click", pvFinClick);
  $("#pv-bank").addEventListener("click", pvBankClick);
}
function pvDraw(){
  pvInit(); const f=PV(), tab=$("#tab-profit"); if(!tab) return; tab.dataset.v=f.v;
  const bs=[...$("#pv-seg").querySelectorAll("button")], i=Math.max(0, bs.findIndex(b=>b.dataset.pv===f.v));
  bs.forEach((b,k)=>{ b.classList.toggle("on", k===i); b.setAttribute("aria-selected", k===i); });
  $("#pv-seg").style.setProperty("--i", i);
  const bw=BNK().ops.filter(o=>o.status==="wait"||o.status==="new").length, bn=$("#pv-bkn"); if(bn){ bn.hidden=!bw; bn.textContent=bw; }
  if(f.v==="cus") pvCusDraw(); else if(f.v==="fin") pvFinDraw(); else if(f.v==="bank") pvBankDraw();
}
const pvMonBar = () => { const m=pvMonth(), all=m==="all";
  return `<div class="pvmon"><button type="button" class="pvarr" data-pvm="-1" aria-label="Прошлый месяц" ${all?"disabled":""}>‹</button>
    <b>${all?"Все месяцы":pvMon(m)}</b><button type="button" class="pvarr" data-pvm="1" aria-label="Следующий месяц" ${all?"disabled":""}>›</button>
    <button type="button" class="pvall ${all?"on":""}" data-pvm="all">${all?"По месяцам":"Все месяцы"}</button></div>`; };
function pvMonClick(b){ const f=PV(), k=b.dataset.pvm; if(k==="all") f.m = f.m==="all" ? todayISO().slice(0,7) : "all"; else f.m=pvShift(pvMonth(), +k); saveLocal(); pvDraw(); }

/* ---------- По заказчикам ---------- */
function pvCusData(d1, d2){
  const G=new Map();
  D.journal.filter(j=>j.snap && !isArch(j) && j.date>=d1 && j.date<=d2).forEach(j=>{ const x=docProfit(j), k=j.customerId||"-";
    if(!G.has(k)) G.set(k, {cid:k, docs:[], rev:0, rs:0, cost:0, exp:0, profit:0, miss:0, last:""}); const g=G.get(k);
    g.docs.push(x); g.rev+=x.rev; g.rs+=x.rev-x.tax; g.cost+=x.cost; g.exp+=x.exp; g.profit+=x.profit; if(x.miss) g.miss++; if(j.date>g.last) g.last=j.date; });
  return [...G.values()].map(g=>{ ["rev","rs","cost","exp","profit"].forEach(k=>g[k]=r2(g[k])); return g; }).sort((a,b)=>b.rev-a.rev);
}
const pvCusName = cid => cid==="-" ? "Без заказчика" : (cus(cid).name || "Заказчик");
const pvAva = cid => { const h=dtHue(cid), n=pvCusName(cid).replace(/[«»"']/g,"").replace(/^(ФГБУ|ФГБНУ|ГБПОУ|ГАПОУ|ГУП|АО|ООО|ИП|ФГУП|МБОУ|ГБУ)\s+/i,"").trim();
  return `<span class="pvava" style="--h:${h==null?200:h}">${esc((n[0]||"?").toUpperCase())}</span>`; };
function pvCusDraw(keepInput){
  const box=$("#pv-cus"), f=PV(), [d1,d2]=pvRange(), all=pvCusData(d1,d2), q=(f.q||"").trim().toLowerCase();
  const L=q ? all.filter(g=>pvCusName(g.cid).toLowerCase().includes(q)) : all;
  const T=all.reduce((a,g)=>({rev:a.rev+g.rev, rs:a.rs+g.rs, cost:a.cost+g.cost+g.exp, profit:a.profit+g.profit, n:a.n+g.docs.length, miss:a.miss+g.miss}),{rev:0,rs:0,cost:0,profit:0,n:0,miss:0});
  const tiles = L.length ? L.map((g,i)=>{ const mg=g.rev>0?Math.max(0,Math.min(100,g.profit/g.rev*100)):0;
    return `<button type="button" class="pvcus" data-pvc="${esc(g.cid)}" style="--d:${Math.min(i,12)*30}ms">
      <div class="pvch">${pvAva(g.cid)}<div class="pvcn"><b>${esc(pvCusName(g.cid))}</b><small>${g.docs.length} ${plural(g.docs.length,["накладная","накладные","накладных"])} · последняя ${fd(g.last).slice(0,5)}</small></div>${g.miss?`<span class="pvwarn" title="Нет закупки у ${g.miss} ${plural(g.miss,["накладной","накладных","накладных"])}"><i></i>${g.miss}</span>`:""}</div>
      <div class="pvcp"><small>Прибыль</small><b class="${g.profit<0?"neg":""}">${fm(g.profit)} ₽</b><span>${pct(g.profit,g.rev)}</span></div>
      <div class="pvbar"><i style="width:${mg}%"></i></div>
      <dl class="pvcs"><div><dt>Сумма</dt><dd>${fm(g.rev)}</dd></div><div><dt>На р/с</dt><dd>${fm(g.rs)}</dd></div><div><dt>Закупка</dt><dd>${fm(r2(g.cost+g.exp))}</dd></div></dl>
      <span class="pvgo">Открыть ›</span></button>`; }).join("")
    : `<div class="pvempty">${pvIco("folder","big")}<b>${all.length?"Никого не нашлось":"За этот месяц накладных нет"}</b><small>${all.length?"Попробуйте другое название.":"Выберите другой месяц стрелками сверху."}</small></div>`;
  const head = `<div class="pvhead"><div><h2>По заказчикам</h2><small class="muted">Нажмите на заказчика — накладные, «на р/с», закупка и прибыль, как в вашей таблице</small></div>${pvMonBar()}</div>
    <div class="pvkpi"><div><small>Сумма накладных</small><b>${fm(r2(T.rev))}</b><span>${T.n} ${plural(T.n,["накладная","накладные","накладных"])}</span></div>
      <div><small>На р/с (после налога)</small><b>${fm(r2(T.rs))}</b></div><div><small>Закупка</small><b>${fm(r2(T.cost))}</b>${T.miss?`<button type="button" class="pvmiss" data-pvmiss title="Открыть эти накладные во вкладке «Закупка» и заполнить">без закупки: ${T.miss} ›</button>`:""}</div>
      <div class="pos"><small>Прибыль</small><b class="${T.profit<0?"neg":""}">${fm(r2(T.profit))}</b><span>маржа ${pct(T.profit,T.rev)}</span></div></div>
    <div class="pvsearch">${pvIco("search")}<input id="pv-q" placeholder="Найти заказчика" value="${esc(f.q||"")}" autocomplete="off"></div>`;
  if(keepInput && $("#pv-q")){ box.querySelector(".pvgrid").innerHTML=tiles; return; }
  box.innerHTML = head + `<div class="pvgrid">${tiles}</div>`;
}
function pvCusClick(e){
  const m=e.target.closest("[data-pvm]"); if(m){ pvMonClick(m); return; }
  const t=e.target.closest("[data-pvc]"); if(t) pvLedger(t.dataset.pvc);
}

/* окно заказчика — «таблица цирка» по месяцам */
let PVL={cid:"", open:new Set(), ed:""};
function pvLedger(cid){
  PVL={cid, open:new Set([pvMonth()==="all" ? "" : pvMonth()]), ed:""};
  const c=cus(cid), docs=D.journal.filter(j=>j.snap && !isArch(j) && (j.customerId||"-")===cid);
  if(!docs.length){ toast("info","Накладных нет",""); return; }
  if(!PVL.open.has(pvMonth())||pvMonth()==="all"){ const lm=docs.map(j=>j.date.slice(0,7)).sort().pop(); PVL.open=new Set([lm]); }
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Заказчик · прибыль</div><h3>${esc(pvCusName(cid))}</h3>${c.inn?`<div class="dc-sub">ИНН ${esc(c.inn)}</div>`:""}</div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div><div id="pvl"></div>
    <datalist id="pv-srcn"></datalist>`, true, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("xwide","pvl-d"); d.addEventListener("click", pvLedgerClick); d.addEventListener("input", pvLedgerInput); d.addEventListener("keydown", e=>{ if((e.key==="Enter"||e.key===" ") && e.target.classList && e.target.classList.contains("pvrl")){ e.preventDefault(); e.target.click(); return; } if(e.key==="Enter" && e.target.closest(".pvsrc")){ e.preventDefault(); const b=d.querySelector("[data-pvs='save']"); if(b) b.click(); } });
  pvLedgerDraw();
}
function pvSrcNames(){ const s=new Set(["Саид","Склад"]); pfArr("doccosts").forEach(dc=>{ const L=dcLines(dc); (Array.isArray(L._src)?L._src:[]).forEach(x=>x.n&&s.add(x.n)); }); return [...s]; }
function pvLedgerDraw(){
  const box=$("#pvl"); if(!box) return; const cid=PVL.cid;
  const docs=D.journal.filter(j=>j.snap && !isArch(j) && (j.customerId||"-")===cid).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:-jNumSort(a,b)).map(docProfit);
  const M=new Map(); docs.forEach(x=>{ const k=x.j.date.slice(0,7); if(!M.has(k)) M.set(k,[]); M.get(k).push(x); });
  const sum=(L,f)=>r2(L.reduce((a,x)=>a+f(x),0));
  const all={rev:sum(docs,x=>x.rev), rs:sum(docs,x=>x.rev-x.tax), cost:sum(docs,x=>x.cost+(x.exp||0)), profit:sum(docs,x=>x.profit)};
  const P=docs.map(x=>({x, p:payOf(x.j)})), due=r2(P.reduce((a,o)=>a+o.p.left,0)), nDue=P.filter(o=>o.p.left>0.005).length, PD=P.filter(o=>o.p.st==="paid"&&o.p.d), avg=PD.length?Math.round(PD.reduce((a,o)=>a+pvPayDays(o.x.j,o.p),0)/PD.length):null;
  $("#pv-srcn").innerHTML=pvSrcNames().map(n=>`<option value="${esc(n)}">`).join("");
  box.innerHTML = `<div class="pvkpi sm"><div><small>Сумма за всё время</small><b>${fm(all.rev)}</b><span>${docs.length} ${plural(docs.length,["накладная","накладные","накладных"])}</span></div><div><small>На р/с</small><b>${fm(all.rs)}</b></div><div><small>Закупка</small><b>${fm(all.cost)}</b></div><div class="pos"><small>Прибыль</small><b class="${all.profit<0?"neg":""}">${fm(all.profit)}</b><span>маржа ${pct(all.profit,all.rev)}</span></div>
      <div class="${due>0.005?"due":""}"><small>Ждём оплату</small><b>${fm(due)}</b><span>${nDue?nDue+" "+plural(nDue,["накладная","накладные","накладных"]):"всё оплачено"}${avg!=null?" · платят в среднем за "+dnum(avg):""}</span></div></div>
    <div class="pvlh"><span>Дата</span><span>№</span><span class="num">Сумма</span><span class="num">На р/с</span><span>Закупка</span><span>Оплата</span><span class="num">Прибыль</span></div>`
    + [...M.entries()].map(([m,L])=>{ const op=PVL.open.has(m), p=sum(L,x=>x.profit), miss=L.filter(x=>x.miss).length, pd=L.filter(x=>payOf(x.j).st==="paid").length;
      return `<section class="pvm ${op?"op":""}"><button type="button" class="pvmh" data-pvo="${m}" aria-expanded="${op}"><b>${pvMon(m)}</b><span>${L.length} ${plural(L.length,["накл.","накл.","накл."])} · ${fm(sum(L,x=>x.rev))} ₽</span>${miss?`<em class="pvwarn"><i></i>без закупки ${miss}</em>`:""}<em class="pvpm ${pd===L.length?"all":""}">${pvIco("check")}оплачено ${pd}/${L.length}</em><strong class="${p<0?"neg":""}">${pvMoney(p)} ₽</strong><i></i></button>
        <div class="pvmb"><div>${L.map(pvLedgerRow).join("")}</div></div></section>`; }).join("");
}
/* оплата накладной: одно нажатие — «оплачена сегодня» (дата нажатия запоминается), ещё одно — снять отметку */
const pvDiff = (a, b) => Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5);
const pvPayDays = (j, p) => Math.max(0, pvDiff(j.date, p.d));
function pvPayBtn(j){ const p=payOf(j);
  if(p.st==="paid"){ const d=pvPayDays(j,p); return `<button type="button" class="pvpay paid" data-pvpay="${j.id}" title="Оплачена ${fd(p.d)} — через ${dnum(d)} после накладной. Нажмите, чтобы снять отметку"><span>${pvIco("check")}Оплачена</span><small>${fd(p.d).slice(0,5)} · ${d?"за "+dnum(d):"в день накладной"}</small></button>`; }
  const age=j.date>todayISO()?0:daysSince(j.date), cls=ageCls(age);
  return `<button type="button" class="pvpay ${p.st} ${cls}" data-pvpay="${j.id}" title="Нажмите, когда пришла оплата — сайт запомнит сегодняшнюю дату"><span><i></i>${p.st==="part"?"Частично":"Не оплачена"}</span><small>${p.st==="part"?"осталось "+fm(p.left):ageTxt(j.date)}</small></button>`; }
function pvLedgerRow(x){ const j=x.j, src=pvSrc(j), ed=PVL.ed===j.id, rs=r2(x.rev-x.tax);
  const chips = (src ? src.map(s=>`<span class="pvchip">${esc(s.n||"—")} <b>${fm(+s.s||0)}</b></span>`).join("")
    : x.miss ? `<span class="pvchip miss">+ вписать закупку</span>` : `<span class="pvchip prod" title="Закупка посчитана по товарам">по товарам <b>${fm(x.cost)}</b></span>`)+(x.exp?`<span class="pvchip" title="Прочие расходы: доставка, грузчики, телега">расходы <b>${fm(x.exp)}</b></span>`:"");
  return `<div class="pvr ${ed?"ed":""}" data-pvr="${j.id}"><div class="pvrl" role="button" tabindex="0" data-pve="${j.id}" aria-expanded="${ed}">
      <span class="pvd">${fd(j.date).slice(0,5)}</span><span class="pvn">№ ${esc(j.number)}</span><span class="num">${fm(x.rev)}</span><span class="num muted">${fm(rs)}</span><span class="pvsrcs">${chips}</span>${pvPayBtn(j)}<span class="num pvp ${x.profit<0?"neg":""}">${fm(x.profit)}</span></div>
    <div class="pvrx"><div>${ed?pvEditor(x):""}</div></div></div>`; }
function pvEditor(x){ const j=x.j, src=pvSrc(j)||[], rows=src.length?src:[{n:"",s:""}];
  return `<div class="pvedit"><div class="pvet"><b>Закупка по накладной № ${esc(j.number)}</b><span class="muted">от кого купили — и на какую сумму</span></div>
    <div class="pvsrc" id="pvsrc">${rows.map(pvSrcRow).join("")}</div>
    <div class="pvquick">${pvSrcNames().slice(0,8).map(n=>`<button type="button" class="pvq" data-pvs="add" data-n="${esc(n)}">+ ${esc(n)}</button>`).join("")}<button type="button" class="pvq ghost" data-pvs="add" data-n="">+ Другой</button></div>
    <div class="pvcalc" id="pvcalc"></div>
    <div class="pvea"><button type="button" class="btn pri" data-pvs="save">Сохранить</button><button type="button" class="btn ghost" data-pvs="cancel">Отмена</button>
      ${src.length?`<button type="button" class="btn ghost danger" data-pvs="clear">Убрать</button>`:""}<span style="flex:1"></span><button type="button" class="btn sm" data-pvs="prod" title="Закупка по каждому товару — как раньше">Подробно по товарам ›</button></div>
    ${src.length?"":x.miss?"":`<p class="muted pvhint">Сейчас закупка ${fm(x.cost)} ₽ посчитана по товарам. Если впишете суммы здесь — они заменят расчёт по товарам.</p>`}</div>`; }
const pvSrcRow = s => `<div class="pvsr"><input class="pvsn" list="pv-srcn" placeholder="От кого (Саид, Склад…)" value="${esc(s.n||"")}"><input class="pvss" inputmode="decimal" placeholder="0,00" value="${s.s!==""&&s.s!=null?esc(String(s.s).replace(".",",")):""}"><span>₽</span><button type="button" class="pvsx" data-pvs="del" aria-label="Убрать строку">×</button></div>`;
function pvEdRows(){ return [...document.querySelectorAll("#pvsrc .pvsr")].map(r=>({n:r.querySelector(".pvsn").value.trim(), s:num(r.querySelector(".pvss").value)})); }
function pvCalc(){ const el=$("#pvcalc"); if(!el) return; const j=D.journal.find(x=>x.id===PVL.ed); if(!j) return; const x=docProfit(j);
  const c=r2(pvEdRows().reduce((a,r)=>a+(+r.s||0),0)), p=r2(x.rev-x.tax-c-x.exp);
  el.innerHTML=`<div><small>Сумма</small><b>${fm(x.rev)}</b></div><div><small>На р/с</small><b>${fm(r2(x.rev-x.tax))}</b></div><div><small>Закупка${x.exp?" с расходами":""}</small><b>${fm(r2(c+x.exp))}</b>${x.exp?`<span>+ расходы ${fm(x.exp)}</span>`:""}</div><div class="pos"><small>Прибыль</small><b class="${p<0?"neg":""}">${fm(p)}</b><span>${pct(p,x.rev)}</span></div>`; }
function pvLedgerInput(e){ if(e.target.closest("#pvsrc")) pvCalc(); }
function pvLedgerClick(e){
  const pb=e.target.closest("[data-pvpay]"); if(pb){ e.stopPropagation(); const j=D.journal.find(x=>x.id===pb.dataset.pvpay); if(!j) return; const p=payOf(j);
    if(p.st==="paid"){ setPay(j, 0); toast("info","Отметка об оплате снята","№ "+j.number+" снова ждёт оплату."); }
    else { setPay(j, p.tot, todayISO()); const d=Math.max(0,pvDiff(j.date,todayISO())); toast("ok","Оплачена","№ "+j.number+" · "+fm(p.tot)+" ₽ · "+(d?"через "+dnum(d)+" после накладной":"в день накладной")); }
    saveLocal(); const st=document.querySelector("#fd-dcard")?.scrollTop; pvLedgerDraw(); const dd=$("#fd-dcard"); if(dd&&st!=null) dd.scrollTop=st;
    const nb=document.querySelector(`[data-pvpay="${j.id}"]`); if(nb){ nb.classList.add("pop"); }
    if(curTab==="profit") drawProfit(); return; }
  const o=e.target.closest("[data-pvo]"); if(o){ const m=o.dataset.pvo; PVL.open.has(m)?PVL.open.delete(m):PVL.open.add(m); o.closest(".pvm").classList.toggle("op"); o.setAttribute("aria-expanded", PVL.open.has(m)); return; }
  const r=e.target.closest("[data-pve]"); if(r){ const id=r.dataset.pve; PVL.ed = PVL.ed===id ? "" : id; pvLedgerDraw(); if(PVL.ed){ pvCalc(); const row=document.querySelector(`[data-pvr="${id}"]`); setTimeout(()=>{ row&&row.scrollIntoView({block:"nearest", behavior:"smooth"}); const i=row&&row.querySelector(".pvss"); if(i && !i.value) row.querySelector(".pvsn").value ? i.focus() : row.querySelector(".pvsn").focus(); }, 60); } return; }
  const b=e.target.closest("[data-pvs]"); if(!b) return; const a=b.dataset.pvs, j=D.journal.find(x=>x.id===PVL.ed); if(!j) return;
  if(a==="add"){ const box=$("#pvsrc"), emp=[...box.querySelectorAll(".pvsr")].find(r=>!r.querySelector(".pvsn").value.trim() && !r.querySelector(".pvss").value.trim());
    if(emp){ emp.querySelector(".pvsn").value=b.dataset.n; } else box.insertAdjacentHTML("beforeend", pvSrcRow({n:b.dataset.n, s:""}));
    const row=emp||box.lastElementChild; row.classList.add("fresh"); (b.dataset.n ? row.querySelector(".pvss") : row.querySelector(".pvsn")).focus(); return; }
  if(a==="del"){ const row=b.closest(".pvsr"); if($("#pvsrc").children.length>1) row.remove(); else { row.querySelector(".pvsn").value=""; row.querySelector(".pvss").value=""; } pvCalc(); return; }
  if(a==="cancel"){ PVL.ed=""; pvLedgerDraw(); return; }
  if(a==="prod"){ const d=$("#fd-dcard"); if(d){ d.classList.add("out"); setTimeout(()=>{ try{ d.close(); }catch(x){} d.remove(); docCard(j); setTimeout(()=>{ const t=document.querySelector('#fd-dcard [data-zkc="toggle"]'); if(t) t.click(); }, 80); }, 200); } return; }
  const dc=dcUpsert(j), L=dcLines(dc);
  if(a==="clear"){ delete L._src; dc.lines=JSON.stringify(L); dirty("doccosts", dc.id); logEv("Прибыль","Убрана быстрая закупка: накладная № "+j.number+" от "+fd(j.date)+" — "+jWho(j).main); saveLocal(); PVL.ed=""; pvLedgerDraw(); drawProfit(); toast("ok","Закупка убрана","Снова считается по товарам."); return; }
  if(a==="save"){ const rows=pvEdRows().filter(r=>r.n || r.s!=="");
    const bad=rows.find(r=>r.s==="" || isNaN(+r.s) || +r.s<0); if(bad){ toast("err","Проверьте сумму", (bad.n||"Строка")+": впишите сумму закупки."); return; }
    const noName=rows.find(r=>!r.n); if(noName){ toast("err","От кого закупка?","Впишите, например, «Саид» или «Склад»."); return; }
    if(!rows.length){ delete L._src; } else L._src=rows.map(r=>({n:r.n, s:String(r2(+r.s))}));
    dc.lines=JSON.stringify(L); dirty("doccosts", dc.id);
    logEv("Прибыль","Закупка по накладной № "+j.number+" от "+fd(j.date)+" — "+jWho(j).main+": "+(rows.length?rows.map(r=>r.n+" "+fm(+r.s)).join(", "):"убрана"));
    saveLocal(); PVL.ed=""; pvLedgerDraw(); drawProfit(); const x=docProfit(j); toast("ok","Закупка сохранена","№ "+j.number+": закупка "+fm(x.cost)+" ₽, прибыль "+fm(x.profit)+" ₽");
    const row=document.querySelector(`[data-pvr="${j.id}"]`); if(row) row.classList.add("saved"); }
}

/* ---------- Расходы и доходы ---------- */
/* «Расходы и доходы»: записи `pother` трёх видов — Расход, Доход (бизнес, с категориями) и Личное (без категории, kind = PO_PER).
   Личные в прибыль бизнеса не входят (poFor их не берёт). Итог месяца (pvFinTot): прибыль с накладных + доходы − расходы = «бизнес заработал»,
   − личные = «остаётся вам». Вид «Список | Календарь», фильтр по виду и дню, сравнение с прошлым месяцем, лимит личных (prefs.perLim), выгрузка в Excel. */
const pvKind = x => x.kind===PO_INC ? "inc" : x.kind===PO_PER ? "per" : "exp";
const PV_KN = {exp:"Расходы", inc:"Доходы", per:"Личные"};
const PV_PERC = {id:"__per", n:"Личное", i:"user", h:285, k:"per"};
const pvCatOf = x => pvKind(x)==="per" ? PV_PERC : pvCat(x.cat);
function pvFinTot(d1, d2){
  const docs=D.journal.filter(j=>j.snap && !isArch(j) && j.date>=d1 && j.date<=d2).map(docProfit);
  const dp=r2(docs.reduce((a,x)=>a+x.rev-x.cost-x.tax-x.exp,0)), miss=docs.filter(x=>x.miss).length;
  const L=pfArr("pother").filter(x=>x.date>=d1 && x.date<=d2), s=k=>r2(L.filter(x=>pvKind(x)===k).reduce((a,x)=>a+(+x.sum||0),0));
  const E=s("exp"), I=s("inc"), P=s("per"), B=r2(dp+I-E);
  const DL=docs.map(x=>{ const pr=r2(x.rev-x.cost-x.tax-x.exp), pay=payOf(x.j), fr=pay.tot>0?Math.min(1, pay.s/pay.tot):0, pd=r2(pr*fr);
    return {j:x.j, date:x.j.date, p:pr, paid:pd, due:r2(pr-pd), pay, st:pay.st, miss:x.miss}; });
  const dpPaid=r2(DL.reduce((a,x)=>a+x.paid,0));
  return {docs:docs.length, dp, dpPaid, dpDue:r2(dp-dpPaid), miss, E, I, P, B, R:r2(B-P), L, DL}; }
/* строка накладной в ленте: прибыль, оплачена (зелёная) или ждём оплату (светло-зелёная) */
function pvDocRow(x){ const j=x.j, c=cus(j.customerId), st=x.st, nm=(c.name?cusShort(c.name):"Заказчик");
  const sub = st==="paid" ? "оплачена"+(x.pay.d?" "+fd(x.pay.d).slice(0,5):"") : st==="part" ? "оплачено "+fm(x.pay.s)+" из "+fm(x.pay.tot) : "ждём оплату · "+ageTxt(j.date);
  return `<button type="button" class="pvit k-doc ${st==="paid"?"paid":"due"}" data-pvdoc="${esc(j.id)}"><span class="pvb pvdb ${st==="paid"?"paid":"due"}">${pvIco("box")}</span><span class="pvitn"><b>${esc(nm)} · № ${esc(j.number)}</b><small><span class="pvst ${st==="paid"?"paid":"due"}">${esc(sub)}</span> · продажа ${fm(x.pay.tot)}${x.miss?` · <em class="warn">без закупки</em>`:""}</small></span><span class="pvits ${st==="paid"?"pos":"due"}">${pvMoney(x.p,true)} ₽</span></button>`; }
const pvCmp = (now, was, good) => { if(!was || Math.abs(was)<0.5) return ""; const d=(now-was)/Math.abs(was)*100; if(Math.abs(d)<0.5) return `<span class="pvcmp">как в прошлом месяце</span>`;
  const up=d>0, ok=good==="up"?up:!up; return `<span class="pvcmp ${ok?"good":"bad"}">${up?"▲":"▼"} ${Math.abs(d).toFixed(0)}% к прошлому месяцу</span>`; };
function pvFinDraw(){
  const box=$("#pv-fin"), f=PV(), [d1,d2]=pvRange(), mon=pvMonth(), cats=pvCats(); f.fk=f.fk||""; f.fv=f.fv||"list";
  if(f.fday && (f.fday<d1 || f.fday>d2)) f.fday="";
  const cal = f.fv==="cal" && mon!=="all", T=pvFinTot(d1,d2), all=T.L;
  const W = mon!=="all" ? (()=>{ const pm=pvShift(mon,-1), [a,b]=[pm+"-01", jIso(new Date(+pm.slice(0,4), +pm.slice(5,7), 0))]; return pvFinTot(a,b); })() : null;
  const by=(list)=>{ const m=new Map(); list.forEach(x=>{ const c=pvCat(x.cat); const k=c.id; if(!m.has(k)) m.set(k,{c, s:0, n:0}); const g=m.get(k); g.s+=(+x.sum||0); g.n++; }); return [...m.values()].sort((a,b)=>b.s-a.s); };
  const byNote=(list)=>{ const m=new Map(); list.forEach(x=>{ const k=(x.note||"Без описания").trim(), kk=k.toLowerCase(); if(!m.has(kk)) m.set(kk,{c:Object.assign({},PV_PERC,{id:kk,n:k}), s:0, n:0}); const g=m.get(kk); g.s+=(+x.sum||0); g.n++; }); return [...m.values()].sort((a,b)=>b.s-a.s).slice(0,8); };
  const bars=(list, tot, kind)=> list.length ? list.map((g,i)=>`<button type="button" class="pvcb ${f.fcat===kind+":"+g.c.id?"on":""}" data-pvf="${kind}:${esc(g.c.id)}" style="--d:${i*40}ms">${pvBubble(g.c)}<span class="pvcbn"><b>${esc(g.c.n)}</b><small>${g.n} ${plural(g.n,["запись","записи","записей"])}</small></span><span class="pvcbs"><b>${fm(r2(g.s))}</b><small>${pct(g.s,tot)}</small></span><i class="pvcbb"><i style="width:${tot?Math.max(2,g.s/tot*100):0}%;background:${pvCol(g.c.h,.75)}"></i></i></button>`).join("") : `<p class="muted pvnone">Пока ничего</p>`;
  const inF = x => { const k=pvKind(x); if(f.fk && k!==f.fk) return false; if(cal && f.fday && x.date!==f.fday) return false;
    if(f.fcat){ const [fk,id]=f.fcat.split(":"); if(fk!==k) return false; if(k==="per") return (x.note||"Без описания").trim().toLowerCase()===id; return pvCat(x.cat).id===id; } return true; };
  const L=all.filter(inF).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const showDocs = !f.fcat && (!f.fk || f.fk==="inc"), DLs = showDocs ? T.DL.filter(x=>!(cal && f.fday) || x.date===f.fday) : [];
  const days=new Map(), dd=new Map(); L.forEach(x=>{ if(!days.has(x.date)) days.set(x.date,[]); days.get(x.date).push(x); });
  DLs.forEach(x=>{ if(!days.has(x.date)) days.set(x.date,[]); if(!dd.has(x.date)) dd.set(x.date,[]); dd.get(x.date).push(x); });
  const dayKeys=[...days.keys()].sort((a,b)=>a<b?1:a>b?-1:0);
  const fc = f.fcat ? (f.fcat.startsWith("per:") ? Object.assign({},PV_PERC,{n:(all.find(x=>pvKind(x)==="per" && (x.note||"Без описания").trim().toLowerCase()===f.fcat.slice(4))||{}).note||"Личное"}) : pvCat(f.fcat.split(":")[1])) : null;
  const nd = mon==="all" ? 0 : mon===todayISO().slice(0,7) ? +todayISO().slice(8,10) : mon<todayISO().slice(0,7) ? new Date(+mon.slice(0,4), +mon.slice(5,7), 0).getDate() : 0;
  const lim=+(getPrefs().perLim||0), limP = lim>0 ? Math.min(100, T.P/lim*100) : 0;
  const nDocs=T.DL.filter(x=>!cal || !f.fday || x.date===f.fday).length, cnt=k=>all.filter(x=>pvKind(x)===k && (!cal || !f.fday || x.date===f.fday)).length + (k==="inc"?nDocs:0);
  const seg=`<div class="fdseg pvfv" role="group" aria-label="Вид"><i style="--x:${cal?"100%":"0%"}"></i><button type="button" data-pvv="list" class="${cal?"":"on"}" aria-pressed="${!cal}">Список</button><button type="button" data-pvv="cal" class="${cal?"on":""}" aria-pressed="${cal}">Календарь</button></div>`;
  const row=(lbl, v, sub, cls, w)=>`<div class="pvfr ${cls||""}"><span class="pvfl">${lbl}${sub?`<small>${sub}</small>`:""}</span><b>${pvMoney(v,true)}</b><i class="pvfb"><i style="--w:${w}%"></i></i></div>`;
  const mx=Math.max(1, Math.abs(T.dp), T.I, T.E, T.P, Math.abs(T.B));
  box.innerHTML = `<div class="pvhead"><div><h2>Расходы и доходы</h2><small class="muted">Всё, что не закупка товара, и отдельно — личные траты</small></div>${pvMonBar()}</div>
    <div class="pvacts"><button type="button" class="pvadd exp" data-pva="exp"><span>−</span>Расход</button><button type="button" class="pvadd inc" data-pva="inc"><span>+</span>Доход</button><button type="button" class="pvadd per" data-pva="per"><span>${pvIco("user")}</span>Личное</button><span style="flex:1"></span>${seg}<button type="button" class="btn ghost sm" data-pva="xls" title="Скачать записи месяца в Excel">${pvIco("doc")}Excel</button><button type="button" class="btn ghost sm" data-pva="cats">${pvIco("gear")}Категории</button></div>
    ${D.poSrv?"":`<p class="note">Пока скрипт таблицы старый, записи хранятся только на этом устройстве. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>`}
    ${pvCatOk()?"":`<p class="note">Категории начнут сохраняться после обновления скрипта таблицы (Code.gs, версия 15). <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>`}
    ${cal ? pvFinCal(all.filter(x=>!f.fk || pvKind(x)===f.fk), mon, !f.fk || f.fk==="inc" ? T.DL : []) : (f.fv==="cal" ? `<p class="muted bncalno">Календарь — по месяцам: выберите месяц стрелками сверху.</p>` : "")}
    <div class="pvsum2">
      <div class="pvflow">
        ${row("Прибыль с накладных", T.dp, T.docs+" "+plural(T.docs,["накладная","накладные","накладных"])+" · после закупки и налога"+(T.miss?` · <button type="button" class="pvmiss" data-pvmiss title="Открыть эти накладные во вкладке «Закупка» и заполнить">без закупки: ${T.miss} ›</button>`:"")+(T.docs?`<span class="pvpd"><span class="paid"><i></i>оплачено ${fm(T.dpPaid)}</span><span class="due"><i></i>ждём оплату ${fm(T.dpDue)}</span></span>`:""), T.dp<0?"neg":"pos", Math.abs(T.dp)/mx*100)}
        ${row("Прочие доходы", T.I, "", "pos", T.I/mx*100)}
        ${row("Расходы", -T.E, "", "neg", T.E/mx*100)}
        <div class="pvfr tot"><span class="pvfl">Бизнес заработал${W?pvCmp(T.B,W.B,"up"):""}</span><b class="${T.B<0?"neg":""}">${pvMoney(T.B,true)}</b></div>
        ${row("Личные расходы", -T.P, "", "per", T.P/mx*100)}
      </div>
      <div class="pvres ${T.R<0?"neg":""}"><small>Остаётся вам</small><b>${pvMoney(T.R,true)} <em>₽</em></b><span>бизнес заработал ${fm(T.B)} − личные ${fm(T.P)}</span>${W?pvCmp(T.R,W.R,"up"):""}
        ${nd?`<div class="pvavg"><div><small>В среднем за день</small></div><div><span>бизнес</span><b class="${T.B<0?"neg":""}">${pvMoney(r2(T.B/nd),true)}</b></div><div><span>личные</span><b class="per">${fm(r2(T.P/nd))}</b></div>${W&&W.P>0?`<div><span>личные в прошлом месяце</span><b>${fm(W.P)}</b></div>`:""}</div>`:""}
        <div class="pvlim ${lim&&T.P>lim?"over":""}">${lim?`<div class="pvlimt"><span>Личные: <b>${fm(T.P)}</b> из ${fm(lim)} ₽</span><button type="button" class="pvlink" data-pva="lim">изменить</button></div><i class="pvlimb"><i style="--w:${limP}%"></i></i><small>${T.P>lim?"лимит превышен на "+fm(r2(T.P-lim))+" ₽":"можно ещё "+fm(r2(lim-T.P))+" ₽"}</small>`:`<button type="button" class="pvlink" data-pva="lim">+ Задать лимит личных трат на месяц</button>`}</div></div>
    </div>
    <div class="pvcats three"><div><h3>Расходы по категориям</h3>${bars(by(all.filter(x=>pvKind(x)==="exp")),T.E,"exp")}</div><div><h3>Доходы по категориям</h3>${bars(by(all.filter(x=>pvKind(x)==="inc")),T.I,"inc")}</div><div><h3>Личные — на что</h3>${bars(byNote(all.filter(x=>pvKind(x)==="per")),T.P,"per")}</div></div>
    <div class="pfchips pvfk">${[["","Все",all.filter(x=>!cal || !f.fday || x.date===f.fday).length+nDocs],["exp","Расходы",cnt("exp")],["inc","Доходы",cnt("inc")],["per","Личные",cnt("per")]].map(([k,l,n])=>`<button type="button" data-pvfk="${k}" class="${f.fk===k?"on":""} k-${k||"all"}" aria-pressed="${f.fk===k}">${l}<i>${n}</i></button>`).join("")}</div>
    ${fc?`<div class="pvfilt">Показано: ${pvBubble(fc)} <b>${esc(fc.n)}</b><button type="button" class="btn ghost sm" data-pvf="">Показать всё ×</button></div>`:""}
    <div class="pvlist">${days.size ? dayKeys.map((d,di)=>{ const xs=days.get(d), ds=dd.get(d)||[], t=r2(xs.reduce((a,x)=>a+(pvKind(x)==="inc"?1:-1)*(+x.sum||0),0)+ds.reduce((a,x)=>a+x.p,0));
      return `<div class="pvday" style="--d:${Math.min(di,10)*35}ms"><div class="pvdh"><b>${pvDay(d)}</b><span class="${t<0?"neg":ds.some(x=>x.st!=="paid")?"due":"pos"}">${pvMoney(t,true)} ₽</span></div>${ds.map(pvDocRow).join("")}${xs.map(x=>{ const k=pvKind(x), c=pvCatOf(x), s=+x.sum||0;
        return `<button type="button" class="pvit k-${k}" data-pvx="${esc(x.id)}">${pvBubble(c)}<span class="pvitn"><b>${esc(x.note||c.n)}</b><small>${k==="per"?`<span class="pvtag">личное</span>`:esc(c.n)}${x.supplierId?" · "+esc(supShort(sup(x.supplierId).name||"")):""}${x.by?" · "+esc(x.by):""}</small></span><span class="pvits ${k==="inc"?"pos":k==="per"?"per":"neg"}">${pvMoney(k==="inc"?s:-s,true)} ₽</span></button>`; }).join("")}</div>`; }).join("")
      : `<div class="pvempty">${pvIco("receipt","big")}<b>${all.length?"Здесь записей нет":"За этот месяц записей нет"}</b><small>${all.length?"Выберите другой фильтр или день.":"Нажмите «− Расход», «+ Доход» или «Личное», чтобы добавить."}</small></div>`}</div>`;
}
function pvFinCal(list, ym, dl){
  const f=PV(), y=+ym.slice(0,4), m=+ym.slice(5,7), days=new Date(y,m,0).getDate(), first=(new Date(y,m-1,1).getDay()+6)%7, t=todayISO(), by={}, bd={}, cells=[];
  list.forEach(x=>{ (by[x.date]=by[x.date]||[]).push(x); }); (dl||[]).forEach(x=>{ (bd[x.date]=bd[x.date]||[]).push(x); });
  for(let i=0;i<first;i++) cells.push(`<span class="zkc-e" aria-hidden="true"></span>`);
  for(let d=1; d<=days; d++){ const iso=ym+"-"+String(d).padStart(2,"0"), I=by[iso]||[], wd=(first+d-1)%7;
    const G=bd[iso]||[];
    if(!I.length && !G.length){ cells.push(`<button type="button" class="zkc-d empty pvcd${iso===t?" today":""}${wd>4?" we":""}" data-pvday="${iso}" data-pvnew="1" title="Добавить запись на ${fd(iso)}"><i>${d}</i><span class="pvcplus">+</span></button>`); continue; }
    const net=r2(I.reduce((a,x)=>a+(pvKind(x)==="inc"?1:-1)*(+x.sum||0),0)+G.reduce((a,x)=>a+x.p,0)), due=G.some(x=>x.st!=="paid"), n=I.length+G.length;
    const dcls = G.length ? (due ? " ddue" : " dok") : "";
    const dots=G.map(x=>`<b class="k-${x.st==="paid"?"inc":"due"}"></b>`).concat(I.map(x=>`<b class="k-${pvKind(x)}"></b>`)), dt=dots.slice(0,8).join("")+(dots.length>8?`<em>+${dots.length-8}</em>`:"");
    cells.push(`<button type="button" class="zkc-d pvcd has${dcls}${iso===f.fday?" sel":""}${iso===t?" today":""}${wd>4?" we":""}" data-pvday="${iso}" aria-pressed="${iso===f.fday}" title="${esc(fd(iso)+": "+(G.length?G.length+" "+plural(G.length,["накладная","накладные","накладных"])+(due?" (ждём оплату)":" (оплачено)")+", ":"")+(I.length?I.length+" "+plural(I.length,["запись","записи","записей"])+", ":"")+"итого "+pvMoney(net,true)+" ₽")}"><i>${d}</i><span class="zkc-s pvcs ${net<0?"neg":due?"due":"pos"}"><span class="pvcl">${pvMoney(Math.round(net),true).replace(/,00$/,"")}</span><span class="pvcsh">${(net<0?"−":"+")+(Math.abs(net)>=1000?String(+(Math.abs(net)/1000).toFixed(Math.abs(net)<10000?1:0)).replace(".",",")+"к":Math.round(Math.abs(net)))}</span></span><span class="zkc-n">${G.length?G.length+" нак.":""}${G.length&&I.length?" · ":""}${I.length?I.length+" зап.":""}</span><span class="zkc-dots">${dt}</span></button>`); }
  return `<div class="bncal pvcal"><div class="zkc-h"><span class="zkc-leg"><span><b class="k-inc"></b>доход получен</span><span><b class="k-due"></b>ждём оплату</span><span><b class="k-exp"></b>расход</span><span><b class="k-per"></b>личное</span></span></div>
    <div class="zkc-w">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>`<span>${x}</span>`).join("")}</div><div class="zkc-g">${cells.join("")}</div>
    ${f.fday?`<p class="zkc-f">Показаны записи за <b>${fd(f.fday)}</b> · <button type="button" class="btn ghost sm" data-pvday="${f.fday}">Весь месяц</button> <button type="button" class="btn ghost sm" data-pvday="${f.fday}" data-pvnew="1">+ Запись на этот день</button></p>`:`<p class="zkc-f muted">Доход — прибыль с накладных по дню поставки: зелёный — деньги пришли, светло-зелёный — товар отвезли, ждём оплату. Нажмите на день — ниже останутся его записи; пустой день — сразу новая запись.</p>`}</div>`;
}
async function pvFinXls(){
  try{ const X=await loadXLSX(), [d1,d2]=pvRange(), m=pvMonth(), L=pfArr("pother").filter(x=>x.date>=d1 && x.date<=d2).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
    if(!L.length){ toast("info","Нечего выгружать","За этот период записей нет."); return; }
    const T=pvFinTot(d1,d2), aoa=[["Расходы и доходы — "+(m==="all"?"все месяцы":pvMon(m))],[],["Дата","Вид","Категория","На что / откуда","ИП","Сумма, ₽","Кто добавил"],
      ...L.map(x=>{ const k=pvKind(x); return [fd(x.date), k==="inc"?"Доход":k==="per"?"Личное":"Расход", k==="per"?"":pvCat(x.cat).n, x.note||"", x.supplierId?(sup(x.supplierId).name||""):"Общие", (k==="inc"?1:-1)*(+x.sum||0), x.by||""]; }),
      [],["","","","Прибыль с накладных","",T.dp],["","","","Прочие доходы","",T.I],["","","","Расходы","",-T.E],["","","","Бизнес заработал","",T.B],["","","","Личные","",-T.P],["","","","Остаётся","",T.R]];
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:11},{wch:9},{wch:18},{wch:40},{wch:30},{wch:13},{wch:12}];
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Записи"); X.writeFile(wb,"Расходы и доходы — "+(m==="all"?"все месяцы":pvMon(m))+".xlsx");
    toast("ok","Excel скачан", L.length+" "+plural(L.length,["запись","записи","записей"])+" — ищите в «Загрузках».");
  }catch(e){ toast("err","Не получилось выгрузить", e.message); } }
function pvLimOpen(){ const lim=+(getPrefs().perLim||0);
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Личные траты</div><h3>Лимит на месяц</h3><div class="dc-sub">Сколько вы готовы тратить на себя за месяц. Сайт покажет, сколько ещё можно, и подсветит, если вышли за лимит.</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="pvform"><label class="pvsum"><span>Лимит</span><input id="pvl-sum" inputmode="decimal" placeholder="0" value="${lim?esc(pvGrp(String(lim))):""}" autocomplete="off"><em>₽</em></label>
    <div class="pvea"><button type="button" class="btn pri" data-pvl="save">Сохранить</button><button type="button" class="btn ghost" data-dc="close">Отмена</button><span style="flex:1"></span>${lim?`<button type="button" class="btn ghost danger" data-pvl="off">Убрать лимит</button>`:""}</div></div>`, false, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("pvi-d");
  const go=off=>{ const v=off?0:+num($("#pvl-sum").value)||0; const p=getPrefs(); if(v>0) p.perLim=r2(v); else delete p.perLim; setPrefs(p,true); pvCloseCard(); pvFinDraw(); toast("ok", v>0?"Лимит сохранён":"Лимит убран", v>0?fm(v)+" ₽ в месяц":""); };
  d.addEventListener("click", e=>{ const b=e.target.closest("[data-pvl]"); if(b) go(b.dataset.pvl==="off"); });
  d.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.id==="pvl-sum"){ e.preventDefault(); go(false); } });
  setTimeout(()=>{ const s=$("#pvl-sum"); if(s){ s.focus(); s.select(); } }, 60); }
function pvFinClick(e){
  const m=e.target.closest("[data-pvm]"); if(m){ pvMonClick(m); return; }
  const v=e.target.closest("[data-pvv]"); if(v){ const f=PV(); f.fv=v.dataset.pvv; f.fday=""; if(f.fv==="cal" && pvMonth()==="all") f.m=todayISO().slice(0,7); saveLocal(); pvFinDraw(); return; }
  const dy=e.target.closest("[data-pvday]"); if(dy){ const f=PV(), iso=dy.dataset.pvday; if(dy.dataset.pvnew){ pvItemOpen(null, f.fk||"exp", iso); return; } f.fday = f.fday===iso ? "" : iso; saveLocal(); pvFinDraw(); return; }
  const fk=e.target.closest("[data-pvfk]"); if(fk){ const f=PV(); f.fk=fk.dataset.pvfk; if(f.fcat && f.fk && !f.fcat.startsWith(f.fk+":")) f.fcat=""; saveLocal(); pvFinDraw(); return; }
  const f=e.target.closest("[data-pvf]"); if(f){ const k=f.dataset.pvf; PV().fcat = PV().fcat===k ? "" : k; saveLocal(); pvFinDraw(); return; }
  const a=e.target.closest("[data-pva]"); if(a){ const k=a.dataset.pva; if(k==="cats") pvCatsOpen(); else if(k==="xls") pvFinXls(); else if(k==="lim") pvLimOpen(); else pvItemOpen(null, k); return; }
  if(e.target.closest("[data-pvmiss]")){ const m=pvMonth(), [a,b]=pvRange(); tabBackFrom("Прибыль", ()=>zkpGoMiss(a, b, m==="all"?"за всё время":"за "+pvMon(m).toLowerCase())); return; }
  const dj=e.target.closest("[data-pvdoc]"); if(dj){ const j=D.journal.find(y=>y.id===dj.dataset.pvdoc); if(j) docCard(j, false); return; }
  const x=e.target.closest("[data-pvx]"); if(x){ const it=pfArr("pother").find(y=>y.id===x.dataset.pvx); if(it) pvItemOpen(it); }
}
let PVI=null;
function pvItemOpen(it, kind, date, copy){
  const k = it ? pvKind(it) : (kind==="inc"||kind==="per" ? kind : "exp"); PVI={id:it&&!copy?it.id:"", k, inc:k==="inc", cat:it&&k!=="per"?(it.cat||""):"", rows:[]};
  const m=pvMonth(), dDef = date || (m!=="all" && todayISO().slice(0,7)!==m ? m+"-01" : todayISO()), ed=it&&!copy;
  const notes=[...new Set(pfArr("pother").map(x=>x.note).filter(Boolean))].slice(-80).reverse();
  openCard(`<div class="dc-head"><div><div class="dc-kicker">${ed?"Изменить запись":copy?"Повтор записи":"Новая запись"}</div><h3 id="pvi-t">${PV_KT[k]}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="pvform k-${k}" id="pvi-f">
      <div class="pvkind three" id="pvi-kind" style="--i:${["exp","inc","per"].indexOf(k)}"><i></i><button type="button" data-pvk="exp" class="${k==="exp"?"on":""}">− Расход</button><button type="button" data-pvk="inc" class="${k==="inc"?"on":""}">+ Доход</button><button type="button" data-pvk="per" class="${k==="per"?"on":""}">Личное</button></div>
      <p class="pvperh">Личные траты не уменьшают прибыль бизнеса — они вычитаются отдельно, в «Остаётся вам».</p>
      <label class="pvsum"><span>Сумма</span><input id="pvi-sum" inputmode="decimal" placeholder="0" value="${it?esc(pvGrp(String(it.sum))):""}" autocomplete="off"><em>₽</em></label>
      <div class="pvcatl"><span>Категория</span>${pvCatOk()?"":`<small class="muted">сохранится после обновления скрипта таблицы</small>`}<div class="pvcg" id="pvi-cats"></div></div>
      <div class="grid pvdn"><label class="f">Дата<input type="date" id="pvi-date" value="${ed?esc(it.date):dDef}"></label>
        <label class="f wide"><span id="pvi-nl">${k==="inc"?"Откуда":"На что"}</span><input id="pvi-note" list="pvi-notes" maxlength="200" placeholder="${PV_PH[k]}" value="${it?esc(it.note||""):""}"><datalist id="pvi-notes">${notes.map(n=>`<option value="${esc(n)}">`).join("")}</datalist></label></div>
      <p class="pvhint" id="pvi-hint" hidden></p>
      ${ed?"":`<div class="pvxs-w" id="pvi-rows"></div><div class="pvxadd"><button type="button" class="pvmore" data-pvi="row"><span>+</span>Ещё строка</button><span class="pvxtot" id="pvi-tot"></span></div>`}
      <div class="pvea"><button type="button" class="btn pri" data-pvi="save">${ed?"Сохранить":"Добавить"}</button><button type="button" class="btn ghost" data-dc="close">Отмена</button><span style="flex:1"></span>${ed?`<button type="button" class="btn ghost" data-pvi="copy" title="Новая такая же запись с сегодняшней датой">Повторить</button><button type="button" class="btn ghost danger" data-pvi="del">Удалить</button>`:""}</div>
    </div>`, false, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("pvi-d"); pvItemCats();
  d.addEventListener("click", pvItemClick); d.addEventListener("keydown", e=>{ if(e.key!=="Enter") return; const r=e.target.closest(".pvxr");
    if(r && !(e.ctrlKey||e.metaKey)){ e.preventDefault(); if(e.target.classList.contains("pvxs") && r===d.querySelector(".pvxr:last-child")) pvRowAdd(); else { const f=[...d.querySelectorAll(".pvxr input")], i=f.indexOf(e.target); if(f[i+1]) f[i+1].focus(); } return; }
    if(r || /pvi-(sum|note)/.test(e.target.id)){ e.preventDefault(); pvItemSave(); } });
  d.addEventListener("input", e=>{ if(e.target.id==="pvi-note") pvItemNote();
    if(e.target.classList.contains("pvxn")){ const r=e.target.closest(".pvxr"), sel=r.querySelector(".pvxc"), n=e.target.value.trim().toLowerCase(); if(sel && n){   /* как в прошлый раз с тем же текстом */
      const last=pfArr("pother").filter(x=>(x.note||"").trim().toLowerCase()===n && pvKind(x)===PVI.k && x.cat).sort((a,b)=>a.date<b.date?1:-1)[0];
      if(last && [...sel.options].some(o=>o.value===last.cat)){ sel.value=last.cat; const x=PVI.rows.find(y=>y.id===r.dataset.r); if(x) x.cat=last.cat; } } } if(e.target.closest(".pvxr")||e.target.id==="pvi-sum") pvRowsTot(); });
  d.addEventListener("change", e=>{ const r=e.target.closest(".pvxr"), x=r&&PVI.rows.find(y=>y.id===r.dataset.r);
    if(x && e.target.classList.contains("pvxc")) x.cat=e.target.value;
    if(x && e.target.classList.contains("pvxd")){ x.date=e.target.value; x.dm=true; }
    if(e.target.id==="pvi-date"){ d.querySelectorAll("#pvi-rows .pvxr").forEach(el=>{ const y=PVI.rows.find(z=>z.id===el.dataset.r); if(y && !y.dm){ y.date=e.target.value; el.querySelector(".pvxd").value=e.target.value; } }); } });
  setTimeout(()=>{ const s=$("#pvi-sum"); if(s){ s.focus(); s.select(); } }, 60);
}
const PV_KT = {exp:"Расход", inc:"Доход", per:"Личный расход"};
/* сумма с пробелами по тысячам прямо при вводе: 2900 → 2 900, курсор остаётся на месте */
const pvGrp = v => { v=String(v==null?"":v).replace(/[^\d.,]/g,"").replace(".",","); const i=v.indexOf(","), a=(i<0?v:v.slice(0,i)).replace(/,/g,""), b=i<0?"":","+v.slice(i+1).replace(/,/g,"").slice(0,2);
  return a.replace(/^0+(?=\d)/,"").replace(/\B(?=(\d{3})+(?!\d))/g," ")+b; };
function pvGrpIn(el){ const v=el.value, pos=el.selectionStart==null?v.length:el.selectionStart, k=v.slice(0,pos).replace(/[^\d,.]/g,"").length, nv=pvGrp(v); if(nv===v) return;
  el.value=nv; let n=0, p=0; while(p<nv.length && n<k){ if(/[\d,]/.test(nv[p])) n++; p++; } try{ el.setSelectionRange(p,p); }catch(e){} }
document.addEventListener("input", e=>{ const t=e.target; if(t && t.matches && t.matches("#pvi-sum, #pvl-sum, .pvxs")) pvGrpIn(t); }, true);
const PV_PH = {exp:"например, бензин Гриша", inc:"например, проценты по вкладу", per:"например, продукты домой"};
/* выбрали запись, которая уже была, — подставим категорию и подскажем прошлую сумму */
function pvItemNote(){ const n=($("#pvi-note").value||"").trim().toLowerCase(), h=$("#pvi-hint"); if(!h) return;
  const last=n ? pfArr("pother").filter(x=>(x.note||"").trim().toLowerCase()===n && pvKind(x)===PVI.k && x.id!==PVI.id).sort((a,b)=>a.date<b.date?1:-1)[0] : null;
  if(!last){ h.hidden=true; return; }
  if(PVI.k!=="per" && !PVI.cat && last.cat && pvCatOk()){ PVI.cat=last.cat; pvItemCats(); }
  const s=$("#pvi-sum"); h.hidden=false; h.innerHTML=`В прошлый раз ${fd(last.date)} — <b>${fm(+last.sum||0)} ₽</b>${!(+num(s.value)>0)?` <button type="button" class="pvlink" data-pvi="last" data-v="${esc(String(last.sum))}">подставить</button>`:""}`; }
/* «Ещё строка»: несколько записей одним разом — дата, ИП и вид общие, у строки своя категория, «на что» и сумма */
function pvRowOpts(sel){ if(PVI.k==="per") return ""; const L=pvCats().filter(c=>c.k===PVI.k||c.k==="both");
  return `<option value="">Без категории</option>`+L.map(c=>`<option value="${esc(c.id)}"${c.id===sel?" selected":""}>${esc(c.n)}</option>`).join(""); }
function pvRowHtml(r){ return `<div class="pvxr" data-r="${r.id}">${PVI.k==="per"?"":`<select class="pvxc" aria-label="Категория" ${pvCatOk()?"":"disabled"}>${pvRowOpts(r.cat)}</select>`}<input class="pvxn" list="pvi-notes" maxlength="200" placeholder="${PVI.k==="inc"?"Откуда":"На что"}" aria-label="${PVI.k==="inc"?"Откуда":"На что"}"><input type="date" class="pvxd" aria-label="Дата" value="${esc(r.date||($("#pvi-date")||{}).value||todayISO())}"><label class="pvxsum"><input class="pvxs" inputmode="decimal" placeholder="0" aria-label="Сумма"><em>₽</em></label><button type="button" class="pvxdel" data-pvi="rdel" aria-label="Убрать строку">×</button></div>`; }
function pvRowAdd(){ const box=$("#pvi-rows"); if(!box) return; const last=PVI.rows[PVI.rows.length-1], lastEl=box.querySelector(".pvxr:last-child .pvxd"), r={id:"r"+uid().slice(0,6), cat:last?last.cat:PVI.cat, date:(lastEl&&lastEl.value)||($("#pvi-date")||{}).value||todayISO(), dm:last?last.dm:false};
  PVI.rows.push(r); box.insertAdjacentHTML("beforeend", pvRowHtml(r)); const el=box.lastElementChild; el.querySelector(".pvxn").focus(); pvRowsTot(); }
function pvRowsRedraw(){ const box=$("#pvi-rows"); if(!box) return; const vals=[...box.querySelectorAll(".pvxr")].map(r=>({n:r.querySelector(".pvxn").value, s:r.querySelector(".pvxs").value})); PVI.rows.forEach((x,i)=>{ const el=box.querySelectorAll(".pvxr .pvxd")[i]; if(el) x.date=el.value; });
  box.innerHTML=PVI.rows.map(pvRowHtml).join(""); [...box.querySelectorAll(".pvxr")].forEach((r,i)=>{ if(vals[i]){ r.querySelector(".pvxn").value=vals[i].n; r.querySelector(".pvxs").value=vals[i].s; } }); pvRowsTot(); }
function pvRowsGet(){ return [...document.querySelectorAll("#pvi-rows .pvxr")].map(r=>{ const x=PVI.rows.find(y=>y.id===r.dataset.r)||{}; const c=r.querySelector(".pvxc");
  return {el:r, date:r.querySelector(".pvxd").value||($("#pvi-date")||{}).value||todayISO(), cat:PVI.k==="per"?"":(c?c.value:x.cat||""), note:r.querySelector(".pvxn").value.trim(), v:+num(r.querySelector(".pvxs").value)||0}; }).filter(x=>x.v>0 || x.note); }
function pvRowsTot(){ const t=$("#pvi-tot"), b=document.querySelector('#fd-dcard [data-pvi="save"]'); if(!t || PVI.id) return; const R=pvRowsGet(), main=+num(($("#pvi-sum")||{}).value)||0, n=R.length+(main>0?1:0), s=r2(main+R.reduce((a,x)=>a+x.v,0));
  t.innerHTML = R.length ? `Итого <b>${fm(s)} ₽</b> · ${n} ${plural(n,["запись","записи","записей"])}` : ""; if(b) b.textContent = R.length ? "Добавить ("+n+")" : "Добавить"; }
function pvItemKind(k){ PVI.k=k; PVI.inc=k==="inc"; const s=$("#pvi-kind"); s.style.setProperty("--i", ["exp","inc","per"].indexOf(k)); s.querySelectorAll("button").forEach(b=>b.classList.toggle("on", b.dataset.pvk===k));
  $("#pvi-f").className="pvform k-"+k; $("#pvi-t").textContent=PV_KT[k]; $("#pvi-nl").textContent=k==="inc"?"Откуда":"На что"; $("#pvi-note").placeholder=PV_PH[k]; if(k==="per") PVI.cat=""; PVI.rows.forEach(r=>{ const L=pvCats().filter(c=>c.k===k||c.k==="both"); if(k==="per"||!L.some(c=>c.id===r.cat)) r.cat=""; }); pvRowsRedraw(); pvItemCats(); pvItemNote(); }
function pvItemCats(){ const box=$("#pvi-cats"); if(!box) return; if(PVI.k==="per"){ box.innerHTML=""; return; } const k=PVI.inc?"inc":"exp", L=pvCats().filter(c=>c.k===k||c.k==="both");
  if(PVI.cat && !L.some(c=>c.id===PVI.cat)) PVI.cat="";
  box.innerHTML=L.map(c=>`<button type="button" class="pvcc ${PVI.cat===c.id?"on":""}" data-pvcat="${esc(c.id)}" style="--h:${c.h==null?0:c.h}" ${pvCatOk()?"":"disabled"}><span>${pvIco(c.i)}</span>${esc(c.n)}</button>`).join("") + `<button type="button" class="pvcc add" data-pvi="cats" title="Добавить или изменить категории">＋</button>`; }
function pvItemClick(e){
  const k=e.target.closest("[data-pvk]"); if(k){ pvItemKind(k.dataset.pvk); return; }
  const c=e.target.closest("[data-pvcat]"); if(c){ PVI.cat = PVI.cat===c.dataset.pvcat ? "" : c.dataset.pvcat; $("#pvi-cats").querySelectorAll("[data-pvcat]").forEach(b=>b.classList.toggle("on", b.dataset.pvcat===PVI.cat)); return; }
  const b=e.target.closest("[data-pvi]"); if(!b) return;
  if(b.dataset.pvi==="save") pvItemSave();
  if(b.dataset.pvi==="cats"){ pvCatsOpen(); }
  if(b.dataset.pvi==="row"){ pvRowAdd(); return; }
  if(b.dataset.pvi==="rdel"){ const r=b.closest(".pvxr"); PVI.rows=PVI.rows.filter(x=>x.id!==r.dataset.r); r.classList.add("out"); setTimeout(()=>{ r.remove(); pvRowsTot(); }, 180); return; }
  if(b.dataset.pvi==="last"){ $("#pvi-sum").value=pvGrp(String(b.dataset.v)); pvItemNote(); $("#pvi-sum").focus(); }
  if(b.dataset.pvi==="copy"){ const it=pfArr("pother").find(y=>y.id===PVI.id); pvCloseCard(); if(it) setTimeout(()=>pvItemOpen(it, null, todayISO(), true), 220); }
  if(b.dataset.pvi==="del"){ if(!armed(b,"Точно удалить?")) return; const x=pfArr("pother").find(y=>y.id===PVI.id); D.pother=pfArr("pother").filter(y=>y.id!==PVI.id); dirty("pother", PVI.id, true);
    if(x) logEv("Прибыль","Удалён "+({inc:"прочий доход",exp:"прочий расход",per:"личный расход"})[pvKind(x)]+": "+(x.note||"")+" — "+fm(+x.sum||0)+" ₽"); saveLocal(); pvCloseCard(); drawProfit(); toast("ok","Запись удалена","Вернуть — кнопка «Отменить» внизу."); }
}
function pvItemSave(){
  const v=+num($("#pvi-sum").value), note=$("#pvi-note").value.trim(), date=$("#pvi-date").value||todayISO(), k=PVI.k, per=k==="per", c=per?PV_PERC:pvCat(PVI.cat), R=PVI.id?[]:pvRowsGet();
  if(!(v>0)){ toast("err","Впишите сумму",""); $("#pvi-sum").focus(); return; }
  if(!note && (per || !PVI.cat)){ toast("err", k==="inc"?"Откуда доход?":"На что расход?", per?"Впишите пару слов — например, «продукты» или «отпуск».":"Выберите категорию или впишите пару слов."); $("#pvi-note").focus(); return; }
  for(const r of R){ if(!(r.v>0)){ toast("err","Впишите сумму в строке «"+r.note+"»",""); r.el.querySelector(".pvxs").focus(); return; }
    if(!r.note && !r.cat){ toast("err", k==="inc"?"Откуда доход?":"На что расход?", "Строка на "+fm(r.v)+" ₽: выберите категорию или впишите пару слов."); r.el.querySelector(".pvxn").focus(); return; } }
  const old=PVI.id ? pfArr("pother").find(y=>y.id===PVI.id) : null, sup=per||!old?"":(old.supplierId||""),   /* ИП не выбирается: у старых записей остаётся как было */ kindV=k==="inc"?PO_INC:per?PO_PER:PO_EXP, made=[];
  const put=(x, sum, nt, cat, dt)=>{ const cc=per?PV_PERC:pvCat(cat), date=dt; Object.assign(x, {date, kind:kindV, sum:String(r2(sum)), note:nt||cc.n, supplierId:sup});
    if(pvCatOk()){ x.cat=per?"":cat; x.catName=per||!cat?"":cc.n; } if(!pfArr("pother").includes(x)) pfArr("pother").push(x); dirty("pother", x.id); made.push(x);
    logEv("Прибыль",(old?"Изменён ":"")+({inc:"прочий доход",exp:"прочий расход",per:"личный расход"})[k].replace(/^./,s=>old?s:s.toUpperCase())+": "+x.note+(!per&&cat?" ["+cc.n+"]":"")+" — "+fm(sum)+" ₽ от "+fd(date)); };
  put(old || {id:uid(), by:curUser()}, v, note, PVI.cat, date);
  R.forEach(r=>put({id:uid(), by:curUser()}, r.v, r.note, r.cat, r.date));
  saveLocal(); pvCloseCard();
  const m=pvMonth(); if(m!=="all" && date.slice(0,7)!==m){ PV().m=date.slice(0,7); saveLocal(); }
  const tot=r2(made.reduce((a,x)=>a+ +x.sum,0));
  drawProfit(); toast("ok", old?"Сохранено":made.length>1?"Добавлено записей: "+made.length:k==="inc"?"Доход добавлен":per?"Личный расход добавлен":"Расход добавлен", made.length>1?"Всего "+fm(tot)+" ₽":(!per&&PVI.cat?c.n+" · ":"")+fm(v)+" ₽");
  setTimeout(()=>{ made.forEach((x,i)=>{ const r=document.querySelector(`#pv-fin [data-pvx="${x.id}"]`); if(r){ r.classList.add("fresh"); if(!i) r.scrollIntoView({block:"nearest", behavior:"smooth"}); } }); }, 30);
}
function pvCloseCard(){ const d=$("#fd-dcard"); if(!d) return; d.classList.add("out"); setTimeout(()=>{ try{ d.close(); }catch(x){} d.remove(); }, 200); }

/* ---------- категории ---------- */
let PVC=null;
function pvCatsOpen(){
  const back = PVI && $("#fd-dcard.pvi-d") ? {it:PVI.id?pfArr("pother").find(y=>y.id===PVI.id):null, inc:PVI.inc, v:$("#pvi-sum").value, n:$("#pvi-note").value, d:$("#pvi-date").value, cat:PVI.cat} : null;
  PVC={list:pvCats().map(c=>Object.assign({},c)), pick:"", back};
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Настройка</div><h3>Категории расходов и доходов</h3><div class="dc-sub">Иконка, название, цвет и где показывать. Изменения сохраняются сразу.</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div id="pvcl"></div><div class="pvea"><button type="button" class="btn" data-pvcm="new">+ Новая категория</button><span style="flex:1"></span>${back?`<button type="button" class="btn pri" data-pvcm="back">Готово ›</button>`:`<button type="button" class="btn pri" data-dc="close">Готово</button>`}</div>`, true, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("pvc-d"); d.addEventListener("click", pvCatsClick); d.addEventListener("change", pvCatsChange);
  d.addEventListener("input", e=>{ const r=e.target.closest("[data-pvcr]"); if(r && e.target.classList.contains("pvcname")){ const c=PVC.list.find(x=>x.id===r.dataset.pvcr); if(c){ c.n=e.target.value; } } });
  d.addEventListener("focusout", e=>{ if(e.target.classList && e.target.classList.contains("pvcname")) pvCatsCommit(true); });
  pvCatsDraw();
}
function pvCatsDraw(){ const box=$("#pvcl"); if(!box) return; const used=id=>pfArr("pother").filter(x=>x.cat===id).length;
  box.innerHTML=`<div class="pvcl">${PVC.list.map((c,i)=>`<div class="pvcr" data-pvcr="${esc(c.id)}">
    <button type="button" class="pvcico" data-pvcm="ico" style="--h:${c.h==null?0:c.h}" aria-label="Сменить иконку">${pvIco(c.i)}</button>
    <input class="pvcname" value="${esc(c.n)}" maxlength="40" aria-label="Название">
    <select class="pvck" aria-label="Где показывать"><option value="exp" ${c.k==="exp"?"selected":""}>Расход</option><option value="inc" ${c.k==="inc"?"selected":""}>Доход</option><option value="both" ${c.k==="both"?"selected":""}>Оба</option></select>
    <span class="pvcu muted">${used(c.id)||""}</span>
    <span class="pvcmv"><button type="button" data-pvcm="up" ${i?"":"disabled"} aria-label="Выше">↑</button><button type="button" data-pvcm="down" ${i<PVC.list.length-1?"":"disabled"} aria-label="Ниже">↓</button></span>
    <button type="button" class="pvcdel" data-pvcm="del" aria-label="Удалить">${pvIco("trash")}</button>
    ${PVC.pick===c.id?`<div class="pvpick"><div class="pvpi">${PV_ICONS.map(ic=>`<button type="button" data-pvcm="seti" data-v="${ic}" class="${ic===pvIk(c.i)?"on":""}" aria-label="Иконка">${pvIco(ic)}</button>`).join("")}</div><div class="pvph">${PV_HUES.map(h=>`<button type="button" data-pvcm="seth" data-v="${h}" style="--h:${h}" class="${h===c.h?"on":""}" aria-label="Цвет"></button>`).join("")}</div></div>`:""}
  </div>`).join("")}</div>`; }
function pvCatsCommit(quiet){ const L=PVC.list.map(c=>Object.assign({},c,{n:(c.n||"").trim()||"Без названия"})); pvCatsSave(L);
  /* переименование — обновим подпись категории у записей (для таблицы) */
  if(pvCatOk()) pfArr("pother").forEach(x=>{ if(!x.cat) return; const c=L.find(y=>y.id===x.cat); if(c && x.catName!==c.n){ x.catName=c.n; dirty("pother", x.id); } });
  saveLocal(); if(!quiet) pvCatsDraw(); }
function pvCatsChange(e){ const r=e.target.closest("[data-pvcr]"); if(!r) return; const c=PVC.list.find(x=>x.id===r.dataset.pvcr); if(!c) return;
  if(e.target.classList.contains("pvck")){ c.k=e.target.value; pvCatsCommit(); } }
function pvCatsClick(e){ const b=e.target.closest("[data-pvcm]"); if(!b) return; const a=b.dataset.pvcm, r=b.closest("[data-pvcr]"), id=r&&r.dataset.pvcr, i=PVC.list.findIndex(x=>x.id===id), c=PVC.list[i];
  if(a==="new"){ const n={id:"c-"+uid().slice(-8), n:"Новая категория", i:"tag", h:PV_HUES[PVC.list.length%PV_HUES.length], k:"exp"}; PVC.list.push(n); PVC.pick=n.id; pvCatsCommit(); const inp=document.querySelector(`[data-pvcr="${n.id}"] .pvcname`); if(inp){ inp.closest(".pvcr").classList.add("fresh"); inp.focus(); inp.select(); } return; }
  if(a==="back"){ const bk=PVC.back; pvCloseCard(); setTimeout(()=>{ pvItemOpen(bk.it, bk.inc?"inc":"exp"); pvItemKind(bk.inc?"inc":"exp"); PVI.cat=bk.cat; $("#pvi-sum").value=bk.v; $("#pvi-note").value=bk.n; $("#pvi-date").value=bk.d; pvItemCats(); }, 220); return; }
  if(!c) return;
  if(a==="ico"){ PVC.pick = PVC.pick===id ? "" : id; pvCatsDraw(); return; }
  if(a==="seti"){ c.i=b.dataset.v; pvCatsCommit(); return; }
  if(a==="seth"){ c.h=+b.dataset.v; pvCatsCommit(); return; }
  if(a==="up"||a==="down"){ const j=i+(a==="up"?-1:1); [PVC.list[i],PVC.list[j]]=[PVC.list[j],PVC.list[i]]; pvCatsCommit(); return; }
  if(a==="del"){ const n=pfArr("pother").filter(x=>x.cat===id).length; if(!armed(b, n?"Удалить? "+n+" зап. станут «без категории»":"Удалить?")) return; PVC.list.splice(i,1); pvCatsCommit(); }
}
/* ---------- «Прибыль → Обзор» и «Кто сколько должен»: плитки открывают подробности ----------
   pfDetail(k): due — ждём оплату за период, debt — все долги, old30 — долги старше 30 дней, paid — оплачено за накладные периода,
   perpaid — деньги, пришедшие в периоде (по дате оплаты), rev/cost/tax/gross/net — по заказчикам (tax — по ИП), exp/inc/own — записи.
   Строка накладной → docCard (в шапке «‹ Назад» вернёт сюда), заказчик → pvLedger, «Оплачено» — сразу отмечает. */
const PFD={k:"", age:"", sort:"sum", open:new Set()};
const pfdPer = () => { const s=$("#pf-per"); return s && s.selectedOptions[0] ? s.selectedOptions[0].textContent.trim() : ""; };
function pfdDocs(all){ const f=PF(), [d1,d2]=pfRange(f);
  return D.journal.filter(j=>j.snap && !isArch(j) && (all || (j.date>=d1 && j.date<=d2)) && (!f.sup||j.supplierId===f.sup) && (!f.cus||j.customerId===f.cus)); }
const PFD_T={due:["Ждём оплату","неоплаченные накладные за выбранный период"], debt:["Кто сколько должен","все неоплаченные накладные"], old30:["Долги старше 30 дней","накладные, по которым ждём деньги больше месяца"],
  paid:["Оплачено","оплаты по накладным выбранного периода"], perpaid:["Пришло денег","оплаты, отмеченные в выбранном периоде"], rev:["Выручка","по заказчикам"], cost:["Закупка","по заказчикам"], tax:["Налог","по ИП"],
  gross:["Валовая прибыль","после закупки и налога, по заказчикам"], net:["Чистая прибыль","по заказчикам, плюс общие расходы и доходы"], exp:["Прочие расходы","по накладным и общие"], inc:["Прочие доходы","записи за период"], own:["Личные траты","за период"]};
function pfDetail(k){ if(!PFD_T[k]) return; if(PFD.k!==k){ PFD.k=k; PFD.age=k==="old30"?"30":""; PFD.sort="sum"; PFD.open=new Set(); }
  CARD_RE=()=>pfDetail(k);
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Прибыль${["debt","old30","perpaid"].includes(k)&&k!=="perpaid"?"":" · "+esc(pfdPer())}</div><h3>${PFD_T[k][0]}</h3><div class="dc-sub">${PFD_T[k][1]}</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div><div id="pfd"></div>`, true, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("pfd-d"); d.addEventListener("click", pfdClick); pfdDraw(); }
const pfdAgeOk = (age, b) => !b || (b==="10" ? age<=10 : b==="30" ? age>30 : b==="60" ? age>60 : b==="11" ? age>10&&age<=30 : true);
function pfdDebt(k){ const L=pfdDocs(k!=="due").map(j=>({j, p:payOf(j), age:daysSince(j.date)})).filter(x=>x.p.st!=="paid" && x.p.left>0.004 && (k!=="old30" || x.age>30));
  const bk=[["","Все"],["10","до 10 дней"],["11","11–30 дней"],["30","больше 30"],["60","больше 60"]].map(([b,t])=>{ const S=L.filter(x=>pfdAgeOk(x.age,b)); return {b,t,n:S.length,s:r2(S.reduce((a,x)=>a+x.p.left,0))}; }).filter(x=>!x.b||x.n);
  const V=L.filter(x=>pfdAgeOk(x.age,PFD.age)), G=new Map(); V.forEach(x=>{ const c=x.j.customerId||"-"; if(!G.has(c)) G.set(c,{cid:c, L:[], s:0, old:0}); const g=G.get(c); g.L.push(x); g.s=r2(g.s+x.p.left); g.old=Math.max(g.old,x.age); });
  const gs=[...G.values()].sort((a,b)=>PFD.sort==="age"?b.old-a.old||b.s-a.s:b.s-a.s), tot=r2(V.reduce((a,x)=>a+x.p.left,0)), mx=Math.max(1,...gs.map(g=>g.s));
  const row=x=>{ const w=jWho(x.j); return `<div class="pfd-r" data-pfdoc="${esc(x.j.id)}" role="button" tabindex="0"><span class="pfd-n"><b>№ ${esc(x.j.number)} · ${fd(x.j.date)}</b><small>${esc(w.pt||supShort(sup(x.j.supplierId).name||""))}</small></span><span class="pfage ${ageCls(x.age)}">${ageTxt(x.j.date)}</span><span class="pfd-s"><b>${fm(x.p.left)}</b>${x.p.st==="part"?`<small>из ${fm(x.p.tot)}</small>`:""}</span><button type="button" class="btn sm pfd-pay" data-pfpay="${esc(x.j.id)}">Оплачено</button></div>`; };
  return `<div class="pfd-sum"><div class="${tot>0?"warn":"ok"}"><small>${PFD.age?"В выбранном":"Всего"}</small><b>${fm(tot)} ₽</b><span>${V.length} ${plural(V.length,["накладная","накладные","накладных"])} · ${gs.length} ${plural(gs.length,["заказчик","заказчика","заказчиков"])}</span></div>${(()=>{ const o=L.filter(x=>x.age>30), s=r2(o.reduce((a,x)=>a+x.p.left,0)); return k!=="old30"&&s>0?`<div class="bad"><small>Из них дольше 30 дней</small><b>${fm(s)} ₽</b><span>${o.length} ${plural(o.length,["накладная","накладные","накладных"])}</span></div>`:""; })()}${(()=>{ const a=L.length?Math.round(L.reduce((s,x)=>s+x.age*x.p.left,0)/Math.max(1,L.reduce((s,x)=>s+x.p.left,0))):0; return L.length?`<div><small>Средний возраст долга</small><b>${dnum(a)}</b><span>с учётом суммы</span></div>`:""; })()}</div>
    ${L.length?`<div class="pfd-bar"><div class="pfchips">${bk.map(x=>`<button type="button" data-pfage="${x.b}" class="${PFD.age===x.b?"on":""}">${x.t}<i>${x.n}</i></button>`).join("")}</div><div class="fdseg pfd-sort" role="group" aria-label="Порядок"><i style="--x:${PFD.sort==="age"?"100%":"0%"}"></i><button type="button" data-pfsort="sum" class="${PFD.sort==="sum"?"on":""}">По сумме</button><button type="button" data-pfsort="age" class="${PFD.sort==="age"?"on":""}">По давности</button></div></div>`:""}
    ${gs.length?gs.map(g=>{ const op=PFD.open.has(g.cid)||gs.length<=2; return `<section class="pfd-g${op?" open":""}"><button type="button" class="pfd-gh" data-pfg="${esc(g.cid)}" aria-expanded="${op}">${pvAva(g.cid)}<span class="pfd-gn"><b>${esc(pvCusName(g.cid))}</b><small>${g.L.length} ${plural(g.L.length,["накладная","накладные","накладных"])} · самая старая <span class="pfage ${ageCls(g.old)}">${g.old?dnum(g.old):"сегодня"}</span></small><i class="pfd-gb"><i style="--w:${(g.s/mx*100).toFixed(1)}%"></i></i></span><span class="pfd-gs">${fm(g.s)} ₽</span><i class="pfd-ga" aria-hidden="true">›</i></button>
      <div class="pfd-gl">${g.L.sort((a,b)=>a.j.date.localeCompare(b.j.date)||jNumSort(a.j,b.j)).map(row).join("")}<div class="pfd-ga2"><button type="button" class="btn ghost sm" data-pfled="${esc(g.cid)}">Все накладные заказчика ›</button><button type="button" class="btn sm" data-pfall="${esc(g.cid)}">Всё оплачено (${fm(g.s)})</button></div></div></section>`; }).join("")
      : `<div class="pvempty">${pvIco("check","big")}<b>${L.length?"В этом фильтре долгов нет":"Никто ничего не должен"}</b><small>${L.length?"Выберите «Все».":"Все накладные оплачены."}</small></div>`}`; }
function pfdPaid(k){ const f=PF(), [d1,d2]=pfRange(f), L=pfdDocs(k==="perpaid").map(j=>({j, p:payOf(j)})).filter(x=>x.p.s>0 && (k!=="perpaid" || (x.p.d>=d1 && x.p.d<=d2)));
  const days=x=>x.p.d?Math.max(0,Math.round((new Date(x.p.d+"T12:00:00")-new Date(x.j.date+"T12:00:00"))/864e5)):null, tot=r2(L.reduce((a,x)=>a+x.p.s,0)), D2=L.map(days).filter(x=>x!=null), avg=D2.length?Math.round(D2.reduce((a,b)=>a+b,0)/D2.length):0;
  const G=new Map(); L.forEach(x=>{ const key=k==="perpaid"?(x.p.d||"—"):(x.j.customerId||"-"); if(!G.has(key)) G.set(key,{key, L:[], s:0}); const g=G.get(key); g.L.push(x); g.s=r2(g.s+x.p.s); });
  const gs=[...G.values()].sort((a,b)=>k==="perpaid"?(b.key>a.key?1:-1):b.s-a.s);
  const row=x=>{ const dd=days(x); return `<div class="pfd-r" data-pfdoc="${esc(x.j.id)}" role="button" tabindex="0"><span class="pfd-n"><b>${k==="perpaid"?esc(cusShort(jWho(x.j).main))+" · ":""}№ ${esc(x.j.number)} от ${fd(x.j.date).slice(0,5)}</b><small>${x.p.d?"оплачена "+fd(x.p.d):"дата оплаты не указана"}${dd!=null?" · за "+dnum(dd):""}</small></span><span class="pfd-s pos"><b>${fm(x.p.s)}</b>${x.p.st==="part"?`<small>из ${fm(x.p.tot)}</small>`:""}</span></div>`; };
  return `<div class="pfd-sum"><div class="ok"><small>${k==="perpaid"?"Пришло":"Оплачено"}</small><b>${fm(tot)} ₽</b><span>${L.length} ${plural(L.length,["накладная","накладные","накладных"])}</span></div>${D2.length?`<div><small>Платят в среднем</small><b>за ${dnum(avg)}</b><span>от накладной до оплаты</span></div>`:""}</div>
    ${gs.length?gs.map(g=>{ const op=PFD.open.has(g.key)||gs.length<=3, cus_=k!=="perpaid"; return `<section class="pfd-g${op?" open":""}"><button type="button" class="pfd-gh" data-pfg="${esc(g.key)}" aria-expanded="${op}">${cus_?pvAva(g.key):`<span class="pfd-day">${g.key==="—"?"—":fd(g.key).slice(0,5)}</span>`}<span class="pfd-gn"><b>${cus_?esc(pvCusName(g.key)):g.key==="—"?"Без даты":esc(pvDay(g.key))}</b><small>${g.L.length} ${plural(g.L.length,["накладная","накладные","накладных"])}</small></span><span class="pfd-gs pos">${fm(g.s)} ₽</span><i class="pfd-ga" aria-hidden="true">›</i></button><div class="pfd-gl">${g.L.map(row).join("")}</div></section>`; }).join("")
      : `<div class="pvempty">${pvIco("coins","big")}<b>Оплат нет</b><small>За этот период оплаты не отмечены.</small></div>`}`; }
function pfdBy(k){ const f=PF(), X=pfdDocs(false).map(j=>{ const x=docProfit(j); x.pay=payOf(j); return x; }), byS=k==="tax", G=new Map();
  X.forEach(x=>{ const key=byS?(x.j.supplierId||"-"):(x.j.customerId||"-"); if(!G.has(key)) G.set(key,{key, L:[], rev:0, cost:0, tax:0, exp:0, p:0, miss:0}); const g=G.get(key); g.L.push(x); g.rev+=x.rev; g.cost+=x.cost; g.tax+=x.tax; g.exp+=x.exp; g.p+=x.profit; if(x.miss) g.miss++; });
  const val=g=>k==="rev"?g.rev:k==="cost"?g.cost+g.exp:k==="tax"?g.tax:k==="gross"?g.rev-g.cost-g.tax:g.p, gs=[...G.values()].sort((a,b)=>val(b)-val(a)), T=gs.reduce((a,g)=>a+val(g),0), R=gs.reduce((a,g)=>a+g.rev,0), mx=Math.max(1,...gs.map(g=>Math.abs(val(g))));
  const OT=k==="net"?poFor(f,...pfRange(f)):[], oe=r2(OT.filter(x=>x.kind!==PO_INC).reduce((a,x)=>a+(+x.sum||0),0)), oi=r2(OT.filter(x=>x.kind===PO_INC).reduce((a,x)=>a+(+x.sum||0),0)), miss=X.filter(x=>x.miss).length;
  const sub=g=>byS?`ставка ${String(taxOf(g.key)).replace(".",",")}% · выручка ${fm(r2(g.rev))}`:k==="rev"?`${g.L.length} ${plural(g.L.length,["накладная","накладные","накладных"])} · ${pct(g.rev,R)} выручки`:k==="cost"?`${pct(g.cost+g.exp,g.rev)} от выручки${g.exp?" · расходы "+fm(r2(g.exp)):""}`:`маржа ${pct(val(g),g.rev)} · выручка ${fm(r2(g.rev))}`;
  const row=x=>{ const v=k==="rev"?x.rev:k==="cost"?x.cost+x.exp:k==="tax"?x.tax:k==="gross"?x.rev-x.cost-x.tax:x.profit; return `<div class="pfd-r" data-pfdoc="${esc(x.j.id)}" role="button" tabindex="0"><span class="pfd-n"><b>№ ${esc(x.j.number)} · ${fd(x.j.date)}</b><small>${esc(byS?cusShort(jWho(x.j).main):(jWho(x.j).pt||""))}${k!=="rev"&&k!=="tax"?(byS||jWho(x.j).pt?" · ":"")+"выручка "+fm(x.rev):""}${x.miss?` · <em class="warn">без закупки</em>`:""}</small></span><span class="pfd-s ${v<0?"neg":""}"><b>${fm(r2(v))}</b></span></div>`; };
  return `<div class="pfd-sum"><div class="${k==="cost"||k==="tax"?"":"ok"}"><small>${PFD_T[k][0]}${k==="net"?" по накладным":""}</small><b class="${T<0?"neg":""}">${fm(r2(T))} ₽</b><span>${X.length} ${plural(X.length,["накладная","накладные","накладных"])}${k!=="rev"&&R?" · "+pct(T,R)+" выручки":""}</span></div>${k==="net"&&(oe||oi)?`<div><small>Общие расходы и доходы</small><b class="${oi-oe<0?"neg":""}">${fm(r2(oi-oe))} ₽</b><span>расходы ${fm(oe)} · доходы ${fm(oi)}</span></div><div class="ok"><small>Итого чистая прибыль</small><b class="${T-oe+oi<0?"neg":""}">${fm(r2(T-oe+oi))} ₽</b></div>`:""}${miss&&k!=="tax"?`<div class="warn pfd-miss" role="button" tabindex="0" data-pfmiss><small>Без закупки</small><b>${miss} ${plural(miss,["накладная","накладные","накладных"])}</b><span>прибыль по ним завышена · заполнить ›</span></div>`:""}</div>
    ${gs.length?gs.map(g=>{ const op=PFD.open.has(g.key)||gs.length<=2, v=r2(val(g)); return `<section class="pfd-g${op?" open":""}"><button type="button" class="pfd-gh" data-pfg="${esc(g.key)}" aria-expanded="${op}">${byS?`${pvBubble({h:210,i:"bank"})}`:pvAva(g.key)}<span class="pfd-gn"><b>${esc(byS?(sup(g.key).name||"Без ИП"):pvCusName(g.key))}</b><small>${sub(g)}${g.miss?` · <em class="warn">без закупки ${g.miss}</em>`:""}</small><i class="pfd-gb ${v<0?"neg":""}"><i style="--w:${(Math.abs(v)/mx*100).toFixed(1)}%"></i></i></span><span class="pfd-gs ${v<0?"neg":""}">${fm(v)} ₽</span><i class="pfd-ga" aria-hidden="true">›</i></button>
      <div class="pfd-gl">${g.L.sort((a,b)=>b.j.date.localeCompare(a.j.date)).map(row).join("")}${byS?"":`<div class="pfd-ga2"><button type="button" class="btn ghost sm" data-pfled="${esc(g.key)}">Все накладные заказчика ›</button></div>`}</div></section>`; }).join("")
      : `<div class="pvempty">${pvIco("receipt","big")}<b>Накладных нет</b><small>За этот период накладных нет.</small></div>`}`; }
function pfdRec(k){ const f=PF(), [d1,d2]=pfRange(f), all=pfArr("pother").filter(x=>x.date>=d1 && x.date<=d2 && (k==="own" ? x.kind===PO_PER : (k==="inc" ? x.kind===PO_INC : x.kind!==PO_INC && x.kind!==PO_PER)) && (k==="own" || ((!f.sup||x.supplierId===f.sup) && !f.cus)));
  const docExp=k==="exp"?pfdDocs(false).map(j=>({j, e:+(docCost(j.id)||{}).expense||0})).filter(x=>x.e>0):[], G=new Map();
  all.forEach(x=>{ const c=k==="own"?Object.assign({},PV_PERC,{id:(x.note||"").trim().toLowerCase(), n:(x.note||"Без описания").trim()}):pvCatOf(x); if(!G.has(c.id)) G.set(c.id,{c, L:[], s:0}); const g=G.get(c.id); g.L.push(x); g.s=r2(g.s+(+x.sum||0)); });
  const gs=[...G.values()].sort((a,b)=>b.s-a.s), ts=r2(all.reduce((a,x)=>a+(+x.sum||0),0)), te=r2(docExp.reduce((a,x)=>a+x.e,0));
  const row=x=>`<div class="pfd-r" data-pvx="${esc(x.id)}" role="button" tabindex="0"><span class="pfd-n"><b>${esc(x.note||pvCatOf(x).n)}</b><small>${pvDay(x.date)}${x.by?" · "+esc(x.by):""}</small></span><span class="pfd-s ${k==="inc"?"pos":"neg"}"><b>${fm(+x.sum||0)}</b></span></div>`;
  return `<div class="pfd-sum"><div class="${k==="inc"?"ok":""}"><small>${k==="exp"?"Общие расходы":PFD_T[k][0]}</small><b>${fm(ts)} ₽</b><span>${all.length} ${plural(all.length,["запись","записи","записей"])}</span></div>${k==="exp"?`<div><small>Расходы в накладных</small><b>${fm(te)} ₽</b><span>${docExp.length} ${plural(docExp.length,["накладная","накладные","накладных"])}</span></div>`:""}<div class="pfd-go" role="button" tabindex="0" data-pfgo><small>Добавить или изменить</small><b>Расходы и доходы ›</b></div></div>
    ${gs.map(g=>{ const op=PFD.open.has(g.c.id)||gs.length<=3; return `<section class="pfd-g${op?" open":""}"><button type="button" class="pfd-gh" data-pfg="${esc(g.c.id)}" aria-expanded="${op}">${pvBubble(g.c)}<span class="pfd-gn"><b>${esc(g.c.n)}</b><small>${g.L.length} ${plural(g.L.length,["запись","записи","записей"])} · ${pct(g.s,ts)}</small></span><span class="pfd-gs">${fm(g.s)} ₽</span><i class="pfd-ga" aria-hidden="true">›</i></button><div class="pfd-gl">${g.L.sort((a,b)=>b.date.localeCompare(a.date)).map(row).join("")}</div></section>`; }).join("")}
    ${docExp.length?`<section class="pfd-g${PFD.open.has("_doc")?" open":""}"><button type="button" class="pfd-gh" data-pfg="_doc" aria-expanded="${PFD.open.has("_doc")}">${pvBubble({h:35,i:"truck"})}<span class="pfd-gn"><b>В накладных</b><small>телега, машина, грузчики — вписаны в закупку накладной</small></span><span class="pfd-gs">${fm(te)} ₽</span><i class="pfd-ga" aria-hidden="true">›</i></button><div class="pfd-gl">${docExp.sort((a,b)=>b.e-a.e).map(x=>`<div class="pfd-r" data-pfdoc="${esc(x.j.id)}" role="button" tabindex="0"><span class="pfd-n"><b>${esc(cusShort(jWho(x.j).main))} · № ${esc(x.j.number)}</b><small>${fd(x.j.date)}</small></span><span class="pfd-s neg"><b>${fm(x.e)}</b></span></div>`).join("")}</div></section>`:""}
    ${!gs.length&&!docExp.length?`<div class="pvempty">${pvIco("receipt","big")}<b>Записей нет</b><small>За этот период ничего не записано.</small></div>`:""}`; }
function pfdDraw(){ const box=$("#pfd"); if(!box) return; const k=PFD.k;
  box.innerHTML = ["due","debt","old30"].includes(k) ? pfdDebt(k) : ["paid","perpaid"].includes(k) ? pfdPaid(k) : ["exp","inc","own"].includes(k) ? pfdRec(k) : pfdBy(k); }
function pfdClick(e){ const t=e.target.closest("[data-pfpay],[data-pfall],[data-pfled],[data-pfg],[data-pfage],[data-pfsort],[data-pfdoc],[data-pvx],[data-pfmiss],[data-pfgo]"); if(!t) return;
  if(t.dataset.pfpay){ const j=pfDoc(t.dataset.pfpay); if(!j) return; const p=payOf(j); setPay(j,p.tot,todayISO()); saveLocal(); const r=t.closest(".pfd-r"); if(r) r.classList.add("justpaid"); toast("ok","Оплачено","Накладная № "+j.number+" · "+fm(p.left)+" ₽ — "+jWho(j).main); setTimeout(()=>{ pfdDraw(); if(curTab==="profit") drawProfit(); },260); return; }
  if(t.dataset.pfall){ payAll(t.dataset.pfall, todayISO()); pfdDraw(); return; }
  if(t.dataset.pfled){ pvLedger(t.dataset.pfled); return; }
  if(t.dataset.pfg!=null){ const g=t.dataset.pfg, s=t.closest(".pfd-g"), op=!s.classList.contains("open"); s.classList.toggle("open",op); t.setAttribute("aria-expanded",op); if(op) PFD.open.add(g); else PFD.open.delete(g); return; }
  if(t.dataset.pfage!=null){ PFD.age=t.dataset.pfage; pfdDraw(); return; }
  if(t.dataset.pfsort){ PFD.sort=t.dataset.pfsort; pfdDraw(); return; }
  if(t.dataset.pfdoc){ if(e.target.closest("button")) return; const j=pfDoc(t.dataset.pfdoc); if(j) docCard(j,false); return; }
  if(t.dataset.pvx){ const x=pfArr("pother").find(y=>y.id===t.dataset.pvx); if(x){ pvCloseCard(); setTimeout(()=>pvItemOpen(x),220); } return; }
  if(t.dataset.pfmiss!=null){ const [a,b]=pfRange(PF()); pvCloseCard(); tabBackFrom("Прибыль", ()=>zkpGoMiss(a==="0000"?"2000-01-01":a, b==="9999"?todayISO():b, pfdPer()?"«"+pfdPer().toLowerCase()+"»":"за период")); return; }
  if(t.dataset.pfgo!=null){ pvCloseCard(); const b=document.querySelector('#pv-seg [data-pv="fin"]'); if(b) b.click(); return; } }
document.addEventListener("keydown", e=>{ if((e.key==="Enter"||e.key===" ") && e.target.closest && e.target.closest("#pfd [role=button], #pf-cards .pk[data-pfd], #pf-paysum [data-pfd]") && !e.target.matches("button")){ e.preventDefault(); e.target.click(); } });
document.addEventListener("click", e=>{ const t=e.target.closest && e.target.closest("#pf-cards .pk[data-pfd], #pf-paysum [data-pfd]"); if(t) pfDetail(t.dataset.pfd); });
