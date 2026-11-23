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
    if(/\{дата\}/i.test(x)){ hasD=true; x=x.replace(/\{дата\}/gi, lblDateTxt(iso)); }
    if(/\{масса\}/i.test(x)){ hasM=true; x=x.replace(/\{масса\}/gi, mt); }
    if(/\{партия\}/i.test(x)) x=x.replace(/\{партия\}/gi, lblBatch(o, iso));
    if(/^\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*г?\.?\s*$/i.test(x) || /дата\s*(производства|изготовления)/i.test(x) && /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(x)){ hasD=true; x=x.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/, fd(iso)); }
    else if(/дата\s*(производства|изготовления)\s*:?\s*$/i.test(x) && /^\s*\d{1,2}\.\d{1,2}\.\d{2,4}/.test(String(o.x[i+1]||""))) hasD=true;
    else if(/дата\s*фасовки/i.test(x)){ hasD=true; x = /\d{1,2}\.\d{1,2}\.\d{2,4}/.test(x) ? x.replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/, fd(iso)) : x.replace(/(дата\s*фасовки\s*:?\s*)/i, "$1"+lblDateTxt(iso)+" "); }
    if(/масса\s*нетто/i.test(x)){ hasM=true; x=x.replace(/масса\s*нетто\s*:?\s*[\d.,]*\s*(кг|г|шт)?\.?/i, mt); }
    return [i?"":"b", x.trim(), (o.xs||[])[i]||lblSt0(i)]; });
  if(!hasD) L.push(["", "Дата фасовки : "+lblDateTxt(iso), lblSt0(1)]); if(!hasM) L.push(["", mt, lblSt0(1)]);
  return L; }
/* настройки принтера — на этом устройстве (принтер стоит у компьютера): размер наклейки, поворот, сдвиг */
const LBL_PRN="frudom-lblprn";
function lblPrnSet(){ try{ return !!localStorage.getItem(LBL_PRN); }catch(e){ return false; } }
function lblPrn(){ let o={}; try{ o=JSON.parse(localStorage.getItem(LBL_PRN)||"{}")||{}; }catch(e){}
  const n=(v,d,a,b)=>{ v=+v; return isFinite(v)&&v>=a&&v<=b ? Math.round(v*10)/10 : d; };
  return {w:n(o.w,55.4,20,120), h:n(o.h,40,15,120), r:[90,-90].includes(+o.r)?+o.r:0, dx:n(o.dx,0,-10,10), dy:n(o.dy,0,-10,10)}; }
function lblPrnSave(o){ try{ localStorage.setItem(LBL_PRN, JSON.stringify(o)); }catch(e){} }
const lblMm = v => String(v).replace(".",",");
function lblPrnHtml(){ const P=lblPrn(), op=!!LBX.pr, rl={0:"ровно","90":"повёрнуто ↻","-90":"повёрнуто ↺"}[P.r];
  const ori=(r,t,sub)=>`<button type="button" class="lbo" data-lbk="pr:r" data-r="${r}" aria-pressed="${P.r===r}"><i class="lboi${r?" r"+(r>0?"p":"m"):""}"><b>Аа</b></i><span>${t}<small>${sub}</small></span></button>`;
  const sh=(k,t)=>`<button type="button" class="btn ghost sm lbsh" data-lbk="pr:${k}" aria-label="${t}">${t}</button>`;
  return `<details class="lbset lbprn"${op?" open":""}><summary>Настройки принтера <small>${lblMm(P.w)} × ${lblMm(P.h)} мм · ${rl}${P.dx||P.dy?" · сдвиг":""}</small></summary>
    <p class="lbph">Наклейка вышла боком или на две наклейки — выберите «Повернуть» и снова нажмите «Пробная». Настройки запоминаются на этом компьютере.</p>
    <div class="lbos">${ori(0,"Ровно","как в BarTender")}${ori(90,"Повернуть ↻","на 90° вправо")}${ori(-90,"Повернуть ↺","на 90° влево")}</div>
    <div class="lbpg"><label class="f">Ширина наклейки, мм<input id="lb-pw" inputmode="decimal" value="${lblMm(P.w)}"></label><label class="f">Высота, мм<input id="lb-ph" inputmode="decimal" value="${lblMm(P.h)}"></label>
      <div class="lbshw"><span>Сдвинуть текст${P.dx||P.dy?` <b>${P.dx?(P.dx>0?"вправо ":"влево ")+lblMm(Math.abs(P.dx)):""}${P.dx&&P.dy?", ":""}${P.dy?(P.dy>0?"вниз ":"вверх ")+lblMm(Math.abs(P.dy)):""} мм</b>`:""}</span><div>${sh("x-","←")}${sh("y-","↑")}${sh("y+","↓")}${sh("x+","→")}${P.dx||P.dy?`<button type="button" class="btn ghost sm" data-lbk="pr:0">Без сдвига</button>`:""}</div></div></div>
    <ol class="lbhow"><li>В окне печати выберите принтер <b>Xprinter</b>.</li><li>«Ещё настройки» → <b>Размер бумаги</b> — как у наклейки, <b>Поля</b> — «Нет», <b>Масштаб</b> — «По умолчанию».</li><li>Сначала — «Пробная — 1 наклейка».</li></ol></details>`; }
