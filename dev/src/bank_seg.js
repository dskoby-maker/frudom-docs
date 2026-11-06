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
  if(!all.length) return {exact:false, cid:cids[0], docs:[], why:"У заказчика нет неоплаченных накладных"};
  /* 1. номера накладных в назначении */
  const byNum=all.filter(x=>nums.has(String(+x.j.number||x.j.number)));
  if(byNum.length && bnEq(bnSum(byNum),sum)) return pack(byNum,"Номера накладных в назначении платежа и сумма совпали",true);
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
  docs.forEach(d=>{ const j=D.journal.find(x=>x.id===d.id); if(!j) return; const p=payOf(j), add=r2(Math.min(+d.s||0, p.left)); if(add<=0) return;
    setPay(j, r2(p.s+add), op.date, true); used.push({id:j.id, s:String(add), n:String(j.number)}); });
  op.status=status; op.docs=JSON.stringify(used); op.statusName=BN_ST[status];
  op.docsText=used.map(u=>"№ "+u.n+" — "+fm(+u.s)+" ₽").join("; ");
  if(used.length) logEv("Прибыль", (status==="auto"?"Банк: оплата разнесена автоматически":"Банк: оплата разнесена")+" — "+(op.payerName||"")+", "+fm(+op.sum)+" ₽ от "+fd(op.date)+" → "+op.docsText);
  bnQueue(op); return used.length;
}
function bnUnapply(op){
  bnDocsOf(op).forEach(u=>{ const j=D.journal.find(x=>x.id===u.id); if(!j) return; const p=payOf(j); setPay(j, Math.max(0, r2(p.s-(+u.s||0))), p.d||op.date, true); });
  logEv("Прибыль","Банк: разнесение отменено — "+(op.payerName||"")+", "+fm(+op.sum)+" ₽ от "+fd(op.date)+(op.docsText?" ("+op.docsText+")":""));
  op.status="wait"; op.statusName=BN_ST.wait; op.docs=""; op.docsText=""; bnQueue(op);
}
function bnQueue(op){ BNK().pend[op.id]={id:op.id, status:op.status, statusName:op.statusName, docs:op.docs, docsText:op.docsText}; }
async function bnPush(){ const B=BNK(), rows=Object.values(B.pend); if(!rows.length || !online()) return;
  try{ const j=await api({action:"bank", op:"set", rows}); if(j && j.ok!==false){ rows.forEach(r=>{ if(B.pend[r.id]===r) delete B.pend[r.id]; }); saveLocal(); } }catch(e){} }
