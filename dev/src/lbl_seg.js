/* ================= наклейки на коробки (просьба Даниила, 18.11.2026) =================
   Сейчас только цирк (LBL_INN). Наклейка 55,4 × 40 мм — как в BarTender (принтер Xprinter XP-365B), одна наклейка на коробку.
   Окно lblOpen(документы): дата фасовки, по каждой строке «по N кг в коробке» → число наклеек, данные товара для наклейки, образец, печать одним заданием.
   Данные товара — поле товара lbl = JSON {n: название на наклейке, m: изготовитель, t: условия хранения, d: срок годности, b: кг в коробке, p: партия}
   (колонка «Данные для наклейки» в конце листа «Товары», Code.gs ≥ 46; со старым скриптом — только на этом устройстве, frudom-lbl-p).
   Импортёр и упаковщик — из карточек поставщиков (импортёр — Скобёлкин, упаковщик — ИП накладной), свои тексты — в личных настройках prefs.lbl. */
const LBL_INN=["7736039722"];   /* ГУП «Большой Московский цирк» */
const lblOn = cid => LBL_INN.includes(String((cus(cid)||{}).inn||"").trim());
const lblSrv = () => (D.srvVer||0)>=46;
const LBL_LS="frudom-lbl-p", LBL_T0="от +2 до +8 °С", LBL_D0="7 дней";
function lblLocal(){ try{ return JSON.parse(localStorage.getItem(LBL_LS)||"{}")||{}; }catch(e){ return {}; } }
function lblOf(p){ let o={}; try{ o=JSON.parse((p&&p.lbl)||"{}")||{}; }catch(e){} const l=lblLocal()[(p||{}).id]; if(l && (!lblSrv() || !p.lbl)) o=Object.assign({}, o, l); return o; }
function lblSave(p, o){ Object.keys(o).forEach(k=>{ if(o[k]==="" || o[k]==null) delete o[k]; }); const s=JSON.stringify(o);
  if(lblSrv()){ if((p.lbl||"{}")!==s){ p.lbl=s; dirty("products", p.id); saveLocal(); } const L=lblLocal(); if(L[p.id]){ delete L[p.id]; lsSet(LBL_LS, JSON.stringify(L)); } }
  else { const L=lblLocal(); L[p.id]=o; lsSet(LBL_LS, JSON.stringify(L)); } }
const lblBox = p => { const o=lblOf(p), k=packsOf(p); return +o.b>0 ? +o.b : +k["кор"]>0 ? +k["кор"] : +k["ящ"]>0 ? +k["ящ"] : 10; };
const lblFio = s => { const n=String((s&&(s.fio||s.name))||"").replace(/^\s*ИП\s+/i,"").trim().split(/\s+/); return n[0] ? n[0]+(n[1]?" "+n[1][0]+".":"")+(n[2]?n[2][0]+".":"") : ""; };
function lblCfg(){ return Object.assign({imp:"", pk:{}}, getPrefs().lbl||{}); }
function lblImpSup(){ return D.suppliers.find(s=>/скоб[её]лкин/i.test(s.name||"")) || null; }
function lblImpTxt(){ const c=lblCfg(); if(c.imp) return c.imp; const s=lblImpSup(); return s ? lblFio(s)+(s.address?" Адрес "+s.address:"") : ""; }
function lblPkTxt(s){ const c=lblCfg(), id=(s&&s.id)||""; if(id && c.pk[id]) return c.pk[id]; if(!s) return "";
  return [s.ogrn?"ОГРНИП "+s.ogrn:"", s.name||"", s.address||""].filter(Boolean).join(" "); }
/* строки наклеек по документам: одна строка = позиция накладной */
function lblRows(L){ const R=[];
  L.forEach(j=>(j.snap.dr.lines||[]).forEach((l,i)=>{ if(!l.productId || !(+l.qty>0)) return; const p=prod(l.productId); if(!p||!p.id) return;
    R.push({k:j.id+":"+i, j, p, q:+l.qty, u:p.unit||l.unit||"кг"}); }));
  return R; }
