/* ===== Озон: сколько зарабатываю с маркетплейса (вкладка «Озон», только Даниил; просьба Даниила 24.11.2026) =====
   Данные — начисления Озона по дням, по каждому магазину (ФД, Исток):
   1) «Отчёт по начислениям» из кабинета (Финансы → Начисления → Скачать) — загружается кнопкой, разбирается на сайте; работает и со старым Code.gs;
   2) Seller API (Code.gs ≥ 53, действие `ozon`): ключи магазинов — в свойствах скрипта, сайт сам забирает /v1/finance/accrual/by-day
      по дням (старый /v3/finance/transaction/list Озон отключил 08.09.2026) и разбирает ответ здесь же (`ozParseDay`).
   Хранение — только на этом устройстве: IndexedDB «frudom-ozon» (по магазину и дню — строки [группа, тип, артикул, схема, кол-во, сумма]).
   День из отчёта Excel (s:"x") загрузка по API не перезаписывает — отчёт из кабинета точный.
   Себестоимость за 1 шт (`prefs.ozCost` {артикул: цена}) и ставка налога (`prefs.ozTax`, по умолчанию 8% — АУСН с того, что Озон перечислил на счёт)
   — в личных настройках, на всех устройствах.
   Прибыль = пришло на счёт − налог − закупка (кол-во × себестоимость). Общие расходы магазина (хранение, реклама, кросс-докинг…) в «пришло» уже вычтены;
   по товарам их можно разложить пропорционально продажам (галочка «Разложить общие расходы»). */
const OZ_DEF_ST=[{id:"fd", n:"Frudom / ФД"}];   /* «Исток» закрыт (24.11.2026) — один магазин; ещё один можно добавить в «Подключение» */
const OZ_PER=[["m0","Этот месяц"],["m1","Прошлый месяц"],["d7","7 дней"],["d30","30 дней"],["y","С начала года"],["c","Свои даты"]];
const OZ_SCH=[["all","Все схемы"],["FBO","FBO"],["RFBS","realFBS"]];
const OZ_SORT=[["profit","Больше прибыль"],["loss","Меньше прибыль"],["unit","Прибыль за 1 шт"],["sales","Больше продажи"],["qty","Больше штук"],["name","По названию"]];
const OZU=(()=>{ let u={}; try{ u=JSON.parse(localStorage.getItem("frudom-oz-ui")||"{}")||{}; }catch(e){} return Object.assign({st:"all", sch:"all", per:"m0", a:"", b:"", sort:"profit", q:"", al:false, f:""}, u); })();
const OZ={d:null, keys:null, kerr:"", busy:"", err:"", raw:null, at:0, ld:null};
const OZ_RFX=/realfbs|rfbs|за доставку от покупателя/i;
const OZ_EN={SaleCommission:"Вознаграждение за продажу", Acquiring:"Эквайринг", LastMile:"Последняя миля", Logistic:"Логистика", Logistics:"Логистика", ReturnLogistic:"Обратная логистика", DirectFlowLogistic:"Логистика", ReturnFlowLogistic:"Обратная логистика", Storage:"Размещение на складе", CrossDocking:"Кросс-докинг", Promotion:"Продвижение и реклама", DefectRate:"Превышение индекса ошибок", Delivery:"Доставка до места выдачи", Packaging:"Упаковка товара"};
/* коды начислений Озона из API (Logistic, RfbsDomesticDelivery…) — по-русски; старые сохранённые дни тоже переводятся при показе */
const OZ_RU={Logistic:"Логистика (доставка со склада до покупателя)", Logistics:"Логистика (доставка со склада до покупателя)", DirectFlowLogistic:"Логистика (доставка со склада до покупателя)",
  RfbsDomesticDelivery:"Доставка realFBS силами партнёров Озона", RfbsClientDeliveryCharge:"Покупатель заплатил за доставку realFBS", RfbsDomesticAgentFee:"Агентский сбор Озона за доставку realFBS",
  LastMile:"Последняя миля (до покупателя)", LastMileCourier:"Курьер до покупателя (последняя миля)", ReturnFlowLogistic:"Обратная логистика (возвраты и невыкупы)", ReturnLogistic:"Обратная логистика (возвраты и невыкупы)",
  DeliveryToHandoverPlaceByOzon:"Доставка Озоном до места сдачи заказа", Delivery:"Доставка до места выдачи", PickUpPointReturnAcceptance:"Приём возврата в пункте выдачи",
  Placements:"Хранение товаров на складе Озона", Placement:"Хранение товаров на складе Озона", Storage:"Хранение товаров на складе Озона", TemporaryPlacementsAgent:"Временное хранение товаров",
  SupplyInbound:"Приёмка поставки на склад Озона", CrossDock:"Кросс-докинг (доставка поставки на склад)", CrossDocking:"Кросс-докинг (доставка поставки на склад)",
  ItemPacking:"Упаковка товара на складе Озона", PackingFee:"Сборка и упаковка заказа", PackageCost:"Упаковочный материал (пакет, коробка)", Packaging:"Упаковка товара",
  AcceleratedReviewCollection:"Ускоренный сбор отзывов", Promotion:"Продвижение и реклама", PremiumSubscription:"Подписка Premium",
  Acquiring:"Эквайринг (приём оплаты от покупателя)", SaleCommission:"Вознаграждение Озона за продажу", Compensation:"Компенсации и корректировки Озона",
  Disposal:"Утилизация товара", DefectFineErrors:"Штраф за ошибки (индекс ошибок)", DefectRate:"Штраф за ошибки (индекс ошибок)"};
const OZ_RUW={rfbs:"realFBS", fbo:"FBO", fbs:"FBS", domestic:"по России", delivery:"доставка", deliver:"доставка", agent:"агент", fee:"сбор", fees:"сборы", charge:"плата", client:"покупатель", customer:"покупатель",
  return:"возврат", returns:"возвраты", flow:"поток", logistic:"логистика", logistics:"логистика", last:"последняя", mile:"миля", courier:"курьер", pick:"", up:"", pickup:"самовывоз", point:"пункт выдачи",
  acceptance:"приёмка", handover:"передача", place:"место", places:"места", by:"", to:"до", ozon:"Озон", placement:"хранение", placements:"хранение", temporary:"временное", supply:"поставка", inbound:"приёмка",
  cross:"кросс", dock:"докинг", item:"товар", items:"товары", packing:"упаковка", package:"упаковка", cost:"стоимость", accelerated:"ускоренный", review:"отзывы", reviews:"отзывы", collection:"сбор",
  promotion:"продвижение", premium:"Premium", subscription:"подписка", acquiring:"эквайринг", sale:"продажа", sales:"продажи", commission:"комиссия", compensation:"компенсация", disposal:"утилизация",
  defect:"брак", fine:"штраф", fines:"штрафы", errors:"ошибки", error:"ошибка", storage:"хранение", service:"услуга", services:"услуги", processing:"обработка", cancellation:"отмена", cancel:"отмена",
  non:"не", redistribution:"перераспределение", booking:"бронирование", surplus:"излишки", expiration:"срок годности", marketplace:"маркетплейс", partner:"партнёр", partners:"партнёры", stars:"звёзды",
  points:"баллы", discount:"скидка", bonus:"бонус", penalty:"штраф", sorting:"сортировка", transfer:"перевод", warehouse:"склад", shipment:"отгрузка", order:"заказ", orders:"заказы", other:"прочее"};
function ozRu(n){ n=String(n||""); if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(n)) return n; if(OZ_RU[n]) return OZ_RU[n];
  const w=n.replace(/_/g," ").replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g,"$1 $2").toLowerCase().split(/\s+/).filter(Boolean);
  const r=w.map(x=>x in OZ_RUW?OZ_RUW[x]:x).filter(Boolean).join(" "); return r? r[0].toUpperCase()+r.slice(1) : n; }
function ozUiSave(){ try{ localStorage.setItem("frudom-oz-ui", JSON.stringify(OZU)); }catch(e){} }
const ozAdd=(iso,n)=>{ const d=new Date(iso+"T00:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); };
const ozR=x=>Math.round(+x||0).toLocaleString("ru-RU")+" ₽";
const ozDM=iso=>iso?iso.slice(8)+"."+iso.slice(5,7):"";
const ozPct=(a,b)=>b?Math.round(a/b*100)+"%":"—";
/* ---- хранение на устройстве ---- */
const OZDB={p:null}; let ozSaveT=0;
function ozDb(){ if(OZDB.p) return OZDB.p; OZDB.p=new Promise(ok=>{ try{ const r=indexedDB.open("frudom-ozon",1); r.onupgradeneeded=()=>{ try{ r.result.createObjectStore("kv"); }catch(e){} }; r.onsuccess=()=>ok(r.result); r.onerror=()=>ok(null); }catch(e){ ok(null); } }); return OZDB.p; }
async function ozLoad(){ if(OZ.d) return OZ.d; if(OZ.ld) return OZ.ld;
  OZ.ld=(async()=>{ let v=null; const db=await ozDb();
    if(db) v=await new Promise(ok=>{ try{ const q=db.transaction("kv").objectStore("kv").get("data"); q.onsuccess=()=>ok(q.result||null); q.onerror=()=>ok(null); }catch(e){ ok(null); } });
    if(!v){ try{ v=JSON.parse(localStorage.getItem("frudom-oz-data")||"null"); }catch(e){} }
    OZ.d=Object.assign({v:1, days:{}, names:{}, sku:{}, types:{}}, v||{}); return OZ.d; })();
  return OZ.ld; }
function ozSave(){ clearTimeout(ozSaveT); ozSaveT=setTimeout(async()=>{ const db=await ozDb();
  if(db){ try{ db.transaction("kv","readwrite").objectStore("kv").put(OZ.d,"data"); return; }catch(e){} }
  try{ localStorage.setItem("frudom-oz-data", JSON.stringify(OZ.d)); }catch(e){} }, 250); }
/* ---- личные настройки ---- */
function ozStores(){ const p=getPrefs(); return Array.isArray(p.ozSt)&&p.ozSt.length?p.ozSt:OZ_DEF_ST; }
const ozStName=id=>(ozStores().find(s=>s.id===id)||{}).n||id;
/* товар Тани (мамы) на FBO: ключ строки «артикул~t», её цена за 1 шт — prefs.ozTp, своя себестоимость — prefs.ozCost */
const ozIsT=k=>/~t$/.test(String(k)), ozBase=k=>String(k).replace(/~t$/,"");
function ozCost(k){ const P=getPrefs(), c=((ozIsT(k)?P.ozTp:P.ozCost)||{})[ozBase(k)]; return c==null||c===""||!isFinite(+c)?null:+c; }
function ozCostSet(k, v){ const p=getPrefs(), f=ozIsT(k)?"ozTp":"ozCost", art=ozBase(k); p[f]=Object.assign({}, p[f]||{}); const n=typeof money==="function"?money(v):+v;
  if(v==null||String(v).trim()===""||!isFinite(n)) delete p[f][art]; else p[f][art]=r2(n); setPrefs(p,true); }
const ozOwnT=art=>(getPrefs().ozOwn||{})[art]==="t";
const ozTm=()=>getPrefs().ozTm==="net"?"net":"price";   /* как считаем Тане: по её цене за шт / всё, что Озон перечислил за её товар */
const ozTtax=()=>getPrefs().ozTtax!==0;                  /* в режиме «всё, что перечислил Озон» — вычесть из её доли налог */
const ozTax=()=>{ const t=getPrefs().ozTax; return t==null||t===""||!isFinite(+t)?8:+t; };
/* ---- период ---- */
function ozRange(){ const t=todayISO(), ym=t.slice(0,7), P=OZU.per;
  if(P==="m1"){ const a=ozAdd(ym+"-01",-1).slice(0,7)+"-01"; return [a, ozAdd(ym+"-01",-1)]; }
  if(P==="d7") return [ozAdd(t,-6), t]; if(P==="d30") return [ozAdd(t,-29), t]; if(P==="y") return [t.slice(0,4)+"-01-01", t];
  if(P==="c" && /^\d{4}-\d\d-\d\d$/.test(OZU.a) && /^\d{4}-\d\d-\d\d$/.test(OZU.b)) return OZU.a<=OZU.b?[OZU.a, OZU.b]:[OZU.b, OZU.a];
  return [ym+"-01", t]; }
const ozPerTxt=()=>{ const [a,b]=ozRange(); return a===b?fd(a):fd(a)+" – "+fd(b); };
const ozSel=()=>OZU.st==="all"||!ozStores().some(s=>s.id===OZU.st)?ozStores().map(s=>s.id):[OZU.st];
/* ---- «Отчёт по начислениям» из кабинета (Excel) ---- */
function ozIso(v){ if(v==null||v==="") return "";
  if(typeof v==="number" && isFinite(v)) return new Date(Date.UTC(1899,11,30)+Math.round(v)*864e5).toISOString().slice(0,10);
  if(v instanceof Date && !isNaN(v)) return v.getFullYear()+"-"+String(v.getMonth()+1).padStart(2,"0")+"-"+String(v.getDate()).padStart(2,"0");
  const s=String(v).trim(); let m=s.match(/^(\d{4})-(\d\d)-(\d\d)/); if(m) return m[1]+"-"+m[2]+"-"+m[3];
  m=s.match(/^(\d\d)\.(\d\d)\.(\d{4})/); if(m) return m[3]+"-"+m[2]+"-"+m[1]; return ""; }
const ozOrd=id=>String(id||"").split("-").slice(0,2).join("-");
function ozAgg(list){ const M=new Map(); list.forEach(x=>{ const k=[x[0],x[1],x[2],x[3]].join("\u0001"), o=M.get(k); if(o){ o[4]+=x[4]; o[5]=r2(o[5]+x[5]); } else M.set(k,[x[0],x[1],x[2],x[3],x[4],r2(x[5])]); });
  return [...M.values()].filter(x=>x[4]||Math.abs(x[5])>=0.005); }
/* .xlsx читаем сами (JSZip + DOMParser): отчёт Озона без строки <?xml … encoding?>, и SheetJS портит в нём русские буквы («=0G8A;5=8O» вместо «начисления») */
async function ozZipSheets(buf){ const z=await EisZip.loadAsync(buf), rd=async n=>{ const f=z.file(n); return f?f.async("string"):null; }, P=new DOMParser(), sst=[];
  const ss=await rd("xl/sharedStrings.xml"); if(ss) [...P.parseFromString(ss,"application/xml").getElementsByTagName("si")].forEach(si=>sst.push([...si.getElementsByTagName("t")].map(t=>t.textContent).join("")));
  const names=Object.keys(z.files).filter(n=>/^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})), out=[];
  for(const n of names){ const doc=P.parseFromString(await rd(n),"application/xml"), R=[];
    [...doc.getElementsByTagName("row")].forEach((row,ri)=>{ const rn=(+row.getAttribute("r")||ri+1)-1, cells=R[rn]=[];
      [...row.getElementsByTagName("c")].forEach((c,ci)=>{ const ref=c.getAttribute("r")||"", L=(ref.match(/^[A-Z]+/)||[""])[0]; let col=ci; if(L){ col=0; for(const ch of L) col=col*26+ch.charCodeAt(0)-64; col--; }
        const t=c.getAttribute("t")||"", v=c.getElementsByTagName("v")[0], vt=v?v.textContent:"";
        cells[col]=t==="s"?(sst[+vt]||""):t==="inlineStr"?[...c.getElementsByTagName("t")].map(x=>x.textContent).join(""):t==="str"||t==="e"||t==="b"?vt:vt===""?"":(isFinite(+vt)?+vt:vt); }); });
    for(let i=0;i<R.length;i++){ R[i]=R[i]||[]; for(let j=0;j<R[i].length;j++) if(R[i][j]==null) R[i][j]=""; } out.push(R); }
  return out; }
