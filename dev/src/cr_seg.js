/* ===== Кредиты («Прибыль» → «Долги» → «Кредиты», просьба Даниила 23.11.2026) =====
   Два вида: «Кредит» (фиксированный ежемесячный платёж) и «Кредитная карта» (долг меняется: потратил / внёс / проценты).
   Хранение: лист «Кредиты» (credits: одна строка = один кредит; настройки и операции — JSON в data), Code.gs ≥ 52;
   со старым скриптом — только на устройстве (D.crSrv=false).
   Связь с «Расходы и доходы»: у кредита бизнеса в расход («Банк и кредит») идут только проценты — возврат самого долга
   не расход; у личного кредита весь платёж — «Личное». Запись pother создаётся/меняется/удаляется вместе с операцией (op.po). */
const CR_K={loan:{t:"Кредит", ic:"₽", c:"#1E6F8C", bg:"#E3F1F6"}, card:{t:"Кредитная карта", ic:"▭", c:"#6A2C4E", bg:"#F2E7ED"}};
const CR_OP={pay:{t:"Платёж", s:-1}, extra:{t:"Досрочно", s:-1}, spend:{t:"Потратил", s:1}, cpay:{t:"Внёс", s:-1}, fee:{t:"Проценты / комиссия", s:1}};
const CRU={cur:"", arch:false, ed:null, op:null, sched:{}, anim:true};
const crRows=()=>pfArr("credits");
const crN=v=>+num(v==null?"":v)||0;
const crObj=r=>{ if(r._o) return r._o; let o; try{ o=JSON.parse(r.data||"{}"); }catch(e){ o={}; } o.ops=Array.isArray(o.ops)?o.ops:[]; Object.defineProperty(r,"_o",{value:o, writable:true, enumerable:false, configurable:true}); return o; };
const crFind=id=>crRows().find(r=>r.id===id);
const crOwnT=o=>o.own==="me"?"Личный":"Бизнес";
/* ---- даты ---- */
const crDim=(y,m)=>new Date(y,m,0).getDate();
const crYm=iso=>String(iso||"").slice(0,7);
function crYmAdd(ym,n){ let [y,m]=ym.split("-").map(Number); m+=n; y+=Math.floor((m-1)/12); m=((m-1)%12+12)%12+1; return y+"-"+String(m).padStart(2,"0"); }
const crYmDiff=(a,b)=>{ const [ya,ma]=a.split("-").map(Number), [yb,mb]=b.split("-").map(Number); return (yb-ya)*12+(mb-ma); };
function crDue(ym, day){ const [y,m]=ym.split("-").map(Number); return ym+"-"+String(Math.min(Math.max(1,+day||1), crDim(y,m))).padStart(2,"0"); }
const crDays=(a,b)=>Math.round((new Date(b+"T00:00")-new Date(a+"T00:00"))/864e5);
function crNextDay(day, from){ const f=from||todayISO(); let d=crDue(crYm(f), day); if(d<f) d=crDue(crYmAdd(crYm(f),1), day); return d; }
const CR_MG=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
const CR_MN=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const crDt=iso=>iso?(+iso.slice(8))+" "+CR_MG[+iso.slice(5,7)-1]+(iso.slice(0,4)!==todayISO().slice(0,4)?" "+iso.slice(0,4):""):"";
const crMon=ym=>CR_MN[+ym.slice(5,7)-1]+(ym.slice(0,4)!==todayISO().slice(0,4)?" "+ym.slice(0,4):"");
function crWhen(d){ if(!d) return ""; const n=crDays(todayISO(), d); return n<0?"просрочен на "+(-n)+" "+plural(-n,["день","дня","дней"]):n===0?"сегодня":n===1?"завтра":"через "+n+" "+plural(n,["день","дня","дней"]); }
/* ---- расчёт кредита ---- */
function crLoan(r){ const o=crObj(r), i=crN(o.rate)/1200, day=o.day||(o.first||"").slice(8)||1;
  const P=o.ops.filter(x=>x.t==="pay"), X=o.ops.filter(x=>x.t==="extra");
  const bal=Math.max(0, r2(crN(o.bal0)-P.concat(X).reduce((a,x)=>a+crN(x.body),0)));
  const paidM=new Set(P.map(x=>x.m).filter(Boolean)); let ym=crYm(o.first||todayISO()); while(paidM.has(ym)) ym=crYmAdd(ym,1);
  const endYm=o.end?crYm(o.end):"", nLeft=endYm?Math.max(1, crYmDiff(ym,endYm)+1):0;
  let pmt=crN(o.pmt); const auto=!pmt; if(!pmt && bal>0.004 && nLeft) pmt=i?r2(bal*i/(1-Math.pow(1+i,-nLeft))):r2(bal/nLeft);
  /* платёж и дата последнего платежа вписаны — график должен закончиться в дату банка: подбираем настоящую ставку (в платёж банка часто входит страховка/подписка) */
  let ie=i, fit=false, tot=false; const sumK=crN(o.sum);
  if(!auto && pmt>0 && nLeft>1 && bal>0.004){ const f=r=>r>1e-9?bal*r/(1-Math.pow(1+r,-nLeft)):bal/nLeft;
    if(f(0)>=pmt-0.01) ie=0; else { let lo=0, hi=0.5; for(let t=0;t<80;t++){ const md=(lo+hi)/2; if(f(md)>pmt) hi=md; else lo=md; } ie=(lo+hi)/2; }
    fit=Math.abs(ie-i)*1200>0.3;
    tot=i>0.003 && ie*1200<2 && bal>=pmt*nLeft*0.95 && (!sumK || sumK<bal*0.95); }
  const pct=r2(bal*ie), next=bal>0.004?crDue(ym,day):"", nsum=bal>0.004?Math.min(pmt||r2(bal+pct), r2(bal+pct)):0;
  const S=[]; let b=bal, m=ym, bad=false;
  if(pmt>0) for(let k=0;k<600 && b>0.004;k++){ const p=r2(b*ie); let s=pmt; if(s<=p+0.004){ bad=true; break; } if(s>b+p || (fit && k===nLeft-1)) s=r2(b+p); const body=r2(s-p); b=Math.max(0,r2(b-body)); S.push({m, d:crDue(m,day), s, p, body, b}); m=crYmAdd(m,1); }
  const paid=r2(P.concat(X).reduce((a,x)=>a+crN(x.s),0)), pctPaid=r2(P.reduce((a,x)=>a+crN(x.pct),0)), pctLeft=r2(S.reduce((a,x)=>a+x.p,0)), sum=crN(o.sum)||crN(o.bal0);
  return {kind:"loan", o, i, ie, fit, tot, nLeft, day, bal, debt:bal, ym, next, pmt, auto, pct, nsum, S, bad, paid, pctPaid, pctLeft, end:S.length?S[S.length-1].d:"", sum, pc:sum>0?Math.min(100,Math.max(0,(sum-bal)/sum*100)):0, done:bal<=0.004, late:!!next && next<todayISO()}; }
