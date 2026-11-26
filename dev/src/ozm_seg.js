/* ===== Озон — управление магазином (26.11.2026, просьба Даниила: ключ с ролью Admin — «перенеси на вкладку все функции API Озона») =====
   Разделы во вкладке «Озон» рядом со «Сводкой» и «Выплатами»: Товары (цены, остатки, архив, артикул), Заказы (сборка, отгрузка, доставка,
   отмена, этикетки, FBO), Возвраты (и решения по возвратам realFBS), Чаты с покупателями, Отзывы и вопросы (ответы), Акции (вручную),
   Аналитика (заказы по дням и товарам), Склады и рейтинг.
   Запросы идут через Code.gs ≥ 57 (действие ozon, op "api") — скрипт пересылает их в Seller API; то, что меняет магазин, помечается полем w
   и попадает в «События». Данные разделов — только в памяти страницы (каждый раз свежие из Озона).
   Формат ответов Озона взят из документации Seller API; разбор нарочно «мягкий» (ozmA/ozmN) — если Озон поменяет поле, раздел не упадёт. */
const OZM_V=[["goods","Товары"],["orders","Заказы"],["ret","Возвраты"],["chat","Чаты"],["rev","Отзывы и вопросы"],["act","Акции"],["an","Аналитика"],["wh","Склады и рейтинг"]];
const ozmIs=v=>OZM_V.some(x=>x[0]===v);
const OZM={c:{}, busy:{}, err:{}, at:{}, sel:new Set(), q:"", gf:"all", gs:"name", of:"new", os:"fbs", od:30, rk:"rev", rf:"new", qf:"new", an:30, rt:"all", chat:"", chd:{}, cf:"all", wh:null};
const ozmOk=()=>(D.srvVer||0)>=57;
function ozmSid(){ const K=OZ.keys||[]; if(!K.length) return ""; const k=K.find(x=>x.id===OZU.st); return (k||K[0]).id; }
const ozmN=v=>{ if(v==null||v==="") return 0; if(typeof v==="object") v=v.amount!=null?v.amount:v.value; const n=+String(v).replace(",",".").replace(/\s/g,""); return isFinite(n)?n:0; };
const ozmA=(b, ...keys)=>{ for(const k of keys){ let o=b; for(const p of k.split(".")){ o=o==null?undefined:o[p]; } if(Array.isArray(o)) return o; } return []; };
const ozmR=v=>Math.round(ozmN(v)).toLocaleString("ru-RU")+" ₽";
const ozmDt=s=>{ if(!s) return ""; const d=new Date(s); if(isNaN(d)) return String(s).slice(0,10); return d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit"})+" "+d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}); };
const ozmD=s=>{ if(!s) return ""; const d=new Date(s); return isNaN(d)?String(s).slice(0,10):d.toLocaleDateString("ru-RU"); };
const ozmIsoAgo=n=>new Date(Date.now()-n*864e5).toISOString();
function ozmErrTxt(r, path){ const m=r&&r.body&&(r.body.message||r.body.error&&r.body.error.message)||r&&r.text||"";
  if(r&&(r.code===403||r.code===401)) return "Озон не дал доступ"+(m?" — "+m:"")+". Нужен ключ с ролью Admin; чаты, отзывы и вопросы Озон даёт только с подпиской Premium Plus";
  if(r&&r.code===404) return "Озон не знает такой запрос ("+path+") — возможно, он его отключил";
  if(r&&r.code===429) return "Слишком много запросов — Озон просит подождать минуту";
  return "Озон ответил "+(r&&r.code||"нет связи")+(m?" — "+m:""); }
/* один запрос; o: {get, w — что меняем (для «Событий»), bodies — несколько тел, all — вернуть все ответы} */
async function ozmApi(path, body, o){ o=o||{}; const sid=ozmSid(); if(!sid) throw new Error("не подключён ключ Озона");
  if(!ozmOk()) throw new Error("нужен новый скрипт таблицы (Code.gs ≥ 57) — «Как обновить» в жёлтой плашке сверху");
  const j=await api({action:"ozon", op:"api", id:sid, path, method:o.get?"get":"post", body:body||{}, bodies:o.bodies, w:o.w||""});
  if(!j||j.ok===false) throw new Error(j&&(j.error||j.err)||"нет связи с таблицей");
  if(o.all) return j.res; const r=(j.res||[])[0]; if(!r||r.code!==200) throw new Error(ozmErrTxt(r, path)); return r.pdf?{pdf:r.pdf}:r.body||{}; }
async function ozmMany(path, bodies, w){ const out=[]; for(let i=0;i<bodies.length;i+=40){ const R=await ozmApi(path, null, {bodies:bodies.slice(i,i+40), all:true, w:i?"":w}); R.forEach(r=>{ if(r.code!==200) throw new Error(ozmErrTxt(r, path)); out.push(r.body||{}); }); } return out; }
const ozmChunk=(L,n)=>{ const o=[]; for(let i=0;i<L.length;i+=n) o.push(L.slice(i,i+n)); return o; };
/* загрузка раздела: один раз, дальше — «Обновить» */
async function ozmLoad(v, force){ if(OZM.busy[v]) return; if(!force && OZM.c[v] && Date.now()-(OZM.at[v]||0)<10*60e3) return;
  const L=OZM_LD[v]; if(!L) return; OZM.busy[v]=1; OZM.err[v]=""; ozmPaint();
  try{ OZM.c[v]=await L(); OZM.at[v]=Date.now(); }catch(e){ OZM.err[v]=e.message||String(e); }
  OZM.busy[v]=0; ozmPaint(); }
/* ---------- товары ---------- */
async function ozmGoodsLoad(){ const ids=[]; let last="";
  for(let i=0;i<30;i++){ const b=await ozmApi("/v3/product/list", {filter:{visibility:"ALL"}, last_id:last, limit:1000}); const R=b.result||b, L=ozmA(R,"items");
    L.forEach(x=>ids.push(x)); if(L.length<1000||!R.last_id||R.last_id===last) break; last=R.last_id; }
  const M=new Map(); ids.forEach(x=>M.set(String(x.product_id), {id:String(x.product_id), art:String(x.offer_id||""), arch:!!x.archived, name:"", st:{fbo:[0,0], fbs:[0,0], rfbs:[0,0]}}));
  const pid=[...M.keys()];
  if(pid.length){ const res=await ozmMany("/v3/product/info/list", ozmChunk(pid,100).map(c=>({product_id:c})));
    res.forEach(b=>ozmA(b,"items","result.items").forEach(x=>{ const g=M.get(String(x.id)); if(!g) return; const src=ozmA(x,"sources");
      Object.assign(g, {name:x.name||g.art, art:String(x.offer_id||g.art), sku:String(x.sku||x.fbs_sku||x.fbo_sku||(src[0]&&src[0].sku)||""), img:Array.isArray(x.primary_image)?x.primary_image[0]:x.primary_image||(ozmA(x,"images")[0])||"",
        price:ozmN(x.price), old:ozmN(x.old_price), min:ozmN(x.min_price), stName:x.statuses&&(x.statuses.status_name||x.statuses.status)||x.status&&x.status.state_name||"",
        stFail:!!(x.statuses&&(x.statuses.status_failed||x.statuses.is_failed))||ozmA(x,"errors").length>0, errs:ozmA(x,"errors").map(e=>e.texts&&e.texts.short_description||e.description||e.code||"").filter(Boolean),
        arch:x.is_archived!=null?(!!x.is_archived||!!x.is_autoarchived):g.arch, vis:x.visible!=null?!!x.visible:!!(x.visibility_details&&(x.visibility_details.has_price!==false&&x.visibility_details.has_stock!==false)) }); })); }
  let cur=""; for(let i=0;i<30;i++){ const b=await ozmApi("/v4/product/info/stocks", {filter:{visibility:"ALL"}, limit:1000, cursor:cur}); const L=ozmA(b,"items","result.items");
    L.forEach(x=>{ const g=M.get(String(x.product_id)); if(!g) return; ozmA(x,"stocks").forEach(s=>{ const t=String(s.type||"").toLowerCase(), k=t==="fbo"?"fbo":t==="rfbs"?"rfbs":"fbs"; g.st[k][0]+=ozmN(s.present); g.st[k][1]+=ozmN(s.reserved); }); });
    if(L.length<1000||!b.cursor||b.cursor===cur) break; cur=b.cursor; }
  cur=""; for(let i=0;i<30;i++){ const b=await ozmApi("/v5/product/info/prices", {filter:{visibility:"ALL"}, limit:1000, cursor:cur}); const L=ozmA(b,"items","result.items");
    L.forEach(x=>{ const g=M.get(String(x.product_id)); if(!g) return; const p=x.price||{}, c=x.commissions||{};
      Object.assign(g, {price:ozmN(p.price)||g.price, old:ozmN(p.old_price), min:ozmN(p.min_price), mkt:ozmN(p.marketing_seller_price||p.marketing_price), auto:String(p.auto_action_enabled)==="true"||p.auto_action_enabled===true,
        pFbo:ozmN(c.sales_percent_fbo), pFbs:ozmN(c.sales_percent_fbs||c.sales_percent_rfbs), idx:x.price_indexes&&(x.price_indexes.color_index||x.price_indexes.price_index)||""}); });
    if(L.length<1000||!b.cursor||b.cursor===cur) break; cur=b.cursor; }
  return [...M.values()]; }
const ozmStock=g=>g.st.fbo[0]+g.st.fbs[0]+g.st.rfbs[0];
const OZM_GF=[["all","Все"],["sale","Продаются"],["out","Нет в наличии"],["err","С ошибками"],["arch","В архиве"]];
function ozmGoodsF(L){ const f=OZM.gf, q=OZM.q.trim().toLowerCase();
  return L.filter(g=>(f==="all"?!g.arch:f==="arch"?g.arch:f==="sale"?!g.arch&&ozmStock(g)>0:f==="out"?!g.arch&&ozmStock(g)<=0:f==="err"?g.stFail:true)
    && (!q||(g.name+" "+g.art+" "+g.sku).toLowerCase().includes(q))); }
/* экономика товара за 30 дней (как «Контроль цен»): без убытка p0, для цели pt — считается раз в минуту */
const OZMG={at:0, M:null};
function ozmGuardOf(art){ if(!OZMG.M||Date.now()-OZMG.at>60e3){ OZMG.M={}; OZMG.at=Date.now(); try{ const C=typeof ozCalc==="function"&&OZ.d?ozCalc({a:ozAdd(todayISO(),-29), b:todayISO(), sch:"all"}):null; if(C) C.L.forEach(p=>{ if(!p.tanya&&p.g) OZMG.M[p.art]=p.g; }); }catch(e){} }
  return OZMG.M[art]||null; }
function ozmGoodsHtml(){ const L=OZM.c.goods||[], F=ozmGoodsF(L).sort((a,b)=>OZM.gs==="price"?b.price-a.price:OZM.gs==="stock"?ozmStock(b)-ozmStock(a):OZM.gs==="stock0"?ozmStock(a)-ozmStock(b):a.name.localeCompare(b.name,"ru"));
  const sel=[...OZM.sel].filter(id=>F.some(g=>g.id===id));
  return `<div class="ozmbar"><div class="pfchips ozseg">${OZM_GF.map(([v,t])=>`<button type="button" data-ozmgf="${v}" class="${OZM.gf===v?"on":""}" aria-pressed="${OZM.gf===v}">${t} <small>${L.filter(g=>v==="all"?!g.arch:v==="arch"?g.arch:v==="sale"?!g.arch&&ozmStock(g)>0:v==="out"?!g.arch&&ozmStock(g)<=0:g.stFail).length}</small></button>`).join("")}</div>
    <input type="search" class="ozmq" data-ozmq placeholder="Название, артикул или SKU" value="${esc(OZM.q)}" autocomplete="off">
    <select data-native data-ozmgs aria-label="Порядок">${[["name","По названию"],["price","Дороже"],["stock","Больше остаток"],["stock0","Меньше остаток"]].map(([v,t])=>`<option value="${v}"${OZM.gs===v?" selected":""}>${t}</option>`).join("")}</select></div>
  ${sel.length?`<div class="ozmsel"><b>Выбрано: ${sel.length}</b><button type="button" class="btn sm" data-ozm="bprice">Изменить цену на %</button>${OZM.gf==="arch"?`<button type="button" class="btn sm" data-ozm="bunarch">Вернуть из архива</button>`:`<button type="button" class="btn sm" data-ozm="barch" data-ozm2>В архив</button>`}<button type="button" class="btn sm ghost" data-ozm="bnone">Снять выбор</button></div>`:""}
  ${F.length?`<div class="ozmlist ozmg">${F.slice(0, OZM.gn||60).map(g=>{ const s=ozmStock(g), gd=ozmGuardOf(g.art), low=gd&&gd.p0&&g.price&&g.price<gd.p0;
    return `<div class="ozmr" data-ozmp="${esc(g.id)}" role="button" tabindex="0"><label class="ozmck" title="Выбрать"><input type="checkbox" data-ozmsel="${esc(g.id)}"${OZM.sel.has(g.id)?" checked":""}></label>
      <span class="ozmimg">${g.img?`<img src="${esc(g.img)}" alt="" loading="lazy">`:""}</span>
      <span class="ozmt"><b>${esc(g.name||g.art)}</b><small>${esc(g.art)}${g.sku?" · SKU "+esc(g.sku):""}${g.stName?` · <span class="${g.stFail?"neg":""}">${esc(g.stName)}</span>`:""}</small></span>
      <span class="ozmc"><b>${g.price?ozmR(g.price):"—"}</b><small>${g.old>g.price?`<s>${ozmR(g.old)}</s>`:""}${low?`<em class="neg">без убытка от ${ozmR(gd.p0)}</em>`:""}</small></span>
      <span class="ozmc"><b class="${s>0?"":"neg"}">${s} шт</b><small>${g.st.fbo[0]?"FBO "+g.st.fbo[0]:""}${g.st.fbo[0]&&(g.st.fbs[0]+g.st.rfbs[0])?" · ":""}${g.st.fbs[0]+g.st.rfbs[0]?"свой склад "+(g.st.fbs[0]+g.st.rfbs[0]):""}${s?"":"нет в наличии"}</small></span><i aria-hidden="true">›</i></div>`; }).join("")}</div>
    ${F.length>(OZM.gn||60)?`<button type="button" class="btn sm ghost ozmmore" data-ozm="gmore">Показать ещё (${F.length-(OZM.gn||60)})</button>`:""}`
  :`<div class="pvempty sm"><b>${L.length?"Ничего не нашлось":"Товаров пока нет"}</b></div>`}`; }
/* окно товара: цены, остатки по складам, архив, артикул, описание, рейтинг контента */
async function ozmProd(id){ const g=(OZM.c.goods||[]).find(x=>x.id===id); if(!g){ toast("info","Товар не найден — обновите список"); return; }
  const gd=ozmGuardOf(g.art), st=OZM.wh||[];
  const head=ozHead("Озон · товар", esc(g.name), esc(g.art)+(g.sku?" · SKU "+esc(g.sku):""));
  const body=`<div class="ozmpc">${g.img?`<img class="ozmpi" src="${esc(g.img)}" alt="">`:""}<div><div class="ozmst ${g.stFail?"bad":g.arch?"":"ok"}">${g.arch?"В архиве":esc(g.stName||"—")}</div>
      ${g.errs&&g.errs.length?`<div class="ozmerr">${g.errs.map(esc).join("<br>")}</div>`:""}
      ${g.sku?`<a class="btn sm ghost" href="https://www.ozon.ru/product/${esc(g.sku)}/" target="_blank" rel="noopener">Открыть на Озоне ↗</a>`:""}</div></div>
    <div class="ozd-h">Цена</div>
    <div class="ozmf"><label>Цена продажи, ₽<input type="text" inputmode="decimal" data-money id="ozm-p" value="${g.price||""}"></label>
      <label>Цена до скидки (зачёркнутая), ₽<input type="text" inputmode="decimal" data-money id="ozm-o" value="${g.old||""}"></label>
      <label>Минимальная цена, ₽<input type="text" inputmode="decimal" data-money id="ozm-m" value="${g.min||""}"></label>
      <label class="ozmchk"><input type="checkbox" id="ozm-a"${g.auto?" checked":""}> Озон сам добавляет товар в акции</label></div>
    <div class="ozmhint" id="ozm-ph">${ozmPriceHint(g, g.price, gd)}</div>
    <div class="ozmact"><button type="button" class="btn pri" data-ozmd="price">Сохранить цену</button>${g.mkt?`<small class="muted">Покупатель сейчас видит ≈ ${ozmR(g.mkt)} (со скидками Озона)</small>`:""}</div>
    ${g.pFbo||g.pFbs?`<small class="muted">Комиссия Озона: FBO ${g.pFbo||"—"}% · FBS/realFBS ${g.pFbs||"—"}%${g.idx?" · индекс цены: "+esc(ozmIdx(g.idx)):""}</small>`:""}
    <div class="ozd-h">Остатки</div>
    <div class="ozd-r static"><span><b>На складах Озона (FBO)</b><small>меняются только поставкой</small></span><b>${g.st.fbo[0]} шт${g.st.fbo[1]?` <small>· резерв ${g.st.fbo[1]}</small>`:""}</b></div>
    <div id="ozm-whs"><div class="ozbusy sm"><span class="spin"></span> Загружаю остатки на ваших складах…</div></div>
    <div class="ozd-h">Ещё</div>
    <div class="ozmact ozmw"><button type="button" class="btn sm" data-ozmd="art">Изменить артикул</button><button type="button" class="btn sm" data-ozmd="desc">Описание</button><button type="button" class="btn sm" data-ozmd="rate">Рейтинг карточки</button>
      ${g.arch?`<button type="button" class="btn sm" data-ozmd="unarch">Вернуть из архива</button>`:`<button type="button" class="btn sm" data-ozmd="arch" data-ozm2>В архив</button>`}</div>
    <div id="ozm-more"></div>`;
  CARD_RE=()=>ozmProd(id); openCard(head+`<div class="ozd ozmd" data-ozmid="${esc(id)}">${body}</div>`, true, ()=>{}); ozmDlg();
  const box=$("#fd-dcard #ozm-whs"); if(!box) return;
  try{ if(!OZM.wh) OZM.wh=await ozmWh(); const W=OZM.wh.filter(w=>!/fbo/i.test(w.type));
    let S=[]; if(g.sku){ const b=await ozmApi("/v1/product/info/stocks-by-warehouse/fbs", {sku:[g.sku]}); S=ozmA(b,"result","items"); }
    const cur=w=>{ const x=S.find(s=>String(s.warehouse_id)===String(w.id)); return x?[ozmN(x.present), ozmN(x.reserved)]:[0,0]; };
    box.innerHTML=W.length?W.map(w=>{ const [p,r]=cur(w); return `<div class="ozd-r static ozmwh"><span><b>${esc(w.name)}</b><small>${esc(w.rfbs?"realFBS":"FBS")}${r?" · в заказах "+r+" шт":""}${w.off?" · склад выключен":""}</small></span>
        <span class="ozmwi"><input type="text" inputmode="numeric" data-ozmwh="${esc(w.id)}" value="${p}" aria-label="Остаток на складе ${esc(w.name)}"><small>шт</small></span></div>`; }).join("")+`<div class="ozmact"><button type="button" class="btn" data-ozmd="stock">Сохранить остатки</button><small class="muted">Пишется, сколько товара есть на складе (вместе с тем, что в заказах).</small></div>`
      :`<small class="muted">Ваших складов (FBS / realFBS) в Озоне нет.</small>`; }
  catch(e){ box.innerHTML=`<div class="ozerr">Остатки не загрузились: ${esc(e.message)}</div>`; } }
const ozmIdx=v=>({GREEN:"выгодная", YELLOW:"умеренная", RED:"невыгодная", WITHOUT_INDEX:"нет"}[String(v).toUpperCase()]||v);
function ozmPriceHint(g, p, gd){ if(!gd||!gd.p0) return `<small class="muted">Чтобы сайт подсказал цену без убытка, впишите себестоимость товара в «Сводке за период».</small>`;
  return `<span class="${p&&p<gd.p0?"neg":"pos"}">Без убытка — от ${ozmR(gd.p0)}</span> · прибыль ${ozTarget()} ₽ с 1 шт — от ${ozmR(gd.pt)}${p?` · по ${ozmR(p)} с 1 шт ≈ <b>${ozmR(((p*(1-gd.r)-gd.fix)*(1-ozTax()/100))-(gd.c||0))}</b>`:""}`; }
async function ozmWh(){ const b=await ozmApi("/v1/warehouse/list", {}); return ozmA(b,"result","warehouses").map(w=>({id:String(w.warehouse_id||w.id), name:w.name||("Склад "+(w.warehouse_id||w.id)), rfbs:!!w.is_rfbs, type:w.is_rfbs?"rfbs":"fbs", off:/disabled|blocked|archived/i.test(String(w.status||"")), st:w.status||"", raw:w})); }
/* ---------- заказы ---------- */
const OZM_OS={awaiting_registration:"Ждёт регистрации", acceptance_in_progress:"Приёмка", awaiting_approve:"Ждёт подтверждения", awaiting_packaging:"Ждёт сборки", awaiting_verification:"Проверка", awaiting_deliver:"Ждёт отгрузки", arbitration:"Арбитраж", client_arbitration:"Арбитраж", delivering:"Доставляется", driver_pickup:"У водителя", delivered:"Доставлен", cancelled:"Отменён", not_accepted:"Не принят", sent_by_seller:"Отправлен вами"};
const OZM_OF=[["new","Собрать"],["ship","Отгрузить"],["go","В доставке"],["done","Доставлены"],["canc","Отменены"],["all","Все"]];
const ozmOfOk=(f,s)=>f==="all"||(f==="new"?s==="awaiting_packaging"||s==="awaiting_approve":f==="ship"?s==="awaiting_deliver":f==="go"?/delivering|driver_pickup|sent_by_seller|arbitration/.test(s):f==="done"?s==="delivered":f==="canc"?/cancel|not_accepted/.test(s):false);
async function ozmOrdersLoad(){ const since=ozmIsoAgo(OZM.od), to=new Date(Date.now()+864e5).toISOString(), out=[];
  if(OZM.os==="fbo"){ for(let off=0; off<10000; off+=1000){ const b=await ozmApi("/v2/posting/fbo/list", {dir:"DESC", filter:{since, to}, limit:1000, offset:off, with:{analytics_data:true, financial_data:true}}); const L=ozmA(b,"result","result.postings","postings"); L.forEach(x=>out.push(ozmPost(x,"FBO"))); if(L.length<1000) break; } return out; }
  for(let off=0; off<20000; off+=1000){ const b=await ozmApi("/v3/posting/fbs/list", {dir:"DESC", filter:{since, to}, limit:1000, offset:off, with:{analytics_data:true, financial_data:true}}); const R=b.result||b, L=ozmA(R,"postings");
    L.forEach(x=>out.push(ozmPost(x,"FBS"))); if(!R.has_next||L.length<1000) break; }
  return out; }
function ozmPost(x, sch){ const P=ozmA(x,"products"), dm=x.delivery_method||{}, ad=x.customer&&x.customer.address||x.addressee||{};
  return {n:String(x.posting_number||""), ord:String(x.order_number||x.order_id||""), st:String(x.status||""), sub:String(x.substatus||""), at:x.in_process_at||x.created_at||"", ship:x.shipment_date||"", sch,
    rfbs:/non_integrated|aggregator|3pl_tracking/i.test(String(x.tpl_integration_type||""))||!!(dm.warehouse&&/rfbs/i.test(dm.warehouse)), dm:dm.name||"", wh:dm.warehouse||"", track:x.tracking_number||"",
    sum:P.reduce((a,p)=>a+ozmN(p.price)*(+p.quantity||1),0), P:P.map(p=>({sku:String(p.sku||""), art:String(p.offer_id||""), name:p.name||p.offer_id||"", q:+p.quantity||1, price:ozmN(p.price)})),
    addr:ad.address_tail||ad.name||"", who:x.customer&&x.customer.name||"", city:x.analytics_data&&x.analytics_data.city||"", fin:x.financial_data||null, cancel:x.cancellation&&x.cancellation.cancel_reason||"", raw:x}; }
function ozmLate(o){ if(!o.ship||!/awaiting_packaging|awaiting_deliver/.test(o.st)) return ""; const d=new Date(o.ship), h=(d-Date.now())/36e5; return h<0?"late":h<24?"soon":""; }
function ozmOrdersHtml(){ const L=OZM.c.orders||[], f=OZM.os==="fbo"?(OZM.of==="new"||OZM.of==="ship"?"all":OZM.of):OZM.of, F=L.filter(o=>ozmOfOk(f,o.st)&&(!OZM.q||(o.n+" "+o.P.map(p=>p.name+" "+p.art).join(" ")+" "+o.addr).toLowerCase().includes(OZM.q.toLowerCase())));
  const cnt=v=>L.filter(o=>ozmOfOk(v,o.st)).length, sel=[...OZM.sel].filter(n=>F.some(o=>o.n===n)), selO=F.filter(o=>sel.includes(o.n));
  return `<div class="ozmbar"><div class="pfchips ozseg">${[["fbs","realFBS / FBS"],["fbo","FBO (со склада Озона)"]].map(([v,t])=>`<button type="button" data-ozmos="${v}" class="${OZM.os===v?"on":""}">${t}</button>`).join("")}</div>
    <div class="pfchips ozseg">${[[7,"7 дней"],[30,"30 дней"],[90,"90 дней"]].map(([v,t])=>`<button type="button" data-ozmod="${v}" class="${OZM.od===v?"on":""}">${t}</button>`).join("")}</div></div>
  <div class="ozmbar"><div class="pfchips ozseg">${OZM_OF.filter(x=>OZM.os!=="fbo"||!/new|ship/.test(x[0])).map(([v,t])=>`<button type="button" data-ozmof="${v}" class="${f===v?"on":""}">${t} <small>${cnt(v)}</small></button>`).join("")}</div>
    <input type="search" class="ozmq" data-ozmq placeholder="Номер, товар, адрес" value="${esc(OZM.q)}" autocomplete="off"></div>
  ${sel.length?`<div class="ozmsel"><b>Выбрано: ${sel.length}</b>${selO.some(o=>o.st==="awaiting_packaging")?`<button type="button" class="btn sm pri" data-ozm="oship">Собрать выбранные</button>`:""}${selO.some(o=>o.st==="awaiting_deliver"&&o.rfbs)?`<button type="button" class="btn sm" data-ozm="odeliv">Передать в доставку</button>`:""}${selO.some(o=>o.st==="awaiting_deliver"&&!o.rfbs)?`<button type="button" class="btn sm" data-ozm="olabel">Этикетки PDF</button>`:""}<button type="button" class="btn sm ghost" data-ozm="bnone">Снять выбор</button></div>`:""}
  ${F.length?`<div class="ozmlist ozmo">${F.slice(0, OZM.on||60).map(o=>{ const lt=ozmLate(o);
    return `<div class="ozmr" data-ozmo="${esc(o.n)}" role="button" tabindex="0">${OZM.os==="fbs"?`<label class="ozmck"><input type="checkbox" data-ozmsel="${esc(o.n)}"${OZM.sel.has(o.n)?" checked":""}></label>`:""}
      <span class="ozmt"><b>${esc(o.P.map(p=>p.name+(p.q>1?" × "+p.q:"")).join(", "))}</b><small>№ ${esc(o.n)} · ${ozmDt(o.at)}${o.city?" · "+esc(o.city):""}${o.rfbs?" · realFBS":o.sch==="FBS"?" · FBS":""}</small>
        ${o.ship&&/awaiting/.test(o.st)?`<small class="ozmdl ${lt}">${lt==="late"?"Просрочено! отгрузить до ":"Отгрузить до "}${ozmDt(o.ship)}</small>`:""}</span>
      <span class="ozmc"><b>${ozmR(o.sum)}</b><small class="ozmos s-${esc(o.st)}">${esc(OZM_OS[o.st]||o.st)}</small></span>
      <span class="ozmqa">${ozmQuick(o)}</span><i aria-hidden="true">›</i></div>`; }).join("")}</div>
    ${F.length>(OZM.on||60)?`<button type="button" class="btn sm ghost ozmmore" data-ozm="omore">Показать ещё (${F.length-(OZM.on||60)})</button>`:""}`
  :`<div class="pvempty sm"><b>${L.length?"В этом списке заказов нет":"Заказов за "+OZM.od+" дней нет"}</b></div>`}`; }
function ozmQuick(o){ if(o.sch!=="FBS") return "";
  if(o.st==="awaiting_packaging") return `<button type="button" class="btn sm pri" data-ozmoa="ship" data-n="${esc(o.n)}">Собрать</button>`;
  if(o.st==="awaiting_deliver") return o.rfbs?`<button type="button" class="btn sm" data-ozmoa="deliv" data-n="${esc(o.n)}">Передал в доставку</button>`:`<button type="button" class="btn sm" data-ozmoa="label" data-n="${esc(o.n)}">Этикетка</button>`;
  if(o.st==="delivering" && o.rfbs) return `<button type="button" class="btn sm" data-ozmoa="done" data-n="${esc(o.n)}" data-ozm2>Доставлен</button>`;
  return ""; }
function ozmOrd(n){ return (OZM.c.orders||[]).find(o=>o.n===n); }
async function ozmOrder(n){ const o0=ozmOrd(n); if(!o0){ toast("info","Заказ не найден — обновите список"); return; }
  const draw=o=>{ const fin=o.fin||{}, FP=ozmA(fin,"products"), pay=FP.reduce((a,p)=>a+ozmN(p.payout),0), com=FP.reduce((a,p)=>a+ozmN(p.commission_amount),0);
    const ad=o.raw.customer&&o.raw.customer.address||{}, ph=o.raw.customer&&o.raw.customer.phone||o.raw.addressee&&o.raw.addressee.phone||"";
    const canC=/awaiting_packaging|awaiting_deliver|awaiting_approve/.test(o.st)&&o.sch==="FBS";
    CARD_RE=()=>ozmOrder(n);
    openCard(ozHead("Озон · заказ "+esc(o.sch==="FBO"?"FBO":o.rfbs?"realFBS":"FBS"), "№ "+esc(o.n), esc(OZM_OS[o.st]||o.st)+" · "+ozmDt(o.at))+`<div class="ozd ozmd" data-ozmon="${esc(n)}">
      ${o.ship&&/awaiting/.test(o.st)?`<div class="ozmdl big ${ozmLate(o)}">Отгрузить до ${ozmDt(o.ship)}</div>`:""}
      <div class="ozd-h">Товары</div>${o.P.map(p=>`<div class="ozd-r static"><span><b>${esc(p.name)}</b><small>${esc(p.art)}${p.sku?" · SKU "+esc(p.sku):""}</small></span><b>${p.q} × ${ozmR(p.price)}</b></div>`).join("")}
      <div class="ozd-r static tot"><span><b>Сумма заказа</b></span><b>${ozmR(o.sum)}</b></div>
      ${FP.length&&(pay||com)?`<div class="ozd-r static"><span><b>Комиссия Озона</b></span><b class="neg">${ozmR(-Math.abs(com))}</b></div><div class="ozd-r static"><span><b>Вам перечислят</b><small>без логистики и других услуг</small></span><b>${ozmR(pay)}</b></div>`:""}
      ${o.dm||ad.address_tail||o.who?`<div class="ozd-h">Доставка</div>${o.dm?`<div class="ozd-r static"><span><b>Способ</b></span><b>${esc(o.dm)}</b></div>`:""}${o.wh?`<div class="ozd-r static"><span><b>Склад</b></span><b>${esc(o.wh)}</b></div>`:""}
        ${o.who?`<div class="ozd-r static"><span><b>Покупатель</b></span><b>${esc(o.who)}${ph?` · <a href="tel:${esc(ph)}">${esc(ph)}</a>`:""}</b></div>`:""}${ad.address_tail?`<div class="ozd-r static"><span><b>Адрес</b><small>${esc([ad.city, ad.address_tail].filter(Boolean).join(", "))}${ad.comment?" · "+esc(ad.comment):""}</small></span></div>`:""}
        ${o.track?`<div class="ozd-r static"><span><b>Трек-номер</b></span><b>${esc(o.track)}</b></div>`:""}`:""}
      ${o.cancel?`<div class="ozmerr">Причина отмены: ${esc(o.cancel)}</div>`:""}
      ${o.sch==="FBS"?`<div class="ozd-h">Действия</div><div class="ozmact ozmw">
        ${o.st==="awaiting_packaging"?`<button type="button" class="btn pri" data-ozmoa="ship" data-n="${esc(n)}">Собрать заказ</button>`:""}
        ${o.st==="awaiting_deliver"&&!o.rfbs?`<button type="button" class="btn" data-ozmoa="label" data-n="${esc(n)}">Этикетка PDF</button>`:""}
        ${o.rfbs&&o.st==="awaiting_deliver"?`<button type="button" class="btn pri" data-ozmoa="deliv" data-n="${esc(n)}">Передал в доставку</button>`:""}
        ${o.rfbs&&o.st==="delivering"?`<button type="button" class="btn" data-ozmoa="mile" data-n="${esc(n)}">Последняя миля</button><button type="button" class="btn pri" data-ozmoa="done" data-n="${esc(n)}" data-ozm2>Доставлен</button>`:""}
        ${o.rfbs&&/awaiting_deliver|delivering/.test(o.st)?`<button type="button" class="btn sm" data-ozmoa="track" data-n="${esc(n)}">Трек-номер</button>`:""}
        <button type="button" class="btn sm" data-ozmoa="chat" data-n="${esc(n)}">Написать покупателю</button>
        ${canC?`<button type="button" class="btn sm ghost neg" data-ozmoa="cancel" data-n="${esc(n)}">Отменить заказ…</button>`:""}</div>`:""}
      <div id="ozm-oform"></div></div>`, true, ()=>{}); ozmDlg(); };
  draw(o0);
  if(o0.sch==="FBS"){ try{ const b=await ozmApi("/v3/posting/fbs/get", {posting_number:n, with:{analytics_data:true, financial_data:true}}); const x=b.result||b; if(x&&x.posting_number){ const o=ozmPost(x,"FBS"); o.rfbs=o.rfbs||o0.rfbs; const L=OZM.c.orders||[], i=L.findIndex(y=>y.n===n); if(i>=0) L[i]=o; const d=$("#fd-dcard"); if(d&&d.open&&d.querySelector(`[data-ozmon="${CSS.escape(n)}"]`)&&!d.querySelector("#ozm-oform").innerHTML) draw(o); } }catch(e){} } }
async function ozmOrderAct(a, ns, btn){ const L=ns.map(ozmOrd).filter(Boolean); if(!L.length) return;
  const one=L.length===1, lab=one?"№ "+L[0].n:L.length+" "+plural(L.length,["заказ","заказа","заказов"]);
  try{
    if(a==="ship"){ const R=await ozmApi("/v4/posting/fbs/ship", null, {bodies:L.map(o=>({posting_number:o.n, packages:[{products:o.P.map(p=>({product_id:+p.sku, quantity:p.q}))}], with:{additional_data:true}})), all:true, w:"Собран заказ на Озоне: "+L.map(o=>o.n).join(", ")});
      const bad=R.map((r,i)=>r.code===200?null:L[i].n+": "+ozmErrTxt(r,"сборка")).filter(Boolean); if(bad.length) throw new Error(bad.join("; ")); toast("ok", one?"Заказ собран":"Собрано: "+L.length, "Озон перевёл в «Ждёт отгрузки»"); }
    else if(a==="deliv"){ await ozmApi("/v2/fbs/posting/delivering", {posting_number:L.map(o=>o.n)}, {w:"Заказ на Озоне передан в доставку: "+L.map(o=>o.n).join(", ")}); toast("ok","Передано в доставку", lab); }
    else if(a==="mile"){ await ozmApi("/v2/fbs/posting/last-mile", {posting_number:L.map(o=>o.n)}, {w:"Заказ на Озоне — последняя миля: "+L.map(o=>o.n).join(", ")}); toast("ok","Последняя миля", lab); }
    else if(a==="done"){ await ozmApi("/v2/fbs/posting/delivered", {posting_number:L.map(o=>o.n)}, {w:"Заказ на Озоне доставлен: "+L.map(o=>o.n).join(", ")}); toast("ok","Отмечено: доставлен", lab); }
    else if(a==="label"){ const b=await ozmApi("/v2/posting/fbs/package-label", {posting_number:L.map(o=>o.n)}); if(!b.pdf) throw new Error("Озон не прислал PDF — этикетку можно взять, когда заказ собран");
      const u8=Uint8Array.from(atob(b.pdf), c=>c.charCodeAt(0)), url=URL.createObjectURL(new Blob([u8],{type:"application/pdf"})), aa=document.createElement("a"); aa.href=url; aa.download="Этикетки Озон "+(one?L[0].n:fd(todayISO()))+".pdf"; document.body.appendChild(aa); aa.click(); aa.remove(); setTimeout(()=>URL.revokeObjectURL(url), 60e3); return; }
    else if(a==="chat"){ const b=await ozmApi("/v1/chat/start", {posting_number:L[0].n}); const id=b.result&&b.result.chat_id||b.chat_id; if(!id) throw new Error("Озон не открыл чат");
      navReset(); try{ $("#fd-dcard").close(); }catch(e){} OZU.v="chat"; ozUiSave(); OZM.chat=id; OZM.c.chat=null; ozDraw(); ozmLoad("chat", true); return; }
    else if(a==="track"||a==="cancel"){ ozmOrderForm(a, L[0]); return; }
    OZM.sel.clear(); OZM.c.orders=null; await ozmLoad("orders", true);
    const d=$("#fd-dcard"); if(d&&d.open&&d.querySelector("[data-ozmon]")) ozmOrder(L[0].n);
  }catch(e){ toast("err","Не получилось", e.message); } }
async function ozmOrderForm(a, o){ const box=$("#fd-dcard #ozm-oform"); if(!box) return;
  if(a==="track"){ box.innerHTML=`<div class="ozmform"><label>Трек-номер доставки<input type="text" id="ozm-trk" value="${esc(o.track)}" autocomplete="off"></label><div class="ozmact"><button type="button" class="btn pri" data-ozmof2="track" data-n="${esc(o.n)}">Сохранить трек-номер</button></div></div>`; $("#ozm-trk").focus(); return; }
  box.innerHTML=`<div class="ozbusy sm"><span class="spin"></span> Загружаю причины отмены…</div>`;
  try{ const b=await ozmApi("/v2/posting/fbs/cancel-reason/list", {}); const R=ozmA(b,"result").filter(r=>r.is_available_for_cancellation!==false&&(!r.type_id||r.type_id==="seller"));
    box.innerHTML=`<div class="ozmform"><b>Отмена заказа № ${esc(o.n)}</b><small class="muted">Частые отмены по вашей вине снижают рейтинг магазина.</small>
      <label>Причина<select id="ozm-cr" data-native>${R.map(r=>`<option value="${esc(r.id)}">${esc(r.title||r.name||r.id)}</option>`).join("")}</select></label>
      <label>Комментарий (если причина «Другое»)<input type="text" id="ozm-cm" autocomplete="off"></label>
      <div class="ozmact"><button type="button" class="btn neg" data-ozmof2="cancel" data-n="${esc(o.n)}" data-ozm2>Отменить заказ</button></div></div>`; }
  catch(e){ box.innerHTML=`<div class="ozerr">${esc(e.message)}</div>`; } }
/* ---------- возвраты ---------- */
async function ozmRetLoad(){ const out=[]; let last=0;
  for(let i=0;i<10;i++){ const b=await ozmApi("/v1/returns/list", {filter:{}, limit:500, last_id:last}); const L=ozmA(b,"returns","result.returns");
    L.forEach(x=>{ const p=x.product||{}, vs=x.visual&&x.visual.status||{}; out.push({id:String(x.id), n:String(x.posting_number||""), name:p.name||p.offer_id||"", art:p.offer_id||"", q:+p.quantity||1, price:ozmN(p.price&&p.price.price!=null?p.price.price:p.price), st:vs.display_name||x.status||"", why:x.return_reason_name||"", at:x.logistic&&(x.logistic.return_date||x.logistic.final_moment)||x.visual&&x.visual.change_moment||"", type:x.type||"", sch:x.schema||""}); });
    if(!b.has_next||!L.length) break; last=L[L.length-1].id; }
  let rf=[]; try{ const b=await ozmApi("/v2/returns/rfbs/list", {filter:{}, last_id:0, limit:100}); rf=ozmA(b,"returns","result.returns").map(x=>({rid:String(x.return_id||x.id), n:String(x.posting_number||""), name:x.product&&x.product.name||"", st:x.state&&(x.state.state_name||x.state.state)||"", stc:x.state&&x.state.state||"", at:x.created_at||"", raw:x})); }catch(e){ rf=null; }
  return {L:out, rf}; }
function ozmRetHtml(){ const C=OZM.c.ret||{L:[], rf:[]}, q=OZM.q.toLowerCase(), F=C.L.filter(r=>!q||(r.name+" "+r.n+" "+r.art).toLowerCase().includes(q)), sum=F.reduce((a,r)=>a+r.price*r.q,0);
  const rfw=(C.rf||[]).filter(r=>/new|wait|pending|review/i.test(r.stc));
  return `${C.rf&&C.rf.length?`<section class="ozmbox"><h4>Заявки на возврат realFBS <small>${C.rf.length}${rfw.length?" · ждут решения "+rfw.length:""}</small></h4><div class="ozmlist">${C.rf.map(r=>`<div class="ozmr" data-ozmrf="${esc(r.rid)}" role="button" tabindex="0"><span class="ozmt"><b>${esc(r.name||"Заказ "+r.n)}</b><small>№ ${esc(r.n)} · ${ozmD(r.at)}</small></span><span class="ozmc"><small class="ozmos ${/new|wait|pending|review/i.test(r.stc)?"s-awaiting_packaging":""}">${esc(r.st)}</small></span><i aria-hidden="true">›</i></div>`).join("")}</div></section>`:""}
  <div class="ozmbar"><input type="search" class="ozmq" data-ozmq placeholder="Товар или номер заказа" value="${esc(OZM.q)}" autocomplete="off"><small class="muted">Возвратов: ${F.length} · на ${ozmR(sum)}</small></div>
  ${F.length?`<div class="ozmlist">${F.slice(0,150).map(r=>`<div class="ozmr static"><span class="ozmt"><b>${esc(r.name)}</b><small>№ ${esc(r.n)} · ${esc(r.art)}${r.why?" · "+esc(r.why):""}</small></span><span class="ozmc"><b>${r.q} × ${ozmR(r.price)}</b><small>${esc(r.st)}${r.at?" · "+ozmD(r.at):""}</small></span></div>`).join("")}</div>`:`<div class="pvempty sm"><b>Возвратов нет</b></div>`}`; }
async function ozmRf(rid){ CARD_RE=()=>ozmRf(rid); openCard(ozHead("Озон · возврат realFBS", "Заявка на возврат", "")+`<div class="ozd ozmd" id="ozm-rf"><div class="ozbusy sm"><span class="spin"></span> Загружаю…</div></div>`, true, ()=>{}); ozmDlg();
  try{ const b=await ozmApi("/v2/returns/rfbs/get", {return_id:+rid||rid}); const x=b.returns||b.result||b, st=x.state||{}, p=x.product||{}, av=ozmA(x,"available_actions").map(a=>String(a.name||a.id||a)).join(" ").toLowerCase();
    const RR=ozmA(x,"rejection_reason");
    const box=$("#fd-dcard #ozm-rf"); if(!box) return;
    box.innerHTML=`<div class="ozd-r static"><span><b>${esc(p.name||"Товар")}</b><small>${esc(p.offer_id||"")} · заказ № ${esc(x.posting_number||"")}</small></span><b>${ozmR(p.price)}</b></div>
      <div class="ozd-r static"><span><b>Статус</b></span><b>${esc(st.state_name||st.state||"")}</b></div>
      ${x.return_reason&&x.return_reason.name?`<div class="ozd-r static"><span><b>Причина покупателя</b><small>${esc(x.client_return_method_type&&x.client_return_method_type.name||"")}</small></span><b>${esc(x.return_reason.name)}</b></div>`:""}
      ${x.client_comment?`<div class="ozmq2">«${esc(x.client_comment)}»</div>`:""}
      ${ozmA(x,"client_photo").length?`<div class="ozmph">${ozmA(x,"client_photo").map(u=>`<a href="${esc(u)}" target="_blank" rel="noopener"><img src="${esc(u)}" alt=""></a>`).join("")}</div>`:""}
      <div class="ozd-h">Решение</div>
      <div class="ozmform"><label>Как вернуть товар (для покупателя)<input type="text" id="ozm-rm" placeholder="Например: привезите на склад по адресу…" autocomplete="off"></label>
        <div class="ozmact ozmw"><button type="button" class="btn pri" data-ozmrfa="verify" data-id="${esc(rid)}">Одобрить возврат</button><button type="button" class="btn" data-ozmrfa="money" data-id="${esc(rid)}" data-ozm2>Вернуть деньги</button><button type="button" class="btn" data-ozmrfa="receive" data-id="${esc(rid)}">Товар получил</button></div>
        <label>Причина отказа${RR.length?`<select id="ozm-rr" data-native>${RR.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join("")}</select>`:""}</label><label>Комментарий к отказу<input type="text" id="ozm-rc" autocomplete="off"></label>
        <div class="ozmact"><button type="button" class="btn ghost neg" data-ozmrfa="reject" data-id="${esc(rid)}" data-ozm2>Отказать</button>${av?`<small class="muted">Озон разрешает сейчас: ${esc(av)}</small>`:""}</div></div>`; }
  catch(e){ const box=$("#fd-dcard #ozm-rf"); if(box) box.innerHTML=`<div class="ozerr">${esc(e.message)}</div>`; } }
async function ozmRfAct(a, rid){ const id=+rid||rid, rm=($("#ozm-rm")||{}).value||"", rc=($("#ozm-rc")||{}).value||"", rr=$("#ozm-rr");
  const P={verify:["/v2/returns/rfbs/verify", {return_id:id, return_method_description:rm||"Свяжемся с вами в чате"}, "Одобрен возврат realFBS"],
    money:["/v2/returns/rfbs/return-money", {return_id:id, return_for_back_way:0}, "Возврат денег покупателю realFBS"],
    receive:["/v2/returns/rfbs/receive-return", {return_id:id}, "Получен возвращённый товар realFBS"],
    reject:["/v2/returns/rfbs/reject", {return_id:id, comment:rc, rejection_reason_id:rr?+rr.value:0}, "Отказ в возврате realFBS"]}[a];
  if(!P) return; if(a==="reject"&&!rc.trim()){ toast("err","Напишите комментарий к отказу"); return; }
  try{ await ozmApi(P[0], P[1], {w:P[2]+" (заявка "+rid+")"}); toast("ok", P[2]); OZM.c.ret=null; ozmLoad("ret", true); ozmRf(rid); }catch(e){ toast("err","Не получилось", e.message); } }
/* ---------- чаты ---------- */
async function ozmChatLoad(){ let L=[], v3=true;
  try{ const b=await ozmApi("/v3/chat/list", {filter:{chat_status:"ALL", unread_only:false}, limit:100}); L=ozmA(b,"chats"); }
  catch(e){ v3=false; const b=await ozmApi("/v2/chat/list", {filter:{chat_status:"All", unread_only:false}, limit:100, offset:0}); L=ozmA(b,"chats","result"); }
  return L.map(x=>{ const c=x.chat||x; return {id:String(c.chat_id||x.chat_id), type:c.chat_type||"", st:c.chat_status||"", at:c.created_at||"", un:+x.unread_count||0, last:x.last_message_id||"", first:x.first_unread_message_id||""}; }).sort((a,b)=>b.un-a.un||String(b.last).localeCompare(String(a.last))); }
const OZM_CT={Seller_Support:"Поддержка Озона", Buyer_Seller:"Покупатель", SELLER_SUPPORT:"Поддержка Озона", BUYER_SELLER:"Покупатель", Seller_Notification:"Уведомления Озона", UNSPECIFIED:"Чат"};
function ozmChatHtml(){ const L=OZM.c.chat||[], cur=L.find(c=>c.id===OZM.chat), F=L.filter(c=>OZM.cf==="all"||(OZM.cf==="un"?c.un>0:/buyer/i.test(c.type)));
  const H=OZM.chd[OZM.chat];
  return `<div class="ozmchat${cur?" has":""}"><div class="ozmcl"><div class="pfchips ozseg">${[["all","Все"],["un","Непрочитанные"],["buy","Покупатели"]].map(([v,t])=>`<button type="button" data-ozmcf="${v}" class="${OZM.cf===v?"on":""}">${t}${v==="un"?` <small>${L.filter(c=>c.un).length}</small>`:""}</button>`).join("")}</div>
    ${F.length?F.map(c=>`<div class="ozmr ozmch${c.id===OZM.chat?" on":""}" data-ozmch="${esc(c.id)}" role="button" tabindex="0"><span class="ozmt"><b>${esc(OZM_CT[c.type]||c.type||"Чат")}</b><small>${ozmD(c.at)}${/closed/i.test(c.st)?" · закрыт":""}</small></span>${c.un?`<em class="ozmun">${c.un}</em>`:""}</div>`).join(""):`<div class="pvempty sm"><b>Чатов нет</b></div>`}</div>
  <div class="ozmcv">${cur?`<div class="ozmch-h"><button type="button" class="btn sm ghost ozmback" data-ozmch="">‹ Чаты</button><b>${esc(OZM_CT[cur.type]||"Чат")}</b></div>
    <div class="ozmmsgs" id="ozm-msgs">${!H?`<div class="ozbusy sm"><span class="spin"></span> Загружаю переписку…</div>`:H.err?`<div class="ozerr">${esc(H.err)}</div>`:H.L.length?H.L.map(m=>`<div class="ozmmsg ${m.me?"me":""}"><div>${m.html}</div><small>${esc(m.who)} · ${ozmDt(m.at)}</small></div>`).join(""):`<small class="muted">Сообщений нет</small>`}</div>
    ${/closed/i.test(cur.st)||/notification/i.test(cur.type)?`<small class="muted">В этот чат писать нельзя</small>`:`<div class="ozmsend"><textarea id="ozm-txt" rows="2" placeholder="Сообщение…" data-noarrow>${esc(OZM.draft||"")}</textarea><button type="button" class="btn pri" data-ozm="send">Отправить</button></div>`}`
    :`<div class="pvempty sm"><b>Выберите чат слева</b></div>`}</div></div>`; }
async function ozmChatOpen(id){ OZM.chat=id; ozmPaint(); if(!id) return;
  try{ let b; try{ b=await ozmApi("/v3/chat/history", {chat_id:id, direction:"Backward", limit:100}); }catch(e){ b=await ozmApi("/v2/chat/history", {chat_id:id, direction:"Backward", limit:100}); }
    const L=ozmA(b,"messages","result").map(m=>{ const u=m.user||{}, me=/seller/i.test(u.type)&&!/support/i.test(u.type); const D0=ozmA(m,"data"), txt=D0.map(x=>typeof x==="string"?x:x&&x.text||"").join("\n");
      return {id:m.message_id, at:m.created_at, me, who:me?"Вы":/support/i.test(u.type)?"Поддержка":/customer|buyer/i.test(u.type)?"Покупатель":u.type||"Озон", html:esc(txt).replace(/\n/g,"<br>").replace(/!?\[[^\]]*\]\((https?:[^)\s]+)\)/g,'<a href="$1" target="_blank" rel="noopener">вложение ↗</a>')}; }).sort((a,b)=>String(a.at).localeCompare(String(b.at)));
    OZM.chd[id]={L}; const c=(OZM.c.chat||[]).find(x=>x.id===id);
    if(c&&c.un&&L.length){ try{ await ozmApi("/v2/chat/read", {chat_id:id, from_message_id:L[L.length-1].id}); c.un=0; }catch(e){} } }
  catch(e){ OZM.chd[id]={err:e.message, L:[]}; }
  ozmPaint(); const m=$("#ozm-msgs"); if(m) m.scrollTop=m.scrollHeight; }