async function ozXlsx(file){ const buf=await file.arrayBuffer(), u8=new Uint8Array(buf.slice(0,2)); let sheets=null;
  if(u8[0]===0x50&&u8[1]===0x4B){ try{ sheets=await ozZipSheets(buf); }catch(e){ sheets=null; } }
  if(!sheets){ const X=await loadXLSX(), wb=X.read(buf, {type:"array"}); sheets=wb.SheetNames.map(n=>X.utils.sheet_to_json(wb.Sheets[n], {header:1, raw:true, defval:""})); }
  let rows=null, hi=-1;
  for(const R of sheets){ const i=R.findIndex(r=>r.some(c=>/тип начисления/i.test(String(c))) && r.some(c=>/сумма итого/i.test(String(c)))); if(i>=0){ rows=R; hi=i; break; } }
  if(!rows) throw new Error("это не «Отчёт по начислениям» Озона: в файле нет колонок «Тип начисления» и «Сумма итого»");
  const H=rows[hi].map(c=>String(c).trim().toLowerCase()), col=n=>H.findIndex(h=>h.startsWith(n));
  const C={id:col("id начисления"), date:col("дата начисления"), grp:col("группа услуг"), type:col("тип начисления"), art:col("артикул"), sku:col("sku"), name:col("название товара"), qty:col("количество"), sch:col("схема работы"), sum:col("сумма итого")};
  if(C.date<0||C.type<0||C.sum<0) throw new Error("в отчёте нет колонок «Дата начисления», «Тип начисления» или «Сумма итого»");
  let per=null; rows.slice(0,hi).forEach(r=>r.forEach(c=>{ const m=String(c).match(/(\d\d\.\d\d\.\d{4})\s*[-–]\s*(\d\d\.\d\d\.\d{4})/); if(m&&!per) per=[ozIso(m[1]), ozIso(m[2])]; }));
  const g=(r,k)=>C[k]>=0?r[C[k]]:"", recs=[], sch={}, names={}, sku={};
  rows.slice(hi+1).forEach(r=>{ const type=String(g(r,"type")).trim(), d=ozIso(g(r,"date")); if(!type||!d) return;
    const s=typeof g(r,"sum")==="number"?g(r,"sum"):money(g(r,"sum")); if(!isFinite(s)) return;
    const art=String(g(r,"art")||"").trim(), sk=String(g(r,"sku")||"").trim(), nm=String(g(r,"name")||"").trim(), sc=String(g(r,"sch")||"").trim().toUpperCase(), id=String(g(r,"id")||"");
    if(art&&nm) names[art]=nm; if(art&&sk) sku[sk]=art;
    if(sc && id) sch[ozOrd(id)]=sc;
    recs.push({d, grp:String(g(r,"grp")||"").trim()||ozGrp(type), type, art, sc, id, q:+g(r,"qty")||0, s}); });
  if(!recs.length) throw new Error("в отчёте нет ни одного начисления");
  const days={}; let tot=0;
  recs.forEach(x=>{ const sc=x.sc||(x.art?sch[ozOrd(x.id)]||"":""); (days[x.d]=days[x.d]||[]).push([x.grp, x.type, x.art, sc, x.type==="Выручка"?x.q:0, x.s]); tot+=x.s; });
  const ds=Object.keys(days).sort(); if(!per) per=[ds[0], ds[ds.length-1]];
  return {per, days, names, sku, n:recs.length, tot:r2(tot)}; }
/* общие данные для всех устройств (Code.gs ≥ 54): файл на Диске; изменённые дни — OZ.d.dirty {магазин:{дата:1}} */
const ozShareOk=()=>(D.srvVer||0)>=54;
function ozDirty(sid,d){ const X=OZ.d.dirty=OZ.d.dirty||{}; (X[sid]=X[sid]||{})[d]=1; }
let ozPushT=0, ozPushing=false;
function ozPush(){ clearTimeout(ozPushT); ozPushT=setTimeout(ozPushNow, 1200); }
async function ozPushNow(){ if(!OZ.d||!ozShareOk()||!online()||ozPushing) return; const X=OZ.d.dirty||{}; if(!Object.keys(X).some(s=>Object.keys(X[s]).length)) return;
  ozPushing=true; const days={}, sent={};
  Object.keys(X).forEach(sid=>{ const D=OZ.d.days[sid]||{}; days[sid]={}; sent[sid]=Object.keys(X[sid]); sent[sid].forEach(d=>{ days[sid][d]=D[d]||null; }); });
  try{ const j=await api({action:"ozon", op:"save", data:JSON.stringify({days, names:OZ.d.names, sku:OZ.d.sku, types:OZ.d.types})});
    if(j&&j.ok){ Object.keys(sent).forEach(sid=>{ sent[sid].forEach(d=>{ if(X[sid]) delete X[sid][d]; }); if(X[sid]&&!Object.keys(X[sid]).length) delete X[sid]; }); ozSave(); OZ.pullAt=0; }
    else { OZ.perr=j&&j.error||"нет ответа"; ozPush(); } }
  catch(e){ OZ.perr=e.message; setTimeout(ozPush, 30e3); }
  ozPushing=false; }
async function ozPull(force){ if(!OZ.d||!ozShareOk()||!online()||OZ.pulling) return; if(!force && Date.now()-(OZ.pullAt||0)<60e3) return;
  OZ.pulling=true; OZ.pullAt=Date.now();
  try{ const j=await api({action:"ozon", op:"data"}); if(j&&j.ok&&j.data){ const S=j.data, X=OZ.d.dirty||{}; let ch=0;
      ["names","sku"].forEach(k=>{ const v=S[k]||{}; Object.keys(v).forEach(x=>{ if(OZ.d[k][x]!==v[x]){ OZ.d[k][x]=v[x]; ch++; } }); });
      Object.keys(S.types||{}).forEach(sid=>{ if(!OZ.d.types[sid]){ OZ.d.types[sid]=S.types[sid]; ch++; } });
      const W=S.wiped||{}, WS=OZ.d.wseen=OZ.d.wseen||{};   /* «Удалить данные магазина» на другом устройстве — убрать и здесь */
      Object.keys(W).forEach(sid=>{ if(WS[sid]===W[sid]) return; WS[sid]=W[sid]; const C=OZ.d.days[sid]||{};
        Object.keys(C).forEach(d=>{ if((+C[d].at||0)<W[sid]){ delete C[d]; if(X[sid]) delete X[sid][d]; ch++; } }); });
      const sids=new Set([...Object.keys(S.days||{}), ...Object.keys(OZ.d.days)]);
      sids.forEach(sid=>{ const I=(S.days||{})[sid]||{}, C=OZ.d.days[sid]=OZ.d.days[sid]||{}, mine=X[sid]||{};
        Object.keys(I).forEach(d=>{ if(mine[d]) return; const x=I[d], e=C[d]; if(!x||!Array.isArray(x.r)) return;
          if(e && e.s==="x" && x.s!=="x") return; if(e && e.s===x.s && (+e.at||0)>=(+x.at||0)) return; C[d]=x; ch++; });
        /* у себя есть, на сервере нет — отправим (данные, загруженные до общего хранения) */
        Object.keys(C).forEach(d=>{ if(!I[d] && !mine[d]){ ozDirty(sid,d); } }); });
      if(ch){ ozSave(); if(curTab==="ozon") ozDraw(); }
      ozPush(); } }
  catch(e){}
  OZ.pulling=false; }
async function ozUpload(file, sid){ await ozLoad(); let R;
  try{ R=await ozXlsx(file); }catch(e){ toast("err","Не получилось прочитать отчёт", e.message); return; }
  const D=OZ.d.days[sid]=OZ.d.days[sid]||{};
  for(let d=R.per[0]; d<=R.per[1]; d=ozAdd(d,1)){ delete D[d]; ozDirty(sid,d); }
  Object.keys(R.days).forEach(d=>{ D[d]={s:"x", at:Date.now(), f:file.name, r:ozAgg(R.days[d])}; ozDirty(sid,d); });
  Object.assign(OZ.d.names, R.names); Object.assign(OZ.d.sku, R.sku); ozSave(); ozPush();
  OZU.st=sid; OZU.per="c"; OZU.a=R.per[0]; OZU.b=R.per[1]; ozUiSave();
  logEv("Данные","Озон: загружен отчёт по начислениям «"+ozStName(sid)+"» за "+fd(R.per[0])+" – "+fd(R.per[1]));
  toast("ok","Отчёт загружен", ozStName(sid)+" · "+fd(R.per[0])+" – "+fd(R.per[1])+" · "+R.n+" "+plural(R.n,["начисление","начисления","начислений"])+" · итого "+fm(R.tot)+" ₽ — сверьте с «Итого» в кабинете.");
  ozDraw(); }
