/* ================= Черновики: незаконченные документы не теряются =================
   Что сохраняется само (через ~1,5 с после правки и сразу при закрытии страницы):
   • «Новый документ» — накладная, у которой выбран заказчик и есть товар, пока её нет в журнале;
   • документы из файлов / из платежа (D.multi) — пока сохранены не все;
   • «Заявка» — пока есть количество и это не правка готового комплекта.
   Хранение: D.drafts на устройстве + лист «Черновики» в таблице (действие drafts, Code.gs ≥ 29), видят все (водитель — только свои).
   Черновик удаляется сам, когда документ попал в журнал / все документы из файлов сохранены / заявка превратилась в документы.
   «Очистить форму», «Закончить», «Очистить» в заявке — работа не пропадает: остаётся в черновиках. */
const DR_KIND = {doc:"Накладная", multi:"Документы из файлов", order:"Заявка"};
const DR_ICO = {
  doc:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 3v4h4M9.5 12h6M9.5 15.5h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  multi:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h7l3 3v12H9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M6 17V3h7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M12 13h4M12 16.5h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  order:`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M4 10h16M10 4v16" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>`};
const DRS = {t:null, sig:{}, busy:false, at:0, open:null, del:null, delT:0, f:"all", loaded:false};
const drArr = () => { if(!Array.isArray(D.drafts)) D.drafts=[]; return D.drafts; };
const drPendM = () => { if(!D.drPend || typeof D.drPend!=="object") D.drPend={}; return D.drPend; };
const drData = r => { if(!r) return null; if(r.data && typeof r.data==="object") return r.data; try{ return r.data=JSON.parse(r.data||"null"); }catch(e){ return null; } };
const drMine = r => !r.byName || r.byName===curUser();
const drAll = () => !docLimited();
const drVisible = () => drArr().filter(r=>drAll()||drMine(r)).sort((a,b)=>String(b.updated||"").localeCompare(String(a.updated||"")));

/* ---- снимки текущей работы ---- */
function drImpSnap(){ const R=IMP&&IMP.r; if(!R || !D.multi || IMP.file!==D.multi.file) return null;
  return {file:IMP.file, many:IMP.many?1:0, c:R.c&&R.c.id, s:R.s&&R.s.id, k:R.k&&R.k.id, date:R.date, warn:R.warn,
    g:R.groups.map(g=>({c:g.c&&g.c.id, s:g.s&&g.s.id, k:g.k&&g.k.id, date:g.date, num:g.num, file:g.file, issued:g.issued, total:g.total, branchId:g.branchId, ship:g.ship, sum:g.sum, filled:g.filled,
      items:g.items, miss:(g.miss||[]).map(l=>Object.assign({},l,{sug:l.sug?l.sug.id:null, amb:l.amb?l.amb.map(p=>p.id):null})), warn:g.warn, pdiff:g.pdiff||null}))}; }
function drImpRestore(x, file){ if(!x) return null; const P=id=>prod(id)||null, C=id=>id?D.customers.find(c=>c.id===id)||null:null, Sx=id=>id?D.suppliers.find(c=>c.id===id)||null:null, K=id=>id?(D.contracts||[]).find(c=>c.id===id)||null:null;
  const groups=x.g.map(g=>({c:C(g.c), s:Sx(g.s), k:K(g.k), date:g.date, num:g.num, file:g.file, issued:g.issued, total:g.total, branchId:g.branchId, ship:g.ship, sum:g.sum, filled:g.filled,
    items:g.items||[], miss:(g.miss||[]).map(l=>Object.assign({},l,{sug:l.sug?P(l.sug):null, amb:l.amb?l.amb.map(P).filter(Boolean):null})), warn:g.warn||[], pdiff:g.pdiff||undefined}));
  const c0=C(x.c)||(groups[0]&&groups[0].c); if(!c0) return null;
  return {file:file||x.file, many:x.many?1:0, cur:-1, r:{c:c0, s:Sx(x.s)||groups[0].s||{}, k:K(x.k), date:x.date, warn:x.warn||[], groups}}; }