async function ozmSend(){ const t=$("#ozm-txt"), txt=(t&&t.value||"").trim(); if(!txt||!OZM.chat) return;
  try{ await ozmApi("/v1/chat/send/message", {chat_id:OZM.chat, text:txt}, {w:"Сообщение в чат Озона: «"+txt.slice(0,120)+"»"}); OZM.draft=""; if(t) t.value=""; toast("ok","Отправлено"); ozmChatOpen(OZM.chat); }catch(e){ toast("err","Не отправилось", e.message); } }
/* ---------- отзывы и вопросы ---------- */
async function ozmRevLoad(){ const out={rev:null, q:null, re:"", qe:""};
  try{ const b=await ozmApi("/v1/review/list", {limit:100, sort_dir:"DESC", status:"ALL"}); out.rev=ozmA(b,"reviews").map(r=>({id:String(r.id), sku:String(r.sku||""), text:r.text||"", rating:+r.rating||0, at:r.published_at||"", st:String(r.status||""), com:+r.comments_amount||0, ph:+r.photos_amount||0})); }catch(e){ out.re=e.message; }
  try{ const b=await ozmApi("/v1/question/list", {filter:{status:"ALL"}, last_id:""}); out.q=ozmA(b,"questions").map(q=>({id:String(q.id), sku:String(q.sku||""), text:q.text||"", at:q.published_at||"", st:String(q.status||""), n:+q.answers_count||0, who:q.author_name||"", url:q.product_url||""})); }catch(e){ out.qe=e.message; }
  return out; }
