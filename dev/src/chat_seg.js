/* ---------- «Помощник» — встроенный Claude (только Даниил; Code.gs ≥ 38, действие aiChat) ----------
   Claude понимает вопрос и сам просит у сайта данные (инструменты ниже); цифры считает сайт по своим данным
   (журнал, оплаты, закупка, цены, склад, расходы) — Claude их не выдумывает, а пересказывает. */
const AC={open:false, busy:false, msgs:[], view:[], step:"", files:[], use:null, useAt:0};
const AC_KEY = () => "frudom-ac:"+(curUser()||"");
function acLoad(){ try{ const x=JSON.parse(localStorage.getItem(AC_KEY())||"null"); if(x&&Array.isArray(x.view)){ AC.view=x.view.slice(-60); AC.msgs=Array.isArray(x.msgs)?x.msgs:[]; } }catch(e){} }
const acIsQ = m => m && m.role==="user" && (typeof m.content==="string" || (Array.isArray(m.content) && !m.content.some(c=>c.type==="tool_result")));
const acNoFile = c => (c.type==="document"||c.type==="image") ? {type:"text", text:"(здесь был приложен файл"+(c._n?" «"+c._n+"»":"")+" — если он снова нужен, попроси приложить)"} : c;
const acClean = m => Array.isArray(m.content) ? Object.assign({}, m, {content:m.content.map(c=>{ const x=acNoFile(c); if(x!==c) return x; const y=Object.assign({},c); delete y._n; return y; })}) : m;
function acSave(){ try{ localStorage.setItem(AC_KEY(), JSON.stringify({view:AC.view.slice(-60), msgs:AC.msgs.slice(-40).map(acClean)})); }catch(e){} }
const acOk = () => { try{ return typeof MAILAPP!=="undefined" && MAILAPP ? false : !!(me() && me().admin && pass()); }catch(e){ return false; } };

/* ---------- поиск по данным сайта ---------- */
const acTk = s => String(s||"").toLowerCase().replace(/ё/g,"е").split(/[^a-zа-я0-9]+/).filter(w=>w.length>=2);
const acStem = w => w.length>4 ? w.slice(0,4) : w;
function acHit(q, text){ const Q=acTk(q).map(acStem); if(!Q.length) return true; const T=acTk(text).map(acStem); return Q.every(a=>T.some(b=>b===a || (a.length>=3 && b.startsWith(a)))); }
const acD = s => /^\d{4}-\d\d-\d\d$/.test(String(s||"")) ? String(s) : "";
function acCus(q){ if(!q) return null; const qq=String(q).trim(); return D.customers.filter(c=>c.id===qq || String(c.inn||"")===qq || acHit(qq, [c.short||"", c.name||""].join(" "))); }
function acDocs(a){ const from=acD(a.date_from), to=acD(a.date_to), cs=acCus(a.customer), sp=a.supplier?D.suppliers.filter(s=>acHit(a.supplier, [s.name, s.fio].join(" "))):null;
  return D.journal.filter(j=>j.snap && (a.include_archived || !isArch(j)) && (!from || j.date>=from) && (!to || j.date<=to)
    && (!cs || cs.some(c=>c.id===j.customerId)) && (!sp || sp.some(s=>s.id===j.supplierId)) && (!a.number || String(j.number)===String(a.number).replace(/^№\s*/,"")))
    .sort((x,y)=>(y.date||"").localeCompare(x.date||"")); }
function acPoint(j){ const c=j.snap.c||{}, dr=j.snap.dr||{}; return [c.branchLabel||"", dr.ship||""].filter(Boolean).join(" · "); }
function acCtr(j){ const x=ctr(j.snap.dr.contractId); return x ? (typeof ctrNm==="function"?ctrNm(x):x.basis||"") : (j.snap.dr.basis||""); }
const acN = x => Math.round((+x||0)*100)/100;
function acPay(j){ if(!pfLoaded) return undefined; const p=payOf(j); return p.st==="paid" ? "оплачена"+(p.d?" "+p.d:"") : p.st==="part" ? "оплачено "+acN(p.s)+" из "+acN(p.tot) : "не оплачена"; }
async function acProfitReady(){ if(!pfLoaded){ AC.step="Загружаю оплаты и закупку…"; acDraw(); await loadProfit(true); } return pfLoaded; }