const drDocOn = dr => !!(dr && dr.customerId && (dr.lines||[]).some(l=>l.productId && +l.qty>0) && !dr.qtyOnly && !D.journal.some(j=>j.id===dr.id));
const drMultiOn = m => !!(m && Array.isArray(m.docs) && m.docs.length && m.docs.some(M=>!M.saved || M.ch));
const drOrderOn = o => !!(o && !o.edit && Object.values(o.qty||{}).some(v=>+v>0 || (v && typeof v==="object" && Object.values(v).some(x=>+x>0))));
function drCur(){ const L=[];
  if(!mulOn() && drDocOn(D.draft)){ const dr=Object.assign({},D.draft); delete dr._editBase; const k=calc(dr);
    L.push({id:"d-"+dr.id, kind:"doc", title:(cusNm(dr.customerId)||"Без заказчика")+(dr.number?" · № "+dr.number:"")+(dr.date?" от "+fd(dr.date):""), sum:String(k.t.sum), data:{dr, n:k.lines.length, sup:dr.supplierId}}); }
  if(drMultiOn(D.multi)){ const m=D.multi; if(!m.did){ m.did=uid(); saveLocal(); } const docs=m.docs, tot=r2(docs.reduce((a,M)=>a+calc(M.dr).t.sum,0)), done=docs.filter(M=>M.saved&&!M.ch).length;
    const cn=[...new Set(docs.map(M=>cusNm(M.dr.customerId)).filter(Boolean))];
    L.push({id:"m-"+m.did, kind:"multi", title:(m.bank?"Из платежа «"+(m.bank.payer||"")+"»":"Из файлов «"+(m.file||"")+"»")+" · "+cn.slice(0,2).join(", ")+(cn.length>2?" и ещё "+(cn.length-2):""), sum:String(tot), data:{m, imp:drImpSnap(), n:docs.length, done}}); }
  if(drOrderOn(D.order)){ const o=D.order; if(!o.did){ o.did=uid(); saveLocal(); } let pts=0; Object.values(o.qty||{}).forEach(v=>{ if(v && typeof v==="object" && Object.values(v).some(x=>+x>0)) pts++; });
    L.push({id:"o-"+o.did, kind:"order", title:"Заявка · "+(cusNm(o.customerId)||"")+(o.date?" на "+fd(o.date):""), sum:"", data:{o, pts}}); }
  return L; }

/* ---- автосохранение ---- */
function drTick(now){ if(!curUser() || !D || !D.journal) return; let ch=false;
  drCur().forEach(c=>{ const sig=JSON.stringify([c.title,c.sum,c.data]); if(DRS.sig[c.id]===sig) return; DRS.sig[c.id]=sig;
    const L=drArr(), i=L.findIndex(r=>r.id===c.id), old=i>=0?L[i]:null, t=new Date().toISOString();
    const row={id:c.id, kind:c.kind, title:c.title, sum:c.sum, data:JSON.parse(JSON.stringify(c.data)), byName:old?old.byName:curUser(), created:old?old.created:t, lastBy:curUser(), updated:t};
    if(old && JSON.stringify([old.title,old.sum,drData(old)])===sig) return;
    if(i>=0) L[i]=row; else L.push(row); drPendM()[c.id]="put"; ch=true; });
  /* сделанные документы — их черновики больше не нужны */
  drArr().slice().forEach(r=>{ const d=drData(r); if(!d) return;
    if(r.kind==="doc" && d.dr && D.journal.some(j=>j.id===d.dr.id)) drDrop(r.id, true), ch=true;
    else if(r.kind==="multi" && d.m && D.multi && D.multi.did && "m-"+D.multi.did===r.id && !drMultiOn(D.multi)) drDrop(r.id, true), ch=true; });
  if(ch){ saveLocal(); drDraw(); clearTimeout(DRS.t); DRS.t=setTimeout(drPush, now?0:1200); } }