function ozmSkuName(sku){ const g=(OZM.c.goods||[]).find(x=>x.sku===sku); return g?g.name:"SKU "+sku; }
function ozmRevHtml(){ const C=OZM.c.rev||{}, isR=OZM.rk==="rev", Rn=(C.rev||[]).filter(r=>/unprocessed|new/i.test(r.st)).length, Qn=(C.q||[]).filter(q=>/new|unprocessed/i.test(q.st)).length;
  const tabs=`<div class="ozmbar"><div class="pfchips ozseg">${[["rev","Отзывы",Rn],["q","Вопросы",Qn]].map(([v,t,n])=>`<button type="button" data-ozmrk="${v}" class="${OZM.rk===v?"on":""}">${t}${n?` <small>новых ${n}</small>`:""}</button>`).join("")}</div>
    <div class="pfchips ozseg">${[["new","Новые"],["all","Все"]].map(([v,t])=>`<button type="button" data-ozmrf2="${v}" class="${OZM.rf===v?"on":""}">${t}</button>`).join("")}</div></div>`;
  if(isR){ if(C.re) return tabs+`<div class="ozerr">${esc(C.re)}</div>`; const L=(C.rev||[]).filter(r=>OZM.rf==="all"||/unprocessed|new/i.test(r.st));
    return tabs+(L.length?`<div class="ozmlist">${L.map(r=>`<div class="ozmrev"><div class="ozmrh"><span class="ozmstars" aria-label="${r.rating} из 5">${"★".repeat(r.rating)}<i>${"★".repeat(5-r.rating)}</i></span><b>${esc(ozmSkuName(r.sku))}</b><small>${ozmD(r.at)}${r.ph?" · фото "+r.ph:""}${r.com?" · ответов "+r.com:""}</small></div>
      <div class="ozmrt">${esc(r.text)||`<small class="muted">без текста</small>`}</div>
      <div class="ozmrep"><textarea rows="2" data-ozmrt="${esc(r.id)}" placeholder="Ответить покупателю…" data-noarrow></textarea><div class="ozmact"><button type="button" class="btn sm pri" data-ozmra="rev" data-id="${esc(r.id)}">Ответить</button>${/unprocessed|new/i.test(r.st)?`<button type="button" class="btn sm ghost" data-ozmra="revok" data-id="${esc(r.id)}">Отметить обработанным</button>`:`<small class="muted">обработан</small>`}</div></div></div>`).join("")}</div>`:`<div class="pvempty sm"><b>${OZM.rf==="new"?"Новых отзывов нет":"Отзывов нет"}</b></div>`); }
  if(C.qe) return tabs+`<div class="ozerr">${esc(C.qe)}</div>`; const L=(C.q||[]).filter(q=>OZM.rf==="all"||/new|unprocessed/i.test(q.st));
  return tabs+(L.length?`<div class="ozmlist">${L.map(q=>`<div class="ozmrev"><div class="ozmrh"><b>${esc(ozmSkuName(q.sku))}</b><small>${esc(q.who)} · ${ozmD(q.at)}${q.n?" · ответов "+q.n:""}</small></div><div class="ozmrt">${esc(q.text)}</div>
    <div class="ozmrep"><textarea rows="2" data-ozmqt="${esc(q.id)}" placeholder="Ваш ответ…" data-noarrow></textarea><div class="ozmact"><button type="button" class="btn sm pri" data-ozmra="q" data-id="${esc(q.id)}" data-sku="${esc(q.sku)}">Ответить</button>${/new|unprocessed/i.test(q.st)?`<button type="button" class="btn sm ghost" data-ozmra="qok" data-id="${esc(q.id)}">Просмотрено</button>`:""}</div></div></div>`).join("")}</div>`:`<div class="pvempty sm"><b>${OZM.rf==="new"?"Новых вопросов нет":"Вопросов нет"}</b></div>`); }
