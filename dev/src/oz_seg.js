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
const OZ_DEF_ST=[{id:"fd", n:"Frudom / ФД"},{id:"is", n:"Исток"}];
const OZ_PER=[["m0","Этот месяц"],["m1","Прошлый месяц"],["d7","7 дней"],["d30","30 дней"],["y","С начала года"],["c","Свои даты"]];
const OZ_SCH=[["all","Все схемы"],["FBO","FBO"],["RFBS","realFBS"]];
const OZ_SORT=[["profit","Больше прибыль"],["loss","Меньше прибыль"],["unit","Прибыль за 1 шт"],["sales","Больше продажи"],["qty","Больше штук"],["name","По названию"]];
const OZU=(()=>{ let u={}; try{ u=JSON.parse(localStorage.getItem("frudom-oz-ui")||"{}")||{}; }catch(e){} return Object.assign({st:"all", sch:"all", per:"m0", a:"", b:"", sort:"profit", q:"", al:false, f:""}, u); })();
const OZ={d:null, keys:null, kerr:"", busy:"", err:"", raw:null, at:0, ld:null};
const OZ_RFX=/realfbs|rfbs|за доставку от покупателя/i;
const OZ_EN={SaleCommission:"Вознаграждение за продажу", Acquiring:"Эквайринг", LastMile:"Последняя миля", Logistic:"Логистика", Logistics:"Логистика", ReturnLogistic:"Обратная логистика", DirectFlowLogistic:"Логистика", ReturnFlowLogistic:"Обратная логистика", Storage:"Размещение на складе", CrossDocking:"Кросс-докинг", Promotion:"Продвижение и реклама", DefectRate:"Превышение индекса ошибок", Delivery:"Доставка до места выдачи", Packaging:"Упаковка товара"};
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
function ozCost(art){ const c=(getPrefs().ozCost||{})[art]; return c==null||c===""||!isFinite(+c)?null:+c; }
function ozCostSet(art, v){ const p=getPrefs(); p.ozCost=Object.assign({}, p.ozCost||{}); const n=typeof money==="function"?money(v):+v;
  if(v==null||String(v).trim()===""||!isFinite(n)) delete p.ozCost[art]; else p.ozCost[art]=r2(n); setPrefs(p,true); }
const ozTax=()=>{ const t=getPrefs().ozTax; return t==null||t===""||!isFinite(+t)?8:+t; };
/* ---- период ---- */
function ozRange(){ const t=todayISO(), ym=t.slice(0,7), P=OZU.per;
  if(P==="m1"){ const a=ozAdd(ym+"-01",-1).slice(0,7)+"-01"; return [a, ozAdd(ym+"-01",-1)]; }
  if(P==="d7") return [ozAdd(t,-6), t]; if(P==="d30") return [ozAdd(t,-29), t]; if(P==="y") return [t.slice(0,4)+"-01-01", t];
  if(P==="c" && /^\d{4}-\d\d-\d\d$/.test(OZU.a) && /^\d{4}-\d\d-\d\d$/.test(OZU.b)) return OZU.a<=OZU.b?[OZU.a, OZU.b]:[OZU.b, OZU.a];
  return [ym+"-01", t]; }
const ozPerTxt=()=>{ const [a,b]=ozRange(); return a===b?fd(a):fd(a)+" – "+fd(b); };
const ozSel=()=>OZU.st==="all"?ozStores().map(s=>s.id):[OZU.st];
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
async function ozUpload(file, sid){ await ozLoad(); let R;
  try{ R=await ozXlsx(file); }catch(e){ toast("err","Не получилось прочитать отчёт", e.message); return; }
  const D=OZ.d.days[sid]=OZ.d.days[sid]||{};
  for(let d=R.per[0]; d<=R.per[1]; d=ozAdd(d,1)) delete D[d];
  Object.keys(R.days).forEach(d=>{ D[d]={s:"x", at:Date.now(), f:file.name, r:ozAgg(R.days[d])}; });
  Object.assign(OZ.d.names, R.names); Object.assign(OZ.d.sku, R.sku); ozSave();
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
    let fs=0; fees.forEach(f=>{ const nm=T[f.t]||f.nm||("Начисление "+f.t); add(nm, f.pi>=0?arts[f.pi]:one, 0, f.s); fs+=f.s; });
    let left=r2(tot-fs);
    if(prods.length && Math.abs(left)>=0.01){ const w=prods.map(p=>{ const q=+(p.quantity!=null?p.quantity:p.qty!=null?p.qty:1)||1; return {q, v:ozAmt(p.seller_price!=null?p.seller_price:p.price)*q}; }), W=w.reduce((s,x)=>s+x.v,0);
      prods.forEach((p,i)=>add("Выручка", arts[i], left<0?-w[i].q:w[i].q, r2(W?left*w[i].v/W:left/prods.length))); left=0; }
    if(Math.abs(left)>=0.005){ const tid=String(a.type_id!=null?a.type_id:a.accrual_type_id!=null?a.accrual_type_id:""), nm=T[tid]||a.type_name||a.name||(String(a.accrued_category||"").toUpperCase()==="NON_ITEM"?"Прочие начисления":"Прочее"); add(nm, one, 0, left); } });
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
async function ozSync(force){ if(OZ.busy||!online()) return; await ozLoad(); const K=(OZ.keys||[]).filter(k=>ozSel().includes(k.id)); if(!K.length) return;
  const [a,b]=ozRange(), t=todayISO(), old=ozAdd(t,-3); OZ.busy="Загружаю начисления из Озона…"; OZ.err=""; ozDraw();
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
        part.forEach(d=>{ DD[d]={s:"a", at:Date.now(), r:ozParseDay(acc[d], k.id)}; }); ozSave(); }
      await ozNames(k.id); }
    OZ.at=Date.now(); }
  catch(e){ OZ.err=e.message; }
  OZ.busy=""; ozSave(); ozDraw(); }
