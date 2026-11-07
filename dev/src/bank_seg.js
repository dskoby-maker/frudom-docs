/* ================= Поступления из Т-Бизнеса: сайт сам находит, за какие накладные оплата =================
   Сервер (Code.gs ≥ 16, действие `bank`) забирает выписку по токенам T-API и пишет приходы на лист «Поступления (банк)».
   Сайт сопоставляет: ИНН плательщика → заказчик, номера в назначении → накладные / счёт на оплату, сумма → остаток к оплате.
   Точное совпадение — оплата ставится сразу (status auto), сомнение — ждёт подтверждения (wait). */
const BNK = () => (D.bank = D.bank || {ops:[], keys:[], at:"", pend:{}, f:""});
const BN_ST = {new:"Новое", auto:"Разнесено автоматически", done:"Разнесено вручную", wait:"Нужно подтвердить", skip:"Не оплата накладных"};
const bnOk = () => (D.srvVer||0) >= 16;
const bnDigits = s => String(s||"").replace(/\D/g,"");
const bnDocsOf = op => { try{ const a=JSON.parse(op.docs||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } };
const bnInnMap = () => (getPrefs().bnInn || {});
let bnBusy=false;

/* ---------- сопоставление ---------- */
function bnNums(purpose){
  const s=" "+String(purpose||"").replace(/ /g," ")+" ", out=new Set();
  const re=/(?:№|N\s?[°o]?|No\.?|номер\w*|накл\w*|упд|торг[\s\-]?12|сч(?:ет|ёт|\.|ету|ёту)?(?:\s?-?\s?фактур\w*)?|с\/ф|док\w*|тн|тов\.?\s?накл\w*)\s*[.:№N]?\s*((?:\d{1,6}(?:\s*(?:[,;]|и|-|–|по)\s*)?){1,30})/gi;
  let m; while((m=re.exec(s))){ const part=m[1]; const rng=/(\d{1,6})\s*(?:-|–|по)\s*(\d{1,6})/g; let r;
    while((r=rng.exec(part))){ const a=+r[1], b=+r[2]; if(b>a && b-a<=60) for(let i=a;i<=b;i++) out.add(String(i)); }
    (part.match(/\d{1,6}/g)||[]).forEach(x=>out.add(String(+x))); }
  return out;
}
function bnCustomers(op){ const inn=bnDigits(op.payerInn), map=bnInnMap();
  if(!inn) return [];
  if(map[inn]) return [map[inn]];
  return D.customers.filter(c=>bnDigits(c.inn)===inn).map(c=>c.id); }
function bnDue(cids, sid){ return D.journal.filter(j=>j.snap && !isArch(j) && cids.includes(j.customerId) && (!sid || j.supplierId===sid))
  .map(j=>({j, left:payOf(j).left})).filter(x=>x.left>0.004).sort((a,b)=>a.j.date<b.j.date?-1:a.j.date>b.j.date?1:jNumSort(a.j,b.j)); }
/* накладные заказчика с номерами из назначения — любой ИП, в том числе уже оплаченные; left = полная сумма накладной */
function bnRefDocs(cids, nums, sid, withArch){ if(!nums || !nums.size) return [];
  return D.journal.filter(j=>j.snap && (withArch || !isArch(j)) && cids.includes(j.customerId) && nums.has(String(+j.number||j.number)))
    .map(j=>{ const p=payOf(j); return {j, left:p.tot, paid:p.s>0.004, other:!!sid && j.supplierId!==sid}; }).filter(x=>x.left>0.004)
    .sort((a,b)=>a.j.date<b.j.date?-1:a.j.date>b.j.date?1:jNumSort(a.j,b.j)); }
const bnEq = (a,b) => Math.abs(a-b) < 0.005;
const bnSum = L => r2(L.reduce((a,x)=>a+x.left,0));
function bnSubset(L, target){   /* единственный набор накладных с суммой ровно как платёж (до 22 накладных) */
  const T=Math.round(target*100), V=L.map(x=>Math.round(x.left*100)); if(L.length>22) return null; let found=null, n=0;
  const go=(i,acc,pick)=>{ if(n>1) return; if(acc===T){ n++; found=pick.slice(); return; } if(i>=V.length||acc>T) return; pick.push(i); go(i+1,acc+V[i],pick); pick.pop(); go(i+1,acc,pick); };
  go(0,0,[]); return n===1 ? found.map(i=>L[i]) : null; }
function bnMatch(op){
  const sum=+op.sum||0, cids=bnCustomers(op), nums=bnNums(op.purpose);
  if(!cids.length) return {exact:false, cid:"", docs:[], why: op.payerInn ? "Заказчика с ИНН "+op.payerInn+" нет в справочнике" : "В платеже нет ИНН плательщика"};
  const due=bnDue(cids, op.supplierId), all=due.length?due:bnDue(cids,"");
  const pack=(L,why,exact)=>({exact, cid:L[0]?L[0].j.customerId:cids[0], docs:L.map(x=>({id:x.j.id, s:String(r2(x.left))})), why});
  /* 1. номера накладных в назначении */
  const byNum=all.filter(x=>nums.has(String(+x.j.number||x.j.number)));
  if(byNum.length && bnEq(bnSum(byNum),sum)) return pack(byNum,"Номера накладных в назначении платежа и сумма совпали",true);
  /* 1б. те же номера, но накладные уже отмечены оплаченными или у другого ИП — только предложение */
  const ref=bnRefDocs(cids, nums, op.supplierId);
  if(ref.length){ const L=bnEq(bnSum(ref),sum) ? ref : bnSubset(ref,sum);
    if(L && L.length && L.some(x=>x.paid || x.other)){ const pd=L.filter(x=>x.paid), ot=L.filter(x=>x.other);
      return pack(L, "Номера из назначения: "+L.map(x=>"№ "+x.j.number).join(", ")+" — сумма совпала."
        +(pd.length?" Уже отмечены оплаченными: "+pd.map(x=>"№ "+x.j.number).join(", ")+" — при подтверждении платёж просто свяжется с ними, второй раз сумма не добавится.":"")
        +(ot.length?" Другой ИП: "+ot.map(x=>"№ "+x.j.number+" ("+bnSup(x.j.supplierId)+")").join(", ")+".":""), false); } }
  if(!all.length) return {exact:false, cid:cids[0], docs:[], why:"У заказчика нет неоплаченных накладных"};
  if(nums.size && !byNum.length && !ref.length && !(D.invoices||[]).some(r=>cids.includes(r.customerId) && nums.has(String(+r.number||r.number))) && !all.some(x=>bnEq(x.left,sum)))
    return {exact:false, cid:cids[0], docs:[], why:"В назначении № "+[...nums].slice(0,8).join(", ")+" — таких накладных у этого заказчика на сайте нет (может, они в архиве или у другого заказчика). Нажмите «Выбрать накладные…»."};
  /* 2. номер счёта на оплату → его накладные */
  const inv=(D.invoices||[]).filter(r=>cids.includes(r.customerId) && (!op.supplierId||r.supplierId===op.supplierId) && nums.has(String(+r.number||r.number)));
  for(const r of inv){ let d={}; try{ d=JSON.parse(r.data||"{}")||{}; }catch(e){} const ids=new Set(d.docs||[]), L=all.filter(x=>ids.has(x.j.id));
    if(L.length && bnEq(bnSum(L),sum)) return pack(L,"Оплата счёта № "+r.number+": сумма совпала с его накладными",true); }
  /* 3. одна накладная ровно на эту сумму */
  const one=all.filter(x=>bnEq(x.left,sum));
  if(one.length===1 && (!nums.size || !byNum.length || byNum[0]===one[0])) return pack(one,"Одна неоплаченная накладная ровно на эту сумму",true);
  /* дальше — только предложения */
  if(byNum.length){ const s=bnSum(byNum); return pack(byNum, "Номера из назначения: "+byNum.map(x=>"№ "+x.j.number).join(", ")+" — к оплате "+fm(s)+" ₽, пришло "+fm(sum)+" ₽", false); }
  if(one.length>1) return pack([one[0]],"Таких накладных несколько ("+one.map(x=>"№ "+x.j.number).join(", ")+") — предлагаю самую раннюю",false);
  let acc=0; const pre=[]; for(const x of all){ if(acc+x.left>sum+0.004) break; acc=r2(acc+x.left); pre.push(x); if(bnEq(acc,sum)) break; }
  if(pre.length && bnEq(acc,sum)) return pack(pre,"Сумма ровно закрывает самые старые накладные ("+pre.length+")",false);
  const sub=bnSubset(all,sum); if(sub) return pack(sub,"Сумма совпала с набором накладных",false);
  /* частичная оплата: с самой старой */
  let rest=sum; const part=[]; for(const x of all){ if(rest<=0.004) break; const s=r2(Math.min(rest,x.left)); part.push({j:x.j,left:s}); rest=r2(rest-s); }
  const p=pack(part, "Точного совпадения нет — предлагаю закрыть с самой старой"+(rest>0.004?". Лишние "+fm(rest)+" ₽ некуда разнести":""), false); return p;
}

/* ---------- применение ---------- */
function bnApply(op, docs, status){
  const used=[];
  docs.forEach(d=>{ const j=D.journal.find(x=>x.id===d.id); if(!j) return; const p=payOf(j), want=r2(+d.s||0), add=r2(Math.max(0,Math.min(want, p.left))),
      pre=r2(Math.max(0,Math.min(want-add, p.s)));   /* pre — оплата уже стояла раньше, платёж только связывается с ней */
    if(add<=0 && pre<=0) return;
    if(add>0) setPay(j, r2(p.s+add), op.date, true);
    const u={id:j.id, s:String(add), n:String(j.number)}; if(pre>0) u.pre=String(pre); used.push(u); });
  op.status=status; op.docs=JSON.stringify(used); op.statusName=BN_ST[status];
  op.docsText=used.map(u=>"№ "+u.n+" — "+fm(r2(+u.s + +(u.pre||0)))+" ₽"+(+u.pre>0?" (оплата уже стояла)":"")).join("; ");
  if(used.length) logEv("Прибыль", (status==="auto"?"Банк: оплата разнесена автоматически":"Банк: оплата разнесена")+" — "+(op.payerName||"")+", "+fm(+op.sum)+" ₽ от "+fd(op.date)+" → "+op.docsText);
  bnQueue(op); return used.length;
}
function bnUnapply(op){
  bnDocsOf(op).forEach(u=>{ const j=D.journal.find(x=>x.id===u.id); if(!j) return; const p=payOf(j); setPay(j, Math.max(0, r2(p.s-(+u.s||0))), p.d||op.date, true); });
  logEv("Прибыль","Банк: разнесение отменено — "+(op.payerName||"")+", "+fm(+op.sum)+" ₽ от "+fd(op.date)+(op.docsText?" ("+op.docsText+")":""));
  op.status="wait"; op.statusName=BN_ST.wait; op.docs=""; op.docsText=""; bnQueue(op);
}
function bnQueue(op){ BNK().pend[op.id]={id:op.id, status:op.status, statusName:op.statusName, docs:op.docs, docsText:op.docsText}; }
/* приходы вручную (ИП без банка, например Байдаров): строки «man-…» на том же листе, Code.gs ≥ 20 */
const bnManOk = () => (D.srvVer||0) >= 20;
const bnIsMan = o => /^man-/.test(String(o&&o.id||""));
async function bnManPush(){ const B=BNK(), rows=Object.values(B.man||{}), del=B.mdel||[]; if((!rows.length && !del.length) || !online() || !bnManOk()) return false;
  try{ const j=await api({action:"bank", op:"man", rows, del}); if(j && j.ok!==false){ rows.forEach(r=>{ if(B.man[r.id]===r){ delete B.man[r.id]; delete B.pend[r.id]; } }); B.mdel=(B.mdel||[]).filter(x=>!del.includes(x)); if(j.ops){ bnMerge(j.ops); } saveLocal(); return true; } }catch(e){}
  return false; }
async function bnPush(){ await bnManPush(); const B=BNK(), rows=Object.values(B.pend).filter(r=>!(B.man||{})[r.id]); if(!rows.length || !online()) return;
  try{ const j=await api({action:"bank", op:"set", rows}); if(j && j.ok!==false){ rows.forEach(r=>{ if(B.pend[r.id]===r) delete B.pend[r.id]; }); saveLocal(); } }catch(e){} }
function bnAuto(){
  if(!pfLoaded) return 0; let n=0;
  BNK().ops.filter(op=>(op.status==="wait" || op.status==="new" || !op.status) && !bnIsMan(op) && !(getPrefs().bnKeep||{})[op.id] && bnSkipWhy(op)).forEach(op=>{ op.status="skip"; op.statusName=BN_ST.skip; bnQueue(op); });
  BNK().ops.filter(op=>op.status==="new" || !op.status).forEach(op=>{ const m=bnMatch(op);
    if(m.exact && m.docs.length){ if(bnApply(op, m.docs, "auto")) n++; else { op.status="wait"; op.statusName=BN_ST.wait; bnQueue(op); } }
    else { op.status="wait"; op.statusName=BN_ST.wait; bnQueue(op); } });
  return n;
}
function bnMerge(list){ const B=BNK(), del=new Set(B.mdel||[]), L=(list||[]).filter(o=>!del.has(o.id)).map(o=>Object.assign({}, o, (B.man||{})[o.id]||{}, B.pend[o.id]||{}));
  Object.values(B.man||{}).forEach(m=>{ if(!L.some(o=>o.id===m.id)) L.push(Object.assign({}, m, B.pend[m.id]||{})); });   /* ещё не дошли до таблицы */
  B.ops=L.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0); }