function drDrop(id, quiet){ const L=drArr(), i=L.findIndex(r=>r.id===id); if(i>=0) L.splice(i,1); drPendM()[id]="del"; delete DRS.sig[id]; if(!quiet){ saveLocal(); drDraw(); drPush(); } }
async function drPush(keep){ if(DRS.busy || !online() || D.drSrv===false) return; const P=drPendM(), ids=Object.keys(P); if(!ids.length) return; DRS.busy=true;
  try{ for(const id of ids){ const op=P[id], r=drArr().find(x=>x.id===id);
      const body={action:"drafts", op:op==="del"||!r?"del":"put", id};
      if(body.op==="put") body.row={id, kind:r.kind, title:r.title, sum:r.sum, data:JSON.stringify(r.data)};
      let j; try{ j=keep ? await fetch(API_URL,{method:"POST", keepalive:true, body:JSON.stringify(Object.assign({key:pass(), user:curUser()},body))}).then(x=>x.json()) : await api(body); }
      catch(e){ if(/unknown action/.test(e.message||"")){ D.drSrv=false; saveLocal(); drDraw(); } break; }
      if(j && j.ok===false){ if(j.error==="unknown action"){ D.drSrv=false; saveLocal(); drDraw(); break; } if(j.error==="big"){ toast("warn","Черновик большой","«"+(r&&r.title||"")+"» сохранён только на этом устройстве."); } }
      if(P[id]===op) delete P[id];
      if(j && j.row && r){ r.byName=j.row.byName; r.created=j.row.created; r.lastBy=j.row.lastBy; r.updated=j.row.updated; }
      D.drSrv=true; }
    saveLocal(); }
  finally{ DRS.busy=false; drDraw(); } }
async function drLoad(quiet){ if(!online() || !curUser()) return; try{
    const j=await api({action:"drafts", op:"list"}); if(!j || !Array.isArray(j.list)) return; D.drSrv=true; const P=drPendM(), L=drArr();
    /* своё неотправленное важнее; остальное — как в таблице (удалённое там другим сотрудником — убираем и здесь) */
    const mine=L.filter(r=>P[r.id]==="put"), before=JSON.stringify(L.map(r=>[r.id,r.updated]));
    D.drafts=mine.concat(j.list.filter(r=>P[r.id]!=="del" && !mine.some(x=>x.id===r.id))); DRS.loaded=true; saveLocal();
    if(JSON.stringify(D.drafts.map(r=>[r.id,r.updated]))!==before || !quiet) drDraw();
    drPush(); }
  catch(e){ if(/unknown action/.test(e.message||"")){ D.drSrv=false; saveLocal(); drDraw(); } } }

/* ---- продолжить / удалить ---- */
function drOpen(id){ const r=drArr().find(x=>x.id===id), d=drData(r); if(!r || !d){ toast("warn","Черновик не найден"); return; }
  drTick(true);   /* то, что сейчас в форме, — сначала в черновики */
  if(r.kind==="doc"){ const dr=clone(d.dr); if(D.journal.some(j=>j.id===dr.id)){ toast("info","Этот документ уже в журнале"); drDrop(id); return; }
    D.multi=null; IMP=null; D.draft=dr; DRS.sig[id]=null; saveLocal(); if(curTab!=="doc") showTab("doc"); else renderDoc(); drawImp(); }
  else if(r.kind==="multi"){ D.multi=clone(d.m); IMP=drImpRestore(d.imp, D.multi.file); DRS.sig[id]=null; saveLocal(); if(curTab!=="doc") showTab("doc"); else renderDoc(); drawImp(); }
  else if(r.kind==="order"){ D.order=clone(d.o); DRS.sig[id]=null; saveLocal(); if(curTab!=="order") showTab("order"); else renderOrder(); }
  DRS.open=null; drDraw(); requestAnimationFrame(()=>{ const t=document.querySelector(r.kind==="order"?"#tab-order":r.kind==="multi"?"#mul":"#tab-doc .dform"); if(t) t.scrollIntoView({behavior:"smooth", block:"start"}); });
  toast("ok","Черновик открыт", r.title+(r.lastBy&&r.lastBy!==curUser()?" · последним менял(а) "+r.lastBy:"")+".");
  logEv("Документ","Продолжен черновик: "+r.title); }
