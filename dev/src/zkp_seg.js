/* ---------- вкладка «Закупка»: закупка по накладным и комплектам прямо на странице (только администратор) ----------
   Сверху — список накладных и комплектов за период со статусом закупки (как значок в журнале), плитки итогов, фильтры.
   Нажатие на строку раскрывает под ней тот же редактор, что в окне документа (dcZkDraw) или комплекта (bzDraw).
   Открыт только один редактор: у них общие id (#dc-zk/#bz-zk), поэтому перед открытием окна (openCard) он сворачивается. */
const ZKP={per:"7", st:"need", q:"", n:30, open:"", list:[], view:(()=>{ try{ return localStorage.getItem("frudom-zkpv")==="cal"?"cal":"list"; }catch(e){ return "list"; } })(), ym:"", day:"", rng:null};
/* переход из «Прибыли» по «без закупки: N»: свой период [от, до, подпись] и фильтр «Без закупки» — ровно те накладные, что посчитаны там */
function zkpGoMiss(a, b, lbl, st){ ZKP.rng=[a, b, lbl]; ZKP.st=st||"miss"; ZKP.q=""; ZKP.day=""; ZKP.n=30; ZKP.view="list"; zkpCollapse();
  const q=$("#zkp-q"); if(q) q.value=""; goTab("purchase"); zkpDraw(true); const k=$("#zkp"); if(k) setTimeout(()=>k.scrollIntoView({behavior:"smooth", block:"start"}), 60); }
function zkpRngOff(){ if(!ZKP.rng) return; ZKP.rng=null; if(ZKP.st==="miss"||ZKP.st==="loss") ZKP.st="need"; }
/* вид «Календарь»: месяц сеткой, у дня — накладные цветом закупки; нажатие на день — список за этот день */
const zkpYm = () => ZKP.ym || (ZKP.ym=todayISO().slice(0,7));
const zkpYmShift = (ym, d) => { const t=new Date(+ym.slice(0,4), +ym.slice(5,7)-1+d, 1); return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0"); };
const ZKP_MON=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];
function zkpRange(){ const n=new Date(), iso=jIso;
  if(ZKP.rng) return [ZKP.rng[0], ZKP.rng[1]];
  if(ZKP.view==="cal"){ const ym=zkpYm(), y=+ym.slice(0,4), m=+ym.slice(5,7); return [ym+"-01", iso(new Date(y,m,0))]; }
  if(ZKP.per==="7") return [iso(new Date(n.getFullYear(),n.getMonth(),n.getDate()-6)), "9999"];
  if(ZKP.per==="30") return [iso(new Date(n.getFullYear(),n.getMonth(),n.getDate()-29)), "9999"];
  if(ZKP.per==="m") return [iso(new Date(n.getFullYear(),n.getMonth(),1)), iso(new Date(n.getFullYear(),n.getMonth()+1,0))];
  if(ZKP.per==="pm") return [iso(new Date(n.getFullYear(),n.getMonth()-1,1)), iso(new Date(n.getFullYear(),n.getMonth(),0))];
  return ["0000","9999"]; }
/* состояние строки: статус как в журнале + деньги */
function zkpCalc(it){ const g=it.g.map(j=>D.journal.find(x=>x.id===j.id)||j).filter(j=>j.snap&&!isArch(j)); it.g=g; if(!g.length){ it.gone=true; return it; }
  const S=g.map(zkJState).filter(Boolean), done=S.filter(x=>x.st==="ok").length, all=k=>S.length&&S.every(x=>x.st===k);
  it.st = !S.length ? "none" : all("ok") ? "ok" : all("none") ? "none" : "part";
  it.notes=[].concat(...S.map(s=>s.tip.split("\n").slice(1))); it.notes=[...new Set(it.notes)];
  if(g.length>1){ it.lbl = it.st==="ok"?"✓":it.st==="none"?"нет":done+"/"+S.length; it.tip=it.st==="ok"?"Закупка заполнена во всех накладных":it.st==="none"?"Закупка не заполнена":"Закупка заполнена в "+done+" из "+S.length+" накладных"; }
  else { const s=S[0]; it.lbl = s?zkJLbl(s):"нет"; it.tip = s?s.tip.split("\n")[0]:"Закупка не заполнена"; }
  it.loss=zkLossSum(S);
  let sum=0, rev=0, cost=0, prof=0, miss=0; g.forEach(j=>{ const x=docProfit(j); if(x.miss) miss++; sum+=x.k.t.sum; rev+=x.rev; cost+=x.cost+(x.exp||0); prof+=x.profit; });
  Object.assign(it, {miss, sum:r2(sum), rev:r2(rev), cost:r2(cost), prof:r2(prof), date:g[0].date}); return it; }