const lblKg = u => /^кг$/i.test(String(u||"").trim());
/* массы наклеек строки: коробки по b кг, последняя — остаток; число наклеек можно задать руками (st.n) */
function lblMasses(r, st){ if(!lblKg(r.u)) { const n=st.n!=null?st.n:1; return Array(n).fill(null); }
  const b=+st.b>0?+st.b:lblBox(r.p), auto=Math.max(1, Math.ceil(r3(r.q/b))), n=st.n!=null?st.n:auto; if(!n) return [];
  if(n===auto){ const out=Array(n-1).fill(b); out.push(r3(r.q-b*(n-1))); return out; }
  const each=r3(r.q/n); return Array(n).fill(each); }
const lblDateTxt = iso => fd(iso)+"г";
const lblBatch = (o, iso) => o.p || (iso ? iso.slice(8,10)+iso.slice(5,7)+iso.slice(2,4) : "");
const LBL_EAC=`<svg class="eac" viewBox="0 0 31 20" aria-label="EAC"><g fill="#000"><rect x="0" y="0" width="2.4" height="20"/><rect x="0" y="0" width="7.6" height="2.4"/><rect x="0" y="8.8" width="6.8" height="2.4"/><rect x="0" y="17.6" width="7.6" height="2.4"/><rect x="11" y="0" width="2.4" height="20"/><rect x="17.2" y="0" width="2.4" height="20"/><rect x="11" y="0" width="8.6" height="2.4"/><rect x="11" y="8.8" width="8.6" height="2.4"/><rect x="23.2" y="0" width="2.4" height="20"/><rect x="23.2" y="0" width="7.6" height="2.4"/><rect x="23.2" y="17.6" width="7.6" height="2.4"/></g></svg>`;
/* текст одной наклейки */
/* наклейка, загруженная из BarTender (lbl.x — строки как в файле): подставляем только дату фасовки и массу */
function lblTpl(r, mass, iso, o){ const mt = mass==null ? "Количество "+qtxt(r.q)+" "+r.u : "Масса нетто "+qtxt(mass)+"кг"; let hasM=false, hasD=false;
  const L=o.x.map((t,i)=>{ let x=String(t);
    if(/дата\s*фасовки/i.test(x)){ hasD=true; x = /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(x) ? x.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/, fd(iso)) : x.replace(/(дата\s*фасовки\s*:?\s*)/i, "$1"+lblDateTxt(iso)+" "); }
    if(/масса\s*нетто/i.test(x)){ hasM=true; x=x.replace(/масса\s*нетто\s*:?\s*[\d.,]*\s*(кг|г|шт)?\.?/i, mt); }
    return [i?"":"b", x.trim()]; });
  if(!hasD) L.push(["", "Дата фасовки : "+lblDateTxt(iso)]); if(!hasM) L.push(["", mt]);
  return L; }
function lblLines(r, mass, iso){ const o=lblOf(r.p); if(Array.isArray(o.x) && o.x.length) return lblTpl(r, mass, iso, o); const ctry=COUNTRIES[r.p.country]||"", imp=!/^росс/i.test(ctry), s=r.j.snap.s||{};
  const mtxt = mass==null ? "Количество "+qtxt(r.q)+" "+r.u : "Масса нетто "+qtxt(mass)+"кг";
  return [ ["b", o.n||r.p.name],
    ctry ? ["", "Страна происхождения "+ctry] : null,
    o.m ? ["", "Изготовитель "+o.m] : null,
    imp && lblImpTxt() ? ["", "Импортер "+lblImpTxt()] : null,
    ["", "Упаковщик (фасовщик): "+lblPkTxt(s)],
    ["", "Условия хранения при темп. "+(o.t||LBL_T0)],
    ["", "Дата фасовки : "+lblDateTxt(iso)+" "+mtxt],
    ["", "Партия: "+lblBatch(o, iso)],
    ["", "Срок годности "+(o.d||LBL_D0)+" с даты фасовки."] ].filter(Boolean); }