/* ---- расчёт кредитной карты ---- */
function crCard(r){ const o=crObj(r), S=t=>r2(o.ops.filter(x=>x.t===t).reduce((a,x)=>a+crN(x.s),0)), td=todayISO();
  const debt=Math.max(0, r2(crN(o.bal0)+S("spend")+S("fee")-S("cpay"))), lim=crN(o.limit), day=o.day||1;
  const next=crNextDay(day, td), prev=crDue(crYmAdd(crYm(next),-1), day);
  const inCyc=r2(o.ops.filter(x=>x.t==="cpay" && x.d>prev && x.d<=next).reduce((a,x)=>a+crN(x.s),0));
  const minFull=debt>0.004?Math.min(debt, Math.max(crN(o.minf), r2(debt*crN(o.minp)/100))):0, need=Math.max(0, r2(minFull-inCyc));
  const gto=o.gto||"", gDays=gto?crDays(td,gto):null, fees=S("fee");
  return {kind:"card", o, day, debt, lim, avail:lim?r2(lim-debt):null, next:debt>0.004?next:"", nsum:need, minFull, inCyc, gto, gDays, fees, pctPaid:fees, paid:S("cpay"),
    pc:lim>0?Math.min(100,Math.max(0,debt/lim*100)):0, done:debt<=0.004, late:false, noMin:!crN(o.minf) && !crN(o.minp)}; }
const crCalc=r=>r.kind==="card"?crCard(r):crLoan(r);
function crSave(r, msg){ const o=crObj(r), k=crCalc(r); r.data=JSON.stringify(o); r.bank=o.bank||""; r.own=crOwnT(o); r.debt=String(k.debt); r.next=k.next||""; r.nsum=k.nsum?String(r2(k.nsum)):"";
  r.upd=new Date().toISOString(); r.by=curUser()||""; if(!crRows().includes(r)) crRows().push(r); dirty("credits", r.id); if(msg) logEv("Прибыль","Кредит «"+r.title+"»: "+msg); saveLocal(); }
function crMerge(list){
  if(!Array.isArray(list)){ D.crSrv=false; return; }
  const loc=crRows(), keep=loc.filter(x=>pend.credits.has(x.id) && !pend.credits.get(x.id).del), gone=new Set([...pend.credits.entries()].filter(([,v])=>v.del).map(([k])=>k));
  D.credits=list.filter(x=>!gone.has(x.id)); keep.forEach(x=>{ const i=D.credits.findIndex(y=>y.id===x.id); if(i>=0) D.credits[i]=x; else D.credits.push(x); });
  const was=D.crSrv; D.crSrv=true; if(!was && pend.credits.size) changed();
}
const crOpen=()=>crRows().filter(r=>!+r.arch);
/* ближайшие платежи: просрочено или через 3 дня и меньше (для «Сайт нашёл сам» и значка на переключателе) */
function crSoon(){ const td=todayISO(); return crOpen().map(r=>({r, k:crCalc(r)})).filter(x=>x.k.next && x.k.nsum>0.004 && crDays(td,x.k.next)<=3); }
function crTasks(){ return crSoon().map(({r,k})=>{ const n=crDays(todayISO(),k.next);
  return {key:"cr-"+r.id+"-"+k.next+"-"+(n<0?"late":"soon"), lvl:n<0?"err":"warn", title:(n<0?"Просрочен платёж: ":"Платёж по кредиту: ")+r.title, text:fm(k.nsum)+" ₽ — "+crDt(k.next)+" ("+crWhen(k.next)+")."+(n<0?" Если уже заплатили — отметьте платёж, чтобы сайт пересчитал долг.":""), act:"Открыть", go:{fn:()=>crGo(r.id)}}; }); }
function crGo(id){ PV().v="debt"; PV().dv="credit"; CRU.cur=id||""; CRU.anim=true; saveLocal(); showTab("profit"); setTimeout(()=>{ pvDraw(); const c=document.querySelector('.crc[data-cr="'+CSS.escape(id||"")+'"]'); if(c) c.scrollIntoView({behavior:"smooth", block:"center"}); }, 80); }
/* ---- запись в «Расходы и доходы» ---- */
function crPoAmt(o, op){ if(op.rec===false) return 0; if(o.own==="me") return op.t==="pay"||op.t==="extra"||op.t==="fee"?crN(op.s):0; return op.t==="pay"?crN(op.pct):op.t==="fee"?crN(op.s):0; }
function crPoSync(r, op, del){ const o=crObj(r), old=op.po && pfArr("pother").find(x=>x.id===op.po), amt=del?0:r2(crPoAmt(o, op));
  if(amt<=0.004){ if(old){ D.pother=pfArr("pother").filter(x=>x!==old); dirty("pother", old.id, true); } op.po=""; return; }
  const x=old||{id:uid(), by:curUser()||""}; x.date=op.d||todayISO(); x.sum=String(amt); x.supplierId="";
  if(o.own==="me"){ x.kind=PO_PER; x.note=(op.t==="fee"?"Проценты/комиссия по карте «":op.t==="extra"?"Досрочный платёж по кредиту «":"Платёж по кредиту «")+r.title+"»"; if(pvCatOk()){ x.cat=""; x.catName=""; } }
  else { x.kind=PO_EXP; x.note=(op.t==="fee"?"Проценты и комиссия по карте «":"Проценты по кредиту «")+r.title+"»"; if(pvCatOk()){ const c=pvCat("c-bank"); x.cat=c.id||""; x.catName=c.id?c.n:""; } }
  if(!old) pfArr("pother").push(x); dirty("pother", x.id); op.po=x.id; }
function crPoTxt(o, op){ const a=r2(crPoAmt(Object.assign({},o), Object.assign({}, op, {rec:true})));
  if(a<=0.004) return o.own==="me"?"":(op.t==="pay"?"Процентов нет — в расходы нечего записывать.":"");
  return o.own==="me" ? `Записать ${fm(a)} ₽ в «Расходы и доходы» как «Личное»` : `Записать проценты ${fm(a)} ₽ в «Расходы и доходы» как расход «Банк и кредит»`; }