/* макет наклейки — как в BarTender, только нужное: строки, жирный, размер, по центру, рамка, знак EAC */
function lblEdStart(r){ const o=lblOf(r.p); let x, xs;
  if(Array.isArray(o.x)&&o.x.length){ x=o.x.slice(); xs=x.map((_,i)=>Object.assign({}, (o.xs||[])[i]||lblSt0(i))); }
  else { const L=lblLines(r, lblKg(r.u)?lblBox(r.p):null, LBX.iso); x=L.map(a=>/^Партия:/i.test(a[1])&&!o.p?"Партия: {партия}":a[1]); xs=L.map((a,i)=>Object.assign({}, a[2]||lblSt0(i))); }
  LBX.ed={k:r.k, x, xs, eac:o.eac!==0, was:!!(o.x&&o.x.length), i:0}; LBX.open=""; LBX.sel=r.k; }
function lblEdOv(r){ const o=Object.assign({}, lblOf(r.p)); o.x=LBX.ed.x; o.xs=LBX.ed.xs; o.eac=LBX.ed.eac?1:0; return o; }
function lblEdHtml(r){ const E=LBX.ed, i=Math.min(E.i||0, E.x.length-1), st=E.xs[i]||{}, z=+st.z||0;
  const B=(k,t,lab,on,dis)=>`<button type="button" class="lbmb" data-lbm="${k}" title="${lab}" aria-label="${lab}"${on!=null?` aria-pressed="${!!on}"`:""}${dis?" disabled":""}>${t}</button>`;
  return `<div class="lbf lbmk" data-lbmk="${esc(r.k)}"><div class="lbfw lbmk-h"><b>Макет наклейки</b><small>Выберите строку (здесь или на образце) и оформите её кнопками. Дату фасовки и массу сайт подставит сам — в строках «Дата фасовки …» и «Масса нетто …» (или пишите {дата}, {масса}, {партия}).</small></div>
    <div class="lbfw lbtb" role="toolbar" aria-label="Оформление строки ${i+1}"><span class="lbtbn">Строка ${i+1}</span>
      <span class="lbtg">${B("up","↑","Выше",null,i<=0)}${B("dn","↓","Ниже",null,i>=E.x.length-1)}</span>
      <span class="lbtg">${B("b","Ж","Жирный",!!st.b)}${B("c","≡","По центру",!!st.c)}${B("f","▭","В рамке",!!st.f)}</span>
      <span class="lbtg">${B("z-","A−","Мельче",null,z<=-3)}<em class="lbmz" title="Размер">${z>0?"+"+z:z}</em>${B("z+","A+","Крупнее",null,z>=4)}</span>
      ${B("del","×","Убрать строку")}</div>
    <div class="lbfw lbml">${E.x.map((t,k)=>{ const s2=E.xs[k]||{}; return `<input class="lbmi${k===i?" on":""}${s2.b?" bo":""}${s2.c?" ce":""}" data-lmt="${k}" value="${esc(t)}" aria-label="Строка ${k+1}">`; }).join("")}</div>
    <div class="lbsa"><button type="button" class="btn ghost sm" data-lbm="add">+ Строка</button><button type="button" class="lbmb wide" data-lbm="eac" aria-pressed="${E.eac}">Знак EAC</button></div>
    <div class="lbsa"><button type="button" class="btn pri sm" data-lbk="edsave">Сохранить макет для товара</button><button type="button" class="btn ghost sm" data-lbk="edoff">Отмена</button>${E.was?`<button type="button" class="btn ghost sm" data-lbk="untpl" data-k="${esc(r.k)}">Собрать из полей</button>`:""}</div></div>`; }