function lblHtml(r, mass, iso){ return `<div class="lb"><div class="lbi">${LBL_EAC}${lblLines(r, mass, iso).map(([c,t])=>`<p${c?' class="t"':""}>${esc(t)}</p>`).join("")}</div></div>`; }
const LBL_CSS=`.lb{width:55.4mm;height:40mm;box-sizing:border-box;padding:1.2mm 1.6mm;overflow:hidden;position:relative;background:#fff;color:#000;font-family:Calibri,"Segoe UI","Golos Text",Arial,sans-serif;font-weight:700}
.lb .lbi{height:100%;overflow:hidden}.lb p{margin:0;font-size:var(--fs,7pt);line-height:calc(var(--fs,7pt) * 1.16);overflow-wrap:anywhere}.lb p.t{font-size:calc(var(--fs,7pt) * 1.12);line-height:calc(var(--fs,7pt) * 1.3);padding-right:9mm}
.lb .eac{position:absolute;right:2.4mm;top:1.3mm;width:7.5mm;height:4.8mm}`;
/* подгоняем размер шрифта, чтобы текст влез в наклейку */
function lblFit(root){ root.querySelectorAll(".lbi").forEach(b=>{ let fs=7.6; b.style.setProperty("--fs", fs+"pt"); while(b.scrollHeight>b.clientHeight+0.5 && fs>4){ fs=Math.round((fs-0.2)*10)/10; b.style.setProperty("--fs", fs+"pt"); } }); }
let LBX=null;
function lblOpen(L, back){ L=L.filter(j=>j&&j.snap); if(!L.length) return;
  LBX={L, iso:todayISO(), st:{}, open:"", sel:"", back:back||null}; lblDraw(true); }