/* ---- отрисовка ---- */
function crDraw(){
  const box=$("#pv-debt"); if(!box) return;
  const L=crOpen().sort((a,b)=>(+a.ord||0)-(+b.ord||0)||a.id.localeCompare(b.id)), A=crRows().filter(r=>+r.arch), K=L.map(r=>({r, k:crCalc(r)}));
  if(CRU.cur && !crFind(CRU.cur)) CRU.cur="";
  const tot=r2(K.reduce((a,x)=>a+x.k.debt,0)), month=r2(K.reduce((a,x)=>a+(x.k.kind==="loan"?(x.k.done?0:x.k.pmt||x.k.nsum):x.k.minFull),0));
  const nx=K.filter(x=>x.k.next && x.k.nsum>0.004).sort((a,b)=>a.k.next.localeCompare(b.k.next))[0], y=todayISO().slice(0,4);
  const pctY=r2(crRows().reduce((a,r)=>a+crObj(r).ops.filter(x=>(x.t==="pay"||x.t==="fee") && String(x.d||"").startsWith(y)).reduce((s,x)=>s+(x.t==="fee"?crN(x.s):crN(x.pct)),0),0));
  const lastEnd=K.filter(x=>x.k.kind==="loan" && x.k.end).map(x=>x.k.end).sort().pop()||"";
  box.innerHTML=`<div class="cr${CRU.anim?" anim":""}">
    <div class="dbhead mbhead"><div><h2>Кредиты</h2><small>Кредиты с одинаковым платежом и кредитные карты: сколько осталось, когда платить и сколько уходит на проценты.</small></div><div class="mbhr">${mbSwitch("credit")}</div></div>
    <p class="note" ${pfLoaded && !D.crSrv?"":"hidden"}>Чтобы кредиты были видны на всех устройствах, обновите скрипт таблицы (Code.gs). Пока они хранятся только здесь.</p>
    ${K.length?`<div class="pvkpi mbkpi crkpi">
      <div class="due"><small>Всего долга</small><b>${fm(tot)} ₽</b><span>${K.length} ${plural(K.length,["кредит","кредита","кредитов"])}${lastEnd?" · последний закончится "+crDt(lastEnd):""}</span></div>
      <div><small>Платежи в месяц</small><b>${fm(month)} ₽</b><span>кредиты + минимум по картам</span></div>
      <div class="${nx&&nx.k.late?"neg":""}${nx?" go":""}" ${nx?`data-crgo="${esc(nx.r.id)}" role="button" tabindex="0" title="Открыть этот кредит"`:""}><small>Ближайший платёж</small><b>${nx?fm(nx.k.nsum)+" ₽":"—"}</b><span>${nx?esc(nx.r.title)+" · "+crDt(nx.k.next)+" · "+crWhen(nx.k.next):"платежей нет"}</span></div>
      <div><small>Проценты за ${y} год</small><b>${fm(pctY)} ₽</b><span>по отмеченным платежам</span></div></div>`:""}
    <div class="crbar"><button type="button" class="btn pri sm" data-cra="new:loan">+ Кредит</button><button type="button" class="btn sm" data-cra="new:card">+ Кредитная карта</button>
      ${A.length?`<button type="button" class="mbchip arch${CRU.arch?" on":""}" data-cra="archv" aria-pressed="${CRU.arch}">Закрытые · ${A.length}</button>`:""}</div>
    ${K.length||CRU.arch?"":`<div class="mbempty"><div class="mbei">₽</div><b>Кредитов пока нет</b><span>Добавьте кредит (одинаковый платёж каждый месяц) или кредитную карту. Сайт будет считать остаток долга, напоминать о платежах и записывать проценты в расходы.</span></div>`}
    <div class="crl">${(CRU.arch?A.map(r=>({r,k:crCalc(r)})):K).map((x,i)=>crCardHtml(x.r, x.k, i)).join("")}</div></div>`;
  CRU.anim=false;
}
function crCardHtml(r, k, i){ const o=k.o, t=CR_K[r.kind]||CR_K.loan, open=CRU.cur===r.id, arch=!!+r.arch, n=k.next?crDays(todayISO(),k.next):null;
  const due=k.done?`<span class="crok">✓ ${r.kind==="card"?"долга нет":"выплачен"}</span>`:k.next&&k.nsum>0.004?`<span class="crnx${n<0?" late":n<=3?" soon":""}">${r.kind==="card"?"мин. ":""}${fm(k.nsum)} ₽ · ${crDt(k.next)} · ${crWhen(k.next)}</span>`:r.kind==="card"&&k.debt>0.004?`<span class="crnx">${k.noMin?"минимальный платёж не указан":"минимум за этот месяц внесён"}</span>`:"";
  return `<article class="crc${open?" open":""}" data-cr="${esc(r.id)}" style="--c:${t.c};--s:${t.bg};--d:${Math.min(i,10)*40}ms">
    <div class="crh" role="button" tabindex="0" aria-expanded="${open}"><span class="cri">${t.ic}</span>
      <span class="crt"><b>${esc(r.title||"Без названия")}</b><small>${t.t}${o.bank?" · "+esc(o.bank):""} · <em class="crown ${o.own==="me"?"me":""}">${crOwnT(o)}</em>${crN(o.rate)?" · "+String(crN(o.rate)).replace(".",",")+"%":""}</small>${due}</span>
      <span class="crd"><small>${r.kind==="card"?"Долг":"Осталось"}</small><b>${fm(k.debt)} ₽</b>${r.kind==="card"&&k.lim?`<small>из ${fm(k.lim)}</small>`:k.sum?`<small>из ${fm(k.sum)}</small>`:""}</span><i class="crch" aria-hidden="true">⌄</i></div>
    <div class="crpb" title="${r.kind==="card"?"Использовано из лимита":"Выплачено"}"><i style="width:${k.pc.toFixed(1)}%"></i></div>
    <div class="crb"><div>${open?crBodyHtml(r,k,arch):""}</div></div></article>`; }