function zkpItems(){ const [a,b]=zkpRange(); return zkpItemsIn(a,b); }
function zkpItemsIn(a, b){ const G={}, out=[];
  D.journal.filter(j=>j.snap && !isArch(j) && j.date>=a && j.date<=b).forEach(j=>{ const k=jKey(j); if(k) (G[k]=G[k]||[]).push(j); else out.push({key:"d:"+j.id, g:[j]}); });
  Object.keys(G).forEach(k=>{ const g=G[k].sort(jNumSort); out.push(g.length>1 ? {key:"g:"+k, gk:k, g} : {key:"d:"+g[0].id, g}); });
  out.forEach(zkpCalc);
  return out.filter(x=>!x.gone).sort((x,y)=>(y.date||"").localeCompare(x.date||"") || String(y.g[0].number).localeCompare(String(x.g[0].number),"ru",{numeric:true})); }
const zkpTitle = it => it.g.length>1 ? gTitle(it.g) : jWho(it.g[0]).main;
const zkpNums = it => { const n=it.g.map(j=>j.number); return "№ "+(n.length>2?n[0]+"–"+n[n.length-1]:n.join(", ")); };
const zkpPass = (it, st) => st==="loss" ? !!it.loss : st==="all" || st==="miss" ? st==="all" || it.miss>0 : (st==="need" ? it.st!=="ok" : it.st===st);
function zkpRowIn(it){ const sub=zkpNums(it)+(it.g.length>1?" · "+it.g.length+" "+docsWord(it.g.length):(kLbl(it.g[0])?" · "+kLbl(it.g[0]):""));
  const note = it.notes.length ? `<small class="zkp-n">⚠ ${esc(it.notes[0])}${it.notes.length>1?` <span>и ещё ${it.notes.length-1}</span>`:""}</small>` : "";
  return `<span class="zkp-d">${fd(it.date).slice(0,5)}</span>
    <span class="zkp-t"><b>${esc(zkpTitle(it))}</b><small>${esc(sub)}</small>${note}</span>
    <span class="zkp-s"><b>${fm(it.sum)} ₽</b>${it.st!=="none"?`<small>прибыль <span class="${it.prof<0?"neg":""}">${fm(it.prof)}</span></small>`:`<small class="muted">закупки нет</small>`}</span>
    <span class="jzk ${it.st}${it.loss?" loss":""}" title="${esc(it.tip+(it.loss?"\n"+zkLossTip(it.loss.p, it.loss.neg):""))}">${IC_ZK}<span>${esc(it.lbl)}</span>${it.loss?`<i class="jzk-l" aria-hidden="true"></i>`:""}</span><span class="zkp-a" aria-hidden="true">▾</span>`; }
function zkpRow(it){ const o=ZKP.open===it.key; return `<div class="zkp-it${o?" open":""}" data-key="${esc(it.key)}"><button type="button" class="zkp-row" data-zkpo="${esc(it.key)}" aria-expanded="${o}">${zkpRowIn(it)}</button><div class="zkp-ed"><div class="zkp-edi dcard"></div></div></div>`; }
function zkpKpi(L){ const c=k=>L.filter(x=>x.st===k).length, rev=r2(L.reduce((a,x)=>a+x.rev,0)), cost=r2(L.reduce((a,x)=>a+(x.st!=="none"?x.cost:0),0)), prof=r2(L.filter(x=>x.st!=="none").reduce((a,x)=>a+x.prof,0)), docs=L.reduce((a,x)=>a+x.g.length,0);
  $("#zkp-kpi").innerHTML=`<div><small>Накладных</small><b>${docs}</b><span>${L.length} ${plural(L.length,["строка","строки","строк"])} в списке</span></div>
    <div class="${c("none")?"bad":""}"><small>Без закупки</small><b>${c("none")}</b><span>частично: ${c("part")}</span></div>
    <div><small>Выручка</small><b>${fm(rev)}</b><span>без НДС</span></div>
    <div class="hi"><small>Прибыль по заполненным</small><b class="${prof<0?"neg":""}">${fm(prof)}</b><span>закупка ${fm(cost)}</span></div>`;
  const ch=[...(ZKP.rng?[ZKP.st==="loss"?["loss","В минус",L.filter(x=>x.loss).length]:["miss","Без закупки",L.filter(x=>x.miss>0).length]]:[]),["need","Нужно заполнить",L.filter(x=>x.st!=="ok").length],["none","Нет закупки",c("none")],["part","Частично",c("part")],["ok","Заполнено",c("ok")],["all","Все",L.length]];
  const rb=$("#zkp-rng"); if(rb){ rb.hidden=!ZKP.rng; rb.innerHTML=ZKP.rng?`<span>Из «Прибыли»: накладные <b>${esc(ZKP.rng[2])}</b>, ${ZKP.st==="loss"?"которые ушли в минус":"где не хватает закупки"}</span><button type="button" class="btn ghost sm" data-zkprng>Обычный список ×</button>`:""; }
  $("#zkp-st").innerHTML=ch.map(([k,t,n])=>`<button type="button" class="${ZKP.st===k?"on":""} ${k}" data-zkpst="${k}">${t} <b>${n}</b></button>`).join(""); }