/* «Это не оплата накладных» запоминается по ИНН плательщика; переводы от своих ИП — всегда не накладные */
const bnOwnInn = () => new Set(D.suppliers.map(x=>bnDigits(x.inn)).filter(Boolean));
function bnSkipWhy(op){ const inn=bnDigits(op.payerInn); if(!inn) return "";
  if(bnOwnInn().has(inn)) return "Перевод от своего ИП — сайт сам относит такие платежи к «Не накладные»";
  return (getPrefs().bnSkip||{})[inn] ? "Запомнено: платежи от этого плательщика — не оплата накладных" : ""; }
async function bnSync(quiet){
  if(bnBusy || !online() || !bnOk() || !me().admin) return; bnBusy=true; const B=BNK();
  try{
    if(!pfLoaded) await loadProfit(true);
    await bnPush();
    const j=await api({action:"bank", op: B.keys.length ? "sync" : "list"});
    if(!j || j.ok===false) throw new Error(j&&j.error||"нет ответа");
    B.keys=j.keys||[]; if('proxy' in j) B.proxy=j.proxy; bnMerge(j.ops); B.at=new Date().toISOString();
    const n=bnAuto(); saveLocal(); if(Object.keys(B.pend).length) await bnPush();
    if(n){ drawProfit(); toast("ok","Оплаты разнесены автоматически", n+" "+plural(n,["поступление","поступления","поступлений"])+" из банка — смотрите «Прибыль» → «Поступления»."); }
    const w=B.ops.filter(o=>o.status==="wait").length, errs=Object.values(j.errs||{});
    if(!quiet && !n) toast(errs.length?"err":"ok", errs.length?"Банк: ошибка":"Поступления обновлены", errs.length?errs[0]:(j.added?"Новых: "+j.added+". ":"Новых нет. ")+(w?"Ждут подтверждения: "+w:""));
    if(curTab==="profit") pvDraw();
  }catch(e){ if(!quiet) toast("err","Не получилось обновить поступления", e.message||String(e)); }
  finally{ bnBusy=false; }
}
/* сами раз в 10 минут, пока сайт открыт у Даниила */
setInterval(()=>{ if(me().admin && document.visibilityState!=="hidden" && BNK().keys.length) bnSync(true); }, 10*60*1000);
setTimeout(()=>{ if(me().admin && BNK().keys.length) bnSync(true); }, 25000);

