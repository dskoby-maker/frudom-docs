/* ===== Доска денег («Прибыль» → «Долги» → «Доска денег», просьба Даниила 21.11.2026) =====
   Доска = одна история денег: откуда пришли, на что ушли, кому вернуть. Шаги «сделано» / «план».
   Хранение: лист «Доска денег» (mboard: одна строка = одна доска, шаги и заметки — JSON в data), Code.gs ≥ 51;
   со старым скриптом — только на устройстве (D.mbSrv=false).
   Связь с книжкой долгов: «Взял в долг» (сделано) создаёт долг «Я должен», «Вернул долг» — погашение этого долга
   (id погашения "mb:<id шага>"); «Дал в долг» / «Мне вернули» — то же для «Мне должны». */
const MB_T={
  loan:{t:"Взял в долг", s:"взял в долг", ic:"↓", c:"#B86A1D", bg:"#FBF0E2", sign:1, who:"У кого", ph:"например, Таня", hint:"Деньги пришли к вам, но их нужно вернуть. Долг сам появится в «Я должен»."},
  in:{t:"Пришли деньги", s:"пришли деньги", ic:"+", c:"#2F6B45", bg:"#E6F3EA", sign:1, who:"От кого", ph:"например, Зоопарк", hint:"Ваши деньги: оплата заказчика, выручка, возврат."},
  out:{t:"Потратил", s:"потратил", ic:"−", c:"#B3261E", bg:"#FBE9E5", sign:-1, who:"На что", ph:"например, перчатки, доставка", hint:"Закупка, доставка, налог — всё, что ушло из этих денег."},
  repay:{t:"Вернул долг", s:"вернул долг", ic:"↩", c:"#B86A1D", bg:"#FBF0E2", sign:-1, who:"Кому", ph:"например, Таня", hint:"Уменьшит долг этому человеку в книжке «Я должен»."},
  give:{t:"Платёж / кредит", s:"платёж", ic:"→", c:"#1E6F8C", bg:"#E3F1F6", sign:-1, who:"Куда", ph:"например, кредит за декабрь", hint:"Обязательные платежи: кредит, аренда, лизинг."},
  me:{t:"Оставил себе", s:"оставил себе", ic:"★", c:"#6A2C4E", bg:"#F2E7ED", sign:-1, who:"Зачем", ph:"например, личные", hint:"Деньги, которые вы забрали себе из этой истории."},
  lend:{t:"Дал в долг", s:"дал в долг", ic:"↗", c:"#5B4AA8", bg:"#ECE9F8", sign:-1, who:"Кому", ph:"имя или компания", hint:"Вы одолжили деньги. Долг сам появится в «Мне должны»."},
  back:{t:"Мне вернули", s:"мне вернули", ic:"↙", c:"#5B4AA8", bg:"#ECE9F8", sign:1, who:"Кто вернул", ph:"имя или компания", hint:"Уменьшит долг этого человека в книжке «Мне должны»."}
};
const MB_ORDER=["in","loan","out","give","repay","me","lend","back"];
const MB_NB=["#FFF6C9","#E7F3E6","#FDE8E1","#E6EEF8","#F2E7F4"];
const MBU={cur:"", arch:false, ed:null, flash:"", anim:true, help:null};
const MB_OPEN=k=>k==="loan"||k==="lend", MB_PAY=k=>k==="repay"||k==="back";
const mbSide=k=>k==="loan"||k==="repay"?DB_OUT:k==="lend"||k==="back"?DB_IN:"";
const mbRows=()=>pfArr("mboard");
const mbObj=r=>{ if(r._o) return r._o; let o; try{ o=JSON.parse(r.data||"{}"); }catch(e){ o={}; } o.steps=Array.isArray(o.steps)?o.steps:[]; o.notes=Array.isArray(o.notes)?o.notes:[]; Object.defineProperty(r,"_o",{value:o, writable:true, enumerable:false, configurable:true}); return o; };
const mbFind=id=>mbRows().find(r=>r.id===id);
function mbSave(r, msg){ const o=mbObj(r); r.data=JSON.stringify({steps:o.steps, notes:o.notes}); r.upd=new Date().toISOString(); r.by=curUser()||""; if(!mbRows().includes(r)) mbRows().push(r); dirty("mboard", r.id); if(msg) logEv("Прибыль", "Доска «"+r.title+"»: "+msg); saveLocal(); }
function mbHelpSeen(){ if(MBU.help==null){ try{ MBU.help=localStorage.getItem("frudom-mbhelp")==="1"; }catch(e){ MBU.help=false; } } return MBU.help; }
function mbHelpOff(){ MBU.help=true; try{ localStorage.setItem("frudom-mbhelp","1"); }catch(e){} }
function mbMerge(list){
  if(!Array.isArray(list)){ D.mbSrv=false; return; }
  const loc=mbRows(), keep=loc.filter(x=>pend.mboard.has(x.id) && !pend.mboard.get(x.id).del), gone=new Set([...pend.mboard.entries()].filter(([,v])=>v.del).map(([k])=>k));
  D.mboard=list.filter(x=>!gone.has(x.id)); keep.forEach(x=>{ const i=D.mboard.findIndex(y=>y.id===x.id); if(i>=0) D.mboard[i]=x; else D.mboard.push(x); });
  const was=D.mbSrv; D.mbSrv=true; if(!was && pend.mboard.size) changed();
}
/* ---- расчёт доски ---- */
function mbCalc(o){ let now=0, plan=0, wait=0, inAll=0; const by={}, ppl={};
  o.steps.forEach(s=>{ const t=MB_T[s.k]; if(!t) return; const v=+s.sum||0, sv=t.sign*v; plan+=sv; if(s.done) now+=sv; else if(sv>0) wait+=sv; if(sv>0) inAll+=v; else by[s.k]=(by[s.k]||0)+v;
    const side=mbSide(s.k); if(side){ const n=(s.who||"—").trim(), key=side+"|"+norm(n), p=ppl[key]||(ppl[key]={side, n, took:0, back:0, plan:0, planBack:0, db:""});
      if(MB_OPEN(s.k)){ if(s.done) p.took+=v; else p.plan+=v; if(s.db) p.db=s.db; } else { if(s.done) p.back+=v; else p.planBack+=v; } } });
  const P=Object.values(ppl).map(p=>{ const d=p.db && pfArr("debts").find(x=>x.id===p.db); p.left=d?dbLeft(d):Math.max(0, r2(p.took-p.back)); p.debt=d||null; return p; });
  const owe=r2(P.filter(p=>p.side===DB_OUT).reduce((a,p)=>a+p.left,0)), mine=r2(P.filter(p=>p.side===DB_IN).reduce((a,p)=>a+p.left,0));
  const oweU=r2(P.filter(p=>p.side===DB_OUT).reduce((a,p)=>a+Math.max(0,p.left+p.plan-p.planBack),0)), mineU=r2(P.filter(p=>p.side===DB_IN).reduce((a,p)=>a+Math.max(0,p.left+p.plan-p.planBack),0));
  return {now:r2(now), plan:r2(plan), wait:r2(wait), inAll:r2(inAll), by, P, owe, mine, oweU, mineU}; }