function crBodyHtml(r, k, arch){ const o=k.o, card=r.kind==="card", td=todayISO();
  const ops=o.ops.slice().sort((a,b)=>(b.d||"").localeCompare(a.d||"")||(b.at||"").localeCompare(a.at||""));
  const tiles=card?`<div class="pvkpi mbkpi crk2">
      <div class="due"><small>Долг по карте</small><b>${fm(k.debt)} ₽</b><span>${k.lim?"лимит "+fm(k.lim)+" ₽":"лимит не указан"}</span></div>
      <div class="pos"><small>Доступно</small><b>${k.avail==null?"—":fm(Math.max(0,k.avail))+" ₽"}</b><span>${k.avail!=null&&k.avail<0?"превышен лимит на "+fm(-k.avail)+" ₽":"можно потратить"}</span></div>
      <div class="${k.nsum>0.004&&crDays(td,k.next)<=3?"neg":""}"><small>Минимальный платёж</small><b>${k.debt>0.004?fm(k.nsum)+" ₽":"—"}</b><span>${k.debt<=0.004?"долга нет":k.noMin?"впишите в «Изменить», сколько банк просит в месяц":"до "+crDt(k.next)+(k.inCyc>0.004?" · уже внесено "+fm(k.inCyc):"")}</span></div>
      <div class="${k.gto&&k.debt>0.004&&k.gDays!=null&&k.gDays<=7?(k.gDays<0?"neg":"due"):""}"><small>Без процентов</small><b>${k.gto?crDt(k.gto):"—"}</b><span>${!k.gto?"впишите дату льготного периода в «Изменить»":k.debt<=0.004?"долга нет":k.gDays<0?"срок прошёл — банк начисляет проценты":"внесите "+fm(k.debt)+" ₽ "+crWhen(k.gto)+" — тогда без процентов"}</span></div></div>`
    :`<div class="pvkpi mbkpi crk2">
      <div class="due"><small>Осталось долга</small><b>${fm(k.bal)} ₽</b><span>${k.sum?"выплачено "+Math.round(k.pc)+"% из "+fm(k.sum)+" ₽":""}</span></div>
      <div class="${k.late?"neg":""}"><small>Следующий платёж</small><b>${k.done?"—":fm(k.nsum)+" ₽"}</b><span>${k.done?"кредит выплачен":crDt(k.next)+" · "+crWhen(k.next)+(k.pct?" · проценты ≈ "+fm(k.pct):"")}</span></div>
      <div><small>Закончится</small><b>${k.end?crDt(k.end):"—"}</b><span>${k.bad?"платёж меньше процентов — долг не уменьшается":k.S.length?k.S.length+" "+plural(k.S.length,["платёж","платежа","платежей"])+" · процентов ещё ≈ "+fm(k.pctLeft)+" ₽":"впишите платёж или дату окончания"}</span></div>
      <div><small>Уже заплачено</small><b>${fm(k.paid)} ₽</b><span>из них проценты ${fm(k.pctPaid)} ₽</span></div></div>`;
  const btns=arch?`<button type="button" class="btn sm" data-cra="unarch">Вернуть из закрытых</button>`:card
    ?`<button type="button" class="btn pri sm" data-cra="op:cpay">Внёс на карту</button><button type="button" class="btn sm" data-cra="op:spend">Потратил</button><button type="button" class="btn sm" data-cra="op:fee">Проценты / комиссия</button>`
    :`<button type="button" class="btn pri sm" data-cra="op:pay" ${k.done?"disabled":""}>Заплатил${k.done?"":" за "+crMon(k.ym)}</button><button type="button" class="btn sm" data-cra="op:extra" ${k.done?"disabled":""}>Досрочно</button>`;
  const sch=!card && k.S.length?`<button type="button" class="lnk" data-cra="sched">${CRU.sched[r.id]?"Скрыть график":"График платежей · "+k.S.length+" ›"}</button>`:"";
  return `${tiles}
    ${k.auto&&!card&&k.pmt?`<div class="mbinfo">Платёж не вписан — сайт посчитал его сам по остатку, ставке и дате окончания: ${fm(k.pmt)} ₽ в месяц. Если в банке другой — впишите его в «Изменить».</div>`:""}
    ${!card&&k.tot?`<div class="mbinfo crw">${crTotTxt(k)}</div>`:!card&&k.fit?`<div class="mbinfo">${crFitTxt(k)}</div>`:""}
    ${k.bad?`<div class="mbinfo crw">Платёж ${fm(k.pmt)} ₽ не больше процентов за месяц (${fm(k.pct)} ₽) — долг так не уменьшится. Проверьте ставку и платёж в «Изменить».</div>`:""}
    <div class="crbtn">${btns}<span style="flex:1"></span>${sch}${arch?"":`<button type="button" class="btn ghost sm" data-cra="edit">Изменить</button>`}</div>
    ${CRU.sched[r.id]&&!card?crSchedHtml(k):""}
    <div class="crops"><div class="mbsec"><h3>Операции <small>${ops.length||""}</small></h3></div>
      ${ops.length?`<ul>${ops.map(x=>{ const T=CR_OP[x.t]||CR_OP.pay, po=x.po&&pfArr("pother").find(p=>p.id===x.po);
        return `<li class="crop"><span class="crod">${fd(x.d)}</span><span class="crot"><b>${T.t}${x.t==="pay"&&x.m?" за "+crMon(x.m):""}</b><small>${x.t==="pay"?"проценты "+fm(crN(x.pct))+" · в долг "+fm(crN(x.body)):""}${x.note?(x.t==="pay"?" · ":"")+esc(x.note):""}${po?`${x.t==="pay"||x.note?" · ":""}<em>в «Расходы и доходы»: ${fm(+po.sum||0)}</em>`:""}</small></span>
          <span class="mbsum ${T.s>0?"neg":"pos"}">${T.s>0?"+":"−"}${fm(crN(x.s))}</span>${arch?"":`<button type="button" class="crx" data-crdel="${esc(x.id)}" title="Удалить операцию" aria-label="Удалить операцию">×</button>`}</li>`; }).join("")}</ul>`
        :`<div class="mbnone">${card?"Отмечайте, когда вносите деньги на карту и когда тратите — сайт посчитает долг и минимальный платёж.":"Когда заплатите — нажмите «Заплатил». Сайт разделит платёж на проценты и долг."}</div>`}</div>
    <div class="crfoot">${o.note?`<span class="crnote">${esc(o.note)}</span>`:"<span></span>"}${arch?`<button type="button" class="btn ghost sm danger" data-cra="del">Удалить</button>`:`<button type="button" class="btn ghost sm" data-cra="arch">${k.done?"Закрыть — выплачен":"Убрать в закрытые"}</button>`}</div>`; }
function crSchedHtml(k){ return `<div class="crsch"><div class="crsr crsh"><span>Когда</span><span>Платёж</span><span>Проценты</span><span>В долг</span><span>Останется</span></div>
  ${k.S.map(x=>`<div class="crsr"><span>${crDt(x.d)}</span><span>${fm(x.s)}</span><span>${fm(x.p)}</span><span>${fm(x.body)}</span><span>${fm(x.b)}</span></div>`).join("")}
  <div class="crsr crst"><span>Итого</span><span>${fm(r2(k.S.reduce((a,x)=>a+x.s,0)))}</span><span>${fm(k.pctLeft)}</span><span>${fm(k.bal)}</span><span></span></div>
  <small class="crsn">Расчёт примерный: банк считает проценты по дням, поэтому суммы могут отличаться на несколько рублей.</small></div>`; }
/* ---- окно: новый кредит / изменить ---- */
function crDlg(){ let d=$("#cr-dlg"); if(d) return d; d=document.createElement("dialog"); d.id="cr-dlg"; d.className="mbdlg crdlg"; ($("#fd-app")||document.body).appendChild(d);
  d.addEventListener("click", crDlgClick); d.addEventListener("input", crDlgInput);
  d.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.tagName==="INPUT" && e.target.type!=="checkbox" && !e.target.closest(".dlsug")){ e.preventDefault(); crDlgSave(); } });
  d.addEventListener("close", ()=>{ CRU.ed=null; CRU.op=null; }); d.addEventListener("mousedown", e=>{ if(e.target===d) d._down=true; }); return d; }