function lblEdFocus(){ const d=document.getElementById("fd-dcard"), f=d&&LBX.ed&&d.querySelector(`.lbmk input[data-lmt="${LBX.ed.i||0}"]`); if(f){ f.focus({preventScroll:true}); try{ const n=f.value.length; f.setSelectionRange(n,n); }catch(e){} } }
function lblPvRefresh(){ const d=document.getElementById("fd-dcard"), pv=d&&d.querySelector(".lbpv"); if(!pv||!LBX) return; const r=lblRows(LBX.L).find(x=>x.k===LBX.sel); if(!r) return;
  pv.innerHTML=lblHtml(r, lblMasses(r, LBX.st[r.k]||{})[0]??(lblKg(r.u)?lblBox(r.p):null), LBX.iso, LBX.ed&&LBX.ed.k===r.k?lblEdOv(r):null); lblFit(pv); }
/* оформление строки: b — жирный, z — крупнее/мельче (−3…+4), c — по центру, f — в рамке */
const lblSt0 = i => i ? {b:1} : {b:1, z:1};
function lblLines(r, mass, iso, ov){ const o=ov||lblOf(r.p); if(Array.isArray(o.x) && o.x.length) return lblTpl(r, mass, iso, o); const ctry=COUNTRIES[r.p.country]||"", imp=!/^росс/i.test(ctry), s=r.j.snap.s||{};
  const mtxt = mass==null ? "Количество "+qtxt(r.q)+" "+r.u : "Масса нетто "+qtxt(mass)+"кг";
  return [ ["b", o.n||r.p.name, lblSt0(0)],
    ctry ? ["", "Страна происхождения "+ctry] : null,
    o.m ? ["", "Изготовитель "+o.m] : null,
    imp && lblImpTxt() ? ["", "Импортер "+lblImpTxt()] : null,
    ["", "Упаковщик (фасовщик): "+lblPkTxt(s)],
    ["", "Условия хранения при темп. "+(o.t||LBL_T0)],
    ["", "Дата фасовки : "+lblDateTxt(iso)+" "+mtxt],
    ["", "Партия: "+lblBatch(o, iso)],
    ["", "Срок годности "+(o.d||LBL_D0)+" с даты фасовки."] ].filter(Boolean).map(a=>a[2]?a:[a[0],a[1],lblSt0(1)]); }
function lblHtml(r, mass, iso, ov){ const o=ov||lblOf(r.p), P=lblPrn(), eac=o.eac!==0;
  const L=lblLines(r, mass, iso, ov).map(([c,t,st],i)=>{ st=st||lblSt0(i); const z=Math.max(-3,Math.min(4,+st.z||0)), cl=[st.b?"bo":"", st.c?"ce":"", st.f?"fr":"", i===0&&eac&&!st.c?"t":""].filter(Boolean).join(" ");
    const sel = ov && LBX && LBX.ed && ov.x===LBX.ed.x ? ` data-pl="${i}"${i===(LBX.ed.i||0)?' data-sel="1"':""}` : "";
    return `<p${cl?` class="${cl}"`:""}${z?` style="--z:${1+z*0.14}"`:""}${sel}>${st.f?`<span>${esc(t)}</span>`:esc(t)}</p>`; }).join("");
  return `<div class="lb" style="--lw:${P.w}mm;--lh:${P.h}mm"><div class="lbi" style="${P.dx||P.dy?`transform:translate(${P.dx}mm,${P.dy}mm)`:""}">${eac?LBL_EAC:""}${L}</div></div>`; }