const AC_TOOLS=[
  {name:"search_docs", description:"Найти накладные (документы) в журнале сайта: по датам, заказчику, товару, поставщику (ИП), номеру. Возвращает накладные со строками (товар, количество, единица, цена, сумма), точку/адрес, договор, оплату и итоги по найденным товарам. Товар и заказчик ищутся по началу слов (картошка = «карт…», помидоры могут называться «томаты» — тогда ищи ещё раз). Даты — ГГГГ-ММ-ДД.",
   input_schema:{type:"object", properties:{date_from:{type:"string"}, date_to:{type:"string"}, customer:{type:"string", description:"название, короткое название или ИНН заказчика"}, product:{type:"string"}, supplier:{type:"string", description:"ИП: Скобёлкин / Суховерхова / Байдаров"}, number:{type:"string"}, include_archived:{type:"boolean"}, limit:{type:"integer", description:"сколько накладных вернуть, по умолчанию 40"}}}},
  {name:"debts", description:"Кто сколько должен по накладным (неоплаченные остатки) — по заказчикам, с возрастом долга и списком накладных. Плюс личная книжка долгов «Мне должны / Я должен».", input_schema:{type:"object", properties:{customer:{type:"string"}}}},
  {name:"prices", description:"Цены на товар: по каким ценам продавали (по накладным, с датой и заказчиком), цены в прайсах заказчиков сейчас, и закупочная цена из закупки накладных.", input_schema:{type:"object", properties:{product:{type:"string"}, customer:{type:"string"}, date_from:{type:"string"}, date_to:{type:"string"}}, required:["product"]}},
  {name:"profit", description:"Выручка, закупка, налог 8%, расходы и прибыль по накладным за период (можно по заказчику), плюс прочие расходы/доходы и личные траты за период.", input_schema:{type:"object", properties:{date_from:{type:"string"}, date_to:{type:"string"}, customer:{type:"string"}}}},
  {name:"expenses", description:"Прочие расходы, доходы и личные траты (раздел «Расходы и доходы»): по датам, виду и тексту.", input_schema:{type:"object", properties:{date_from:{type:"string"}, date_to:{type:"string"}, kind:{type:"string", description:"Расход / Доход / Личное"}, text:{type:"string"}}}},
  {name:"customers", description:"Заказчики: короткое и полное название, ИНН, договоры (основание, ИП, цена договора, срок, сколько уже поставлено), подразделения и адреса.", input_schema:{type:"object", properties:{query:{type:"string"}}}},
  {name:"stock", description:"Остатки на складе: что есть, сколько, в резерве.", input_schema:{type:"object", properties:{product:{type:"string"}}}},
  {name:"make_document", description:"Заполнить накладную(ые) на вкладке «Новый документ» — как «Заказ из файла»: сайт сам подберёт товары заказчика, цены прайса, адрес/подразделение, договор и номер. Даниил проверит и сам нажмёт «Сохранить». Используй, когда просят сделать накладную/документ (например, по приложенной заявке). Несколько адресов или подразделений — передай address у каждого вызова отдельно или columns + qtys.",
   input_schema:{type:"object", properties:{customer:{type:"string", description:"заказчик (как на сайте или ИНН)"}, supplier:{type:"string", description:"ИП, если известен"}, contract:{type:"string", description:"номер договора, если есть в заявке"}, date:{type:"string", description:"дата поставки ГГГГ-ММ-ДД"}, address:{type:"string", description:"адрес доставки или название подразделения"},
     columns:{type:"array", items:{type:"string"}, description:"если в заявке количества по подразделениям/адресам столбцами — их названия"},
     items:{type:"array", items:{type:"object", properties:{name:{type:"string"}, qty:{type:"number"}, unit:{type:"string"}, price:{type:"number", description:"только если цена указана в заявке"}, qtys:{type:"object", description:"количества по columns"}}, required:["name"]}}}, required:["customer","items"]}},
  {name:"remember", description:"Запомнить для Даниила заметку, правило или напоминание (сохраняется между разговорами). date — когда напомнить (ГГГГ-ММ-ДД), если это напоминание.", input_schema:{type:"object", properties:{text:{type:"string"}, date:{type:"string"}}, required:["text"]}},
  {name:"forget", description:"Удалить заметку/напоминание из памяти по id.", input_schema:{type:"object", properties:{id:{type:"string"}}, required:["id"]}},
  {name:"site_checks", description:"Что сайт сам нашёл: забытое и возможные ошибки (долги старше 30 дней, накладные без закупки или в минус, без договора, поставки без документов, остаток по договорам, склад, реквизиты, товары без единицы). Используй, когда спрашивают «что я забыл», «где ошибки», «что важно сегодня».", input_schema:{type:"object", properties:{}}}
];
/* память помощника — в личных настройках (prefs.acMem: [{id, t, d, at}]) */
const acMem = () => { const m=getPrefs().acMem; return Array.isArray(m)?m:[]; };
function acMemSet(L){ const p=getPrefs(); p.acMem=L.slice(-80); setPrefs(p, true); }
const acDue = () => acMem().filter(x=>x.d && x.d<=todayISO());

