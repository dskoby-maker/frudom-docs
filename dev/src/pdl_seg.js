/* ================= «Товары»: компактный список номенклатуры =================
   Строка: артикул · название (категория, единица, подсказка по выбранному порядку) · цена · стрелка.
   Нажатие раскрывает все поля товара прямо в строке (открыта одна строка). Порядок — prefs.pdSort.
   Артикул (art) присваивает таблица (Code.gs ≥ 19, artFix_): 4 цифры, у связанных названий — один артикул основного товара. */
const IC_PCARD='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg>';
const IC_PDV='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const IC_LINK='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
/* артикул товара: номер основного товара группы (сразу после связывания — ещё до ответа таблицы) */
function pArt(p){ if(!p) return ""; const r=prod(pgRoot(p))||p; return String(r.artOwn||r.art||(r===p?"":p.art)||""); }
const pdArtSrv = () => (D.srvVer||0)>=19 || D.products.some(p=>p.artOwn);
const PD_SORT=[["name","По алфавиту А–Я"],["name-d","По алфавиту Я–А"],["new","Сначала новые"],["sold","Недавно продавали"],["top","Чаще продают (3 мес.)"],["price","Цена: дешевле"],["price-d","Цена: дороже"],["art","По артикулу"],["noprice","Сначала без цены"]];
const pdSortOf = () => { const v=getPrefs().pdSort; return PD_SORT.some(x=>x[0]===v)?v:"name"; };
const PDL = {open:"", fresh:"", lim:100};
/* продажи по товарам из журнала на устройстве: последняя дата, накладных и количество за 90 дней */
let PDS=null;
function pdSales(){ const key=(D.journal||[]).length+"|"+((D.journal||[])[0]||{}).updated; if(PDS && PDS.key===key) return PDS.m;
  const m={}, from=jIso(new Date(Date.now()-90*864e5));
  (D.journal||[]).forEach(j=>{ if(!j.snap||!j.snap.dr||isArch(j)) return; const seen={};
    (j.snap.dr.lines||[]).forEach(l=>{ const id=l.productId, q=+l.qty||0; if(!id||!(q>0)) return; const o=m[id]||(m[id]={last:"", n:0, q:0});
      if(j.date>o.last) o.last=j.date; if(j.date>=from){ o.q+=q; if(!seen[id]){ seen[id]=1; o.n++; } } }); });
  PDS={key, m}; return m; }
function pdSorted(L){ const s=pdSortOf(), S=pdSales(), col=new Intl.Collator("ru",{numeric:true}), idx=new Map(D.products.map((p,i)=>[p.id,i]));
  const nm=p=>String(p.name||"").trim(), pr=p=>+p.price>0?+p.price:null, an=p=>+pArt(p)||1e9;
  const cmp={ name:(a,b)=>col.compare(nm(a),nm(b)), "name-d":(a,b)=>col.compare(nm(b),nm(a)), new:(a,b)=>idx.get(b.id)-idx.get(a.id),
    sold:(a,b)=>String((S[b.id]||{}).last||"").localeCompare(String((S[a.id]||{}).last||""))||col.compare(nm(a),nm(b)),
    top:(a,b)=>((S[b.id]||{}).n||0)-((S[a.id]||{}).n||0)||((S[b.id]||{}).q||0)-((S[a.id]||{}).q||0)||col.compare(nm(a),nm(b)),
    price:(a,b)=>(pr(a)==null)-(pr(b)==null)||(pr(a)||0)-(pr(b)||0)||col.compare(nm(a),nm(b)), "price-d":(a,b)=>(pr(a)==null)-(pr(b)==null)||(pr(b)||0)-(pr(a)||0)||col.compare(nm(a),nm(b)),
    art:(a,b)=>an(a)-an(b)||col.compare(nm(a),nm(b)), noprice:(a,b)=>(pr(a)!=null)-(pr(b)!=null)||col.compare(nm(a),nm(b)) }[s];
  const out=L.slice().sort(cmp); const f=out.findIndex(p=>p.id===PDL.fresh); if(f>0) out.unshift(out.splice(f,1)[0]); return out; }
function pdHint(p){ const s=pdSortOf(), o=pdSales()[p.id];
  if(s==="sold") return o&&o.last ? "продавали "+fd(o.last) : "ещё не продавали";
  if(s==="top") return o&&o.n ? o.n+" "+plural(o.n,["накладная","накладные","накладных"])+" · "+skQf(o.q,p.unit) : "за 3 мес. не продавали";
  return ""; }