/* ---- связь с книжкой долгов ---- */
function mbDebtPut(x){ if(!pfArr("debts").some(y=>y.id===x.id)) pfArr("debts").push(x); dirty("debts", x.id); }
function mbDebtFix(x){ x.closed=""; return dbTouch(x); }
function mbLink(r, s, old){
  const title=r.title||"Доска", want=s && MB_OPEN(s.k) && s.done && s.link!==false && (+s.sum||0)>0;
  if(old && MB_OPEN(old.k) && old.db){ const d=pfArr("debts").find(x=>x.id===old.db);
    if(d && want && s.db===old.db){ d.side=mbSide(s.k); d.name=(s.who||"").trim()||d.name; d.sum=String(r2(+s.sum)); d.date=s.date||d.date; mbDebtFix(d); mbDebtPut(d); }
    else if(d){ const own=dbPays(d).every(p=>String(p.id||"").startsWith("mb:")); if(own && !dbPays(d).length){ D.debts=pfArr("debts").filter(x=>x.id!==d.id); dirty("debts", d.id, true); } if(s) s.db=""; }
    else if(s) s.db=""; }
  if(want && !s.db){ const d={id:uid(), date:s.date||todayISO(), side:mbSide(s.k), name:(s.who||"").trim()||"—", sum:String(r2(+s.sum)), paid:"0", due:"", note:"Доска «"+title+"»"+(s.note?": "+s.note:""), closed:"", pays:"[]", by:curUser()||""}; mbDebtPut(d); s.db=d.id; }
  if(old && MB_PAY(old.k) && old.db){ const d=pfArr("debts").find(x=>x.id===old.db); if(d){ d.pays=JSON.stringify(dbPays(d).filter(p=>p.id!=="mb:"+old.id)); mbDebtFix(d); mbDebtPut(d); } if(s && (!MB_PAY(s.k) || !s.done)) s.db=""; }
  if(s && MB_PAY(s.k) && s.done && (+s.sum||0)>0){ const d=mbPayTarget(r, s); if(d){ const L=dbPays(d).filter(p=>p.id!=="mb:"+s.id); L.push({id:"mb:"+s.id, date:s.date||todayISO(), sum:String(r2(+s.sum)), note:"Доска «"+title+"»"}); d.pays=JSON.stringify(L); mbDebtFix(d); mbDebtPut(d); s.db=d.id; } else s.db=""; }
}
function mbPayTarget(r, s){ const side=mbSide(s.k), n=norm((s.who||"").trim()); if(!n) return null;
  const all=pfArr("debts").filter(x=>x.side===side && norm(x.name||"")===n), mine=new Set(mbObj(r).steps.filter(x=>MB_OPEN(x.k)&&x.db).map(x=>x.db));
  const has=all.find(x=>dbPays(x).some(p=>p.id==="mb:"+s.id)); if(has) return has;
  return all.filter(x=>mine.has(x.id) && dbLeft(x)>0.004)[0] || all.filter(x=>dbLeft(x)>0.004).sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0] || null; }
/* ---- подсказки по цифрам ---- */
function mbHints(r, o, k){ const H=[], td=todayISO();
  if(!o.steps.length) return [{ic:"✎", t:"Начните с первого шага: откуда пришли деньги? Например, «Взял в долг · Таня» или «Пришли деньги · Зоопарк».", b:"Добавить первый шаг", a:"add"}];
  const late=o.steps.filter(s=>!s.done && s.date && s.date<td).sort((a,b)=>a.date.localeCompare(b.date));
  if(late.length) H.push({ic:"!", w:1, t:`${late.length===1?"Один шаг":late.length+" "+plural(late.length,["шаг","шага","шагов"])} в плане уже ${late.length===1?"просрочен":"просрочены"} (${late.map(s=>MB_T[s.k].s+(s.who?" · "+s.who:"")).slice(0,2).join(", ")}${late.length>2?"…":""}). Сделано — нажмите на кружок, нет — поменяйте дату.`, b:"Открыть", a:"step:"+late[0].id});
  if(k.now<-0.004) H.push({ic:"!", w:1, t:`Потрачено больше, чем пришло: ${fm(k.now)} ₽. Проверьте, записаны ли все поступления.`});
  k.P.filter(p=>p.left>0.004 || p.plan>0).forEach(p=>{ const left=r2(p.left+p.plan), planned=p.planBack;
    if(p.side===DB_OUT && left-planned>0.004){ const inc=o.steps.filter(s=>!s.done && MB_T[s.k].sign>0 && s.k!=="loan").sort((a,b)=>(a.date||"").localeCompare(b.date||""))[0];
      H.push({ic:"↩", t:`${p.n} — ещё нужно вернуть ${fm(r2(left-planned))} ₽, а в плане возврата нет${inc?`. Ближайшие деньги: ${inc.who||MB_T[inc.k].s}${inc.date?" "+fd(inc.date):""}`:""}.`, b:"Запланировать возврат", a:"pre:repay|"+p.n+"|"+r2(left-planned)}); }
    else if(p.side===DB_IN && left-planned>0.004) H.push({ic:"↙", t:`${p.n} должен вам ${fm(r2(left-planned))} ₽ — возврата в плане нет.`, b:"Запланировать", a:"pre:back|"+p.n+"|"+r2(left-planned)}); });
  if(k.plan<-0.004) H.push({ic:"!", w:1, t:`По плану не хватает ${fm(Math.abs(k.plan))} ₽ — расходов больше, чем придёт денег.`});
  if(o.steps.length && o.steps.every(s=>s.done) && !+r.arch) H.push({ic:"✓", ok:1, t:"Все шаги сделаны. Доску можно закрыть — она уйдёт в «Закрытые» и не будет мешать.", b:"Закрыть доску", a:"arch"});
  if(!H.length){ const nx=o.steps.filter(s=>!s.done).sort((a,b)=>(a.date||"9").localeCompare(b.date||"9"))[0]; if(nx) H.push({ic:"→", ok:1, t:`Следующий шаг: ${MB_T[nx.k].s}${nx.who?" · "+nx.who:""} — ${fm(+nx.sum||0)} ₽${nx.date?", "+fd(nx.date):""}. Когда сделаете — нажмите на кружок слева.`}); }
  return H; }