const AC_RUN={
  async search_docs(a){ const L=acDocs(a), lim=Math.min(+a.limit||40, 120), tot={}; let sum=0, n=0; const out=[];
    for(const j of L){ const k=calc(j.snap.dr, j.snap); let lines=k.lines;
      if(a.product){ lines=lines.filter(l=>acHit(a.product, l.name)); if(!lines.length) continue; }
      n++; lines.forEach(l=>{ const key=l.name+"|"+l.unit, t=tot[key]||(tot[key]={name:l.name, unit:l.unit, qty:0, sum:0, docs:0}); t.qty=acN(t.qty+(+l.qty||0)); t.sum=acN(t.sum+(+l.sum||0)); t.docs++; });
      sum+=a.product ? lines.reduce((s,l)=>s+(+l.sum||0),0) : (+k.t.sum||0);
      if(out.length<lim) out.push({id:j.id, number:j.number, date:j.date, customer_id:j.customerId, customer:cusNm(j.customerId)||j.customerName||"", point:acPoint(j)||undefined, supplier:(sup(j.supplierId)||{}).name||"", contract:acCtr(j)||undefined,
        doc_sum:acN(k.t.sum), payment:acPay(j), archived:isArch(j)||undefined, lines:lines.slice(0,40).map(l=>({name:l.name, qty:+l.qty||0, unit:l.unit, price:acN(l.price), sum:acN(l.sum)}))}); }
    const note=[out.length<n?"показаны "+out.length+" из "+n+" — сузь даты или заказчика":"", D.journal.length>=2000?"на устройстве последние 2000 накладных":""].filter(Boolean).join("; ");
    return {found_docs:n, total_sum:acN(sum), product_totals:a.product?Object.values(tot).slice(0,40):undefined, docs:out, note:note||undefined}; },
  async debts(a){ if(!await acProfitReady()) return {error:"не удалось загрузить оплаты"}; const cs=acCus(a.customer), M={};
    D.journal.forEach(j=>{ if(!j.snap||isArch(j)||(cs&&!cs.some(c=>c.id===j.customerId))) return; const p=payOf(j); if(p.left<=0.005) return;
      const m=M[j.customerId]||(M[j.customerId]={customer_id:j.customerId, customer:cusNm(j.customerId)||j.customerName||"", debt:0, docs:[]}); m.debt=acN(m.debt+p.left); m.docs.push({id:j.id, number:j.number, date:j.date, left:acN(p.left), age_days:daysSince(j.date), future:j.date>todayISO()||undefined}); });
    const R=Object.values(M).sort((x,y)=>y.debt-x.debt).map(m=>Object.assign(m,{docs_count:m.docs.length, oldest:m.docs.map(d=>d.date).sort()[0], docs:m.docs.sort((x,y)=>x.date.localeCompare(y.date)).slice(0,30)}));
    const book=(D.debts||[]).filter(x=>!+x.closed && (!a.customer || acHit(a.customer, x.name))).map(x=>({side:x.side, who:x.name, sum:acN(x.sum), paid:acN(x.paid), left:acN((+x.sum||0)-(+x.paid||0)), date:x.date, due:x.due||undefined, note:x.note||undefined}));
    return {total_debt:acN(R.reduce((s,m)=>s+m.debt,0)), customers:R, personal_book:book.length?book:undefined}; },
  async prices(a){ const from=acD(a.date_from), to=acD(a.date_to), cs=acCus(a.customer), sold=[]; const prof=pfLoaded;
    D.journal.filter(j=>j.snap&&!isArch(j)&&(!from||j.date>=from)&&(!to||j.date<=to)&&(!cs||cs.some(c=>c.id===j.customerId))).sort((x,y)=>(y.date||"").localeCompare(x.date||"")).forEach(j=>{ if(sold.length>=80) return;
      const k=calc(j.snap.dr, j.snap), hit=k.lines.filter(l=>acHit(a.product, l.name)); if(!hit.length) return; let dp=null; if(prof){ try{ dp=docProfit(j); }catch(e){} }
      hit.forEach(l=>{ const pl=dp&&dp.lines.find(x=>x.l.pid===l.pid); sold.push({date:j.date, customer:cusNm(j.customerId)||"", doc_id:j.id, number:j.number, name:l.name, unit:l.unit, qty:+l.qty||0, price:acN(l.price), purchase_per_unit:pl&&pl.c!=null?acN(pl.cu!=null?pl.cu:pl.c):undefined}); }); });
    const P=D.products.filter(p=>acHit(a.product, p.name)).slice(0,20), now=[];
    P.forEach(p=>{ (cs||D.customers).forEach(c=>{ const pr=custPrice(c.id,p.id); if(pr!=null&&pr!=="") now.push({customer:cusNm(c.id), product:p.name, unit:p.unit, price:acN(pr)}); }); });
    return {sold:sold, price_lists_now:now.slice(0,60), base_prices:P.map(p=>({product:p.name, unit:p.unit, base_price:p.price?acN(p.price):undefined})), purchase_note:prof?undefined:"закупка не загружена"}; },
  async profit(a){ if(!await acProfitReady()) return {error:"не удалось загрузить закупку"}; const from=acD(a.date_from), to=acD(a.date_to), cs=acCus(a.customer), C={}; let T={rev:0,cost:0,tax:0,exp:0,profit:0,docs:0,no_purchase:0};
    D.journal.forEach(j=>{ if(!j.snap||isArch(j)||(from&&j.date<from)||(to&&j.date>to)||(cs&&!cs.some(c=>c.id===j.customerId))) return; let p; try{ p=docProfit(j); }catch(e){ return; }
      const c=C[j.customerId]||(C[j.customerId]={customer:cusNm(j.customerId)||j.customerName||"", rev:0, cost:0, profit:0, docs:0});
      ["rev","cost","tax","exp","profit"].forEach(k=>T[k]=acN(T[k]+(+p[k]||0))); T.docs++; if(p.miss) T.no_purchase++; c.rev=acN(c.rev+p.rev); c.cost=acN(c.cost+p.cost); c.profit=acN(c.profit+p.profit); c.docs++; });
    const po=(D.pother||[]).filter(x=>(!from||x.date>=from)&&(!to||x.date<=to)), sk=k=>acN(po.filter(x=>x.kind===k).reduce((s,x)=>s+(+x.sum||0),0));
    return {by_docs:T, note:T.no_purchase?"у "+T.no_purchase+" накладных не заполнена закупка — прибыль завышена":undefined, by_customer:Object.values(C).sort((x,y)=>y.rev-x.rev), other_expenses:sk("Расход"), other_income:sk("Доход"), personal:sk("Личное")}; },
  async expenses(a){ await acProfitReady(); const from=acD(a.date_from), to=acD(a.date_to);
    const L=(D.pother||[]).filter(x=>(!from||x.date>=from)&&(!to||x.date<=to)&&(!a.kind||String(x.kind||"").toLowerCase()===String(a.kind).toLowerCase())&&(!a.text||acHit(a.text,[x.note,x.catName,x.kind].join(" ")))).sort((x,y)=>(y.date||"").localeCompare(x.date||""));
    return {count:L.length, total:acN(L.reduce((s,x)=>s+(+x.sum||0),0)), items:L.slice(0,80).map(x=>({date:x.date, kind:x.kind, sum:acN(x.sum), what:x.note||"", category:x.catName||undefined}))}; },
  async customers(a){ const L=a.query?acCus(a.query):D.customers.filter(c=>c.id!=="private-buyer");
    return {customers:L.slice(0,30).map(c=>({id:c.id, short:c.short||undefined, name:c.name, inn:c.inn||undefined, address:c.address||undefined, ship:c.ship||undefined,
      branches:(typeof branches==="function"?branches(c):[]).map(b=>b.label).filter(Boolean),
      contracts:(D.contracts||[]).filter(x=>x.customerId===c.id).map(x=>{ const sh=D.journal.filter(j=>!isArch(j)&&j.snap&&j.snap.dr.contractId===x.id).reduce((s,j)=>s+(+j.sum||0),0);
        return {basis:x.basis, short:x.short||undefined, supplier:(sup(x.supplierId)||{}).name||"", max_sum:x.maxSum?acN(x.maxSum):undefined, until:x.dateTo||undefined, shipped_sum:acN(sh)}; })}))}; },
  async make_document(a){ const cs=acCus(a.customer||"")||[];
    if(!cs.length) return {error:"заказчик «"+(a.customer||"")+"» не найден на сайте — уточни название"}; if(cs.length>1) return {error:"подходят несколько заказчиков — уточни", candidates:cs.map(c=>cusNm(c.id))};
    const c=cs[0], x={customer:c.name, inn:c.inn||"", contract:a.contract||"", supplier:a.supplier||"", date:acD(a.date)||"", address:a.address||"", columns:Array.isArray(a.columns)?a.columns:undefined,
      items:(Array.isArray(a.items)?a.items:[]).filter(i=>i&&i.name).map(i=>({name:i.name, unit:i.unit||"", qty:i.qty, price:i.price, qtys:i.qtys}))};
    if(!x.items.length) return {error:"нет ни одной строки товара"};
    let r; try{ showTab("doc"); IMP={file:"Помощник"}; IMP.r=r=impResolve(ftParse(aiSrc(x))); impShow(); }catch(e){ return {error:String(e.message||e)}; }
    AC.made=1; setTimeout(()=>{ acShow(false); toast("ok","Помощник заполнил накладную","Проверьте строки, цены и адрес и нажмите «Сохранить»."); }, 300);
    return {ok:true, opened:"вкладка «Новый документ» — накладные заполнены, Даниил проверит и нажмёт «Сохранить»", customer:cusNm(c.id), date:r.date||undefined,
      documents:(r.groups||[]).map(g=>({address:g.ship||g.addr||"", lines:(g.items||[]).length, sum:acN(g.sum), not_found:(g.miss||[]).map(l=>l.name), warnings:(g.warn||[]).map(w=>w.m).slice(0,8)})), warnings:(r.warn||[]).map(w=>w.m||w).slice(0,8)}; },
  async remember(a){ const t=String(a.text||"").trim(); if(!t) return {error:"пустая заметка"}; const L=acMem(), x={id:Date.now().toString(36), t:t.slice(0,500), d:acD(a.date)||"", at:todayISO()}; L.push(x); acMemSet(L); return {ok:true, saved:x}; },
  async forget(a){ const L=acMem(), n=L.length, M=L.filter(x=>x.id!==String(a.id)); if(M.length===n) return {error:"нет заметки с таким id"}; acMemSet(M); return {ok:true}; },
  async site_checks(){ let T=[]; try{ T=autoTasks(); }catch(e){ return {error:"не получилось: "+(e.message||e)}; }
    const hid=(getPrefs().tkHide)||{}; T=T.filter(x=>!hid[x.key]); const o={err:0,warn:1,info:2}; T.sort((a,b)=>(o[a.lvl]??3)-(o[b.lvl]??3));
    return {count:T.length, items:T.slice(0,40).map(x=>({level:x.lvl==="err"?"важно":x.lvl==="warn"?"внимание":"к сведению", group:x.g, title:x.title, text:String(x.text||"").replace(/<[^>]+>/g,"").slice(0,300)}))}; },
  async stock(a){ if(typeof SK_READY==="undefined" || !SK_READY) return {error:"склад ещё не загружен — откройте вкладку «Склад» и спросите снова"};
    const X=skIdx(), L=X.S.items.filter(i=>!a.product || acHit(a.product, [i.name, i.alt||""].join(" ")));
    return {items:L.slice(0,60).map(i=>({name:i.name, units:skUnitsOf(i.id).map(u=>({unit:u.unit, on_hand:u.fact, reserved:u.res}))})).filter(i=>!a.product ? i.units.some(u=>u.on_hand>0) : true)}; }
};

