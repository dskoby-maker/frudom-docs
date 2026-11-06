/* ================= «Прибыль»: разделы «Обзор · По заказчикам · Расходы и доходы» ================= */
/* Быстрая закупка накладной «от кого — сумма»: lines._src=[{n,s}] в «Себестоимости накладных» (работает и со старым скриптом).
   Категории прочих расходов/доходов: список — в личных настройках (prefs.poCats), у записи — поля cat/catName (Code.gs ≥ 15). */
const PV = () => (D.pfv = D.pfv || {v:"ov", m:"", fcat:"", q:""});
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
  const T=all.reduce((a,g)=>({rev:a.rev+g.rev, rs:a.rs+g.rs, cost:a.cost+g.cost, profit:a.profit+g.profit, n:a.n+g.docs.length, miss:a.miss+g.miss}),{rev:0,rs:0,cost:0,profit:0,n:0,miss:0});
  const tiles = L.length ? L.map((g,i)=>{ const mg=g.rev>0?Math.max(0,Math.min(100,g.profit/g.rev*100)):0;
    return `<button type="button" class="pvcus" data-pvc="${esc(g.cid)}" style="--d:${Math.min(i,12)*30}ms">
      <div class="pvch">${pvAva(g.cid)}<div class="pvcn"><b>${esc(pvCusName(g.cid))}</b><small>${g.docs.length} ${plural(g.docs.length,["накладная","накладные","накладных"])} · последняя ${fd(g.last).slice(0,5)}</small></div>${g.miss?`<span class="pvwarn" title="Нет закупки у ${g.miss} ${plural(g.miss,["накладной","накладных","накладных"])}"><i></i>${g.miss}</span>`:""}</div>
      <div class="pvcp"><small>Прибыль</small><b class="${g.profit<0?"neg":""}">${fm(g.profit)} ₽</b><span>${pct(g.profit,g.rev)}</span></div>
      <div class="pvbar"><i style="width:${mg}%"></i></div>
      <dl class="pvcs"><div><dt>Сумма</dt><dd>${fm(g.rev)}</dd></div><div><dt>На р/с</dt><dd>${fm(g.rs)}</dd></div><div><dt>Закупка</dt><dd>${fm(g.cost)}</dd></div></dl>
      <span class="pvgo">Открыть ›</span></button>`; }).join("")
    : `<div class="pvempty">${pvIco("folder","big")}<b>${all.length?"Никого не нашлось":"За этот месяц накладных нет"}</b><small>${all.length?"Попробуйте другое название.":"Выберите другой месяц стрелками сверху."}</small></div>`;
  const head = `<div class="pvhead"><div><h2>По заказчикам</h2><small class="muted">Нажмите на заказчика — накладные, «на р/с», закупка и прибыль, как в вашей таблице</small></div>${pvMonBar()}</div>
    <div class="pvkpi"><div><small>Сумма накладных</small><b>${fm(r2(T.rev))}</b><span>${T.n} ${plural(T.n,["накладная","накладные","накладных"])}</span></div>
      <div><small>На р/с (после налога)</small><b>${fm(r2(T.rs))}</b></div><div><small>Закупка</small><b>${fm(r2(T.cost))}</b>${T.miss?`<span class="warn">без закупки: ${T.miss}</span>`:""}</div>
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
  const all={rev:sum(docs,x=>x.rev), rs:sum(docs,x=>x.rev-x.tax), cost:sum(docs,x=>x.cost), profit:sum(docs,x=>x.profit)};
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
  const chips = src ? src.map(s=>`<span class="pvchip">${esc(s.n||"—")} <b>${fm(+s.s||0)}</b></span>`).join("")
    : x.miss ? `<span class="pvchip miss">+ вписать закупку</span>` : `<span class="pvchip prod" title="Закупка посчитана по товарам">по товарам <b>${fm(x.cost)}</b></span>`;
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
  el.innerHTML=`<div><small>Сумма</small><b>${fm(x.rev)}</b></div><div><small>На р/с</small><b>${fm(r2(x.rev-x.tax))}</b></div><div><small>Закупка</small><b>${fm(c)}</b></div><div class="pos"><small>Прибыль</small><b class="${p<0?"neg":""}">${fm(p)}</b><span>${pct(p,x.rev)}</span></div>`; }
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
function pvFinDraw(){
  const box=$("#pv-fin"), f=PV(), [d1,d2]=pvRange(), cats=pvCats();
  const all=pfArr("pother").filter(x=>x.date>=d1 && x.date<=d2), inc=x=>x.kind===PO_INC;
  const E=r2(all.filter(x=>!inc(x)).reduce((a,x)=>a+(+x.sum||0),0)), I=r2(all.filter(inc).reduce((a,x)=>a+(+x.sum||0),0));
  const by=(list)=>{ const m=new Map(); list.forEach(x=>{ const c=pvCat(x.cat); const k=c.id; if(!m.has(k)) m.set(k,{c, s:0, n:0}); const g=m.get(k); g.s+=(+x.sum||0); g.n++; }); return [...m.values()].sort((a,b)=>b.s-a.s); };
  const bars=(list, tot, kind)=> list.length ? list.map((g,i)=>`<button type="button" class="pvcb ${f.fcat===kind+":"+g.c.id?"on":""}" data-pvf="${kind}:${esc(g.c.id)}" style="--d:${i*40}ms">${pvBubble(g.c)}<span class="pvcbn"><b>${esc(g.c.n)}</b><small>${g.n} ${plural(g.n,["запись","записи","записей"])}</small></span><span class="pvcbs"><b>${fm(r2(g.s))}</b><small>${pct(g.s,tot)}</small></span><i class="pvcbb"><i style="width:${tot?Math.max(2,g.s/tot*100):0}%;background:${pvCol(g.c.h,.75)}"></i></i></button>`).join("") : `<p class="muted pvnone">Пока ничего</p>`;
  const L=all.filter(x=>!f.fcat || (f.fcat===(inc(x)?"inc":"exp")+":"+pvCat(x.cat).id)).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  const days=new Map(); L.forEach(x=>{ if(!days.has(x.date)) days.set(x.date,[]); days.get(x.date).push(x); });
  const fc=f.fcat ? pvCat(f.fcat.split(":")[1]) : null;
  box.innerHTML = `<div class="pvhead"><div><h2>Расходы и доходы</h2><small class="muted">Всё, что не закупка товара: зарплата, бензин, аренда, проценты…</small></div>${pvMonBar()}</div>
    <div class="pvacts"><button type="button" class="pvadd exp" data-pva="exp"><span>−</span>Расход</button><button type="button" class="pvadd inc" data-pva="inc"><span>+</span>Доход</button><span style="flex:1"></span><button type="button" class="btn ghost sm" data-pva="cats">${pvIco("gear")}Категории</button></div>
    ${D.poSrv?"":`<p class="note">Пока скрипт таблицы старый, записи хранятся только на этом устройстве. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>`}
    ${pvCatOk()?"":`<p class="note">Категории начнут сохраняться после обновления скрипта таблицы (Code.gs, версия 15). <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>`}
    <div class="pvkpi"><div class="neg"><small>Расходы</small><b>${pvMoney(-E)}</b></div><div class="pos"><small>Доходы</small><b>${pvMoney(I,true)}</b></div><div><small>Итог</small><b class="${I-E<0?"neg":""}">${pvMoney(r2(I-E),true)}</b></div></div>
    <div class="pvcats"><div><h3>Расходы по категориям</h3>${bars(by(all.filter(x=>!inc(x))),E,"exp")}</div><div><h3>Доходы по категориям</h3>${bars(by(all.filter(inc)),I,"inc")}</div></div>
    ${fc?`<div class="pvfilt">Показано: ${pvBubble(fc)} <b>${esc(fc.n)}</b><button type="button" class="btn ghost sm" data-pvf="">Показать всё ×</button></div>`:""}
    <div class="pvlist">${days.size ? [...days.entries()].map(([d,xs],di)=>{ const t=r2(xs.reduce((a,x)=>a+(inc(x)?1:-1)*(+x.sum||0),0));
      return `<div class="pvday" style="--d:${Math.min(di,10)*35}ms"><div class="pvdh"><b>${pvDay(d)}</b><span class="${t<0?"neg":"pos"}">${pvMoney(t,true)} ₽</span></div>${xs.map(x=>{ const c=pvCat(x.cat), s=+x.sum||0;
        return `<button type="button" class="pvit" data-pvx="${esc(x.id)}">${pvBubble(c)}<span class="pvitn"><b>${esc(x.note||c.n)}</b><small>${esc(c.n)}${x.supplierId?" · "+esc(supShort(sup(x.supplierId).name||"")):""}${x.by?" · "+esc(x.by):""}</small></span><span class="pvits ${inc(x)?"pos":"neg"}">${pvMoney(inc(x)?s:-s,true)} ₽</span></button>`; }).join("")}</div>`; }).join("")
      : `<div class="pvempty">${pvIco("receipt","big")}<b>${all.length?"В этой категории записей нет":"За этот месяц записей нет"}</b><small>Нажмите «− Расход» или «+ Доход», чтобы добавить.</small></div>`}</div>`;
}
function pvFinClick(e){
  const m=e.target.closest("[data-pvm]"); if(m){ pvMonClick(m); return; }
  const f=e.target.closest("[data-pvf]"); if(f){ const k=f.dataset.pvf; PV().fcat = PV().fcat===k ? "" : k; saveLocal(); pvFinDraw(); return; }
  const a=e.target.closest("[data-pva]"); if(a){ if(a.dataset.pva==="cats") pvCatsOpen(); else pvItemOpen(null, a.dataset.pva); return; }
  const x=e.target.closest("[data-pvx]"); if(x){ const it=pfArr("pother").find(y=>y.id===x.dataset.pvx); if(it) pvItemOpen(it); }
}
let PVI=null;
function pvItemOpen(it, kind){
  const inc = it ? it.kind===PO_INC : kind==="inc"; PVI={id:it?it.id:"", inc, cat:it?(it.cat||""):""};
  const m=pvMonth(), dDef = m!=="all" && todayISO().slice(0,7)!==m ? m+"-01" : todayISO();
  openCard(`<div class="dc-head"><div><div class="dc-kicker">${it?"Изменить запись":inc?"Новый доход":"Новый расход"}</div><h3 id="pvi-t">${inc?"Доход":"Расход"}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="pvform">
      <div class="pvkind" id="pvi-kind" style="--i:${inc?1:0}"><i></i><button type="button" data-pvk="exp" class="${inc?"":"on"}">− Расход</button><button type="button" data-pvk="inc" class="${inc?"on":""}">+ Доход</button></div>
      <label class="pvsum"><span>Сумма</span><input id="pvi-sum" inputmode="decimal" placeholder="0" value="${it?esc(String(it.sum).replace(".",",")):""}" autocomplete="off"><em>₽</em></label>
      <div class="pvcatl"><span>Категория</span>${pvCatOk()?"":`<small class="muted">сохранится после обновления скрипта таблицы</small>`}<div class="pvcg" id="pvi-cats"></div></div>
      <div class="grid"><label class="f">Дата<input type="date" id="pvi-date" value="${it?esc(it.date):dDef}"></label>
        <label class="f">ИП<select id="pvi-sup"><option value="">Общие</option>${opts(D.suppliers, it?it.supplierId:"")}</select></label>
        <label class="f wide">${inc?"Откуда":"На что"}<input id="pvi-note" list="pvi-notes" maxlength="200" placeholder="${inc?"например, проценты по вкладу":"например, бензин Гриша"}" value="${it?esc(it.note||""):""}"><datalist id="pvi-notes">${[...new Set(pfArr("pother").map(x=>x.note).filter(Boolean))].slice(-60).reverse().map(n=>`<option value="${esc(n)}">`).join("")}</datalist></label></div>
      <div class="pvea"><button type="button" class="btn pri" data-pvi="save">${it?"Сохранить":"Добавить"}</button><button type="button" class="btn ghost" data-dc="close">Отмена</button><span style="flex:1"></span>${it?`<button type="button" class="btn ghost danger" data-pvi="del">Удалить</button>`:""}</div>
    </div>`, false, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("pvi-d"); pvItemCats();
  d.addEventListener("click", pvItemClick); d.addEventListener("keydown", e=>{ if(e.key==="Enter" && /pvi-(sum|note)/.test(e.target.id)){ e.preventDefault(); pvItemSave(); } });
  setTimeout(()=>{ const s=$("#pvi-sum"); if(s){ s.focus(); s.select(); } }, 60);
}
function pvItemCats(){ const box=$("#pvi-cats"); if(!box) return; const k=PVI.inc?"inc":"exp", L=pvCats().filter(c=>c.k===k||c.k==="both");
  if(PVI.cat && !L.some(c=>c.id===PVI.cat)) PVI.cat="";
  box.innerHTML=L.map(c=>`<button type="button" class="pvcc ${PVI.cat===c.id?"on":""}" data-pvcat="${esc(c.id)}" style="--h:${c.h==null?0:c.h}" ${pvCatOk()?"":"disabled"}><span>${pvIco(c.i)}</span>${esc(c.n)}</button>`).join("") + `<button type="button" class="pvcc add" data-pvi="cats" title="Добавить или изменить категории">＋</button>`; }
function pvItemClick(e){
  const k=e.target.closest("[data-pvk]"); if(k){ PVI.inc=k.dataset.pvk==="inc"; const s=$("#pvi-kind"); s.style.setProperty("--i", PVI.inc?1:0); s.querySelectorAll("button").forEach(b=>b.classList.toggle("on", b===k)); $("#pvi-t").textContent=PVI.inc?"Доход":"Расход"; pvItemCats(); return; }
  const c=e.target.closest("[data-pvcat]"); if(c){ PVI.cat = PVI.cat===c.dataset.pvcat ? "" : c.dataset.pvcat; $("#pvi-cats").querySelectorAll("[data-pvcat]").forEach(b=>b.classList.toggle("on", b.dataset.pvcat===PVI.cat)); return; }
  const b=e.target.closest("[data-pvi]"); if(!b) return;
  if(b.dataset.pvi==="save") pvItemSave();
  if(b.dataset.pvi==="cats"){ pvCatsOpen(); }
  if(b.dataset.pvi==="del"){ if(!armed(b,"Точно удалить?")) return; const x=pfArr("pother").find(y=>y.id===PVI.id); D.pother=pfArr("pother").filter(y=>y.id!==PVI.id); dirty("pother", PVI.id, true);
    if(x) logEv("Прибыль","Удалён "+(x.kind===PO_INC?"прочий доход":"прочий расход")+": "+(x.note||"")+" — "+fm(+x.sum||0)+" ₽"); saveLocal(); pvCloseCard(); drawProfit(); toast("ok","Запись удалена","Вернуть — кнопка «Отменить» внизу."); }
}
function pvItemSave(){
  const v=+num($("#pvi-sum").value), note=$("#pvi-note").value.trim(), date=$("#pvi-date").value||todayISO(), c=pvCat(PVI.cat);
  if(!(v>0)){ toast("err","Впишите сумму",""); $("#pvi-sum").focus(); return; }
  if(!note && !PVI.cat){ toast("err", PVI.inc?"Откуда доход?":"На что расход?", "Выберите категорию или впишите пару слов."); $("#pvi-note").focus(); return; }
  const old=PVI.id ? pfArr("pother").find(y=>y.id===PVI.id) : null, x=old || {id:uid(), by:curUser()};
  Object.assign(x, {date, kind:PVI.inc?PO_INC:PO_EXP, sum:String(r2(v)), note:note||c.n, supplierId:$("#pvi-sup").value||""});
  if(pvCatOk()){ x.cat=PVI.cat; x.catName=PVI.cat?c.n:""; }
  if(!old) pfArr("pother").push(x); dirty("pother", x.id);
  logEv("Прибыль",(old?"Изменён прочий ":"Прочий ")+(PVI.inc?"доход":"расход")+": "+x.note+(PVI.cat?" ["+c.n+"]":"")+" — "+fm(v)+" ₽ от "+fd(date));
  saveLocal(); pvCloseCard();
  const m=pvMonth(); if(m!=="all" && date.slice(0,7)!==m){ PV().m=date.slice(0,7); saveLocal(); }
  drawProfit(); toast("ok", old?"Сохранено":PVI.inc?"Доход добавлен":"Расход добавлен", (PVI.cat?c.n+" · ":"")+fm(v)+" ₽");
  setTimeout(()=>{ const r=document.querySelector(`#pv-fin [data-pvx="${x.id}"]`); if(r) r.classList.add("fresh"); }, 30);
}
function pvCloseCard(){ const d=$("#fd-dcard"); if(!d) return; d.classList.add("out"); setTimeout(()=>{ try{ d.close(); }catch(x){} d.remove(); }, 200); }