/* ---- отрисовка ---- */
function mbSwitch(v){ return `<div class="fdseg mbsw" id="mb-sw" style="--x:${v==="board"?"100%":"0"}"><i></i><button type="button" data-dbv="book" class="${v==="board"?"":"on"}" aria-pressed="${v!=="board"}">Книжка долгов</button><button type="button" data-dbv="board" class="${v==="board"?"on":""}" aria-pressed="${v==="board"}">Доска денег</button></div>`; }
function mbList(){ return mbRows().filter(r=>!+r.arch).sort((a,b)=>(+a.ord||0)-(+b.ord||0)||(a.id).localeCompare(b.id)); }
function mbDraw(){
  const box=$("#pv-debt"); if(!box) return;
  const ae=document.activeElement, keep=ae && box.contains(ae) && ae.dataset && ae.dataset.mbnote ? ae.dataset.mbnote : "";
  const L=mbList(), A=mbRows().filter(r=>+r.arch);
  let r=mbFind(MBU.cur); if(!r || (+r.arch && !MBU.arch)) r=L[0]||(MBU.arch?A[0]:null); MBU.cur=r?r.id:"";
  const help=!mbHelpSeen();
  box.innerHTML=`<div class="mb${MBU.anim?" anim":""}">
    <div class="dbhead mbhead"><div><h2>Доска денег</h2><small>Каждая доска — одна история: откуда пришли деньги, на что ушли и кому сколько вернуть.</small></div>
      <div class="mbhr">${mbSwitch("board")}<button type="button" class="mbq" data-mb="help" title="Как пользоваться доской" aria-label="Как пользоваться доской">?</button></div></div>
    <p class="note" ${pfLoaded && !D.mbSrv?"":"hidden"}>Чтобы доска была видна на всех устройствах, обновите скрипт таблицы (Code.gs). Пока она хранится только здесь.</p>
    <div class="mbhelp${help?" on":""}" id="mb-help" ${help?"":"hidden"}>
      <b>Как пользоваться</b>
      <ol><li><span>1</span>Создайте доску на одну историю, например «Перчатки для Зоопарка».</li>
        <li><span>2</span>Записывайте шаги: <em>взял в долг</em>, <em>потратил</em>, <em>пришли деньги</em>, <em>вернул долг</em>, <em>платёж по кредиту</em>. То, что ещё не случилось, — планом.</li>
        <li><span>3</span>Сделали шаг — нажмите на кружок слева. Цифры сверху пересчитаются, а долги сами попадут в «Книжку долгов».</li></ol>
      <button type="button" class="btn sm" data-mb="helpok">Понятно</button></div>
    <div class="mbchips" role="tablist" aria-label="Доски">${L.map(x=>{ const o=mbObj(x), pl=o.steps.filter(s=>!s.done).length; return `<button type="button" role="tab" class="mbchip${x.id===MBU.cur?" on":""}" data-mbb="${esc(x.id)}" aria-selected="${x.id===MBU.cur}">${esc(x.title||"Без названия")}${pl?`<em title="Шагов в плане">${pl}</em>`:""}</button>`; }).join("")}
      <button type="button" class="mbchip add" data-mb="new">+ Новая доска</button>
      ${A.length?`<button type="button" class="mbchip arch${MBU.arch?" on":""}" data-mb="archv" aria-pressed="${MBU.arch}">Закрытые · ${A.length}</button>`:""}</div>
    ${MBU.arch?`<div class="mbchips mbachips">${A.map(x=>`<button type="button" class="mbchip${x.id===MBU.cur?" on":""}" data-mbb="${esc(x.id)}">${esc(x.title||"Без названия")}</button>`).join("")}</div>`:""}
    <div id="mb-board">${r?mbBoardHtml(r):mbEmptyHtml()}</div></div>`;
  MBU.anim=false; mbCountUp(box);
  if(MBU.flash){ const el=box.querySelector('[data-mbstep="'+CSS.escape(MBU.flash)+'"]'); if(el){ el.classList.add("flash"); el.scrollIntoView({block:"nearest", behavior:"smooth"}); } MBU.flash=""; }
  if(keep){ const t=box.querySelector('[data-mbnote="'+CSS.escape(keep)+'"]'); if(t){ t.focus(); const n=t.value.length; try{ t.setSelectionRange(n,n); }catch(e){} } }
}
function mbEmptyHtml(){ return `<div class="mbempty"><div class="mbei">₽</div><b>${mbRows().length?"Открытых досок нет":"Пока ни одной доски"}</b><span>Создайте доску на историю с деньгами — например, «Занял у Тани на перчатки». Дальше записывайте шаги, а доска сама посчитает, что на руках и кому сколько вернуть.</span><button type="button" class="btn pri" data-mb="new">+ Создать доску</button></div>`; }
function mbBoardHtml(r){
  const o=mbObj(r), k=mbCalc(o), td=todayISO(), arch=!!+r.arch;
  const S=o.steps.slice().sort((a,b)=>(a.date||"9999").localeCompare(b.date||"9999")||o.steps.indexOf(a)-o.steps.indexOf(b));
  let ti=S.findIndex(s=>(s.date||"9999")>td); if(ti<0) ti=S.length;
  const outs=["out","give","repay","me","lend"].map(x=>[x,k.by[x]||0]).filter(p=>p[1]>0.004), rest=Math.max(0,k.plan), H=mbHints(r,o,k);
  const debtsTxt=k.owe>0.004||k.mine>0.004 ? [k.owe>0.004?"вы должны "+k.P.filter(p=>p.side===DB_OUT&&p.left>0.004).map(p=>p.n).join(", "):"", k.mine>0.004?"вам должны "+k.P.filter(p=>p.side===DB_IN&&p.left>0.004).map(p=>p.n).join(", "):""].filter(Boolean).join(" · ") : "никто никому";
  return `<div class="mbb">
    <div class="mbtop"><input class="mbtitle" id="mb-title" value="${esc(r.title||"")}" placeholder="Название доски" maxlength="80" aria-label="Название доски" ${arch?"disabled":""}>
      <div class="mbtacts">${arch?`<button type="button" class="btn sm" data-mb="unarch">Вернуть из закрытых</button>`:`<button type="button" class="btn ghost sm" data-mb="arch" title="Убрать доску в «Закрытые»">Закрыть</button>`}<button type="button" class="btn ghost sm danger" data-mb="del">Удалить</button></div></div>
    <div class="pvkpi mbkpi">
      <div class="${k.now<-0.004?"neg":""}"><small>Сейчас на руках</small><b data-mbn="${k.now}">${fm(k.now)} ₽</b><span>пришло минус ушло — по сделанным шагам</span></div>
      <div class="pos"><small>Ещё придёт</small><b data-mbn="${k.wait}">${fm(k.wait)} ₽</b><span>${k.wait>0.004?"деньги в плане":"ничего не ждём"}</span></div>
      <div class="${k.owe>0.004?"due":k.mine>0.004?"pos":""} go" data-mb="book" role="button" tabindex="0" title="Открыть книжку долгов"><small>Долги по этой доске</small><b data-mbn="${k.owe>0.004?-k.owe:k.mine}">${k.owe>0.004?"−"+fm(k.owe):fm(k.mine)} ₽</b><span>${esc(debtsTxt)}</span></div>
      <div class="${k.plan<-0.004?"neg":k.oweU>0.004?"due":"pos"}"><small>Останется в конце</small><b data-mbn="${k.plan}">${fm(k.plan)} ₽</b><span>${k.oweU>0.004?`из них ещё вернуть ${fm(k.oweU)} ₽ — возврата нет в плане`:k.mineU>0.004?`плюс вам должны ${fm(k.mineU)} ₽`:"если всё пойдёт по плану"}</span></div></div>
    ${k.inAll>0.004?`<div class="mbflow"><div class="mbfl"><span>Куда уходят деньги</span><span>всего приходит ${fm(k.inAll)} ₽</span></div>
      <div class="mbbar">${outs.map(([x,v])=>`<i style="flex:${v};background:${MB_T[x].c}" title="${MB_T[x].t}: ${fm(v)} ₽"></i>`).join("")}${rest>0.004?`<i style="flex:${rest};background:#D9D2CA" title="Свободно: ${fm(rest)} ₽"></i>`:""}</div>
      <div class="mblg">${outs.map(([x,v])=>`<span style="--c:${MB_T[x].c}">${MB_T[x].t} ${fm(v)}</span>`).join("")}${rest>0.004?`<span style="--c:#D9D2CA">Свободно ${fm(rest)}</span>`:""}</div></div>`:""}
    ${H.length?`<div class="mbhints">${H.map(h=>`<div class="mbh${h.w?" w":""}${h.ok?" ok":""}"><i>${h.ic}</i><span>${esc(h.t)}</span>${h.b&&!arch?`<button type="button" class="btn sm" data-mb="${esc(h.a)}">${esc(h.b)}</button>`:""}</div>`).join("")}</div>`:""}
    <div class="mbcols">
      <section class="mbcard"><div class="mbsec"><h3>Шаги <small>${o.steps.length?S.filter(s=>s.done).length+" из "+S.length+" сделано":""}</small></h3>${arch?"":`<button type="button" class="btn sm pri" data-mb="add">+ Шаг</button>`}</div>
        ${S.length?`<ol class="mbsteps">${S.map((s,i)=>{ const t=MB_T[s.k]||MB_T.out, late=!s.done && s.date && s.date<td, dbx=s.db && pfArr("debts").find(x=>x.id===s.db);
          return `${i===ti&&ti>0&&ti<S.length?`<li class="mbtoday" aria-hidden="true"><span>сегодня</span></li>`:""}<li class="mbs${s.done?"":" plan"}${late?" late":""}" data-mbstep="${esc(s.id)}" style="--c:${t.c};--s:${t.bg};--d:${Math.min(i,12)*35}ms">
            <button type="button" class="mbic" data-mbdone="${esc(s.id)}" ${arch?"disabled":""} aria-pressed="${!!s.done}" title="${s.done?"Сделано — нажмите, чтобы вернуть в план":"В плане — нажмите, когда сделаете"}"><span>${t.ic}</span><i aria-hidden="true">✓</i></button>
            <span class="mbst" role="button" tabindex="0"><b>${t.t}${s.who?" · "+esc(s.who):""}</b><small>${s.date?fd(s.date):"без даты"}${late?` · <em class="mblate">просрочен</em>`:s.done?"":` · <em class="mbpl">план</em>`}${dbx?` · <em class="mbdb">в книжке долгов</em>`:""}${s.note?" · "+esc(s.note):""}</small></span>
            <span class="mbsum ${t.sign>0?"pos":"neg"}" role="button" tabindex="-1">${t.sign>0?"+":"−"}${fm(+s.sum||0)}</span></li>`; }).join("")}</ol>`
          :`<div class="mbnone">Шагов пока нет. ${arch?"":`<button type="button" class="lnk" data-mb="add">Добавить первый шаг ›</button>`}</div>`}
      </section>
      <div class="mbside">
        <section class="mbcard"><div class="mbsec"><h3>Долги</h3>${k.P.length?`<button type="button" class="lnk" data-mb="book">Книжка долгов ›</button>`:""}</div>
          ${k.P.length?k.P.map(p=>{ const tot=r2(p.took+p.plan), done=r2(tot-p.left-p.plan), pc=tot>0?Math.min(100,Math.max(0,done/tot*100)):0, out=p.side===DB_OUT;
            return `<div class="mbdebt${p.debt?" go":""}" ${p.debt?`data-mbdebt="${esc(p.debt.id)}" role="button" tabindex="0" title="Открыть в книжке долгов"`:""}><div><b>${esc(p.n)}</b><small>${out?"взял":"дал"} ${fm(p.took)}${p.plan?" · в плане ещё "+fm(p.plan):""} · ${out?"вернул":"вернули"} ${fm(done)}</small><div class="mbpb"><i style="width:${pc.toFixed(1)}%"></i></div></div>
              <div class="mbdl ${p.left>0.004?(out?"due":"pos"):"pos"}"><b>${p.left>0.004?fm(p.left):"✓"}</b><small>${p.left>0.004?(out?"вы должны":"должен вам"):"рассчитались"}</small></div></div>`; }).join("")
            :`<div class="mbnone">Долгов нет. Шаг «Взял в долг» сам появится здесь и в книжке «Я должен».</div>`}
        </section>
        <section class="mbcard"><div class="mbsec"><h3>Заметки</h3></div>
          <div class="mbnotes">${o.notes.map(n=>`<div class="mbnote" style="--nb:${MB_NB[(+n.c||0)%MB_NB.length]}"><textarea data-mbnote="${esc(n.id)}" placeholder="Напишите заметку…" rows="3" ${arch?"disabled":""}>${esc(n.t||"")}</textarea>${arch?"":`<div class="mbna"><button type="button" data-mbcol="${esc(n.id)}" title="Другой цвет" aria-label="Другой цвет">●</button><button type="button" data-mbndel="${esc(n.id)}" title="Удалить заметку" aria-label="Удалить заметку">×</button></div>`}</div>`).join("")}
            ${arch?"":`<button type="button" class="mbnote add" data-mb="note">+ Заметка<small>например, «Таня просила до 1 декабря»</small></button>`}</div>
        </section>
      </div>
    </div></div>`;
}
function mbCountUp(box){ const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches, f=x=>(x<-0.004?"−":"")+fm(Math.abs(x))+" ₽";
  box.querySelectorAll(".mbkpi>div").forEach((d,i)=>{ const b=d.querySelector("b[data-mbn]"); if(!b) return; const to=+b.dataset.mbn, from=MBU["k"+i]; MBU["k"+i]=to;
    if(reduce || from==null || Math.abs(to-from)<0.005) return; const t0=performance.now(), dur=450;
    const step=t=>{ if(!b.isConnected) return; const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3); b.textContent=f(from+(to-from)*e); if(p<1) requestAnimationFrame(step); else b.textContent=f(to); };
    requestAnimationFrame(step); }); }