async function ozNames(sid){ const DD=OZ.d.days[sid]||{}, need=new Set();
  Object.values(DD).forEach(x=>(x.r||[]).forEach(r=>{ if(String(r[2]).startsWith("sku:") && !OZ.d.sku[r[2].slice(4)]) need.add(r[2].slice(4)); }));
  if(!need.size) return; const L=[...need].slice(0,1000);
  try{ const R=await ozCall(sid, "/v3/product/info/list", [{sku:L.map(Number)}]), b=R[0]&&R[0].body||{}, items=b.items||(b.result&&b.result.items)||[];
    items.forEach(it=>{ const o=it.offer_id; if(!o) return; if(it.name) OZ.d.names[o]=it.name; const S=[it.sku, it.fbo_sku, it.fbs_sku].concat((it.sources||[]).map(s=>s.sku)).filter(x=>x!=null&&x!==0);
      S.forEach(s=>OZ.d.sku[String(s)]=String(o)); }); }catch(e){} }
/* ---- расчёт ---- */
function ozCalc(){ const [a,b]=ozRange(), S=ozSel(), D0=OZ.d||{days:{},names:{},sku:{}}, rate=ozTax()/100;
  const am=x=>x&&x.startsWith("sku:")&&D0.sku[x.slice(4)]?D0.sku[x.slice(4)]:x, nm=x=>D0.names[x]||(x.startsWith("sku:")?"SKU "+x.slice(4):x);
  const rows=[], cov={}; S.forEach(sid=>{ const DD=D0.days[sid]||{}, c=cov[sid]={n:0, x:0, a:0, days:0};
    for(let d=a; d<=b; d=ozAdd(d,1)){ if(d<=todayISO()) c.days++; const x=DD[d]; if(!x) continue; c.n++; c[x.s==="x"?"x":"a"]++;
      (x.r||[]).forEach(r=>rows.push({sid, d, grp:r[0], type:r[1], art:am(r[2]), sch:r[3], q:r[4], s:r[5]})); } });
  const maj={}; rows.forEach(x=>{ if(x.art&&x.sch&&x.type==="Выручка"){ const m=maj[x.art]=maj[x.art]||{}; m[x.sch]=(m[x.sch]||0)+Math.abs(x.q)+1; } });
  const schOf=x=>x.sch||(maj[x.art]?Object.entries(maj[x.art]).sort((p,q)=>q[1]-p[1])[0][0]:"");
  const pass=x=>OZU.sch==="all"||(OZU.sch==="RFBS"?/FBS/.test(schOf(x)):schOf(x)===OZU.sch);
  const P={}, T={}, byS={}, byD={}, RF=[]; let tot=0, un=0;
  rows.forEach(x=>{ const rf=!x.art && OZ_RFX.test(x.type);   /* доставка realFBS без товара (партнёры Озона, деньги покупателя за доставку) — раскладываем по товарам realFBS */
    if(rf? !(OZU.sch==="all"||OZU.sch==="RFBS") : x.art?!pass(x):OZU.sch!=="all") return;
    if(rf){ RF.push(x); }
    tot+=x.s; byS[x.sid]=(byS[x.sid]||0)+x.s; byD[x.d]=(byD[x.d]||0)+x.s;
    const t=T[x.type]=T[x.type]||{type:x.type, grp:x.grp, s:0, un:0, arts:{}}; t.s+=x.s; if(x.art) t.arts[x.art]=(t.arts[x.art]||0)+x.s; else t.un+=x.s;
    if(rf) return; if(!x.art){ un+=x.s; return; }
    const p=P[x.art]=P[x.art]||{art:x.art, name:nm(x.art), q:0, sales:0, net:0, sch:{}, types:{}, st:{}};
    if(x.type==="Выручка") p.q+=x.q; if(x.grp==="Продажи") p.sales+=x.s; p.net+=x.s; p.types[x.type]=(p.types[x.type]||0)+x.s; p.st[x.sid]=1; const sc=schOf(x); if(sc) p.sch[sc==="FBS"?"RFBS":sc]=1; });
  const rfP=Object.values(P).filter(p=>p.sch.RFBS&&p.sales>0), rfS=rfP.reduce((s,p)=>s+p.sales,0);
  if(RF.length){ if(rfS) RF.forEach(x=>rfP.forEach(p=>{ const v=x.s*p.sales/rfS, k=x.type+" (общая, по доле продаж)"; p.net+=v; p.types[k]=(p.types[k]||0)+v; T[x.type].arts[p.art]=(T[x.type].arts[p.art]||0)+v; T[x.type].un-=v; }));
    else RF.forEach(x=>{ un+=x.s; }); }
  const L=Object.values(P).filter(p=>p.q||Math.abs(p.sales)>=1||Math.abs(p.net)>=1), sales=L.reduce((s,p)=>s+p.sales,0);
  L.forEach(p=>{ p.c=ozCost(p.art); p.miss=p.c==null && p.q>0; p.cost=p.c==null?0:p.c*p.q; p.tax=p.net*rate; p.prof=p.net-p.tax-p.cost;
    p.share=sales&&p.sales>0?un*p.sales/sales:0; p.profA=p.prof+p.share*(1-rate); p.P=OZU.al?p.profA:p.prof; });
  const cost=L.reduce((s,p)=>s+p.cost,0), q=L.reduce((s,p)=>s+p.q,0), tax=tot*rate;
  return {a, b, L, T, tot, un, sales, held:tot-sales, tax, rate, cost, q, prof:tot-tax-cost, miss:L.filter(p=>p.miss), byS, byD, cov, rows:rows.length}; }
