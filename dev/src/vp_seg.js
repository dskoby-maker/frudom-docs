/* ---------- «Цены других поставщиков» (вкладка «Поставщики», 14.11.2026; Code.gs ≥ 39 — действие vprices, лист «Цены поставщиков») ----------
   Загружаешь прайс (Excel, PDF, Word, фото…) → ИИ (aiRead kind:"price") переписывает товары и цены → проверка → сохранение.
   Строка = позиция прайса {id, listId, vendor, date, name, unit, price, productId}; товара нет на сайте — создаётся во «Товарах».
   Только для сравнения: на закупку, прибыль и «Закупочные цены» не влияет. admin и manager. */
const VP={rows:null, srv:null, busy:"", err:"", q:"", open:{}, iq:{}, up:null, f:"all"};
const vpRows = () => VP.rows || D.vprices || [];
const vpHue = s => { let h=0; for(const c of String(s||"")) h=(h*37+c.charCodeAt(0))%360; return h; };
const vpN = x => { const n=parseFloat(String(x==null?"":x).replace(/\s/g,"").replace(",",".")); return isFinite(n)?n:null; };
const vpMoney = x => { const n=vpN(x); return n==null ? "—" : fm(n).replace(/,00$/,"")+" ₽"; };
const vpLists = () => { const M={}; vpRows().forEach(r=>{ const m=M[r.listId]||(M[r.listId]={id:r.listId, vendor:r.vendor, date:r.date, by:r.by, at:r.at, rows:[]}); m.rows.push(r); });
  return Object.values(M).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.at||"").localeCompare(String(a.at||""))); };
const vpVendors = () => [...new Set(vpRows().map(r=>r.vendor).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru"));
/* последняя цена каждого поставщика по товару сайта (для «Товаров» и помощника) */
function vpOf(pid){ const M={}; vpRows().forEach(r=>{ if(r.productId!==pid || vpN(r.price)==null) return; const k=r.vendor; if(!M[k] || String(r.date)>String(M[k].date)) M[k]=r; });
  return Object.values(M).sort((a,b)=>vpN(a.price)-vpN(b.price)); }
function vpTag(pid){ const L=vpOf(pid); if(!L.length) return ""; const b=L[0];
  return `<span class="nmvp" title="${esc(L.map(r=>r.vendor+": "+vpMoney(r.price)+" от "+fd(r.date)).join("\n"))}">${esc(b.vendor)} ${vpMoney(b.price)}${L.length>1?" · ещё "+(L.length-1):""}</span>`; }
function vpEdHtml(pid){ const L=vpOf(pid); if(!L.length) return "";
  return `<div class="vped"><b>Цены других поставщиков</b><small>для сравнения, не ваша закупка</small>${L.map((r,i)=>`<span class="vpedr${i?"":" best"}"><i style="--h:${vpHue(r.vendor)}"></i>${esc(r.vendor)}<em>${vpMoney(r.price)}/${esc(r.unit||"")}</em><small>от ${fd(r.date)}</small></span>`).join("")}</div>`; }

async function vpLoad(quiet){ if(VP.busy==="load") return; VP.busy="load"; if(!quiet) vpDraw();
  try{ const j=await api({action:"vprices", op:"list"}); VP.rows=D.vprices=j.rows||[]; VP.srv=true; VP.err=""; }
  catch(e){ if(/unknown action/.test(e.message||"")) VP.srv=false; else VP.err=e.message||String(e); VP.rows=D.vprices||[]; }
  VP.busy=""; vpDraw(); }
function vpRender(){ const box=$("#vp-card"); if(!box) return; if(isStaff()){ box.hidden=true; return; } box.hidden=false; vpCss();
  if(VP.rows==null && VP.busy!=="load") vpLoad(); else vpDraw(); }

/* ---------- рисование ---------- */
function vpDraw(){ const box=$("#vp-card"); if(!box||box.hidden) return; const L=vpLists(), q=VP.q.trim();
  const head=`<div class="vph"><div><h2>Цены других поставщиков</h2><p class="muted">Загрузите прайс — ИИ перепишет товары и цены, а новые товары появятся во «Товарах». Это цены для сравнения, а не ваша закупка.</p></div>
    <div class="vpbtns"><button type="button" class="btn ghost vptpl" data-vp="tpl">${VP_IC.dl}<span>Скачать шаблон</span></button>
    <label class="btn vpadd${VP.srv===false?" dis":""}">${VP_IC.up}<span>Загрузить прайс</span><input type="file" id="vp-file" hidden${VP.srv===false?" disabled":""}></label></div></div>`;
  let body="";
  if(VP.srv===false) body=`<div class="vpempty">${VP_IC.box}<b>Нужно обновить скрипт таблицы</b><span>Чтобы хранить прайсы поставщиков, вставьте новый Code.gs (версия 39) — инструкция в «Данные».</span></div>`;
  else if(VP.up) body=vpUpHtml();
  else if(VP.busy==="load" && VP.rows==null) body=`<div class="vpempty"><span class="vpspin"></span><span>Загружаю прайсы…</span></div>`;
  else { body=(VP.err?`<p class="vperr">${esc(VP.err)} <button type="button" class="btn ghost sm" data-vp="reload">Повторить</button></p>`:"")+
      (L.length?`<div class="vpsearch">${VP_IC.find}<input id="vp-q" type="search" placeholder="Найти товар во всех прайсах…" value="${esc(VP.q)}" autocomplete="off">${q?`<button type="button" class="vpx" data-vp="clear" aria-label="Очистить">×</button>`:""}</div>`:"")+
      (q ? vpFindHtml(q) : L.length ? `<div class="vplt"><b>Загруженные прайсы</b><span>${L.length}</span></div><div class="vplists">${L.map(vpListHtml).join("")}</div>` :
        `<label class="vpempty vpdrop">${VP_IC.box}<b>Пока нет ни одного прайса</b><span>Нажмите «Загрузить прайс» или перетащите файл сюда — Excel, PDF, Word или фото.</span></label>`); }
  const foc=document.activeElement&&document.activeElement.id, pos=foc==="vp-q"?document.activeElement.selectionStart:null;
  box.innerHTML=head+`<div class="vpbody">${body}</div>`;
  if(foc==="vp-q"){ const i=$("#vp-q"); if(i){ i.focus(); try{ i.setSelectionRange(pos,pos); }catch(e){} } } }
function vpListHtml(l){ const open=!!VP.open[l.id], iq=(VP.iq[l.id]||"").trim(), R=l.rows.filter(r=>!iq||acHit(iq, r.name+" "+(r.productName||""))), nn=l.rows.length;
  return `<div class="vpl${open?" open":""}" data-lid="${esc(l.id)}" style="--h:${vpHue(l.vendor)}">
    <div class="vplhw"><button type="button" class="vplh" data-vp="tog" aria-expanded="${open}"><i class="vpav">${esc(String(l.vendor||"?").trim()[0]||"?")}</i>
      <span class="vpln"><b>${esc(l.vendor||"Без названия")}</b><small>прайс от ${fd(l.date)} · ${nn} ${plural(nn,["позиция","позиции","позиций"])}${l.by?" · загрузил"+(/а$/.test(l.by)?"а":"")+" "+esc(l.by):""}</small></span>
      <span class="vpchev">${VP_IC.chev}</span></button><button type="button" class="btn sm vpopen" data-vp="win" title="Открыть весь прайс в отдельном окне">Открыть прайс</button></div>
    <div class="vplb"><div class="vplbi">${open?`<div class="vpsearch sm">${VP_IC.find}<input data-vpiq="${esc(l.id)}" type="search" placeholder="Поиск в этом прайсе" value="${esc(VP.iq[l.id]||"")}" autocomplete="off"></div>
      <div class="vprows">${R.slice(0,300).map(r=>vpRowHtml(r)).join("")||`<p class="muted">Ничего не нашлось</p>`}</div>${R.length>300?`<p class="muted">Показаны первые 300 — уточните поиск</p>`:""}
      <div class="vplf"><span class="muted">Цены для сравнения — в прибыль и закупку не идут</span><button type="button" class="btn ghost danger sm" data-vp="del">Удалить прайс</button></div>`:""}</div></div></div>`; }
function vpRowHtml(r, vendor){ const p=r.productId&&prod(r.productId);
  return `<div class="vpr"><span class="vprn"><b>${vendor?`<i class="vpdot" style="--h:${vpHue(r.vendor)}"></i>`:""}${esc(r.name)}</b>${r.note&&!vendor?`<small>${esc(r.note)}</small>`:""}${p&&norm(p.name)!==norm(r.name)?`<small>на сайте: ${esc(p.name)}</small>`:""}${vendor?`<small>${esc(r.vendor)} · от ${fd(r.date)}</small>`:""}</span>
    <span class="vprp"><b>${vpMoney(r.price)}</b><small>/${esc(r.unit||"")}</small></span></div>`; }
function vpFindHtml(q){ const R=vpRows().filter(r=>acHit(q, r.name+" "+(r.productName||"")+" "+r.vendor)).sort((a,b)=>(vpN(a.price)??1e12)-(vpN(b.price)??1e12));
  if(!R.length) return `<div class="vpempty sm"><span>По «${esc(q)}» ничего нет ни в одном прайсе</span></div>`;
  const best=vpN(R[0].price);
  return `<p class="vpfh">${R.length} ${plural(R.length,["позиция","позиции","позиций"])} у ${new Set(R.map(r=>r.vendor)).size} ${plural(new Set(R.map(r=>r.vendor)).size,["поставщика","поставщиков","поставщиков"])} · сначала дешевле</p>
    <div class="vprows">${R.slice(0,200).map(r=>vpRowHtml(r,1).replace('<div class="vpr">', vpN(r.price)===best?'<div class="vpr best">':'<div class="vpr">')).join("")}</div>`; }

/* ---------- загрузка прайса ---------- */
async function vpFile(f){ if(!f) return; if(VP.srv===false){ toast("warn","Нужно обновить Code.gs","Прайсы хранятся на новом листе таблицы."); return; }
  VP.up={file:f.name, busy:"Загружаю прайс", items:[], t0:Date.now(), steps:["Открываю файл","Читаю товары и цены","Сверяю с товарами сайта","Готовлю список для проверки"], st:0, sub:"", pct:null}; vpDraw();
  try{ await vpIdle(); vpStep(0, f.size>1e6?(f.size/1048576).toFixed(1).replace(".",",")+" МБ":"", 5);
    const T=await vpSheet(f);   /* шаблон или любая таблица «Наименование … Цена» — читается сам, без ИИ */
    if(T && T.items.length>=2){ vpStep(1, "без ИИ · строк: "+T.items.length, 30); await vpIdle();
      await vpUpSet(f, T.items, T.vendor, T.date, {how:T.tpl?"шаблон":"таблица", skip:T.skip, vat:T.vat}); logEv("Справочники","Прайс «"+f.name+"» прочитан без ИИ ("+(T.tpl?"шаблон":"таблица")+"): "+VP.up.items.length+" поз."); vpDraw(); return; }
    vpStep(1, "ИИ читает прайс", null); await vpIdle();
    const d=await aiInput(f, true); let chunks=[];
    if(d.text){ const lines=d.text.split(/\r?\n/), head=lines.slice(0,3).join("\n"); let cur="";
      lines.forEach(l=>{ if(cur.length+l.length>30000){ chunks.push(cur); cur=head+"\n"; } cur+=l+"\n"; }); if(cur.trim()) chunks.push(cur); chunks=chunks.slice(0,8); }
    const parts=[]; let vendor="", date="";
    for(let i=0;i<(chunks.length||1);i++){ const n=chunks.length||1; vpStep(1, "ИИ читает прайс"+(n>1?" — часть "+(i+1)+" из "+n:"")+" · обычно 10–40 секунд", n>1?10+Math.round(i/n*50):null);
      const body=chunks.length ? {action:"aiRead", kind:"price", text:chunks[i], src:"file", fname:f.name} : {action:"aiRead", kind:"price", mime:d.mime, data:d.data, fname:f.name};
      let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:150000, body:JSON.stringify(Object.assign({key:pass(), user:curUser()}, body))}); }
      catch(e){ const m=e.message||""; throw new Error(m==="nokey"||m==="badkey"?"не настроен ключ ИИ — «Данные» → «ИИ»":m==="unknown action"?"скрипт таблицы старый — обновите Code.gs":m); }
      let x; try{ x=JSON.parse(String(j.text).replace(/^```(json)?|```$/g,"").trim()); }catch(e){ throw new Error("ИИ ответил не по форме — попробуйте ещё раз"); }
      vendor=vendor||String(x.supplier||"").trim(); date=date||String(x.date||"").trim(); (x.items||[]).forEach(it=>parts.push(Array.isArray(it)?{name:it[0], unit:it[1], price:it[2]}:it)); }
    await vpUpSet(f, parts, vendor, date, {how:"ИИ"});
    logEv("Справочники","Прайс «"+f.name+"» прочитан ИИ: "+VP.up.items.length+" поз.");
  }catch(e){ VP.up={file:f.name, err:e.message||String(e), items:[]}; }
  vpDraw(); }