function mbRedraw(){ mbDraw(); }
/* ---- окно шага ---- */
function mbDlg(){ let d=$("#mb-dlg"); if(d) return d; d=document.createElement("dialog"); d.id="mb-dlg"; d.className="mbdlg"; ($("#fd-app")||document.body).appendChild(d);
  d.addEventListener("click", mbDlgClick); d.addEventListener("input", mbDlgInput);
  d.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.tagName==="INPUT" && !e.target.closest(".dlsug")){ e.preventDefault(); mbDlgSave(); } });
  d.addEventListener("close", ()=>{ MBU.ed=null; });
  d.addEventListener("mousedown", e=>{ if(e.target===d) d._down=true; }); return d; }
function mbOpen(id, pre){ const r=mbFind(MBU.cur); if(!r) return; const o=mbObj(r), s=id?o.steps.find(x=>x.id===id):null;
  MBU.ed=s?Object.assign({}, s, {_new:false}):Object.assign({id:uid(), k:"out", sum:"", who:"", date:todayISO(), done:true, note:"", link:true, _new:true}, pre||{});
  if(!s && pre && pre.k){ MBU.ed.done=false; }
  const d=mbDlg(); mbDlgDraw(); if(!d.open) d.showModal(); d.classList.remove("out"); requestAnimationFrame(()=>d.classList.add("in"));
  setTimeout(()=>{ const i=d.querySelector(MBU.ed._new&&!pre?"#mb-sum":"#mb-sum"); if(i && (MBU.ed._new)) i.focus(); }, 80); }