function pdRowHead(p){ const c=catOf(p), a=pArt(p), n=pgCount(p.id), pr=+p.price>0, h=pdHint(p);
  const meta=[c?`<i class="nmcd" style="--cc:${esc(c.color||"#bbb")}"></i>${esc(c.name)}`:"", esc(p.unit||""), n>1?`<span class="nmlk" title="Связанные названия одного товара">${IC_LINK}${n}</span>`:"", h?esc(h):""].filter(Boolean).join(" · ");
  return `<span class="nma${a?"":" new"}" title="${a?"Внутренний артикул":"Артикул появится после сохранения в таблицу"}">${a?esc(a):pdArtSrv()?"новый":"—"}</span>
    <span class="nmn"><b>${p.name?esc(p.name):`<em>Без названия</em>`}</b><small>${meta}</small></span>
    <span class="nmp${pr?"":" no"}">${pr?`<b>${fm(p.price).replace(/,00$/,"")} ₽</b><small>/${esc(p.unit||"")}</small>`:`<small>нет цены</small>`}</span><span class="nmv">${IC_PDV}</span>`; }
function pdEditor(p){ const a=pArt(p), M=pgMembers(p.id), packs=Object.entries(packsOf(p)).map(([u,f])=>u+" = "+qtxt(f)).join("; ");
  return `<div class="nme"><div class="nmg">
    <label class="w2"><span>Наименование <small>печатается в документах — пишите как в контракте</small></span><input data-k="name" value="${esc(p.name)}" placeholder="Например, Изюм Малаяр"></label>
    <label><span>Категория</span><select data-k="cat" class="pdcat" style="--cc:${esc((catOf(p)||{}).color||"transparent")}"${D.catSrv?"":" disabled title=\"Сначала обновите Code.gs\""}>${catOptions(p.cat||"", true)}</select></label>
    <label><span>Ед.</span><select data-k="unit">${Object.keys(UNITS).map(u=>`<option${u===p.unit?" selected":""}>${u}</option>`).join("")}</select></label>
    <label><span>Базовая цена, ₽</span><input data-k="price" inputmode="decimal" value="${esc(p.price)}" placeholder="0"></label>
    <label><span title="Сайт запоминает сам по заказам: «2 кор» → 6 кг значит 1 кор = 3 кг">Вес упаковки</span><input data-k="packs" value="${esc(packs)}" placeholder="кор = 3"></label>
    <label><span title="Печатается в УПД в колонке «Код товара». У КИГМ — коды из их спецификации">Код в УПД</span><input data-k="code" value="${esc(p.code)}"></label>
    <label><span>Страна</span><select data-k="country">${Object.entries(COUNTRIES).map(([k,v])=>`<option value="${k}"${k===p.country?" selected":""}>${v}</option>`).join("")}</select></label></div>
    <div class="nmart"><b>Артикул ${a?esc(a):"—"}</b><span>${a?"присвоен автоматически, не меняется":pdArtSrv()?"присвоится сам после сохранения в таблицу":"появится после обновления Code.gs"}${M.length>1?` · общий для ${M.length} ${plural(M.length,["названия","названий","названий"])}: ${M.filter(x=>x.id!==p.id).map(x=>"«"+esc(x.name)+"»").join(", ")}`:""}</span></div>
    <div class="nmacts"><button type="button" class="btn sm" data-pcard="${p.id}">${IC_PCARD}Карточка товара</button><button type="button" class="btn ghost sm" data-pdo="${p.id}">Свернуть</button><span style="flex:1"></span><button type="button" class="btn ghost danger sm" data-del>Удалить</button></div></div>`; }