async function ozmRevAct(a, id, sku){ try{
  if(a==="rev"){ const t=document.querySelector(`[data-ozmrt="${CSS.escape(id)}"]`), v=(t&&t.value||"").trim(); if(!v){ toast("err","Напишите ответ"); return; }
    await ozmApi("/v1/review/comment/create", {review_id:id, text:v, mark_review_as_processed:true}, {w:"Ответ на отзыв Озона: «"+v.slice(0,120)+"»"}); toast("ok","Ответ отправлен"); }
  if(a==="revok"){ await ozmApi("/v1/review/change-status", {review_ids:[id], status:"PROCESSED"}, {w:"Отзыв Озона отмечен обработанным"}); toast("ok","Отмечено"); }
  if(a==="q"){ const t=document.querySelector(`[data-ozmqt="${CSS.escape(id)}"]`), v=(t&&t.value||"").trim(); if(!v){ toast("err","Напишите ответ"); return; }
    await ozmApi("/v1/question/answer/create", {question_id:id, sku:+sku||sku, text:v}, {w:"Ответ на вопрос покупателя Озона: «"+v.slice(0,120)+"»"}); toast("ok","Ответ отправлен"); }
  if(a==="qok"){ await ozmApi("/v1/question/change-status", {question_ids:[id], status:"VIEWED"}, {w:"Вопрос Озона отмечен просмотренным"}); toast("ok","Отмечено"); }
  OZM.c.rev=null; ozmLoad("rev", true); }catch(e){ toast("err","Не получилось", e.message); } }