function mbClose(){ const d=$("#mb-dlg"); if(!d||!d.open) return; d.classList.remove("in"); d.classList.add("out"); setTimeout(()=>{ if(d.open) d.close(); d.classList.remove("out"); }, matchMedia("(prefers-reduced-motion: reduce)").matches?0:180); }
function mbLinkInfo(e){ const side=mbSide(e.k); if(!side) return "";
  if(MB_OPEN(e.k)) return `<label class="mbck"><input type="checkbox" id="mb-link" ${e.link!==false?"checked":""}><span>Записать в книжку долгов — «${side}»${e.done?"":" (когда отметите «сделано»)"}</span></label>`;
  const r=mbFind(MBU.cur), n=(e.who||"").trim(); if(!n) return `<div class="mbinfo">Напишите имя — сайт найдёт долг в книжке «${side}» и уменьшит его.</div>`;
  const d=r && mbPayTarget(r, Object.assign({}, e)); if(!d) return `<div class="mbinfo">Долга «${esc(n)}» в книжке «${side}» нет — шаг просто уменьшит деньги на руках.</div>`;
  const cur=dbPays(d).find(p=>p.id==="mb:"+e.id), left=r2(dbLeft(d)+(cur?+cur.sum:0)), v=+num(e.sum||0)||0;
  return `<div class="mbinfo ok">${e.done?"Уменьшит":"Когда отметите «сделано», уменьшит"} долг «${esc(d.name)}»: сейчас ${fm(left)} ₽${v>0?` → останется ${fm(Math.max(0,r2(left-v)))} ₽`:""}${v>left+0.004?` <b>(больше долга)</b>`:""}.</div>`; }