function crShow(){ const d=crDlg(); if(!d.open) d.showModal(); d.classList.remove("out"); requestAnimationFrame(()=>d.classList.add("in")); }
function crClose(){ const d=$("#cr-dlg"); if(!d||!d.open) return; d.classList.remove("in"); d.classList.add("out"); setTimeout(()=>{ if(d.open) d.close(); d.classList.remove("out"); }, matchMedia("(prefers-reduced-motion: reduce)").matches?0:180); }
const crF=(id, label, v, extra)=>`<label class="f"><span>${label}</span><input id="${id}" value="${esc(v==null?"":String(v))}" autocomplete="off" ${extra||""}></label>`;
const crMoney=v=>v===""||v==null?"":String(v).replace(".",",");
function crEdit(kind, id){ const r=id?crFind(id):null, o=r?crObj(r):{};
  CRU.op=null; CRU.ed=r?{id:r.id, kind:r.kind, title:r.title, ...JSON.parse(JSON.stringify(o)), _new:false}:{id:uid(), kind, title:"", bank:"", own:"biz", rate:"", day:"", _new:true, ops:[]};
  crDlg(); crEdDraw(); crShow(); setTimeout(()=>{ const t=$("#cre-title"); if(t && CRU.ed && CRU.ed._new) t.focus(); }, 80); }
function crEdDraw(){ const d=$("#cr-dlg"), e=CRU.ed; if(!d||!e) return; const card=e.kind==="card", banks=[...new Set(crRows().map(r=>crObj(r).bank).filter(Boolean))];
  d.innerHTML=`<form class="mbdf" onsubmit="return false"><div class="mbdh"><b>${e._new?(card?"Новая кредитная карта":"Новый кредит"):"Изменить: "+esc(e.title||"")}</b><button type="button" class="mbx" data-crd="close" aria-label="Закрыть">×</button></div>
    ${e._new?`<div class="fdseg crkind" style="--x:${card?"100%":"0"}"><i></i><button type="button" data-crk="loan" class="${card?"":"on"}">Кредит</button><button type="button" data-crk="card" class="${card?"on":""}">Кредитная карта</button></div>`:""}
    <div class="mbtip" style="--c:${CR_K[e.kind].c};--s:${CR_K[e.kind].bg}">${card?"Долг меняется: тратите и вносите разные суммы. Сайт посчитает долг, сколько ещё можно потратить и минимальный платёж.":"Каждый месяц одинаковый платёж. Цифры возьмите из приложения банка: остаток долга, ставка, платёж и дата."}</div>
    <div class="mbgrid">${crF("cre-title","Название",e.title,'maxlength="80" placeholder="'+(card?"Тинькофф Платинум":"Сбер на машину")+'"')}
      <label class="f"><span>Банк</span><input id="cre-bank" value="${esc(e.bank||"")}" maxlength="60" placeholder="необязательно" list="cre-banks" autocomplete="off"></label>
      <div class="f crwide"><span>Чей кредит</span><div class="fdseg crown2" style="--x:${e.own==="me"?"100%":"0"}"><i></i><button type="button" data-cro="biz" class="${e.own==="me"?"":"on"}">Бизнес</button><button type="button" data-cro="me" class="${e.own==="me"?"on":""}">Личный</button></div>
        <small class="crhint">${e.own==="me"?"Платежи пойдут в «Личное» — прибыль бизнеса не уменьшат.":"В расходы бизнеса пойдут только проценты: возврат самого долга — не расход."}</small></div>
      ${card?`${crF("cre-limit","Лимит, ₽",crMoney(e.limit),'inputmode="decimal" data-money placeholder="0"')}
        ${crF("cre-bal0",e._new?"Долг сейчас, ₽":"Долг на начало учёта, ₽",crMoney(e.bal0),'inputmode="decimal" data-money placeholder="0"')}
        ${crF("cre-rate","Ставка, % годовых",crMoney(e.rate),'inputmode="decimal" placeholder="например, 34,9"')}
        ${crF("cre-day","День платежа",e.day,'inputmode="numeric" maxlength="2" placeholder="1–31"')}
        ${crF("cre-minp","Минимальный платёж, % от долга",crMoney(e.minp),'inputmode="decimal" placeholder="например, 3"')}
        ${crF("cre-minf","…но не меньше, ₽",crMoney(e.minf),'inputmode="decimal" data-money placeholder="0"')}
        <label class="f crwide"><span>Без процентов до (льготный период)</span><input id="cre-gto" type="date" value="${esc(e.gto||"")}"></label>`
      :`${crF("cre-bal0",e._new?"Осталось долга сейчас, ₽":"Долг на начало учёта, ₽",crMoney(e.bal0),'inputmode="decimal" data-money placeholder="в банке — «остаток основного долга»"')}
        ${crF("cre-sum","Сумма кредита, ₽",crMoney(e.sum),'inputmode="decimal" data-money placeholder="необязательно"')}
        ${crF("cre-rate","Ставка, % годовых",crMoney(e.rate),'inputmode="decimal" placeholder="например, 19,9"')}
        ${crF("cre-pmt","Платёж в месяц, ₽",crMoney(e.pmt),'inputmode="decimal" data-money placeholder="пусто — посчитаю"')}
        <label class="f"><span>${e._new?"Ближайший платёж":"Первый платёж в учёте"}</span><input id="cre-first" type="date" value="${esc(e.first||"")}"></label>
        <label class="f"><span>Последний платёж</span><input id="cre-end" type="date" value="${esc(e.end||"")}"></label>`}
      <label class="f crwide"><span>Заметка</span><input id="cre-note" maxlength="200" value="${esc(e.note||"")}" placeholder="необязательно: на что брали, номер договора" autocomplete="off"></label></div>
    <datalist id="cre-banks">${banks.map(b=>`<option value="${esc(b)}">`).join("")}</datalist>
    <div id="cre-prev">${crEdPrev()}</div>
    <div class="mbdact">${e._new?"":`<button type="button" class="btn ghost sm danger" data-crd="del">Удалить</button>`}<span style="flex:1"></span><button type="button" class="btn ghost" data-crd="close">Отмена</button><button type="button" class="btn pri" data-crd="save">${e._new?"Добавить":"Сохранить"}</button></div></form>`; }
function crEdRead(){ const e=CRU.ed, g=id=>$("#"+id); if(!e) return; ["title","bank","note"].forEach(k=>{ if(g("cre-"+k)) e[k]=g("cre-"+k).value; });
  ["limit","bal0","rate","minp","minf","sum","pmt"].forEach(k=>{ const i=g("cre-"+k); if(i) e[k]=i.value.trim()?String(crN(i.value)):""; });
  ["day"].forEach(k=>{ const i=g("cre-"+k); if(i) e[k]=i.value.replace(/\D/g,"").slice(0,2); }); ["gto","first","end"].forEach(k=>{ if(g("cre-"+k)) e[k]=g("cre-"+k).value; }); }