/* ---------- акции (вручную; помощник по акциям — в «Сводке») ---------- */
async function ozmActLoad(){ const b=await ozmApi("/v1/actions", null, {get:true});
  return ozmA(b,"result").map(a=>({id:String(a.id), t:a.title||"Акция "+a.id, type:a.action_type||"", desc:a.description||"", a:a.date_start||"", b:a.date_end||"", on:+a.participating_products_count||0, can:+a.potential_products_count||0, dv:a.discount_value, dt:a.discount_type||""}))
    .filter(a=>!a.b||Date.parse(a.b)>Date.now()-864e5); }
function ozmActHtml(){ const L=OZM.c.act||[];
  return `<small class="muted ozmlead">Акции, в которые Озон зовёт магазин. Нажмите на акцию — увидите, какие товары участвуют и какие можно добавить, с подсказкой «без убытка».</small>
  ${L.length?`<div class="ozmlist">${L.map(a=>`<div class="ozmr" data-ozmac="${esc(a.id)}" role="button" tabindex="0"><span class="ozmt"><b>${esc(a.t)}</b><small>${a.a?ozmD(a.a)+" – ":"до "}${ozmD(a.b)||"без срока"}${a.dv?" · скидка "+esc(a.dv)+(a.dt==="PERCENT"?"%":" ₽"):""}</small></span><span class="ozmc"><b>${a.on} в акции</b><small>можно добавить ${a.can}</small></span><i aria-hidden="true">›</i></div>`).join("")}</div>`:`<div class="pvempty sm"><b>Сейчас акций нет</b></div>`}`; }
