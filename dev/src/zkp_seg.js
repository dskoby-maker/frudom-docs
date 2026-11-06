/* ---------- вкладка «Закупка»: закупка по накладным и комплектам прямо на странице (только администратор) ----------
   Сверху — список накладных и комплектов за период со статусом закупки (как значок в журнале), плитки итогов, фильтры.
   Нажатие на строку раскрывает под ней тот же редактор, что в окне документа (dcZkDraw) или комплекта (bzDraw).
   Открыт только один редактор: у них общие id (#dc-zk/#bz-zk), поэтому перед открытием окна (openCard) он сворачивается. */
const ZKP={per:"30", st:"need", q:"", n:30, open:"", list:[]};
function zkpRange(){ const n=new Date(), iso=jIso;
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
  let sum=0, rev=0, cost=0, prof=0; g.forEach(j=>{ const x=docProfit(j); sum+=x.k.t.sum; rev+=x.rev; cost+=x.cost; prof+=x.profit; });
  Object.assign(it, {sum:r2(sum), rev:r2(rev), cost:r2(cost), prof:r2(prof), date:g[0].date}); return it; }
function zkpItems(){ const [a,b]=zkpRange(), G={}, out=[];
  D.journal.filter(j=>j.snap && !isArch(j) && j.date>=a && j.date<=b).forEach(j=>{ const k=jKey(j); if(k) (G[k]=G[k]||[]).push(j); else out.push({key:"d:"+j.id, g:[j]}); });
  Object.keys(G).forEach(k=>{ const g=G[k].sort(jNumSort); out.push(g.length>1 ? {key:"g:"+k, gk:k, g} : {key:"d:"+g[0].id, g}); });
  out.forEach(zkpCalc);
  return out.filter(x=>!x.gone).sort((x,y)=>(y.date||"").localeCompare(x.date||"") || String(y.g[0].number).localeCompare(String(x.g[0].number),"ru",{numeric:true})); }
const zkpTitle = it => it.g.length>1 ? gTitle(it.g) : jWho(it.g[0]).main;
const zkpNums = it => { const n=it.g.map(j=>j.number); return "№ "+(n.length>2?n[0]+"–"+n[n.length-1]:n.join(", ")); };
const zkpPass = (it, st) => st==="all" || (st==="need" ? it.st!=="ok" : it.st===st);
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
  const ch=[["need","Нужно заполнить",L.filter(x=>x.st!=="ok").length],["none","Нет закупки",c("none")],["part","Частично",c("part")],["ok","Заполнено",c("ok")],["all","Все",L.length]];
  $("#zkp-st").innerHTML=ch.map(([k,t,n])=>`<button type="button" class="${ZKP.st===k?"on":""} ${k}" data-zkpst="${k}">${t} <b>${n}</b></button>`).join(""); }
/* полная перерисовка списка; если редактор открыт — только обновить строки, чтобы не потерять набранное */
function zkpDraw(force){ const box=$("#zkp-list"); if(!box || !me().admin) return;
  document.querySelectorAll("#zkp-per [data-zkpp]").forEach(b=>b.classList.toggle("on", b.dataset.zkpp===ZKP.per));
  if(ZKP.open && !force){ zkpRefresh(); return; }
  if(!pfLoaded){ box.innerHTML=`<p class="muted zkp-empty">Загружаю данные о закупке…</p>`; return; }
  ZKP.list=zkpItems(); const q=ZKP.q.trim().toLowerCase();
  const L=ZKP.list.filter(it=>!q || (zkpTitle(it)+" "+it.g.map(j=>j.number+" "+(kLbl(j)||"")).join(" ")).toLowerCase().includes(q));
  zkpKpi(L); const V=L.filter(it=>zkpPass(it, ZKP.st)), sh=V.slice(0, ZKP.n), keep=ZKP.open&&box.querySelector(".zkp-it.open");
  box.innerHTML = sh.length ? sh.map(zkpRow).join("") + (V.length>sh.length?`<button type="button" class="btn ghost zkp-more" data-zkpmore>Показать ещё ${Math.min(30, V.length-sh.length)} из ${V.length-sh.length}</button>`:"")
    : `<p class="muted zkp-empty">${!L.length?"За этот период накладных нет.":ZKP.st==="need"?"✓ Все накладные за период с закупкой — заполнять нечего.":"Ничего не найдено."}</p>`;
  /* открытый редактор переносим в новый список как есть (с набранным) */
  if(keep){ const n=box.querySelector(`.zkp-it[data-key="${CSS.escape(ZKP.open)}"]`); if(n) n.replaceWith(keep); else ZKP.open=""; } }
/* обновить строки и плитки на месте (после сохранения закупки) */
function zkpRefresh(){ if(!$("#zkp-list")) return; ZKP.list.forEach(zkpCalc); ZKP.list=ZKP.list.filter(x=>!x.gone);
  ZKP.list.forEach(it=>{ const r=document.querySelector(`#zkp-list .zkp-it[data-key="${CSS.escape(it.key)}"] > .zkp-row`); if(r) r.innerHTML=zkpRowIn(it); });
  const q=ZKP.q.trim().toLowerCase(); zkpKpi(ZKP.list.filter(it=>!q || (zkpTitle(it)+" "+it.g.map(j=>j.number).join(" ")).toLowerCase().includes(q))); }
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
document.addEventListener("click", e=>{ const t=e.target.closest&&e.target.closest("#zkp [data-zkpo],#zkp [data-zkpp],#zkp [data-zkpst],#zkp [data-zkpmore],#zkp [data-zkpcard]"); if(!t) return;
  if(t.dataset.zkpo!=null){ if(ZKP.open===t.dataset.zkpo) zkpCollapse(); else zkpOpen(t.dataset.zkpo); return; }
  if(t.dataset.zkpp){ ZKP.per=t.dataset.zkpp; ZKP.n=30; zkpCollapse(); zkpDraw(true); return; }
  if(t.dataset.zkpst){ ZKP.st=t.dataset.zkpst; ZKP.n=30; zkpCollapse(); zkpDraw(true); return; }
  if(t.dataset.zkpmore!=null){ ZKP.n+=30; zkpDraw(true); return; }
  if(t.dataset.zkpcard){ const it=ZKP.list.find(x=>x.key===t.dataset.zkpcard); if(!it) return; zkpCollapse(); if(it.g.length===1) docCard(it.g[0], false); else bundleCard(it.g, false); } });
document.addEventListener("input", e=>{ if(e.target.id!=="zkp-q") return; ZKP.q=e.target.value; ZKP.n=30; clearTimeout(zkpDraw._t); zkpDraw._t=setTimeout(()=>{ zkpCollapse(); zkpDraw(true); }, 200); });
