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
    <label class="btn vpadd${VP.srv===false?" dis":""}">${VP_IC.up}<span>Загрузить прайс</span><input type="file" id="vp-file" hidden${VP.srv===false?" disabled":""}></label></div>`;
  let body="";
  if(VP.srv===false) body=`<div class="vpempty">${VP_IC.box}<b>Нужно обновить скрипт таблицы</b><span>Чтобы хранить прайсы поставщиков, вставьте новый Code.gs (версия 39) — инструкция в «Данные».</span></div>`;
  else if(VP.up) body=vpUpHtml();
  else if(VP.busy==="load" && VP.rows==null) body=`<div class="vpempty"><span class="vpspin"></span><span>Загружаю прайсы…</span></div>`;
  else { body=(VP.err?`<p class="vperr">${esc(VP.err)} <button type="button" class="btn ghost sm" data-vp="reload">Повторить</button></p>`:"")+
      (L.length?`<div class="vpsearch">${VP_IC.find}<input id="vp-q" type="search" placeholder="Найти товар во всех прайсах…" value="${esc(VP.q)}" autocomplete="off">${q?`<button type="button" class="vpx" data-vp="clear" aria-label="Очистить">×</button>`:""}</div>`:"")+
      (q ? vpFindHtml(q) : L.length ? `<div class="vplists">${L.map(vpListHtml).join("")}</div>` :
        `<label class="vpempty vpdrop">${VP_IC.box}<b>Пока нет ни одного прайса</b><span>Нажмите «Загрузить прайс» или перетащите файл сюда — Excel, PDF, Word или фото.</span></label>`); }
  const foc=document.activeElement&&document.activeElement.id, pos=foc==="vp-q"?document.activeElement.selectionStart:null;
  box.innerHTML=head+`<div class="vpbody">${body}</div>`;
  if(foc==="vp-q"){ const i=$("#vp-q"); if(i){ i.focus(); try{ i.setSelectionRange(pos,pos); }catch(e){} } } }
function vpListHtml(l){ const open=!!VP.open[l.id], iq=(VP.iq[l.id]||"").trim(), R=l.rows.filter(r=>!iq||acHit(iq, r.name+" "+(r.productName||""))), nn=l.rows.length;
  return `<div class="vpl${open?" open":""}" data-lid="${esc(l.id)}" style="--h:${vpHue(l.vendor)}">
    <button type="button" class="vplh" data-vp="tog" aria-expanded="${open}"><i class="vpav">${esc(String(l.vendor||"?").trim()[0]||"?")}</i>
      <span class="vpln"><b>${esc(l.vendor||"Без названия")}</b><small>прайс от ${fd(l.date)} · ${nn} ${plural(nn,["позиция","позиции","позиций"])}${l.by?" · загрузил"+(/а$/.test(l.by)?"а":"")+" "+esc(l.by):""}</small></span>
      <span class="vpchev">${VP_IC.chev}</span></button>
    <div class="vplb"><div class="vplbi">${open?`<div class="vpsearch sm">${VP_IC.find}<input data-vpiq="${esc(l.id)}" type="search" placeholder="Поиск в этом прайсе" value="${esc(VP.iq[l.id]||"")}" autocomplete="off"></div>
      <div class="vprows">${R.slice(0,300).map(r=>vpRowHtml(r)).join("")||`<p class="muted">Ничего не нашлось</p>`}</div>${R.length>300?`<p class="muted">Показаны первые 300 — уточните поиск</p>`:""}
      <div class="vplf"><span class="muted">Цены для сравнения — в прибыль и закупку не идут</span><button type="button" class="btn ghost danger sm" data-vp="del">Удалить прайс</button></div>`:""}</div></div></div>`; }
function vpRowHtml(r, vendor){ const p=r.productId&&prod(r.productId);
  return `<div class="vpr"><span class="vprn"><b>${vendor?`<i class="vpdot" style="--h:${vpHue(r.vendor)}"></i>`:""}${esc(r.name)}</b>${p&&norm(p.name)!==norm(r.name)?`<small>на сайте: ${esc(p.name)}</small>`:""}${vendor?`<small>${esc(r.vendor)} · от ${fd(r.date)}</small>`:""}</span>
    <span class="vprp"><b>${vpMoney(r.price)}</b><small>/${esc(r.unit||"")}</small></span></div>`; }
function vpFindHtml(q){ const R=vpRows().filter(r=>acHit(q, r.name+" "+(r.productName||"")+" "+r.vendor)).sort((a,b)=>(vpN(a.price)??1e12)-(vpN(b.price)??1e12));
  if(!R.length) return `<div class="vpempty sm"><span>По «${esc(q)}» ничего нет ни в одном прайсе</span></div>`;
  const best=vpN(R[0].price);
  return `<p class="vpfh">${R.length} ${plural(R.length,["позиция","позиции","позиций"])} у ${new Set(R.map(r=>r.vendor)).size} ${plural(new Set(R.map(r=>r.vendor)).size,["поставщика","поставщиков","поставщиков"])} · сначала дешевле</p>
    <div class="vprows">${R.slice(0,200).map(r=>vpRowHtml(r,1).replace('<div class="vpr">', vpN(r.price)===best?'<div class="vpr best">':'<div class="vpr">')).join("")}</div>`; }

/* ---------- загрузка прайса ---------- */
async function vpFile(f){ if(!f) return; if(VP.srv===false){ toast("warn","Нужно обновить Code.gs","Прайсы хранятся на новом листе таблицы."); return; }
  VP.up={file:f.name, busy:"Читаю файл…", items:[]}; vpDraw();
  try{ const d=await aiInput(f, true); let chunks=[];
    if(d.text){ const lines=d.text.split(/\r?\n/), head=lines.slice(0,3).join("\n"); let cur="";
      lines.forEach(l=>{ if(cur.length+l.length>30000){ chunks.push(cur); cur=head+"\n"; } cur+=l+"\n"; }); if(cur.trim()) chunks.push(cur); chunks=chunks.slice(0,8); }
    const parts=[]; let vendor="", date="";
    for(let i=0;i<(chunks.length||1);i++){ VP.up.busy="ИИ читает прайс"+(chunks.length>1?" — часть "+(i+1)+" из "+chunks.length:"")+"…"; vpDraw();
      const body=chunks.length ? {action:"aiRead", kind:"price", text:chunks[i], src:"file", fname:f.name} : {action:"aiRead", kind:"price", mime:d.mime, data:d.data, fname:f.name};
      let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:150000, body:JSON.stringify(Object.assign({key:pass(), user:curUser()}, body))}); }
      catch(e){ const m=e.message||""; throw new Error(m==="nokey"||m==="badkey"?"не настроен ключ ИИ — «Данные» → «ИИ»":m==="unknown action"?"скрипт таблицы старый — обновите Code.gs":m); }
      let x; try{ x=JSON.parse(String(j.text).replace(/^```(json)?|```$/g,"").trim()); }catch(e){ throw new Error("ИИ ответил не по форме — попробуйте ещё раз"); }
      vendor=vendor||String(x.supplier||"").trim(); date=date||String(x.date||"").trim(); (x.items||[]).forEach(it=>parts.push(Array.isArray(it)?{name:it[0], unit:it[1], price:it[2]}:it)); }
    const seen={}, items=[];
    parts.forEach(it=>{ const name=String(it.name||"").replace(/\s+/g," ").trim(), price=vpN(it.price); if(!name||price==null||price<=0) return;
      const unit=String(it.unit||"").toLowerCase().replace(/\.$/,"").trim()||"кг", k=norm(name)+"|"+unit; if(seen[k]) return; seen[k]=1;
      const p=vpMatch(name); items.push({name, unit, price, pid:p?p.id:"", on:true}); });
    if(!items.length) throw new Error("в прайсе не нашлось товаров с ценами");
    const m=date.match(/^(\d\d)\.(\d\d)\.(\d{4})$/);
    VP.up={file:f.name, vendor:vpVendorGuess(vendor, f.name), date:m?m[3]+"-"+m[2]+"-"+m[1]:todayISO(), items, f:"all"};
    logEv("Справочники","Прайс «"+f.name+"» прочитан ИИ: "+items.length+" поз.");
  }catch(e){ VP.up={file:f.name, err:e.message||String(e), items:[]}; }
  vpDraw(); }
function vpVendorGuess(v, fname){ const V=vpVendors(), t=(v||fname||"").toLowerCase();
  const hit=V.find(x=>t.includes(x.toLowerCase())); return hit || v || ""; }
function vpMatch(name){ const clean=s=>norm(s).replace(/[«»"]/g,"").replace(/\s+/g," ").trim(), n=clean(name);
  let p=D.products.find(x=>clean(x.name)===n) || D.products.find(x=>aliasesOf(x).some(a=>clean(a)===n)); if(p) return p;
  const T=stems(name); if(T.length<2) return null;
  p=D.products.find(x=>{ const U=stems(x.name); return U.length>=2 && U.length===T.length && U.every(w=>T.includes(w)); }); return p||null; }
function vpUpHtml(){ const u=VP.up;
  if(u.busy) return `<div class="vpup"><div class="vpempty"><span class="vpspin"></span><b>${esc(u.busy)}</b><span>«${esc(u.file)}» — обычно 10–40 секунд</span></div></div>`;
  if(u.err) return `<div class="vpup"><div class="vpempty"><b>Не получилось прочитать «${esc(u.file)}»</b><span>${esc(u.err)}</span><span class="row"><label class="btn sm">Выбрать другой файл<input type="file" id="vp-file2" hidden></label><button type="button" class="btn ghost sm" data-vp="cancel">Закрыть</button></span></div></div>`;
  const I=u.items, nw=I.filter(i=>!i.pid).length, on=I.filter(i=>i.on), onNew=on.filter(i=>!i.pid).length;
  const F=I.map((it,i)=>[it,i]).filter(([it])=>u.f==="all"||(u.f==="new"?!it.pid:!!it.pid));
  return `<div class="vpup"><div class="vpuph"><b>Прайс прочитан · ${I.length} ${plural(I.length,["позиция","позиции","позиций"])}</b><small>«${esc(u.file)}» — проверьте названия и цены</small></div>
    <div class="vpugrid"><label><span>Поставщик</span><input id="vp-vendor" value="${esc(u.vendor)}" placeholder="Например, Роспродукт" list="vp-vlist"><datalist id="vp-vlist">${vpVendors().map(v=>`<option value="${esc(v)}">`).join("")}</datalist></label>
      <label><span>Дата прайса</span><input id="vp-date" type="date" value="${esc(u.date)}"></label></div>
    <div class="vpchips">${[["all","Все",I.length],["new","Новые товары",nw],["have","Уже есть на сайте",I.length-nw]].map(([k,t,n])=>`<button type="button" class="vpchip${u.f===k?" on":""}" data-vpf="${k}">${t} <b>${n}</b></button>`).join("")}
      <span style="flex:1"></span><button type="button" class="btn ghost sm" data-vp="allon">${on.length===I.length?"Снять все":"Отметить все"}</button></div>
    <div class="vprows up">${F.map(([it,i])=>`<label class="vpr vpu${it.on?"":" off"}"><input type="checkbox" data-vpi="${i}"${it.on?" checked":""}>
      <span class="vprn"><b>${esc(it.name)}</b>${it.pid?`<small class="have">есть на сайте: ${esc((prod(it.pid)||{}).name||"")} <button type="button" class="vpun" data-vpun="${i}" title="Это другой товар — создать новый">×</button></small>`:`<small class="nw">новый товар — появится во «Товарах»</small>`}</span>
      <span class="vprp"><b>${vpMoney(it.price)}</b><small>/${esc(it.unit)}</small></span></label>`).join("")}</div>
    <div class="vpubar"><span>${on.length} ${plural(on.length,["позиция","позиции","позиций"])}${onNew?` · ${onNew} ${plural(onNew,["новый товар","новых товара","новых товаров"])}`:""}</span>
      <button type="button" class="btn ghost" data-vp="cancel">Отмена</button><button type="button" class="btn primary" data-vp="save"${on.length?"":" disabled"}>Сохранить прайс</button></div></div>`; }
const vpUnit = u => { u=String(u||"").toLowerCase(); return UNITS[u]?u:/^уп/.test(u)?"упак":/шт|штук/.test(u)?"шт":/^пар/.test(u)?"пар":/^л/.test(u)?"л":/^г(р|$)/.test(u)?"г":"кг"; };
async function vpSave(){ const u=VP.up, vendor=($("#vp-vendor").value||"").trim(), date=$("#vp-date").value||todayISO();
  if(!vendor){ toast("warn","Укажите поставщика","Например, «Роспродукт» — чтобы было понятно, чьи это цены."); $("#vp-vendor").focus(); return; }
  const on=u.items.filter(i=>i.on); if(!on.length) return;
  const old=vpLists().find(l=>l.vendor.toLowerCase()===vendor.toLowerCase()&&l.date===date), lid=uid();
  u.busy="Сохраняю…"; vpDraw(); let made=0;
  try{ const rows=on.map(it=>{ let pid=it.pid;
      if(!pid){ const p={id:uid(), name:it.name, code:"", unit:vpUnit(it.unit), country:"", price:""}; D.products.push(p); dirty("products",p.id); pid=p.id; it.pid=pid; made++; }
      return {id:uid(), listId:lid, vendor, date, name:it.name, unit:it.unit, price:String(it.price), productId:pid}; });
    for(let i=0;i<rows.length;i+=800) await api({action:"vprices", op:"put", rows:JSON.stringify(rows.slice(i,i+800))});
    if(old) await api({action:"vprices", op:"del", listId:old.id}).catch(()=>{});
    if(made){ saveLocal(); flush().catch(()=>{}); }
    VP.rows=D.vprices=vpRows().filter(r=>!old||r.listId!==old.id).concat(rows.map(r=>Object.assign({by:curUser(), at:new Date().toISOString()}, r)));
    VP.up=null; VP.open={[lid]:true};
    toast("ok","Прайс сохранён", vendor+" от "+fd(date)+": "+rows.length+" "+plural(rows.length,["позиция","позиции","позиций"])+(made?", "+made+" "+plural(made,["новый товар","новых товара","новых товаров"])+" во «Товарах»":"")+(old?" (старый прайс за эту дату заменён)":"")+".");
  }catch(e){ u.busy=""; toast("err","Прайс не сохранился", e.message||String(e)); }
  vpDraw(); }

/* ---------- нажатия ---------- */
document.addEventListener("click", e=>{ const box=e.target.closest("#vp-card"); if(!box) return; const b=e.target.closest("[data-vp],[data-vpf],[data-vpun]"); if(!b) return;
  if(b.dataset.vpf){ VP.up.f=b.dataset.vpf; vpDraw(); return; }
  if(b.dataset.vpun){ e.preventDefault(); const it=VP.up.items[+b.dataset.vpun]; it.pid=""; vpDraw(); return; }
  const k=b.dataset.vp, l=b.closest(".vpl");
  if(k==="tog"){ const id=l.dataset.lid; VP.open[id]=!VP.open[id]; const was=VP.open[id];
    if(was){ vpDraw(); } else { l.classList.remove("open"); b.setAttribute("aria-expanded","false"); setTimeout(()=>{ if(!VP.open[id]) vpDraw(); }, 320); } return; }
  if(k==="del"){ if(!armed(b,"Точно удалить прайс?")) return; const id=l.dataset.lid; b.disabled=true;
    api({action:"vprices", op:"del", listId:id}).then(()=>{ VP.rows=D.vprices=vpRows().filter(r=>r.listId!==id); toast("ok","Прайс удалён","Товары во «Товарах» остались."); vpDraw(); }).catch(er=>{ b.disabled=false; toast("err","Не удалилось", er.message||String(er)); }); return; }
  if(k==="clear"){ VP.q=""; vpDraw(); $("#vp-q")&&$("#vp-q").focus(); return; }
  if(k==="reload"){ vpLoad(); return; }
  if(k==="cancel"){ VP.up=null; vpDraw(); return; }
  if(k==="allon"){ const all=VP.up.items.every(i=>i.on); VP.up.items.forEach(i=>i.on=!all); vpDraw(); return; }
  if(k==="save"){ vpSave(); return; } });
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

const VP_IC={
  up:'<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  find:'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/></svg>',
  chev:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  box:'<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>'
};
function vpCss(){ if(document.getElementById("vp-css")) return; const st=document.createElement("style"); st.id="vp-css"; st.textContent=`
#vp-card{transition:box-shadow .2s, outline-color .2s;outline:2px dashed transparent;outline-offset:-6px}
#vp-card.vpdrag{outline-color:var(--accent)}
.vph{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;margin-bottom:12px}
.vph h2{margin:0 0 4px}.vph p{margin:0;font-size:13.5px;max-width:560px}
.vpadd{flex:none;display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#fff;border-color:var(--accent);cursor:pointer}
.vpadd:hover{filter:brightness(1.08)}.vpadd.dis{opacity:.45;pointer-events:none}
.vpsearch{position:relative;display:flex;align-items:center;margin:0 0 12px}
.vpsearch svg{position:absolute;left:12px;color:var(--muted);pointer-events:none}
.vpsearch input{width:100%;padding:10px 36px 10px 36px;border-radius:12px}
.vpsearch.sm{margin:2px 0 8px}.vpsearch.sm input{padding:8px 12px 8px 34px;font-size:14px}
.vpx{position:absolute;right:6px;border:0;background:none;font-size:20px;line-height:1;color:var(--muted);cursor:pointer;padding:4px 8px}
.vplists{display:grid;gap:8px}
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
@media (max-width:620px){.vph{flex-direction:column}.vpadd{width:100%;justify-content:center}.vpugrid{grid-template-columns:1fr}.vpubar{flex-wrap:wrap}.vpubar span{flex-basis:100%}.vpubar .btn{flex:1}}
@media (prefers-reduced-motion:reduce){.vpl,.vpup,.vplbi{animation:none!important}.vplb,.vpchev{transition:none}}`; document.head.appendChild(st); }