function acSystem(){ const d=new Date(), dn=["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][d.getDay()];
  return `Ты — встроенный помощник сайта «Фруктовый Дом · документы» (замена 1С) у Даниила, владельца бизнеса «Фруктовый Дом» (сухофрукты, овощи, фрукты, поставки госзаказчикам и компаниям в Москве). Сегодня ${todayISO()} (${dn}).
Бизнес: три ИП на АУСН без НДС (налог 8% с выручки): Скобёлкин Даниил, Суховерхова Анастасия, Байдаров Ростислав. Закупщик — Саид, водитель — Гриша. Госконтракты всегда без НДС.
Как отвечать:
- Любые цифры (количество, цены, суммы, долги, даты) бери ТОЛЬКО из инструментов. Ничего не выдумывай и не округляй «на глаз». Если данных нет — так и скажи.
- Перед ответом сам вызывай нужные инструменты, можно несколько раз (например, сначала уточнить заказчика, потом искать накладные). Если по названию ничего не нашлось — попробуй другое написание (картошка/картофель, помидоры/томаты, Кинодом/КиноДом).
- Дата без года — ближайшая прошедшая (или сегодняшняя). «12 числа» — 12-е текущего месяца, если оно уже было.
- Отвечай по-русски, коротко и по-человечески: сначала ответ, потом 1–5 строк подробностей. Деньги — «1 234,50 ₽», количество с единицей («85 кг»).
- Накладные называй ссылками ровно в таком виде: [[doc:ID|№ 69 от 12.11]] (ID — поле id из инструмента). Заказчика можно ссылкой [[cus:ID|Цирк]] (ID — customer_id или id).
- Если вопрос неоднозначный (несколько заказчиков с похожим названием) — коротко уточни.
- Ты только читаешь данные: изменить, удалить или создать документ не можешь — подскажи, где это сделать на сайте.
- Данные — те, что загружены на этом устройстве (журнал — последние 2000 накладных).
- Если Даниил прислал файл (заявку, накладную, фото) и просит сделать документ — прочитай файл, уточни заказчика (при сомнении — инструментом customers) и вызови make_document с товарами как в заявке (названия как в заявке, количество, единица; цену — только если она есть в заявке). Потом коротко скажи, что открыл «Новый документ», что не нашлось или вызвало сомнения — и что нужно проверить и нажать «Сохранить».
- Ты помощник: если видишь в данных возможную ошибку (цена не как в прайсе или договоре, повтор накладной, дата не та, долг давно висит, превышение по договору) — коротко скажи об этом, даже если не спрашивали.
- Память: важное, что Даниил просит запомнить (правила, предпочтения, договорённости, напоминания), сохраняй инструментом remember (у напоминания — date). Не запоминай то, что и так есть в данных сайта. Удалить — forget.${acMemTxt()}`; }
function acMemTxt(){ const L=acMem(); if(!L.length) return ""; return "\nТвоя память (заметки Даниила, id в скобках):\n"+L.map(x=>"- ("+x.id+") "+(x.d?"[напомнить "+x.d+"] ":"")+x.t).join("\n"); }

/* ---------- разговор ---------- */
/* перед новым вопросом: прошлые «размышления» Claude (thinking) убираем целиком — они привязаны к неизменной истории,
   а сайт историю сжимает (старые данные, файлы); внутри одного вопроса (цепочка инструментов) они идут без изменений */
function acNoThink(){ AC.msgs.forEach(m=>{ if(m.role==="assistant" && Array.isArray(m.content)){ const c=m.content.filter(x=>x.type!=="thinking" && x.type!=="redacted_thinking"); m.content=c.length?c:[{type:"text", text:"…"}]; } }); }
function acSquash(){ acNoThink(); let q=0; for(let i=AC.msgs.length-1;i>=0;i--){ const m=AC.msgs[i]; if(acIsQ(m)) q++;
    if(m.role==="user" && Array.isArray(m.content)) m.content=m.content.map(c=>{ if(c.type==="tool_result" && String(c.content||"").length>200) return Object.assign({},c,{content:"(старые данные — при необходимости запроси заново)"}); return q>2?acNoFile(c):c; }); } }
function acTrim(){ let n=0; for(let i=AC.msgs.length-1;i>=0;i--){ if(acIsQ(AC.msgs[i])){ n++; if(n>12){ AC.msgs=AC.msgs.slice(i+1); while(AC.msgs.length && !acIsQ(AC.msgs[0])) AC.msgs.shift(); break; } } } }
const AC_STEP={search_docs:"Ищу в накладных…", debts:"Считаю долги…", prices:"Смотрю цены…", profit:"Считаю прибыль…", expenses:"Смотрю расходы…", customers:"Смотрю заказчиков…", stock:"Смотрю склад…"};
async function acAsk(text){ text=String(text||"").trim(); const F=AC.files.filter(f=>f.block); if((!text&&!F.length)||AC.busy) return; if(AC.files.some(f=>f.busy)){ toast("info","Подождите","Файл ещё готовится."); return; } if(!online()){ toast("warn","Нет связи","Помощнику нужен интернет."); return; }
  if(!text) text="Посмотри файл.";
  AC.busy=true; acSquash(); AC.view.push({r:"u", t:text, f:F.map(f=>f.name)}); AC.msgs.push({role:"user", content: F.length ? F.map(f=>f.block).concat([{type:"text", text}]) : text}); AC.files=[]; acTrim(); AC.step=F.length?"Читаю файл…":"Думаю…"; acDraw(true);
  try{
    for(let round=0; round<10; round++){
      const j=await apiFetch(API_URL,{method:"POST", tmo:120000, body:JSON.stringify({key:pass(), user:curUser(), action:"aiChat", system:acSystem(), tools:JSON.stringify(AC_TOOLS), msgs:JSON.stringify(AC.msgs, (k,v)=>k==="_n"?undefined:v)})});
      const content=j.content||[]; AC.msgs.push({role:"assistant", content}); if(j.use){ AC.use=j.use; acUseDraw(); }
      const uses=content.filter(c=>c.type==="tool_use");
      if(j.stop!=="tool_use" || !uses.length){ const t=content.filter(c=>c.type==="text").map(c=>c.text).join("\n").trim(); AC.view.push({r:"a", t:t||"(пустой ответ)"}); break; }
      const res=[]; for(const u of uses){ AC.step=AC_STEP[u.name]||"Ищу…"; acDraw(); let out; try{ const f=AC_RUN[u.name]; out=f ? await f(u.input||{}) : {error:"нет такого инструмента"}; }catch(e){ out={error:String(e.message||e)}; }
        res.push({type:"tool_result", tool_use_id:u.id, content:JSON.stringify(out).slice(0,60000)}); }
      AC.msgs.push({role:"user", content:res});
      if(round===9) AC.view.push({r:"a", t:"Не успел разобраться — уточните вопрос, пожалуйста."});
    }
  }catch(e){ const m=e.message||String(e);
    AC.msgs=AC.msgs.map(acClean);
    const t = m==="unknown action" ? "Скрипт таблицы старый — обновите Code.gs (нужна версия 38), тогда я заработаю." : m==="nokey" ? "Не вставлен ключ Claude: «Данные» → «ИИ» → ключ Claude." : m==="badkey" ? "Ключ Claude не подходит — проверьте его в «Данные» → «ИИ»." : m==="forbidden" ? "Помощник доступен только Даниилу." : "Не получилось: "+m;
    AC.view.push({r:"a", t, err:1});
    while(AC.msgs.length && !acIsQ(AC.msgs[AC.msgs.length-1])) AC.msgs.pop(); AC.msgs.pop(); }
  AC.busy=false; AC.step=""; acSave(); acDraw(true); }

/* ---------- оформление ответа ---------- */
function acMd(t){ let h=esc(t);
  h=h.replace(/\[\[doc:([\w-]+)\|([^\]]+)\]\]/g,(m,id,tx)=>`<button type="button" class="acl" data-acdoc="${id}">${tx}</button>`)
     .replace(/\[\[cus:([\w-]+)\|([^\]]+)\]\]/g,(m,id,tx)=>`<button type="button" class="acl c" data-accus="${id}">${tx}</button>`);
  const L=h.split("\n"), out=[]; let ul=false, tb=null;
  const flush=()=>{ if(ul){ out.push("</ul>"); ul=false; } if(tb){ out.push(`<div class="actw"><table>${tb.map((r,i)=>`<tr>${r.map(c=>i?`<td>${c}</td>`:`<th>${c}</th>`).join("")}</tr>`).join("")}</table></div>`); tb=null; } };
  L.forEach(l=>{ const s=l.trim();
    if(/^\|.*\|$/.test(s)){ if(/^\|[\s:|-]+\|$/.test(s)) return; if(ul){ out.push("</ul>"); ul=false; } (tb=tb||[]).push(s.slice(1,-1).split("|").map(x=>x.trim())); return; }
    if(tb) flush();
    if(/^[-•*]\s+/.test(s)){ if(!ul){ out.push("<ul>"); ul=true; } out.push(`<li>${s.replace(/^[-•*]\s+/,"")}</li>`); return; }
    flush(); if(/^#{1,4}\s+/.test(s)) out.push(`<p class="ach">${s.replace(/^#+\s+/,"")}</p>`); else if(s) out.push(`<p>${s}</p>`); });
  flush(); return out.join("").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>"); }

const AC_IC=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>`;
const AC_SUG=["Кто сколько мне должен?","Куда уходила картошка 12 числа?","Сколько заработали в этом месяце?","По какой цене продавали помидоры Цирку в октябре?","Что Гриша везёт завтра?","Сколько осталось по договорам МОК?"];
function acEl(){ let b=document.getElementById("ac-fab"); if(b) return;
  const st=document.createElement("style"); st.textContent=`
#ac-fab{position:fixed;right:16px;bottom:16px;z-index:60;display:flex;align-items:center;gap:7px;height:40px;padding:0 15px 0 12px;border:0;border-radius:20px;background:#5b2a4e;color:#fff;font:600 14px/1 inherit;font-family:inherit;box-shadow:0 5px 18px rgba(60,20,50,.26);cursor:pointer}
#ac-fab svg{width:19px;height:19px}#ac-fab b{position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;border-radius:9px;background:#d9534f;color:#fff;font-size:11px;line-height:18px;text-align:center;padding:0 4px}
#ac-pan .acrm{margin:0 0 4px;padding:10px 12px;border-radius:12px;background:#fff8e6;border:1px solid #f0dfb0;font-size:14px}#ac-pan .acrm b{display:block;margin-bottom:4px}
#ac-pan .acrm div{display:flex;gap:8px;align-items:flex-start;margin:4px 0}#ac-pan .acrm div span{flex:1}#ac-pan .acrm button{border:1px solid #e6d29c;background:#fff;border-radius:8px;padding:3px 8px;font:inherit;font-size:12.5px;cursor:pointer}
#ac-pan .acchk{border:1px dashed #d8c8d2;background:#fff;border-radius:12px;padding:8px 12px;font:inherit;font-size:13.5px;color:#5b2a4e;cursor:pointer;text-align:left}
#ac-pan .acfs{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px}#ac-pan .acfs:empty{display:none}#ac-pan .acfs span{display:inline-flex;align-items:center;gap:6px;background:#f3e9ef;color:#5b2a4e;border-radius:8px;padding:4px 8px;font-size:13px;max-width:100%}
#ac-pan .acfs span i{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}#ac-pan .acfs span.err{background:#fdecea;color:#a3322a}#ac-pan .acfs button{border:0;background:none;font-size:16px;color:inherit;cursor:pointer;padding:0}
#ac-att{width:44px;height:44px;flex:none;align-self:flex-end;border:1px solid #e0d7dd;border-radius:12px;background:#fff;color:#5b2a4e;cursor:pointer}#ac-att svg{width:20px;height:20px}
#ac-list .am .acfn{display:block;font-size:12.5px;opacity:.85;margin-bottom:4px}#ac-fab[hidden],#ac-pan[hidden]{display:none}
#ac-pan{position:fixed;right:16px;bottom:16px;z-index:61;width:min(440px,calc(100vw - 32px));height:min(680px,calc(100vh - 32px));display:flex;flex-direction:column;background:#fbfaf8;border-radius:18px;box-shadow:0 18px 60px rgba(40,20,40,.3);overflow:hidden;font-size:15px;color:#29232a}
#ac-pan .ach0{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 16px;border-bottom:1px solid #ece6ea;background:#fff}
#ac-pan .ach0 b{font-size:16px;flex:1}#ac-pan .ach0 small{display:block;font-weight:400;color:#8a7f87;font-size:12px;margin-top:2px}
#ac-pan .acx{border:0;background:none;width:34px;height:34px;border-radius:10px;font-size:22px;color:#6c6068;cursor:pointer}#ac-pan .acx:hover{background:#f3eef1}
#ac-pan .acnew{border:1px solid #e3dbe0;background:#fff;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;color:#5b2a4e;cursor:pointer}
#ac-list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
#ac-list .am{max-width:88%;padding:10px 13px;border-radius:14px;line-height:1.45;overflow-wrap:anywhere}
#ac-list .am.u{align-self:flex-end;background:#5b2a4e;color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap}
#ac-list .am.a{align-self:flex-start;background:#fff;border:1px solid #ece6ea;border-bottom-left-radius:4px}
#ac-list .am.a.err{border-color:#f0c9c4;background:#fdf3f2}
#ac-list .am p{margin:0 0 6px}#ac-list .am p:last-child{margin:0}#ac-list .am ul{margin:2px 0 6px;padding-left:18px}#ac-list .am li{margin:2px 0}#ac-list .ach{font-weight:700}
#ac-list .actw{overflow-x:auto;margin:4px 0 6px}#ac-list table{border-collapse:collapse;font-size:13px}#ac-list th,#ac-list td{border-bottom:1px solid #eee6ea;padding:4px 8px;text-align:left;white-space:nowrap}#ac-list th{color:#7a6e76;font-weight:600}
#ac-list .acl{border:0;background:#f3e9ef;color:#5b2a4e;border-radius:7px;padding:1px 7px;font:inherit;font-weight:600;cursor:pointer}#ac-list .acl.c{background:#eef2ec;color:#2f5a35}
#ac-list .acstep{align-self:flex-start;color:#8a7f87;font-size:14px;display:flex;align-items:center;gap:8px}
#ac-list .acstep i{width:14px;height:14px;border:2px solid #d9c9d3;border-top-color:#5b2a4e;border-radius:50%;animation:acsp .8s linear infinite}@keyframes acsp{to{transform:rotate(360deg)}}
#ac-list .achello{color:#5d525a;line-height:1.5}#ac-list .acsug{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#ac-list .acsug button{border:1px solid #e3dbe0;background:#fff;border-radius:16px;padding:7px 12px;font:inherit;font-size:13.5px;color:#4a3f47;cursor:pointer;text-align:left}#ac-list .acsug button:hover{border-color:#5b2a4e}
#ac-pan form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid #ece6ea;background:#fff}
#ac-in{flex:1;resize:none;min-height:42px;max-height:140px;border:1px solid #e0d7dd;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;line-height:1.35}
#ac-in:focus{outline:none;border-color:#5b2a4e}
#ac-go{width:44px;height:44px;flex:none;align-self:flex-end;border:0;border-radius:12px;background:#5b2a4e;color:#fff;font-size:20px;cursor:pointer}#ac-go:disabled{opacity:.45;cursor:default}
@media (max-width:640px){#ac-pan{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}#ac-fab{right:12px;width:42px;height:42px;padding:0;justify-content:center;border-radius:21px}#ac-fab span{display:none}}
@media print{#ac-fab,#ac-pan{display:none!important}}`;
  document.head.appendChild(st);
  b=document.createElement("button"); b.type="button"; b.id="ac-fab"; b.hidden=true; b.innerHTML=AC_IC+"<span>Спросить</span>"; b.title="Помощник: спросите о накладных, ценах, долгах"; b.onclick=()=>acShow(true);
  const p=document.createElement("section"); p.id="ac-pan"; p.hidden=true; p.setAttribute("aria-label","Помощник");
  p.innerHTML=`<div class="ach0"><b>Помощник<small id="ac-use">Claude · отвечает по данным сайта</small></b><button type="button" class="acnew" data-acnew>Новый разговор</button><button type="button" class="acx" data-acx aria-label="Закрыть">×</button></div>
    <div id="ac-list"></div><div class="acfs" id="ac-fs"></div><form id="ac-f"><button type="button" id="ac-att" aria-label="Приложить файл" title="Приложить файл: заявку, накладную, фото, Excel, Word"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg></button><input type="file" id="ac-fin" multiple hidden><textarea id="ac-in" rows="1" placeholder="Спросите: куда уходила картошка 12 числа?" autocomplete="off"></textarea><button id="ac-go" type="submit" aria-label="Отправить">➤</button></form>`;
  document.body.appendChild(b); document.body.appendChild(p);
  const inp=p.querySelector("#ac-in"), grow=()=>{ inp.style.height="auto"; inp.style.height=Math.min(140,inp.scrollHeight)+"px"; };
  inp.addEventListener("input",grow);
  inp.addEventListener("keydown",e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); p.querySelector("#ac-f").requestSubmit(); } if(e.key==="Escape") acShow(false); });
  p.querySelector("#ac-f").addEventListener("submit",e=>{ e.preventDefault(); const t=inp.value; if((!t.trim()&&!AC.files.length)||AC.busy) return; inp.value=""; grow(); acAsk(t); });
  p.querySelector("#ac-att").onclick=()=>p.querySelector("#ac-fin").click();
  p.querySelector("#ac-fin").onchange=e=>{ [...e.target.files].forEach(acAddFile); e.target.value=""; };
  p.addEventListener("dragover",e=>{ if(e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  p.addEventListener("drop",e=>{ if(!e.dataTransfer||!e.dataTransfer.files.length) return; e.preventDefault(); [...e.dataTransfer.files].forEach(acAddFile); });
  p.addEventListener("paste",e=>{ const F=[...((e.clipboardData||{}).files||[])]; if(F.length){ e.preventDefault(); F.forEach(acAddFile); } });
  p.addEventListener("click",e=>{ const t=e.target.closest("[data-acx],[data-acnew],[data-acdoc],[data-accus],[data-acsug],[data-acfx],[data-acrm],[data-acchk]"); if(!t) return;
    if(t.dataset.acfx!==undefined){ AC.files.splice(+t.dataset.acfx,1); acFilesDraw(); return; }
    if(t.dataset.acrm){ acMemSet(acMem().filter(x=>x.id!==t.dataset.acrm)); acDraw(false); acFab(); return; }
    if(t.dataset.acchk!==undefined){ acAsk("Что я забыл и где могут быть ошибки? Кратко, по важности."); return; }
    if(t.dataset.acx!==undefined) acShow(false);
    else if(t.dataset.acnew!==undefined){ if(AC.busy) return; AC.view=[]; AC.msgs=[]; AC.files=[]; acFilesDraw(); acSave(); acDraw(true); inp.focus(); }
    else if(t.dataset.acsug!==undefined) acAsk(t.textContent);
    else if(t.dataset.acdoc){ const j=D.journal.find(x=>x.id===t.dataset.acdoc); if(j) docCard(j, isArch(j)); else toast("warn","Накладной нет на этом устройстве",""); }
    else if(t.dataset.accus){ if(typeof pvLedger==="function"){ acProfitReady().then(()=>pvLedger(t.dataset.accus)); } } });
}
function acShow(on){ acEl(); AC.open=!!on; const p=document.getElementById("ac-pan"); p.hidden=!on; document.getElementById("ac-fab").hidden=on||!acOk(); acFab();
  if(on){ if(!AC.view.length) acLoad(); acDraw(true); acFilesDraw(); acUseDraw(); if(Date.now()-AC.useAt>60000){ AC.useAt=Date.now(); apiFetch(API_URL,{method:"POST", body:JSON.stringify({key:pass(), user:curUser(), action:"aiChat", op:"use"})}).then(j=>{ if(j.use){ AC.use=j.use; acUseDraw(); } }).catch(()=>{}); } setTimeout(()=>{ const i=document.getElementById("ac-in"); if(i && matchMedia("(hover:hover)").matches) i.focus(); },50); } }
function acDraw(down){ const box=document.getElementById("ac-list"); if(!box) return;
  const due=acDue(); let h = due.length ? `<div class="acrm"><b>Напоминания</b>${due.map(x=>`<div><span>${esc(x.t)}${x.d<todayISO()?` <small>(${esc(fd(x.d))})</small>`:""}</span><button type="button" data-acrm="${esc(x.id)}">Готово</button></div>`).join("")}</div>` : "";
  if(!AC.view.length) h += `<button type="button" class="acchk" data-acchk>Что я забыл и где могут быть ошибки? — проверить</button>`;
  h += AC.view.length ? "" : `<div class="achello">Здравствуйте! Я знаю ваши накладные, цены, оплаты, закупку, расходы и склад. Спросите своими словами — например:<div class="acsug">${AC_SUG.map(s=>`<button type="button" data-acsug>${esc(s)}</button>`).join("")}</div></div>`;
  h += AC.view.map(m=>m.r==="u" ? `<div class="am u">${(m.f||[]).map(n=>`<span class="acfn">📎 ${esc(n)}</span>`).join("")}${esc(m.t)}</div>` : `<div class="am a${m.err?" err":""}">${acMd(m.t)}</div>`).join("");
  if(AC.busy) h += `<div class="acstep"><i></i>${esc(AC.step||"Думаю…")}</div>`;
  box.innerHTML=h; const go=document.getElementById("ac-go"); if(go) go.disabled=AC.busy; if(down!==false) box.scrollTop=box.scrollHeight; }
/* расход на Claude — в шапке окна */
function acUseDraw(){ const el=document.getElementById("ac-use"); if(!el) return; const u=AC.use; if(!u){ el.textContent="Claude · отвечает по данным сайта"; return; }
  const $$ = v => "$"+(+v||0).toFixed(v>=1?2:3).replace(".",","); const mon=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"][(+String(u.m||"").slice(5,7)||1)-1];
  el.textContent="Потрачено: сегодня "+$$(u.dusd)+" · "+mon+" "+$$(u.usd)+" ("+(u.n||0)+" "+plural(u.n||0,["вопрос","вопроса","вопросов"])+")"; el.title="Цены Anthropic: Sonnet 5.5 — $2 за 1 млн токенов вопроса, $10 — ответа. Всего с начала: $"+(u.all||0); }
/* файлы к вопросу: PDF и фото — как есть, Excel/Word/текст — сайт переводит в текст (как «Распознать с ИИ») */
async function acAddFile(f){ if(AC.files.length>=5){ toast("warn","Не больше 5 файлов",""); return; } const x={name:f.name, busy:1}; AC.files.push(x); acFilesDraw();
  try{ const d=await aiInput(f);
    if(d.text) x.block={type:"text", text:"Файл «"+f.name+"»"+(d.cut?" (начало)":"")+":\n"+d.text, _n:f.name};
    else if(d.mime==="application/pdf"){ if(d.data.length>27e6) throw new Error("PDF больше 20 МБ"); x.block={type:"document", source:{type:"base64", media_type:"application/pdf", data:d.data}, _n:f.name}; }
    else if(/^image\/(jpeg|png|webp|gif)$/.test(d.mime)){ if(d.data.length>6.9e6) throw new Error("фото больше 5 МБ — уменьшите"); x.block={type:"image", source:{type:"base64", media_type:d.mime, data:d.data}, _n:f.name}; }
    else throw new Error(/heic|heif/.test(d.mime)?"фото HEIC Claude не читает — сохраните как JPG":"такой файл помощник не читает");
  }catch(e){ x.err=String(e.message||e); }
  x.busy=0; acFilesDraw(); if(x.err){ toast("warn","Файл «"+f.name+"» не приложен", x.err); AC.files.splice(AC.files.indexOf(x),1); setTimeout(acFilesDraw,2500); } }
function acFilesDraw(){ const b=document.getElementById("ac-fs"); if(!b) return; b.innerHTML=AC.files.map((f,i)=>`<span class="${f.err?"err":""}">📎 <i>${esc(f.name)}</i>${f.busy?" …":""}<button type="button" data-acfx="${i}" aria-label="Убрать">×</button></span>`).join(""); }
/* кнопка — только у Даниила, после входа; в «Почте ФД» нет; на телефоне — над нижним меню */
function acFab(){ const f=document.getElementById("ac-fab"); if(!f) return; const n=acDue().length; let b=f.querySelector("b"); if(n){ if(!b){ b=document.createElement("b"); f.appendChild(b); } b.textContent=n; } else if(b) b.remove();
  const mb=document.getElementById("mbar"), h=mb && !mb.hidden && getComputedStyle(mb).display!=="none" ? mb.getBoundingClientRect().height : 0; f.style.bottom=(h ? h+12 : 16)+"px"; }
setInterval(()=>{ try{ const ok=acOk(); if(!ok && !document.getElementById("ac-fab")) return; acEl(); const f=document.getElementById("ac-fab"); f.hidden=!ok||AC.open; if(!ok && AC.open) acShow(false); if(ok) acFab(); }catch(e){} }, 1500);