const LBL_CSS=`.lb{width:var(--lw,55.4mm);height:var(--lh,40mm);box-sizing:border-box;padding:1.2mm 1.6mm;overflow:hidden;position:relative;background:#fff;color:#000;font-family:Calibri,"Segoe UI","Golos Text",Arial,sans-serif;font-weight:400}
.lb .lbi{height:100%;overflow:hidden}.lb p{margin:0;font-size:calc(var(--fs,7pt) * var(--z,1));line-height:1.16;overflow-wrap:anywhere}.lb p.bo{font-weight:700}.lb p.t{padding-right:9mm}.lb p.ce{text-align:center}
.lb p.fr{margin:.4mm 0}.lb p.fr span{display:inline-block;border:.35mm solid #000;border-radius:1.2mm;padding:.2mm 1.6mm}
.lb .eac{position:absolute;right:2.4mm;top:1.3mm;width:7.5mm;height:4.8mm}`;
/* подгоняем размер шрифта, чтобы текст влез в наклейку */
function lblFit(root){ root.querySelectorAll(".lbi").forEach(b=>{ let fs=7.6; b.style.setProperty("--fs", fs+"pt"); while(b.scrollHeight>b.clientHeight+0.5 && fs>4){ fs=Math.round((fs-0.2)*10)/10; b.style.setProperty("--fs", fs+"pt"); } }); }
let LBX=null;
function lblOpen(L, back){ L=L.filter(j=>j&&j.snap); if(!L.length) return;
  LBX={L, iso:todayISO(), st:{}, open:"", sel:"", back:back||null, ed:null, pr:false}; lblDraw(true); }
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
        <button type="button" class="btn ghost sm" data-lbk="data" data-k="${esc(r.k)}" aria-expanded="${open}">Данные</button><button type="button" class="btn ghost sm" data-lbk="ed" data-k="${esc(r.k)}" aria-expanded="${!!(LBX.ed&&LBX.ed.k===r.k)}">Макет</button></div>
      ${LBX.ed&&LBX.ed.k===r.k?lblEdHtml(r):open?lblForm(r):""}</div>`; };
  const P=lblPrn(), pvw=Math.round(P.w*3.7795*1.3), pvh=Math.round(P.h*3.7795*1.3);
  const prev = sel ? lblHtml(sel, lblMasses(sel, LBX.st[sel.k]||{})[0]??(lblKg(sel.u)?lblBox(sel.p):null), LBX.iso, LBX.ed&&LBX.ed.k===sel.k?lblEdOv(sel):null) : "";
  CARD_RE=()=>{ LBX.open=""; lblDraw(); };
  const od=document.getElementById("fd-dcard"), sc0=!first&&od&&od.classList.contains("lbwin")?od.scrollTop:null;
  openCard(`<div class="dc-head"><div><div class="dc-kicker">${head}</div><h3>${esc(cusNm(c.id)||c.name||"")}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="lbtop"><label class="f">Дата фасовки<input type="date" id="lb-date" value="${LBX.iso}"></label><button type="button" class="btn sm lbupb" data-lbk="up" title="Готовые наклейки из программы BarTender — можно выбрать сразу все файлы">Загрузить наклейки из BarTender</button><input type="file" id="lb-up" accept=".btw" multiple hidden><div class="lbsum"><span><b>${all.length}</b> ${plural(all.length,["наклейка","наклейки","наклеек"])}</span><small>одна на коробку · ${lblMm(P.w)} × ${lblMm(P.h)} мм</small></div></div>
    ${lblUpHtml(c.id)}
    <div class="lbwrap"><div class="lblist">${R.map(row).join("")||`<p class="muted">В накладной нет товаров.</p>`}</div>
      <div class="lbprev"><small>Образец наклейки${sel?" — «"+esc(lblTitle(sel.p))+"»":""}</small><div class="lbpv" style="width:${pvw}px;height:${pvh}px">${prev}</div><small class="muted">${LBX.ed?"Образец меняется сразу, пока вы правите макет.":"При печати: принтер Xprinter, поля — «Нет», масштаб — по умолчанию."}</small></div></div>
    ${lblPrnHtml()}
    <details class="lbset"><summary>Импортёр и упаковщик</summary>
      <label class="f">Импортер (для товаров не из России)<textarea id="lb-imp" rows="2">${esc(lblImpTxt())}</textarea></label>
      <label class="f">Упаковщик (фасовщик) — ${esc((j0.snap.s||{}).name||"")}<textarea id="lb-pk" rows="2">${esc(lblPkTxt(j0.snap.s))}</textarea></label>
      <div class="lbsa"><button type="button" class="btn sm" data-lbk="cfg">Сохранить</button><button type="button" class="btn ghost sm" data-lbk="cfg0">Как в карточках поставщиков</button></div></details>
    ${lblSrv()?"":`<p class="muted lbold">Скрипт таблицы старый — данные товаров для наклеек сохраняются только на этом устройстве. Обновите Code.gs, чтобы они были у всех.</p>`}
    <div class="dc-acts"><button class="btn" data-lbk="test"${all.length?"":" disabled"}>Пробная — 1 наклейка</button><button class="btn pri" data-lbk="print"${all.length?"":" disabled"}>Печать · ${all.length}</button></div>`, "lbl", a=>{});
  const d=document.getElementById("fd-dcard"); if(!d) return; d.classList.add("lbwin"); if(sc0!=null){ d.classList.add("lbkeep"); d.scrollTop=sc0; requestAnimationFrame(()=>{ d.scrollTop=sc0; }); }
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
async function lblPrint(test){ const all=lblAll(); if(!all.length) return; const L=test?all.slice(0,1):all, P=lblPrn(), W=P.w, H=P.h, pw=P.r?H:W, ph=P.r?W:H;
  const tr = P.r===90 ? `translate(${H}mm,0) rotate(90deg)` : P.r===-90 ? `translate(0,${W}mm) rotate(-90deg)` : "none";
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Наклейки</title><style>@page{size:${pw}mm ${ph}mm;margin:0}html,body{margin:0;padding:0;background:#fff}
    ${LBL_CSS} .pg{width:${pw}mm;height:${ph}mm;position:relative;overflow:hidden;break-after:page;page-break-after:always}.pg:last-child{break-after:auto;page-break-after:auto}
    .pg>.lb{position:absolute;left:0;top:0;transform-origin:0 0;transform:${tr}}</style></head><body>${L.map(([r,m])=>`<div class="pg">${lblHtml(r,m,LBX.iso)}</div>`).join("")}</body></html>`;
  const f=document.createElement("iframe"); f.setAttribute("aria-hidden","true"); f.style.cssText="position:fixed;left:-4000px;top:0;width:400px;height:800px;border:0;visibility:hidden";
  document.body.appendChild(f); const d=f.contentWindow.document; d.open(); d.write(html); d.close();
  try{ await (d.fonts&&d.fonts.ready); }catch(e){}
  lblFit(d); window.__lblLast=d.body.innerHTML;
  logEvSoft("Печать",(test?"Пробная наклейка":"Напечатано наклеек: "+L.length)+" — "+LBX.L.map(j=>"№ "+j.number).join(", "));
  f.contentWindow.focus(); f.contentWindow.print(); setTimeout(()=>f.remove(), 60000);
  if(test && !lblPrnSet()) setTimeout(()=>toast("info","Проверьте пробную наклейку","Вышла боком или на две наклейки — откройте «Настройки принтера» и выберите «Повернуть».",{ms:12000, action:{label:"Настройки принтера", fn:()=>{ LBX.pr=true; lblDraw(); const s=document.querySelector("#fd-dcard .lbprn"); if(s) s.scrollIntoView({behavior:"smooth",block:"center"}); }}}), 1500); }