function lblAll(){ const R=lblRows(LBX.L), out=[]; R.forEach(r=>{ const st=LBX.st[r.k]||{}; lblMasses(r, st).forEach(m=>out.push([r,m])); }); return out; }
function lblWarn(r){ const o=lblOf(r.p), w=[]; if(Array.isArray(o.x)&&o.x.length) return w; if(!o.m) w.push("нет изготовителя"); if(!COUNTRIES[r.p.country]||r.p.country==="") w.push("нет страны"); if(!o.d) w.push("срок годности — по умолчанию 7 дней"); return w; }
function lblDraw(first){ const R=lblRows(LBX.L), all=lblAll(), j0=LBX.L[0], c=j0.snap.c||{}, many=LBX.L.length>1;
  if(!LBX.sel && R[0]) LBX.sel=R[0].k; const sel=R.find(r=>r.k===LBX.sel)||R[0];
  const head = many ? `Наклейки · ${LBX.L.length} накладных` : `Наклейки · Документ № ${esc(j0.number)} · ${fd(j0.date)}`;
  const row = r => { const st=LBX.st[r.k]||{}, M=lblMasses(r, st), w=lblWarn(r), o=lblOf(r.p), kg=lblKg(r.u), b=+st.b>0?+st.b:lblBox(r.p), open=LBX.open===r.k;
    return `<div class="lbr${LBX.sel===r.k?" on":""}${M.length?"":" off"}" data-lbsel="${esc(r.k)}">
      <div class="lbr-n"><b>${esc(lblTitle(r.p))}</b><small>${qtxt(r.q)} ${esc(r.u)}${many?" · № "+esc(r.j.number):""}${w.length?` · <span class="lbw">${esc(w[0])}</span>`:""}</small></div>
      <div class="lbr-c">${kg?`<label>по <input class="lbb" data-lbb="${esc(r.k)}" inputmode="decimal" value="${qtxt(b)}"> кг</label>`:""}
        <label class="lbcnt"><input class="lbn" data-lbn="${esc(r.k)}" inputmode="numeric" value="${M.length}"> накл.</label>
        <button type="button" class="btn ghost sm" data-lbk="data" data-k="${esc(r.k)}" aria-expanded="${open}">Данные</button></div>
      ${open?lblForm(r):""}</div>`; };
  const prev = sel ? lblHtml(sel, lblMasses(sel, LBX.st[sel.k]||{})[0]??(lblKg(sel.u)?lblBox(sel.p):null), LBX.iso) : "";
  CARD_RE=()=>{ LBX.open=""; lblDraw(); };
  openCard(`<div class="dc-head"><div><div class="dc-kicker">${head}</div><h3>${esc(cusNm(c.id)||c.name||"")}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="lbtop"><label class="f">Дата фасовки<input type="date" id="lb-date" value="${LBX.iso}"></label><button type="button" class="btn sm lbupb" data-lbk="up" title="Готовые наклейки из программы BarTender — можно выбрать сразу все файлы">Загрузить наклейки из BarTender</button><input type="file" id="lb-up" accept=".btw" multiple hidden><div class="lbsum"><span><b>${all.length}</b> ${plural(all.length,["наклейка","наклейки","наклеек"])}</span><small>одна на коробку · 55,4 × 40 мм</small></div></div>
    ${lblUpHtml(c.id)}
    <div class="lbwrap"><div class="lblist">${R.map(row).join("")||`<p class="muted">В накладной нет товаров.</p>`}</div>
      <div class="lbprev"><small>Образец наклейки${sel?" — «"+esc(lblTitle(sel.p))+"»":""}</small><div class="lbpv">${prev}</div><small class="muted">При печати выберите принтер Xprinter, поля — «Нет», масштаб — 100%.</small></div></div>
    <details class="lbset"><summary>Импортёр и упаковщик</summary>
      <label class="f">Импортер (для товаров не из России)<textarea id="lb-imp" rows="2">${esc(lblImpTxt())}</textarea></label>
      <label class="f">Упаковщик (фасовщик) — ${esc((j0.snap.s||{}).name||"")}<textarea id="lb-pk" rows="2">${esc(lblPkTxt(j0.snap.s))}</textarea></label>
      <div class="lbsa"><button type="button" class="btn sm" data-lbk="cfg">Сохранить</button><button type="button" class="btn ghost sm" data-lbk="cfg0">Как в карточках поставщиков</button></div></details>
    ${lblSrv()?"":`<p class="muted lbold">Скрипт таблицы старый — данные товаров для наклеек сохраняются только на этом устройстве. Обновите Code.gs, чтобы они были у всех.</p>`}
    <div class="dc-acts"><button class="btn" data-lbk="test"${all.length?"":" disabled"}>Пробная — 1 наклейка</button><button class="btn pri" data-lbk="print"${all.length?"":" disabled"}>Печать · ${all.length}</button></div>`, "lbl", a=>{});
  const d=document.getElementById("fd-dcard"); if(!d) return; d.classList.add("lbwin");
  if(!document.getElementById("lbl-css")){ const st=document.createElement("style"); st.id="lbl-css"; st.textContent=LBL_CSS.replace(/(^|\})\s*\.lb/g,"$1 #fd-dcard .lb"); document.head.appendChild(st); }
  const pv=d.querySelector(".lbpv"); if(pv) lblFit(pv);
  if(first) logEvSoft("Печать","Открыты наклейки: "+LBX.L.map(j=>"№ "+j.number).join(", "), "lbl:"+LBX.L.map(j=>j.id).join(","), 600000);
}
function lblForm(r){ const o=lblOf(r.p), cc=Object.entries(COUNTRIES).filter(([k])=>k);
  if(Array.isArray(o.x) && o.x.length) return `<div class="lbf" data-lbf="${esc(r.k)}">
    <label class="f lbfw">Текст наклейки${o.f?" — из «"+esc(o.f)+"»":""}<textarea data-lf="x" rows="${Math.min(12, o.x.length+1)}">${esc(o.x.join("\n"))}</textarea></label>
    <small class="muted lbfw">Каждая строка — строка наклейки. Дату фасовки и массу сайт подставит сам.</small>
    ${lblKg(r.u)?`<label class="f">Кг в коробке (обычно)<input data-lf="b" inputmode="decimal" value="${esc(o.b||"")}" placeholder="${qtxt(lblBox(r.p))}"></label>`:""}
    <div class="lbsa"><button type="button" class="btn pri sm" data-lbk="save" data-k="${esc(r.k)}">Сохранить для товара</button><button type="button" class="btn ghost sm" data-lbk="untpl" data-k="${esc(r.k)}">Не использовать — собрать из полей</button><button type="button" class="btn ghost sm" data-lbk="data" data-k="${esc(r.k)}">Свернуть</button></div></div>`;
  return `<div class="lbf" data-lbf="${esc(r.k)}">
    <label class="f">Название на наклейке<input data-lf="n" value="${esc(o.n||r.p.name)}"></label>
    <label class="f">Страна происхождения<select data-lf="country" data-native><option value="">—</option>${cc.map(([k,v])=>`<option value="${k}"${r.p.country===k?" selected":""}>${esc(v)}</option>`).join("")}</select></label>
    <label class="f lbfw">Изготовитель<input data-lf="m" value="${esc(o.m||"")}" placeholder="как в декларации"></label>
    <label class="f">Условия хранения<input data-lf="t" value="${esc(o.t||LBL_T0)}"></label>
    <label class="f">Срок годности<input data-lf="d" value="${esc(o.d||LBL_D0)}" placeholder="7 дней"></label>
    <label class="f">Партия<input data-lf="p" value="${esc(o.p||"")}" placeholder="пусто — по дате фасовки"></label>
    ${lblKg(r.u)?`<label class="f">Кг в коробке (обычно)<input data-lf="b" inputmode="decimal" value="${esc(o.b||"")}" placeholder="${qtxt(lblBox(r.p))}"></label>`:""}
    <div class="lbsa"><button type="button" class="btn pri sm" data-lbk="save" data-k="${esc(r.k)}">Сохранить для товара</button><button type="button" class="btn ghost sm" data-lbk="data" data-k="${esc(r.k)}">Свернуть</button></div></div>`; }