const pdRow = p => `<div class="nmr${PDL.open===p.id?" open":""}" data-id="${p.id}" role="listitem"><button type="button" class="nmh" data-pdo="${p.id}" aria-expanded="${PDL.open===p.id}">${pdRowHead(p)}</button>${PDL.open===p.id?pdEditor(p):""}</div>`;
function renderProducts(){
  pdToolbar(); const L=pdSorted(pdFiltered()), box=$("#pd-body"); if(!box) return;
  const sel=$("#pd-sort"); if(sel){ if(!sel.options.length) sel.innerHTML=PD_SORT.map(([k,t])=>`<option value="${k}">${t}</option>`).join(""); sel.value=pdSortOf(); }
  const n=$("#pd-n"); if(n){ const arts=new Set(D.products.map(pArt).filter(Boolean)).size; n.textContent=L.length+" "+plural(L.length,["товар","товара","товаров"])+(L.length!==D.products.length?" из "+D.products.length:"")+(arts?" · "+arts+" "+plural(arts,["артикул","артикула","артикулов"]):""); }
  const show=L.slice(0, PDL.lim);
  box.innerHTML = L.length ? show.map(pdRow).join("") : `<div class="skempty"><b>Ничего не найдено</b><span>Поиск ищет по названию, артикулу и коду в УПД.</span></div>`;
  const more=$("#pd-more"); if(more) more.innerHTML = L.length>show.length ? `<span class="muted">Показано ${show.length} из ${L.length}</span><button type="button" class="btn ghost sm" data-pdmore="100">Ещё 100</button><button type="button" class="btn ghost sm" data-pdmore="all">Все</button>` : "";
  const xl=$("#pd-xls"); if(xl) xl.hidden=docLimited();
}
function pdRedrawRow(id){ const r=document.querySelector(`#pd-body .nmr[data-id="${CSS.escape(id)}"]`), p=prod(id); if(!r||!p) return null; r.outerHTML=pdRow(p); return document.querySelector(`#pd-body .nmr[data-id="${CSS.escape(id)}"]`); }
function pdToggle(id){ const was=PDL.open; PDL.open = was===id ? "" : id; if(was && was!==id) pdRedrawRow(was); const r=pdRedrawRow(id);
  if(r && PDL.open===id){ r.scrollIntoView({block:"nearest", behavior:"smooth"}); } else if(r){ const h=r.querySelector(".nmh"); h&&h.focus({preventScroll:true}); } }
const pdSet=e=>{ const k=e.target.dataset.k; if(!k) return; const row=e.target.closest(".nmr[data-id]"), p=row&&prod(row.dataset.id); if(!p) return;
  if(k==="packs"){ const o={}; String(e.target.value).split(/[;\n]/).forEach(x=>{ const m=x.match(/([а-яёa-z.]+)\s*[=:≈-]?\s*(\d+(?:[.,]\d+)?)/i); if(!m) return; const pk=parsePack("1 "+m[1]); const u=pk?pk.u:m[1].toLowerCase(); o[u]=+m[2].replace(",","."); }); p.packs=Object.keys(o).length?JSON.stringify(o):""; dirty("products",p.id); return; }
  if(k==="cat"){ delete p._ca; e.target.style.setProperty("--cc",(catById(e.target.value)||{}).color||"transparent"); }
  p[k]=k==="price"?num(e.target.value):e.target.value; dirty("products",p.id);
  if(k==="name" && p._ca){ const s=row.querySelector(".pdcat"); if(s && s.value!==p.cat){ s.value=p.cat; s.style.setProperty("--cc",(catOf(p)||{}).color||"transparent"); } }
  const h=row.querySelector(".nmh"); if(h) h.innerHTML=pdRowHead(p);   /* шапка строки сразу показывает новое название и цену */
  if(k==="cat") pdToolbar(); };