/* ---------- раздел «Поступления» ---------- */
const bnSup = sid => supShort(sup(sid).name||"") || "ИП";
const BNV = () => { const B=BNK(); B.v=B.v||{view:"list", sup:"", day:""}; return B.v; };
const bnIsWait = o => o.status==="wait" || o.status==="new" || !o.status;
const bnIsOk = o => o.status==="auto" || o.status==="done";
function pvBankDraw(){
  const box=$("#pv-bank"); if(!box) return; const B=BNK(), V=BNV(), [d1,d2]=pvRange(), mon=pvMonth();
  if(!bnOk()){ box.innerHTML=`<div class="pvhead"><div><h2>Поступления</h2></div></div><div class="pvempty">${pvIco("bank","big")}<b>Нужно обновить скрипт таблицы</b><small>Поступления из Т-Бизнеса заработают после обновления Code.gs (версия 16).</small><button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`; return; }
  if(B.keys.length && (!B.at || Date.now()-new Date(B.at).getTime()>3*60*1000)) setTimeout(()=>bnSync(true), 50);
  else if(!B.keys.length && !B.at && online()) setTimeout(()=>bnSync(true), 50);
  if(V.day && (V.day<d1 || V.day>d2)) V.day="";
  const cal = V.view==="cal" && mon!=="all";
  const inMon=B.ops.filter(o=>o.date>=d1 && o.date<=d2 && (!V.sup || o.supplierId===V.sup)), ops = cal && V.day ? inMon.filter(o=>o.date===V.day) : inMon;
  const cnt={wait:0, ok:0, skip:0, all:ops.length}; ops.forEach(o=>{ if(bnIsWait(o)) cnt.wait++; else if(o.status==="skip") cnt.skip++; else cnt.ok++; });
  let st=B.f || (cnt.wait?"wait":"all"); if(st!=="all" && !cnt[st]) st="all";
  const L=ops.filter(o=>st==="all" || (st==="wait" && bnIsWait(o)) || (st==="ok" && bnIsOk(o)) || (st==="skip" && o.status==="skip"));
  const real=ops.filter(o=>o.status!=="skip"), tot=r2(real.reduce((a,o)=>a+(+o.sum||0),0)), net=r2(real.reduce((a,o)=>a+(+o.sum||0)*(1-taxOf(o.supplierId)/100),0));
  const okSum=r2(ops.filter(bnIsOk).reduce((a,o)=>a+(+o.sum||0),0));
  const keys = B.keys.length ? `<div class="bnkeys">${B.keys.map(k=>`<span class="bnkey ${k.err?"err":""}" title="${esc(k.err||"")}"><i></i>${esc(bnSup(k.supplierId))} · токен …${esc(k.tail)}${k.last?" · обновлено "+esc(new Date(k.last).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})):""}${k.err?" · ошибка":""}</span>`).join("")}</div>` : "";
  const sups=D.suppliers.filter(x=>B.ops.some(o=>o.supplierId===x.id) || B.keys.some(k=>k.supplierId===x.id) || !B.keys.some(k=>k.supplierId===x.id));
  const supChips = sups.length>1 ? `<div class="pfchips bnsups">${[["","Все ИП"]].concat(sups.map(x=>[x.id, bnSup(x.id)])).map(([id,l])=>`<button type="button" data-bnsup="${esc(id)}" class="${V.sup===id?"on":""}" aria-pressed="${V.sup===id}">${esc(l)}${id&&!B.keys.some(k=>k.supplierId===id)?` <small>без банка</small>`:""}</button>`).join("")}</div>` : "";
  const seg=`<div class="fdseg bnvw" role="group" aria-label="Вид"><i style="--x:${cal?"100%":"0%"}"></i><button type="button" data-bnv="list" class="${cal?"":"on"}" aria-pressed="${!cal}">Список</button><button type="button" data-bnv="cal" class="${cal?"on":""}" aria-pressed="${cal}">Календарь</button></div>`;
  const taxNote = V.sup ? String(taxOf(V.sup)).replace(".",",")+"%" : (s=>s.size===1?String([...s][0]).replace(".",",")+"%":"по ставкам ИП")(new Set(real.map(o=>taxOf(o.supplierId))));
  box.innerHTML = `<div class="pvhead"><div><h2>Поступления</h2><small class="muted">Оплаты из Т-Бизнеса и приходы, внесённые вручную, — по накладным</small></div>${pvMonBar()}</div>
    <div class="pvacts"><button type="button" class="btn pri" data-bn="sync" ${B.keys.length?"":"disabled"}>${bnBusy?"Обновляю…":"Обновить из банка"}</button><button type="button" class="btn" data-bn="man">+ Приход вручную</button><span style="flex:1"></span>${seg}<button type="button" class="btn ghost sm" data-bn="keys">${pvIco("gear")}Подключение банка</button></div>
    ${keys}${supChips}
    ${B.keys.length || B.ops.length ? "" : `<div class="bnhello"><span>${pvIco("bank","big")}</span><div><b>Подключите Т-Бизнес</b><p>Сайт будет каждые 10 минут забирать поступления на счёт и сам ставить «Оплачено» у накладных. Для ИП без банка — кнопка «+ Приход вручную».</p><button type="button" class="btn pri" data-bn="keys">Подключить</button></div></div>`}
    ${cal ? bnCalHtml(inMon, mon) : (V.view==="cal" ? `<p class="muted bncalno">Календарь — по месяцам: выберите месяц стрелками сверху.</p>` : "")}
    ${ops.length||B.keys.length||B.ops.length ? `<div class="pvkpi"><div class="pos"><small>Поступило${cal&&V.day?" за "+fd(V.day):""}</small><b>${fm(tot)}</b><span>${real.length} ${plural(real.length,["платёж","платежа","платежей"])} · после налога ${taxNote}: <em class="bnnet">${fm(net)}</em></span></div><div><small>Разнесено по накладным</small><b>${fm(okSum)}</b><span>${cnt.ok} ${plural(cnt.ok,["платёж","платежа","платежей"])}</span></div><div class="${cnt.wait?"bnw":""}"><small>Ждут вашего решения</small><b>${cnt.wait}</b><span>${cnt.wait?"нажмите «Нужно решить»":"всё разнесено"}</span></div></div>
      <div class="pfchips">${[["wait","Нужно решить"],["ok","Разнесено"],["skip","Не накладные"],["all","Все"]].filter(([k])=>k==="all"||cnt[k]).map(([k,l])=>`<button type="button" data-bnf="${k}" class="${st===k?"on":""} c-${k==="wait"?"due":k==="ok"?"paid":"all"}" aria-pressed="${st===k}">${l}<i>${cnt[k]}</i></button>`).join("")}</div>
      <div class="bnlist">${L.length ? L.map((o,i)=>bnCard(o,i)).join("") : `<div class="pvempty">${pvIco("check","big")}<b>${ops.length?"Здесь пусто":cal&&V.day?"В этот день поступлений нет":"За этот месяц поступлений нет"}</b><small>${ops.length?"Выберите другой фильтр.":"Листайте месяцы стрелками сверху."}</small></div>`}</div>` : ""}`;
}
function bnCalHtml(ops, ym){
  const V=BNV(), y=+ym.slice(0,4), m=+ym.slice(5,7), days=new Date(y,m,0).getDate(), first=(new Date(y,m-1,1).getDay()+6)%7, t=todayISO(), by={}, cells=[];
  ops.forEach(o=>{ (by[o.date]=by[o.date]||[]).push(o); });
  for(let i=0;i<first;i++) cells.push(`<span class="zkc-e" aria-hidden="true"></span>`);
  for(let d=1; d<=days; d++){ const iso=ym+"-"+String(d).padStart(2,"0"), I=by[iso]||[], wd=(first+d-1)%7;
    if(!I.length){ cells.push(`<span class="zkc-d empty${iso===t?" today":""}${wd>4?" we":""}"><i>${d}</i></span>`); continue; }
    const R=I.filter(o=>o.status!=="skip"), sum=r2(R.reduce((a,o)=>a+(+o.sum||0),0)), w=I.some(bnIsWait), cls = w ? "part" : R.length ? "ok" : "skip";
    const dots=I.slice(0,8).map(o=>`<b class="${bnIsWait(o)?"part":o.status==="skip"?"skip":"ok"}"></b>`).join("")+(I.length>8?`<em>+${I.length-8}</em>`:"");
    cells.push(`<button type="button" class="zkc-d ${cls}${iso===V.day?" sel":""}${iso===t?" today":""}${wd>4?" we":""}" data-bnday="${iso}" aria-pressed="${iso===V.day}" title="${esc(fd(iso)+": "+I.length+" "+plural(I.length,["платёж","платежа","платежей"])+", +"+fm(sum)+" ₽")}"><i>${d}</i><span class="zkc-s bncs">${sum?"+"+fm(Math.round(sum)).replace(/,00$/,""):"—"}</span><span class="zkc-n">${I.length} ${plural(I.length,["платёж","платежа","платежей"])}</span><span class="zkc-dots">${dots}</span></button>`); }
  const c=k=>ops.filter(k).length;
  return `<div class="bncal"><div class="zkc-h"><span class="zkc-leg"><span><b class="part"></b>нужно решить ${c(bnIsWait)}</span><span><b class="ok"></b>разнесено ${c(bnIsOk)}</span><span><b class="skip"></b>не накладные ${c(o=>o.status==="skip")}</span></span></div>
    <div class="zkc-w">${["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(x=>`<span>${x}</span>`).join("")}</div><div class="zkc-g">${cells.join("")}</div>
    ${V.day?`<p class="zkc-f">Показаны поступления за <b>${fd(V.day)}</b> · <button type="button" class="btn ghost sm" data-bnday="${V.day}">Весь месяц</button></p>`:`<p class="zkc-f muted">Нажмите на день — ниже останутся поступления этого дня.</p>`}</div>`;
}
function bnCard(o, i){
  const st=o.status||"new", applied=bnIsOk(o), wait=bnIsWait(o), used=bnDocsOf(o), man=bnIsMan(o), m=wait&&!man?bnMatch(o):null;
  const ico = applied ? pvIco("check") : st==="skip" ? pvIco("back") : pvIco("question"), cls = applied ? "ok" : st==="skip" ? "skip" : "wait";
  const chip=(u,sug)=>{ const j=D.journal.find(x=>x.id===u.id), v=r2((+u.s||0)+(+u.pre||0)), tot=j?payOf(j).tot:0, part=j && v<tot-0.004;
    return `<button type="button" class="bndoc ${sug?"sug":""}" data-bndoc="${esc(u.id)}">№ ${esc(j?j.number:u.n||"?")}${j?` <small>${fd(j.date).slice(0,5)}</small>`:""} <b>${fm(v)}</b>${part?` <small class="bnpartc">частично из ${fm(tot)}</small>`:""}${+u.pre>0?` <small>уже было оплачено</small>`:""}</button>`; };
  const cname = m&&m.cid ? pvCusName(m.cid) : applied&&used[0] ? (()=>{ const j=D.journal.find(x=>x.id===used[0].id); return j?pvCusName(j.customerId):""; })() : "";
  const skipWhy = st==="skip" ? bnSkipWhy(o) : "", remembered = skipWhy && (getPrefs().bnSkip||{})[bnDigits(o.payerInn)];
  const rest = applied ? r2((+o.sum||0) - used.reduce((a,u)=>a+(+u.s||0)+(+u.pre||0),0)) : 0;
  return `<div class="bnop ${cls}" style="--d:${Math.min(i,12)*30}ms" data-bnop="${esc(o.id)}">
    <span class="bnico">${ico}</span>
    <div class="bnm"><div class="bnt"><b>${esc(o.payerName||"Плательщик не указан")}</b><span class="bnsum">+${fm(+o.sum||0)} ₽</span></div>
      <div class="bns"><span>${fd(o.date)}</span><span>${esc(bnSup(o.supplierId))}</span>${man?`<span class="bnman">вручную</span>`:""}${o.payerInn&&!man?`<span>ИНН ${esc(o.payerInn)}</span>`:""}${cname&&!man?`<span class="bnc">→ ${esc(cname)}</span>`:""}<span class="bnst">${esc(BN_ST[st]||st)}</span></div>
      ${o.purpose?`<p class="bnp" title="${man?"Комментарий":"Назначение платежа"}">${esc(o.purpose)}</p>`:man?"":`<p class="bnp">(без назначения)</p>`}
      ${applied ? `<div class="bndocs">${used.map(u=>chip(u)).join("")}</div>${rest>0.004?`<div class="bnwhy">Не разнесено ${fm(rest)} ₽</div>`:""}` : ""}
      ${wait && m ? `<div class="bnwhy">${esc(m.why)}</div>${m.docs.length?`<div class="bndocs">${m.docs.map(u=>chip(u,true)).join("")}</div>`:""}` : wait ? `<div class="bnwhy">Накладные не выбраны</div>` : ""}
      ${skipWhy ? `<div class="bnwhy bnmem">${esc(skipWhy)}</div>` : ""}
      <div class="bna">${man ? `<button type="button" class="btn ${wait?"pri":"ghost"} sm" data-bn="edit">${wait?"Выбрать накладные…":"Изменить…"}</button><button type="button" class="btn ghost sm danger" data-bn="del">Удалить приход</button>`
        : wait ? `${m.docs.length?`<button type="button" class="btn pri sm" data-bn="ok">${pvIco("check")}Подтвердить</button>`:""}<button type="button" class="btn sm" data-bn="pick">Выбрать накладные…</button><button type="button" class="btn ghost sm" data-bn="skip">Это не оплата накладных</button>`
        : applied ? `<button type="button" class="btn ghost sm" data-bn="pick">Изменить…</button><button type="button" class="btn ghost sm danger" data-bn="undo">Отменить разнесение</button>`
        : `<button type="button" class="btn ghost sm" data-bn="back">Вернуть в «Нужно решить»</button>${remembered?`<button type="button" class="btn ghost sm" data-bn="forget">Не запоминать этого плательщика</button>`:""}`}</div></div></div>`;
}
async function pvBankClick(e){
  const m=e.target.closest("[data-pvm]"); if(m){ pvMonClick(m); return; }
  const f=e.target.closest("[data-bnf]"); if(f){ BNK().f=f.dataset.bnf; saveLocal(); pvBankDraw(); return; }
  const vw=e.target.closest("[data-bnv]"); if(vw){ const V=BNV(); V.view=vw.dataset.bnv; V.day=""; if(V.view==="cal" && pvMonth()==="all"){ PV().m=todayISO().slice(0,7); } saveLocal(); pvDraw(); return; }
  const sp=e.target.closest("[data-bnsup]"); if(sp){ BNV().sup=sp.dataset.bnsup; saveLocal(); pvBankDraw(); return; }
  const dy=e.target.closest("[data-bnday]"); if(dy){ const V=BNV(); V.day = V.day===dy.dataset.bnday ? "" : dy.dataset.bnday; BNK().f="all"; saveLocal(); pvBankDraw(); return; }
  const dj=e.target.closest("[data-bndoc]"); if(dj){ const j=D.journal.find(x=>x.id===dj.dataset.bndoc); if(j) docCard(j); return; }
  const b=e.target.closest("[data-bn]"); if(!b) return; const a=b.dataset.bn;
  if(a==="sync"){ b.disabled=true; b.textContent="Обновляю…"; await bnSync(false); pvBankDraw(); return; }
  if(a==="keys"){ bnKeysOpen(); return; }
  if(a==="man"){ if(!bnManOk()){ toast("err","Нужно обновить скрипт таблицы","Приходы вручную заработают после обновления Code.gs (версия 20) — иначе они не сохранятся в таблицу."); return; } bnPick(null, true); return; }
  const card=b.closest("[data-bnop]"), op=card&&BNK().ops.find(o=>o.id===card.dataset.bnop); if(!op) return;
  if(a==="ok"){ const mm=bnMatch(op); const n=bnApply(op, mm.docs, "done"); saveLocal(); bnPush(); drawProfit(); toast(n?"ok":"err", n?"Оплата разнесена":"Нечего разносить", n?op.docsText:"Накладные уже оплачены."); return; }
  if(a==="skip"){ op.status="skip"; op.statusName=BN_ST.skip; bnQueue(op); const inn=bnDigits(op.payerInn);
    if(inn && !bnCustomers(op).length && !bnOwnInn().has(inn)){   /* не заказчик — запоминаем плательщика */
      const p=getPrefs(); p.bnSkip=Object.assign({}, p.bnSkip||{}, {[inn]: op.payerName||inn}); setPrefs(p,true);
      const more=BNK().ops.filter(o=>o!==op && bnIsWait(o) && bnDigits(o.payerInn)===inn); more.forEach(o=>{ o.status="skip"; o.statusName=BN_ST.skip; bnQueue(o); });
      saveLocal(); bnPush(); pvBankDraw(); toast("ok","Запомнил", "Платежи от «"+(op.payerName||inn)+"» дальше сами пойдут в «Не накладные»."+(more.length?" Ещё убрал сейчас: "+more.length+".":"")); return; }
    saveLocal(); bnPush(); pvBankDraw(); toast("info","Отмечено", bnCustomers(op).length ? "Плательщик — ваш заказчик, поэтому запоминать не стал: следующие его платежи сайт разберёт как обычно." : "Платёж не относится к накладным."); return; }
  if(a==="forget"){ const p=getPrefs(), inn=bnDigits(op.payerInn); if(p.bnSkip) delete p.bnSkip[inn]; setPrefs(p,true); pvBankDraw(); toast("ok","Больше не запоминаю","Следующие платежи от «"+(op.payerName||inn)+"» будут ждать вашего решения. Этот можно вернуть кнопкой «Вернуть в «Нужно решить»»."); return; }
  if(a==="back"){ const p=getPrefs(); p.bnKeep=Object.assign({}, p.bnKeep||{}, {[op.id]:1}); setPrefs(p,true); op.status="wait"; op.statusName=BN_ST.wait; bnQueue(op); saveLocal(); bnPush(); pvBankDraw(); return; }
  if(a==="undo"){ if(!armed(b,"Точно отменить?")) return; bnUnapply(op); saveLocal(); bnPush(); drawProfit(); toast("ok","Разнесение отменено","Накладные снова «не оплачены» на эту сумму."); return; }
  if(a==="edit"){ bnPick(op, true); return; }
  if(a==="del"){ if(!armed(b,"Точно удалить?")) return; bnManDel(op); return; }
  if(a==="pick") bnPick(op);
}
function bnManDel(op){ const B=BNK(), had=bnDocsOf(op).length;
  if(had) bnUnapply(op);
  B.ops=B.ops.filter(o=>o.id!==op.id); if(B.man) delete B.man[op.id]; delete B.pend[op.id]; B.mdel=(B.mdel||[]).concat(op.id);
  logEv("Прибыль","Приход вручную удалён: "+bnSup(op.supplierId)+", "+fm(+op.sum)+" ₽ от "+fd(op.date)+(op.payerName?" — "+op.payerName:""));
  saveLocal(); bnPush(); drawProfit(); toast("ok","Приход удалён", had?"Оплаты по накладным сняты на эту сумму.":""); }