function bnAuto(){
  if(!pfLoaded) return 0; let n=0;
  BNK().ops.filter(op=>op.status==="new" || !op.status).forEach(op=>{ const m=bnMatch(op);
    if(m.exact && m.docs.length){ if(bnApply(op, m.docs, "auto")) n++; else { op.status="wait"; op.statusName=BN_ST.wait; bnQueue(op); } }
    else { op.status="wait"; op.statusName=BN_ST.wait; bnQueue(op); } });
  return n;
}
function bnMerge(list){ const B=BNK(); B.ops=(list||[]).map(o=>Object.assign({}, o, B.pend[o.id]||{})).sort((a,b)=>a.date<b.date?1:a.date>b.date?-1:0); }
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
function pvBankDraw(){
  const box=$("#pv-bank"); if(!box) return; const B=BNK(), f=PV(), [d1,d2]=pvRange();
  if(!bnOk()){ box.innerHTML=`<div class="pvhead"><div><h2>Поступления</h2></div></div><div class="pvempty">${pvIco("bank","big")}<b>Нужно обновить скрипт таблицы</b><small>Поступления из Т-Бизнеса заработают после обновления Code.gs (версия 16).</small><button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`; return; }
  if(B.keys.length && (!B.at || Date.now()-new Date(B.at).getTime()>3*60*1000)) setTimeout(()=>bnSync(true), 50);
  const ops=B.ops.filter(o=>o.date>=d1 && o.date<=d2), cnt={wait:0, ok:0, skip:0, all:ops.length};
  ops.forEach(o=>{ if(o.status==="wait"||o.status==="new"||!o.status) cnt.wait++; else if(o.status==="skip") cnt.skip++; else cnt.ok++; });
  let st=B.f || (cnt.wait?"wait":"all"); if(st!=="all" && !cnt[st]) st="all";
  const L=ops.filter(o=>st==="all" || (st==="wait" && (o.status==="wait"||o.status==="new"||!o.status)) || (st==="ok" && (o.status==="auto"||o.status==="done")) || (st==="skip" && o.status==="skip"));
  const tot=r2(ops.reduce((a,o)=>a+(+o.sum||0),0)), okSum=r2(ops.filter(o=>o.status==="auto"||o.status==="done").reduce((a,o)=>a+(+o.sum||0),0));
  const keys = B.keys.length ? `<div class="bnkeys">${B.keys.map(k=>`<span class="bnkey ${k.err?"err":""}" title="${esc(k.err||"")}"><i></i>${esc(bnSup(k.supplierId))} · токен …${esc(k.tail)}${k.last?" · обновлено "+esc(new Date(k.last).toLocaleString("ru-RU",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})):""}${k.err?" · ошибка":""}</span>`).join("")}</div>` : "";
  box.innerHTML = `<div class="pvhead"><div><h2>Поступления</h2><small class="muted">Оплаты из Т-Бизнеса — сайт сам находит, за какие накладные пришли деньги</small></div>${pvMonBar()}</div>
    <div class="pvacts"><button type="button" class="btn pri" data-bn="sync" ${B.keys.length?"":"disabled"}>${bnBusy?"Обновляю…":"Обновить из банка"}</button><span style="flex:1"></span><button type="button" class="btn ghost sm" data-bn="keys">${pvIco("gear")}Подключение банка</button></div>
    ${keys}
    ${B.keys.length ? "" : `<div class="bnhello"><span>${pvIco("bank","big")}</span><div><b>Подключите Т-Бизнес</b><p>Сайт будет каждые 10 минут забирать поступления на счёт и сам ставить «Оплачено» у накладных. Нужен токен T-API (только чтение выписки) для ИП Суховерховой и ИП Скобёлкина.</p><button type="button" class="btn pri" data-bn="keys">Подключить</button></div></div>`}
    ${ops.length||B.keys.length ? `<div class="pvkpi"><div class="pos"><small>Поступило</small><b>${fm(tot)}</b><span>${ops.length} ${plural(ops.length,["платёж","платежа","платежей"])}</span></div><div><small>Разнесено по накладным</small><b>${fm(okSum)}</b><span>${cnt.ok} ${plural(cnt.ok,["платёж","платежа","платежей"])}</span></div><div class="${cnt.wait?"bnw":""}"><small>Ждут вашего решения</small><b>${cnt.wait}</b><span>${cnt.wait?"нажмите «Нужно решить»":"всё разнесено"}</span></div></div>
      <div class="pfchips">${[["wait","Нужно решить"],["ok","Разнесено"],["skip","Не накладные"],["all","Все"]].filter(([k])=>k==="all"||cnt[k]).map(([k,l])=>`<button type="button" data-bnf="${k}" class="${st===k?"on":""} c-${k==="wait"?"due":k==="ok"?"paid":"all"}" aria-pressed="${st===k}">${l}<i>${cnt[k]}</i></button>`).join("")}</div>
      <div class="bnlist">${L.length ? L.map((o,i)=>bnCard(o,i)).join("") : `<div class="pvempty">${pvIco("check","big")}<b>${ops.length?"Здесь пусто":"За этот месяц поступлений нет"}</b><small>${ops.length?"Выберите другой фильтр.":"Листайте месяцы стрелками сверху."}</small></div>`}</div>` : ""}`;
}
function bnCard(o, i){
  const st=o.status||"new", applied=st==="auto"||st==="done", wait=st==="wait"||st==="new", used=bnDocsOf(o), m=wait?bnMatch(o):null;
  const ico = applied ? pvIco("check") : st==="skip" ? pvIco("back") : pvIco("question"), cls = applied ? "ok" : st==="skip" ? "skip" : "wait";
  const chip=(u,sug)=>{ const j=D.journal.find(x=>x.id===u.id); return `<button type="button" class="bndoc ${sug?"sug":""}" data-bndoc="${esc(u.id)}">№ ${esc(j?j.number:u.n||"?")}${j?` <small>${fd(j.date).slice(0,5)}</small>`:""} <b>${fm(+u.s||0)}</b></button>`; };
  const cname = m&&m.cid ? pvCusName(m.cid) : applied&&used[0] ? (()=>{ const j=D.journal.find(x=>x.id===used[0].id); return j?pvCusName(j.customerId):""; })() : "";
  return `<div class="bnop ${cls}" style="--d:${Math.min(i,12)*30}ms" data-bnop="${esc(o.id)}">
    <span class="bnico">${ico}</span>
    <div class="bnm"><div class="bnt"><b>${esc(o.payerName||"Плательщик не указан")}</b><span class="bnsum">+${fm(+o.sum||0)} ₽</span></div>
      <div class="bns"><span>${fd(o.date)}</span><span>${esc(bnSup(o.supplierId))}</span>${o.payerInn?`<span>ИНН ${esc(o.payerInn)}</span>`:""}${cname?`<span class="bnc">→ ${esc(cname)}</span>`:""}<span class="bnst">${esc(BN_ST[st]||st)}</span></div>
      <p class="bnp" title="Назначение платежа">${esc(o.purpose||"(без назначения)")}</p>
      ${applied ? `<div class="bndocs">${used.map(u=>chip(u)).join("")}</div>` : ""}
      ${wait ? `<div class="bnwhy">${esc(m.why)}</div>${m.docs.length?`<div class="bndocs">${m.docs.map(u=>chip(u,true)).join("")}</div>`:""}` : ""}
      <div class="bna">${wait ? `${m.docs.length?`<button type="button" class="btn pri sm" data-bn="ok">${pvIco("check")}Подтвердить</button>`:""}<button type="button" class="btn sm" data-bn="pick">Выбрать накладные…</button><button type="button" class="btn ghost sm" data-bn="skip">Это не оплата накладных</button>`
        : applied ? `<button type="button" class="btn ghost sm" data-bn="pick">Изменить…</button><button type="button" class="btn ghost sm danger" data-bn="undo">Отменить разнесение</button>`
        : `<button type="button" class="btn ghost sm" data-bn="back">Вернуть в «Нужно решить»</button>`}</div></div></div>`;
}
async function pvBankClick(e){
  const m=e.target.closest("[data-pvm]"); if(m){ pvMonClick(m); return; }
  const f=e.target.closest("[data-bnf]"); if(f){ BNK().f=f.dataset.bnf; saveLocal(); pvBankDraw(); return; }
  const dj=e.target.closest("[data-bndoc]"); if(dj){ const j=D.journal.find(x=>x.id===dj.dataset.bndoc); if(j) docCard(j); return; }
  const b=e.target.closest("[data-bn]"); if(!b) return; const a=b.dataset.bn;
  if(a==="sync"){ b.disabled=true; b.textContent="Обновляю…"; await bnSync(false); pvBankDraw(); return; }
  if(a==="keys"){ bnKeysOpen(); return; }
  const card=b.closest("[data-bnop]"), op=card&&BNK().ops.find(o=>o.id===card.dataset.bnop); if(!op) return;
  if(a==="ok"){ const mm=bnMatch(op); const n=bnApply(op, mm.docs, "done"); saveLocal(); bnPush(); drawProfit(); toast(n?"ok":"err", n?"Оплата разнесена":"Нечего разносить", n?op.docsText:"Накладные уже оплачены."); return; }
  if(a==="skip"){ op.status="skip"; op.statusName=BN_ST.skip; bnQueue(op); saveLocal(); bnPush(); pvBankDraw(); toast("info","Отмечено","Платёж не относится к накладным (возврат, займ, перевод…)."); return; }
  if(a==="back"){ op.status="wait"; op.statusName=BN_ST.wait; bnQueue(op); saveLocal(); bnPush(); pvBankDraw(); return; }
  if(a==="undo"){ if(!armed(b,"Точно отменить?")) return; bnUnapply(op); saveLocal(); bnPush(); drawProfit(); toast("ok","Разнесение отменено","Накладные снова «не оплачены» на эту сумму."); return; }
  if(a==="pick") bnPick(op);
}