function drIsCur(id){ return drCur().some(c=>c.id===id); }
function drDelete(id){ const r=drArr().find(x=>x.id===id); if(!r) return; const cur=drIsCur(id);
  if(cur){ /* удаляем то, что сейчас в форме, — и форму очищаем, иначе автосохранение вернёт черновик */
    if(r.kind==="doc"){ const keep={supplierId:D.draft.supplierId, customerId:D.draft.customerId}; D.draft=Object.assign(newDraft(D),keep); D.draft.number=nextNum(keep.supplierId, keep.customerId); renderDoc(); }
    else if(r.kind==="multi"){ D.multi=null; IMP=null; drawImp(); renderDoc(); }
    else if(r.kind==="order"){ const o=O(); o.qty={}; o.num={}; delete o.did; if(curTab==="order") renderOrderGrid(); } }
  const row=document.querySelector(`.drrow[data-drid="${CSS.escape(id)}"]`);
  const fin=()=>{ drDrop(id); toast("ok","Черновик удалён", r.title); logEv("Документ","Удалён черновик: "+r.title); };
  if(row && !matchMedia("(prefers-reduced-motion: reduce)").matches){ row.style.height=row.offsetHeight+"px"; row.classList.add("out"); requestAnimationFrame(()=>{ row.style.height="0px"; }); setTimeout(fin, 260); } else fin(); }