/* полная перерисовка списка; если редактор открыт — только обновить строки, чтобы не потерять набранное */
function zkpDraw(force){ const box=$("#zkp-list"); if(!box || !me().admin) return;
  document.querySelectorAll("#zkp-per [data-zkpp]").forEach(b=>b.classList.toggle("on", !ZKP.rng && b.dataset.zkpp===ZKP.per));
  if(ZKP.open && !force){ zkpRefresh(); return; }
  if(!pfLoaded){ box.innerHTML=`<p class="muted zkp-empty">Загружаю данные о закупке…</p>`; return; }
  ZKP.list=zkpItems(); const q=ZKP.q.trim().toLowerCase();
  const L=ZKP.list.filter(it=>!q || (zkpTitle(it)+" "+it.g.map(j=>j.number+" "+(kLbl(j)||"")).join(" ")).toLowerCase().includes(q));
  zkpView(); zkpCalDraw(L); const LD=ZKP.view==="cal"&&ZKP.day ? L.filter(it=>it.date===ZKP.day) : L;
  zkpKpi(LD); const V=LD.filter(it=>zkpPass(it, ZKP.st)), sh=V.slice(0, ZKP.n), keep=ZKP.open&&box.querySelector(".zkp-it.open");
  box.innerHTML = sh.length ? sh.map(zkpRow).join("") + (V.length>sh.length?`<button type="button" class="btn ghost zkp-more" data-zkpmore>Показать ещё ${Math.min(30, V.length-sh.length)} из ${V.length-sh.length}</button>`:"")
    : `<p class="muted zkp-empty">${!LD.length?(ZKP.view==="cal"&&ZKP.day?"В этот день накладных нет.":"За этот период накладных нет."):ZKP.st==="need"?"✓ Все накладные за период с закупкой — заполнять нечего.":"Ничего не найдено."}</p>`;
  /* открытый редактор переносим в новый список как есть (с набранным) */
  if(keep){ const n=box.querySelector(`.zkp-it[data-key="${CSS.escape(ZKP.open)}"]`); if(n) n.replaceWith(keep); else ZKP.open=""; } }
/* обновить строки и плитки на месте (после сохранения закупки) */
function zkpRefresh(){ if(!$("#zkp-list")) return; ZKP.list.forEach(zkpCalc); ZKP.list=ZKP.list.filter(x=>!x.gone);
  ZKP.list.forEach(it=>{ const r=document.querySelector(`#zkp-list .zkp-it[data-key="${CSS.escape(it.key)}"] > .zkp-row`); if(r) r.innerHTML=zkpRowIn(it); });
  const q=ZKP.q.trim().toLowerCase(), L=ZKP.list.filter(it=>!q || (zkpTitle(it)+" "+it.g.map(j=>j.number).join(" ")).toLowerCase().includes(q)); zkpCalDraw(L); zkpKpi(ZKP.view==="cal"&&ZKP.day?L.filter(it=>it.date===ZKP.day):L); }
function zkpAfter(){ if(curTab==="purchase") zkpRefresh(); }
/* свернуть открытый редактор: id убираем сразу (их ищут по документу), содержимое — после анимации */
function zkpCollapse(){ const o=document.querySelector("#zkp-list .zkp-it.open"); ZKP.open=""; if(!o) return; o.classList.remove("open"); const r=o.querySelector(".zkp-row"); if(r) r.setAttribute("aria-expanded","false");
  const h=o.querySelector(".zkp-edi"); h.querySelectorAll("[id]").forEach(e=>e.removeAttribute("id")); h.inert=true; setTimeout(()=>{ if(!o.classList.contains("open")){ h.innerHTML=""; h.inert=false; } }, 400); }