function mbDlgDraw(){ const d=$("#mb-dlg"), e=MBU.ed; if(!d||!e) return; const t=MB_T[e.k], names=[...new Set([...mbRows().flatMap(r=>mbObj(r).steps.map(s=>s.who)), ...pfArr("debts").map(x=>x.name)].filter(Boolean))].slice(0,60);
  d.innerHTML=`<form class="mbdf" onsubmit="return false"><div class="mbdh"><b>${e._new?"Новый шаг":"Изменить шаг"}</b><button type="button" class="mbx" data-mbd="close" aria-label="Закрыть">×</button></div>
    <div class="mbtypes" role="radiogroup" aria-label="Что произошло">${MB_ORDER.map(x=>`<button type="button" role="radio" data-mbk="${x}" class="${e.k===x?"on":""}" aria-checked="${e.k===x}" style="--c:${MB_T[x].c};--s:${MB_T[x].bg}"><span>${MB_T[x].ic}</span>${MB_T[x].t}</button>`).join("")}</div>
    <div class="mbtip" style="--c:${t.c};--s:${t.bg}">${esc(t.hint)}</div>
    <div class="mbgrid"><label class="f"><span>Сумма, ₽</span><input id="mb-sum" inputmode="decimal" data-money placeholder="0" value="${esc(e.sum===""?"":String(e.sum).replace(".",","))}" autocomplete="off"></label>
      <label class="f"><span>${t.who}</span><input id="mb-who" maxlength="120" placeholder="${esc(t.ph)}" value="${esc(e.who||"")}" list="mb-names" autocomplete="off"></label>
      <label class="f"><span>Дата</span><input id="mb-date" type="date" value="${esc(e.date||"")}"></label>
      <label class="f"><span>Заметка</span><input id="mb-note" maxlength="200" placeholder="необязательно" value="${esc(e.note||"")}" autocomplete="off"></label></div>
    <datalist id="mb-names">${names.map(n=>`<option value="${esc(n)}">`).join("")}</datalist>
    <button type="button" class="mbdone${e.done?" on":""}" data-mbd="done" aria-pressed="${!!e.done}"><i aria-hidden="true"></i><span><b>${e.done?"Уже сделано":"Ещё не сделано — это план"}</b><small>${e.done?"деньги уже ушли или пришли":"шаг будет пунктиром, цифра «Останется в конце» его учтёт"}</small></span></button>
    <div id="mb-li">${mbLinkInfo(e)}</div>
    <div class="mbdact">${e._new?"":`<button type="button" class="btn ghost sm danger" data-mbd="del">Удалить шаг</button>`}<span style="flex:1"></span><button type="button" class="btn ghost" data-mbd="close">Отмена</button><button type="button" class="btn pri" data-mbd="save">${e._new?"Добавить":"Сохранить"}</button></div></form>`; }
function mbDlgRead(){ const e=MBU.ed, g=id=>$("#"+id); if(!e) return; if(g("mb-sum")) e.sum=g("mb-sum").value; if(g("mb-who")) e.who=g("mb-who").value; if(g("mb-date")) e.date=g("mb-date").value; if(g("mb-note")) e.note=g("mb-note").value; if(g("mb-link")) e.link=g("mb-link").checked; }
function mbDlgInput(e){ if(!MBU.ed) return; mbDlgRead(); if(["mb-sum","mb-who"].includes(e.target.id)||e.target.id==="mb-link"){ const li=$("#mb-li"); if(li) li.innerHTML=mbLinkInfo(MBU.ed); } }
function mbDlgClick(ev){ const d=$("#mb-dlg"); if(ev.target===d){ if(d._down) mbClose(); d._down=false; return; } d._down=false; if(!MBU.ed) return;
  const k=ev.target.closest("[data-mbk]"); if(k){ mbDlgRead(); MBU.ed.k=k.dataset.mbk; mbDlgDraw(); const s=$("#mb-sum"); if(s && !s.value) s.focus(); return; }
  if(ev.target.id==="mb-link"){ mbDlgRead(); const li=$("#mb-li"); if(li) li.innerHTML=mbLinkInfo(MBU.ed); return; }
  const b=ev.target.closest("[data-mbd]"); if(!b) return; const a=b.dataset.mbd;
  if(a==="close"){ mbClose(); return; }
  if(a==="done"){ mbDlgRead(); MBU.ed.done=!MBU.ed.done; b.classList.toggle("on", MBU.ed.done); b.setAttribute("aria-pressed", MBU.ed.done); b.querySelector("b").textContent=MBU.ed.done?"Уже сделано":"Ещё не сделано — это план"; b.querySelector("small").textContent=MBU.ed.done?"деньги уже ушли или пришли":"шаг будет пунктиром, цифра «Останется в конце» его учтёт"; const li=$("#mb-li"); if(li) li.innerHTML=mbLinkInfo(MBU.ed); return; }
  if(a==="save"){ mbDlgSave(); return; }
  if(a==="del"){ if(!armed(b,"Точно удалить?")) return; mbStepDel(MBU.ed.id); mbClose(); }
}
function mbDlgSave(){ mbDlgRead(); const e=MBU.ed, r=mbFind(MBU.cur); if(!e||!r) return; const v=r2(+num(e.sum||"")||0);
  if(!(v>0)){ const i=$("#mb-sum"); if(i){ i.classList.add("bad"); i.focus(); setTimeout(()=>i.classList.remove("bad"),900); } toast("warn","Впишите сумму","Сколько денег пришло или ушло."); return; }
  if(mbSide(e.k) && !(e.who||"").trim()){ const i=$("#mb-who"); if(i){ i.classList.add("bad"); i.focus(); setTimeout(()=>i.classList.remove("bad"),900); } toast("warn","Напишите имя", MB_OPEN(e.k)?"У кого взяли или кому дали — так долг попадёт в книжку.":"Кто вернул или кому вернули — так сайт найдёт долг."); return; }
  const o=mbObj(r), i=o.steps.findIndex(x=>x.id===e.id), old=i>=0?Object.assign({}, o.steps[i]):null;
  const s={id:e.id, k:e.k, sum:String(v), who:(e.who||"").trim(), date:e.date||"", done:!!e.done, note:(e.note||"").trim(), link:e.link!==false, db:old?old.db||"":""};
  if(old && old.k!==s.k && !(MB_OPEN(old.k)&&MB_OPEN(s.k)) && !(MB_PAY(old.k)&&MB_PAY(s.k))) s.db=old.db||"";
  mbLink(r, s, old); if(i>=0) o.steps[i]=s; else o.steps.push(s);
  mbSave(r, (old?"изменён шаг «":"шаг «")+MB_T[s.k].t+(s.who?" · "+s.who:"")+"» "+fm(v)+" ₽"+(s.done?"":" (план)"));
  MBU.flash=s.id; mbClose(); mbRedraw(); pvDbBadge();
  toast("ok", old?"Шаг сохранён":"Шаг добавлен", MB_T[s.k].t+(s.who?" · "+s.who:"")+" — "+fm(v)+" ₽"+(s.db?" · книжка долгов обновлена":""));
}
function mbStepDel(id){ const r=mbFind(MBU.cur); if(!r) return; const o=mbObj(r), s=o.steps.find(x=>x.id===id); if(!s) return;
  const at=o.steps.indexOf(s); mbLink(r, null, s); o.steps=o.steps.filter(x=>x.id!==id); mbSave(r, "удалён шаг «"+MB_T[s.k].t+(s.who?" · "+s.who:"")+"»"); mbRedraw(); pvDbBadge();
  toast("ok","Шаг удалён", MB_T[s.k].t+(s.who?" · "+s.who:"")+" — "+fm(+s.sum||0)+" ₽", {action:{label:"Вернуть", fn:()=>{ const rr=mbFind(r.id); if(!rr) return; const oo=mbObj(rr), c=Object.assign({}, s, {db:""}); mbLink(rr, c, null); oo.steps.splice(Math.min(at, oo.steps.length), 0, c); mbSave(rr, "возвращён шаг"); MBU.flash=c.id; mbRedraw(); pvDbBadge(); }}}); }