document.addEventListener("input", e=>{ if(e.target.closest && e.target.closest("#pd-body")) pdSet(e); });
document.addEventListener("change", e=>{ if(e.target.tagName==="SELECT" && e.target.closest && e.target.closest("#pd-body")) pdSet(e);
  if(e.target.id==="pd-sort"){ const p=getPrefs(); p.pdSort=e.target.value; setPrefs(p,true); PDL.lim=100; PDL.fresh=""; renderProducts(); } });
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest) return;
  if(t.closest("#pd-same")){ pgFind(); return; }
  if(t.closest("#pd-add")){ pdAdd(); return; }
  if(t.closest("#pd-xls")){ pdExport(); return; }
  const mo=t.closest("[data-pdmore]"); if(mo){ PDL.lim = mo.dataset.nmmore==="all" ? 1e9 : PDL.lim+100; renderProducts(); return; }
  if(!t.closest("#pd-body")) return;
  const pc=t.closest("[data-pcard]"); if(pc){ pdCard(pc.dataset.pcard); return; }
  const o=t.closest("[data-pdo]"); if(o){ pdToggle(o.dataset.pdo); return; }
  const b=t.closest("[data-del]"); if(!b) return;
  if(!b.dataset.armed){ b.dataset.armed=1; b.textContent="Точно удалить?"; b.classList.add("armed"); return; }
  const id=b.closest(".nmr").dataset.id, p=prod(id), M=pgMembers(id);
  if(M.length>1 && pgRoot(p)===id) pgMain(M.find(x=>x.id!==id).id);   /* удаляем основной товар группы — основным становится следующий, артикул группы переходит к нему */
  D.products=D.products.filter(x=>x.id!==id); Object.keys(D.prices).forEach(c=>{ if(id in D.prices[c]){ delete D.prices[c][id]; dirtyPrice(c,id); } });
  dirty("products",id,true); if(PDL.open===id) PDL.open=""; logEv("Товары","Удалён товар «"+((p||{}).name||"")+"»"); renderProducts(); toast("ok","Товар удалён","«"+((p||{}).name||"")+"». Отменить — кнопкой «Отменить» внизу.");
});
function pdAdd(){ const c=PDV.cat!=="all"&&PDV.cat!=="none"?PDV.cat:""; PDV.q=""; const q=$("#pd-q"); if(q) q.value=""; if(!c) PDV.cat="all";
  const p={id:uid(), name:"", code:"", unit:"кг", country:"", price:""}; if(c) p.cat=c; D.products.push(p); dirty("products",p.id);
  PDL.open=p.id; PDL.fresh=p.id; renderProducts(); const r=document.querySelector(`#pd-body .nmr[data-id="${p.id}"]`); if(r){ r.scrollIntoView({block:"center"}); const i=r.querySelector('input[data-k="name"]'); i&&i.focus(); } }
/* каталог в Excel: одна строка на артикул (связанные названия вместе), цена для сайта — наибольшая базовая цена группы */
async function pdExport(){ const b=$("#pd-xls"), t0=b?b.textContent:""; if(b){ b.disabled=true; b.textContent="Готовлю…"; }
  try{ const X=await loadXLSX(), G=new Map();
    D.products.filter(p=>p.name).forEach(p=>{ const r=pgRoot(p); if(!G.has(r)) G.set(r,[]); G.get(r).push(p); });
    const rows=[...G.entries()].map(([r,M])=>{ const m=prod(r)||M[0], ps=M.map(x=>+x.price).filter(v=>v>0);
      return {"Артикул":pArt(m), "Название":m.name, "Другие названия":M.filter(x=>x.id!==m.id).map(x=>x.name).join("; "), "Категория":(catOf(m)||{}).name||"", "Ед.":m.unit||"", "Цена для сайта, ₽":ps.length?Math.max(...ps):"", "Страна":m.country&&COUNTRIES[m.country]?COUNTRIES[m.country]:""}; })
      .sort((a,b)=>(+a["Артикул"]||1e9)-(+b["Артикул"]||1e9)||String(a["Название"]).localeCompare(String(b["Название"]),"ru"));
    const ws=X.utils.json_to_sheet(rows); ws["!cols"]=[{wch:9},{wch:40},{wch:40},{wch:22},{wch:6},{wch:16},{wch:14}];
    const wb=X.utils.book_new(); X.utils.book_append_sheet(wb,ws,"Каталог"); X.writeFile(wb,"Каталог товаров ФД "+fd(todayISO())+".xlsx");
    toast("ok","Каталог скачан",rows.length+" "+plural(rows.length,["артикул","артикула","артикулов"])+". Цена — наибольшая базовая цена среди связанных названий."); }
  catch(er){ toast("err","Не получилось скачать каталог", er.message); }
  finally{ if(b){ b.disabled=false; b.textContent=t0; } } }
/* таблица присвоила артикулы — обновляем шапки строк, где он изменился (поле, в котором печатают, не трогаем) */
function pdAfterSync(){ document.querySelectorAll("#pd-body .nmr[data-id]").forEach(r=>{ const p=prod(r.dataset.id); if(!p) return; const c=r.querySelector(".nma"), a=pArt(p);
  if(c && c.textContent.trim()!==(a||c.textContent.trim())){ r.querySelector(".nmh").innerHTML=pdRowHead(p); const ab=r.querySelector(".nmart b"); if(ab){ ab.textContent="Артикул "+a; const sp=ab.nextElementSibling; if(sp && /присвоится/.test(sp.textContent)) sp.textContent=sp.textContent.replace(/присвоится сам после сохранения в таблицу/,"присвоен автоматически, не меняется"); } } }); }