/* ---- вкладка ---- */
function renderOzon(){ if(!me().admin) return; const box=$("#oz"); if(!box) return;
  if(!OZ.d){ box.innerHTML=`<div class="ozbusy"><span class="spin"></span> Загружаю…</div>`; ozLoad().then(()=>{ if(curTab==="ozon") renderOzon(); }); return; }
  ozDraw();
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
  <div class="ozbar">
    <div class="pfchips ozst">${ozChips([["all","Все магазины"]].concat(S.map(s=>[s.id,s.n])), OZU.st, "ozst")}</div>
    <div class="pfchips ozper">${ozChips(OZ_PER, OZU.per, "ozper")}</div>
    ${OZU.per==="c"?`<div class="ozdates"><label>с <input type="date" id="oz-a" value="${esc(ozRange()[0])}"></label><label>по <input type="date" id="oz-b" value="${esc(ozRange()[1])}"></label></div>`:""}
    <div class="pfchips ozsch">${ozChips(OZ_SCH, OZU.sch, "ozsch")}</div>
  </div>
  <div class="ozst-line" id="oz-st">${st}</div>${covTxt?`<div class="ozcovs">${covTxt}</div>`:""}
  ${!any?ozHello(hasKey):`
  <div class="oztiles">
    ${ozTile("sales","", "Продажи", ozR(C.sales), C.q+" шт · "+ozPerTxt())}
    ${ozTile("held","neg", "Удержал Озон", ozR(C.held), ozPct(-C.held, C.sales)+" от продаж · комиссия, логистика, реклама")}
    ${ozTile("tot","ok", "Пришло на счёт", ozR(C.tot), "столько Озон перечислит вам")}
    ${ozTile("tax","neg", "Налог "+(+C.rate*100).toLocaleString("ru-RU")+"%", ozR(-C.tax), "АУСН с того, что пришло")}
    ${ozTile("cost", C.miss.length?"warn":"neg", "Закупка товара", ozR(-C.cost), C.miss.length?"нет себестоимости у "+C.miss.length+" "+plural(C.miss.length,["товара","товаров","товаров"]):"количество × себестоимость")}
    ${ozTile("prof", C.prof<0?"bad":"good", "Чистая прибыль", ozR(C.prof), (C.sales?"маржа "+mpct+"% от продаж":"")+(C.miss.length?" · завышена: не у всех товаров есть закупка":""))}
  </div>
  <div class="ozformula">Пришло на счёт <b>${fm(C.tot)}</b> − налог <b>${fm(C.tax)}</b> − закупка <b>${fm(C.cost)}</b> = <b class="${C.prof<0?"neg":"pos"}">${fm(C.prof)} ₽</b>${OZU.sch!=="all"?`<small>Выбрана одна схема: общие расходы магазина (хранение, реклама и т. п.) не учтены — они не относятся к схеме.</small>`:""}</div>
  ${C.miss.length?`<div class="ozmiss" data-ozk="miss" role="button" tabindex="0"><b>Впишите себестоимость ${C.miss.length} ${plural(C.miss.length,["товара","товаров","товаров"])}</b><span>${C.miss.slice(0,4).map(p=>esc(p.name)).join(", ")}${C.miss.length>4?"…":""}</span><i aria-hidden="true">›</i></div>`:""}
  <section class="card ozprods"><div class="ozph"><h3>Товары <small>${L.length}</small></h3>
    <div class="ozpt"><input type="search" id="oz-q" placeholder="Найти товар или артикул" value="${esc(OZU.q)}" autocomplete="off"><select id="oz-sort" data-native aria-label="Порядок">${OZ_SORT.map(([v,t])=>`<option value="${v}"${OZU.sort===v?" selected":""}>${t}</option>`).join("")}</select>
    <label class="ozal" title="Хранение, реклама, кросс-докинг и другие расходы без товара делятся по товарам пропорционально продажам"><input type="checkbox" id="oz-al"${OZU.al?" checked":""}> Разложить общие расходы (${fm(C.un)})</label></div></div>
    ${ozTable(L, C)}
  </section>
  <section class="card ozexp"><div class="ozph"><h3>Куда ушли деньги <small>удержания Озона за период</small></h3></div>${ozExp(C)}</section>`}`;
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
  ${L.map(p=>`<div class="ozr${p.P<0?" loss":""}" role="row" data-ozp="${esc(p.art)}" tabindex="0"><span class="ozn"><b>${esc(p.name)}</b><small>${esc(p.art.startsWith("sku:")?"":p.art)}${ozSchB(p)}${OZU.st==="all"&&ozStores().length>1?" · "+Object.keys(p.st).map(s=>esc(ozStName(s))).join(", "):""}</small></span>
    <span class="n" data-l="Продано"><b>${p.q} шт</b></span><span class="n" data-l="Цена">${u(p.sales,p.q)}</span><span class="n neg" data-l="Удержал Озон, шт">${u(p.net-p.sales,p.q)}</span><span class="n" data-l="На руки, шт"><b>${u(p.net,p.q)}</b></span><span class="n neg" data-l="Налог, шт">${u(-p.tax,p.q)}</span>
    <span class="n ozci" data-l="Закупка, шт"><input type="text" inputmode="decimal" data-money data-ozc="${esc(p.art)}" value="${p.c==null?"":esc(String(p.c))}" placeholder="${p.q?"впишите":"—"}" aria-label="Себестоимость 1 шт: ${esc(p.name)}" class="${p.miss?"miss":""}"></span>
    <span class="n ${p.P<0?"neg":"pos"}" data-l="Прибыль, шт">${p.miss?"?":u(p.P,p.q)}</span><span class="n ${p.P<0?"neg":"pos"}" data-l="Прибыль"><b>${p.miss?"?":fm(p.P)}</b>${OZU.al&&p.share?`<small>общие ${fm(p.share)}</small>`:""}</span></div>`).join("")}</div>`; }