/* ---------- категории ---------- */
let PVC=null;
function pvCatsOpen(){
  const back = PVI && $("#fd-dcard.pvi-d") ? {it:PVI.id?pfArr("pother").find(y=>y.id===PVI.id):null, inc:PVI.inc, v:$("#pvi-sum").value, n:$("#pvi-note").value, d:$("#pvi-date").value, s:$("#pvi-sup").value, cat:PVI.cat} : null;
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
  if(a==="back"){ const bk=PVC.back; pvCloseCard(); setTimeout(()=>{ pvItemOpen(bk.it, bk.inc?"inc":"exp"); PVI.cat=bk.cat; PVI.inc=bk.inc; $("#pvi-sum").value=bk.v; $("#pvi-note").value=bk.n; $("#pvi-date").value=bk.d; $("#pvi-sup").value=bk.s; pvItemCats(); }, 220); return; }
  if(!c) return;
  if(a==="ico"){ PVC.pick = PVC.pick===id ? "" : id; pvCatsDraw(); return; }
  if(a==="seti"){ c.i=b.dataset.v; pvCatsCommit(); return; }
  if(a==="seth"){ c.h=+b.dataset.v; pvCatsCommit(); return; }
  if(a==="up"||a==="down"){ const j=i+(a==="up"?-1:1); [PVC.list[i],PVC.list[j]]=[PVC.list[j],PVC.list[i]]; pvCatsCommit(); return; }
  if(a==="del"){ const n=pfArr("pother").filter(x=>x.cat===id).length; if(!armed(b, n?"Удалить? "+n+" зап. станут «без категории»":"Удалить?")) return; PVC.list.splice(i,1); pvCatsCommit(); }
}