async function zkpOpen(key){ const it=ZKP.list.find(x=>x.key===key); if(!it) return; zkpCollapse(); const el=document.querySelector(`#zkp-list .zkp-it[data-key="${CSS.escape(key)}"]`); if(!el) return;
  ZKP.open=key; el.classList.add("open"); el.querySelector(".zkp-row").setAttribute("aria-expanded","true"); const h=el.querySelector(".zkp-edi"); h.inert=false;
  const one=it.g.length===1, j=it.g[0];
  h.innerHTML = (one ? `<div class="dc-zk open" id="dc-zk" data-doc="${j.id}"><div class="dc-zki" id="dc-zki"><p class="muted">Загружаю…</p></div></div>`
      : `<div class="dc-zk open" id="bz-zk" data-ids="${esc(it.g.map(x=>x.id).join(","))}"><div class="dc-zki" id="bz-zki"><p class="muted">Загружаю…</p></div></div>`)
    + `<div class="zkp-lnk"><button type="button" class="btn ghost sm" data-zkpcard="${esc(key)}">${one?"Открыть накладную ›":"Открыть комплект ›"}</button>${one?"":`<small class="muted">Цена товара пишется сразу во все ${it.g.length} ${docsWord(it.g.length)}</small>`}</div>`;
  if(!pfLoaded) await loadProfit(true);
  if(SK_READY && skCan() && skSrv!==false && (!SK || !SK.at || Date.now()-new Date(SK.at).getTime()>120000)){ const b=$(one?"#dc-zki":"#bz-zki"); if(b) b.innerHTML=`<p class="muted">Сверяю склад…</p>`; await skLoad(true); }
  if(ZKP.open!==key) return;
  if(one) dcZkDraw(D.journal.find(x=>x.id===j.id)||j); else { BZ={ids:it.g.map(x=>x.id), touched:{}, expT:false, rows:[], s:null, ship:null}; bzDraw(); }
  setTimeout(()=>{ if(ZKP.open!==key) return; const r=el.getBoundingClientRect(); if(r.top<70 || r.top>innerHeight*0.6) el.scrollIntoView({behavior:"smooth", block:"start"});
    const f=el.querySelector(one?".dzs":".bzs"); if(f && matchMedia("(hover:hover)").matches) f.focus({preventScroll:true}); }, 300); }
document.addEventListener("click", e=>{ const t=e.target.closest&&e.target.closest("#zkp [data-zkpo],#zkp [data-zkpp],#zkp [data-zkpst],#zkp [data-zkpmore],#zkp [data-zkpcard],#zkp [data-zkpv],#zkp [data-zkpm],#zkp [data-zkpd],#zkp [data-zkprng]"); if(!t) return;
  if(t.dataset.zkprng!=null){ zkpRngOff(); ZKP.view=(()=>{ try{ return localStorage.getItem("frudom-zkpv")==="cal"?"cal":"list"; }catch(x){ return "list"; } })(); ZKP.n=30; zkpCollapse(); zkpDraw(true); return; }
  if(t.dataset.zkpv){ if(ZKP.view===t.dataset.zkpv && !ZKP.rng) return; zkpRngOff(); ZKP.view=t.dataset.zkpv; ZKP.day=""; ZKP.n=30; try{ localStorage.setItem("frudom-zkpv", ZKP.view); }catch(x){} zkpCollapse(); zkpDraw(true); return; }
  if(t.dataset.zkpm){ zkpRngOff(); ZKP.ym = t.dataset.zkpm==="0" ? todayISO().slice(0,7) : zkpYmShift(zkpYm(), +t.dataset.zkpm); ZKP.day=""; ZKP.n=30; zkpCollapse(); zkpDraw(true); return; }
  if(t.dataset.zkpd!=null){ ZKP.day = ZKP.day===t.dataset.zkpd ? "" : t.dataset.zkpd; if(ZKP.day) ZKP.st="all"; ZKP.n=30; zkpCollapse(); zkpDraw(true); if(ZKP.day){ const l=$("#zkp-list"); setTimeout(()=>l&&l.scrollIntoView({behavior:"smooth", block:"nearest"}), 60); } return; }
  if(t.dataset.zkpo!=null){ if(ZKP.open===t.dataset.zkpo) zkpCollapse(); else zkpOpen(t.dataset.zkpo); return; }
  if(t.dataset.zkpp){ zkpRngOff(); ZKP.per=t.dataset.zkpp; ZKP.n=30; zkpCollapse(); zkpDraw(true); return; }
  if(t.dataset.zkpst){ ZKP.st=t.dataset.zkpst; ZKP.n=30; zkpCollapse(); zkpDraw(true); return; }
  if(t.dataset.zkpmore!=null){ ZKP.n+=30; zkpDraw(true); return; }
  if(t.dataset.zkpcard){ const it=ZKP.list.find(x=>x.key===t.dataset.zkpcard); if(!it) return; zkpCollapse(); if(it.g.length===1) docCard(it.g[0], false); else bundleCard(it.g, false); } });