function mbToggle(id){ const r=mbFind(MBU.cur); if(!r) return; const o=mbObj(r), i=o.steps.findIndex(x=>x.id===id); if(i<0) return;
  const old=Object.assign({}, o.steps[i]), s=Object.assign({}, old, {done:!old.done}); if(s.done && !s.date) s.date=todayISO();
  mbLink(r, s, old); o.steps[i]=s; mbSave(r, "«"+MB_T[s.k].t+(s.who?" · "+s.who:"")+"» — "+(s.done?"сделано":"снова в плане"));
  const row=$('[data-mbstep="'+CSS.escape(id)+'"]'); if(row){ row.classList.toggle("plan", !s.done); row.classList.add("pop"); }
  setTimeout(()=>{ mbRedraw(); pvDbBadge(); }, row && !matchMedia("(prefers-reduced-motion: reduce)").matches?230:0);
  toast("ok", s.done?"Отмечено: сделано":"Вернул в план", MB_T[s.k].t+(s.who?" · "+s.who:"")+" — "+fm(+s.sum||0)+" ₽", {action:{label:"Отменить", fn:()=>mbToggle(id)}}); }
function pvDbBadge(){ const dw=pfArr("debts").filter(x=>dbLeft(x)>0.004).length, dn=$("#pv-dbn"); if(dn){ dn.hidden=!dw; dn.textContent=dw; } }
/* ---- доски ---- */
function mbNew(){ const ord=Math.max(0, ...mbRows().map(r=>+r.ord||0))+1, r={id:uid(), title:"Новая доска", ord:String(ord), arch:"", upd:"", by:"", data:""}; mbObj(r); mbSave(r, "создана"); MBU.cur=r.id; MBU.arch=false; MBU.anim=true; mbDraw();
  const t=$("#mb-title"); if(t){ t.focus(); t.select(); } toast("info","Доска создана","Дайте ей название и добавьте первый шаг."); }
function mbArch(on){ const r=mbFind(MBU.cur); if(!r) return; r.arch=on?"1":""; mbSave(r, on?"закрыта":"возвращена из закрытых"); if(on){ MBU.arch=false; MBU.cur=""; } MBU.anim=true; mbDraw();
  toast("ok", on?"Доска закрыта":"Доска снова открыта", on?"Найти её можно в «Закрытые».":"", on?{action:{label:"Отменить", fn:()=>{ MBU.cur=r.id; mbArch(false); }}}:{}); }
function mbDel(){ const r=mbFind(MBU.cur); if(!r) return; const o=mbObj(r);
  o.steps.slice().forEach(s=>{ if(s.db) mbLink(r, null, s); });
  D.mboard=mbRows().filter(x=>x.id!==r.id); dirty("mboard", r.id, true); logEv("Прибыль","Удалена доска «"+r.title+"»"); saveLocal(); MBU.cur=""; MBU.anim=true; mbDraw(); pvDbBadge();
  toast("ok","Доска удалена","«"+(r.title||"")+"»"+(o.steps.some(s=>s.db)?" · связанные долги без погашений убраны из книжки":"")); }