async function ozmAct(aid){ const a=(OZM.c.act||[]).find(x=>x.id===aid); if(!a) return; CARD_RE=()=>ozmAct(aid);
  openCard(ozHead("Озон · акция", esc(a.t), (a.a?ozmD(a.a)+" – ":"до ")+ozmD(a.b))+`<div class="ozd ozmd" id="ozm-ac"><div class="ozbusy sm"><span class="spin"></span> Загружаю товары акции…</div></div>`, true, ()=>{}); ozmDlg();
  try{ if(!OZM.c.goods) OZM.c.goods=await ozmGoodsLoad().catch(()=>null);
    const pages=async path=>{ const out=[]; for(let off=0; off<2000; off+=100){ const b=await ozmApi(path, {action_id:+aid, limit:100, offset:off}); const L=ozmA(b,"result.products","products"); L.forEach(x=>out.push(x)); if(L.length<100) break; } return out; };
    const IN=await pages("/v1/actions/products"), CA=await pages("/v1/actions/candidates"), G=OZM.c.goods||[];
    const nm=id=>{ const g=G.find(x=>x.id===String(id)); return g||{name:"Товар "+id, art:""}; };
    const row=(x,on)=>{ const g=nm(x.id!=null?x.id:x.product_id), gd=ozmGuardOf(g.art), ap=ozmN(on?x.action_price:x.max_action_price)||ozmN(x.action_price), pid=String(x.id!=null?x.id:x.product_id), bad=gd&&gd.p0&&ap&&ap<gd.p0;
      return `<div class="ozd-r static ozmacr"><span><b>${esc(g.name)}</b><small>цена ${ozmR(x.price)}${on?" · по акции "+ozmR(x.action_price):" · максимум по акции "+ozmR(x.max_action_price)}${gd&&gd.p0?` · <span class="${bad?"neg":"pos"}">без убытка от ${ozmR(gd.p0)}</span>`:""}</small></span>
        ${on?`<button type="button" class="btn sm ghost" data-ozmaa="off" data-pid="${esc(pid)}" data-ozm2>Убрать</button>`:`<span class="ozmwi"><input type="text" inputmode="decimal" data-money data-ozmap="${esc(pid)}" value="${ap||""}" aria-label="Цена по акции"><button type="button" class="btn sm" data-ozmaa="on" data-pid="${esc(pid)}"${+x.min_stock>0?` data-stock="${+x.min_stock}"`:""}>Добавить</button></span>`}</div>`; };
    const box=$("#fd-dcard #ozm-ac"); if(!box) return; box.dataset.aid=aid;
    box.innerHTML=(a.desc?`<div class="ozmhint">${esc(a.desc.replace(/<[^>]+>/g," ")).slice(0,400)}</div>`:"")+`<div class="ozd-h">Участвуют · ${IN.length}</div>${IN.map(x=>row(x,true)).join("")||`<small class="muted">Ни одного товара</small>`}<div class="ozd-h">Можно добавить · ${CA.length}</div>${CA.map(x=>row(x,false)).join("")||`<small class="muted">Нет товаров</small>`}`; }
  catch(e){ const box=$("#fd-dcard #ozm-ac"); if(box) box.innerHTML=`<div class="ozerr">${esc(e.message)}</div>`; } }
async function ozmActDo(aid, on, pid, btn){ const a=(OZM.c.act||[]).find(x=>x.id===aid)||{t:aid}, g=(OZM.c.goods||[]).find(x=>x.id===pid)||{name:pid};
  try{ if(on){ const inp=document.querySelector(`[data-ozmap="${CSS.escape(pid)}"]`), ap=ozmN(inp&&inp.value); if(!(ap>0)){ toast("err","Впишите цену по акции"); return; }
      const pr={product_id:+pid, action_price:ap}; if(btn.dataset.stock) pr.stock=+btn.dataset.stock;
      const b=await ozmApi("/v1/actions/products/activate", {action_id:+aid, products:[pr]}, {w:"Добавил в акцию «"+a.t+"»: "+g.name+" по "+ap+" ₽"}); const rj=ozmA(b,"result.rejected"); if(rj.length) throw new Error(rj.map(r=>r.reason).join("; ")); toast("ok","Добавлено в акцию", g.name); }
    else { const b=await ozmApi("/v1/actions/products/deactivate", {action_id:+aid, product_ids:[+pid]}, {w:"Убрал из акции «"+a.t+"»: "+g.name}); const rj=ozmA(b,"result.rejected"); if(rj.length) throw new Error(rj.map(r=>r.reason).join("; ")); toast("ok","Убрано из акции", g.name); }
    OZM.c.act=null; ozmLoad("act", true); ozmAct(aid); }catch(e){ toast("err","Не получилось", e.message); } }
/* ---------- аналитика ---------- */
async function ozmAnLoad(){ const to=todayISO(), from=ozAdd(to, -(OZM.an-1)), base={date_from:from, date_to:to, limit:1000, offset:0};
  let M=["revenue","ordered_units","hits_view","hits_tocart","session_view","conv_tocart","returns","cancellations"], day;
  try{ day=await ozmApi("/v1/analytics/data", Object.assign({}, base, {metrics:M, dimension:["day"], sort:[{key:"revenue", order:"DESC"}]})); }
  catch(e){ M=["revenue","ordered_units"]; day=await ozmApi("/v1/analytics/data", Object.assign({}, base, {metrics:M, dimension:["day"]})); }
  const sku=await ozmApi("/v1/analytics/data", Object.assign({}, base, {metrics:M, dimension:["sku"], sort:[{key:"revenue", order:"DESC"}]})).catch(()=>null);
  const rows=b=>ozmA(b,"result.data","data").map(r=>({k:(r.dimensions||[])[0]||{}, m:(r.metrics||[]).map(ozmN)}));
  return {M, day:rows(day).sort((a,b)=>String(a.k.id).localeCompare(String(b.k.id))), sku:sku?rows(sku):[], tot:ozmA(day,"result.totals","totals").map(ozmN), from, to}; }
const OZM_MN={revenue:"Заказано на сумму", ordered_units:"Заказано, шт", hits_view:"Показы", hits_tocart:"В корзину", session_view:"Посетители карточек", conv_tocart:"Конверсия в корзину, %", returns:"Возвраты, шт", cancellations:"Отмены, шт"};
function ozmAnHtml(){ const C=OZM.c.an; const per=`<div class="ozmbar"><div class="pfchips ozseg">${[[7,"7 дней"],[30,"30 дней"],[90,"90 дней"]].map(([v,t])=>`<button type="button" data-ozman="${v}" class="${OZM.an===v?"on":""}">${t}</button>`).join("")}</div></div>`;
  if(!C) return per; const tot=C.M.map((m,i)=>C.tot[i]!=null?C.tot[i]:C.day.reduce((a,r)=>a+(r.m[i]||0),0)), mx=Math.max(1,...C.day.map(r=>r.m[0]||0));
  return per+`<div class="oztiles">${C.M.map((m,i)=>`<div class="oztile static"><small>${OZM_MN[m]||m}</small><b>${m==="revenue"?ozmR(tot[i]):m==="conv_tocart"?(Math.round(tot[i]*10)/10)+"%":Math.round(tot[i]).toLocaleString("ru-RU")}</b></div>`).join("")}</div>
  <section class="ozmbox"><h4>Заказы по дням <small>${fd(C.from)} – ${fd(C.to)}</small></h4><div class="ozmbars">${C.day.map(r=>`<div class="ozmbarc" title="${esc(fd(String(r.k.id)))}: ${ozmR(r.m[0])}, ${r.m[1]||0} шт"><i style="height:${Math.max(2,Math.round((r.m[0]||0)/mx*100))}%"></i><small>${String(r.k.id).slice(8)}</small></div>`).join("")}</div></section>
  <section class="ozmbox"><h4>Товары <small>по сумме заказов</small></h4>${C.sku.length?`<div class="ozmlist">${C.sku.slice(0,50).map(r=>`<div class="ozmr static"><span class="ozmt"><b>${esc(r.k.name||ozmSkuName(String(r.k.id)))}</b><small>SKU ${esc(r.k.id)}${C.M.includes("hits_view")?" · показов "+Math.round(r.m[C.M.indexOf("hits_view")]||0).toLocaleString("ru-RU"):""}</small></span><span class="ozmc"><b>${ozmR(r.m[0])}</b><small>${Math.round(r.m[1]||0)} шт</small></span></div>`).join("")}</div>`:`<small class="muted">Нет данных</small>`}</section>
  <small class="muted">Это заказы (ещё не выкупы) — как в «Аналитике» кабинета Озона. Показы и конверсия Озон даёт только с подпиской Premium.</small>`; }
/* ---------- склады и рейтинг ---------- */
async function ozmWhLoad(){ const out={wh:[], rate:null, fbo:[], re:"", fe:""}; out.wh=await ozmWh(); OZM.wh=out.wh;
  try{ out.rate=await ozmApi("/v1/rating/summary", {}); }catch(e){ out.re=e.message; }
  try{ const b=await ozmApi("/v2/analytics/stock_on_warehouses", {limit:1000, offset:0, warehouse_type:"ALL"}); out.fbo=ozmA(b,"result.rows","rows"); }catch(e){ out.fe=e.message; }
  return out; }