document.addEventListener("input", e=>{ if(e.target.id!=="zkp-q") return; ZKP.q=e.target.value; ZKP.n=30; clearTimeout(zkpDraw._t); zkpDraw._t=setTimeout(()=>{ zkpCollapse(); zkpDraw(true); }, 200); });

/* переключатель «Список / Календарь» и сам календарь */
function zkpView(){ const sw=$("#zkp-vw"); if(!sw) return; const cal=ZKP.view==="cal";
  sw.querySelectorAll("[data-zkpv]").forEach(b=>{ const on=b.dataset.zkpv===ZKP.view; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on); }); sw.style.setProperty("--x", cal?"100%":"0%");
  const per=$("#zkp-per"); if(per) per.hidden=cal; const c=$("#zkp-cal"); if(c) c.hidden=!cal; }
function zkpCalDraw(L){ const box=$("#zkp-cal"); if(!box) return; if(ZKP.view!=="cal"){ box.innerHTML=""; return; }
  const ym=zkpYm(), y=+ym.slice(0,4), m=+ym.slice(5,7), days=new Date(y,m,0).getDate(), first=(new Date(y,m-1,1).getDay()+6)%7, t=todayISO(), by={};
  L.forEach(it=>{ (by[it.date]=by[it.date]||[]).push(it); });
  const rank={none:0, part:1, ok:2}, cells=[];
  for(let i=0;i<first;i++) cells.push(`<span class="zkc-e" aria-hidden="true"></span>`);
  for(let d=1; d<=days; d++){ const iso=ym+"-"+String(d).padStart(2,"0"), I=by[iso]||[], wd=(first+d-1)%7;
    if(!I.length){ cells.push(`<span class="zkc-d empty${iso===t?" today":""}${wd>4?" we":""}"><i>${d}</i></span>`); continue; }
    const worst=I.reduce((a,x)=>rank[x.st]<rank[a]?x.st:a, "ok"), n=I.reduce((a,x)=>a+x.g.length,0), sum=r2(I.reduce((a,x)=>a+x.sum,0)), loss=I.some(x=>x.loss);
    const dots=I.slice(0,8).map(x=>`<b class="${x.st}"></b>`).join("")+(I.length>8?`<em>+${I.length-8}</em>`:"");
    cells.push(`<button type="button" class="zkc-d ${worst}${iso===ZKP.day?" sel":""}${iso===t?" today":""}${wd>4?" we":""}" data-zkpd="${iso}" aria-pressed="${iso===ZKP.day}" title="${esc(fd(iso)+": "+n+" "+plural(n,["накладная","накладные","накладных"])+" на "+fm(sum)+" ₽")}"><i>${d}</i><span class="zkc-n">${n} ${plural(n,["нак.","нак.","нак."])}</span><span class="zkc-s">${fm(Math.round(sum)).replace(/,00$/,"")}</span><span class="zkc-dots">${dots}</span>${loss?`<u class="jzk-l" aria-hidden="true"></u>`:""}</button>`); }
  const cnt=k=>L.filter(x=>x.st===k).length;
  box.innerHTML=`<div class="zkc-h"><button type="button" class="zkc-a" data-zkpm="-1" aria-label="Прошлый месяц">‹</button><b>${ZKP_MON[m-1]} ${y}</b><button type="button" class="zkc-a" data-zkpm="1" aria-label="Следующий месяц">›</button>${ym!==t.slice(0,7)?`<button type="button" class="btn ghost sm" data-zkpm="0">Сегодня</button>`:""}
      <span class="zkc-leg"><span><b class="none"></b>нет закупки ${cnt("none")}</span><span><b class="part"></b>частично ${cnt("part")}</span><span><b class="ok"></b>заполнено ${cnt("ok")}</span></span></div>
    <div class="zkc-w">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>`<span>${x}</span>`).join("")}</div><div class="zkc-g">${cells.join("")}</div>
    ${ZKP.day?`<p class="zkc-f">Показаны накладные за <b>${fd(ZKP.day)}</b> · <button type="button" class="btn ghost sm" data-zkpd="${ZKP.day}">Весь месяц</button></p>`:`<p class="zkc-f muted">Нажмите на день — ниже останутся накладные этого дня.</p>`}`; }