function ozExp(C){ const L=Object.values(C.T).filter(t=>t.grp!=="Продажи"&&Math.abs(t.s)>=0.5).sort((a,b)=>a.s-b.s), max=Math.max(1,...L.map(t=>Math.abs(t.s)));
  if(!L.length) return `<div class="pvempty sm"><b>Удержаний нет</b></div>`;
  const G={}; L.forEach(t=>(G[t.grp]=G[t.grp]||[]).push(t));
  return Object.entries(G).sort((a,b)=>a[1].reduce((s,t)=>s+t.s,0)-b[1].reduce((s,t)=>s+t.s,0)).map(([g,ts])=>`<div class="ozg"><div class="ozgh"><b>${esc(g)}</b><span>${fm(ts.reduce((s,t)=>s+t.s,0))}</span></div>
    ${ts.map(t=>`<div class="ozx" data-ozt="${esc(t.type)}" role="button" tabindex="0"><span>${esc(t.type)}${t.un&&Math.abs(t.un)>=0.5&&Math.abs(t.un-t.s)<0.5?` <em class="ozsb">общий</em>`:""}</span><i style="--w:${Math.round(Math.abs(t.s)/max*100)}%"></i><b class="${t.s<0?"neg":"pos"}">${fm(t.s)}</b><i class="ozgo" aria-hidden="true">›</i></div>`).join("")}</div>`).join(""); }