async function lblPrint(test){ const all=lblAll(); if(!all.length) return; const L=test?all.slice(0,1):all;
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Наклейки</title><style>@page{size:55.4mm 40mm;margin:0}html,body{margin:0;padding:0;background:#fff}
    ${LBL_CSS} .lb{break-after:page;page-break-after:always}.lb:last-child{break-after:auto;page-break-after:auto}</style></head><body>${L.map(([r,m])=>lblHtml(r,m,LBX.iso)).join("")}</body></html>`;
  const f=document.createElement("iframe"); f.setAttribute("aria-hidden","true"); f.style.cssText="position:fixed;left:-4000px;top:0;width:400px;height:800px;border:0;visibility:hidden";
  document.body.appendChild(f); const d=f.contentWindow.document; d.open(); d.write(html); d.close();
  try{ await (d.fonts&&d.fonts.ready); }catch(e){}
  lblFit(d); window.__lblLast=d.body.innerHTML;
  logEvSoft("Печать",(test?"Пробная наклейка":"Напечатано наклеек: "+L.length)+" — "+LBX.L.map(j=>"№ "+j.number).join(", "));
  f.contentWindow.focus(); f.contentWindow.print(); setTimeout(()=>f.remove(), 60000); }
document.addEventListener("click", e=>{ const d=e.target.closest&&e.target.closest("#fd-dcard.lbwin"); if(!d||!LBX) return;
  const b=e.target.closest("[data-lbk]");
  if(b){ const a=b.dataset.lbk, k=b.dataset.k;
    if(a==="data"){ LBX.open = LBX.open===k ? "" : k; if(k) LBX.sel=k; lblDraw(); return; }
    if(a==="save"){ const r=lblRows(LBX.L).find(x=>x.k===k), f=d.querySelector(`[data-lbf="${CSS.escape(k)}"]`); if(!r||!f) return; const o=lblOf(r.p), v=n=>{ const el=f.querySelector(`[data-lf="${n}"]`); return el?el.value.trim():""; };
      if(f.querySelector('[data-lf="x"]')){ o.x=v("x").split(/\n/).map(x=>x.trim()).filter(Boolean); const bb=String(v("b")).replace(",","."); o.b=+bb>0?bb:""; if(!o.x.length){ delete o.x; delete o.f; }
        lblSave(r.p, o); delete (LBX.st[k]||{}).b; LBX.open=""; lblDraw(); toast("ok","Сохранено","Наклейка «"+r.p.name+"»"); return; }
      Object.assign(o, {n: v("n")===r.p.name?"":v("n"), m:v("m"), t:v("t")===LBL_T0?"":v("t"), d:v("d")===LBL_D0?"":v("d"), p:v("p"), b:+String(v("b")).replace(",",".")>0?String(v("b")).replace(",","."):""});
      const ct=v("country"); if(ct!==(r.p.country||"")){ r.p.country=ct; dirty("products", r.p.id); saveLocal(); }
      lblSave(r.p, o); delete (LBX.st[k]||{}).b; LBX.open=""; lblDraw(); toast("ok","Сохранено","Данные наклейки для «"+r.p.name+"»"+(lblSrv()?"":" — только на этом устройстве")); return; }
    if(a==="cfg"||a==="cfg0"){ const p=getPrefs(), c=lblCfg(), sid=(LBX.L[0].snap.s||{}).id||"";
      if(a==="cfg"){ c.imp=d.querySelector("#lb-imp").value.trim(); const pk=d.querySelector("#lb-pk").value.trim(); if(sid) c.pk[sid]=pk; } else { c.imp=""; if(sid) delete c.pk[sid]; }
      p.lbl=c; setPrefs(p, true); lblDraw(); toast("ok", a==="cfg"?"Сохранено":"Как в карточках поставщиков"); return; }
    if(a==="untpl"){ const r=lblRows(LBX.L).find(x=>x.k===k); if(!r) return; if(!armed(b,"Точно? Текст из BarTender удалится")) return; const o=lblOf(r.p); delete o.x; delete o.f; lblSave(r.p, o); lblDraw(); return; }
    if(a==="up"){ d.querySelector("#lb-up").click(); return; }
    if(a==="upsave"){ lblUpSave(); return; }
    if(a==="upoff"){ LBX.up=null; lblDraw(); return; }
    if(a==="test"||a==="print"){ lblPrint(a==="test"); return; }
    return; }
  const s=e.target.closest("[data-lbsel]"); if(s && !e.target.closest("input,button,select,textarea,label,.lbf") && LBX.sel!==s.dataset.lbsel){ LBX.sel=s.dataset.lbsel; lblDraw(); }
});
document.addEventListener("change", e=>{ const d=e.target.closest&&e.target.closest("#fd-dcard.lbwin"); if(!d||!LBX) return; const t=e.target;
  if(t.id==="lb-up"){ const F=[...t.files]; t.value=""; if(F.length) lblUpLoad(F); return; }
  if(t.dataset.lbup!=null){ const u=(LBX.up||[])[+t.dataset.lbup]; if(u) u.pid=t.value; lblDraw(); return; }
  if(t.id==="lb-date"){ if(t.value) LBX.iso=t.value; lblDraw(); return; }
  if(t.dataset.lbb!=null){ const v=+String(t.value).replace(",",".").replace(/\s/g,""), st=LBX.st[t.dataset.lbb]=LBX.st[t.dataset.lbb]||{}; if(v>0){ st.b=v; delete st.n; } LBX.sel=t.dataset.lbb; lblDraw(); return; }
  if(t.dataset.lbn!=null){ const v=Math.max(0, Math.min(999, Math.round(+t.value||0))), st=LBX.st[t.dataset.lbn]=LBX.st[t.dataset.lbn]||{}; st.n=v; LBX.sel=t.dataset.lbn; lblDraw(); return; }
});
/* ---- загрузка готовых наклеек из BarTender (.btw) ----
   В файле .btw текст наклейки лежит в сжатом блоке (deflate) строкой UTF-16. Ищем сжатые блоки, распаковываем, берём кусок текста
   с «Дата фасовки» / «Страна происхождения» / «Срок годности», режем на строки (перенос строки или 5+ пробелов подряд). */
const lblTitle = p => { const o=lblOf(p); return Array.isArray(o.x)&&o.x[0] ? o.x[0] : (o.n||p.name); };
async function lblInflate(u8){ try{ const ds=new DecompressionStream("deflate"), w=ds.writable.getWriter(); w.write(u8).catch(()=>{}); w.close().catch(()=>{});
    const rd=ds.readable.getReader(), parts=[]; let n=0;
    for(;;){ let x; try{ x=await rd.read(); }catch(e){ break; } if(x.done) break; parts.push(x.value); n+=x.value.length; if(n>8e6) break; }
    if(!n) return null; const out=new Uint8Array(n); let o=0; parts.forEach(p=>{ out.set(p,o); o+=p.length; }); return out; }catch(e){ return null; } }
const LBL_RX=/[\u0400-\u04FFA-Za-z0-9 \r\n\t.,:;°%+\-–—()«»"'\/№!?&*×_]{24,}/g, LBL_KEY=/дата\s*фасовки|страна\s*происхождения|срок\s*годности|масса\s*нетто/i;
function lblFindTxt(t){ let best=""; (t.match(LBL_RX)||[]).forEach(m=>{ if(LBL_KEY.test(m) && m.length>best.length) best=m; }); return best; }
async function lblBtwLines(file){ const u8=new Uint8Array(await file.arrayBuffer()); let tries=0;
  for(let i=0;i<u8.length-2 && tries<60;i++){ if(u8[i]!==0x78 || ![0x01,0x5e,0x9c,0xda].includes(u8[i+1])) continue; tries++;
    const out=await lblInflate(u8.subarray(i)); if(!out || out.length<60) continue;
    const t=lblFindTxt(new TextDecoder("utf-16le").decode(out)) || lblFindTxt(new TextDecoder("utf-8").decode(out));
    if(t) return t.split(/\r\n?|\n/).flatMap(x=>x.split(/ {5,}|\t+/)).map(x=>x.trim().replace(/ {3,4}/g,"\u2003").replace(/ {2,}/g," ")).filter(Boolean); }
  return null; }
function lblParse(L){ const g=rx=>{ for(const x of L){ const m=x.match(rx); if(m) return m[1].trim(); } return ""; };
  const kg=g(/масса\s*нетто\s*:?\s*([\d.,]+)\s*кг/i);
  return { m:g(/изготовитель\s*:?\s*(.+)/i), t:g(/услови\S*\s+хран\S*\s+при\s+темп\S*\s*(.+)/i), d:g(/срок\s+годности\s*:?\s*(.+?)\s*с\s+даты/i), p:g(/партия\s*:?\s*(\S+)/i),
    b: +kg.replace(",",".")>0 ? kg.replace(",",".") : "", ctry:g(/страна\s+происхождения\s*:?\s*(.+)/i) }; }
const lblStem = s => String(s||"").toLowerCase().replace(/ё/g,"е").replace(/\.btw$/i,"").split(/[^а-яa-z0-9]+/).filter(w=>w.length>2).map(w=>w.slice(0,5));
function lblGuess(name, first, cid){ const A=new Set([...lblStem(name), ...lblStem(first)]); if(!A.size) return "";
  const pr=(D.prices||{})[cid]||{}; let best="", bs=0;
  D.products.forEach(p=>{ const B=lblStem(p.name); if(!B.length) return; const c=B.filter(w=>A.has(w)).length; let sc=c/Math.max(B.length, 1); if(pr[p.id]!=null && pr[p.id]!=="") sc+=0.25; if(c && sc>bs){ bs=sc; best=p.id; } });
  return bs>=0.6 ? best : ""; }
async function lblUpLoad(F){ const cid=(LBX.L[0].snap.dr||{}).customerId||""; const t=toast("info","Читаю наклейки…","", {sticky:true}); const up=[];
  try{ for(const f of F){ if(!/\.btw$/i.test(f.name)){ up.push({f:f.name, err:"не файл BarTender (.btw)"}); continue; }
      const L=await lblBtwLines(f); if(!L||!L.length){ up.push({f:f.name, err:"не нашёл текст наклейки"}); continue; }
      up.push({f:f.name, x:L, o:lblParse(L), pid:lblGuess(f.name, L[0], cid)}); } }
  finally{ typeof t==="function"&&t(); }
  LBX.up=up; lblDraw(); }
function lblUpHtml(cid){ const U=LBX.up; if(!U) return ""; const pr=(D.prices||{})[cid]||{}, mine=D.products.filter(p=>pr[p.id]!=null&&pr[p.id]!=="").sort((a,b)=>a.name.localeCompare(b.name,"ru")), rest=D.products.filter(p=>!(pr[p.id]!=null&&pr[p.id]!=="")).sort((a,b)=>a.name.localeCompare(b.name,"ru"));
  const sel=(u,i)=>`<select data-lbup="${i}" data-native aria-label="Какой это товар на сайте"><option value="">— не сохранять —</option><optgroup label="В прайсе заказчика">${mine.map(p=>`<option value="${p.id}"${u.pid===p.id?" selected":""}>${esc(p.name)}</option>`).join("")}</optgroup><optgroup label="Остальные товары">${rest.map(p=>`<option value="${p.id}"${u.pid===p.id?" selected":""}>${esc(p.name)}</option>`).join("")}</optgroup></select>`;
  const ok=U.filter(u=>u.x&&u.pid).length;
  return `<div class="lbup"><div class="lbuph"><b>Наклейки из BarTender · ${U.length}</b><small>Проверьте, к какому товару относится каждая. Текст наклейки сохранится у товара — дату фасовки и массу сайт будет подставлять сам.</small></div>
    ${U.map((u,i)=>u.x?`<div class="lbu${u.pid?"":" no"}"><div class="lbu-n"><small>${esc(u.f)}</small><b>${esc(u.x[0])}</b><span>${esc(u.x.slice(1,3).join(" · "))}</span></div>${sel(u,i)}</div>`:`<div class="lbu no"><div class="lbu-n"><small>${esc(u.f)}</small><span class="lbw">${esc(u.err)}</span></div></div>`).join("")}
    <div class="lbsa"><button type="button" class="btn pri sm" data-lbk="upsave"${ok?"":" disabled"}>Сохранить для товаров · ${ok}</button><button type="button" class="btn ghost sm" data-lbk="upoff">Отмена</button></div></div>`; }
function lblUpSave(){ const U=(LBX.up||[]).filter(u=>u.x&&u.pid); let n=0;
  U.forEach(u=>{ const p=prod(u.pid); if(!p||!p.id) return; const o=lblOf(p), q=u.o||{};
    Object.assign(o, {x:u.x, f:u.f}); ["m","t","d","p"].forEach(k=>{ if(q[k]) o[k]=q[k]; }); if(q.b && !(+o.b>0)) o.b=q.b;
    if(q.ctry && !p.country){ const c=Object.entries(COUNTRIES).find(([k,v])=>k && v.toLowerCase()===q.ctry.toLowerCase()); if(c){ p.country=c[0]; dirty("products", p.id); } }
    lblSave(p, o); n++; });
  saveLocal(); LBX.up=null; LBX.st={}; lblDraw(); toast("ok","Наклейки сохранены", n+" "+plural(n,["товар","товара","товаров"])+(lblSrv()?"":" — только на этом устройстве"));
  logEvSoft("Справочники","Загружены наклейки из BarTender: "+n); }
window.__lbl={ up:(f)=>lblUpLoad(f), lines:(f)=>lblBtwLines(f), open:(ids)=>lblOpen(D.journal.filter(j=>ids.includes(j.id))), all:()=>lblAll().map(([r,m])=>[r.p.name,m]), last:()=>window.__lblLast||"" };