function crEdTmp(){ const e=CRU.ed, o=JSON.parse(JSON.stringify(e)); delete o.id; delete o.kind; delete o.title; delete o._new; return {id:e.id, kind:e.kind, title:e.title, data:JSON.stringify(o)}; }
function crEdPrev(){ const e=CRU.ed; if(!e) return ""; if(!crN(e.bal0) && !(e.kind==="card" && crN(e.limit))) return "";
  const k=crCalc(crEdTmp());
  if(e.kind==="card") return `<div class="mbinfo ok">Долг ${fm(k.debt)} ₽${k.lim?" · доступно "+fm(Math.max(0,k.avail))+" ₽":""}${k.debt>0.004&&!k.noMin&&k.next?" · минимальный платёж "+fm(k.minFull)+" ₽ до "+crDt(k.next):""}.</div>`;
  if(k.bad) return `<div class="mbinfo crw">Платёж не больше процентов за месяц (${fm(k.pct)} ₽) — проверьте ставку и платёж.</div>`;
  const ex=k.tot?`<div class="mbinfo crw">${crTotTxt(k)}${crN(e.sum)>0?` <button type="button" class="btn sm" data-crd="tot">Поставить ${fm(crN(e.sum))} ₽</button>`:""}</div>`:k.fit?`<div class="mbinfo">${crFitTxt(k)}</div>`:"";
  if(!k.pmt) return `<div class="mbinfo">Впишите платёж в месяц или дату последнего платежа — тогда сайт посчитает, когда кредит закончится.</div>`;
  return `<div class="mbinfo ok">${k.auto?"Платёж ≈ "+fm(k.pmt)+" ₽ в месяц · ":""}Ближайший — ${fm(k.nsum)} ₽ ${crDt(k.next)}, из них проценты ≈ ${fm(k.pct)} ₽ · закончится ${crDt(k.end)} (${k.S.length} ${plural(k.S.length,["платёж","платежа","платежей"])}) · процентов всего ≈ ${fm(k.pctLeft)} ₽.</div>${ex}`; }
function crTotTxt(k){ return `Похоже, в «Долг» вписана сумма всех платежей вместе с процентами (${fm(k.bal)} ₽ ≈ ${fm(k.pmt)} × ${k.nLeft}). Сюда нужен остаток основного долга — без процентов: в приложении банка «Остаток долга» или, если платежей ещё не было, «Сумма кредита».`; }
function crFitTxt(k){ const r=(k.ie*1200).toFixed(1).replace(".",","); return `График подогнан под ваш платёж и дату последнего платежа ${crDt(k.o.end)}. С таким платежом выходит ≈ ${r}% годовых${k.i>0?`, а не ${String(k.o.rate).replace(".",",")}%`:""} — в платёж банка, видимо, входит ещё страховка или подписка. Проценты в «Заплатил» сайт считает по ${r}%.`; }
function crEdSave(){ crEdRead(); const e=CRU.ed; if(!e) return; const bad=(id,t,m)=>{ const i=$("#"+id); if(i){ i.classList.add("bad"); i.focus(); setTimeout(()=>i.classList.remove("bad"),900); } toast("warn",t,m||""); };
  if(!(e.title||"").trim()) return bad("cre-title","Впишите название","Например, «Сбер на машину».");
  if(e.kind==="loan"){ if(!(crN(e.bal0)>0)) return bad("cre-bal0","Сколько осталось долга?","В приложении банка — «остаток основного долга».");
    if(!e.first) return bad("cre-first","Когда ближайший платёж?","По этой дате сайт будет напоминать каждый месяц.");
    if(!crN(e.pmt) && !e.end) return bad("cre-pmt","Впишите платёж в месяц","Или дату последнего платежа — тогда сайт посчитает платёж сам.");
    e.day=e.first.slice(8); }
  else { if(!e.day || +e.day<1 || +e.day>31) return bad("cre-day","Впишите день платежа","Число месяца, до которого банк ждёт платёж (1–31)."); }
  let r=crFind(e.id); const isNew=!r; if(!r) r={id:e.id, kind:e.kind, title:"", ord:String(Math.max(0,...crRows().map(x=>+x.ord||0))+1), arch:"", data:""};
  const o=crObj(r), keep=o.ops; Object.keys(o).forEach(k=>delete o[k]); ["bank","own","rate","day","note","limit","bal0","minp","minf","gto","sum","pmt","first","end"].forEach(k=>{ if(e[k]!=null && e[k]!=="") o[k]=e[k]; }); o.ops=keep;
  r.kind=e.kind; r.title=e.title.trim();
  o.ops.forEach(op=>crPoSync(r, op));   /* сменили «Бизнес / Личный» — записи в «Расходы и доходы» пересчитываются */
  crSave(r, isNew?"добавлен":"изменён"); CRU.cur=r.id; CRU.anim=isNew; crClose(); crDraw();
  const c=document.querySelector('.crc[data-cr="'+CSS.escape(r.id)+'"]'); if(c){ c.classList.add("flash"); c.scrollIntoView({behavior:"smooth", block:"nearest"}); }
  toast("ok", isNew?(e.kind==="card"?"Карта добавлена":"Кредит добавлен"):"Сохранено", r.title); }
/* ---- окно операции ---- */
function crOpOpen(t){ const r=crFind(CRU.cur); if(!r) return; const k=crCalc(r), o=k.o;
  CRU.ed=null; CRU.op={rid:r.id, t, d:todayISO(), s:"", pct:"", note:"", rec:true, m:""};
  if(t==="pay"){ CRU.op.m=k.ym; CRU.op.s=String(k.nsum); CRU.op.pct=String(k.pct); }
  if(t==="cpay" && k.nsum>0.004) CRU.op.s="";
  crDlg(); crOpDraw(); crShow(); setTimeout(()=>{ const i=$("#cro-s"); if(i){ i.focus(); i.select&&i.select(); } }, 80); }