/* ---- окна подробностей («провалиться и вернуться») ---- */
const ozHead=(kick, h, sub)=>`<div class="dc-head"><div><div class="dc-kicker">${kick}</div><h3>${h}</h3>${sub?`<div class="dc-sub">${sub}</div>`:""}</div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>`;
const ozPr=(p, val, sub)=>`<div class="ozd-r" data-ozp="${esc(p.art)}" role="button" tabindex="0"><span><b>${esc(p.name)}</b><small>${sub}</small></span><b class="${val<0?"neg":""}">${fm(val)}</b><i aria-hidden="true">›</i></div>`;
function ozDetail(k){ const C=ozCalc(), kick="Озон · "+esc(ozPerTxt())+(OZU.st!=="all"?" · "+esc(ozStName(OZU.st)):""); let h="", sub="", body="";
  if(k==="sales"){ h="Продажи — "+ozR(C.sales); sub="Сумма продаж по вашей цене (что заплатил покупатель + баллы и скидки Озона)"; body=C.L.slice().sort((a,b)=>b.sales-a.sales).map(p=>ozPr(p, p.sales, p.q+" шт · по "+(p.q?fm(p.sales/p.q):"—"))).join(""); }
  else if(k==="held"){ h="Удержал Озон — "+ozR(C.held); sub="Всё, что Озон вычел из продаж. Нажмите на строку — по каким товарам."; body=ozExp(C); }
  else if(k==="tot"){ h="Пришло на счёт — "+ozR(C.tot); sub="Начисления Озона за период: продажи минус все удержания";
    const S=Object.entries(C.byS), D=Object.entries(C.byD).sort((a,b)=>b[0].localeCompare(a[0])), mx=Math.max(1,...D.map(x=>Math.abs(x[1])));
    body=(S.length>1?`<div class="ozd-h">По магазинам</div>`+S.map(([s,v])=>`<div class="ozd-r" data-ozgo="st:${esc(s)}" role="button" tabindex="0"><span><b>${esc(ozStName(s))}</b><small>показать только этот магазин</small></span><b>${fm(v)}</b><i aria-hidden="true">›</i></div>`).join(""):"")
      +`<div class="ozd-h">По дням</div>`+D.map(([d,v])=>`<div class="ozd-r ozday" data-ozgo="d:${d}" role="button" tabindex="0"><span><b>${fd(d)}</b><i style="--w:${Math.round(Math.abs(v)/mx*100)}%"></i></span><b class="${v<0?"neg":""}">${fm(v)}</b><i aria-hidden="true">›</i></div>`).join(""); }
  else if(k==="tax"){ h="Налог — "+ozR(C.tax); sub="АУСН считается с того, что Озон перечислил на счёт (не с цены продажи)";
    body=`<label class="ozd-tax">Ставка налога, % <input type="text" inputmode="decimal" id="oz-tax" value="${esc(String(ozTax()))}"></label><p class="muted">Сохраняется для вас на всех устройствах. ${fm(C.tot)} × ${(+C.rate*100).toLocaleString("ru-RU")}% = ${fm(C.tax)} ₽</p>`
      +Object.entries(C.byS).map(([s,v])=>`<div class="ozd-r static"><span><b>${esc(ozStName(s))}</b><small>пришло ${fm(v)}</small></span><b>${fm(v*C.rate)}</b></div>`).join(""); }
  else if(k==="cost"||k==="miss"){ const L=C.L.filter(p=>p.q>0&&(k==="cost"||p.miss)).sort((a,b)=>(b.miss-a.miss)||b.cost-a.cost); h=k==="miss"?"Нет себестоимости":"Закупка — "+ozR(C.cost); sub="Впишите, сколько вам стоит 1 шт (закупка + фасовка + упаковка) — сайт запомнит";
    body=L.map(p=>`<div class="ozd-r ozd-c"><span data-ozp="${esc(p.art)}" role="button" tabindex="0"><b>${esc(p.name)}</b><small>${p.q} шт${p.c!=null?" × "+fm(p.c)+" = "+fm(p.cost):""} · на руки ${p.q?fm(p.net/p.q):"—"} за шт</small></span><input type="text" inputmode="decimal" data-money data-ozc="${esc(p.art)}" value="${p.c==null?"":esc(String(p.c))}" placeholder="₽ за 1 шт" class="${p.miss?"miss":""}"></div>`).join("")||`<div class="pvempty sm"><b>У всех товаров себестоимость вписана</b></div>`; }
  else if(k==="prof"){ h="Чистая прибыль — "+ozR(C.prof); sub="По товарам: на руки − налог − закупка"+(OZU.al?" − доля общих расходов":"");
    const L=C.L.slice().sort((a,b)=>b.P-a.P);
    body=L.map(p=>ozPr(p, p.P, p.miss?"нет себестоимости — прибыль завышена":(p.q+" шт · "+(p.q?fm(p.P/p.q):"—")+" за шт"))).join("")
      +(OZU.al||!C.un?"":`<div class="ozd-r" data-ozk2="held" role="button" tabindex="0"><span><b>Общие расходы магазина</b><small>хранение, реклама, кросс-докинг… — без товара, после налога</small></span><b class="neg">${fm(C.un*(1-C.rate))}</b><i aria-hidden="true">›</i></div>`); }
  CARD_RE=()=>ozDetail(k); openCard(ozHead(kick, h, sub)+`<div class="ozd">${body}</div>`, true, ()=>{}); ozDlg(); }