/* ---------- выбрать накладные вручную ---------- */
let BNKP=null;
function bnPick(op){
  const m=bnMatch(op), was=bnDocsOf(op), cid = m.cid || (was[0] && (D.journal.find(x=>x.id===was[0].id)||{}).customerId) || "";
  BNKP={op, cid, sel:new Map((was.length?was:m.docs).map(u=>[u.id, String(u.s)])), allSup:false};
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Поступление ${fd(op.date)} · ${esc(bnSup(op.supplierId))}</div><h3>+${fm(+op.sum||0)} ₽ — ${esc(op.payerName||"")}</h3><div class="dc-sub">${esc(op.purpose||"")}</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="bnpk"><label class="f">Заказчик<select id="bnp-c"><option value="">— выберите —</option>${opts(D.customers, cid)}</select></label>
      ${op.payerInn?`<label class="chk"><input type="checkbox" id="bnp-rem" ${bnInnMap()[bnDigits(op.payerInn)]?"checked":""}> запомнить: ИНН ${esc(op.payerInn)} — это этот заказчик</label>`:""}
      <label class="chk"><input type="checkbox" id="bnp-all"> показать накладные всех ИП</label>
      <div id="bnp-l"></div><div class="bnpt" id="bnp-t"></div>
      <div class="pvea"><button type="button" class="btn pri" data-bnp="save">Разнести</button><button type="button" class="btn ghost" data-dc="close">Отмена</button></div></div>`, true, ()=>{});
  const d=$("#fd-dcard"); d.classList.add("bnp-d");
  d.addEventListener("change", e=>{ if(e.target.id==="bnp-c"){ BNKP.cid=e.target.value; BNKP.sel=new Map(); bnPickDraw(); } else if(e.target.id==="bnp-all"){ BNKP.allSup=e.target.checked; bnPickDraw(); }
    else if(e.target.matches(".bnpc")){ const id=e.target.dataset.id, row=e.target.closest(".bnpr"); if(e.target.checked){ BNKP.sel.set(id, row.querySelector(".bnps").value||row.dataset.left); } else BNKP.sel.delete(id); bnPickDraw(true); } });
  d.addEventListener("input", e=>{ if(e.target.matches(".bnps")){ const id=e.target.dataset.id; BNKP.sel.set(id, e.target.value); const c=e.target.closest(".bnpr").querySelector(".bnpc"); c.checked=true; bnPickTotal(); } });
  d.addEventListener("click", e=>{ const b=e.target.closest("[data-bnp]"); if(b) bnPickSave(); });
  bnPickDraw();
}
function bnPickDraw(keepRows){
  const box=$("#bnp-l"); if(!box) return; const op=BNKP.op;
  if(!keepRows){ const due=BNKP.cid ? bnDue([BNKP.cid], BNKP.allSup?"":op.supplierId) : [];
    const extra=[...BNKP.sel.keys()].filter(id=>!due.some(x=>x.j.id===id)).map(id=>D.journal.find(x=>x.id===id)).filter(Boolean).map(j=>({j, left:payOf(j).left}));
    const L=extra.concat(due);
    box.innerHTML = !BNKP.cid ? `<p class="muted">Выберите заказчика — покажу его неоплаченные накладные.</p>` : L.length ? `<div class="bnpl">${L.map(x=>{ const on=BNKP.sel.has(x.j.id); return `<label class="bnpr ${on?"on":""}" data-left="${r2(x.left)}"><input type="checkbox" class="bnpc" data-id="${x.j.id}" ${on?"checked":""}><span class="bnpn"><b>№ ${esc(x.j.number)}</b> <small>${fd(x.j.date)} · ${esc(bnSup(x.j.supplierId))}</small></span><span class="bnpd">к оплате ${fm(x.left)}</span><input class="bnps" data-id="${x.j.id}" inputmode="decimal" value="${esc(String(on?BNKP.sel.get(x.j.id):r2(x.left)).replace(".",","))}"></label>`; }).join("")}</div>` : `<p class="muted">У заказчика нет неоплаченных накладных${BNKP.allSup?"":" у этого ИП — отметьте «показать накладные всех ИП»"}.</p>`;
  } else box.querySelectorAll(".bnpr").forEach(r=>r.classList.toggle("on", r.querySelector(".bnpc").checked));
  bnPickTotal();
}
function bnPickTotal(){ const t=$("#bnp-t"); if(!t) return; const s=r2([...BNKP.sel.values()].reduce((a,v)=>a+(+num(v)||0),0)), sum=+BNKP.op.sum||0, rest=r2(sum-s);
  t.innerHTML=`<span>Выбрано <b>${fm(s)}</b> из <b>${fm(sum)}</b> ₽</span>${bnEq(rest,0)?`<em class="ok">ровно</em>`:rest>0?`<em>не разнесено ${fm(rest)} ₽</em>`:`<em class="bad">больше платежа на ${fm(-rest)} ₽</em>`}`;
  t.querySelector("em") && t.classList.toggle("ok", bnEq(rest,0)); }
function bnPickSave(){
  const op=BNKP.op, docs=[...BNKP.sel.entries()].map(([id,s])=>({id, s:String(r2(+num(s)||0))})).filter(x=>+x.s>0), s=r2(docs.reduce((a,x)=>a+ +x.s,0));
  if(!docs.length){ toast("err","Отметьте накладные",""); return; }
  if(s>(+op.sum||0)+0.004){ toast("err","Больше суммы платежа","Выбрано "+fm(s)+" ₽, а пришло "+fm(+op.sum)+" ₽."); return; }
  const rem=$("#bnp-rem"); if(rem && op.payerInn){ const p=getPrefs(); p.bnInn=p.bnInn||{}; const k=bnDigits(op.payerInn); if(rem.checked && BNKP.cid) p.bnInn[k]=BNKP.cid; else delete p.bnInn[k]; setPrefs(p,true); }
  if(op.status==="auto"||op.status==="done") bnUnapply(op);
  const n=bnApply(op, docs, "done"); saveLocal(); bnPush(); pvCloseCard(); drawProfit(); toast("ok","Оплата разнесена", n+" "+plural(n,["накладная","накладные","накладных"])+": "+op.docsText);
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