function crOpDraw(){ const d=$("#cr-dlg"), p=CRU.op; if(!d||!p) return; const r=crFind(p.rid); if(!r) return; const k=crCalc(r), o=k.o, T=CR_OP[p.t], s=crN(p.s);
  let info="";
  if(p.t==="pay"){ const body=r2(s-crN(p.pct)); info=s>0?`<div class="mbinfo ${body<0?"crw":"ok"}">${body<0?"Проценты больше платежа — проверьте суммы.":`В погашение долга ${fm(body)} ₽ → останется ${fm(Math.max(0,r2(k.bal-body)))} ₽.`}</div>`:""; }
  else if(p.t==="extra") info=s>0?`<div class="mbinfo ok">Долг уменьшится с ${fm(k.bal)} до ${fm(Math.max(0,r2(k.bal-s)))} ₽. Ежемесячный платёж останется прежним — кредит закончится раньше. Если банк уменьшил платёж — поменяйте его в «Изменить».</div>`:"";
  else if(p.t==="cpay") info=`<div class="mbinfo ok">Долг ${fm(k.debt)} ₽${s>0?` → станет ${fm(Math.max(0,r2(k.debt-s)))} ₽`:""}${k.nsum>0.004?` · минимальный платёж ${fm(k.nsum)} ₽ до ${crDt(k.next)}`:""}${k.gto&&k.debt>0.004?` · без процентов нужно внести ${fm(k.debt)} ₽ до ${crDt(k.gto)}`:""}.</div>`;
  else if(p.t==="spend") info=`<div class="mbinfo">${k.lim?`Доступно ${fm(Math.max(0,k.avail))} ₽${s>0?` → останется ${fm(r2(k.avail-s))} ₽`:""}.`:"Долг по карте увеличится."} Саму покупку, если нужно, запишите в «Расходы и доходы» отдельно.</div>`;
  const recTxt=(p.t==="pay"||p.t==="extra"||p.t==="fee")?crPoTxt(o, Object.assign({}, p, {s:String(s)})):"";
  const months=p.t==="pay"?[k.ym, ...o.ops.filter(x=>x.t==="pay"&&x.m).map(x=>x.m)].filter((v,i,a)=>a.indexOf(v)===i).sort():[];
  d.innerHTML=`<form class="mbdf" onsubmit="return false"><div class="mbdh"><b>${T.t}${p.t==="pay"?" за "+crMon(p.m||k.ym):""} · ${esc(r.title)}</b><button type="button" class="mbx" data-crd="close" aria-label="Закрыть">×</button></div>
    <div class="mbgrid">${crF("cro-s","Сумма, ₽",crMoney(p.s),'inputmode="decimal" data-money placeholder="0"')}<label class="f"><span>Дата</span><input id="cro-d" type="date" value="${esc(p.d)}"></label>
      ${p.t==="pay"?`${crF("cro-pct","Из них проценты, ₽",crMoney(p.pct),'inputmode="decimal" data-money placeholder="0"')}<label class="f"><span>За какой месяц</span><select id="cro-m">${months.map(m=>`<option value="${m}"${m===(p.m||k.ym)?" selected":""}>${crMon(m)}${m!==k.ym?" (уже есть)":""}</option>`).join("")}</select></label>`:""}
      <label class="f crwide"><span>Заметка</span><input id="cro-note" maxlength="160" value="${esc(p.note||"")}" placeholder="${p.t==="spend"?"на что":"необязательно"}" autocomplete="off"></label></div>
    ${p.t==="pay"?`<small class="crhint">Проценты сайт посчитал примерно — точная сумма есть в приложении банка, её можно поправить.</small>`:""}
    <div id="cro-info">${info}</div>
    ${recTxt?`<label class="mbck"><input type="checkbox" id="cro-rec" ${p.rec!==false?"checked":""}><span>${esc(recTxt)}</span></label>`:""}
    <div class="mbdact"><span style="flex:1"></span><button type="button" class="btn ghost" data-crd="close">Отмена</button><button type="button" class="btn pri" data-crd="save">Записать</button></div></form>`; }
function crOpRead(){ const p=CRU.op, g=id=>$("#"+id); if(!p) return; if(g("cro-s")) p.s=g("cro-s").value; if(g("cro-d")) p.d=g("cro-d").value; if(g("cro-pct")) p.pct=g("cro-pct").value; if(g("cro-m")) p.m=g("cro-m").value; if(g("cro-note")) p.note=g("cro-note").value; if(g("cro-rec")) p.rec=g("cro-rec").checked; }
function crOpSave(){ crOpRead(); const p=CRU.op; if(!p) return; const r=crFind(p.rid); if(!r) return; const o=crObj(r), s=r2(crN(p.s));
  if(!(s>0)){ const i=$("#cro-s"); if(i){ i.classList.add("bad"); i.focus(); setTimeout(()=>i.classList.remove("bad"),900); } toast("warn","Впишите сумму",""); return; }
  const op={id:uid(), t:p.t, d:p.d||todayISO(), s:String(s), note:(p.note||"").trim(), at:new Date().toISOString(), by:curUser()||"", rec:p.rec!==false};
  if(p.t==="pay"){ const pct=Math.min(s, r2(Math.max(0,crN(p.pct)))); op.pct=String(pct); op.body=String(r2(s-pct)); op.m=p.m||crCalc(r).ym; }
  if(p.t==="extra"){ op.pct="0"; op.body=String(s); }
  crPoSync(r, op); o.ops.push(op); crSave(r, CR_OP[op.t].t.toLowerCase()+" "+fm(s)+" ₽"+(op.m?" за "+crMon(op.m):""));
  crClose(); CRU.flash=op.id; crDraw(); crBadge();
  const k=crCalc(r); toast("ok", CR_OP[op.t].t+" записан"+(op.t==="fee"?"ы":""), r.title+" · "+(r.kind==="card"?"долг по карте "+fm(k.debt)+" ₽":"осталось "+fm(k.bal)+" ₽")+(op.po?" · проценты в «Расходы и доходы»":""), {action:{label:"Отменить", fn:()=>crOpDel(r.id, op.id, true)}}); }
function crOpDel(rid, id, quiet){ const r=crFind(rid); if(!r) return; const o=crObj(r), op=o.ops.find(x=>x.id===id); if(!op) return; const at=o.ops.indexOf(op);
  crPoSync(r, op, true); o.ops=o.ops.filter(x=>x!==op); crSave(r, "удалена операция «"+CR_OP[op.t].t+"» "+fm(crN(op.s))+" ₽"); crDraw(); crBadge();
  if(!quiet) toast("ok","Операция удалена", CR_OP[op.t].t+" — "+fm(crN(op.s))+" ₽", {action:{label:"Вернуть", fn:()=>{ const rr=crFind(rid); if(!rr) return; const c=Object.assign({}, op, {po:""}); crPoSync(rr, c); crObj(rr).ops.splice(Math.min(at, crObj(rr).ops.length), 0, c); crSave(rr, "возвращена операция"); crDraw(); crBadge(); }}}); }
/* ---- события ---- */
function crDlgClick(ev){ const d=$("#cr-dlg"); if(ev.target===d){ if(d._down) crClose(); d._down=false; return; } d._down=false;
  const k=ev.target.closest("[data-crk]"); if(k && CRU.ed){ crEdRead(); CRU.ed.kind=k.dataset.crk; crEdDraw(); return; }
  const ow=ev.target.closest("[data-cro]"); if(ow && CRU.ed){ crEdRead(); CRU.ed.own=ow.dataset.cro; crEdDraw(); return; }
  if(ev.target.id==="cro-rec"){ crOpRead(); return; }
  const b=ev.target.closest("[data-crd]"); if(!b) return; const a=b.dataset.crd;
  if(a==="close"){ crClose(); return; }
  if(a==="tot" && CRU.ed){ crEdRead(); CRU.ed.bal0=String(crN(CRU.ed.sum)); const i=$("#cre-bal0"); if(i) i.value=crMoney(CRU.ed.bal0); const pv=$("#cre-prev"); if(pv) pv.innerHTML=crEdPrev(); return; }
  if(a==="save"){ if(CRU.op) crOpSave(); else crEdSave(); return; }
  if(a==="del" && CRU.ed){ if(!armed(b,"Точно удалить?")) return; crDel(CRU.ed.id); crClose(); } }