function ozProd(art){ const C=ozCalc(), p=C.L.find(x=>x.art===art); if(!p){ toast("info","Товара нет в этом периоде"); return; }
  const u=v=>p.q?fm(v/p.q):"—", T=Object.entries(p.types).sort((a,b)=>b[1]-a[1]);
  const body=`<div class="oztiles sm">${[["Продано",p.q+" шт",""],["Цена за шт",u(p.sales),""],["На руки за шт",u(p.net),"после всех удержаний Озона"],["Прибыль за шт",p.miss?"?":u(p.P),p.miss?"впишите себестоимость":"после налога и закупки"]].map(x=>`<div class="oztile static"><small>${x[0]}</small><b>${x[1]}</b>${x[2]?`<span>${x[2]}</span>`:""}</div>`).join("")}</div>
    <label class="ozd-tax">Себестоимость 1 шт, ₽ <input type="text" inputmode="decimal" data-money data-ozc="${esc(art)}" value="${p.c==null?"":esc(String(p.c))}" placeholder="впишите"></label>
    <div class="ozd-h">Из чего сложилось</div>${T.map(([t,v])=>`<div class="ozd-r static"><span><b>${esc(t)}</b><small>${u(v)} за шт</small></span><b class="${v<0?"neg":""}">${fm(v)}</b></div>`).join("")}
    <div class="ozd-r static tot"><span><b>Пришло на руки</b></span><b>${fm(p.net)}</b></div>
    <div class="ozd-r static"><span><b>Налог ${(+C.rate*100).toLocaleString("ru-RU")}%</b></span><b class="neg">${fm(-p.tax)}</b></div>
    <div class="ozd-r static"><span><b>Закупка</b><small>${p.c==null?"себестоимость не вписана":p.q+" × "+fm(p.c)}</small></span><b class="neg">${fm(-p.cost)}</b></div>
    ${OZU.al&&p.share?`<div class="ozd-r static"><span><b>Доля общих расходов</b><small>пропорционально продажам, после налога</small></span><b class="neg">${fm(p.share*(1-C.rate))}</b></div>`:""}
    <div class="ozd-r static tot"><span><b>Прибыль</b></span><b class="${p.P<0?"neg":"pos"}">${p.miss?"?":fm(p.P)}</b></div>`;
  CARD_RE=()=>ozProd(art); openCard(ozHead("Озон · товар · "+esc(ozPerTxt()), esc(p.name), esc(p.art.startsWith("sku:")?"":"Артикул "+p.art)+" "+ozSchB(p))+`<div class="ozd">${body}</div>`, true, ()=>{}); ozDlg(); }
function ozType(type){ const C=ozCalc(), t=C.T[type]; if(!t){ toast("info","За этот период таких начислений нет"); return; }
  const L=Object.entries(t.arts).map(([a,v])=>({p:C.L.find(x=>x.art===a)||{art:a, name:(OZ.d.names[a]||a), q:0}, v})).sort((a,b)=>a.v-b.v);
  const body=(Math.abs(t.un)>=0.5?`<div class="ozd-r static"><span><b>Без товара — на весь магазин</b><small>${t.grp==="Услуги FBO"?"хранение и операции на складах Озона":"начислено магазину целиком"}</small></span><b class="${t.un<0?"neg":""}">${fm(t.un)}</b></div>`:"")+L.map(x=>ozPr(x.p, x.v, x.p.q?x.p.q+" шт · "+fm(x.v/x.p.q)+" за шт":"")).join("");
  CARD_RE=()=>ozType(type); openCard(ozHead("Озон · "+esc(t.grp)+" · "+esc(ozPerTxt()), esc(type)+" — "+fm(t.s)+" ₽", "По каким товарам")+`<div class="ozd">${body}</div>`, true, ()=>{}); ozDlg(); }