/* ---------- «Excel»: закупка за день или период одной таблицей ----------
   Окно выбора периода (по умолчанию — как на экране), потом книга из трёх листов:
   «Товары» — строка на товар накладной (продано, откуда, куплено, цена и сумма закупки, прибыль строки),
   «Накладные» — итог по накладной (выручка, закупка, расходы, налог, прибыль, статус),
   «Итого по товарам» — сколько всего куплено каждого товара и по какой средней цене. */
const zkxIso = d => jIso(d);
function zkxPresets(){ const n=new Date(), y=n.getFullYear(), m=n.getMonth(), d=n.getDate(), t=todayISO();
  return [["today","Сегодня",t,t],["yest","Вчера",zkxIso(new Date(y,m,d-1)),zkxIso(new Date(y,m,d-1))],["7","7 дней",zkxIso(new Date(y,m,d-6)),t],
    ["m","Этот месяц",zkxIso(new Date(y,m,1)),zkxIso(new Date(y,m+1,0))],["pm","Прошлый месяц",zkxIso(new Date(y,m-1,1)),zkxIso(new Date(y,m,0))]]; }
function zkxNow(){ if(ZKP.view==="cal" && ZKP.day) return [ZKP.day, ZKP.day]; const [a,b]=zkpRange(); return [a==="0000"?"":a, b==="9999"?todayISO():b]; }
function zkxDocs(a, b){ return D.journal.filter(j=>j.snap && !isArch(j) && j.date>=a && j.date<=b).sort((x,y)=>x.date<y.date?-1:x.date>y.date?1:String(x.number).localeCompare(String(y.number),"ru",{numeric:true})); }
/* окно: маленький календарь с точками закупки (как во вкладке), выбор дня или диапазона нажатиями */
const ZKX={a:"", b:"", ym:"", pick:false};
function zkxOpen(){ if(!pfLoaded){ toast("info","Подождите","Данные о закупке ещё загружаются."); return; }
  const [a,b]=zkxNow(); Object.assign(ZKX, {a:a||todayISO(), b:b||todayISO(), pick:false}); ZKX.ym=ZKX.b.slice(0,7);
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Закупка</div><h3>Скачать таблицу Excel</h3><div class="dc-sub">Нажмите день — или первый и последний день периода. Сайт соберёт все накладные: товары, откуда взяли, сколько купили и за сколько, прибыль.</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="pvform zkx-f"><div class="ca-per zkx-p" id="zkx-p"></div><div class="zkr" id="zkx-cal"></div><p class="zkx-n" id="zkx-n"></p>
      <div class="pvea"><button type="button" class="btn pri" data-zkxgo>Скачать Excel</button><button type="button" class="btn ghost" data-dc="close">Отмена</button></div></div>`, false, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("pvi-d");
  d.addEventListener("click", e=>{ const t=e.target.closest("[data-zkxp],[data-zkxd],[data-zkxm],[data-zkxgo]"); if(!t) return;
    if(t.dataset.zkxp){ const q=zkxPresets().find(z=>z[0]===t.dataset.zkxp); Object.assign(ZKX,{a:q[2], b:q[3], pick:false, ym:q[3].slice(0,7)}); }
    else if(t.dataset.zkxm) ZKX.ym = t.dataset.zkxm==="0" ? todayISO().slice(0,7) : zkpYmShift(ZKX.ym, +t.dataset.zkxm);
    else if(t.dataset.zkxd){ const v=t.dataset.zkxd; if(ZKX.pick && v!==ZKX.a){ if(v<ZKX.a){ ZKX.b=ZKX.a; ZKX.a=v; } else ZKX.b=v; ZKX.pick=false; } else { ZKX.a=ZKX.b=v; ZKX.pick=true; } }
    else if(t.dataset.zkxgo!=null){ zkxSave(ZKX.a, ZKX.b); return; }
    zkxDraw(); });
  zkxDraw(); }
function zkxDraw(){ const box=$("#zkx-cal"); if(!box) return; const P=zkxPresets(), {a,b}=ZKX;
  $("#zkx-p").innerHTML=P.map(([k,t,x,y])=>`<button type="button" data-zkxp="${k}" class="${!ZKX.pick&&x===a&&y===b?"on":""}">${t}</button>`).join("");
  const ym=ZKX.ym, y=+ym.slice(0,4), m=+ym.slice(5,7), days=new Date(y,m,0).getDate(), first=(new Date(y,m-1,1).getDay()+6)%7, t=todayISO(), by={}, rank={none:0, part:1, ok:2}, cells=[];
  zkpItemsIn(ym+"-01", ym+"-"+String(days).padStart(2,"0")).forEach(it=>{ (by[it.date]=by[it.date]||[]).push(it); });
  for(let i=0;i<first;i++) cells.push(`<span aria-hidden="true"></span>`);
  for(let dd=1; dd<=days; dd++){ const iso=ym+"-"+String(dd).padStart(2,"0"), I=by[iso]||[], wd=(first+dd-1)%7, n=I.reduce((s,x)=>s+x.g.length,0);
    const worst=I.length?I.reduce((s,x)=>rank[x.st]<rank[s]?x.st:s,"ok"):"", inR=iso>=a&&iso<=b, edge=iso===a||iso===b;
    const dots=I.slice(0,6).map(x=>`<b class="${x.st}"></b>`).join("")+(I.length>6?`<em>+${I.length-6}</em>`:"");
    cells.push(`<button type="button" class="zkr-d ${worst||"empty"}${inR?" in":""}${edge?" edge":""}${iso===a?" a":""}${iso===b?" b":""}${iso===t?" today":""}${wd>4?" we":""}" data-zkxd="${iso}" aria-pressed="${inR}" title="${esc(fd(iso)+(n?": "+n+" "+plural(n,["накладная","накладные","накладных"]):": накладных нет"))}"><i>${dd}</i><span class="zkc-dots">${dots}</span></button>`); }
  const L=zkxDocs(a,b), lbl=a===b?fd(a):fd(a)+" – "+fd(b), M=zkpItemsIn(a,b), c=k=>M.filter(x=>x.st===k).length;
  box.innerHTML=`<div class="zkr-h"><button type="button" class="zkc-a" data-zkxm="-1" aria-label="Прошлый месяц">‹</button><b>${ZKP_MON[m-1]} ${y}</b><button type="button" class="zkc-a" data-zkxm="1" aria-label="Следующий месяц">›</button>${ym!==t.slice(0,7)?`<button type="button" class="btn ghost sm" data-zkxm="0">Сегодня</button>`:""}</div>
    <div class="zkr-w">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>`<span>${x}</span>`).join("")}</div><div class="zkr-g">${cells.join("")}</div>`;
  $("#zkx-n").innerHTML = `<b>${lbl}</b> · ${L.length?`${L.length} ${plural(L.length,["накладная","накладные","накладных"])}`:"накладных нет"}`
    + (M.length?`<span class="zkc-leg"><span><b class="none"></b>нет ${c("none")}</span><span><b class="part"></b>частично ${c("part")}</span><span><b class="ok"></b>заполнено ${c("ok")}</span></span>`:"")
    + `<small class="muted">${ZKX.pick?"Нажмите последний день периода — или скачайте этот день.":"Нажмите день, чтобы выбрать другой; два нажатия — период."}</small>`;
  const go=document.querySelector("#fd-dcard [data-zkxgo]"); if(go) go.disabled=!L.length; }
async function zkxSave(a, b){
  try{ const L=zkxDocs(a,b); if(!L.length){ toast("info","Нечего выгружать","За эти даты накладных нет."); return; }
    const X=await loadXLSX(), per = a===b ? fd(a) : fd(a)+" – "+fd(b), R=[], N=[], G=new Map();
    const stTxt = s => !s ? "нет закупки" : s.st==="ok" ? "заполнено" : s.st==="none" ? "нет закупки" : "частично";
    L.forEach(j=>{ const x=docProfit(j), w=jWho(j), who=w.main+(kLbl(j)&&!w.main.includes(kLbl(j))?", "+kLbl(j):""), ip=supShort(sup(j.supplierId).name||""), st=zkJState(j);
      x.lines.forEach(r=>{ const l=r.l, sk=r.sk;
        let from="Закупка", bq=r.bq||l.qty, cu=r.c, cs=r.c!=null?r2(r.c*(r.bq||l.qty)):null;
        if(sk){ from = sk.directQ>0 ? `Часть со склада (${fm(sk.stockQ)} ${l.unit})` : "Со склада"; bq=l.qty; cs=r.c!=null?r2(r.c*l.qty):null; cu=r.c; }
        if(x.src){ from="Одной суммой"; cu=null; cs=null; bq=null; }
        const prof = cs!=null ? r2(l.net-cs) : null;
        R.push([fd(j.date), who, String(j.number||""), ip, l.name, l.unit, l.qty, l.priceNet, l.net, from, bq, cu, cs, prof]);
        if(cs!=null && !x.src){ const k=l.name.trim().toLowerCase()+"|"+l.unit, g=G.get(k)||{n:l.name, u:l.unit, q:0, s:0, sold:0, rev:0, d:0}; g.q+=+bq||0; g.s+=cs; g.sold+=l.qty; g.rev+=l.net; g.d++; G.set(k,g); } });
      N.push([fd(j.date), who, String(j.number||""), ip, x.rev, x.cost, x.exp, x.tax, x.profit, x.rev>0?r2(x.profit/x.rev*100)/100:null, stTxt(st), x.src?"одной суммой: "+x.src.map(s=>s.n+" "+fm(+s.s||0)).join(", "):x.miss?"не у всех товаров есть цена закупки":"по товарам"]); });
    const sum=(A,i)=>r2(A.reduce((s,r)=>s+(+r[i]||0),0));
    const head=t=>[["Закупка — "+t+" — "+per],[]];
    const a1=[...head("по товарам"), ["Дата","Заказчик","№ накл.","ИП","Товар","Ед.","Продано","Цена продажи","Сумма продажи","Откуда","Куплено","Цена закупки за ед.","Сумма закупки","Прибыль строки (до налога)"], ...R,
      [], ["Итого","","","","","","","",sum(R,8),"","","",sum(R,12),sum(R,13)]];
    const a2=[...head("по накладным"), ["Дата","Заказчик","№ накл.","ИП","Выручка","Закупка товара","Прочие расходы","Налог","Прибыль","Наценка, %","Закупка","Как записана"], ...N,
      [], ["Итого",L.length+" "+plural(L.length,["накладная","накладные","накладных"]),"","",sum(N,4),sum(N,5),sum(N,6),sum(N,7),sum(N,8)]];
    const GL=[...G.values()].sort((p,q)=>q.s-p.s);
    const a3=[...head("итого по товарам"), ["Товар","Ед.","Куплено всего","Сумма закупки","Средняя цена закупки","Продано","Сумма продажи","Средняя цена продажи","В накладных"],
      ...GL.map(g=>[g.n, g.u, r3(g.q), r2(g.s), g.q?r2(g.s/g.q):null, r3(g.sold), r2(g.rev), g.sold?r2(g.rev/g.sold):null, g.d]),
      [], ["Итого","","",r2(GL.reduce((s,g)=>s+g.s,0)),"","",r2(GL.reduce((s,g)=>s+g.rev,0))]];
    const wb=X.utils.book_new(), add=(aoa, name, cols, money, pct)=>{ const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=cols.map(w=>({wch:w}));
      const rg=X.utils.decode_range(ws["!ref"]); for(let r=3;r<=rg.e.r;r++){ money.forEach(c=>{ const cl=ws[X.utils.encode_cell({r,c})]; if(cl&&cl.t==="n") cl.z="#,##0.00"; }); (pct||[]).forEach(c=>{ const cl=ws[X.utils.encode_cell({r,c})]; if(cl&&cl.t==="n") cl.z="0%"; }); }
      ws["!autofilter"]={ref:X.utils.encode_range({s:{r:2,c:0},e:{r:Math.max(2,aoa.length-3),c:aoa[2].length-1}})};
      X.utils.book_append_sheet(wb, ws, name); };
    add(a1,"Товары",[11,30,8,16,34,6,9,12,13,24,9,13,13,14],[7,8,11,12,13]);
    add(a2,"Накладные",[11,30,8,16,13,14,13,11,13,10,13,40],[4,5,6,7,8],[9]);
    add(a3,"Итого по товарам",[34,6,13,14,14,10,14,14,11],[3,4,6,7]);
    X.writeFile(wb, "Закупка "+(a===b?fd(a):fd(a)+"–"+fd(b))+".xlsx");
    pvCloseCard(); toast("ok","Excel скачан", L.length+" "+plural(L.length,["накладная","накладные","накладных"])+" — ищите в «Загрузках».");
  }catch(e){ toast("err","Не получилось выгрузить", e.message); } }
document.addEventListener("click", e=>{ if(e.target.closest("#zkp [data-zkxls]")) zkxOpen(); });