document.addEventListener("click", e=>{ const d=e.target.closest&&e.target.closest("#fd-dcard.lbwin"); if(!d||!LBX) return;
  const b=e.target.closest("[data-lbk]");
  if(b){ const a=b.dataset.lbk, k=b.dataset.k;
    if(a==="data"){ LBX.open = LBX.open===k ? "" : k; if(k) LBX.sel=k; LBX.ed=null; lblDraw(); return; }
    if(a==="ed"){ if(LBX.ed&&LBX.ed.k===k){ LBX.ed=null; lblDraw(); return; } const r=lblRows(LBX.L).find(x=>x.k===k); if(!r) return; lblEdStart(r); lblDraw(); const f=d.querySelector(".lbmk input"); if(f) f.focus({preventScroll:true}); return; }
    if(a==="edoff"){ LBX.ed=null; lblDraw(); return; }
    if(a==="edsave"){ const E=LBX.ed, r=E&&lblRows(LBX.L).find(x=>x.k===E.k); if(!r) return; const o=lblOf(r.p), X=[], XS=[];
      E.x.forEach((t,i)=>{ t=String(t).trim(); if(t){ X.push(t); const st=E.xs[i]||{}, c={}; ["b","c","f"].forEach(q=>{ if(st[q]) c[q]=1; }); if(+st.z) c.z=+st.z; XS.push(c); } });
      if(!X.length){ toast("warn","Пустой макет","Впишите хотя бы одну строку"); return; }
      o.x=X; o.xs=XS; if(E.eac) delete o.eac; else o.eac=0; if(!o.f) o.f="макет сайта"; lblSave(r.p, o); LBX.ed=null; lblDraw(); toast("ok","Макет сохранён","Наклейка «"+r.p.name+"»"+(lblSrv()?"":" — только на этом устройстве")); return; }
    if(a.startsWith("pr:")){ const P=lblPrn(), q=a.slice(3); LBX.pr=true;
      if(q==="r") P.r=+b.dataset.r; else if(q==="0"){ P.dx=0; P.dy=0; } else { const ax=q[0]==="x"?"dx":"dy"; P[ax]=Math.max(-10,Math.min(10,Math.round((P[ax]+(q[1]==="+"?0.5:-0.5))*10)/10)); }
      lblPrnSave(P); lblDraw(); return; }
    if(a==="save"){ const r=lblRows(LBX.L).find(x=>x.k===k), f=d.querySelector(`[data-lbf="${CSS.escape(k)}"]`); if(!r||!f) return; const o=lblOf(r.p), v=n=>{ const el=f.querySelector(`[data-lf="${n}"]`); return el?el.value.trim():""; };
      if(f.querySelector('[data-lf="x"]')){ o.x=v("x").split(/\n/).map(x=>x.trim()).filter(Boolean); const bb=String(v("b")).replace(",","."); o.b=+bb>0?bb:""; if(!o.x.length){ delete o.x; delete o.f; }
        lblSave(r.p, o); delete (LBX.st[k]||{}).b; LBX.open=""; lblDraw(); toast("ok","Сохранено","Наклейка «"+r.p.name+"»"); return; }
      Object.assign(o, {n: v("n")===r.p.name?"":v("n"), m:v("m"), t:v("t")===LBL_T0?"":v("t"), d:v("d")===LBL_D0?"":v("d"), p:v("p"), b:+String(v("b")).replace(",",".")>0?String(v("b")).replace(",","."):""});
      const ct=v("country"); if(ct!==(r.p.country||"")){ r.p.country=ct; dirty("products", r.p.id); saveLocal(); }
      lblSave(r.p, o); delete (LBX.st[k]||{}).b; LBX.open=""; lblDraw(); toast("ok","Сохранено","Данные наклейки для «"+r.p.name+"»"+(lblSrv()?"":" — только на этом устройстве")); return; }
    if(a==="cfg"||a==="cfg0"){ const p=getPrefs(), c=lblCfg(), sid=(LBX.L[0].snap.s||{}).id||"";
      if(a==="cfg"){ c.imp=d.querySelector("#lb-imp").value.trim(); const pk=d.querySelector("#lb-pk").value.trim(); if(sid) c.pk[sid]=pk; } else { c.imp=""; if(sid) delete c.pk[sid]; }
      p.lbl=c; setPrefs(p, true); lblDraw(); toast("ok", a==="cfg"?"Сохранено":"Как в карточках поставщиков"); return; }
    if(a==="untpl"){ const r=lblRows(LBX.L).find(x=>x.k===k); if(!r) return; if(!armed(b,"Точно? Свой текст наклейки удалится")) return; const o=lblOf(r.p); delete o.x; delete o.f; delete o.xs; delete o.eac; lblSave(r.p, o); LBX.ed=null; lblDraw(); return; }
    if(a==="up"){ d.querySelector("#lb-up").click(); return; }
    if(a==="upsave"){ lblUpSave(); return; }
    if(a==="upoff"){ LBX.up=null; lblDraw(); return; }
    if(a==="test"||a==="print"){ lblPrint(a==="test"); return; }
    return; }
  const pl=e.target.closest(".lbpv [data-pl]"); if(pl && LBX.ed){ LBX.ed.i=+pl.dataset.pl; lblDraw(); lblEdFocus(); return; }
  const m=e.target.closest("[data-lbm]"); if(m && LBX.ed){ const E=LBX.ed, i=E.i||0, q=m.dataset.lbm;
    if(q==="add"){ E.x.splice(i+1,0,""); E.xs.splice(i+1,0,{b:1}); E.i=i+1; lblDraw(); lblEdFocus(); return; }
    if(q==="eac"){ E.eac=!E.eac; lblDraw(); return; }
    const st=E.xs[i]=E.xs[i]||{};
    if(q==="up"||q==="dn"){ const j=q==="up"?i-1:i+1; if(j<0||j>=E.x.length) return; [E.x[i],E.x[j]]=[E.x[j],E.x[i]]; [E.xs[i],E.xs[j]]=[E.xs[j],E.xs[i]]; E.i=j; }
    else if(q==="del"){ if(E.x.length<=1) return; E.x.splice(i,1); E.xs.splice(i,1); E.i=Math.min(i, E.x.length-1); }
    else if(q==="z+"||q==="z-") st.z=Math.max(-3,Math.min(4,(+st.z||0)+(q==="z+"?1:-1)));
    else st[q]=st[q]?0:1;
    lblDraw(); lblEdFocus(); return; }
  const s=e.target.closest("[data-lbsel]"); if(s && !e.target.closest("input,button,select,textarea,label,.lbf") && LBX.sel!==s.dataset.lbsel){ LBX.sel=s.dataset.lbsel; lblDraw(); }
});
document.addEventListener("change", e=>{ const d=e.target.closest&&e.target.closest("#fd-dcard.lbwin"); if(!d||!LBX) return; const t=e.target;
  if(t.id==="lb-up"){ const F=[...t.files]; t.value=""; if(F.length) lblUpLoad(F); return; }
  if(t.dataset.lbup!=null){ const u=(LBX.up||[])[+t.dataset.lbup]; if(u) u.pid=t.value; lblDraw(); return; }
  if(t.id==="lb-pw"||t.id==="lb-ph"){ const P=lblPrn(), v=+String(t.value).replace(",",".").replace(/\s/g,""); if(v>=15&&v<=120){ P[t.id==="lb-pw"?"w":"h"]=Math.round(v*10)/10; lblPrnSave(P); } LBX.pr=true; lblDraw(); return; }
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
/* подбор товара к наклейке: общие основы слов (Жаккар — лишние слова с обеих сторон снижают оценку: «Лук репчатый красный» ≠ «Лук репчатый»),
   товары из прайса заказчика — чуть выше; оценка < 0,5 — не подбираем, человек выберет сам */
function lblGuess(name, first, cid){ const A=new Set([...lblStem(name), ...lblStem(first)]); if(!A.size) return "";
  const pr=(D.prices||{})[cid]||{}; let best="", bs=0;
  D.products.forEach(p=>{ const B=new Set(lblStem(String(p.name).replace(/\(поз\..*?\)/i,""))); if(!B.size) return; const c=[...B].filter(w=>A.has(w)).length; if(!c) return;
    const sc=c/new Set([...A,...B]).size + (pr[p.id]!=null && pr[p.id]!=="" ? 0.2 : 0);
    if(sc>bs+1e-9){ bs=sc; best=p.id; } });
  return bs>=0.5 ? best : ""; }
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
    ${U.map((u,i)=>{ if(!u.x) return null; const dup=u.pid && U.some((v,j)=>j!==i && v.x && v.pid===u.pid); return `<div class="lbu${u.pid?"":" no"}${dup?" dup":""}"><div class="lbu-n"><small>${esc(u.f)}</small><b>${esc(u.x[0])}</b><span>${esc(u.x.slice(1,3).join(" · "))}</span>${!u.pid?`<em class="lbw">не нашёл товар — выберите сами</em>`:dup?`<em class="lbw">этот товар выбран и для другой наклейки</em>`:""}</div>${sel(u,i)}</div>`; }).map((h,i)=>h!==null?h:`<div class="lbu no"><div class="lbu-n"><small>${esc(U[i].f)}</small><span class="lbw">${esc(U[i].err)}</span></div></div>`).join("")}
    <div class="lbsa"><button type="button" class="btn pri sm" data-lbk="upsave"${ok?"":" disabled"}>Сохранить для товаров · ${ok}</button><button type="button" class="btn ghost sm" data-lbk="upoff">Отмена</button></div></div>`; }
function lblUpSave(){ const U=(LBX.up||[]).filter(u=>u.x&&u.pid); let n=0;
  U.forEach(u=>{ const p=prod(u.pid); if(!p||!p.id) return; const o=lblOf(p), q=u.o||{};
    Object.assign(o, {x:u.x, f:u.f}); ["m","t","d","p"].forEach(k=>{ if(q[k]) o[k]=q[k]; }); if(q.b && !(+o.b>0)) o.b=q.b;
    if(q.ctry && !p.country){ const c=Object.entries(COUNTRIES).find(([k,v])=>k && v.toLowerCase()===q.ctry.toLowerCase()); if(c){ p.country=c[0]; dirty("products", p.id); } }
    lblSave(p, o); n++; });
  saveLocal(); LBX.up=null; LBX.st={}; lblDraw(); toast("ok","Наклейки сохранены", n+" "+plural(n,["товар","товара","товаров"])+(lblSrv()?"":" — только на этом устройстве"));
  logEvSoft("Справочники","Загружены наклейки из BarTender: "+n); }
window.__lbl={ guess:(n,f,c)=>lblGuess(n,f,c), up:(f)=>lblUpLoad(f), lines:(f)=>lblBtwLines(f), open:(ids)=>lblOpen(D.journal.filter(j=>ids.includes(j.id))), all:()=>lblAll().map(([r,m])=>[r.p.name,m]), last:()=>window.__lblLast||"" };

/* правка строки макета — образец меняется сразу, без перерисовки окна (курсор остаётся в поле) */
document.addEventListener("input", e=>{ const t=e.target; if(!t.dataset||t.dataset.lmt==null||!LBX||!LBX.ed) return; LBX.ed.x[+t.dataset.lmt]=t.value; lblPvRefresh(); });
document.addEventListener("focusin", e=>{ const t=e.target; if(!t.dataset||t.dataset.lmt==null||!LBX||!LBX.ed) return; const i=+t.dataset.lmt; if(LBX.ed.i===i) return; LBX.ed.i=i;
  const d=document.getElementById("fd-dcard"), r=lblRows(LBX.L).find(x=>x.k===LBX.ed.k), tb=d&&d.querySelector(".lbmk .lbtb"); if(!r||!tb) return;
  const w=document.createElement("div"); w.innerHTML=lblEdHtml(r); tb.replaceWith(w.querySelector(".lbtb"));
  d.querySelectorAll(".lbmk input[data-lmt]").forEach(x=>x.classList.toggle("on", +x.dataset.lmt===i)); lblPvRefresh(); });
document.addEventListener("keydown", e=>{ const t=e.target; if(!t.dataset||t.dataset.lmt==null||!LBX||!LBX.ed) return;
  if(e.key==="Enter"){ e.preventDefault(); const E=LBX.ed, i=+t.dataset.lmt; E.x.splice(i+1,0,""); E.xs.splice(i+1,0,{b:1}); E.i=i+1; lblDraw(); lblEdFocus(); }
  else if((e.key==="ArrowDown"||e.key==="ArrowUp")&&!e.altKey){ const n=document.querySelector(`#fd-dcard .lbmk input[data-lmt="${+t.dataset.lmt+(e.key==="ArrowDown"?1:-1)}"]`); if(n){ e.preventDefault(); n.focus(); } } });
document.addEventListener("toggle", e=>{ const t=e.target; if(t.classList&&t.classList.contains("lbprn")&&LBX) LBX.pr=t.open; }, true);