function ozDlg(){ const d=$("#fd-dcard"); if(!d||d._oz) return; d._oz=1;
  d.addEventListener("click", e=>{ const p=e.target.closest("[data-ozp]"); if(p && !e.target.closest("input")){ ozProd(p.dataset.ozp); return; }
    const t=e.target.closest("[data-ozt]"); if(t){ ozType(t.dataset.ozt); return; }
    const k=e.target.closest("[data-ozk2]"); if(k){ ozDetail(k.dataset.ozk2); return; }
    const g=e.target.closest("[data-ozgo]"); if(g){ const v=g.dataset.ozgo; navReset(); try{ d.close(); }catch(x){} if(v.startsWith("st:")) OZU.st=v.slice(3); else { OZU.per="c"; OZU.a=OZU.b=v.slice(2); } ozUiSave(); ozDraw(); return; } });
  d.addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.matches("[role=button]")){ e.preventDefault(); e.target.click(); } });
  const tx=d.querySelector("#oz-tax"); if(tx) tx.addEventListener("change", ()=>{ const v=String(tx.value).replace(",",".").trim(), p=getPrefs(); if(v===""||!isFinite(+v)||+v<0||+v>50){ toast("err","Ставка — число от 0 до 50"); return; } p.ozTax=+v; setPrefs(p,true); ozDraw(); toast("ok","Ставка налога: "+(+v)+"%"); }); }