/* ---- вид ---- */
const drAgo = iso => { if(!iso) return ""; const ms=Date.now()-new Date(iso).getTime(), m=Math.round(ms/60000);
  if(m<1) return "только что"; if(m<60) return m+" мин назад"; const h=Math.round(m/60); if(h<24 && new Date(iso).toDateString()===new Date().toDateString()) return "сегодня в "+new Date(iso).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
  return new Date(iso).toLocaleDateString("ru-RU",{day:"numeric",month:"short"})+" в "+new Date(iso).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"}); };
const drAva = n => `<span class="drava" style="--h:${evHue(n||"?")}" title="${esc(n||"")}">${esc(String(n||"?").charAt(0))}</span>`;
function drSub(r){ const d=drData(r)||{};
  if(r.kind==="doc") return (d.n||0)+" "+plural(d.n||0,["позиция","позиции","позиций"])+(d.sup?" · "+esc(supShort(sup(d.sup).name||"")):"");
  if(r.kind==="multi") return (d.n||0)+" "+plural(d.n||0,["накладная","накладные","накладных"])+(d.done?` · <span class="drok">сохранено ${d.done} из ${d.n}</span>`:"");
  if(r.kind==="order") return (d.pts||0)+" "+plural(d.pts||0,["точка","точки","точек"]);
  return ""; }
function drDetail(r){ const d=drData(r)||{}; let h="";
  if(r.kind==="doc" && d.dr){ const k=calc(d.dr); h+=`<table class="drt"><tbody>${k.lines.slice(0,12).map(l=>`<tr><td>${esc(l.name)}</td><td class="n">${esc(qfmt(l.qty,l.unit))}</td><td class="n">${fm(l.sum)}</td></tr>`).join("")}${k.lines.length>12?`<tr><td colspan="3" class="muted">и ещё ${k.lines.length-12}</td></tr>`:""}</tbody></table>`; }
  if(r.kind==="multi" && d.m) h+=`<table class="drt"><tbody>${d.m.docs.map(M=>`<tr><td>№ ${esc(M.dr.number||"—")} от ${fd(M.dr.date)} · ${esc(cusNm(M.dr.customerId)||"")}</td><td class="n">${M.saved&&!M.ch?'<span class="drok">в журнале ✓</span>':"не сохранена"}</td><td class="n">${fm(calc(M.dr).t.sum)}</td></tr>`).join("")}</tbody></table>`;
  if(r.kind==="order" && d.o){ const nP=new Set(); Object.values(d.o.qty||{}).forEach(v=>{ if(v&&typeof v==="object") Object.keys(v).forEach(p=>{ if(+v[p]>0) nP.add(p); }); }); h+=`<p class="muted">Точек с количеством: ${d.pts||0} · товаров: ${nP.size}</p>`; }
  h+=`<div class="drwho">${drAva(r.byName)}<span>Начал(а) <b>${esc(r.byName||"—")}</b> · ${esc(drAgo(r.created))}</span>${r.lastBy && r.lastBy!==r.byName?`<span class="drsep"></span>${drAva(r.lastBy)}<span>Последние правки — <b>${esc(r.lastBy)}</b> · ${esc(drAgo(r.updated))}</span>`:""}</div>`;
  return h; }
function drRow(r){ const cur=drIsCur(r.id), open=DRS.open===r.id, del=DRS.del===r.id && Date.now()-DRS.delT<4000, can=drAll()||drMine(r);
  return `<div class="drrow${open?" open":""}${cur?" cur":""}" data-drid="${esc(r.id)}">
    <div class="drh" data-drtog role="button" tabindex="0" aria-expanded="${open}"><span class="drico k-${r.kind}">${DR_ICO[r.kind]||""}</span>
      <span class="drm"><b>${esc(r.title)}</b><small>${esc(DR_KIND[r.kind]||"")} · ${drSub(r)}${cur?' · <span class="drcur">сейчас в форме</span>':""}</small></span>
      <span class="drr">${+r.sum>0?`<b>${fm(+r.sum)} ₽</b>`:""}<small>${drAva(r.lastBy||r.byName)} ${esc(drAgo(r.updated))}</small></span>
      <span class="drchev" aria-hidden="true">›</span></div>
    <div class="drb"><div class="drbi">${drDetail(r)}
      <div class="dract">${cur?`<span class="muted">Уже открыт в форме</span>`:`<button class="btn pri sm" type="button" data-drgo>Продолжить</button>`}${can?`<button class="btn sm${del?" drdanger":" ghost"}" type="button" data-drdel>${del?"Точно удалить?":"Удалить"}</button>`:""}</div></div></div></div>`; }
function drDraw(){ document.querySelectorAll(".drcard").forEach(box=>{ const L=drVisible(), F=DRS.f==="mine"?L.filter(drMine):L, others=L.some(r=>!drMine(r));
    if(!L.length){ box.hidden=true; box.innerHTML=""; return; } box.hidden=false;
    const fold=lsGet("frudom-drfold")!=="0", last=L[0];
    const note=D.drSrv===false?`<div class="drnote">Скрипт таблицы старый — черновики пока хранятся только на этом устройстве. Обновите Code.gs, чтобы их видели все.</div>`:"";
    const html=`<div class="drhead" data-drfold role="button" tabindex="0" aria-expanded="${!fold}"><b>Черновики</b><span class="drn">${L.length}</span>
        <span class="drlast">${fold?`последний: ${esc(last.title)} · ${drAva(last.lastBy||last.byName)} ${esc(drAgo(last.updated))}`:"незаконченные документы сохраняются сами — продолжите с того же места"}</span><span class="drfold">${fold?"Показать":"Свернуть"}</span></div>
      <div class="drbody"><div class="drbi">${note}${drAll()&&others?`<div class="pfchips drf"><button type="button" data-drf="all" class="${DRS.f!=="mine"?"on":""}">Все · ${L.length}</button><button type="button" data-drf="mine" class="${DRS.f==="mine"?"on":""}">Мои · ${L.filter(drMine).length}</button></div>`:""}
        <div class="drlist">${F.map(drRow).join("")||`<p class="muted">Ваших черновиков нет.</p>`}</div></div></div>`;
    box.classList.toggle("folded", fold);
    if(box.dataset.h!==html){ box.dataset.h=html; box.innerHTML=html; } }); }
document.addEventListener("click", e=>{ const box=e.target.closest(".drcard"); if(!box) return;
  if(e.target.closest("[data-drfold]")){ const f=lsGet("frudom-drfold")!=="0"; lsSet("frudom-drfold", f?"0":"1"); drDraw(); return; }
  const fb=e.target.closest("[data-drf]"); if(fb){ DRS.f=fb.dataset.drf; drDraw(); return; }
  const row=e.target.closest(".drrow"); if(!row) return; const id=row.dataset.drid;
  if(e.target.closest("[data-drgo]")){ drOpen(id); return; }
  if(e.target.closest("[data-drdel]")){ if(DRS.del===id && Date.now()-DRS.delT<4000){ DRS.del=null; drDelete(id); } else { DRS.del=id; DRS.delT=Date.now(); drDraw(); setTimeout(()=>{ if(DRS.del===id){ DRS.del=null; drDraw(); } }, 4100); } return; }
  if(e.target.closest("[data-drtog]")){ DRS.open=DRS.open===id?null:id; drDraw(); } });
document.addEventListener("keydown", e=>{ if((e.key==="Enter"||e.key===" ") && e.target.closest && e.target.closest(".drcard [data-drtog], .drcard [data-drfold]")){ e.preventDefault(); e.target.click(); } });

/* ---- когда сохранять ---- */
document.addEventListener("input", ()=>{ clearTimeout(DRS.it); DRS.it=setTimeout(()=>drTick(), 900); }, true);
document.addEventListener("change", ()=>{ clearTimeout(DRS.it); DRS.it=setTimeout(()=>drTick(), 600); }, true);
document.addEventListener("click", ()=>{ clearTimeout(DRS.it); DRS.it=setTimeout(()=>drTick(), 800); }, true);
setInterval(()=>{ if(document.visibilityState==="visible") drTick(); }, 4000);
setInterval(()=>{ if(document.visibilityState==="visible" && (curTab==="doc"||curTab==="order")) drLoad(true); }, 60000);
addEventListener("pagehide", ()=>{ drTick(true); drPush(true); });
document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="hidden"){ drTick(true); drPush(true); } else if(curTab==="doc"||curTab==="order") drLoad(true); });

/* ---- закреплённая строка над документами из файлов: высота шапки сайта для position:sticky ---- */
(function(){ const set=()=>{ const h=document.querySelector("#fd-app header.top"), app=document.getElementById("fd-app"); if(!h||!app) return; const st=getComputedStyle(h).position==="sticky"; app.style.setProperty("--toph", (st?h.getBoundingClientRect().height:0)+"px"); };
  try{ const h=document.querySelector("#fd-app header.top"); if(h && window.ResizeObserver) new ResizeObserver(set).observe(h); }catch(e){} addEventListener("resize", set); setTimeout(set, 300); })();
addEventListener("scroll", ()=>{ const h=document.querySelector("#mul .mulhead"); if(!h) return; const top=parseFloat(getComputedStyle(document.getElementById("fd-app")).getPropertyValue("--toph"))||0; h.classList.toggle("stuck", h.getBoundingClientRect().top<=top+1 && h.parentElement.getBoundingClientRect().top<top); }, {passive:true});
setTimeout(()=>{ drTick(); drDraw(); drLoad(true); }, 1500);