function ozmWhHtml(){ const C=OZM.c.wh||{wh:[], fbo:[]}, R=C.rate, G=R?ozmA(R,"groups"):[];
  const byW={}; (C.fbo||[]).forEach(r=>{ (byW[r.warehouse_name||"—"]=byW[r.warehouse_name||"—"]||[]).push(r); });
  return `<section class="ozmbox"><h4>Рейтинг магазина</h4>${C.re?`<div class="ozerr">${esc(C.re)}</div>`:G.length?`${R.penalty_score_exceeded?`<div class="ozerr">Превышен лимит штрафных баллов — Озон может ограничить продажи</div>`:""}<div class="ozmrate">${G.map(g=>ozmA(g,"items").map(it=>{ const bad=/bad|critical|danger/i.test(it.status), w=/warn/i.test(it.status);
      return `<div class="ozmri ${bad?"bad":w?"warn":"ok"}"><small>${esc(it.name||it.rating)}</small><b>${it.current_value!=null?(Math.round(it.current_value*100)/100).toLocaleString("ru-RU"):"—"}${it.value_type==="PERCENT"?"%":""}</b>${it.past_value!=null?`<span>было ${(Math.round(it.past_value*100)/100).toLocaleString("ru-RU")}${it.value_type==="PERCENT"?"%":""}</span>`:""}</div>`; }).join("")).join("")}</div>`:`<small class="muted">Нет данных</small>`}</section>
  <section class="ozmbox"><h4>Ваши склады <small>${C.wh.length}</small></h4>${C.wh.length?C.wh.map(w=>`<div class="ozd-r static"><span><b>${esc(w.name)}</b><small>${w.rfbs?"realFBS":"FBS"} · ID ${esc(w.id)}${w.raw.has_entrusted_acceptance?" · доверительная приёмка":""}</small></span><b class="${w.off?"neg":"pos"}">${esc(/created|new/i.test(w.st)?"работает":w.st||"")}</b></div>`).join(""):`<small class="muted">Складов нет</small>`}<small class="muted">Остатки на складе меняются в окне товара («Товары» → товар → «Остатки»).</small></section>
  <section class="ozmbox"><h4>Товар на складах Озона (FBO)</h4>${C.fe?`<div class="ozerr">${esc(C.fe)}</div>`:Object.keys(byW).length?Object.entries(byW).map(([w,L])=>`<div class="ozd-h">${esc(w)} · ${L.reduce((a,r)=>a+ozmN(r.free_to_sell_amount),0)} шт</div>${L.map(r=>`<div class="ozd-r static"><span><b>${esc(r.item_name||r.item_code)}</b><small>${esc(r.item_code||"")}${ozmN(r.promised_amount)?" · в пути "+ozmN(r.promised_amount):""}${ozmN(r.reserved_amount)?" · в резерве "+ozmN(r.reserved_amount):""}</small></span><b>${ozmN(r.free_to_sell_amount)} шт</b></div>`).join("")}`).join(""):`<small class="muted">На складах Озона вашего товара нет</small>`}</section>`; }
const OZM_LD={goods:ozmGoodsLoad, orders:ozmOrdersLoad, ret:ozmRetLoad, chat:ozmChatLoad, rev:async()=>{ if(!OZM.c.goods) OZM.c.goods=await ozmGoodsLoad().catch(()=>null); return ozmRevLoad(); }, act:ozmActLoad, an:ozmAnLoad, wh:ozmWhLoad};
const OZM_H={goods:ozmGoodsHtml, orders:ozmOrdersHtml, ret:ozmRetHtml, chat:ozmChatHtml, rev:ozmRevHtml, act:ozmActHtml, an:ozmAnHtml, wh:ozmWhHtml};
const OZM_TIP={goods:"Цены, остатки на ваших складах, архив. Нажмите на товар — откроется всё по нему.", orders:"Заказы покупателей: собрать, передать в доставку, отметить доставленным, отменить, этикетки.", ret:"Возвраты покупателей и решения по заявкам на возврат realFBS.", chat:"Переписка с покупателями и поддержкой Озона.", rev:"Отзывы и вопросы покупателей — ответить прямо отсюда.", act:"", an:"Сколько заказали, по дням и по товарам.", wh:"Рейтинг магазина, ваши склады, товар на складах Озона."};
/* разметка раздела внутри вкладки (вызывается из ozDraw) */
function ozmShell(){ const v=OZU.v; return `<div class="ozm" data-ozmv="${v}"><div class="ozmtop"><small class="muted">${OZM_TIP[v]||""}</small><span class="ozmst2">${OZM.at[v]?"обновлено в "+new Date(OZM.at[v]).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):""}</span><button type="button" class="btn sm" data-ozm="reload"${OZM.busy[v]?" disabled":""}>Обновить</button></div><div id="ozm-body">${ozmBody()}</div></div>`; }
function ozmBody(){ const v=OZU.v;
  if(!(OZ.keys||[]).length) return `<div class="ozhello"><b>Подключите Озон API</b><span>Кнопка «Подключить Озон API» сверху: Client-Id и Api-Key с ролью Admin — тогда здесь можно будет управлять магазином.</span></div>`;
  if(!ozmOk()) return `<div class="ozhello"><b>Обновите скрипт таблицы</b><span>Для управления магазином нужен новый Code.gs (версия 57). Скопируйте его с GitHub и вставьте в Apps Script — как в жёлтой плашке «Как обновить».</span></div>`;
  const err=OZM.err[v]?`<div class="ozerr">Не получилось загрузить: ${esc(OZM.err[v])}</div>`:"";
  if(OZM.busy[v]&&!OZM.c[v]) return `<div class="ozbusy"><span class="spin"></span> Загружаю из Озона…</div>`;
  if(!OZM.c[v]) return err||`<div class="ozbusy"><span class="spin"></span> Загружаю из Озона…</div>`;
  try{ return err+OZM_H[v](); }catch(e){ console.error(e); return `<div class="ozerr">Ошибка показа: ${esc(e.message)}</div>`; } }
function ozmPaint(){ const el=$("#oz [data-ozmv]"); if(!el||el.dataset.ozmv!==OZU.v) return; const foc=document.activeElement, fq=foc&&foc.matches&&foc.matches("[data-ozmq]"), dr=$("#ozm-txt");
  if(dr) OZM.draft=dr.value; const b=$("#ozm-body"); if(b) b.innerHTML=ozmBody(); const t=el.querySelector(".ozmst2"); if(t) t.textContent=OZM.at[OZU.v]?"обновлено в "+new Date(OZM.at[OZU.v]).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}):""; const rb=el.querySelector('[data-ozm="reload"]'); if(rb) rb.disabled=!!OZM.busy[OZU.v];
  if(fq){ const q=el.querySelector("[data-ozmq]"); if(q){ q.focus(); const n=q.value.length; q.setSelectionRange(n,n); } } }
function ozmOpen(){ OZM.sel.clear(); OZM.q=""; if(ozmOk()&&(OZ.keys||[]).length){ ozmLoad(OZU.v); if(OZU.v==="chat"&&OZM.chat&&!OZM.chd[OZM.chat]) ozmChatOpen(OZM.chat); } }
/* двойное нажатие для того, что трудно отменить */
function ozm2(b){ if(!b.hasAttribute("data-ozm2")) return true; if(b.classList.contains("sure")) { b.classList.remove("sure"); return true; }
  b.classList.add("sure"); b._t0=b.textContent; b.textContent="Точно? Ещё раз"; setTimeout(()=>{ if(b.isConnected&&b.classList.contains("sure")){ b.classList.remove("sure"); b.textContent=b._t0; } }, 4000); return false; }
async function ozmBusy(b, fn){ if(b){ if(b.disabled) return; b.disabled=true; b.classList.add("busy"); } try{ await fn(); } finally { if(b&&b.isConnected){ b.disabled=false; b.classList.remove("busy"); if(b._t0) b.textContent=b._t0; } } }
/* ---- действия с товаром ---- */
async function ozmProdAct(a, id, b){ const g=(OZM.c.goods||[]).find(x=>x.id===id); if(!g) return; const d=$("#fd-dcard"), q=s=>d&&d.querySelector(s);
  try{
    if(a==="price"){ const p=ozmN(q("#ozm-p").value), o=ozmN(q("#ozm-o").value), m=ozmN(q("#ozm-m").value), au=q("#ozm-a").checked;
      if(!(p>0)){ toast("err","Впишите цену продажи"); return; } if(o&&o<=p){ toast("err","Цена до скидки должна быть больше цены продажи — или оставьте её пустой"); return; } if(m&&m>p){ toast("err","Минимальная цена не может быть больше цены продажи"); return; }
      const gd=ozmGuardOf(g.art); if(gd&&gd.p0&&p<gd.p0&&!b.classList.contains("sure")){ b.setAttribute("data-ozm2",""); if(!ozm2(b)) { toast("info","Цена ниже «без убытка» ("+ozmR(gd.p0)+")","Нажмите ещё раз, если всё верно"); return; } }
      const body={prices:[{product_id:+id, offer_id:g.art, price:String(p), old_price:String(o||0), min_price:String(m||0), currency_code:"RUB", auto_action_enabled:au?"ENABLED":"DISABLED"}]};
      const r=await ozmApi("/v1/product/import/prices", body, {w:"Цена на Озоне: "+g.name+" — "+(g.price||"?")+" → "+p+" ₽"}); const x=ozmA(r,"result")[0]; if(x&&x.updated===false) throw new Error(ozmA(x,"errors").map(e=>e.message||e.code).join("; ")||"Озон не принял цену");
      Object.assign(g, {price:p, old:o, min:m, auto:au}); toast("ok","Цена сохранена","Озон обновит её на витрине за несколько минут"); ozmPaint(); ozmProd(id); }
    if(a==="stock"){ const L=[...d.querySelectorAll("[data-ozmwh]")].map(i=>({warehouse_id:+i.dataset.ozmwh, product_id:+id, offer_id:g.art, stock:Math.max(0, Math.round(ozmN(i.value)))}));
      const r=await ozmApi("/v2/products/stocks", {stocks:L}, {w:"Остатки на Озоне: "+g.name+" — "+L.map(x=>x.stock).join(" / ")+" шт"}); const bad=ozmA(r,"result").filter(x=>x.updated===false);
      if(bad.length) throw new Error(bad.map(x=>ozmA(x,"errors").map(e=>e.message||e.code).join("; ")).join("; ")||"Озон не принял остатки");
      const tot=L.reduce((a,x)=>a+x.stock,0); g.st.fbs=[tot, g.st.fbs[1]]; g.st.rfbs=[0,0]; toast("ok","Остатки сохранены"); ozmPaint(); }
    if(a==="arch"||a==="unarch"){ await ozmApi(a==="arch"?"/v1/product/archive":"/v1/product/unarchive", {product_id:[+id]}, {w:(a==="arch"?"В архив на Озоне: ":"Из архива на Озоне: ")+g.name}); g.arch=a==="arch"; toast("ok", a==="arch"?"Товар в архиве":"Товар возвращён из архива"); ozmPaint(); ozmProd(id); }
    if(a==="art"){ const box=q("#ozm-more"); box.innerHTML=`<div class="ozmform"><label>Новый артикул<input type="text" id="ozm-na" value="${esc(g.art)}" autocomplete="off"></label><small class="muted">Артикул меняется и в отчётах Озона; себестоимость на сайте привязана к артикулу — её придётся вписать заново.</small><div class="ozmact"><button type="button" class="btn pri" data-ozmd="art2" data-ozm2>Сменить артикул</button></div></div>`; q("#ozm-na").focus(); }
    if(a==="art2"){ const na=q("#ozm-na").value.trim(); if(!na||na===g.art){ toast("info","Артикул не изменился"); return; }
      const r=await ozmApi("/v1/product/update/offer-id", {update_offer_id:[{offer_id:g.art, new_offer_id:na}]}, {w:"Артикул на Озоне: "+g.art+" → "+na}); const e=ozmA(r,"errors"); if(e.length) throw new Error(e.map(x=>x.message).join("; ")); g.art=na; toast("ok","Артикул изменён"); ozmPaint(); ozmProd(id); }
    if(a==="desc"){ const r=await ozmApi("/v1/product/info/description", {product_id:+id}); const x=r.result||r; q("#ozm-more").innerHTML=`<div class="ozmform"><b>${esc(x.name||g.name)}</b><div class="ozmdesc">${esc(String(x.description||"Описания нет").replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"")).replace(/\n/g,"<br>")}</div><small class="muted">Название, описание и характеристики меняются в кабинете Озона (там проверка модерации).</small></div>`; }
    if(a==="rate"){ if(!g.sku){ toast("info","У товара ещё нет SKU"); return; } const r=await ozmApi("/v1/product/rating-by-sku", {skus:[g.sku]}); const x=ozmA(r,"products")[0]||{};
      q("#ozm-more").innerHTML=`<div class="ozmform"><b>Рейтинг карточки: ${esc(String(x.rating!=null?Math.round(x.rating):"—"))} из 100</b>${ozmA(x,"groups").map(gr=>`<div class="ozd-r static"><span><b>${esc(gr.name||gr.key)}</b><small>${ozmA(gr,"improve_attributes").slice(0,4).map(t=>esc(t.name)).join(", ")}${ozmA(gr,"improve_attributes").length?" — заполните, чтобы поднять":""}</small></span><b>${Math.round(+gr.rating||0)}</b></div>`).join("")}</div>`; }
  }catch(e){ toast("err","Не получилось", e.message); } }