/* ---------- выбрать накладные вручную / приход вручную ---------- */
let BNKP=null;
function bnManSupDefault(){ const B=BNK(), p=getPrefs(); if(p.bnManSup && D.suppliers.some(x=>x.id===p.bnManSup)) return p.bnManSup;
  const s=D.suppliers.find(x=>!B.keys.some(k=>k.supplierId===x.id) && /байдаров/i.test(x.name)) || D.suppliers.find(x=>!B.keys.some(k=>k.supplierId===x.id)) || D.suppliers[0]; return s?s.id:""; }
function bnPick(op, man){
  const isNew=man && !op;
  if(isNew) op={id:"man-"+uid()+uid().slice(0,4), supplierId:bnManSupDefault(), date:todayISO(), sum:"", payerName:"", payerInn:"", purpose:"", status:"wait", statusName:BN_ST.wait, docs:"", docsText:""};
  const m=man?{cid:"", docs:[]}:bnMatch(op), was=bnDocsOf(op);
  const cid = m.cid || (was[0] && (D.journal.find(x=>x.id===was[0].id)||{}).customerId) || (man && op.payerInn ? (D.customers.find(c=>bnDigits(c.inn)===bnDigits(op.payerInn))||{}).id : "") || (man ? (D.customers.find(c=>c.name===op.payerName)||{}).id : "") || "";
  BNKP={op, man:!!man, isNew, cid, sel:new Map((was.length?was:m.docs).map(u=>[u.id, String(r2((+u.s||0)+(+u.pre||0)))])), allSup:false, paid:false, sumTyped: man && !isNew ? String(op.sum||"").replace(".",",") : ""};
  const head = man
    ? `<div class="dc-head"><div><div class="dc-kicker">Приход вручную · для ИП без подключённого банка</div><h3>${isNew?"Новый приход":"Приход "+fd(op.date)+" — "+fm(+op.sum||0)+" ₽"}</h3><div class="dc-sub">Отметьте, за какие накладные пришли деньги. Сумма прихода посчитается сама, если её не вписать.</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
       <div class="bnmf"><label class="f">ИП (на чей счёт пришли)<select id="bnp-s">${opts(D.suppliers, op.supplierId)}</select></label><label class="f">Дата прихода<input type="date" id="bnp-d" value="${esc(op.date)}"></label>
         <label class="f">Сумма прихода, ₽<input id="bnp-sum" inputmode="decimal" placeholder="= сумма отмеченных" value="${esc(BNKP.sumTyped)}"></label><label class="f bnmf-w">Комментарий (необязательно)<input id="bnp-n" value="${esc(op.purpose||"")}" placeholder="например: оплата за октябрь"></label></div>`
    : `<div class="dc-head"><div><div class="dc-kicker">Поступление ${fd(op.date)} · ${esc(bnSup(op.supplierId))}</div><h3>+${fm(+op.sum||0)} ₽ — ${esc(op.payerName||"")}</h3><div class="dc-sub">${esc(op.purpose||"")}</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>`;
  openCard(`${head}
    <div class="bnpk"><label class="f">Заказчик<select id="bnp-c"><option value="">— выберите —</option>${opts(D.customers, cid)}</select></label>
      ${!man && op.payerInn?`<label class="chk"><input type="checkbox" id="bnp-rem" ${bnInnMap()[bnDigits(op.payerInn)]?"checked":""}> запомнить: ИНН ${esc(op.payerInn)} — это этот заказчик</label>`:""}
      <label class="chk"><input type="checkbox" id="bnp-all"> показать накладные всех ИП</label>
      <label class="chk"><input type="checkbox" id="bnp-paid"> показать и уже оплаченные накладные</label>
      <p class="muted bnpnote">Частичная оплата: отметьте накладную и впишите справа, сколько из неё оплачено — остаток долга останется на накладной.</p>
      <div id="bnp-l"></div><div class="bnpt" id="bnp-t"></div>
      <div class="pvea"><button type="button" class="btn pri" data-bnp="save">${man?"Сохранить приход":"Разнести"}</button><button type="button" class="btn ghost" data-dc="close">Отмена</button></div></div>`, true, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("bnp-d");
  d.addEventListener("change", e=>{ const t=e.target;
    if(t.id==="bnp-c"){ BNKP.cid=t.value; BNKP.sel=new Map(); bnPickDraw(); }
    else if(t.id==="bnp-s"){ BNKP.op.supplierId=t.value; BNKP.sel=new Map(); bnPickDraw(); }
    else if(t.id==="bnp-all"){ BNKP.allSup=t.checked; bnPickDraw(); } else if(t.id==="bnp-paid"){ BNKP.paid=t.checked; bnPickDraw(); }
    else if(t.matches(".bnpc")){ const id=t.dataset.id, row=t.closest(".bnpr");
      if(t.checked){ const left=+row.dataset.left||0, cap=bnPickCap(), others=r2([...BNKP.sel.values()].reduce((a,v)=>a+(+num(v)||0),0)); let v=left;
        if(cap>0){ const rem=r2(cap-others); if(rem>0.004 && rem<left-0.004) v=rem; }   /* платёж меньше накладной — сразу частичная оплата на остаток платежа */
        BNKP.sel.set(id, String(v)); row.querySelector(".bnps").value=String(v).replace(".",","); }
      else BNKP.sel.delete(id); bnPickDraw(true); } });
  d.addEventListener("input", e=>{ const t=e.target;
    if(t.matches(".bnps")){ const id=t.dataset.id; BNKP.sel.set(id, t.value); const c=t.closest(".bnpr").querySelector(".bnpc"); c.checked=true; t.closest(".bnpr").classList.add("on"); bnPickTotal(); }
    else if(t.id==="bnp-sum"){ BNKP.sumTyped=t.value; bnPickTotal(); } });
  d.addEventListener("click", e=>{ const b=e.target.closest("[data-bnp]"); if(b) bnPickSave(); });
  bnPickDraw();
}
const bnPickCap = () => BNKP.man ? (+num(BNKP.sumTyped)||0) : (+BNKP.op.sum||0);
function bnPickDraw(keepRows){
  const box=$("#bnp-l"); if(!box) return; const op=BNKP.op;
  if(!keepRows){ const cid=BNKP.cid, sid=BNKP.allSup?"":op.supplierId, seen=new Set(), L=[];
    const add=(j,tag)=>{ if(!j || seen.has(j.id)) return; seen.add(j.id); const p=payOf(j); if(p.tot<=0.004) return; L.push({j, p, tag}); };
    if(cid){
      [...BNKP.sel.keys()].forEach(id=>add(D.journal.find(x=>x.id===id), ""));
      if(!BNKP.man) bnRefDocs([cid], bnNums(op.purpose), "", true).forEach(x=>add(x.j, "из назначения"));   /* номера из назначения — всегда, любой ИП и статус */
      bnDue([cid], sid).forEach(x=>add(x.j, ""));
      if(BNKP.paid) D.journal.filter(j=>j.snap && !isArch(j) && j.customerId===cid && (!sid || j.supplierId===sid) && payOf(j).left<=0.004)
        .sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0).slice(0,40).forEach(j=>add(j, ""));
    }
    const hasPaid=L.some(x=>x.p.s>0.004);
    box.innerHTML = !cid ? `<p class="muted">Выберите заказчика — покажу его неоплаченные накладные.</p>` : L.length ? `${hasPaid?`<p class="muted bnpnote">Если отметить накладную, которая уже отмечена оплаченной, сайт просто свяжет с ней этот платёж — второй раз сумма не добавится.</p>`:""}<div class="bnpl">${L.map(x=>{ const on=BNKP.sel.has(x.j.id), p=x.p, def=p.left>0.004?p.left:p.tot;
        const tags=[x.tag, isArch(x.j)?"в архиве":"", op.supplierId && x.j.supplierId!==op.supplierId?"другой ИП":""].filter(Boolean);
        const due = p.left<=0.004 ? `<span class="bnpd paid">уже оплачена ${fm(p.tot)}</span>` : p.s>0.004 ? `<span class="bnpd">к оплате ${fm(p.left)} из ${fm(p.tot)}</span>` : `<span class="bnpd">к оплате ${fm(p.left)}</span>`;
        return `<label class="bnpr ${on?"on":""}" data-left="${r2(def)}"><input type="checkbox" class="bnpc" data-id="${x.j.id}" ${on?"checked":""}><span class="bnpn"><b>№ ${esc(x.j.number)}</b> <small>${fd(x.j.date)} · ${esc(bnSup(x.j.supplierId))}${tags.length?" · "+esc(tags.join(", ")):""}</small><em class="bnpart"></em></span>${due}<input class="bnps" data-id="${x.j.id}" inputmode="decimal" aria-label="Сколько оплачено по накладной № ${esc(x.j.number)}" value="${esc(String(on?BNKP.sel.get(x.j.id):r2(def)).replace(".",","))}"></label>`; }).join("")}</div>` : `<p class="muted">У заказчика нет неоплаченных накладных${BNKP.allSup?"":" у этого ИП — отметьте «показать накладные всех ИП»"}. Уже оплаченные — отметьте «показать и уже оплаченные накладные».</p>`;
  } else box.querySelectorAll(".bnpr").forEach(r=>r.classList.toggle("on", r.querySelector(".bnpc").checked));
  bnPickTotal();
}
function bnPickTotal(){ const t=$("#bnp-t"); if(!t) return; const s=r2([...BNKP.sel.values()].reduce((a,v)=>a+(+num(v)||0),0));
  document.querySelectorAll("#bnp-l .bnpr").forEach(r=>{ const id=r.querySelector(".bnpc").dataset.id, e=r.querySelector(".bnpart"); if(!e) return;
    const j=D.journal.find(x=>x.id===id), p=j?payOf(j):null, v=BNKP.sel.has(id)?(+num(BNKP.sel.get(id))||0):0;
    e.textContent = p && v>0.004 && p.left>0.004 && v<p.left-0.004 ? "частичная оплата — останется долг "+fm(r2(p.left-v))+" ₽" : ""; });
  if(BNKP.man && !(+num(BNKP.sumTyped)>0)){ t.classList.toggle("ok", s>0); t.innerHTML=`<span>Сумма прихода <b>${fm(s)}</b> ₽ <small class="muted">— по отмеченным накладным</small></span>`; return; }
  const sum=bnPickCap(), rest=r2(sum-s);
  t.innerHTML=`<span>Выбрано <b>${fm(s)}</b> из <b>${fm(sum)}</b> ₽</span>${bnEq(rest,0)?`<em class="ok">ровно</em>`:rest>0?`<em>не разнесено ${fm(rest)} ₽</em>`:`<em class="bad">больше платежа на ${fm(-rest)} ₽</em>`}`;
  t.classList.toggle("ok", bnEq(rest,0)); }