function crDlgSave(){ if(CRU.op) crOpSave(); else if(CRU.ed) crEdSave(); }
function crDlgInput(e){ if(CRU.op){ crOpRead(); if(["cro-s","cro-pct","cro-rec","cro-d"].includes(e.target.id)) crOpInfo(); return; }
  if(CRU.ed){ crEdRead(); const pv=$("#cre-prev"); if(pv) pv.innerHTML=crEdPrev(); } }
/* обновить только подсказки окна операции — поля ввода не перерисовываются, курсор не прыгает */
function crOpInfo(){ const p=CRU.op; if(!p) return; const r=crFind(p.rid); if(!r) return; const k=crCalc(r), s=crN(p.s), box=$("#cro-info"); if(!box) return;
  if(p.t==="pay"){ const body=r2(s-crN(p.pct)); box.innerHTML=s>0?`<div class="mbinfo ${body<0?"crw":"ok"}">${body<0?"Проценты больше платежа — проверьте суммы.":`В погашение долга ${fm(body)} ₽ → останется ${fm(Math.max(0,r2(k.bal-body)))} ₽.`}</div>`:""; }
  else if(p.t==="extra") box.innerHTML=s>0?`<div class="mbinfo ok">Долг уменьшится с ${fm(k.bal)} до ${fm(Math.max(0,r2(k.bal-s)))} ₽. Ежемесячный платёж останется прежним — кредит закончится раньше.</div>`:"";
  else if(p.t==="cpay") box.innerHTML=`<div class="mbinfo ok">Долг ${fm(k.debt)} ₽${s>0?` → станет ${fm(Math.max(0,r2(k.debt-s)))} ₽`:""}${k.nsum>0.004?` · минимальный платёж ${fm(k.nsum)} ₽ до ${crDt(k.next)}`:""}.</div>`;
  else if(p.t==="spend") box.innerHTML=`<div class="mbinfo">${k.lim?`Доступно ${fm(Math.max(0,k.avail))} ₽${s>0?` → останется ${fm(r2(k.avail-s))} ₽`:""}.`:"Долг по карте увеличится."} Саму покупку, если нужно, запишите в «Расходы и доходы» отдельно.</div>`;
  const rec=$("#cro-rec"); if(rec){ const t=crPoTxt(k.o, Object.assign({}, p)); const sp=rec.nextElementSibling; if(sp && t) sp.textContent=t; } }
function crDel(id){ const r=crFind(id); if(!r) return; crObj(r).ops.forEach(op=>crPoSync(r, op, true));
  D.credits=crRows().filter(x=>x.id!==id); dirty("credits", id, true); logEv("Прибыль","Удалён кредит «"+r.title+"»"); saveLocal(); if(CRU.cur===id) CRU.cur=""; crDraw(); crBadge();
  toast("ok","Удалено","«"+r.title+"» и его записи в «Расходы и доходы»"); }
function crArch(on){ const r=crFind(CRU.cur); if(!r) return; r.arch=on?"1":""; crSave(r, on?"убран в закрытые":"возвращён из закрытых"); if(on){ CRU.cur=""; } else CRU.arch=false; CRU.anim=true; crDraw(); crBadge();
  toast("ok", on?"Убран в «Закрытые»":"Снова в списке", r.title, on?{action:{label:"Отменить", fn:()=>{ CRU.cur=r.id; crArch(false); }}}:{}); }
function crBadge(){ const sw=$("#mb-sw [data-dbv='credit']"); if(!sw) return; let em=sw.querySelector("em"); const n=crSoon().length; if(!n){ if(em) em.remove(); return; } if(!em){ em=document.createElement("em"); sw.appendChild(em); } em.textContent=n; em.title="Платежи в ближайшие 3 дня или просроченные"; }
function crClick(e){ const box=e.target.closest(".cr"); if(!box) return;
  const go=e.target.closest("[data-crgo]"); if(go){ CRU.cur=go.dataset.crgo; CRU.arch=false; crDraw(); const c=document.querySelector('.crc[data-cr="'+CSS.escape(CRU.cur)+'"]'); if(c){ c.scrollIntoView({behavior:"smooth", block:"center"}); c.classList.add("flash"); } return; }
  const del=e.target.closest("[data-crdel]"); if(del){ if(!armed(del,"?")) return; crOpDel(CRU.cur, del.dataset.crdel); return; }
  const b=e.target.closest("[data-cra]");
  if(!b){ const h=e.target.closest(".crh"); if(h){ const id=h.closest(".crc").dataset.cr; CRU.cur=CRU.cur===id?"":id; crToggle(); } return; }
  const a=b.dataset.cra, card=b.closest(".crc"); if(card) CRU.cur=card.dataset.cr;
  if(a.startsWith("new:")){ crEdit(a.slice(4)); return; }
  if(a.startsWith("op:")){ crOpOpen(a.slice(3)); return; }
  if(a==="edit"){ crEdit(null, CRU.cur); return; }
  if(a==="sched"){ CRU.sched[CRU.cur]=!CRU.sched[CRU.cur]; crDraw(); return; }
  if(a==="arch"){ crArch(true); return; }
  if(a==="unarch"){ crArch(false); return; }
  if(a==="del"){ if(!armed(b,"Точно удалить?")) return; crDel(CRU.cur); return; }
  if(a==="archv"){ CRU.arch=!CRU.arch; CRU.cur=""; CRU.anim=true; crDraw(); } }
function crToggle(){ document.querySelectorAll("#pv-debt .crc").forEach(c=>{ const on=c.dataset.cr===CRU.cur, was=c.classList.contains("open"); if(on===was) return;
  const r=crFind(c.dataset.cr), inner=c.querySelector(".crb>div"); if(on && r) inner.innerHTML=crBodyHtml(r, crCalc(r), !!+r.arch);
  c.classList.toggle("open", on); c.querySelector(".crh").setAttribute("aria-expanded", on); });
  const c=CRU.cur && document.querySelector('.crc[data-cr="'+CSS.escape(CRU.cur)+'"]'); if(c) setTimeout(()=>c.scrollIntoView({behavior:"smooth", block:"nearest"}), 200); }
function crKey(e){ if(!e.target.closest || !e.target.closest(".cr")) return; if((e.key==="Enter"||e.key===" ") && (e.target.matches(".crh")||e.target.matches("[data-crgo]"))){ e.preventDefault(); e.target.click(); } }