async function ozmBulk(a){ const ids=[...OZM.sel], G=(OZM.c.goods||[]).filter(g=>ids.includes(g.id)); if(!G.length) return;
  try{
    if(a==="barch"||a==="bunarch"){ for(const ch of ozmChunk(G.map(g=>+g.id),100)) await ozmApi(a==="barch"?"/v1/product/archive":"/v1/product/unarchive", {product_id:ch}, {w:(a==="barch"?"В архив на Озоне: ":"Из архива на Озоне: ")+ch.length+" товаров"}); G.forEach(g=>g.arch=a==="barch"); OZM.sel.clear(); toast("ok", a==="barch"?"В архиве: "+G.length:"Возвращено: "+G.length); ozmPaint(); }
    if(a==="bprice"){ const v=prompt("На сколько процентов изменить цену? Например 10 — дороже на 10%, −5 — дешевле на 5%", "5"); if(v==null) return; const k=+String(v).replace(",",".").replace("−","-"); if(!isFinite(k)||!k||k<-90||k>300){ toast("err","Впишите число процентов, например 10 или -5"); return; }
      const P=G.filter(g=>g.price>0).map(g=>{ const p=Math.round(g.price*(1+k/100)); return {g, p}; }), low=P.filter(x=>{ const gd=ozmGuardOf(x.g.art); return gd&&gd.p0&&x.p<gd.p0; });
      if(!confirm("Изменить цену у "+P.length+" "+plural(P.length,["товара","товаров","товаров"])+" на "+(k>0?"+":"")+k+"%?"+(low.length?"\n\nВНИМАНИЕ: "+low.length+" станут ниже цены без убытка: "+low.slice(0,3).map(x=>x.g.name).join(", "):""))) return;
      for(const ch of ozmChunk(P,900)){ const r=await ozmApi("/v1/product/import/prices", {prices:ch.map(x=>({product_id:+x.g.id, offer_id:x.g.art, price:String(x.p), old_price:String(x.g.old>x.p?x.g.old:0), currency_code:"RUB"}))}, {w:"Цены на Озоне "+(k>0?"+":"")+k+"%: "+ch.length+" товаров"});
        ozmA(r,"result").forEach(x=>{ if(x.updated!==false){ const it=ch.find(y=>y.g.id===String(x.product_id)||y.g.art===x.offer_id); if(it) it.g.price=it.p; } }); }
      OZM.sel.clear(); toast("ok","Цены изменены","Озон обновит их за несколько минут"); ozmPaint(); }
  }catch(e){ toast("err","Не получилось", e.message); } }
/* окна раздела: свой обработчик на каждое новое окно */
function ozmDlg(){ const d=$("#fd-dcard"); if(!d||d._ozm) return; d._ozm=1; ozDlg();
  d.addEventListener("click", e=>{ const t=e.target, b=t.closest("button");
    const pd=t.closest("[data-ozmd]"); if(pd){ const id=pd.closest("[data-ozmid]").dataset.ozmid; if(!ozm2(pd)) return; ozmBusy(pd, ()=>ozmProdAct(pd.dataset.ozmd, id, pd)); return; }
    const oa=t.closest("[data-ozmoa]"); if(oa){ if(!ozm2(oa)) return; ozmBusy(oa, ()=>ozmOrderAct(oa.dataset.ozmoa, [oa.dataset.n], oa)); return; }
    const of=t.closest("[data-ozmof2]"); if(of){ if(!ozm2(of)) return; const n=of.dataset.n; ozmBusy(of, async()=>{ try{
        if(of.dataset.ozmof2==="track"){ const v=$("#ozm-trk").value.trim(); if(!v){ toast("err","Впишите трек-номер"); return; } await ozmApi("/v2/fbs/posting/tracking-number/set", {tracking_numbers:[{posting_number:n, tracking_number:v}]}, {w:"Трек-номер заказа Озона "+n+": "+v}); toast("ok","Трек-номер сохранён"); }
        else { await ozmApi("/v2/posting/fbs/cancel", {posting_number:n, cancel_reason_id:+$("#ozm-cr").value, cancel_reason_message:$("#ozm-cm").value.trim()}, {w:"Отменён заказ Озона "+n+": "+$("#ozm-cr").selectedOptions[0].textContent}); toast("ok","Заказ отменён"); }
        OZM.c.orders=null; await ozmLoad("orders", true); ozmOrder(n); }catch(x){ toast("err","Не получилось", x.message); } }); return; }
    const rf=t.closest("[data-ozmrfa]"); if(rf){ if(!ozm2(rf)) return; ozmBusy(rf, ()=>ozmRfAct(rf.dataset.ozmrfa, rf.dataset.id)); return; }
    const aa=t.closest("[data-ozmaa]"); if(aa){ if(!ozm2(aa)) return; ozmBusy(aa, ()=>ozmActDo(d.querySelector("#ozm-ac").dataset.aid, aa.dataset.ozmaa==="on", aa.dataset.pid, aa)); return; } });
  d.addEventListener("input", e=>{ if(e.target.id==="ozm-p"){ const id=e.target.closest("[data-ozmid]").dataset.ozmid, g=(OZM.c.goods||[]).find(x=>x.id===id), h=d.querySelector("#ozm-ph"); if(g&&h) h.innerHTML=ozmPriceHint(g, ozmN(e.target.value), ozmGuardOf(g.art)); } }); }
/* события раздела во вкладке */
(function(){ const box=document.getElementById("oz"); if(!box) return;
  box.addEventListener("click", e=>{ if(!ozmIs(OZU.v)) return; const t=e.target; if(t.closest("[data-ozv]")) return;
    const ck=t.closest("[data-ozmsel]"); if(ck){ const id=ck.dataset.ozmsel; if(ck.checked) OZM.sel.add(id); else OZM.sel.delete(id); setTimeout(ozmPaint,0); return; }
    if(t.closest(".ozmck")) return;
    const a=t.closest("[data-ozm]"); if(a){ const v=a.dataset.ozm;
      if(v==="reload"){ OZM.chd={}; ozmLoad(OZU.v, true); if(OZU.v==="chat"&&OZM.chat) ozmChatOpen(OZM.chat); return; }
      if(v==="bnone"){ OZM.sel.clear(); ozmPaint(); return; }
      if(v==="gmore"){ OZM.gn=(OZM.gn||60)+100; ozmPaint(); return; } if(v==="omore"){ OZM.on=(OZM.on||60)+100; ozmPaint(); return; }
      if(v==="send"){ ozmBusy(a, ozmSend); return; }
      if(v==="oship"||v==="odeliv"||v==="olabel"){ const L=[...OZM.sel].map(ozmOrd).filter(o=>o&&(v==="oship"?o.st==="awaiting_packaging":v==="odeliv"?o.st==="awaiting_deliver"&&o.rfbs:o.st==="awaiting_deliver"&&!o.rfbs)); ozmBusy(a, ()=>ozmOrderAct(v==="oship"?"ship":v==="odeliv"?"deliv":"label", L.map(o=>o.n), a)); return; }
      if(!ozm2(a)) return; ozmBusy(a, ()=>ozmBulk(v)); return; }
    const oa=t.closest("[data-ozmoa]"); if(oa){ if(!ozm2(oa)) return; ozmBusy(oa, ()=>ozmOrderAct(oa.dataset.ozmoa, [oa.dataset.n], oa)); return; }
    const ra=t.closest("[data-ozmra]"); if(ra){ ozmBusy(ra, ()=>ozmRevAct(ra.dataset.ozmra, ra.dataset.id, ra.dataset.sku)); return; }
    const set=(k,el,attr,fn)=>{ OZM[k]=el.dataset[attr]; if(fn) fn(); else ozmPaint(); };
    let x;
    if((x=t.closest("[data-ozmgf]"))){ OZM.gf=x.dataset.ozmgf; OZM.sel.clear(); ozmPaint(); return; }
    if((x=t.closest("[data-ozmof]"))){ OZM.of=x.dataset.ozmof; OZM.sel.clear(); ozmPaint(); return; }
    if((x=t.closest("[data-ozmos]"))){ OZM.os=x.dataset.ozmos; OZM.sel.clear(); OZM.c.orders=null; ozmLoad("orders", true); return; }
    if((x=t.closest("[data-ozmod]"))){ OZM.od=+x.dataset.ozmod; OZM.c.orders=null; ozmLoad("orders", true); return; }
    if((x=t.closest("[data-ozman]"))){ OZM.an=+x.dataset.ozman; OZM.c.an=null; ozmLoad("an", true); return; }
    if((x=t.closest("[data-ozmrk]"))){ OZM.rk=x.dataset.ozmrk; ozmPaint(); return; }
    if((x=t.closest("[data-ozmrf2]"))){ OZM.rf=x.dataset.ozmrf2; ozmPaint(); return; }
    if((x=t.closest("[data-ozmcf]"))){ OZM.cf=x.dataset.ozmcf; ozmPaint(); return; }
    if((x=t.closest("[data-ozmch]"))){ ozmChatOpen(x.dataset.ozmch); return; }
    if(t.closest("input,textarea,select,a")) return;
    if((x=t.closest("[data-ozmp]"))){ ozmProd(x.dataset.ozmp); return; }
    if((x=t.closest("[data-ozmo]"))){ ozmOrder(x.dataset.ozmo); return; }
    if((x=t.closest("[data-ozmrf]"))){ ozmRf(x.dataset.ozmrf); return; }
    if((x=t.closest("[data-ozmac]"))){ ozmAct(x.dataset.ozmac); return; } }, true);
  let qT=0; box.addEventListener("input", e=>{ const t=e.target; if(t.matches("[data-ozmq]")){ OZM.q=t.value; clearTimeout(qT); qT=setTimeout(ozmPaint, 200); } if(t.id==="ozm-txt") OZM.draft=t.value; });
  box.addEventListener("change", e=>{ if(e.target.matches("[data-ozmgs]")){ OZM.gs=e.target.value; ozmPaint(); } });
  box.addEventListener("keydown", e=>{ if(e.target.id==="ozm-txt"&&e.key==="Enter"&&(e.ctrlKey||e.metaKey)){ e.preventDefault(); ozmSend(); } }); })();
window.__ozm={OZM, load:(v,f)=>ozmLoad(v,f), api:(p,b,o)=>ozmApi(p,b,o)};