/* позиции → окно проверки (общая часть для шаблона, таблицы и ИИ) */
async function vpUpSet(f, parts, vendor, date, o){ o=o||{}; const seen={}, items=[]; let skip=o.skip||0, n=0; VPM=null;
  vpStep(2, parts.length+" "+plural(parts.length,["строка","строки","строк"]), 60); await vpIdle();
  for(const it of parts){ if(++n%40===0){ vpStep(2, n+" из "+parts.length, 60+Math.round(n/parts.length*35)); await vpIdle(); }
    const name=String(it.name||"").replace(/\s+/g," ").trim(), price=vpN(it.price); if(!name) continue; if(price==null||price<=0){ skip++; continue; }
    const unit=String(it.unit||"").toLowerCase().replace(/\.$/,"").trim()||"кг", k=norm(name)+"|"+unit; if(seen[k]) continue; seen[k]=1;
    const p=vpMatch(name); items.push({name, unit, price, cat:String(it.cat||"").trim(), pid:p?p.id:"", on:true}); }
  if(!items.length) throw new Error("в прайсе не нашлось товаров с ценами");
  vpStep(3, items.length+" "+plural(items.length,["позиция","позиции","позиций"]), 100); await vpIdle(); await new Promise(r=>setTimeout(r,250));
  VP.up={file:f.name, vendor:vpVendorGuess(vendor, f.name), date:vpDateIso(date)||todayISO(), items, f:"all", how:o.how||"", skip, vat:o.vat||""}; }
const VP_MON={"январ":1,"феврал":2,"март":3,"апрел":4,"ма":5,"июн":6,"июл":7,"август":8,"сентябр":9,"октябр":10,"ноябр":11,"декабр":12};
function vpDateIso(t){ t=String(t==null?"":t).trim(); let m=t.match(/(\d{4})-(\d\d)-(\d\d)/); if(m) return m[0];
  m=t.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/); if(m){ const y=m[3].length===2?"20"+m[3]:m[3]; return y+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"); }
  m=t.toLowerCase().match(/(\d{1,2})\s+([а-яё]+)\s+(\d{4})/); if(m){ const k=Object.keys(VP_MON).sort((a,b)=>b.length-a.length).find(k=>m[2].startsWith(k)); if(k) return m[3]+"-"+String(VP_MON[k]).padStart(2,"0")+"-"+m[1].padStart(2,"0"); }
  if(typeof t==="number"||/^\d{5}$/.test(t)){ const d=new Date(Math.round((+t-25569)*864e5)); if(!isNaN(d)) return d.toISOString().slice(0,10); }
  return ""; }