/* ---- заметки ---- */
let mbNT=0;
function mbNoteSet(id, v){ const r=mbFind(MBU.cur); if(!r) return; const n=mbObj(r).notes.find(x=>x.id===id); if(!n) return; n.t=v; clearTimeout(mbNT); mbNT=setTimeout(()=>mbSave(r), 600); }
/* ---- события ---- */
function mbClick(e){ const box=e.target.closest(".mb"); const sw=e.target.closest("[data-dbv]"); if(sw){ const v=sw.dataset.dbv; if((PV().dv||"book")===v) return; PV().dv=v; saveLocal(); MBU.anim=true; if(v==="board") mbDraw(); else dbDraw(); return; }
  if(!box) return;
  const bb=e.target.closest("[data-mbb]"); if(bb){ if(MBU.cur===bb.dataset.mbb) return; MBU.cur=bb.dataset.mbb; MBU.anim=true; for(let i=0;i<4;i++) delete MBU["k"+i]; mbDraw(); return; }
  const dn=e.target.closest("[data-mbdone]"); if(dn){ e.stopPropagation(); mbToggle(dn.dataset.mbdone); return; }
  const dbt=e.target.closest("[data-mbdebt]"); if(dbt){ PV().dv="book"; dbOpen=dbt.dataset.mbdebt; DBUI.flt="all"; saveLocal(); dbDraw(); setTimeout(()=>{ const c=document.querySelector('.dbc[data-id="'+CSS.escape(dbOpen)+'"]'); if(c) c.scrollIntoView({behavior:"smooth", block:"center"}); }, 60); return; }
  const nc=e.target.closest("[data-mbcol]"); if(nc){ const r=mbFind(MBU.cur), n=r&&mbObj(r).notes.find(x=>x.id===nc.dataset.mbcol); if(n){ n.c=((+n.c||0)+1)%MB_NB.length; mbSave(r); const el=nc.closest(".mbnote"); if(el) el.style.setProperty("--nb", MB_NB[n.c]); } return; }
  const nd=e.target.closest("[data-mbndel]"); if(nd){ const r=mbFind(MBU.cur); if(!r) return; const o=mbObj(r), n=o.notes.find(x=>x.id===nd.dataset.mbndel); if(!n) return;
    if((n.t||"").trim() && !armed(nd,"?")) return; o.notes=o.notes.filter(x=>x!==n); mbSave(r); const el=nd.closest(".mbnote"); if(el){ el.classList.add("gone"); setTimeout(mbRedraw, 200); } else mbRedraw();
    if((n.t||"").trim()) toast("ok","Заметка удалена","",{action:{label:"Вернуть", fn:()=>{ const rr=mbFind(r.id); if(!rr) return; mbObj(rr).notes.push(n); mbSave(rr); mbRedraw(); }}}); return; }
  const st=e.target.closest("[data-mbstep]"); if(st && !e.target.closest("button")){ if(+((mbFind(MBU.cur)||{}).arch)) return; mbOpen(st.dataset.mbstep); return; }
  const b=e.target.closest("[data-mb]"); if(!b) return; const a=b.dataset.mb;
  if(a==="help"){ const h=$("#mb-help"); if(h){ const on=h.hidden; h.hidden=!on; requestAnimationFrame(()=>h.classList.toggle("on", on)); } return; }
  if(a==="helpok"){ mbHelpOff(); const h=$("#mb-help"); if(h){ h.classList.remove("on"); setTimeout(()=>{ h.hidden=true; }, 220); } return; }
  if(a==="new"){ mbNew(); return; }
  if(a==="archv"){ MBU.arch=!MBU.arch; MBU.anim=true; if(MBU.arch){ const A=mbRows().filter(r=>+r.arch); if(A[0]) MBU.cur=A[0].id; } else MBU.cur=""; mbDraw(); return; }
  if(a==="add"){ mbOpen(null); return; }
  if(a.startsWith("step:")){ mbOpen(a.slice(5)); return; }
  if(a.startsWith("pre:")){ const [k,who,sum]=a.slice(4).split("|"); mbOpen(null, {k, who, sum:String(sum).replace(".",","), done:false, date:""}); return; }
  if(a==="arch"){ mbArch(true); return; }
  if(a==="unarch"){ mbArch(false); return; }
  if(a==="del"){ if(!armed(b,"Точно удалить доску?")) return; mbDel(); return; }
  if(a==="note"){ const r=mbFind(MBU.cur); if(!r) return; const o=mbObj(r), n={id:uid(), t:"", c:o.notes.length%MB_NB.length}; o.notes.push(n); mbSave(r); mbRedraw(); const t=$('[data-mbnote="'+CSS.escape(n.id)+'"]'); if(t){ t.closest(".mbnote").classList.add("born"); t.focus(); } return; }
  if(a==="book"){ PV().dv="book"; saveLocal(); MBU.anim=true; dbDraw(); window.scrollTo({top:0, behavior:"smooth"}); }
}
function mbInput(e){ const t=e.target; if(!t.closest(".mb")) return;
  if(t.id==="mb-title"){ const r=mbFind(MBU.cur); if(!r) return; r.title=t.value; const c=$('.mbchip[data-mbb="'+CSS.escape(r.id)+'"]'); if(c){ const em=c.querySelector("em"); c.textContent=t.value||"Без названия"; if(em) c.appendChild(em); } clearTimeout(mbNT); mbNT=setTimeout(()=>mbSave(r), 600); return; }
  if(t.dataset.mbnote){ mbNoteSet(t.dataset.mbnote, t.value); }
}
function mbKey(e){ if(!e.target.closest || !e.target.closest(".mb")) return;
  if(e.key==="Enter" && e.target.id==="mb-title"){ e.preventDefault(); e.target.blur(); const r=mbFind(MBU.cur); if(r && !mbObj(r).steps.length) mbOpen(null); return; }
  if((e.key==="Enter"||e.key===" ") && (e.target.matches(".mbst")||e.target.matches("[data-mbdebt]")||e.target.matches("[data-mb='book']"))){ e.preventDefault(); e.target.click(); } }
function mbBlur(e){ const t=e.target; if(t.id==="mb-title"){ const r=mbFind(MBU.cur); if(r){ if(!t.value.trim()){ r.title="Без названия"; t.value=r.title; } clearTimeout(mbNT); mbSave(r); } } if(t.dataset && t.dataset.mbnote){ const r=mbFind(MBU.cur); if(r){ clearTimeout(mbNT); mbSave(r); } } }