function bnPickSave(){
  const op=BNKP.op, docs=[...BNKP.sel.entries()].map(([id,s])=>({id, s:String(r2(+num(s)||0))})).filter(x=>+x.s>0), s=r2(docs.reduce((a,x)=>a+ +x.s,0));
  if(BNKP.man) return bnManSave(docs, s);
  if(!docs.length){ toast("err","Отметьте накладные",""); return; }
  if(s>(+op.sum||0)+0.004){ toast("err","Больше суммы платежа","Выбрано "+fm(s)+" ₽, а пришло "+fm(+op.sum)+" ₽."); return; }
  const rem=$("#bnp-rem"); if(rem && op.payerInn){ const p=getPrefs(); p.bnInn=p.bnInn||{}; const k=bnDigits(op.payerInn); if(rem.checked && BNKP.cid) p.bnInn[k]=BNKP.cid; else delete p.bnInn[k]; setPrefs(p,true); }
  if(op.status==="auto"||op.status==="done") bnUnapply(op);
  const n=bnApply(op, docs, "done"); saveLocal(); bnPush(); pvCloseCard(); drawProfit(); toast("ok","Оплата разнесена", n+" "+plural(n,["накладная","накладные","накладных"])+": "+op.docsText);
}
function bnManSave(docs, s){
  const B=BNK(), op=BNKP.op, typed=+num(BNKP.sumTyped)||0, sum=typed>0?r2(typed):s, date=($("#bnp-d")||{}).value||todayISO(), c=D.customers.find(x=>x.id===BNKP.cid);
  if(!c){ toast("err","Выберите заказчика","От кого пришли деньги."); return; }
  if(sum<=0){ toast("err","Нет суммы","Отметьте накладные или впишите сумму прихода."); return; }
  if(s>sum+0.004){ toast("err","Больше суммы прихода","Отмечено "+fm(s)+" ₽, а приход "+fm(sum)+" ₽."); return; }
  if(bnDocsOf(op).length) bnUnapply(op);
  Object.assign(op, {date, sum:String(sum), payerName:c.name||"", payerInn:c.inn||"", purpose:(($("#bnp-n")||{}).value||"").trim(), supplierName:sup(op.supplierId).name||"", account:"вручную", opId:""});
  if(docs.length) bnApply(op, docs, "done"); else { op.status="wait"; op.statusName=BN_ST.wait; op.docs=""; op.docsText=""; }
  if(!B.ops.some(o=>o.id===op.id)) B.ops.unshift(op);
  B.ops.sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0);
  B.man=B.man||{}; B.man[op.id]={id:op.id, date:op.date, supplierId:op.supplierId, sum:op.sum, payerName:op.payerName, payerInn:op.payerInn, purpose:op.purpose, status:op.status, statusName:op.statusName, docs:op.docs, docsText:op.docsText};
  const p=getPrefs(); if(p.bnManSup!==op.supplierId){ p.bnManSup=op.supplierId; setPrefs(p,true); }
  logEv("Прибыль",(BNKP.isNew?"Приход вручную":"Приход вручную изменён")+": "+bnSup(op.supplierId)+", "+fm(sum)+" ₽ от "+fd(date)+" — "+op.payerName+(op.docsText?" → "+op.docsText:""));
  saveLocal(); bnPush(); pvCloseCard(); drawProfit();
  toast("ok", BNKP.isNew?"Приход записан":"Приход изменён", op.docsText || "Накладные не отмечены — приход ждёт в «Нужно решить».");
}