function ozUpAsk(file){ const S=ozStores(); if(S.length===1){ ozUpload(file, S[0].id); return; }
  if(OZU.st!=="all"){ ozUpload(file, OZU.st); return; }
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Озон · отчёт по начислениям</div><h3>Какой это магазин?</h3><div class="dc-sub">${esc(file.name)}</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="ozpick">${S.map(s=>`<button type="button" class="btn" data-dc="st:${esc(s.id)}">${esc(s.n)}</button>`).join("")}</div>`, false, a=>{ if(a.startsWith("st:")) ozUpload(file, a.slice(3)); }); }
/* ---- разбор начислений Seller API (/v1/finance/accrual/by-day) ---- */
const ozAmt=v=>v==null?0:typeof v==="number"?v:typeof v==="object"?+(v.amount!=null?v.amount:v.value!=null?v.value:0)||0:+String(v).replace(",",".")||0;
function ozSchN(s){ s=String(s||"").toUpperCase().replace(/[^A-Z]/g,""); if(!s) return ""; if(/REAL|RFBS/.test(s)) return "RFBS"; if(s==="FBS") return "FBS"; if(/FBO/.test(s)) return "FBO"; return s; }
function ozGrp(n){ n=String(n||"").toLowerCase();
  if(/выручк|баллы|программы партн/.test(n)) return "Продажи";
  if(/вознагражд|комисси|commission/.test(n)) return "Вознаграждение Ozon";
  if(/реклам|продвиж|отзыв|трафарет|promotion|premium|подписк/.test(n)) return "Продвижение и реклама";
  if(/эквайр|acquiring|партн[её]р/.test(n)) return "Услуги партнёров";
  if(/размещ|хранени|кросс|cross|storage|fbo|упаковк|поставк|излиш|срок годн|бронир/.test(n)) return "Услуги FBO";
  if(/логист|доставк|миля|магистрал|возврат|обратн|delivery|lastmile|logistic|выдач/.test(n)) return "Услуги доставки";
  if(/штраф|утилиз|индекс|defect|компенсац/.test(n)) return "Другие услуги и штрафы";
  return "Прочие начисления"; }
function ozFees(node, out, pi, dep){ if(!node||typeof node!=="object"||dep>9) return;
  if(Array.isArray(node)){ node.forEach(x=>ozFees(x, out, pi, dep+1)); return; }
  const tid=node.type_id!=null?node.type_id:node.accrual_type_id!=null?node.accrual_type_id:node.fee_type_id;
  if(node.accrued!=null && tid!=null){ out.push({t:String(tid), s:ozAmt(node.accrued), pi, nm:node.type_name||node.name||""}); return; }
  for(const k in node){ if(k==="total_amount"||k==="seller_price"||k==="price") continue; ozFees(node[k], out, pi, dep+1); } }
function ozFindP(o, dep){ if(!o||typeof o!=="object"||dep>6) return null; if(o.sku!=null||o.offer_id) return o;
  for(const k in o){ const r=ozFindP(o[k], (dep||0)+1); if(r) return r; } return null; }
function ozArt(p){ if(!p) return ""; const o=p.offer_id||p.offerId, sk=p.sku!=null?String(p.sku):"", D=OZ.d;
  if(o){ if(sk) D.sku[sk]=String(o); if(p.name) D.names[o]=String(p.name); return String(o); }
  if(sk){ if(p.name) D.names["sku:"+sk]=String(p.name); return "sku:"+sk; } return ""; }
const ozPrice=p=>{ for(const k of ["seller_price","price","sale_price","customer_price","item_price","price_seller"]) if(p&&p[k]!=null&&ozAmt(p[k])) return p[k]; return 0; };
function ozParseDay(L, sid){ const T=Object.assign({}, OZ_EN, OZ.d.types[sid]||{}), out=[], ps={};
  L.forEach(a=>{ const P=a&&a.posting||{}, s=ozSchN(P.delivery_schema||P.schema||a.delivery_schema); if(s&&a.unit_number){ ps[a.unit_number]=s; ps[ozOrd(a.unit_number)]=s; } });
  L.forEach(a=>{ if(!a||typeof a!=="object") return;
    const tot=ozAmt(a.total_amount!=null?a.total_amount:a.amount), P=a.posting||{}, prods=Array.isArray(P.products)?P.products:Array.isArray(a.products)?a.products:[];
    const un=String(a.unit_number||P.posting_number||""), sch=ozSchN(P.delivery_schema||P.schema||a.delivery_schema)||ps[un]||ps[ozOrd(un)]||"";
    const arts=prods.map(ozArt), one=arts[0]||ozArt(ozFindP(a.item||a.item_fees||a, 0)), fees=[];
    prods.forEach((p,i)=>ozFees(p, fees, i, 0));
    const rest=Object.assign({}, a); delete rest.total_amount; delete rest.amount; delete rest.products; if(rest.posting){ rest.posting=Object.assign({}, rest.posting); delete rest.posting.products; } ozFees(rest, fees, -1, 0);
    prods.forEach((p,i)=>{ if(p.commission==null) return; const has=fees.some(f=>f.pi===i && /комисс|вознагр|commission/i.test(T[f.t]||f.nm||f.t)); if(!has) fees.push({t:"SaleCommission", s:-Math.abs(ozAmt(p.commission)), pi:i}); });
    const add=(type, art, q, s)=>out.push([ozGrp(type), type, art||"", art?sch:"", q, s]);
    let fs=0; fees.forEach(f=>{ const nm=ozRu(T[f.t]||f.nm||("Начисление "+f.t)); add(nm, f.pi>=0?arts[f.pi]:one, 0, f.s); fs+=f.s; });
    let left=r2(tot-fs);
    if(prods.length && Math.abs(left)>=0.01){ const w=prods.map(p=>{ const q=+(p.quantity!=null?p.quantity:p.qty!=null?p.qty:1)||1; return {q, v:ozAmt(ozPrice(p))*q}; }), W=w.reduce((s,x)=>s+x.v,0), sg=left<0?-1:1;
      if(W>0 && Math.abs(left)<=W*1.5){   /* есть цена продавца: выручка = цена × кол-во, а остаток (комиссия, которую Озон не расписал отдельной строкой) — отдельно */
        prods.forEach((p,i)=>{ const rv=r2(sg*w[i].v), d=r2(left*w[i].v/W-rv); add("Выручка", arts[i], sg*w[i].q, rv); if(Math.abs(d)>=0.01) add(d<0?"Вознаграждение за продажу (без расшифровки)":"Прочие компенсации Озона", arts[i], 0, d); }); }
      else prods.forEach((p,i)=>add("Выручка", arts[i], sg*w[i].q, r2(W?left*w[i].v/W:left/prods.length)));
      left=0; }
    if(Math.abs(left)>=0.005){ const tid=String(a.type_id!=null?a.type_id:a.accrual_type_id!=null?a.accrual_type_id:""), nm=ozRu(T[tid]||a.type_name||a.name||"")||(String(a.accrued_category||"").toUpperCase()==="NON_ITEM"?"Прочие начисления":"Прочее"); add(nm, one, 0, left); } });
  return ozAgg(out); }
function ozTypesParse(b, M, dep){ if(!b||typeof b!=="object"||dep>6) return;
  if(Array.isArray(b)){ b.forEach(x=>ozTypesParse(x, M, dep+1)); return; }
  const id=b.id!=null?b.id:b.type_id!=null?b.type_id:b.accrual_id, nm=b.name||b.title||b.description||b.type_name;
  if(id!=null && nm && typeof nm==="string") M[String(id)]=nm; for(const k in b) if(b[k]&&typeof b[k]==="object") ozTypesParse(b[k], M, dep+1); }
/* ---- связь с сервером ---- */
const ozSrvOk=()=>(D.srvVer||0)>=53;
async function ozCall(sid, path, bodies){ const j=await api({action:"ozon", op:"call", id:sid, path, bodies}); if(!j||j.ok===false) throw new Error(j&&j.error||"нет ответа"); return j.res||[]; }
async function ozKeysLoad(){ if(!ozSrvOk()){ OZ.keys=[]; return; } try{ const j=await api({action:"ozon", op:"keys"}); if(j&&j.ok!==false){ OZ.keys=j.keys||[]; OZ.kerr=""; } else OZ.kerr=j&&j.error||"нет ответа"; }catch(e){ OZ.kerr=e.message; } }
const ozArr=b=>b?(Array.isArray(b.accruals)?b.accruals:b.result&&Array.isArray(b.result.accruals)?b.result.accruals:Array.isArray(b.result)?b.result:[]):[];
const ozLid=b=>b&&(b.last_id||(b.result&&b.result.last_id))||"";
async function ozSync(force, rng){ if(OZ.busy||!online()) return; await ozLoad(); const K=(OZ.keys||[]).filter(k=>ozSel().includes(k.id)); if(!K.length) return;
  if(!rng && OZU.v==="pay") rng=ozPayRng();
  const [a,b]=rng||ozRange(), t=todayISO(), old=ozAdd(t,-3); OZ.busy="Загружаю начисления из Озона…"; OZ.err=""; ozDraw();
  try{ for(const k of K){ const DD=OZ.d.days[k.id]=OZ.d.days[k.id]||{};
      if(!OZ.d.types[k.id]){ try{ const R=await ozCall(k.id, "/v1/finance/accrual/types", [{}]); const M={}; if(R[0]&&R[0].code<300) ozTypesParse(R[0].body, M, 0); OZ.d.types[k.id]=M; }catch(e){} }
      const need=[]; for(let d=a; d<=b && d<=t; d=ozAdd(d,1)){ const x=DD[d]; if(x&&x.s==="x") continue; if(!force && x && (d<old || Date.now()-x.at<30*60e3)) continue; need.push(d); }
      for(let i=0;i<need.length;i+=7){ OZ.busy=`Загружаю «${ozStName(k.id)}»: ${Math.min(i+7,need.length)} из ${need.length} ${plural(need.length,["день","дня","дней"])}…`; ozBusyTxt();
        const part=need.slice(i,i+7), acc={}; part.forEach(d=>acc[d]=[]); let bodies=part.map(d=>({date:d})), guard=0;
        while(bodies.length && guard++<40){ const R=await ozCall(k.id, "/v1/finance/accrual/by-day", bodies), next=[];
          R.forEach((r,ix)=>{ const bd=bodies[ix]; if(!r||r.code>=300) throw new Error("Озон ответил "+(r&&r.code)+": "+((r&&r.body&&(r.body.message||r.body.error))||(r&&r.text)||"без пояснения"));
            const L=ozArr(r.body); acc[bd.date].push(...L); if(L.length && (!OZ.raw||OZ.raw.date<bd.date)) OZ.raw={store:k.id, date:bd.date, body:r.body};
            const lid=ozLid(r.body); if(lid && L.length && lid!==bd.last_id) next.push({date:bd.date, last_id:lid}); });
          bodies=next; }
        part.forEach(d=>{ DD[d]={s:"a", at:Date.now(), r:ozParseDay(acc[d], k.id)}; ozDirty(k.id,d); }); ozSave(); }
      await ozNames(k.id); }
    OZ.at=Date.now(); }
  catch(e){ OZ.err=e.message; }
  OZ.busy=""; ozSave(); ozPush(); ozDraw(); }
async function ozNames(sid){ const DD=OZ.d.days[sid]||{}, need=new Set();
  Object.values(DD).forEach(x=>(x.r||[]).forEach(r=>{ if(String(r[2]).startsWith("sku:") && !OZ.d.sku[r[2].slice(4)]) need.add(r[2].slice(4)); }));
  if(!need.size) return; const L=[...need].slice(0,1000);
  try{ const R=await ozCall(sid, "/v3/product/info/list", [{sku:L.map(Number)}]), b=R[0]&&R[0].body||{}, items=b.items||(b.result&&b.result.items)||[];
    items.forEach(it=>{ const o=it.offer_id; if(!o) return; if(it.name) OZ.d.names[o]=it.name; const S=[it.sku, it.fbo_sku, it.fbs_sku].concat((it.sources||[]).map(s=>s.sku)).filter(x=>x!=null&&x!==0);
      S.forEach(s=>OZ.d.sku[String(s)]=String(o)); }); }catch(e){} }
/* ---- расчёт ---- */
function ozCalc(o){ const [a,b]=o&&o.a?[o.a,o.b]:ozRange(), SCH=o&&o.sch||OZU.sch, S=ozSel(), D0=OZ.d||{days:{},names:{},sku:{}}, rate=ozTax()/100;
  const am=x=>x&&x.startsWith("sku:")&&D0.sku[x.slice(4)]?D0.sku[x.slice(4)]:x, nm=x=>D0.names[x]||(x.startsWith("sku:")?"SKU "+x.slice(4):x);
  const rows=[], cov={}; S.forEach(sid=>{ const DD=D0.days[sid]||{}, c=cov[sid]={n:0, x:0, a:0, days:0};
    for(let d=a; d<=b; d=ozAdd(d,1)){ if(d<=todayISO()) c.days++; const x=DD[d]; if(!x) continue; c.n++; c[x.s==="x"?"x":"a"]++;
      (x.r||[]).forEach(r=>{ const ty=ozRu(r[1]); rows.push({sid, d, grp:ty!==r[1]?ozGrp(ty):r[0], type:ty, raw:r[1], art:am(r[2]), sch:r[3], q:r[4], s:r[5]}); }); } });
  const maj={}; rows.forEach(x=>{ if(x.art&&x.sch&&x.type==="Выручка"){ const m=maj[x.art]=maj[x.art]||{}; m[x.sch]=(m[x.sch]||0)+Math.abs(x.q)+1; } });
  const schOf=x=>x.sch||(maj[x.art]?Object.entries(maj[x.art]).sort((p,q)=>q[1]-p[1])[0][0]:"");
  const pass=x=>SCH==="all"||(SCH==="RFBS"?/FBS/.test(schOf(x)):schOf(x)===SCH);
  const P={}, T={}, byS={}, byD={}, RF=[], OWN={}; let tot=0, un=0; Object.entries(getPrefs().ozOwn||{}).forEach(([k,v])=>{ if(v==="t") OWN[k]=1; });
  rows.forEach(x=>{ const rf=!x.art && (OZ_RFX.test(x.type)||OZ_RFX.test(x.raw||""));   /* доставка realFBS без товара (партнёры Озона, деньги покупателя за доставку) — раскладываем по товарам realFBS */
    if(rf? !(SCH==="all"||SCH==="RFBS") : x.art?!pass(x):SCH!=="all") return;
    if(rf){ RF.push(x); }
    tot+=x.s; byS[x.sid]=(byS[x.sid]||0)+x.s; byD[x.d]=(byD[x.d]||0)+x.s;
    const t=T[x.type]=T[x.type]||{type:x.type, grp:x.grp, s:0, un:0, arts:{}}; t.s+=x.s; if(x.art) t.arts[x.art]=(t.arts[x.art]||0)+x.s; else t.un+=x.s;
    if(rf) return; if(!x.art){ un+=x.s; return; }
    const key=x.art+(OWN[x.art]&&schOf(x)==="FBO"?"~t":"");   /* товар Тани — только продажи со склада FBO, realFBS всегда ваш */
    const p=P[key]=P[key]||{key, art:x.art, tanya:key!==x.art, name:nm(x.art), q:0, sales:0, net:0, sch:{}, types:{}, st:{}};
    if(x.type==="Выручка") p.q+=x.q; if(x.grp==="Продажи") p.sales+=x.s; p.net+=x.s; p.types[x.type]=(p.types[x.type]||0)+x.s; p.st[x.sid]=1; const sc=schOf(x); if(sc) p.sch[sc==="FBS"?"RFBS":sc]=1; });
  const rfP=Object.values(P).filter(p=>p.sch.RFBS&&p.sales>0), rfS=rfP.reduce((s,p)=>s+p.sales,0);
  if(RF.length){ if(rfS) RF.forEach(x=>rfP.forEach(p=>{ const v=x.s*p.sales/rfS, k=x.type+" (общая, по доле продаж)"; p.net+=v; p.types[k]=(p.types[k]||0)+v; T[x.type].arts[p.art]=(T[x.type].arts[p.art]||0)+v; T[x.type].un-=v; }));
    else RF.forEach(x=>{ un+=x.s; }); }
  const L=Object.values(P).filter(p=>p.q||Math.abs(p.sales)>=1||Math.abs(p.net)>=1), sales=L.reduce((s,p)=>s+p.sales,0);
  const tm=ozTm(), tt=ozTtax();
  L.forEach(p=>{ const tn=p.tanya&&tm==="net"; p.c=tn?null:ozCost(p.key); p.miss=!tn && p.c==null && p.q>0; p.cost=tn?p.net*(1-(tt?rate:0)):p.c==null?0:p.c*p.q; p.tax=p.net*rate; p.prof=p.net-p.tax-p.cost;
    p.share=sales&&p.sales>0?un*p.sales/sales:0; p.profA=p.prof+p.share*(1-rate); p.P=OZU.al?p.profA:p.prof; if(tn) p.g=null; else ozGuard(p, rate); });
  const cost=L.reduce((s,p)=>s+p.cost,0), q=L.reduce((s,p)=>s+p.q,0), tax=tot*rate;
  const G=L.filter(p=>p.g&&p.g.st), loss=G.filter(p=>p.g.st==="loss"), low=G.filter(p=>p.g.st==="low");
  const TL=L.filter(p=>p.tanya), tanya=TL.reduce((s,p)=>s+p.cost,0);
  return {a, b, sch:SCH, L, T, tot, un, sales, held:tot-sales, tax, rate, cost, q, prof:tot-tax-cost, miss:L.filter(p=>p.miss), byS, byD, cov, rows:rows.length, loss, low, TL, tanya, costMy:cost-tanya}; }
/* ---- контроль цены продажи (просьба Даниила 24.11.2026: «чтобы не продавать в минус») ----
   По фактическим удержаниям за период: процент от цены (вознаграждение Озона, эквайринг, оплата рекламы за заказ) и деньги за 1 шт
   (логистика, доставка, упаковка…). Тогда на руки за 1 шт = цена × (1 − %) − за шт; прибыль = на руки × (1 − налог) − себестоимость.
   Цена без убытка: прибыль = 0; цена для цели: прибыль = «хочу с 1 шт» (prefs.ozTarget, по умолчанию 50 ₽). */
const ozTarget=()=>{ const t=getPrefs().ozTarget; return t==null||t===""||!isFinite(+t)?50:+t; };
const OZ_PCT=/вознагражд|комисси|commission|эквайр|acquiring|оплатой за заказ/i;
function ozGuard(p, rate){ p.g=null; if(!(p.q>0) || !(p.sales>0)) return;
  let pct=0; Object.entries(p.types).forEach(([t,v])=>{ if(OZ_PCT.test(t)) pct+=v; });
  const r=Math.max(0, -pct/p.sales), fix=-(p.net-p.sales-pct)/p.q+(OZU.al&&p.share?-p.share/p.q:0), price=p.sales/p.q;
  const g=p.g={r, fix, price, net1:p.net/p.q, noCom:r<0.05 && !!p.sch.FBO};
  if(p.c==null || r>=0.95) return;
  g.unit=p.P/p.q;
  if(g.noCom){ g.st=g.unit<0?"loss":g.unit<ozTarget()?"low":"ok"; return; }   /* комиссия не видна (разбор ответа API) — цены не советуем, чтобы не подсказать неверную */
  const need=v=>((p.c+v)/(1-rate)+fix)/(1-r);
  g.p0=Math.ceil(need(0)); g.pt=Math.ceil(need(ozTarget()));
  g.st=price<g.p0-0.5?"loss":price<g.pt-0.5?"low":"ok"; }
const ozPN=v=>v==null?"—":v.toLocaleString("ru-RU");
/* ---- вкладка ---- */
function renderOzon(){ if(!me().admin) return; const box=$("#oz"); if(!box) return;
  if(!OZ.d){ box.innerHTML=`<div class="ozbusy"><span class="spin"></span> Загружаю…</div>`; ozLoad().then(()=>{ if(curTab==="ozon") renderOzon(); }); return; }
  ozDraw(); ozPull();
  if(OZ.keys==null){ ozKeysLoad().then(()=>{ if(curTab!=="ozon") return; ozDraw(); ozSync(false); }); }
  else if(Date.now()-OZ.at>10*60e3) ozSync(false); }
function ozBusyTxt(){ const el=$("#oz-st"); if(el && OZ.busy) el.innerHTML=`<span class="spin"></span> ${esc(OZ.busy)}`; }
function ozChips(list, cur, attr){ return list.map(([v,t])=>`<button type="button" data-${attr}="${esc(v)}" class="${cur===v?"on":""}" aria-pressed="${cur===v}">${esc(t)}</button>`).join(""); }
function ozTile(k, cls, small, big, sub){ return `<div class="oztile ${cls}" data-ozk="${k}" role="button" tabindex="0" title="Подробнее"><i class="pkgo" aria-hidden="true">›</i><small>${small}</small><b>${big}</b>${sub?`<span>${sub}</span>`:""}</div>`; }
function ozDraw(){ const box=$("#oz"); if(!box||!OZ.d) return; const foc=document.activeElement, fk=foc&&foc.dataset&&foc.dataset.ozc, fid=foc&&foc.id;
  const C=ozCalc(), S=ozStores(), keys=OZ.keys||[], hasKey=keys.length>0, any=Object.values(OZ.d.days).some(x=>Object.keys(x).length);
  const covTxt=Object.entries(C.cov).map(([sid,c])=>{ const miss=c.days-c.n; return miss>0&&c.days?`<span class="ozcov warn">${esc(ozStName(sid))}: нет данных за ${miss} ${plural(miss,["день","дня","дней"])}${keys.some(k=>k.id===sid)?"":" — загрузите отчёт"}</span>`:c.n?`<span class="ozcov">${esc(ozStName(sid))}: ${c.x?"отчёт Excel":""}${c.x&&c.a?" + ":""}${c.a?"Озон API":""}</span>`:""; }).join("");
  const st=OZ.busy?`<span class="spin"></span> ${esc(OZ.busy)}`:OZ.err?`<span class="ozerr">Не получилось загрузить из Озона: ${esc(OZ.err)}</span>`:"";
  const L=ozList(C), mpct=C.sales?Math.round(C.prof/C.sales*100):0;
  box.innerHTML=`<div class="ozhead"><div><h2>Озон <small>видно только вам</small></h2><small class="muted">Сколько вы зарабатываете с маркетплейса: что пришло от Озона минус налог и закупка товара.</small></div>
    <div class="ozacts">${hasKey?`<button type="button" class="btn sm" data-oz="sync"${OZ.busy?" disabled":""}>Обновить из Озона</button>`:""}<label class="btn sm">Загрузить отчёт Excel<input type="file" id="oz-file" accept=".xlsx,.xls" hidden></label><button type="button" class="btn sm ghost" data-oz="keys">${hasKey?"Подключение":"Подключить Озон API"}</button></div></div>
  <div class="pfchips ozv">${ozChips([["sum","Сводка за период"],["pay","Выплаты на р/с"]], OZU.v==="pay"?"pay":"sum", "ozv")}<button type="button" class="btn sm ghost ozownb" data-oz="own">Товар Тани${ozOwnN()?" · "+ozOwnN():""}</button></div>
  ${OZU.v==="pay"?`<div class="ozst-line" id="oz-st">${st}</div>${ozPayList()}`:`<div class="ozbar">
    ${S.length>1?`<div class="pfchips ozst">${ozChips([["all","Все магазины"]].concat(S.map(s=>[s.id,s.n])), OZU.st, "ozst")}</div>`:""}
    <div class="pfchips ozper">${ozChips(OZ_PER, OZU.per, "ozper")}</div>
    ${OZU.per==="c"?`<div class="ozdates"><label>с <input type="date" id="oz-a" value="${esc(ozRange()[0])}"></label><label>по <input type="date" id="oz-b" value="${esc(ozRange()[1])}"></label></div>`:""}
    <div class="pfchips ozsch">${ozChips(OZ_SCH, OZU.sch, "ozsch")}</div>
  </div>
  <div class="ozst-line" id="oz-st">${st}</div>${covTxt?`<div class="ozcovs">${covTxt}</div>`:""}
  ${!any?ozHello(hasKey):`
  ${C.loss.length?`<div class="ozalarm" data-ozk="price" role="button" tabindex="0"><b>В минус продаётся ${C.loss.length} ${plural(C.loss.length,["товар","товара","товаров"])}</b><span>${C.loss.slice(0,3).map(p=>esc(p.name)+(p.g.p0?" — поднять до "+ozPN(p.g.p0)+" ₽":"")).join(" · ")}${C.loss.length>3?"…":""}</span><i aria-hidden="true">›</i></div>`:""}
  <div class="oztiles">
    ${ozTile("sales","", "Продажи", ozR(C.sales), C.q+" шт · "+ozPerTxt())}
    ${ozTile("held","neg", "Удержал Озон", ozR(C.held), ozPct(-C.held, C.sales)+" от продаж · комиссия, логистика, реклама")}
    ${ozTile("tot","ok", "К выплате от Озона", ozR(C.tot), "начислено за период · Озон платит по неделям")}
    ${ozTile("tax","neg", "Налог "+(+C.rate*100).toLocaleString("ru-RU")+"%", ozR(-C.tax), "АУСН с того, что пришло")}
    ${ozTile("cost", C.miss.length?"warn":"neg", C.TL.length?"Закупка и Тане":"Закупка товара", ozR(-C.cost), C.miss.length?"нет "+(C.TL.length?"цены":"себестоимости")+" у "+C.miss.length+" "+plural(C.miss.length,["товара","товаров","товаров"]):C.TL.length?"ваш товар "+fm(C.costMy)+" · Тане "+fm(C.tanya):"количество × себестоимость")}
    ${ozTile("prof", C.prof<0?"bad":"good", "Чистая прибыль", ozR(C.prof), (C.sales?"маржа "+mpct+"% от продаж":"")+(C.miss.length?" · завышена: не у всех товаров есть закупка":""))}
  </div>
  <div class="ozformula">К выплате <b>${fm(C.tot)}</b> − налог <b>${fm(C.tax)}</b> − закупка <b>${fm(C.costMy)}</b>${C.TL.length?` − Тане <b>${fm(C.tanya)}</b>`:""} = <b class="${C.prof<0?"neg":"pos"}">${fm(C.prof)} ₽</b></div>
  ${ozSplit(C)}
  ${C.miss.length?`<div class="ozmiss" data-ozk="miss" role="button" tabindex="0"><b>Впишите себестоимость ${C.miss.length} ${plural(C.miss.length,["товара","товаров","товаров"])}</b><span>${C.miss.slice(0,4).map(p=>esc(p.name)).join(", ")}${C.miss.length>4?"…":""}</span><i aria-hidden="true">›</i></div>`:""}
  ${ozGuardCard(C)}
  <section class="card ozprods"><div class="ozph"><h3>Товары <small>${L.length}</small></h3>
    <div class="ozpt"><input type="search" id="oz-q" placeholder="Найти товар или артикул" value="${esc(OZU.q)}" autocomplete="off"><select id="oz-sort" data-native aria-label="Порядок">${OZ_SORT.map(([v,t])=>`<option value="${v}"${OZU.sort===v?" selected":""}>${t}</option>`).join("")}</select>
    <label class="ozal" title="Хранение, реклама, кросс-докинг и другие расходы без товара делятся по товарам пропорционально продажам"><input type="checkbox" id="oz-al"${OZU.al?" checked":""}> Разложить общие расходы (${fm(C.un)})</label></div></div>
    ${ozTable(L, C)}
  </section>
  <section class="card ozexp"><div class="ozph"><h3>Куда ушли деньги <small>удержания Озона за период</small></h3></div>${ozExp(C)}</section>`}`}`;
  if(fk){ const el=box.querySelector(`[data-ozc="${CSS.escape(fk)}"]`); if(el){ el.focus(); try{ el.select(); }catch(e){} } } else if(fid && /^oz-/.test(fid)){ const el=document.getElementById(fid); if(el&&el.focus){ el.focus(); if(el.type==="search"){ const v=el.value; el.setSelectionRange(v.length,v.length); } } } }
function ozHello(hasKey){ return `<div class="ozhello"><b>Данных за этот период пока нет</b>
  <div class="ozhw"><div><span>1</span><p><b>Загрузить отчёт из кабинета</b>Озон → Финансы → Начисления → выберите период → «Скачать отчёт» (Excel). Нажмите здесь «Загрузить отчёт Excel» — сайт всё посчитает. Работает сразу.</p></div>
  <div><span>2</span><p><b>Или подключить Озон API — всё будет приходить само</b>${ozSrvOk()?(hasKey?"Ключ подключён — нажмите «Обновить из Озона».":"В кабинете Озона: Настройки → Seller API → «Сгенерировать ключ» (роль «Admin read only»). Нажмите «Подключить Озон API» и вставьте Client-Id и ключ."):"Сначала обновите скрипт таблицы (Code.gs, версия 53) — без него сайт не может обращаться к Озону. Отчёт Excel работает и без этого."}</p></div></div></div>`; }
function ozList(C){ const q=OZU.q.trim().toLowerCase(); let L=C.L.filter(p=>!q||(p.name+" "+p.art).toLowerCase().includes(q));
  const by={profit:(a,b)=>b.P-a.P, loss:(a,b)=>a.P-b.P, unit:(a,b)=>(b.q?b.P/b.q:-1e9)-(a.q?a.P/a.q:-1e9), sales:(a,b)=>b.sales-a.sales, qty:(a,b)=>b.q-a.q, name:(a,b)=>a.name.localeCompare(b.name,"ru")}[OZU.sort]||((a,b)=>b.P-a.P);
  return L.sort(by); }
const ozSchB=p=>Object.keys(p.sch).map(s=>`<em class="ozsb">${s==="RFBS"?"realFBS":esc(s)}</em>`).join("");
function ozTable(L, C){ if(!L.length) return `<div class="pvempty sm"><b>${OZU.q?"Ничего не нашлось":"Продаж за период нет"}</b></div>`;
  const u=(v,q)=>q?fm(v/q):"—";
  return `<div class="ozt" role="table"><div class="ozr ozrh" role="row"><span>Товар</span><span class="n">Продано</span><span class="n">Цена</span><span class="n">Удержал Озон, шт</span><span class="n">На руки, шт</span><span class="n">Налог, шт</span><span class="n">Закупка, шт</span><span class="n">Прибыль, шт</span><span class="n">Прибыль</span></div>
  ${L.map(p=>`<div class="ozr${p.P<0?" loss":""}" role="row" data-ozp="${esc(p.key)}" tabindex="0"><span class="ozn"><b>${esc(p.name)}</b><small>${esc(p.art.startsWith("sku:")?"":p.art)}${ozSchB(p)}${ozTB(p)}${OZU.st==="all"&&ozStores().length>1?" · "+Object.keys(p.st).map(s=>esc(ozStName(s))).join(", "):""}</small></span>
    <span class="n" data-l="Продано"><b>${p.q} шт</b></span><span class="n" data-l="Цена">${u(p.sales,p.q)}${p.g&&p.g.p0&&p.g.st!=="ok"?`<small class="ozmin ${p.g.st}" title="${p.g.st==="loss"?"Ниже этой цены — убыток":"Для прибыли "+ozTarget()+" ₽ с 1 шт"}">${p.g.st==="loss"?"без убытка от ":"цель от "}${(p.g.st==="loss"?p.g.p0:p.g.pt).toLocaleString("ru-RU")}</small>`:""}</span><span class="n neg" data-l="Удержал Озон, шт">${u(p.net-p.sales,p.q)}</span><span class="n" data-l="На руки, шт"><b>${u(p.net,p.q)}</b></span><span class="n neg" data-l="Налог, шт">${u(-p.tax,p.q)}</span>
    <span class="n ozci" data-l="${p.tanya?"Тане, шт":"Закупка, шт"}">${p.tanya&&ozTm()==="net"?`<small class="ozta">всё Тане<br>${u(p.cost,p.q)}</small>`:`<input type="text" inputmode="decimal" data-money data-ozc="${esc(p.key)}" value="${p.c==null?"":esc(String(p.c))}" placeholder="${p.q?(p.tanya?"цена Тани":"впишите"):"—"}" aria-label="${p.tanya?"Цена Тани за 1 шт":"Себестоимость 1 шт"}: ${esc(p.name)}" class="${p.miss?"miss":""}">`}</span>
    <span class="n ${p.P<0?"neg":"pos"}" data-l="Прибыль, шт">${p.miss?"?":u(p.P,p.q)}</span><span class="n ${p.P<0?"neg":"pos"}" data-l="Прибыль"><b>${p.miss?"?":fm(p.P)}</b>${OZU.al&&p.share?`<small>общие ${fm(p.share)}</small>`:""}</span></div>`).join("")}</div>`; }
function ozExp(C){ const L=Object.values(C.T).filter(t=>t.grp!=="Продажи"&&Math.abs(t.s)>=0.5).sort((a,b)=>a.s-b.s), max=Math.max(1,...L.map(t=>Math.abs(t.s)));
  if(!L.length) return `<div class="pvempty sm"><b>Удержаний нет</b></div>`;
  const G={}; L.forEach(t=>(G[t.grp]=G[t.grp]||[]).push(t));
  return Object.entries(G).sort((a,b)=>a[1].reduce((s,t)=>s+t.s,0)-b[1].reduce((s,t)=>s+t.s,0)).map(([g,ts])=>`<div class="ozg"><div class="ozgh"><b>${esc(g)}</b><span>${fm(ts.reduce((s,t)=>s+t.s,0))}</span></div>
    ${ts.map(t=>`<div class="ozx" data-ozt="${esc(t.type)}" role="button" tabindex="0"><span>${esc(t.type)}${t.un&&Math.abs(t.un)>=0.5&&Math.abs(t.un-t.s)<0.5?` <em class="ozsb">общий</em>`:""}</span><i style="--w:${Math.round(Math.abs(t.s)/max*100)}%"></i><b class="${t.s<0?"neg":"pos"}">${fm(t.s)}</b><i class="ozgo" aria-hidden="true">›</i></div>`).join("")}</div>`).join(""); }
function ozGuardRow(p){ const g=p.g, up=g.st==="ok"||!g.p0?0:Math.max(0,(g.st==="loss"?g.p0:g.pt)-g.price);
  return `<div class="ozgr ${g.st}" data-ozp="${esc(p.key)}" role="button" tabindex="0"><span class="ozgn"><b>${esc(p.name)}${ozTB(p)}</b><small>${g.st==="loss"?"продаёте в минус: "+fm(g.unit)+" с 1 шт":g.st==="low"?"прибыль "+fm(g.unit)+" с 1 шт — меньше цели":"прибыль "+fm(g.unit)+" с 1 шт"}${g.noCom?" · комиссия Озона в данных не видна — загрузите отчёт Excel, чтобы посчитать нужную цену":""}</small></span>
    <span class="ozgp"><small>сейчас</small><b>${fm(g.price)}</b></span><span class="ozgp"><small>без убытка</small><b class="${g.st==="loss"?"neg":""}">${ozPN(g.p0)}</b></span><span class="ozgp"><small>цель ${ozTarget()} ₽/шт</small><b>${ozPN(g.pt)}</b></span>
    <span class="ozgu">${up?"+"+Math.ceil(up).toLocaleString("ru-RU")+" ₽":g.p0||g.st==="ok"?"✓":"?"}</span></div>`; }
function ozGuardCard(C){ const bad=C.loss.concat(C.low).sort((a,b)=>a.g.unit-b.g.unit), ok=C.L.filter(p=>p.g&&p.g.st==="ok").length, noc=C.L.filter(p=>p.q>0&&p.c==null).length;
  if(!bad.length && !ok) return "";
  return `<section class="card ozguard${C.loss.length?" bad":bad.length?" warn":" good"}"><div class="ozph"><h3>Контроль цен <small>${C.loss.length?C.loss.length+" в минус":""}${C.loss.length&&C.low.length?" · ":""}${C.low.length?C.low.length+" ниже цели":""}${!bad.length?"всё в порядке":""}</small></h3><button type="button" class="btn sm ghost" data-ozk="price">Все цены и настройка ›</button></div>
    ${bad.length?bad.slice(0,6).map(ozGuardRow).join("")+(bad.length>6?`<button type="button" class="btn sm ghost" data-ozk="price">Ещё ${bad.length-6} ›</button>`:""):`<p class="ozok">Все ${ok} ${plural(ok,["товар","товара","товаров"])} с себестоимостью продаются с прибылью не меньше ${ozTarget()} ₽ с 1 шт.</p>`}
    ${noc?`<p class="muted ozgn">Без себестоимости цену не проверить: ${noc} ${plural(noc,["товар","товара","товаров"])}.</p>`:""}</section>`; }
/* ---- окна подробностей («провалиться и вернуться») ---- */
const ozHead=(kick, h, sub)=>`<div class="dc-head"><div><div class="dc-kicker">${kick}</div><h3>${h}</h3>${sub?`<div class="dc-sub">${sub}</div>`:""}</div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>`;
const ozTB=p=>p.tanya?`<em class="ozsb ozt">Таня</em>`:"";
const ozPr=(p, val, sub)=>`<div class="ozd-r" data-ozp="${esc(p.key||p.art)}" role="button" tabindex="0"><span><b>${esc(p.name)}${ozTB(p)}</b><small>${sub}</small></span><b class="${val<0?"neg":""}">${fm(val)}</b><i aria-hidden="true">›</i></div>`;
function ozDetail(k){ const C=ozCalc(), kick="Озон · "+esc(ozPerTxt())+(OZU.st!=="all"?" · "+esc(ozStName(OZU.st)):""); let h="", sub="", body="";
  if(k==="sales"){ h="Продажи — "+ozR(C.sales); sub="Сумма продаж по вашей цене (что заплатил покупатель + баллы и скидки Озона)"; body=C.L.slice().sort((a,b)=>b.sales-a.sales).map(p=>ozPr(p, p.sales, p.q+" шт · по "+(p.q?fm(p.sales/p.q):"—"))).join(""); }
  else if(k==="held"){ h="Удержал Озон — "+ozR(C.held); sub="Всё, что Озон вычел из продаж. Нажмите на строку — по каким товарам."; body=ozExp(C); }
  else if(k==="gen"){ const G=ozGen(); h="Общие расходы магазина — "+ozR(G.s); sub="Начисления без товара и схемы: хранение, реклама, приёмка поставок, штрафы… Они не относятся ни к FBO-товару, ни к realFBS — поэтому FBO + realFBS не равно всей выплате";
    body=G.L.map(t=>`<div class="ozd-r" data-ozt="${esc(t.type)}" role="button" tabindex="0"><span><b>${esc(t.type)}</b><small>${esc(t.grp)}</small></span><b class="${t.v<0?"neg":""}">${fm(t.v)}</b><i aria-hidden="true">›</i></div>`).join("")+(Math.abs(G.rest)>=0.5?`<div class="ozd-r static"><span><b>Товары без схемы</b><small>Озон не указал, FBO это или realFBS</small></span><b>${fm(G.rest)}</b></div>`:"")||`<div class="pvempty sm"><b>Общих расходов нет</b></div>`; }
  else if(k==="tot"){ h="К выплате от Озона — "+ozR(C.tot); sub="Начисления Озона за период: продажи минус все удержания. Озон перечисляет их раз в неделю — по каждой выплате смотрите «Выплаты на р/с»";
    const S=Object.entries(C.byS), D=Object.entries(C.byD).sort((a,b)=>b[0].localeCompare(a[0])), mx=Math.max(1,...D.map(x=>Math.abs(x[1])));
    body=(S.length>1?`<div class="ozd-h">По магазинам</div>`+S.map(([s,v])=>`<div class="ozd-r" data-ozgo="st:${esc(s)}" role="button" tabindex="0"><span><b>${esc(ozStName(s))}</b><small>показать только этот магазин</small></span><b>${fm(v)}</b><i aria-hidden="true">›</i></div>`).join(""):"")
      +`<div class="ozd-h">По дням</div>`+D.map(([d,v])=>`<div class="ozd-r ozday" data-ozgo="d:${d}" role="button" tabindex="0"><span><b>${fd(d)}</b><i style="--w:${Math.round(Math.abs(v)/mx*100)}%"></i></span><b class="${v<0?"neg":""}">${fm(v)}</b><i aria-hidden="true">›</i></div>`).join(""); }
  else if(k==="tax"){ h="Налог — "+ozR(C.tax); sub="АУСН считается с того, что Озон перечислил на счёт (не с цены продажи)";
    body=`<label class="ozd-tax">Ставка налога, % <input type="text" inputmode="decimal" id="oz-tax" value="${esc(String(ozTax()))}"></label><p class="muted">Сохраняется для вас на всех устройствах. ${fm(C.tot)} × ${(+C.rate*100).toLocaleString("ru-RU")}% = ${fm(C.tax)} ₽</p>`
      +Object.entries(C.byS).map(([s,v])=>`<div class="ozd-r static"><span><b>${esc(ozStName(s))}</b><small>пришло ${fm(v)}</small></span><b>${fm(v*C.rate)}</b></div>`).join(""); }
  else if(k==="cost"||k==="miss"){ const L=C.L.filter(p=>p.q>0&&(k==="cost"||p.miss)).sort((a,b)=>(b.miss-a.miss)||b.cost-a.cost); h=k==="miss"?"Нет себестоимости":"Закупка — "+ozR(C.cost); sub="Впишите, сколько вам стоит 1 шт (закупка + фасовка + упаковка) — сайт запомнит";
    body=L.map(p=>`<div class="ozd-r ozd-c"><span data-ozp="${esc(p.key)}" role="button" tabindex="0"><b>${esc(p.name)}${ozTB(p)}</b><small>${p.q} шт${p.c!=null?" × "+fm(p.c)+" = "+fm(p.cost):""}${p.tanya&&p.c==null&&ozTm()==="net"?" · Тане всё, что перечислил Озон: "+fm(p.cost):""} · на руки ${p.q?fm(p.net/p.q):"—"} за шт</small></span>${p.tanya&&ozTm()==="net"?"":`<input type="text" inputmode="decimal" data-money data-ozc="${esc(p.key)}" value="${p.c==null?"":esc(String(p.c))}" placeholder="${p.tanya?"цена Тани":"₽ за 1 шт"}" class="${p.miss?"miss":""}">`}</div>`).join("")||`<div class="pvempty sm"><b>У всех товаров себестоимость вписана</b></div>`; }
  else if(k==="price"){ const L=C.L.filter(p=>p.g&&p.g.st).sort((a,b)=>({loss:0,low:1,ok:2}[a.g.st]-{loss:0,low:1,ok:2}[b.g.st])||(a.g.unit-b.g.unit));
    h="Контроль цен"; sub="Какой должна быть цена на Озоне, чтобы не уйти в минус и получать "+ozTarget()+" ₽ с 1 шт";
    body=`<label class="ozd-tax">Хочу зарабатывать с 1 шт не меньше, ₽ <input type="text" inputmode="decimal" id="oz-target" value="${esc(String(ozTarget()))}"></label><p class="muted ozgn">Расчёт по удержаниям этого периода: комиссия и эквайринг — процентом от цены, логистика и доставка — за штуку, налог ${(+C.rate*100).toLocaleString("ru-RU")}%. ${OZU.al?"Общие расходы (хранение, реклама) учтены.":"Хранение и реклама магазина не учтены — включите «Разложить общие расходы», чтобы учесть."}</p>`
      +(L.map(p=>ozGuardRow(p)).join("")||`<div class="pvempty sm"><b>Впишите себестоимость товаров — без неё цену не посчитать</b></div>`); }
  else if(k==="prof"){ h="Чистая прибыль — "+ozR(C.prof); sub="По товарам: на руки − налог − закупка"+(OZU.al?" − доля общих расходов":"");
    const L=C.L.slice().sort((a,b)=>b.P-a.P);
    body=L.map(p=>ozPr(p, p.P, p.miss?"нет себестоимости — прибыль завышена":(p.q+" шт · "+(p.q?fm(p.P/p.q):"—")+" за шт"))).join("")
      +(OZU.al||!C.un?"":`<div class="ozd-r" data-ozk2="held" role="button" tabindex="0"><span><b>Общие расходы магазина</b><small>хранение, реклама, кросс-докинг… — без товара, после налога</small></span><b class="neg">${fm(C.un*(1-C.rate))}</b><i aria-hidden="true">›</i></div>`); }
  CARD_RE=()=>ozDetail(k); openCard(ozHead(kick, h, sub)+`<div class="ozd">${body}</div>`, true, ()=>{}); ozDlg(); }
function ozProd(art, R){ const C=ozCalc(R), p=C.L.find(x=>x.key===art)||C.L.find(x=>x.art===art); if(!p){ toast("info","Товара нет в этом периоде"); return; }
  const tn=p.tanya&&ozTm()==="net", fbo=p.tanya||!!p.sch.FBO;
  const u=v=>p.q?fm(v/p.q):"—", T=Object.entries(p.types).sort((a,b)=>b[1]-a[1]);
  const body=`<div class="oztiles sm">${[["Продано",p.q+" шт",""],["Цена за шт",u(p.sales),""],["На руки за шт",u(p.net),"после всех удержаний Озона"],["Прибыль за шт",p.miss?"?":u(p.P),p.miss?"впишите себестоимость":"после налога и закупки"]].map(x=>`<div class="oztile static"><small>${x[0]}</small><b>${x[1]}</b>${x[2]?`<span>${x[2]}</span>`:""}</div>`).join("")}</div>
    ${fbo?`<div class="ozown"><span>Товар на складе FBO</span><div class="pfchips" data-ozowna="${esc(p.art)}">${ozChips([["m","Мой"],["t","Тани"]], p.tanya||ozOwnT(p.art)?"t":"m", "ozown")}</div><small class="muted">${p.tanya?"Продажи со склада FBO — товар Тани: ей "+(tn?"всё, что Озон перечислил за него"+(ozTtax()?" минус налог":""):"по её цене за 1 шт")+". realFBS — ваш.":"Если этот товар на FBO поставила Таня — нажмите «Тани»"}</small></div>`:""}
    ${tn?`<div class="ozd-r static"><span><b>Тане</b><small>всё, что Озон перечислил за товар${ozTtax()?" минус налог":""}</small></span><b>${fm(p.cost)}</b></div>`:`<label class="ozd-tax">${p.tanya?"Цена Тани за 1 шт":"Себестоимость 1 шт"}, ₽ <input type="text" inputmode="decimal" data-money data-ozc="${esc(p.key)}" value="${p.c==null?"":esc(String(p.c))}" placeholder="впишите"></label>`}
    <div class="ozd-h">Из чего сложилось</div>${T.map(([t,v])=>`<div class="ozd-r static"><span><b>${esc(t)}</b><small>${u(v)} за шт</small></span><b class="${v<0?"neg":""}">${fm(v)}</b></div>`).join("")}
    <div class="ozd-r static tot"><span><b>Пришло на руки</b></span><b>${fm(p.net)}</b></div>
    <div class="ozd-r static"><span><b>Налог ${(+C.rate*100).toLocaleString("ru-RU")}%</b></span><b class="neg">${fm(-p.tax)}</b></div>
    <div class="ozd-r static"><span><b>${p.tanya?"Тане":"Закупка"}</b><small>${tn?"всё, что перечислил Озон"+(ozTtax()?" минус налог":""):p.c==null?(p.tanya?"цена Тани не вписана":"себестоимость не вписана"):p.q+" × "+fm(p.c)}</small></span><b class="neg">${fm(-p.cost)}</b></div>
    ${OZU.al&&p.share?`<div class="ozd-r static"><span><b>Доля общих расходов</b><small>пропорционально продажам, после налога</small></span><b class="neg">${fm(p.share*(1-C.rate))}</b></div>`:""}
    <div class="ozd-r static tot"><span><b>Прибыль</b></span><b class="${p.P<0?"neg":"pos"}">${p.miss?"?":fm(p.P)}</b></div>
    ${p.g&&p.g.p0?`<div class="ozd-h">Цена продажи</div><div class="ozd-r static"><span><b>Сейчас продаёте по</b><small>Озон удерживает ${Math.round(p.g.r*100)}% от цены + ${fm(p.g.fix)} за шт</small></span><b>${fm(p.g.price)}</b></div>
      <div class="ozd-r static"><span><b>Цена без убытка</b><small>ниже — каждая продажа в минус</small></span><b class="${p.g.st==="loss"?"neg":""}">${p.g.p0.toLocaleString("ru-RU")} ₽</b></div>
      <div class="ozd-r static"><span><b>Цена для прибыли ${ozTarget()} ₽ с 1 шт</b><small>${p.g.st==="ok"?"уже продаёте не дешевле":"поднять на "+(p.g.pt-p.g.price).toLocaleString("ru-RU",{maximumFractionDigits:0})+" ₽"}</small></span><b>${p.g.pt.toLocaleString("ru-RU")} ₽</b></div>`:""}`;
  const pt=R?(R.a===R.b?fd(R.a):fd(R.a)+" – "+fd(R.b)):ozPerTxt();
  CARD_RE=()=>ozProd(p.tanya===ozOwnT(p.art)?p.key:(ozOwnT(p.art)?p.art+"~t":p.art), R); openCard(ozHead("Озон · товар · "+esc(pt), esc(p.name), esc(p.art.startsWith("sku:")?"":"Артикул "+p.art)+" "+ozSchB(p)+ozTB(p))+`<div class="ozd"${R?` data-ozr="${R.a}_${R.b}"`:""}>${body}</div>`, true, ()=>{}); ozDlg(); }
function ozType(type){ let C=ozCalc(); if(!C.T[type]) C=ozCalc({sch:"all"}); const t=C.T[type]; if(!t){ toast("info","За этот период таких начислений нет"); return; }
  const L=Object.entries(t.arts).map(([a,v])=>({p:C.L.find(x=>x.key===a)||C.L.find(x=>x.art===a)||{art:a, key:a, name:(OZ.d.names[a]||a), q:0}, v})).sort((a,b)=>a.v-b.v);
  const body=(Math.abs(t.un)>=0.5?`<div class="ozd-r static"><span><b>Без товара — на весь магазин</b><small>${t.grp==="Услуги FBO"?"хранение и операции на складах Озона":"начислено магазину целиком"}</small></span><b class="${t.un<0?"neg":""}">${fm(t.un)}</b></div>`:"")+L.map(x=>ozPr(x.p, x.v, x.p.q?x.p.q+" шт · "+fm(x.v/x.p.q)+" за шт":"")).join("");
  CARD_RE=()=>ozType(type); openCard(ozHead("Озон · "+esc(t.grp)+" · "+esc(ozPerTxt()), esc(type)+" — "+fm(t.s)+" ₽", "По каким товарам")+`<div class="ozd">${body}</div>`, true, ()=>{}); ozDlg(); }
function ozDlg(){ const d=$("#fd-dcard"); if(!d||d._oz) return; d._oz=1;
  d.addEventListener("click", e=>{ const p=e.target.closest("[data-ozp]"); if(p && !e.target.closest("input")){ const r=p.closest("[data-ozr]"), rr=r&&r.dataset.ozr.split("_"); ozProd(p.dataset.ozp, rr?{a:rr[0], b:rr[1]}:undefined); return; }
    if(ozDlgClick(e, d)) return;
    const t=e.target.closest("[data-ozt]"); if(t){ ozType(t.dataset.ozt); return; }
    const k=e.target.closest("[data-ozk2]"); if(k){ ozDetail(k.dataset.ozk2); return; }
    const g=e.target.closest("[data-ozgo]"); if(g){ const v=g.dataset.ozgo; navReset(); try{ d.close(); }catch(x){} if(v.startsWith("st:")) OZU.st=v.slice(3); else { OZU.per="c"; OZU.a=OZU.b=v.slice(2); } ozUiSave(); ozDraw(); return; } });
  d.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.matches("[role=button]")){ e.preventDefault(); e.target.click(); } });
  const tg=d.querySelector("#oz-target"); if(tg) tg.addEventListener("change", ()=>{ const v=String(tg.value).replace(",",".").replace(/\s/g,"").trim(), p=getPrefs(); if(v===""||!isFinite(+v)||+v<0){ toast("err","Впишите сумму, например 50"); return; } p.ozTarget=+v; setPrefs(p,true); ozDraw(); ozDetail("price"); });
  const tx=d.querySelector("#oz-tax"); if(tx) tx.addEventListener("change", ()=>{ const v=String(tx.value).replace(",",".").trim(), p=getPrefs(); if(v===""||!isFinite(+v)||+v<0||+v>50){ toast("err","Ставка — число от 0 до 50"); return; } p.ozTax=+v; setPrefs(p,true); ozDraw(); toast("ok","Ставка налога: "+(+v)+"%"); }); }
/* ---- подключение Seller API ---- */
function ozKeysOpen(){ const S=ozStores(), K=OZ.keys||[], ok=ozSrvOk();
  const body=!ok?`<div class="ozhello"><b>Нужно обновить скрипт таблицы</b><p class="muted">Сайт обращается к Озону через скрипт таблицы (Code.gs версии 53 и новее). Пока его нет, работает загрузка отчёта Excel.</p><button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`
    :`<p class="muted ozkh">Кабинет Озона → Настройки → Seller API → «Сгенерировать ключ», роль <b>Admin read only</b> (только чтение — сайт ничего не меняет в магазине). Скопируйте Client-Id и ключ. Ключ хранится в настройках скрипта таблицы, сайт видит только 4 последних знака.</p>`
    +S.map(s=>{ const k=K.find(x=>x.id===s.id); return `<div class="ozk" data-ozks="${esc(s.id)}"><div class="ozkh2"><input type="text" class="ozkn" value="${esc(s.n)}" aria-label="Название магазина" autocomplete="off"><span class="${k?"ok":"muted"}">${k?"подключён · Client-Id "+esc(k.cid)+" · ключ …"+esc(k.tail):"не подключён"}</span></div>
      <div class="ozkf"><input type="text" class="ozkc" inputmode="numeric" placeholder="Client-Id" value="${k?esc(k.cid):""}" autocomplete="off"><input type="text" class="ozkk ozsec" placeholder="${k?"новый Api-Key (если меняете)":"Api-Key"}" autocomplete="off" spellcheck="false"><button type="button" class="btn sm pri" data-ozkey="save">${k?"Заменить":"Подключить"}</button>${k?`<button type="button" class="btn sm ghost" data-ozkey="del">Отключить</button>`:""}</div>
      <div class="ozkd"><button type="button" class="btn sm ghost" data-ozkey="wipe">Удалить загруженные данные магазина</button></div></div>`; }).join("")
    +`<button type="button" class="btn sm ghost" data-ozkey="add">+ Ещё магазин</button>${OZ.raw?`<p class="muted ozkh">Если суммы не сходятся с кабинетом — <button type="button" class="btn sm ghost" data-ozkey="raw">скачайте ответ Озона за ${fd(OZ.raw.date)}</button> и пришлите его Claude.</p>`:""}`;
  CARD_RE=null; openCard(ozHead("Озон", "Подключение магазинов", "Начисления будут приходить сами — каждый раз, когда вы открываете вкладку"), true, ()=>{});
  const d=$("#fd-dcard"); if(!d) return; d.insertAdjacentHTML("beforeend", `<div class="ozd ozkeys">${body}</div>`);
  const how=d.querySelector("#srvOldHow"); if(how) how.onclick=()=>{ try{ d.close(); }catch(e){} const b=$("#srvOld button, #srvOld [data-how]"); if(b) b.click(); else toast("info","Как обновить скрипт","Откройте в GitHub файл dev/Code.template.gs → «Copy raw file» → вставьте в Apps Script вместо Code.gs → «Развернуть» → «Новая версия»."); };
  d.addEventListener("change", e=>{ if(!e.target.matches(".ozkn")) return; const id=e.target.closest("[data-ozks]").dataset.ozks, v=e.target.value.trim(); if(!v) return; const p=getPrefs(); p.ozSt=ozStores().map(s=>s.id===id?{id, n:v}:s); setPrefs(p,true); ozDraw(); });
  d.addEventListener("click", async e=>{ const b=e.target.closest("[data-ozkey]"); if(!b) return; const a=b.dataset.ozkey, box=b.closest("[data-ozks]"), id=box&&box.dataset.ozks;
    if(a==="add"){ const p=getPrefs(), L=ozStores().slice(); L.push({id:"s"+Date.now().toString(36), n:"Магазин "+(L.length+1)}); p.ozSt=L; setPrefs(p,true); ozKeysOpen(); ozDraw(); return; }
    if(a==="raw"){ const bl=new Blob([JSON.stringify(OZ.raw,null,1)],{type:"application/json"}), u=URL.createObjectURL(bl), x=document.createElement("a"); x.href=u; x.download="ozon-"+OZ.raw.store+"-"+OZ.raw.date+".json"; document.body.appendChild(x); x.click(); x.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); return; }
    if(a==="wipe"){ if(!armed(b,"Точно удалить? Нажмите ещё раз")) return; delete OZ.d.days[id]; if(OZ.d.dirty) delete OZ.d.dirty[id]; ozSave(); if(ozShareOk()) api({action:"ozon", op:"wipe", id}).then(j=>{ if(j&&j.ok&&j.wat){ (OZ.d.wseen=OZ.d.wseen||{})[id]=j.wat; ozSave(); } }).catch(()=>{}); toast("ok","Данные «"+ozStName(id)+"» удалены"+(ozShareOk()?" на всех устройствах":" с этого устройства")); ozDraw(); return; }
    if(a==="del"){ if(!armed(b,"Точно отключить?")) return; try{ const j=await api({action:"ozon", op:"del", id}); if(!j||j.ok===false) throw new Error(j&&j.error||"нет ответа"); OZ.keys=j.keys||[]; logEv("Данные","Озон: отключён ключ «"+ozStName(id)+"»"); ozKeysOpen(); ozDraw(); }catch(x){ toast("err","Не получилось", x.message); } return; }
    if(a==="save"){ const c=box.querySelector(".ozkc").value.trim(), k=box.querySelector(".ozkk").value.trim(); if(!c||!k){ toast("err","Впишите Client-Id и Api-Key"); return; }
      b.disabled=true; b.textContent="Проверяю…";
      try{ const j=await api({action:"ozon", op:"key", id, name:ozStName(id), clientId:c, apiKey:k}); if(!j||j.ok===false) throw new Error(j&&j.error||"нет ответа");
        OZ.keys=j.keys||[]; logEv("Данные","Озон: подключён ключ «"+ozStName(id)+"»"); toast("ok","Озон подключён", ozStName(id)+" — загружаю начисления…"); try{ d.close(); }catch(x){} delete OZ.d.types[id]; OZ.at=0; ozDraw(); ozSync(false); }
      catch(x){ b.disabled=false; b.textContent="Подключить"; toast("err","Не получилось подключить", x.message); } } }); }
/* ---- из чего сложилась выплата: FBO (ваш и Тани) + realFBS + общие расходы магазина (просьба Даниила 25.11.2026: «Пришло на счёт как будто не сходится») ---- */
function ozParts(R){ const A=ozCalc(Object.assign({}, R||{}, {sch:"all"})), F=ozCalc(Object.assign({}, R||{}, {sch:"FBO"})), RF=ozCalc(Object.assign({}, R||{}, {sch:"RFBS"}));
  const ft=F.TL.reduce((s,p)=>s+p.net,0); return {A, F, RF, ft, fm:F.tot-ft, rf:RF.tot, gen:A.tot-F.tot-RF.tot}; }
function ozGen(R){ const X=ozParts(R), L=Object.values(X.A.T).filter(t=>Math.abs(t.un)>=0.5 && !OZ_RFX.test(t.type)).map(t=>({type:t.type, grp:t.grp, v:t.un})).sort((a,b)=>a.v-b.v);
  return {s:X.gen, L, rest:X.gen-L.reduce((s,t)=>s+t.v,0)}; }
function ozSplit(C){ const X=ozParts(), one=OZU.sch!=="all", c=(cls, attr, lab, v, sub)=>`<div class="ozspc ${cls}" ${attr} role="button" tabindex="0"><small>${lab}</small><b>${fm(v)}</b>${sub?`<span>${sub}</span>`:""}</div>`;
  return `<div class="ozsplit"><div class="ozsph">${one?"Вы смотрите одну схему. Весь магазин за период":"Из чего сложилась сумма к выплате"} — <b>${fm(X.A.tot)} ₽</b></div><div class="ozsp">
    ${c(OZU.sch==="FBO"?"on":"", 'data-ozsch="FBO"', "FBO · ваш товар", X.fm, "")}
    ${X.F.TL.length||ozOwnN()?c("t", 'data-oz="own"', "FBO · товар Тани", X.ft, X.F.TL.length?"Тане "+fm(X.F.tanya):"")+"":""}
    ${c(OZU.sch==="RFBS"?"on":"", 'data-ozsch="RFBS"', "realFBS · ваш товар", X.rf, "")}
    ${c("neg", 'data-ozk="gen"', "Общие расходы магазина", X.gen, "хранение, реклама, приёмка…")}
  </div>${one?`<small>Общие расходы магазина не относятся ни к одной схеме, поэтому при выборе FBO или realFBS их не видно. FBO + realFBS + общие = вся сумма.</small>`:""}</div>`; }
/* ---- выплаты на р/с: Озон платит за неделю пн–вс (на стыке месяцев неделя делится), примерно через 30 дней после понедельника ---- */
const OZ_INN="7704217370";
function ozMon(iso){ const d=new Date(iso+"T00:00:00Z"); return ozAdd(iso, -((d.getUTCDay()+6)%7)); }
function ozPers(n){ const out=[]; let m=ozMon(todayISO());
  while(out.length<n){ const e=ozAdd(m,6);
    if(m.slice(0,7)!==e.slice(0,7)){ const f=e.slice(0,7)+"-01"; out.push({a:f, b:e, m}); out.push({a:m, b:ozAdd(f,-1), m}); } else out.push({a:m, b:e, m});
    m=ozAdd(m,-7); }
  return out.slice(0,n).map(p=>Object.assign(p, {k:p.a+"_"+p.b, pay:ozAdd(p.m,30)})); }
const ozPayN=()=>Math.max(8, +OZU.pn||8);
function ozPayRng(){ const L=ozPers(ozPayN()); return [L[L.length-1].a, todayISO()]; }
const ozPerName=p=>{ const M=["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"], da=+p.a.slice(8), db=+p.b.slice(8), ma=+p.a.slice(5,7)-1, mb=+p.b.slice(5,7)-1;
  return (p.a===p.b?da+" "+M[ma]:ma===mb?da+"–"+db+" "+M[mb]:da+" "+M[ma]+" – "+db+" "+M[mb]); };
const ozPrefK=(f,k)=>{ const v=(getPrefs()[f]||{})[k]; return v==null||v===""?null:v; };
function ozPrefSet(f,k,v){ const p=getPrefs(); p[f]=Object.assign({}, p[f]||{}); if(v==null||v==="") delete p[f][k]; else p[f][k]=v; setPrefs(p,true); }
function ozBankOps(){ try{ return (typeof BNK==="function"?BNK().ops:[]).filter(o=>String(o.payerInn||"").replace(/\D/g,"")===OZ_INN || /интернет решени|ozon|озон/i.test(o.payerName||"")); }catch(e){ return []; } }
function ozPayFact(per, W, used){ const f=ozPrefK("ozPf", per.k); if(f!=null) return {s:+f, by:"вы вписали"};
  const L=ozBankOps().filter(o=>!used.has(o) && Math.abs(new Date(String(o.date).slice(0,10))-new Date(per.pay))<=8*864e5).sort((x,y)=>Math.abs(+x.sum-W)-Math.abs(+y.sum-W));
  const o=L[0]; if(!o || Math.abs(+o.sum-W)>Math.max(5, Math.abs(W)*0.03)) return null; used.add(o); return {s:+o.sum, d:o.date, by:"банк"}; }
function ozPay(per){ const X=ozParts(per), A=X.A, rate=A.rate, tax=A.tot*rate, my=X.F.L.filter(p=>!p.tanya), rfz=ozPrefK("ozRfz", per.k);
  const myCost=my.reduce((s,p)=>s+p.cost,0), myMiss=my.filter(p=>p.miss), rfAuto=X.RF.L.reduce((s,p)=>s+p.cost,0), rfMiss=X.RF.L.filter(p=>p.miss), rfCost=rfz!=null?+rfz:rfAuto;
  const tanya=X.F.tanya, tMiss=X.F.TL.filter(p=>p.miss), c=A.cov[Object.keys(A.cov)[0]]||{days:0,n:0};
  return {per, X, W:A.tot, tax, tanya, tMiss, myCost, myMiss, rfz:rfz!=null?+rfz:null, rfAuto, rfMiss, rfCost, net:A.tot-tanya-tax-myCost-rfCost, miss:c.days-c.n, none:!c.n, sold:A.q,
    paid:ozPrefK("ozTpd", per.k), open:per.b>=todayISO()}; }
function ozPayList(){ const n=ozPayN(), P=ozPers(n), used=new Set(), t=todayISO(), hasT=ozOwnN()>0;
  const rows=P.map(per=>{ const x=ozPay(per); x.fact=x.open?null:ozPayFact(per, x.W, used); return x; });
  const wait=rows.filter(x=>!x.open&&!x.none&&x.per.pay>=t), wsum=wait.reduce((s,x)=>s+x.W,0), tOwe=rows.filter(x=>!x.open&&x.tanya>0.5&&!x.paid);
  return `<div class="ozpayh"><p class="muted">Озон перечисляет деньги раз в неделю: за продажи с понедельника по воскресенье (на стыке месяцев неделя делится на две выплаты), примерно через месяц. Нажмите на выплату — увидите, за какие товары эти деньги, сколько отдать Тане и сколько остаётся вам.</p>
    <div class="oztiles"><div class="oztile static ok"><small>Ещё придёт</small><b>${ozR(wsum)}</b><span>${wait.length} ${plural(wait.length,["выплата","выплаты","выплат"])}</span></div>
    ${hasT?`<div class="oztile static${tOwe.length?" warn":""}"><small>Отдать Тане</small><b>${ozR(tOwe.reduce((s,x)=>s+x.tanya,0))}</b><span>${tOwe.length?"по "+tOwe.length+" "+plural(tOwe.length,["выплате","выплатам","выплатам"])+" · отмечайте «Отдал Тане»":"всё отдано"}</span></div>`:`<div class="oztile" data-oz="own" role="button" tabindex="0"><small>Товар Тани</small><b>не отмечен</b><span>отметьте её товары на FBO ›</span></div>`}
    <div class="oztile static"><small>Ставка налога</small><b>${(+ozTax()).toLocaleString("ru-RU")}%</b><span>с каждой выплаты</span></div></div></div>
  <div class="ozpays">${rows.map(x=>{ const p=x.per, st=x.none?["none","Нет данных Озона за эти дни"]:x.open?["now","Неделя идёт — сумма ещё растёт"]:x.fact?["got","Пришла "+(x.fact.d?fd(x.fact.d):"")+" · "+fm(x.fact.s)+" ₽"]:p.pay>t?["wait","Ожидается ≈ "+fd(p.pay)]:p.pay===t?["wait","Придёт сегодня ≈ "+fd(p.pay)]:["past","Выплата ≈ "+fd(p.pay)+" · сверьте с р/с"];
      if(x.none) return `<div class="ozpay none" data-ozpay="${p.k}" role="button" tabindex="0"><div class="ozpy1"><b>—</b><span>за ${ozPerName(p)}</span></div><div class="ozpy2"><em class="ozps">${st[1]}</em></div><div class="ozpy3"><span>${x.open?"неделя идёт":"≈ "+fd(p.pay)}</span></div><i class="pkgo" aria-hidden="true">›</i></div>`;
      return `<div class="ozpay ${st[0]}" data-ozpay="${p.k}" role="button" tabindex="0"><div class="ozpy1"><b>${fm(x.W)} ₽</b><span>за ${ozPerName(p)}</span></div>
        <div class="ozpy2"><em class="ozps ${st[0]}">${st[1]}</em>${x.miss>0&&!x.open?`<em class="ozps warn">не хватает данных за ${x.miss} ${plural(x.miss,["день","дня","дней"])}</em>`:""}</div>
        <div class="ozpy3">${x.tanya>0.5||x.tMiss.length?`<span class="${x.paid?"ok":"t"}">Тане ${x.tMiss.length?"? ":""}${fm(x.tanya)}${x.paid?" · отдал ✓":""}</span>`:""}<span>Вам чистыми <b class="${x.net<0?"neg":"pos"}">${x.myMiss.length||(x.rfz==null&&x.rfMiss.length)?"≈ ":""}${fm(x.net)}</b></span></div><i class="pkgo" aria-hidden="true">›</i></div>`; }).join("")}</div>
  <button type="button" class="btn sm ghost" data-oz="paymore">Показать ещё 8 выплат</button>`; }
function ozPayCard(k){ const per=ozPers(ozPayN()+12).find(p=>p.k===k); if(!per){ toast("info","Выплата не найдена"); return; }
  const x=ozPay(per), X=x.X, A=X.A, R={a:per.a, b:per.b}, rate=A.rate, pr=(L, cap)=>L.length?`<div class="ozd-h">${cap}</div>`+L.slice().sort((a,b)=>b.net-a.net).map(p=>ozPr(p, p.net, p.q+" шт · на руки "+(p.q?fm(p.net/p.q):"—")+" за шт")).join(""):"";
  const fact=x.open?null:ozPayFact(per, x.W, new Set()), my=X.F.L.filter(p=>!p.tanya), tm=ozTm(), G=ozGen(R);
  const line=(lab, sub, v, cls)=>`<div class="ozd-r static${cls?" "+cls:""}"><span><b>${lab}</b>${sub?`<small>${sub}</small>`:""}</span><b class="${v<0?"neg":""}">${fm(v)}</b></div>`;
  const body=`${x.open?`<div class="ozwarn">Неделя ещё не закончилась — сумма будет расти до воскресенья.</div>`:""}${x.miss>0&&!x.open?`<div class="ozwarn">Нет данных Озона за ${x.miss} ${plural(x.miss,["день","дня","дней"])} этого периода — сумма может быть меньше настоящей. Нажмите «Обновить из Озона» на вкладке.</div>`:""}
    <div class="oztiles sm"><div class="oztile static ok"><small>Выплата</small><b>${fm(x.W)}</b><span>${x.open?"неделя идёт":fact?"пришла "+(fact.d?fd(fact.d):""):"≈ "+fd(per.pay)}</span></div>
      <div class="oztile static${x.tanya>0.5&&!x.paid?" warn":""}"><small>Тане</small><b>${fm(x.tanya)}</b><span>${x.paid?"отдал "+fd(String(x.paid.at||"").slice(0,10)):X.F.TL.length?"ещё не отдал":"её товара в этой выплате нет"}</span></div>
      <div class="oztile static"><small>Налог ${(+rate*100).toLocaleString("ru-RU")}%</small><b>${fm(-x.tax)}</b><span>со всей выплаты</span></div>
      <div class="oztile static ${x.net<0?"bad":"good"}"><small>Вам чистыми</small><b>${fm(x.net)}</b><span>${x.myMiss.length||(x.rfz==null&&x.rfMiss.length)?"примерно — не вся закупка вписана":"после Тани, налога и закупки"}</span></div></div>
    <div class="ozd-h">Из чего сложилась выплата</div>
    ${line("FBO · товар Тани", X.F.TL.reduce((s,p)=>s+p.q,0)+" шт", X.ft)}${line("FBO · ваш товар", my.reduce((s,p)=>s+p.q,0)+" шт", X.fm)}${line("realFBS · ваш товар", X.RF.q+" шт", X.rf)}
    <div class="ozd-r" data-ozgenr role="button" tabindex="0"><span><b>Общие расходы магазина</b><small>${G.L.slice(0,3).map(t=>esc(t.type)).join(", ")||"хранение, реклама…"}</small></span><b class="${X.gen<0?"neg":""}">${fm(X.gen)}</b></div>
    <div class="ozgenl" hidden>${G.L.map(t=>line(esc(t.type), esc(t.grp), t.v)).join("")}</div>
    ${line("Выплата", "", x.W, "tot")}
    ${fact&&Math.abs(fact.s-x.W)>=1?`<div class="ozwarn">На р/с пришло ${fm(fact.s)} ₽ (${fact.by}) — на ${fm(fact.s-x.W)} ₽ ${fact.s>x.W?"больше":"меньше"}, чем начислено за эти дни. Обычно это удержание или доплата Озона из другого периода.</div>`:""}
    <div class="ozd-h">Расчёт с Таней</div>
    ${X.F.TL.length?X.F.TL.map(p=>`<div class="ozd-r ozd-c"><span data-ozp="${esc(p.key)}" role="button" tabindex="0"><b>${esc(p.name)}</b><small>${p.q} шт${tm==="net"?" · Озон перечислил "+fm(p.net)+(ozTtax()?" − налог "+fm(p.net*rate):""):p.c!=null?" × "+fm(p.c)+" = "+fm(p.cost):" · впишите её цену за 1 шт"}</small></span>${tm==="net"?`<b>${fm(p.cost)}</b>`:`<input type="text" inputmode="decimal" data-money data-ozc="${esc(p.key)}" value="${p.c==null?"":esc(String(p.c))}" placeholder="её цена" class="${p.miss?"miss":""}">`}</div>`).join("")
      +line("Отдать Тане", tm==="net"?"всё, что Озон перечислил за её товар"+(ozTtax()?", минус налог":""):"по её цене за 1 шт", x.tanya, "tot")
      +`<div class="ozpaid">${x.paid?`<span class="ok">✓ Отдал Тане ${fm(+x.paid.s||x.tanya)} ₽ · ${fd(String(x.paid.at||"").slice(0,10))}</span><button type="button" class="btn sm ghost" data-ozpaid="off">Снять отметку</button>`:`<button type="button" class="btn sm pri" data-ozpaid="on"${x.open?" disabled title=\"Неделя ещё идёт\"":""}>Отдал Тане ${fm(x.tanya)} ₽</button>`}<button type="button" class="btn sm ghost" data-oz="own">Товар Тани и как считать ›</button></div>`
      :`<p class="muted">В этой выплате нет продаж товара Тани со склада FBO. <button type="button" class="btn sm ghost" data-oz="own">Отметить товар Тани ›</button></p>`}
    <div class="ozd-h">Ваши деньги</div>
    ${line("Выплата", "", x.W)}${x.tanya?line("− Тане", "", -x.tanya):""}${line("− Налог "+(+rate*100).toLocaleString("ru-RU")+"%", "со всей выплаты: "+fm(x.W)+" × "+(+rate*100).toLocaleString("ru-RU")+"%", -x.tax)}
    ${line("− Закупка вашего товара FBO", x.myMiss.length?"нет себестоимости у "+x.myMiss.length+": "+x.myMiss.slice(0,3).map(p=>esc(p.name)).join(", "):my.length?"количество × себестоимость":"", -x.myCost)}
    <label class="ozd-tax ozrfz">− Закупка realFBS за эту неделю, ₽ <input type="text" inputmode="decimal" data-money id="oz-rfz" value="${x.rfz==null?"":esc(String(x.rfz))}" placeholder="${x.rfAuto?"≈ "+fm(x.rfAuto):"одной суммой"}"></label>
    <p class="muted ozgn">Впишите одной суммой, сколько закупили для realFBS. Пока пусто — считаю по себестоимости проданных товаров${x.rfAuto?": "+fm(x.rfAuto)+" ₽":""}${x.rfMiss.length?" (у "+x.rfMiss.length+" товаров её нет)":""}.</p>
    ${line("Вам чистыми", "", x.net, "tot")}
    ${x.open?"":`<label class="ozd-tax">Пришло на р/с фактически, ₽ <input type="text" inputmode="decimal" data-money id="oz-pf" value="${ozPrefK("ozPf", per.k)==null?"":esc(String(ozPrefK("ozPf", per.k)))}" placeholder="${fact&&fact.by==="банк"?fm(fact.s)+" (банк)":"необязательно"}"></label>`}
    <div class="ozd-h">За какие товары эти деньги</div>${pr(X.F.TL, "FBO · товар Тани")}${pr(my, "FBO · ваш товар")}${pr(X.RF.L, "realFBS")}`;
  CARD_RE=()=>ozPayCard(k); openCard(ozHead("Озон · выплата на р/с", fm(x.W)+" ₽ за "+ozPerName(per), x.open?"неделя ещё идёт":(fact?"пришла "+(fact.d?fd(fact.d):""):"Озон перечислит ≈ "+fd(per.pay)))+`<div class="ozd" data-ozr="${per.a}_${per.b}" data-ozpk="${per.k}">${body}</div>`, true, ()=>{}); ozDlg();
  const d=$("#fd-dcard"); if(d){ d._ozpk=k; } }
/* ---- товар Тани: какие товары на FBO её и как с ней считаться ---- */
const ozOwnN=()=>Object.values(getPrefs().ozOwn||{}).filter(v=>v==="t").length;
function ozOwnOpen(){ const M={}, D0=OZ.d||{days:{}}, nm=x=>(D0.names||{})[x]||(x.startsWith("sku:")?"SKU "+x.slice(4):x), am=x=>x&&x.startsWith("sku:")&&(D0.sku||{})[x.slice(4)]?D0.sku[x.slice(4)]:x;
  Object.values(D0.days).forEach(DD=>Object.values(DD).forEach(x=>(x.r||[]).forEach(r=>{ if(r[3]==="FBO" && r[2] && r[1]==="Выручка"){ const a=am(r[2]); M[a]=(M[a]||0)+(+r[4]||0); } })));
  Object.keys(getPrefs().ozOwn||{}).forEach(a=>{ if(!(a in M)) M[a]=0; });
  const L=Object.keys(M).sort((a,b)=>(ozOwnT(b)-ozOwnT(a))||nm(a).localeCompare(nm(b),"ru")), tm=ozTm();
  const body=`<p class="muted ozkh">Отметьте товары, которые Таня поставила на склад FBO. Продажи этих товаров со склада FBO — её, со склада realFBS — ваши. По каждой выплате сайт посчитает, сколько отдать Тане.</p>
    <div class="ozd-h">Сколько отдавать Тане</div>
    <div class="pfchips">${ozChips([["price","По её цене за 1 шт"],["net","Всё, что Озон перечислил за её товар"]], tm, "oztm")}</div>
    <p class="muted ozgn">${tm==="price"?"Тане — продано штук × её цена за 1 шт (как в её таблице поставок). Разница между тем, что перечислил Озон, и её ценой — ваша.":"Тане — всё, что Озон перечислил за её товар после своих удержаний."}</p>
    ${tm==="net"?`<label class="ozal"><input type="checkbox" id="oz-ttax"${ozTtax()?" checked":""}> Вычитать из её доли налог ${(+ozTax()).toLocaleString("ru-RU")}% (налог за всю выплату платите вы)</label>`:""}
    <p class="muted ozgn">Общие расходы магазина (хранение, реклама, приёмка) считаются вашими.</p>
    <div class="ozd-h">Товары, которые продавались со склада FBO</div>
    ${L.map(a=>{ const t=ozOwnT(a); return `<div class="ozd-r static ozown-r${t?" on":""}"><span><b>${esc(nm(a))}</b><small>${esc(a.startsWith("sku:")?"":a)} · продано на FBO ${M[a]} шт за загруженные дни</small></span>
      <div class="pfchips" data-ozowna="${esc(a)}">${ozChips([["m","Мой"],["t","Тани"]], t?"t":"m", "ozown")}</div>${t&&tm==="price"?`<input type="text" inputmode="decimal" data-money data-ozc="${esc(a)}~t" value="${ozCost(a+"~t")==null?"":esc(String(ozCost(a+"~t")))}" placeholder="её цена" aria-label="Цена Тани за 1 шт" class="${ozCost(a+"~t")==null?"miss":""}">`:""}</div>`; }).join("")||`<div class="pvempty sm"><b>Продаж со склада FBO пока нет в загруженных данных</b></div>`}`;
  CARD_RE=()=>ozOwnOpen(); openCard(ozHead("Озон", "Товар Тани", "Её товар на складе FBO и расчёт с ней по каждой выплате")+`<div class="ozd">${body}</div>`, true, ()=>{}); ozDlg(); }
function ozOwnSet(art, t){ const p=getPrefs(); p.ozOwn=Object.assign({}, p.ozOwn||{}); if(t) p.ozOwn[art]="t"; else delete p.ozOwn[art]; setPrefs(p,true);
  logEv("Прибыль", "Озон: «"+((OZ.d.names||{})[art]||art)+"» на FBO — "+(t?"товар Тани":"мой товар")); ozDraw(); }
function ozDlgClick(e, d){ const t=e.target;
  const ow=t.closest("[data-ozown]"); if(ow){ const box=ow.closest("[data-ozowna]"), a=box&&box.dataset.ozowna; if(!a) return true;
    if((ow.dataset.ozown==="t")===ozOwnT(a)) return true; ozOwnSet(a, ow.dataset.ozown==="t"); if(d._re) d._re(); return true; }
  const tm=t.closest("[data-oztm]"); if(tm){ const p=getPrefs(); p.ozTm=tm.dataset.oztm; setPrefs(p,true); ozDraw(); if(d._re) d._re(); return true; }
  if(t.closest("[data-ozgenr]")){ const l=d.querySelector(".ozgenl"); if(l) l.hidden=!l.hidden; return true; }
  const pd=t.closest("[data-ozpaid]"); if(pd){ const k=d._ozpk; if(!k) return true; const per=ozPers(ozPayN()+12).find(p=>p.k===k), x=per&&ozPay(per);
    if(pd.dataset.ozpaid==="off"){ if(!armed(pd,"Точно снять? Нажмите ещё раз")) return true; ozPrefSet("ozTpd", k, null); }
    else { ozPrefSet("ozTpd", k, {s:r2(x.tanya), at:new Date().toISOString(), by:curUser()}); logEv("Прибыль", "Озон: отдал Тане "+fm(x.tanya)+" ₽ за выплату "+ozPerName(per)); toast("ok","Отмечено: отдали Тане "+fm(x.tanya)+" ₽"); }
    ozDraw(); ozPayCard(k); return true; }
  const o=t.closest('[data-oz="own"]'); if(o){ ozOwnOpen(); return true; }
  return false; }
document.addEventListener("change", e=>{ const t=e.target, d=$("#fd-dcard"); if(!d||!d.contains(t)) return;
  if(t.id==="oz-rfz"||t.id==="oz-pf"){ const k=d._ozpk; if(!k) return; const v=String(t.value).trim(), n=typeof money==="function"?money(v):+v;
    if(v!==""&&!isFinite(n)){ toast("err","Впишите сумму числом"); return; } ozPrefSet(t.id==="oz-rfz"?"ozRfz":"ozPf", k, v===""?null:r2(n)); ozDraw(); ozPayCard(k); }
  if(t.id==="oz-ttax"){ const p=getPrefs(); p.ozTtax=t.checked?1:0; setPrefs(p,true); ozDraw(); if(d._re) d._re(); } });
/* ---- события вкладки ---- */
(function(){ const box=document.getElementById("oz"); if(!box) return;
  box.addEventListener("click", e=>{ const t=e.target;
    const s=t.closest("[data-ozst]"); if(s){ OZU.st=s.dataset.ozst; ozUiSave(); ozDraw(); ozSync(false); return; }
    const pe=t.closest("[data-ozper]"); if(pe){ OZU.per=pe.dataset.ozper; if(OZU.per==="c"&&!OZU.a){ const r=ozRange(); OZU.a=r[0]; OZU.b=r[1]; } ozUiSave(); ozDraw(); ozSync(false); return; }
    const sc=t.closest("[data-ozsch]"); if(sc){ OZU.sch=OZU.sch===sc.dataset.ozsch&&sc.matches(".ozspc")?"all":sc.dataset.ozsch; ozUiSave(); ozDraw(); return; }
    const vv=t.closest("[data-ozv]"); if(vv){ OZU.v=vv.dataset.ozv; ozUiSave(); ozDraw(); ozSync(false); if(OZU.v==="pay" && typeof bnSync==="function" && !BNK().ops.length) bnSync(true).then(()=>{ if(curTab==="ozon") ozDraw(); }).catch(()=>{}); return; }
    const py=t.closest("[data-ozpay]"); if(py){ ozPayCard(py.dataset.ozpay); return; }
    const k=t.closest("[data-ozk]"); if(k){ ozDetail(k.dataset.ozk); return; }
    const ty=t.closest("[data-ozt]"); if(ty){ ozType(ty.dataset.ozt); return; }
    const p=t.closest("[data-ozp]"); if(p && !t.closest("input")){ ozProd(p.dataset.ozp); return; }
    const a=t.closest("[data-oz]"); if(a){ const v=a.dataset.oz; if(v==="sync") ozSync(true); if(v==="keys") ozKeysOpen(); if(v==="own") ozOwnOpen(); if(v==="paymore"){ OZU.pn=ozPayN()+8; ozUiSave(); ozDraw(); ozSync(false); } } });
  box.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.matches("[role=button],[data-ozp]") && !e.target.matches("input")){ e.preventDefault(); e.target.click(); } });
  let qT=0; box.addEventListener("input", e=>{ if(e.target.id==="oz-q"){ OZU.q=e.target.value; clearTimeout(qT); qT=setTimeout(()=>{ ozUiSave(); ozDraw(); }, 200); } });
  box.addEventListener("change", e=>{ const t=e.target;
    if(t.id==="oz-file"){ const f=t.files&&t.files[0]; t.value=""; if(f) ozUpAsk(f); return; }
    if(t.id==="oz-sort"){ OZU.sort=t.value; ozUiSave(); ozDraw(); return; }
    if(t.id==="oz-al"){ OZU.al=t.checked; ozUiSave(); ozDraw(); return; }
    if(t.id==="oz-a"||t.id==="oz-b"){ OZU[t.id==="oz-a"?"a":"b"]=t.value; ozUiSave(); ozDraw(); ozSync(false); } }); })();
/* себестоимость — и во вкладке, и в окнах: сохраняется при уходе из поля, Enter — к следующему товару */
document.addEventListener("change", e=>{ const t=e.target; if(!t.matches||!t.matches("input[data-ozc]")) return; const art=t.dataset.ozc, old=ozCost(art);
  ozCostSet(art, t.value); const nw=ozCost(art); if(old===nw) return;
  setTimeout(()=>{ ozDraw(); const d=$("#fd-dcard"); if(d && d.contains(t)){ d.querySelectorAll(`input[data-ozc]`).forEach(x=>{ if(x.dataset.ozc===art) x.classList.toggle("miss", nw==null); }); } }, 0); });
document.addEventListener("keydown", e=>{ const t=e.target; if(e.key!=="Enter"||!t.matches||!t.matches("input[data-ozc]")) return; e.preventDefault();
  const L=[...(t.closest("dialog")||document.getElementById("oz")).querySelectorAll("input[data-ozc]")], i=L.indexOf(t); (L[i+1]||t).focus(); if(!L[i+1]) t.blur(); });
window.__oz={pull:f=>ozPull(f), ru:ozRu, pers:n=>ozPers(n), pay:k=>{ const p=ozPers(30).find(x=>x.k===k); return p&&ozPay(p); }, prefs:()=>getPrefs(), OZ, OZU, calc:()=>ozCalc()};   /* для тестов (dev/test/ozon.py) */