/* ---- подключение Seller API ---- */
function ozKeysOpen(){ const S=ozStores(), K=OZ.keys||[], ok=ozSrvOk();
  const body=!ok?`<div class="ozhello"><b>Нужно обновить скрипт таблицы</b><p class="muted">Сайт обращается к Озону через скрипт таблицы (Code.gs версии 53 и новее). Пока его нет, работает загрузка отчёта Excel.</p><button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`
    :`<p class="muted ozkh">Кабинет Озона → Настройки → Seller API → «Сгенерировать ключ», роль <b>Admin read only</b> (только чтение — сайт ничего не меняет в магазине). Скопируйте Client-Id и ключ. Ключ хранится в настройках скрипта таблицы, сайт видит только 4 последних знака.</p>`
    +S.map(s=>{ const k=K.find(x=>x.id===s.id); return `<div class="ozk" data-ozks="${esc(s.id)}"><div class="ozkh2"><input type="text" class="ozkn" value="${esc(s.n)}" aria-label="Название магазина" autocomplete="off"><span class="${k?"ok":"muted"}">${k?"подключён · Client-Id "+esc(k.cid)+" · ключ …"+esc(k.tail):"не подключён"}</span></div>
      <div class="ozkf"><input type="text" class="ozkc" inputmode="numeric" placeholder="Client-Id" value="${k?esc(k.cid):""}" autocomplete="off"><input type="text" class="ozkk ozsec" placeholder="${k?"новый Api-Key (если меняете)":"Api-Key"}" autocomplete="off" spellcheck="false"><button type="button" class="btn sm pri" data-ozkey="save">${k?"Заменить":"Подключить"}</button>${k?`<button type="button" class="btn sm ghost" data-ozkey="del">Отключить</button>`:""}</div>
      <div class="ozkd"><button type="button" class="btn sm ghost" data-ozkey="wipe">Удалить загруженные данные магазина с этого устройства</button></div></div>`; }).join("")
    +`<button type="button" class="btn sm ghost" data-ozkey="add">+ Ещё магазин</button>${OZ.raw?`<p class="muted ozkh">Если суммы не сходятся с кабинетом — <button type="button" class="btn sm ghost" data-ozkey="raw">скачайте ответ Озона за ${fd(OZ.raw.date)}</button> и пришлите его Claude.</p>`:""}`;
  CARD_RE=null; openCard(ozHead("Озон", "Подключение магазинов", "Начисления будут приходить сами — каждый раз, когда вы открываете вкладку"), true, ()=>{});
  const d=$("#fd-dcard"); if(!d) return; d.insertAdjacentHTML("beforeend", `<div class="ozd ozkeys">${body}</div>`);
  const how=d.querySelector("#srvOldHow"); if(how) how.onclick=()=>{ try{ d.close(); }catch(e){} const b=$("#srvOld button, #srvOld [data-how]"); if(b) b.click(); else toast("info","Как обновить скрипт","Откройте в GitHub файл dev/Code.template.gs → «Copy raw file» → вставьте в Apps Script вместо Code.gs → «Развернуть» → «Новая версия»."); };
  d.addEventListener("change", e=>{ if(!e.target.matches(".ozkn")) return; const id=e.target.closest("[data-ozks]").dataset.ozks, v=e.target.value.trim(); if(!v) return; const p=getPrefs(); p.ozSt=ozStores().map(s=>s.id===id?{id, n:v}:s); setPrefs(p,true); ozDraw(); });
  d.addEventListener("click", async e=>{ const b=e.target.closest("[data-ozkey]"); if(!b) return; const a=b.dataset.ozkey, box=b.closest("[data-ozks]"), id=box&&box.dataset.ozks;
    if(a==="add"){ const p=getPrefs(), L=ozStores().slice(); L.push({id:"s"+Date.now().toString(36), n:"Магазин "+(L.length+1)}); p.ozSt=L; setPrefs(p,true); ozKeysOpen(); ozDraw(); return; }
    if(a==="raw"){ const bl=new Blob([JSON.stringify(OZ.raw,null,1)],{type:"application/json"}), u=URL.createObjectURL(bl), x=document.createElement("a"); x.href=u; x.download="ozon-"+OZ.raw.store+"-"+OZ.raw.date+".json"; document.body.appendChild(x); x.click(); x.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); return; }
    if(a==="wipe"){ if(!armed(b,"Точно удалить? Нажмите ещё раз")) return; delete OZ.d.days[id]; ozSave(); toast("ok","Данные «"+ozStName(id)+"» удалены с этого устройства"); ozDraw(); return; }
    if(a==="del"){ if(!armed(b,"Точно отключить?")) return; try{ const j=await api({action:"ozon", op:"del", id}); if(!j||j.ok===false) throw new Error(j&&j.error||"нет ответа"); OZ.keys=j.keys||[]; logEv("Данные","Озон: отключён ключ «"+ozStName(id)+"»"); ozKeysOpen(); ozDraw(); }catch(x){ toast("err","Не получилось", x.message); } return; }
    if(a==="save"){ const c=box.querySelector(".ozkc").value.trim(), k=box.querySelector(".ozkk").value.trim(); if(!c||!k){ toast("err","Впишите Client-Id и Api-Key"); return; }
      b.disabled=true; b.textContent="Проверяю…";
      try{ const j=await api({action:"ozon", op:"key", id, name:ozStName(id), clientId:c, apiKey:k}); if(!j||j.ok===false) throw new Error(j&&j.error||"нет ответа");
        OZ.keys=j.keys||[]; logEv("Данные","Озон: подключён ключ «"+ozStName(id)+"»"); toast("ok","Озон подключён", ozStName(id)+" — загружаю начисления…"); try{ d.close(); }catch(x){} delete OZ.d.types[id]; OZ.at=0; ozDraw(); ozSync(false); }
      catch(x){ b.disabled=false; b.textContent="Подключить"; toast("err","Не получилось подключить", x.message); } } }); }
/* ---- события вкладки ---- */
(function(){ const box=document.getElementById("oz"); if(!box) return;
  box.addEventListener("click", e=>{ const t=e.target;
    const s=t.closest("[data-ozst]"); if(s){ OZU.st=s.dataset.ozst; ozUiSave(); ozDraw(); ozSync(false); return; }
    const pe=t.closest("[data-ozper]"); if(pe){ OZU.per=pe.dataset.ozper; if(OZU.per==="c"&&!OZU.a){ const r=ozRange(); OZU.a=r[0]; OZU.b=r[1]; } ozUiSave(); ozDraw(); ozSync(false); return; }
    const sc=t.closest("[data-ozsch]"); if(sc){ OZU.sch=sc.dataset.ozsch; ozUiSave(); ozDraw(); return; }
    const k=t.closest("[data-ozk]"); if(k){ ozDetail(k.dataset.ozk); return; }
    const ty=t.closest("[data-ozt]"); if(ty){ ozType(ty.dataset.ozt); return; }
    const p=t.closest("[data-ozp]"); if(p && !t.closest("input")){ ozProd(p.dataset.ozp); return; }
    const a=t.closest("[data-oz]"); if(a){ if(a.dataset.oz==="sync") ozSync(true); if(a.dataset.oz==="keys") ozKeysOpen(); } });
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
window.__oz={prefs:()=>getPrefs(), OZ, OZU, calc:()=>ozCalc()};   /* для тестов (dev/test/ozon.py) */