/* таблица прайса: строка заголовка «Наименование/Номенклатура … Цена … Ед.»; ниже товары; строка без цены и без единицы — раздел (категория);
   «Поставщик:» и «Дата прайса:» в шапке шаблона, иначе дата из «Прайс-лист на 9 ноября 2026 г.» и ООО «…» из шапки */
async function vpSheet(f){ const ext=aiExt(f); if(!/^(xlsx|xlsm|xls|ods|csv|tsv)$/.test(ext)) return null;
  const X=await loadXLSX(), wb=X.read(await f.arrayBuffer(),{type:"array"}); let best=null;
  for(const sn of wb.SheetNames){ const A=X.utils.sheet_to_json(wb.Sheets[sn],{header:1, raw:true, defval:""}), r=vpTable(A); if(r && (!best||r.items.length>best.items.length)) best=r; }
  return best; }
function vpTable(A){ const low=v=>String(v==null?"":v).toLowerCase().replace(/\s+/g," ").trim(); let h=-1, cn=-1, cp=-1, cu=-1, cc=-1, cnote=-1;
  for(let i=0;i<Math.min(A.length,40)&&h<0;i++){ const R=A[i]||[]; const n=R.findIndex(v=>/^(наименование|номенклатура|товар|продукт|название)/.test(low(v))), p=R.findIndex(v=>/цена|стоимость/.test(low(v)));
    if(n>=0&&p>=0){ h=i; cn=n; cp=p; cu=R.findIndex(v=>/^ед/.test(low(v))); cc=R.findIndex(v=>/категор|раздел|групп/.test(low(v))); cnote=R.findIndex(v=>/примеч/.test(low(v))); } }
  if(h<0) return null;
  let vendor="", date="", vat="", tpl=false; const head=A.slice(0,h);
  head.forEach(R=>{ const a=low(R[0]), b=R.slice(1).find(v=>String(v).trim()!=="");
    if(/^поставщик/.test(a)){ vendor=String(b||"").trim(); tpl=true; } else if(/^дата/.test(a)){ date=vpDateIso(b); tpl=true; } else if(/^цены?(\s|:|$)/.test(a)&&b!=null){ vat=String(b).trim(); }
    R.forEach(v=>{ const t=String(v||""); if(!date){ const d=/прайс|на\s+\d/i.test(t)?vpDateIso(t):""; if(d) date=d; } if(!vendor){ const m=t.match(/(ООО|ИП|АО|ЗАО|ОАО)\s*[«"]([^»"]+)[»"]/); if(m) vendor=m[2].trim(); } }); });
  if(!vat && /с\s*ндс/.test(low((A[h]||[])[cp]))) vat="с НДС";
  const items=[]; let cat="", skip=0;
  for(let i=h+1;i<A.length;i++){ const R=A[i]||[], name=String(R[cn]==null?"":R[cn]).replace(/\s+/g," ").trim(); if(!name) continue;
    const pr=R[cp], unit=cu>=0?String(R[cu]||"").trim():"", c=cc>=0?String(R[cc]||"").trim():"";
    const num=typeof pr==="number"?pr:vpN(pr);
    if(num==null){ if(String(pr||"").trim()==="" && !unit){ cat=name.replace(/[:：]\s*$/,""); continue; } skip++; continue; }
    items.push({name, unit:unit||"кг", price:num, cat:c||cat, note:cnote>=0?String(R[cnote]||"").trim():""}); }
  return {items, vendor, date, vat, skip, tpl}; }
/* «Скачать шаблон»: шапка (поставщик, дата, с НДС или без) + таблица «Наименование | Ед. | Цена, ₽ | Категория | Примечание» */
async function vpTpl(){ try{ const X=await loadXLSX();
    const aoa=[["Прайс поставщика — шаблон для сайта «Фруктовый Дом · документы»"],["Заполните поставщика, дату и строки товаров. Строка без цены — пропускается. Строка только с названием (без цены и ед.) — раздел, он станет категорией товаров ниже."],[],
      ["Поставщик",""],["Дата прайса",fd(todayISO())],["Цены","с НДС"],[],["Наименование","Ед.","Цена, ₽","Категория","Примечание"]];
    for(let i=0;i<30;i++) aoa.push(["","кг","","",""]);
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:58},{wch:7},{wch:12},{wch:24},{wch:24}];
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Прайс"); X.writeFile(wb,"Шаблон прайса поставщика.xlsx");
    toast("ok","Шаблон скачан","Заполните его и загрузите кнопкой «Загрузить прайс» — сайт прочитает без ИИ.");
  }catch(e){ toast("err","Не получилось сделать шаблон", e.message||String(e)); } }
function vpVendorGuess(v, fname){ const V=vpVendors(), t=(v||fname||"").toLowerCase();
  const hit=V.find(x=>t.includes(x.toLowerCase())); return hit || v || ""; }
/* указатель товаров сайта для сверки — строится один раз на весь прайс (раньше на каждую позицию заново: 485 × все товары — страница зависала) */
let VPM=null;
const vpClean = s => norm(s).replace(/[«»"]/g,"").replace(/\s+/g," ").trim();
function vpMIdx(){ if(VPM && VPM.n===D.products.length && VPM.p===D.products) return VPM; const ex=new Map(), al=new Map(), st=[];
  D.products.forEach(x=>{ const c=vpClean(x.name); if(!ex.has(c)) ex.set(c,x); });
  D.products.forEach(x=>{ (aliasesOf(x)||[]).forEach(a=>{ const c=vpClean(a); if(!al.has(c)) al.set(c,x); }); const U=stems(x.name); if(U.length>=2) st.push([x,U]); });
  return VPM={n:D.products.length, p:D.products, ex, al, st}; }
function vpMatch(name){ const M=vpMIdx(), n=vpClean(name);
  let p=M.ex.get(n) || M.al.get(n); if(p) return p;
  const T=stems(name); if(T.length<2) return null;
  const nums=t=>(norm(t).match(/\d+([.,]\d+)?/g)||[]).sort().join(" "), N=nums(name);   /* «280 г» и «3100 г» — разные товары */
  p=M.st.find(([x,U])=>U.length===T.length && U.every(w=>T.includes(w)) && nums(x.name)===N); return p?p[0]:null; }
/* дать браузеру перерисовать экран (крутилка и полоса не замирают) */
const vpIdle = () => new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
/* шаг загрузки: меняем только полосу и подписи, без перерисовки всего блока */
function vpStep(i, sub, pct){ const u=VP.up; if(!u||!u.busy) return; u.st=i; u.sub=sub||""; u.pct=pct; const el=document.querySelector("#vp-card .vpprog"); if(!el){ vpDraw(); return; }
  el.querySelectorAll(".vpst li").forEach((li,k)=>{ li.className=k<i?"ok":k===i?"cur":""; const sm=li.querySelector("small"); if(sm) sm.textContent=k===i?u.sub:""; });
  const bar=el.querySelector(".vpbar"); bar.classList.toggle("ind", pct==null); bar.firstElementChild.style.width=(pct==null?30:pct)+"%";
  const t=el.querySelector(".vpptl"); if(t) t.textContent=u.busy; }
function vpProgHtml(u){ const st=u.st||0, pct=u.pct;
  return `<div class="vpup vpprog" role="status" aria-live="polite"><div class="vppic"><svg viewBox="0 0 48 56" width="48" height="56" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M30 3H9a5 5 0 0 0-5 5v40a5 5 0 0 0 5 5h30a5 5 0 0 0 5-5V17z"/><path d="M30 3v14h14"/><path class="l1" d="M13 26h22"/><path class="l2" d="M13 33h22"/><path class="l3" d="M13 40h14"/></svg><i class="vpscan"></i></div>
    <b class="vpptl">${esc(u.busy)}</b><span class="vppf">«${esc(u.file)}» · <span class="vppt">${vpEl(u)}</span></span>
    <div class="vpbar${pct==null?" ind":""}"><i style="width:${pct==null?30:pct}%"></i></div>
    <ol class="vpst">${(u.steps||[]).map((t,k)=>`<li class="${k<st?"ok":k===st?"cur":""}"><span class="vpsd"></span><span>${esc(t)}<small>${k===st?esc(u.sub||""):""}</small></span></li>`).join("")}</ol></div>`; }
const vpEl = u => { const s=Math.max(0,Math.round((Date.now()-(u.t0||Date.now()))/1000)); return s<60?s+" с":Math.floor(s/60)+" мин "+String(s%60).padStart(2,"0")+" с"; };
setInterval(()=>{ const u=VP.up; if(!u||!u.busy) return; const el=document.querySelector("#vp-card .vppt"); if(el) el.textContent=vpEl(u); }, 1000);
function vpUpHtml(){ const u=VP.up;
  if(u.busy) return vpProgHtml(u);
  if(u.err) return `<div class="vpup"><div class="vpempty"><b>Не получилось прочитать «${esc(u.file)}»</b><span>${esc(u.err)}</span><span class="row"><label class="btn sm">Выбрать другой файл<input type="file" id="vp-file2" hidden></label><button type="button" class="btn ghost sm" data-vp="cancel">Закрыть</button></span></div></div>`;
  const I=u.items, nw=I.filter(i=>!i.pid).length, on=I.filter(i=>i.on), onNew=on.filter(i=>!i.pid).length;
  const F=I.map((it,i)=>[it,i]).filter(([it])=>u.f==="all"||(u.f==="new"?!it.pid:!!it.pid));
  return `<div class="vpup"><div class="vpuph"><b>Прайс прочитан · ${I.length} ${plural(I.length,["позиция","позиции","позиций"])}</b><small>«${esc(u.file)}» · ${u.how==="ИИ"?"прочитан ИИ — проверьте названия и цены":u.how==="шаблон"?"прочитан по шаблону, без ИИ":"таблица прочитана без ИИ"}${u.vat?" · цены "+esc(u.vat):""}${u.skip?` · без цены пропущено: ${u.skip}`:""}</small></div>
    <div class="vpugrid"><label><span>Поставщик</span><input id="vp-vendor" value="${esc(u.vendor)}" placeholder="Например, Роспродукт" list="vp-vlist"><datalist id="vp-vlist">${vpVendors().map(v=>`<option value="${esc(v)}">`).join("")}</datalist></label>
      <label><span>Дата прайса</span><input id="vp-date" type="date" value="${esc(u.date)}"></label></div>
    <div class="vpchips">${[["all","Все",I.length],["new","Новые товары",nw],["have","Уже есть на сайте",I.length-nw]].map(([k,t,n])=>`<button type="button" class="vpchip${u.f===k?" on":""}" data-vpf="${k}">${t} <b>${n}</b></button>`).join("")}
      <span style="flex:1"></span><button type="button" class="btn ghost sm" data-vp="allon">${on.length===I.length?"Снять все":"Отметить все"}</button></div>
    <div class="vprows up">${F.map(([it,i])=>`<label class="vpr vpu${it.on?"":" off"}"><input type="checkbox" data-vpi="${i}"${it.on?" checked":""}>
      <span class="vprn"><b>${esc(it.name)}</b>${it.cat?`<small class="cat">${esc(it.cat)}</small>`:""}${it.pid?`<small class="have">есть на сайте: ${esc((prod(it.pid)||{}).name||"")} <button type="button" class="vpun" data-vpun="${i}" title="Это другой товар — создать новый">×</button></small>`:`<small class="nw">новый товар — появится во «Товарах»</small>`}</span>
      <span class="vprp"><b>${vpMoney(it.price)}</b><small>/${esc(it.unit)}</small></span></label>`).join("")}</div>
    <div class="vpubar"><span>${on.length} ${plural(on.length,["позиция","позиции","позиций"])}${onNew?` · ${onNew} ${plural(onNew,["новый товар","новых товара","новых товаров"])}`:""}</span>
      <button type="button" class="btn ghost" data-vp="cancel">Отмена</button><button type="button" class="btn primary" data-vp="save"${on.length?"":" disabled"}>Сохранить прайс</button></div></div>`; }
const vpUnit = u => { u=String(u||"").toLowerCase(); return UNITS[u]?u:/^уп/.test(u)?"упак":/шт|штук/.test(u)?"шт":/^пар/.test(u)?"пар":/^л/.test(u)?"л":/^г(р|$)/.test(u)?"г":"кг"; };
async function vpSave(){ const u=VP.up, vendor=($("#vp-vendor").value||"").trim(), date=$("#vp-date").value||todayISO();
  if(!vendor){ toast("warn","Укажите поставщика","Например, «Роспродукт» — чтобы было понятно, чьи это цены."); $("#vp-vendor").focus(); return; }
  const on=u.items.filter(i=>i.on); if(!on.length) return;
  const old=vpLists().find(l=>l.vendor.toLowerCase()===vendor.toLowerCase()&&l.date===date), lid=uid();
  /* сначала цены уходят в таблицу, и только после её ответа новые товары появляются во «Товарах»:
     если связь оборвалась или приложение закрыли посреди сохранения — не остаётся товаров без цен (15.11.2026) */
  Object.assign(u,{busy:"Сохраняю прайс — не закрывайте страницу", t0:Date.now(), steps:["Записываю цены в таблицу","Добавляю новые товары во «Товары»","Готово"], st:0, sub:"", pct:3}); vpDraw(); await vpIdle();
  const newP=[], rows=on.map(it=>{ let pid=it.pid;
      if(!pid){ const p={id:uid()+uid().slice(0,4), name:it.name, code:"", unit:vpUnit(it.unit), country:"", price:""}; newP.push(p); pid=p.id; }
      return {id:uid()+uid().slice(0,4), listId:lid, vendor, date, name:it.name, unit:it.unit, price:String(it.price), productId:pid, note:[u.vat, it.cat].filter(Boolean).join(" · ")}; });
  const put=async part=>{ for(let k=0;;k++){ try{ return await api({action:"vprices", op:"put", rows:JSON.stringify(part)}); }catch(e){ if(k>=1||!online()) throw e; await new Promise(r=>setTimeout(r,1500)); } } };
  let made=0;
  try{ const N=Math.ceil(rows.length/300);
    for(let i=0,n=1;i<rows.length;i+=300,n++){ vpStep(0, N>1?"часть "+n+" из "+N:rows.length+" "+plural(rows.length,["позиция","позиции","позиций"]), 5+Math.round((n-1)/N*75)); await put(rows.slice(i,i+300)); }
    if(old) await api({action:"vprices", op:"del", listId:old.id}).catch(()=>{});
    vpStep(1, newP.length?newP.length+" "+plural(newP.length,["товар","товара","товаров"]):"новых нет", 85); await vpIdle();
    /* новые товары — часть сохранения прайса, а не отдельные шаги «Отменить: добавление товара …» (их отмена оставила бы цены без товаров) */
    const un=typeof UNDO!=="undefined"&&UNDO; if(un) un.paused++;
    try{ const have=new Set(D.products.map(x=>x.id)); newP.forEach(p=>{ if(have.has(p.id)) return; D.products.push(p); dirty("products",p.id); made++; }); }
    finally{ if(un){ un.paused--; try{ unResync(); }catch(e){} } }
    vpStep(2, "", 100); await vpIdle();
    on.forEach((it,i)=>{ it.pid=rows[i].productId; });
    if(made){ saveLocal(); flush().catch(()=>{}); }
    VP.rows=D.vprices=vpRows().filter(r=>!old||r.listId!==old.id).concat(rows.map(r=>Object.assign({by:curUser(), at:new Date().toISOString()}, r)));
    VP.up=null; VP.open={[lid]:true};
    toast("ok","Прайс сохранён", vendor+" от "+fd(date)+": "+rows.length+" "+plural(rows.length,["позиция","позиции","позиций"])+(made?", "+made+" "+plural(made,["новый товар","новых товара","новых товаров"])+" во «Товарах»":"")+(old?" (старый прайс за эту дату заменён)":"")+".");
  }catch(e){ u.busy=""; if(rows.length) api({action:"vprices", op:"del", listId:lid}).catch(()=>{});   /* часть могла записаться — убираем, чтобы не было половины прайса */
    toast("err","Прайс не сохранился", (e.message||String(e))+". Ничего не добавлено — нажмите «Сохранить прайс» ещё раз."); }
  vpDraw(); }

/* ---------- нажатия ---------- */
document.addEventListener("click", e=>{ const box=e.target.closest("#vp-card"); if(!box) return; const b=e.target.closest("[data-vp],[data-vpf],[data-vpun]"); if(!b) return;
  if(b.dataset.vpf){ VP.up.f=b.dataset.vpf; vpDraw(); return; }
  if(b.dataset.vpun){ e.preventDefault(); const it=VP.up.items[+b.dataset.vpun]; it.pid=""; vpDraw(); return; }
  const k=b.dataset.vp, l=b.closest(".vpl");
  if(k==="win"){ vpWin(l.dataset.lid); return; }
  if(k==="tog"){ const id=l.dataset.lid; VP.open[id]=!VP.open[id]; const was=VP.open[id];
    if(was){ vpDraw(); } else { l.classList.remove("open"); b.setAttribute("aria-expanded","false"); setTimeout(()=>{ if(!VP.open[id]) vpDraw(); }, 320); } return; }
  if(k==="del"){ if(!armed(b,"Точно удалить прайс?")) return; const id=l.dataset.lid; b.disabled=true;
    api({action:"vprices", op:"del", listId:id}).then(()=>{ VP.rows=D.vprices=vpRows().filter(r=>r.listId!==id); toast("ok","Прайс удалён","Товары во «Товарах» остались."); vpDraw(); }).catch(er=>{ b.disabled=false; toast("err","Не удалилось", er.message||String(er)); }); return; }
  if(k==="clear"){ VP.q=""; vpDraw(); $("#vp-q")&&$("#vp-q").focus(); return; }
  if(k==="reload"){ vpLoad(); return; }
  if(k==="cancel"){ VP.up=null; vpDraw(); return; }
  if(k==="allon"){ const all=VP.up.items.every(i=>i.on); VP.up.items.forEach(i=>i.on=!all); vpDraw(); return; }
  if(k==="save"){ vpSave(); return; }
  if(k==="tpl"){ vpTpl(); return; } });
document.addEventListener("change", e=>{ const t=e.target; if(!t.closest||!t.closest("#vp-card")) return;
  if(t.id==="vp-file"||t.id==="vp-file2"){ const f=t.files&&t.files[0]; t.value=""; vpFile(f); return; }
  if(t.dataset.vpi!=null){ VP.up.items[+t.dataset.vpi].on=t.checked; const r=t.closest(".vpu"); r&&r.classList.toggle("off",!t.checked);
    const bar=$("#vp-card .vpubar span"), on=VP.up.items.filter(i=>i.on), nn=on.filter(i=>!i.pid).length; if(bar) bar.textContent=on.length+" "+plural(on.length,["позиция","позиции","позиций"])+(nn?` · ${nn} ${plural(nn,["новый товар","новых товара","новых товаров"])}`:"");
    const sv=$('#vp-card [data-vp="save"]'); if(sv) sv.disabled=!on.length; return; }
  if(t.id==="vp-vendor") VP.up.vendor=t.value; if(t.id==="vp-date") VP.up.date=t.value; });
document.addEventListener("input", e=>{ const t=e.target; if(t.id==="vp-q"){ VP.q=t.value; vpDraw(); return; }
  if(t.dataset&&t.dataset.vpiq!=null){ VP.iq[t.dataset.vpiq]=t.value; const l=t.closest(".vpl"), lst=vpLists().find(x=>x.id===t.dataset.vpiq); if(!l||!lst) return;
    const iq=t.value.trim(), R=lst.rows.filter(r=>!iq||acHit(iq, r.name+" "+(r.productName||""))); l.querySelector(".vprows").innerHTML=R.slice(0,300).map(r=>vpRowHtml(r)).join("")||`<p class="muted">Ничего не нашлось</p>`; } });
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && e.target.id==="vp-q" && VP.q){ VP.q=""; vpDraw(); } });
["dragover","drop"].forEach(ev=>document.addEventListener(ev, e=>{ const box=e.target.closest&&e.target.closest("#vp-card"); if(!box||VP.srv===false||(VP.up&&VP.up.busy)) return;
  e.preventDefault(); if(ev==="dragover"){ box.classList.add("vpdrag"); return; } box.classList.remove("vpdrag"); const f=e.dataTransfer.files&&e.dataTransfer.files[0]; f&&vpFile(f); }));
document.addEventListener("dragleave", e=>{ if(e.target.id==="vp-card") e.target.classList.remove("vpdrag"); });

/* ---------- окно одного прайса: всё по этому поставщику и дате ---------- */
const VPW={lid:"", q:"", cat:"", sort:"cat"};
const vpCatOf = r => { const P=String(r.note||"").split(" · ").filter(x=>!/ндс/i.test(x)); return P.join(" · "); };
const vpVatOf = l => { const r=l.rows.find(x=>/ндс/i.test(x.note||"")); return r ? (String(r.note).split(" · ").find(x=>/ндс/i.test(x))||"") : ""; };
function vpWinRows(l){ const q=VPW.q.trim(); let R=l.rows.filter(r=>(!VPW.cat||vpCatOf(r)===VPW.cat)&&(!q||acHit(q, r.name+" "+(r.productName||"")+" "+vpCatOf(r))));
  const col=new Intl.Collator("ru",{numeric:true});
  if(VPW.sort==="name") R=R.slice().sort((a,b)=>col.compare(a.name,b.name)); else if(VPW.sort==="price") R=R.slice().sort((a,b)=>(vpN(a.price)??1e12)-(vpN(b.price)??1e12)); else if(VPW.sort==="price-d") R=R.slice().sort((a,b)=>(vpN(b.price)??-1)-(vpN(a.price)??-1));
  return R; }
function vpWinList(l){ const R=vpWinRows(l), lim=400; let cat=null, h="";
  R.slice(0,lim).forEach(r=>{ const c=vpCatOf(r); if(VPW.sort==="cat" && !VPW.cat && c!==cat){ cat=c; h+=`<div class="vpwc">${esc(c||"Без раздела")}</div>`; }
    const p=r.productId&&prod(r.productId), own=p&&(+p.price>0);
    h+=`<div class="vpr vpwr"><span class="vprn"><b>${esc(r.name)}</b><small>${VPW.sort!=="cat"&&c?esc(c)+" · ":""}${p?`<button type="button" class="vpwl" data-vpwp="${esc(p.id)}">на сайте: ${esc(p.name)}${own?" · ваша цена "+vpMoney(p.price):""} ›</button>`:"нет на сайте"}</small></span>
      <span class="vprp"><b>${vpMoney(r.price)}</b><small>/${esc(r.unit||"")}</small></span></div>`; });
  return `<p class="vpfh">${R.length===l.rows.length?"Все "+R.length:"Найдено "+R.length+" из "+l.rows.length}${R.length>lim?" — показаны первые "+lim:""}</p>`+(h||`<div class="vpempty sm"><span>Ничего не нашлось</span></div>`); }
function vpWin(lid, keep){ const l=vpLists().find(x=>x.id===lid); if(!l) return; if(!keep||VPW.lid!==lid) Object.assign(VPW,{lid, q:"", cat:"", sort:"cat"}); vpCss();
  const cats=[...new Set(l.rows.map(vpCatOf))].filter(Boolean), vat=vpVatOf(l), have=l.rows.filter(r=>r.productId&&prod(r.productId)).length;
  CARD_RE=()=>vpWin(lid, true);
  openCard(`<div class="dc-head" style="--h:${vpHue(l.vendor)}"><div><div class="dc-kicker">Прайс поставщика</div><h3>${esc(l.vendor||"Без названия")}</h3>
      <div class="vpwsub">от ${fd(l.date)} · ${l.rows.length} ${plural(l.rows.length,["позиция","позиции","позиций"])}${vat?" · цены "+esc(vat):""}${l.by?" · загрузил"+(/а$/.test(l.by)?"а":"")+" "+esc(l.by):""}</div></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="vpw">
      <div class="vpwt"><div class="vpsearch sm">${VP_IC.find}<input id="vpw-q" type="search" placeholder="Поиск в этом прайсе" value="${esc(VPW.q)}" autocomplete="off"></div>
        <select id="vpw-sort" aria-label="Порядок">${[["cat","По разделам"],["name","По алфавиту"],["price","Сначала дешевле"],["price-d","Сначала дороже"]].map(([k,t])=>`<option value="${k}"${VPW.sort===k?" selected":""}>${t}</option>`).join("")}</select></div>
      ${cats.length>1?`<div class="vpchips vpwcats"><button type="button" class="vpchip${VPW.cat?"":" on"}" data-vpwc="">Все разделы <b>${l.rows.length}</b></button>${cats.map(c=>`<button type="button" class="vpchip${VPW.cat===c?" on":""}" data-vpwc="${esc(c)}">${esc(c)} <b>${l.rows.filter(r=>vpCatOf(r)===c).length}</b></button>`).join("")}</div>`:""}
      <div class="vpwk"><span><b>${have}</b> уже есть во «Товарах»</span><span>Цены только для сравнения — не ваша закупка</span></div>
      <div id="vpw-list" class="vprows vpwlist">${vpWinList(l)}</div>
      <div class="vpwf"><button type="button" class="btn sm" data-vpw="prod">Показать в «Товарах» ›</button><button type="button" class="btn ghost sm" data-vpw="xls">Скачать Excel</button><span style="flex:1"></span><button type="button" class="btn ghost danger sm" data-vpw="del">Удалить прайс</button></div>
    </div>`, true); }
async function vpWinXls(l){ try{ const X=await loadXLSX(), vat=vpVatOf(l);
    const aoa=[["Прайс поставщика — шаблон для сайта «Фруктовый Дом · документы»"],["Выгружено с сайта. Можно поправить и загрузить снова кнопкой «Загрузить прайс»."],[],["Поставщик",l.vendor],["Дата прайса",fd(l.date)],["Цены",vat||""],[],["Наименование","Ед.","Цена, ₽","Категория","Примечание"]];
    l.rows.forEach(r=>aoa.push([r.name, r.unit||"", vpN(r.price), vpCatOf(r), ""]));
    const ws=X.utils.aoa_to_sheet(aoa); ws["!cols"]=[{wch:58},{wch:7},{wch:12},{wch:28},{wch:20}];
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Прайс"); X.writeFile(wb,"Прайс "+(l.vendor||"")+" "+fd(l.date)+".xlsx");
  }catch(e){ toast("err","Не получилось выгрузить", e.message||String(e)); } }
document.addEventListener("click", e=>{ const d=e.target.closest&&e.target.closest("#fd-dcard"); if(!d||!VPW.lid) return; const l=vpLists().find(x=>x.id===VPW.lid); if(!l) return;
  const c=e.target.closest("[data-vpwc]"); if(c){ VPW.cat=c.dataset.vpwc; d.querySelectorAll("[data-vpwc]").forEach(x=>x.classList.toggle("on", x===c)); $("#vpw-list").innerHTML=vpWinList(l); return; }
  const pp=e.target.closest("[data-vpwp]"); if(pp){ if(typeof pdCard==="function"){ navStash(d); pdCard(pp.dataset.vpwp); } return; }
  const b=e.target.closest("[data-vpw]"); if(!b) return; const k=b.dataset.vpw;
  if(k==="xls"){ vpWinXls(l); return; }
  if(k==="prod"){ d.close(); pdSrcSet("v:"+l.vendor); tabBackFrom("Поставщики", ()=>showTab("products")); return; }
  if(k==="del"){ if(!armed(b,"Точно удалить прайс?")) return; b.disabled=true;
    api({action:"vprices", op:"del", listId:l.id}).then(()=>{ VP.rows=D.vprices=vpRows().filter(r=>r.listId!==l.id); VPW.lid=""; d.close(); toast("ok","Прайс удалён","Товары во «Товарах» остались."); vpDraw(); }).catch(er=>{ b.disabled=false; toast("err","Не удалилось", er.message||String(er)); }); } });
document.addEventListener("input", e=>{ if(e.target.id!=="vpw-q") return; VPW.q=e.target.value; const l=vpLists().find(x=>x.id===VPW.lid); if(l) $("#vpw-list").innerHTML=vpWinList(l); });
document.addEventListener("change", e=>{ if(e.target.id!=="vpw-sort") return; VPW.sort=e.target.value; const l=vpLists().find(x=>x.id===VPW.lid); if(l) $("#vpw-list").innerHTML=vpWinList(l); });

/* ---------- «Товары»: отдельно мои товары и товары из прайсов поставщиков ---------- */
let VPIX=null;
function vpIdx(){ const R=vpRows(), key=R.length+"|"+D.products.length+"|"+(D.journal||[]).length; if(VPIX&&VPIX.key===key) return VPIX;
  const inV={}, byV={}; R.forEach(r=>{ if(!r.productId) return; inV[r.productId]=1; (byV[r.vendor]=byV[r.vendor]||{})[r.productId]=1; });
  const cp={}; for(const c in D.prices||{}) for(const p in D.prices[c]){ const v=D.prices[c][p]; if(v!=null&&v!=="") cp[p]=1; }
  const S=typeof pdSales==="function"?pdSales():{}, only={}; Object.keys(inV).forEach(id=>{ const p=prod(id); if(p && !(+p.price>0) && !cp[id] && !S[id]) only[id]=1; });
  return VPIX={key, inV, byV, only}; }
const pdSrcGet = () => { if(!vpRows().length) return "all"; const v=(typeof PDV!=="undefined"&&PDV.src)||(()=>{ try{ return localStorage.getItem("frudom-pdsrc"); }catch(e){ return ""; } })()||"mine";
  return v.startsWith("v:") && !vpIdx().byV[v.slice(2)] ? "mine" : v; };
function pdSrcSet(v){ PDV.src=v; try{ localStorage.setItem("frudom-pdsrc", v); }catch(e){} PDL.lim=100; }
function pdSrcOk(p){ const s=pdSrcGet(); if(s==="all") return true; const X=vpIdx(); if(s==="mine") return !X.only[p.id]; return !!(X.byV[s.slice(2)]||{})[p.id]; }
function pdVpPrice(p){ const s=pdSrcGet(); if(s.startsWith("v:")) return vpOf(p.id).find(r=>r.vendor===s.slice(2))||null;
  return +p.price>0 ? null : (vpOf(p.id)[0]||null); }   /* своей цены нет — показываем цену из прайса поставщика (с его именем) */
function pdSrcBar(){ const cats=$("#pd-cats"); if(!cats) return; let bar=$("#pd-src"); if(!bar){ bar=document.createElement("div"); bar.id="pd-src"; bar.className="pdsrc"; cats.parentNode.insertBefore(bar, cats); }
  if(VP.rows==null && VP.busy!=="load" && !isStaff()) vpLoad(true).then(()=>{ if(curTab==="products") renderProducts(); });
  if(!vpRows().length){ bar.hidden=true; return; } vpCss(); bar.hidden=false; const X=vpIdx(), s=pdSrcGet(), only=Object.keys(X.only).length;
  const V=Object.keys(X.byV).sort((a,b)=>a.localeCompare(b,"ru"));
  bar.innerHTML=`<span class="pdsrcl">Показать</span><div class="pdsrcs" role="tablist">`+
    `<button type="button" role="tab" data-pdsrc="mine" class="${s==="mine"?"on":""}" title="Ваши товары: с вашей ценой, в прайсах заказчиков или в накладных">Мои товары <em>${D.products.length-only}</em></button>`+
    V.map(v=>`<button type="button" role="tab" data-pdsrc="v:${esc(v)}" class="${s==="v:"+v?"on":""}" style="--h:${vpHue(v)}" title="Товары из прайса ${esc(v)} — с его ценами"><i></i>${esc(v)} <em>${Object.keys(X.byV[v]).length}</em></button>`).join("")+
    `<button type="button" role="tab" data-pdsrc="all" class="${s==="all"?"on":""}">Все <em>${D.products.length}</em></button></div>`+
    (s.startsWith("v:")?`<p class="pdsrch">Цены поставщика «${esc(s.slice(2))}» из его прайса — только для сравнения. Ваша цена — в раскрытой строке.</p>`:s==="mine"&&only?`<p class="pdsrch">Скрыто ${only} ${plural(only,["товар","товара","товаров"])} только из прайсов поставщиков — их видно в переключателе выше.</p>`:"");
}
document.addEventListener("click", e=>{ const b=e.target.closest&&e.target.closest("[data-pdsrc]"); if(!b) return; pdSrcSet(b.dataset.pdsrc); renderProducts(); });

const VP_IC={
  up:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  find:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  dl:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  chev:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  box:'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>'
};
function vpCss(){ if(document.getElementById("vp-css")) return; const st=document.createElement("style"); st.id="vp-css"; st.textContent=`
#vp-card{transition:box-shadow .2s, outline-color .2s;outline:2px dashed transparent;outline-offset:-6px}
#vp-card.vpdrag{outline-color:var(--accent)}
.vph{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;margin-bottom:12px}
.vph h2{margin:0 0 4px}.vph p{margin:0;font-size:13.5px;max-width:560px}
.vpbtns{flex:none;display:flex;gap:8px}.vptpl{display:inline-flex;align-items:center;gap:7px}
.vprn small.cat{color:var(--muted)}
#fd-app .vpsearch input[type=search],.vpsearch input[type=search]{padding-left:38px!important;padding-right:34px}
#fd-app .vpsearch.sm input[type=search],.vpsearch.sm input[type=search]{padding-left:36px!important}
#fd-app label.vpu,label.vpu{display:flex;flex-direction:row;align-items:center;gap:12px;width:auto;margin:0}
#fd-app .vpu>input[type=checkbox],.vpu>input[type=checkbox]{flex:none;width:20px!important;height:20px;min-width:20px;min-height:0;padding:0!important;margin:0;border:0;background:none;accent-color:var(--accent);cursor:pointer}
.vpprog{display:grid;justify-items:center;gap:8px;text-align:center;padding:26px 18px 20px;border:1.5px dashed color-mix(in srgb,var(--accent) 35%,var(--line));border-radius:16px;background:linear-gradient(180deg,var(--accent-soft),transparent 70%)}
.vppic{position:relative;color:var(--accent);width:48px;height:56px;margin-bottom:4px;animation:vpfloat 2.4s ease-in-out infinite}
.vppic path.l1,.vppic path.l2,.vppic path.l3{stroke-dasharray:24;stroke-dashoffset:24;animation:vpline 1.8s ease-in-out infinite}
.vppic path.l2{animation-delay:.25s}.vppic path.l3{animation-delay:.5s}
.vpscan{position:absolute;left:4px;right:4px;height:3px;border-radius:3px;background:var(--accent);opacity:.55;box-shadow:0 0 10px var(--accent);animation:vpscan 1.8s ease-in-out infinite}
.vpptl{font-size:15.5px;color:var(--ink)}.vppf{font-size:12.5px;color:var(--muted);overflow-wrap:anywhere}.vppt{font-variant-numeric:tabular-nums}
.vpbar{position:relative;width:min(360px,100%);height:6px;border-radius:6px;background:color-mix(in srgb,var(--line) 70%,transparent);overflow:hidden;margin:4px 0 6px}
.vpbar i{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:linear-gradient(90deg,var(--accent),color-mix(in srgb,var(--accent) 60%,#fff));transition:width .45s cubic-bezier(.2,.8,.2,1)}
.vpbar.ind i{width:30%!important;animation:vpind 1.3s ease-in-out infinite}
.vpst{list-style:none;margin:0;padding:0;display:grid;gap:6px;text-align:left;width:min(360px,100%)}
#fd-app .vpst li,.vpst li{display:flex;flex-direction:row;margin:0;align-items:flex-start;gap:10px;font-size:13.5px;color:var(--muted);transition:color .3s}
.vpst li>span:last-child{display:grid}.vpst small{font-size:12px;color:var(--muted)}
.vpst li.cur{color:var(--ink);font-weight:600}.vpst li.cur small{font-weight:400}.vpst li.ok{color:var(--ok)}
.vpsd{flex:none;width:16px;height:16px;margin-top:1px;border-radius:50%;border:2px solid var(--line);box-sizing:border-box;position:relative;transition:border-color .3s,background .3s}
.vpst li.cur .vpsd{border-color:var(--accent-soft);border-top-color:var(--accent);animation:vpsp .8s linear infinite}
.vpst li.ok .vpsd{border-color:var(--ok);background:var(--ok)}
.vpst li.ok .vpsd::after{content:"";position:absolute;left:4px;top:1px;width:4px;height:7px;border:solid #fff;border-width:0 2px 2px 0;transform:rotate(45deg)}
.vpadd{flex:none;display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border-color:var(--accent);cursor:pointer}
.vpadd:hover{filter:brightness(1.08)}.vpadd.dis{opacity:.45;pointer-events:none}
.vpsearch{position:relative;display:flex;align-items:center;margin:0 0 12px}
.vpsearch svg{position:absolute;left:12px;color:var(--muted);pointer-events:none}
.vpsearch input{width:100%;padding:10px 36px 10px 36px;border-radius:12px}
.vpsearch.sm{margin:2px 0 8px}.vpsearch.sm input{padding:8px 12px 8px 34px;font-size:14px}
.vpx{position:absolute;right:6px;border:0;background:none;font-size:20px;line-height:1;color:var(--muted);cursor:pointer;padding:4px 8px}
.vplists{display:grid;gap:8px}
.vplt{display:flex;align-items:baseline;gap:8px;margin:4px 2px 8px}.vplt b{font-size:14px}.vplt span{color:var(--muted);font-size:13px}
.vplhw{display:flex;align-items:center;gap:8px;padding-right:12px}.vplhw .vplh{flex:1;min-width:0}.vpopen{flex:none}
.vpwsub{color:var(--muted);font-size:13px;margin-top:3px}
.vpw{display:grid;gap:10px}.vpwt{display:flex;gap:8px;align-items:center}.vpwt .vpsearch{flex:1;margin:0}.vpwt select{width:auto;flex:none}
.vpwk{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px;font-size:12.5px;color:var(--muted)}.vpwk b{color:var(--ink)}
.vpwlist{max-height:none;overflow:visible}.vpwc{position:sticky;top:0;z-index:1;background:var(--surface,#fff);padding:10px 4px 4px;font-size:12px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line)}
.vpwr{animation:vpfade .25s ease both}.vpwl{border:0;background:none;padding:0;font:inherit;color:var(--accent);cursor:pointer;text-align:left}.vpwl:hover{text-decoration:underline}
.vpwf{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding-top:6px;border-top:1px solid var(--line)}
.vpwcats{max-height:96px;overflow:auto}
.pdsrc{display:grid;gap:6px;margin:0 0 10px}.pdsrcl{font-size:12px;color:var(--muted)}
.pdsrcs{display:flex;flex-wrap:wrap;gap:4px;padding:4px;border-radius:14px;background:color-mix(in srgb,var(--line) 45%,transparent);width:fit-content;max-width:100%}
.pdsrcs button{display:inline-flex;align-items:center;gap:6px;border:0;background:none;border-radius:10px;padding:7px 12px;font:inherit;font-size:13.5px;color:var(--ink);cursor:pointer;transition:background .2s,box-shadow .2s,color .2s}
.pdsrcs button em{font-style:normal;color:var(--muted);font-size:12px}.pdsrcs button i{width:8px;height:8px;border-radius:50%;background:hsl(var(--h) 55% 55%)}
.pdsrcs button.on{background:var(--surface);box-shadow:0 1px 4px rgba(30,30,40,.12);font-weight:600}
.pdsrch{margin:0;font-size:12.5px;color:var(--muted)}
.nmp.vpp b{color:hsl(var(--h,300) 45% 38%)}
.vpl{border:1px solid var(--line);border-radius:14px;background:var(--surface);overflow:hidden;transition:box-shadow .25s, border-color .25s;animation:vpin .35s ease both}
.vpl:hover{border-color:hsl(var(--h) 30% 78%)}.vpl.open{box-shadow:0 6px 22px rgba(30,30,40,.07)}
.vplh{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border:0;background:none;text-align:left;cursor:pointer;font:inherit;color:inherit}
.vpav{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:700;color:hsl(var(--h) 45% 32%);background:hsl(var(--h) 55% 92%)}
.vpln{flex:1;min-width:0;display:grid;gap:2px}.vpln b{font-size:15px}.vpln small{color:var(--muted);font-size:12.5px}
.vpchev{color:var(--muted);transition:transform .3s cubic-bezier(.2,.8,.2,1)}.vpl.open .vpchev{transform:rotate(180deg)}
.vplb{display:grid;grid-template-rows:0fr;transition:grid-template-rows .32s cubic-bezier(.2,.8,.2,1)}.vpl.open .vplb{grid-template-rows:1fr}
.vplbi{overflow:hidden;min-height:0;padding:0 14px}.vpl.open .vplbi{padding-bottom:12px;animation:vpfade .35s ease both}
.vplf{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;font-size:12.5px}
.vprows{display:grid;max-height:440px;overflow:auto;border-radius:10px}
.vpr{display:flex;align-items:center;gap:12px;padding:9px 4px;border-bottom:1px solid color-mix(in srgb,var(--line) 70%,transparent)}
.vpr:last-child{border-bottom:0}
.vprn{flex:1;min-width:0;display:grid;gap:1px}.vprn b{font-weight:500;font-size:14px;overflow-wrap:anywhere}.vprn small{color:var(--muted);font-size:12px}
.vprp{flex:none;text-align:right;white-space:nowrap}.vprp b{font-variant-numeric:tabular-nums;font-size:14.5px}.vprp small{color:var(--muted);font-size:12px}
.vpr.best .vprp b{color:var(--ok)}.vpr.best .vprp b::before{content:"дешевле всех · ";font-weight:500;font-size:11.5px}
.vpdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:hsl(var(--h) 55% 55%);margin-right:6px;vertical-align:1px}
.vpfh{margin:0 0 6px;font-size:13px;color:var(--muted)}
.vpempty{display:grid;justify-items:center;gap:6px;text-align:center;padding:26px 16px;border:1.5px dashed var(--line);border-radius:14px;color:var(--muted);font-size:13.5px}
.vpempty b{color:var(--ink);font-size:15px}.vpempty svg{color:var(--accent);opacity:.7}.vpempty.sm{padding:16px}
.vpdrop{cursor:pointer;transition:background .2s}.vpdrop:hover{background:var(--accent-soft)}
.vperr{color:var(--err);font-size:13.5px}
.vpspin{width:24px;height:24px;border-radius:50%;border:2.5px solid var(--accent-soft);border-top-color:var(--accent);animation:vpsp .8s linear infinite}
.vpup{animation:vpin .35s ease both}
.vpuph{display:grid;gap:2px;margin-bottom:10px}.vpuph b{font-size:15.5px}.vpuph small{color:var(--muted)}
.vpugrid{display:grid;grid-template-columns:2fr 1fr;gap:10px;margin-bottom:10px}.vpugrid label{display:grid;gap:4px;font-size:13px;color:var(--muted)}
.vpchips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:6px}
.vpchip{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:5px 11px;font:inherit;font-size:13px;cursor:pointer;transition:background .2s,border-color .2s,color .2s}
.vpchip b{font-weight:600;color:var(--muted);margin-left:3px}.vpchip.on{background:var(--accent);border-color:var(--accent);color:#fff}.vpchip.on b{color:#fff}
.vprows.up{max-height:52vh;border:1px solid var(--line);padding:0 10px}
.vpu{cursor:pointer;transition:opacity .2s}.vpu.off{opacity:.45}.vpu input{flex:none;width:18px;height:18px;accent-color:var(--accent)}
.vprn small.have{color:var(--ok)}.vprn small.nw{color:var(--accent)}
.vpun{border:0;background:none;color:var(--muted);cursor:pointer;font-size:15px;padding:0 4px}
.vpubar{position:sticky;bottom:calc(var(--mbh,0px) + 8px);display:flex;align-items:center;gap:8px;margin-top:10px;padding:10px 12px;border-radius:14px;background:var(--surface);box-shadow:0 6px 24px rgba(30,30,40,.12)}
.vpubar span{flex:1;font-size:13.5px;color:var(--muted)}
.nmvp{display:inline-block;padding:0 7px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:11.5px;line-height:18px}
.vped{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:10px 0 2px;padding:10px 12px;border-radius:12px;background:color-mix(in srgb,var(--accent-soft) 60%,transparent);font-size:13px}
.vped>b{font-size:13px}.vped>small{color:var(--muted);flex-basis:100%;margin-top:-4px}
.vpedr{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:var(--surface)}
.vpedr i{width:8px;height:8px;border-radius:50%;background:hsl(var(--h) 55% 55%)}.vpedr em{font-style:normal;font-weight:600}.vpedr small{color:var(--muted)}
.vpedr.best em{color:var(--ok)}
@keyframes vpin{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes vpfade{from{opacity:0}to{opacity:1}}
@keyframes vpsp{to{transform:rotate(360deg)}}
@keyframes vpind{0%{left:-30%}100%{left:100%}}
@keyframes vpscan{0%,100%{top:16px}50%{top:44px}}
@keyframes vpline{0%{stroke-dashoffset:24}45%,70%{stroke-dashoffset:0}100%{stroke-dashoffset:-24}}
@keyframes vpfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@media (max-width:620px){.vplhw{flex-wrap:wrap;padding:0 12px 10px}.vplhw .vplh{flex-basis:100%;padding:12px 2px 6px}.vpopen{width:100%}.vpwt{flex-wrap:wrap}.vpwt select{width:100%}.vph{flex-direction:column}.vpbtns{width:100%}.vpbtns>*{flex:1;justify-content:center}.vpadd{justify-content:center}.vpugrid{grid-template-columns:1fr}.vpubar{flex-wrap:wrap}.vpubar span{flex-basis:100%}.vpubar .btn{flex:1}}
@media (prefers-reduced-motion:reduce){.vpl,.vpup,.vplbi,.vppic,.vppic path,.vpscan{animation:none!important}.vppic path{stroke-dashoffset:0}.vplb,.vpchev{transition:none}}`; document.head.appendChild(st); }