/* ---------- подключение банка ---------- */
function bnKeysOpen(){
  const B=BNK(), has=sid=>B.keys.find(k=>k.supplierId===sid);
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Т-Бизнес</div><h3>Подключение банка</h3><div class="dc-sub">Токен даёт сайту только чтение выписки — платить по нему нельзя.</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    ${bnProxyHtml()}
    <details class="bnhow"><summary>Как получить токен (2 минуты)</summary><ol>
      <li>Откройте <b>business.tbank.ru</b> под нужным ИП → «Интеграции» → <b>T-API</b> → «Выпустить токен».</li>
      <li>Доступы: отметьте только <b>«Счета и выписки»</b> (информация о счетах и операциях). Больше ничего не нужно.</li>
      <li>Ограничение по IP-адресам <b>не ставьте</b> — запросы идут через посредника в Яндекс Облаке, у него меняются адреса.</li>
      <li>Скопируйте токен и вставьте ниже у этого ИП → «Подключить». Токен действует, пока им пользуются (90 дней с последнего запроса).</li></ol></details>
    <div class="bnkl">${D.suppliers.map(s=>{ const k=has(s.id); return `<div class="bnkr ${k?"on":""}" data-sid="${esc(s.id)}"><div class="bnkn"><b>${esc(s.name)}</b>${k?`<small>${k.err?`<span class="neg">Ошибка: ${esc(k.err)}</span>`:`подключено · токен …${esc(k.tail)} · счета ${esc((k.acc||[]).join(", "))}`}</small>`:`<small class="muted">не подключено${/Байдаров/i.test(s.name)?" — оплаты отмечаются вручную":""}</small>`}</div>
      <div class="bnki"><input class="bntok" placeholder="${k?"новый токен (если нужно заменить)":"вставьте токен T-API"}" autocomplete="off" spellcheck="false"><button type="button" class="btn ${k?"":"pri"} sm" data-bnk="key">${k?"Заменить":"Подключить"}</button>${k?`<button type="button" class="btn ghost sm danger" data-bnk="del">Отключить</button>`:""}</div></div>`; }).join("")}</div>`, true, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("bnk-d");
  d.addEventListener("click", bnProxyClick);
  d.addEventListener("click", async e=>{ const b=e.target.closest("[data-bnk]"); if(!b) return; const row=b.closest("[data-sid]"), sid=row.dataset.sid;
    if(b.dataset.bnk==="del"){ if(!armed(b,"Точно отключить?")) return; try{ const j=await api({action:"bank", op:"delKey", supplierId:sid}); if(j.ok===false) throw new Error(j.error); BNK().keys=j.keys||[]; if('proxy' in j) BNK().proxy=j.proxy; saveLocal(); logEv("Данные","Банк: отключён Т-Бизнес у «"+(sup(sid).name||"")+"»"); bnKeysOpen(); pvDraw(); }catch(x){ toast("err","Не получилось",x.message); } return; }
    const tok=row.querySelector(".bntok").value.trim(); if(tok.length<20){ toast("err","Вставьте токен","Скопируйте его в Т-Бизнесе → Интеграции → T-API."); row.querySelector(".bntok").focus(); return; }
    b.disabled=true; b.textContent="Проверяю в банке…";
    try{ const j=await api({action:"bank", op:"key", supplierId:sid, token:tok}); if(!j || j.ok===false) throw new Error(j&&j.error||"нет ответа");
      const B=BNK(); B.keys=j.keys||[]; if('proxy' in j) B.proxy=j.proxy; bnMerge(j.ops); B.at=new Date().toISOString(); const n=bnAuto(); saveLocal(); bnPush();
      logEv("Данные","Банк: подключён Т-Бизнес у «"+(sup(sid).name||"")+"»");
      toast("ok","Т-Бизнес подключён", (j.added?"Загружено поступлений: "+j.added+". ":"")+(n?"Сразу разнесено: "+n+".":"")); bnKeysOpen(); drawProfit();
    }catch(x){ b.disabled=false; b.textContent="Подключить"; toast("err","Банк не подключился", x.message||String(x)); } });
}

/* ---------- посредник в России (Яндекс Облако): Google до Т-Бизнеса не достаёт ---------- */
const BN_PROXY_CODE = /*__TBPROXY__*/"";
function bnSecret(){ const B=BNK(); if(!B.pxSecret){ const a=new Uint8Array(24); (window.crypto||{}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_,i)=>a[i]=Math.random()*256|0); B.pxSecret=[...a].map(x=>"abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x%55]).join(""); saveLocal(); } return B.pxSecret; }
function bnProxyHtml(){
  const B=BNK(), px=B.proxy, old=(D.srvVer||0)<17, open=!px||B.pxEdit;
  if(px && !B.pxEdit) return `<div class="bnpx on"><div class="bnpxh">${pvIco("check")}<div><b>Посредник в России подключён</b><small>Яндекс Облако · …${esc(String(px.url).slice(-10))} · секрет …${esc(px.tail||"")}</small></div><span style="flex:1"></span><button type="button" class="btn ghost sm" data-bnx="edit">Изменить</button><button type="button" class="btn ghost sm danger" data-bnx="off">Убрать</button></div></div>`;
  return `<div class="bnpx"><div class="bnpxh">${pvIco("bank")}<div><b>Шаг 1. Посредник в России</b><small>Т-Банк не отвечает серверам Google («Ошибка SSL»). Маленькая функция в Яндекс Облаке будет передавать запросы. Она только читает выписку и ничего не хранит. Делается один раз, примерно 15 минут, стоит копейки.</small></div></div>
    ${old?`<p class="note">Сначала обновите скрипт таблицы (Code.gs, версия 17). <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></p>`:""}
    <ol class="bnsteps">
      <li>Откройте <a href="https://console.yandex.cloud" target="_blank" rel="noopener"><b>console.yandex.cloud</b></a>, войдите через Яндекс ID. Если просят — создайте <b>платёжный аккаунт</b> (карта; для новых даётся стартовый грант, а эта функция укладывается в бесплатный объём).</li>
      <li>Слева «Все сервисы» → <b>Cloud Functions</b> → «Создать функцию». Имя: <code>tbank-proxy</code> → «Создать».</li>
      <li>Среда выполнения: <b>Node.js 22</b> (снимите галочку «Добавить файлы с примерами кода»). Способ: <b>Редактор кода</b> → «Создать файл» <code>index.js</code> → вставьте код: <button type="button" class="btn sm" data-bnx="copy">Скопировать код</button></li>
      <li>Ниже: точка входа <code>index.handler</code>, таймаут <b>30</b> секунд, память <b>128 МБ</b>. «Переменные окружения» → «Добавить»: ключ <code>SECRET</code>, значение — этот секрет: <span class="bnsec"><code id="bnx-sec">${esc(bnSecret())}</code><button type="button" class="btn sm" data-bnx="copysec">Скопировать</button></span> → <b>«Сохранить изменения»</b>.</li>
      <li>Вкладка «Обзор» функции → включите <b>«Публичная функция»</b> → скопируйте <b>«Ссылку для вызова»</b> (https://functions.yandexcloud.net/…) и вставьте ниже.</li></ol>
    <div class="bnki"><input id="bnx-url" placeholder="https://functions.yandexcloud.net/…" value="${esc(px?px.url:"")}" autocomplete="off" spellcheck="false"><input id="bnx-key" placeholder="секрет" value="${esc(bnSecret())}" autocomplete="off" spellcheck="false"><button type="button" class="btn pri sm" data-bnx="save" ${old?"disabled":""}>Сохранить и проверить</button>${B.pxEdit?`<button type="button" class="btn ghost sm" data-bnx="cancel">Отмена</button>`:""}</div>
    <p class="muted bnpxn">Шаг 2 — токены ниже. Подключать токен лучше после посредника.</p></div>`;
}
async function bnProxyClick(e){
  const b=e.target.closest("[data-bnx]"); if(!b) return; const a=b.dataset.bnx, B=BNK();
  const copy=(t,what)=>{ (navigator.clipboard&&navigator.clipboard.writeText ? navigator.clipboard.writeText(t) : Promise.reject()).then(()=>toast("ok","Скопировано",what)).catch(()=>{ const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); toast("ok","Скопировано",what); }catch(x){} ta.remove(); }); };
  if(a==="copy"){ copy(BN_PROXY_CODE,"Код функции — вставьте его в index.js в Яндекс Облаке."); return; }
  if(a==="copysec"){ copy(bnSecret(),"Секрет — вставьте его как значение SECRET."); return; }
  if(a==="edit"){ B.pxEdit=true; bnKeysOpen(); return; }
  if(a==="cancel"){ B.pxEdit=false; bnKeysOpen(); return; }
  if(a==="off"){ if(!armed(b,"Точно убрать?")) return; try{ const j=await api({action:"bank", op:"proxy", url:""}); if(!j||j.ok===false) throw new Error(j&&j.error||"нет ответа"); B.proxy=null; saveLocal(); bnKeysOpen(); }catch(x){ toast("err","Не получилось",x.message); } return; }
  if(a==="save"){ const url=$("#bnx-url").value.trim(), key=$("#bnx-key").value.trim();
    if(!/^https:\/\//.test(url)){ toast("err","Вставьте ссылку","«Ссылка для вызова» из обзора функции в Яндекс Облаке."); $("#bnx-url").focus(); return; }
    b.disabled=true; b.textContent="Проверяю…";
    try{ const j=await api({action:"bank", op:"proxy", url, secret:key}); if(!j||j.ok===false) throw new Error(j&&j.error||"нет ответа");
      B.proxy=j.proxy; B.pxEdit=false; B.pxSecret=key; saveLocal(); logEv("Данные","Банк: подключён посредник в Яндекс Облаке");
      toast("ok","Посредник работает","Банк отвечает через Яндекс Облако. Теперь подключите токены ниже."); bnKeysOpen();
      if(B.keys.length) bnSync(true);
    }catch(x){ b.disabled=false; b.textContent="Сохранить и проверить"; toast("err","Посредник не подключился", x.message||String(x)); } }
}
