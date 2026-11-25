/* ===== Меню правой кнопкой по всему сайту (16.11.2026, cx_seg.js) =====
   Одно оформление и поведение с меню журнала (jcxOpen): у курсора, не за краем экрана, ↑↓ / Enter / Esc, плавно.
   Провайдер — функция (элемент под курсором) → {row, head, items, label} или null; первый подошедший открывает меню.
   Shift + правая кнопка, поля ввода и выделенный текст — обычное меню браузера. */
const CX=[];
const cxReg = f => CX.push(f), cxRegFirst = f => CX.unshift(f);
Object.assign(JCX_I, {
  plus:'<path d="M12 5v14M5 12h14"/>',
  doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/>',
  order:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 4v16"/>',
  task:'<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
  card:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10M7 17h4"/>',
  clip:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  box:'<path d="M21 8 12 3 3 8v8l9 5 9-5Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  hist:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  route:'<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7"/>',
  pdf:'<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  next:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  cam:'<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  filter:'<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>',
  ship:'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  inc:'<path d="M12 19V5M5 12l7-7 7 7"/>',
  ok:'<path d="M4 12.5l5 5L20 6.5"/>' });
/* строитель пунктов */
function cxList(){ const out=[]; return { out,
  it(id, lbl, ic, fn, o){ out.push(Object.assign({id, lbl, ic:jcxIc(ic||id), fn}, o||{})); return this; },
  sep(){ if(out.length && !out[out.length-1].sep) out.push({sep:1}); return this; },
  chips(title, chips){ if(chips.length) out.push({chips, title}); return this; },
  done(){ while(out.length && out[out.length-1].sep) out.pop(); return out; } }; }
const cxHead = (b, sub, em) => `<div class="jcx-h${em?"":" g"}"><b>${esc(b)}</b>${em?`<span></span><em>${esc(em)}</em>`:"<span></span>"}${sub?`<small>${esc(sub)}</small>`:""}</div>`;
document.addEventListener("contextmenu", e=>{
  if(e.shiftKey || e.defaultPrevented) return; const t=e.target; if(!t || !t.closest) return;
  if(t.closest("input,textarea,select,[contenteditable=''],[contenteditable='true'],.jcx,dialog:not(.dcard)")) return;
  try{ if(String(getSelection()||"").trim()) return; }catch(_){}
  for(const f of CX){ let T=null; try{ T=f(t); }catch(err){ console.error(err); }
    if(!T || !T.items || !T.items.length) continue;
    e.preventDefault(); const kb=!e.clientX && !e.clientY; let x=e.clientX, y=e.clientY;
    if(kb){ const r=T.row.getBoundingClientRect(); x=r.left+12; y=Math.min(r.bottom-4, innerHeight-24); }
    jcxOpen(T, x, y, kb); return; } });
/* клавиша «Меню» / Shift+F10 на строке с фокусом — то же меню */
document.addEventListener("keydown", e=>{ if(JCX.el || !(e.key==="ContextMenu" || (e.shiftKey && e.key==="F10"))) return; const a=document.activeElement; if(!a || !a.closest || a.closest("input,textarea,select,#jr-body,#ar-body,#cal-body,#ml-list")) return;
  for(const f of CX){ let T=null; try{ T=f(a); }catch(_){} if(T && T.items && T.items.length){ e.preventDefault(); const r=T.row.getBoundingClientRect(); jcxOpen(T, r.left+12, Math.min(r.bottom-4, innerHeight-24), true); return; } } });
const cxDateTxt = iso => { const d=new Date(iso+"T12:00:00"); return isNaN(d) ? fd(iso) : d.getDate()+" "+MONG[d.getMonth()]+", "+["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][d.getDay()]; };
const cxIsoAdd = (iso, n) => { const d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return jIso(d); };
const cxTabOk = t => { const b=document.querySelector(`nav.tabs button[data-tab="${t}"]`); return !!b && !b.hidden && getComputedStyle(b).display!=="none"; };

/* ---------- Товары ---------- */
/* товар — в «Новый документ»: в пустую строку (или новую), курсор в количество */
function cxToDoc(pid, back){ const dr=D.draft; if(!dr) return; const L=dr.lines=dr.lines||[];
  let i=L.findIndex(l=>l.productId===pid);
  if(i<0){ i=L.findIndex(l=>!l.productId && !l.name && !(+l.qty)); const l={productId:pid, qty:"", price:String(getPrice(dr.customerId, pid))};
    if(i<0){ L.push(l); i=L.length-1; } else Object.assign(L[i], l); delete L[i].edName; }
  if(!L.some((x,k)=>k>i && !x.productId)) L.push({productId:"", qty:"", price:""});
  saveLocal();
  const go=()=>{ showTab("doc"); setTimeout(()=>{ const q=document.querySelector(`#d-lines .line[data-i="${i}"] .qty`); if(q){ q.scrollIntoView({block:"center", behavior:"smooth"}); q.focus({preventScroll:true}); } }, 120); };
  if(back) tabBackFrom(back, go); else go();
  toast("ok","Товар добавлен в «Новый документ»","«"+((prod(pid)||{}).name||"")+"» — впишите количество."); }
function cxJournalFind(q, back){ tabBackFrom(back, ()=>{ showTab("journal"); JF().q=q; JF().per="all"; saveLocal(); renderJournal(); const i=$("#jr-q"); if(i) i.value=q; }); }
cxReg(t=>{ const row=t.closest("#pd-body .nmr[data-id]"); if(!row) return null; const p=prod(row.dataset.id); if(!p) return null;
  const lim=docLimited(), a=pArt(p), L=cxList(), open=PDL.open===p.id;
  L.it("edit", open?"Свернуть":"Изменить", "edit", ()=>{ pdToggle(p.id); if(!open) setTimeout(()=>{ const i=document.querySelector(`#pd-body .nmr[data-id="${CSS.escape(p.id)}"] input[data-k="name"]`); i&&i.focus({preventScroll:true}); }, 60); }, {kbd:"Enter"})
   .it("card","Карточка товара","card",()=>pdCard(p.id))
   .sep().it("doc","Добавить в новый документ","plus",()=>cxToDoc(p.id,"Товары"))
   .it("find","Найти в журнале","search",()=>cxJournalFind(p.name,"Товары"));
  if(typeof skItemOf==="function" && SK_READY){ const it=skItemOf(p.id); if(it) L.it("stock","На складе: "+it.name,"box",()=>skItemCard(it.id)); }
  if(!lim && D.catSrv && typeof catList==="function"){ const C=catTops(); if(C.length){ L.sep().chips("Категория", C.map(c=>({lbl:c.name, dot:catCol(c), on:(catTop(catOf(p))||{}).id===c.id,
    fn:()=>{ if((catTop(catOf(p))||{}).id===c.id) return; p.cat=c.id; delete p._ca; dirty("products",p.id); pdToolbar(); renderProducts(); toast("ok","Категория: "+c.name,"«"+p.name+"»"); }}))); } }
  L.sep().it("cpn","Скопировать название","num",()=>jcxCopy(p.name));
  if(a) L.it("cpa","Скопировать артикул «"+a+"»","num",()=>jcxCopy(a));
  if(!lim) L.sep().it("del","Удалить товар","arch",()=>pdDelete(p.id),{danger:1, confirm:"Точно удалить? Нажмите ещё раз"});
  const pr=+p.price>0 ? fm(p.price).replace(/,00$/,"")+" ₽/"+(p.unit||"") : "";
  return {row, items:L.done(), label:"Действия с товаром «"+p.name+"»", head:cxHead(p.name||"Без названия", [a?"арт. "+a:"", catFull(catOf(p)), p.unit||""].filter(Boolean).join(" · "), pr)}; });

/* ---------- Календарь: день ---------- */
function cxCalSel(iso){ const c=CAL(); c.sel=iso; c.ym=iso.slice(0,7); saveLocal(); renderCalendar(); }
function cxNewDoc(iso, cid, back){ const dr0=D.draft, keep=dr0 && !D.journal.some(j=>j.id===dr0.id) && (dr0.lines||[]).some(l=>l.productId && +l.qty>0);
  const go=()=>{ const d=newDraft(D); d.date=iso; D.draft=d; saveLocal();
    tabBackFrom(back, ()=>{ showTab("doc"); const cs=$("#d-cus"); if(cid && cs){ cs.value=cid; cs.dispatchEvent(new Event("change",{bubbles:true})); }
      D.draft.date=iso; const di=$("#d-date"); if(di) di.value=iso; syncNum(); saveLocal(); });
    toast("info","Новый документ на "+fd(iso),"Выберите заказчика и добавьте товары."); };
  if(keep){ toast("warn","В «Новом документе» есть несохранённый документ","Он останется в черновиках. Открыть новый на "+fd(iso)+"?",{action:{label:"Открыть", fn:go}}); return; }
  go(); }
cxReg(t=>{ const row=t.closest("#cal-grid [data-d]"); if(!row) return null; const iso=row.dataset.d, c=CAL(), docs=calDocs(iso, c.cus), staff=isStaff();
  const tasks=DTS().filter(x=>x.date===iso && !x._del), sum=r2(docs.reduce((a,j)=>a+(+j.sum||0),0)), L=cxList();
  L.it("open","Открыть день","open",()=>cxCalSel(iso),{kbd:"Enter"})
   .sep().it("doc","Новый документ на эту дату","plus",()=>cxNewDoc(iso, c.cus, "Календарь"));
  if(cxTabOk("order")) L.it("order","Заявка на эту дату","order",()=>{ const o=O(); o.date=iso; saveLocal(); tabBackFrom("Календарь", ()=>showTab("order")); });
  L.it("task","Задача на этот день","task",()=>{ cxCalSel(iso); setTimeout(()=>{ const b=$("#dt-box"); if(b) b.scrollIntoView({behavior:"smooth", block:"start"}); const x=$("#dt-text"); x&&x.focus({preventScroll:true}); }, 60); });
  if(docs.length){ L.sep().it("route","Маршрут водителю","route",()=>{ cxCalSel(iso); setTimeout(()=>{ const r=$("#cal-route"); r&&r.click(); }, 60); })
    .it("max","Скопировать текст для MAX","clip",()=>{ cxCalSel(iso); setTimeout(()=>{ const t2=$("#dv-text") && $("#dv-text").value; if(t2) jcxCopy(t2); else toast("warn","Нечего копировать","На "+fd(iso)+" нет точек для водителя."); }, 60); })
    .it("pdf","Печать и PDF документов дня","pdf",()=>{ cxCalSel(iso); setTimeout(()=>{ const b=$("#cal-pdf"); b&&!b.disabled&&b.click(); }, 60); });
    if(typeof skDayDocs==="function" && SK_READY && skSrv!==false){ const n=skDayDocs(iso).length; if(n) L.it("ship","Отгрузить со склада ("+n+")","ship",()=>skDayShip(iso)); }
    L.it("find","Документы дня в журнале","search",()=>cxJournalFind(fd(iso),"Календарь")); }
  const sub=[docs.length?docs.length+" "+plural(docs.length,["накладная","накладные","накладных"]):"накладных нет", tasks.length?tasks.length+" "+plural(tasks.length,["задача","задачи","задач"]):""].filter(Boolean).join(" · ");
  return {row, items:L.done(), label:"Действия с днём "+fd(iso), head:cxHead(cxDateTxt(iso), sub, docs.length&&!staff?fm(sum):"")}; });

/* ---------- Календарь: задача на день ---------- */
cxReg(t=>{ const row=t.closest("#dt-list [data-dt]"); if(!row || row.querySelector("textarea") || EDf()) return null; const x=DTS().find(y=>y.id===row.dataset.dt); if(!x) return null;
  const can=dtCan(x), has=s=>!!row.querySelector(s), L=cxList(), cu=x.customerId?cus(x.customerId):null;
  if(can) L.it("edit","Изменить","edit",()=>jcxPress(row,"[data-dtpen]"));
  if(can){ const tm=cxIsoAdd(x.date,1); L.it("move","Перенести на завтра · "+fd(tm).slice(0,5),"next",()=>{ const was=x.date; x.date=tm; dtSave(x,"Перенесена на "+fd(tm)+": "+fmtPlain(x.text).slice(0,80));
    toast("ok","Задача перенесена на "+fd(tm),fmtPlain(x.text).slice(0,90),{action:{label:"Вернуть", fn:()=>{ x.date=was; dtSave(x,"Возвращена на "+fd(was)); }}}); }); }
  if(has("[data-dtdmk]")) L.sep().it("mk","Сделать документы","doc",()=>jcxPress(row,"[data-dtdmk]"));
  if(has("[data-dtdok]")) L.it("dok","Документы уже сделаны","ok",()=>jcxPress(row,"[data-dtdok]"));
  if(has("[data-dtsrc]")) L.it("src","Накладные этой задачи","open",()=>jcxPress(row,"[data-dtsrc]"));
  if(cu && cu.id && x.customerId) L.it("cdoc","Новый документ: "+cusNm(cu.id),"plus",()=>cxNewDoc(x.date, x.customerId, "Календарь"));
  L.sep();
  if(has("[data-phfile]")) L.it("ph","Прикрепить фото","cam",()=>{ const f=row.querySelector("[data-phfile]"); f&&f.click(); });
  L.it("cp","Скопировать текст","clip",()=>jcxCopy(fmtPlain(x.text||"")));
  if(can && has("[data-dtdel]")) L.sep().it("del","Удалить задачу","arch",()=>{ jcxPress(row,"[data-dtdel]"); jcxPress(row,"[data-dtdel]"); },{danger:1, confirm:"Точно удалить? Нажмите ещё раз"});
  const head=cxHead(cu&&cu.id?cusNm(cu.id)+(x.addr?" · "+stLabel(x.addr,cu.address):""):"Задача на день", fd(x.date)+(x.by?" · "+x.by:""), "");
  return {row, items:L.done(), label:"Действия с задачей", head}; });

/* ---------- Склад ---------- */
cxReg(t=>{ const row=t.closest("[data-skitem]"); if(!row || !SK_READY) return null; const X=skIdx(), it=X.item[row.dataset.skitem]; if(!it) return null;
  const L=cxList(), U=skUnitsOf(it.id)||[], q=U.filter(u=>u.fact>0).map(u=>skQf(u.fact, u.unit)).join(" · ");
  L.it("open","Открыть товар","open",()=>skItemCard(it.id),{kbd:"Enter"})
   .it("hist","История товара","hist",()=>skItemHist(it.id))
   .it("decl","Декларации","doc",()=>skItemDecl(it.id));
  if(skCan()) L.sep().it("in","Приход этого товара","inc",()=>skInForm("in", it.id));
  (it._links||[]).slice(0,3).forEach(pid=>{ const p=prod(pid); if(p) L.it("pd"+pid,"Товар на сайте: "+p.name,"card",()=>pdCard(pid)); });
  L.sep().it("cp","Скопировать название","num",()=>jcxCopy(it.name));
  return {row, items:L.done(), label:"Действия с товаром склада", head:cxHead(it.name, q?"на складе: "+q:"", "")}; });
cxReg(t=>{ const row=t.closest("[data-skbatch]"); if(!row || !SK_READY) return null; const X=skIdx(), b=X.batch[row.dataset.skbatch]; if(!b) return null;
  const it=X.item[b.itemId], L=cxList();
  L.it("open","Открыть партию","open",()=>skBatchCard(b.id),{kbd:"Enter"});
  if(it) L.it("item","Товар: "+it.name,"box",()=>skItemCard(it.id)).it("hist","История товара","hist",()=>skItemHist(it.id));
  return {row, items:L.done(), label:"Действия с партией", head:cxHead(it?it.name:"Партия", b.name||"", "")}; });

/* ---------- Закупка по накладным ---------- */
cxReg(t=>{ const row=t.closest("#zkp .zkp-it[data-key]"); if(!row) return null; const it=(ZKP.list||[]).find(x=>x.key===row.dataset.key); if(!it || !it.g || !it.g.length) return null;
  const g=it.g, one=g.length===1, L=cxList(), n=g.map(j=>j.number);
  L.it("zk", ZKP.open===it.key?"Свернуть закупку":"Заполнить закупку здесь","zk",()=>jcxPress(row,"[data-zkpo]"))
   .it("zkw","Закупка отдельным окном","zk",()=> one ? zkPageOpen(g[0]) : bzPageOpen(g))
   .it("open", one?"Открыть накладную":"Открыть комплект · "+g.length,"open",()=> one ? docCard(g[0]) : bundleCard(g))
   .sep().it("cp", one?"Скопировать номер":"Скопировать номера","num",()=>jcxCopy("№ "+(n.length>2?n[0]+"–"+n[n.length-1]:n.join(", "))+" от "+fd(g[0].date)));
  return {row, items:L.done(), label:"Действия с закупкой", head:cxHead("№ "+(n.length>2?n[0]+"–"+n[n.length-1]:n.join(", ")), fd(g[0].date)+" · "+cusNm(g[0].customerId), fm(r2(g.reduce((a,j)=>a+(+j.sum||0),0))))}; });

/* ---------- Цены для заказчика ---------- */
cxReg(t=>{ const tr=t.closest("#pr-body tr"); const i=tr && tr.querySelector("[data-pid]"); if(!i) return null; const p=prod(i.dataset.pid); if(!p) return null;
  const L=cxList(); L.it("card","Карточка товара","card",()=>pdCard(p.id)).it("cp","Скопировать название","num",()=>jcxCopy(p.name));
  return {row:tr, items:L.done(), label:"Действия с товаром", head:cxHead(p.name, p.unit||"", "")}; });

/* ---------- События ---------- */
cxReg(t=>{ const row=t.closest("#ev-body .evr"); if(!row) return null; const u=row.dataset.evu||"", a=row.dataset.eva||"", txt=(row.querySelector(".evx")||{}).textContent||"", L=cxList();
  const set=(sel,v)=>{ const s=$(sel); if(!s) return; if(![...s.options].some(o=>o.value===v)) s.insertAdjacentHTML("beforeend",`<option>${esc(v)}</option>`); s.value=v; s.dispatchEvent(new Event("change",{bubbles:true})); };
  const j=row.dataset.evd && D.journal.find(x=>x.id===row.dataset.evd); if(j) L.it("doc","Открыть накладную № "+j.number,"open",()=>docCard(j,isArch(j)));
  if(u) L.it("u", $("#ev-user").value===u?"Все люди":"Только "+u,"user",()=>set("#ev-user", $("#ev-user").value===u?"":u));
  if(a) L.it("a", $("#ev-type").value===a?"Все действия":"Только «"+a+"»","filter",()=>set("#ev-type", $("#ev-type").value===a?"":a));
  L.sep().it("cp","Скопировать текст","clip",()=>jcxCopy(txt));
  return {row, items:L.done(), label:"Действия с событием", head:cxHead(u||"?", a, "")}; });

/* ---------- «Прибыль → Расходы и доходы» (18.11.2026): запись, группа в разбивке, накладная в ленте, строки итога ---------- */
Object.assign(JCX_I, { swap:'<path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8"/>', del:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>' });
function cxPvCats(L, ids, k, cur){ if(k==="per" || !pvCatOk()) return; const C=pvCats().filter(c=>c.k===k||c.k==="both"); if(!C.length) return;
  L.sep().chips(ids.length>1?"Перенести все в категорию":"Категория", [{lbl:"Без категории", on:cur==="", fn:()=>pvRecSet(ids, null, "")}].concat(C.map(c=>({lbl:c.n, dot:c.h==null?"#bbb":`hsl(${c.h} 50% 55%)`, on:cur===c.id, fn:()=>pvRecSet(ids, null, c.id)})))); }
cxReg(t=>{ const row=t.closest("#pv-fin .pvit[data-pvx]"); if(!row) return null; const x=pfArr("pother").find(y=>y.id===row.dataset.pvx); if(!x) return null;
  const k=pvKind(x), c=pvCatOf(x), L=cxList(), nm=x.note||c.n;
  L.it("edit","Изменить","edit",()=>pvItemOpen(x),{kbd:"Enter"}).it("rep","Повторить с сегодняшней датой","plus",()=>pvItemOpen(x, null, todayISO(), true));
  L.sep(); ["exp","inc","per"].filter(m=>m!==k).forEach(m=>L.it("mv"+m, PV_KTO[m], "swap", ()=>pvRecSet([x.id], m)));
  cxPvCats(L, [x.id], k, k==="per"?"":(x.cat||""));
  const same=pfArr("pother").filter(y=>(y.note||"").trim().toLowerCase()===(x.note||"").trim().toLowerCase() && x.note);
  L.sep(); if(same.length>1) L.it("all","Все записи «"+nm+"» · "+same.length,"search",()=>{ const i=$("#pv-fsq"); if(i){ i.value=x.note; PVFS.q=x.note; pvFsDraw(); i.scrollIntoView({block:"center", behavior:"smooth"}); } });
  L.it("cp","Скопировать «"+nm+" — "+fm(+x.sum||0)+"»","clip",()=>jcxCopy(nm+" — "+fm(+x.sum||0)+" ₽ · "+fd(x.date)));
  L.sep().it("del","Удалить запись","del",()=>pvRecDel([x.id]),{danger:1, confirm:"Точно удалить? Нажмите ещё раз"});
  return {row, items:L.done(), label:"Действия с записью «"+nm+"»", head:cxHead(nm, PV_KT[k]+(k!=="per"?" · "+c.n:"")+" · "+fd(x.date)+(x.by?" · "+x.by:""), (k==="inc"?"+":"−")+fm(+x.sum||0)+" ₽")}; });
cxReg(t=>{ const row=t.closest("#pv-fin .pvcb[data-pvf]"); if(!row) return null; const key=row.dataset.pvf, [k, id]=key.split(/:(.*)/s), ids=pvGroupIds(key); if(!ids.length) return null;
  const X=pfArr("pother").filter(x=>ids.includes(x.id)), nm=k==="per"?(X[0].note||"Без описания"):pvCat(id).n, sum=r2(X.reduce((a,x)=>a+(+x.sum||0),0)), n=ids.length, L=cxList(), nn=n+" "+plural(n,["запись","записи","записей"]);
  L.it("show", PV().fcat===key?"Показать все записи":"Показать только эти записи","filter",()=>row.click()).it("open","Открыть подробно","open",()=>pvFlowCard(k, {c:id}))
   .it("add","Добавить запись сюда","plus",()=>pvAddTo(k, k==="per"?"":id, k==="per"?X[0].note:""));
  L.sep(); ["exp","inc","per"].filter(m=>m!==k).forEach(m=>L.it("mv"+m, PV_KTO[m]+(n>1?" — все "+n:""), "swap", ()=>pvRecSet(ids, m)));
  cxPvCats(L, ids, k, id);
  if(k==="per") L.sep().it("ren","Переименовать «"+nm+"»…","edit",()=>pvRecRename(ids, "Переименовать «"+nm+"»"));
  L.sep().it("del","Удалить "+(n>1?"все "+nn:"запись"),"del",()=>pvRecDel(ids),{danger:1, confirm:"Удалить "+nn+" на "+fm(sum)+" ₽? Ещё раз"});
  return {row, items:L.done(), label:"Действия с «"+nm+"»", head:cxHead(nm, (k==="per"?"Личные":k==="inc"?"Доходы":"Расходы")+" · "+nn+" за период", fm(sum)+" ₽")}; });
cxReg(t=>{ const row=t.closest("#pv-fin [data-pvdoc]"); if(!row) return null; const j=D.journal.find(y=>y.id===row.dataset.pvdoc); if(!j) return null; const p=payOf(j), L=cxList();
  L.it("open","Открыть накладную","open",()=>docCard(j,false),{kbd:"Enter"}).it("zk","Закупка","box",()=>zkPageOpen(j));
  L.sep().it("pay", p.st==="paid"?"Снять отметку «Оплачена»":"Отметить оплаченной", p.st==="paid"?"payoff":"pay", ()=>{ jpayToggle([j], p.st!=="paid"); drawProfit(); }, {sub:p.st==="paid"?(p.d?"оплачена "+fd(p.d):""):"ждём оплату · "+ageTxt(j.date)});
  if(j.customerId) L.it("led","Все накладные «"+cusNm(j.customerId)+"»","card",()=>pvLedger(j.customerId));
  L.sep().it("all","Все накладные периода","search",()=>pvFlowCard("doc"));
  return {row, items:L.done(), label:"Накладная № "+j.number, head:cxHead("№ "+j.number+" · "+fd(j.date), cusNm(j.customerId)||jWho(j).main, fm(docTotal(j))+" ₽")}; });
cxReg(t=>{ const row=t.closest("#pv-fin .pvfr[data-pvflow]"); if(!row) return null; const k=row.dataset.pvflow, L=cxList();
  L.it("open","Открыть подробно","open",()=>pvFlowCard(k),{kbd:"Enter"});
  if(k!=="doc") L.it("add", k==="inc"?"+ Доход":k==="per"?"+ Личный расход":"− Расход","plus",()=>pvItemOpen(null, k));
  else L.it("miss","Накладные без закупки","box",()=>pvFlowCard("doc",{f:"miss"})).it("due","Ждём оплату","pay",()=>pvFlowCard("doc",{f:"due"}));
  return {row, items:L.done(), label:PVFW_T[k][0], head:cxHead(PVFW_T[k][0], pvFinR().R.lab, "")}; });

/* ---------- «Где используется товар»: договоры, прайсы заказчиков, кому возили (19.11.2026, просьба Даниила) ---------- */
const cxLow = v => String(v||"").toLowerCase().replace(/ё/g,"е").replace(/\s+/g," ").trim();
function cxUse(pids){ pids=[...new Set(pids.filter(Boolean))]; const P=new Set(pids), N=new Set(pids.map(id=>cxLow((prod(id)||{}).name)).filter(Boolean));
  const ctrsU=[], seen=new Set();
  (D.contracts||[]).forEach(x=>{ const it=ctSpec(x).find(o=>(o.pid&&P.has(o.pid)) || (!o.pid && N.has(cxLow(o.name)))); if(it){ ctrsU.push({x, it}); seen.add(x.customerId); } });
  const pr=[]; Object.keys(D.prices||{}).forEach(cid=>{ if(!cus(cid)) return; const id=pids.find(pid=>{ const v=custPrice(cid,pid); return v!=null && v!==""; }); if(id) pr.push({cid, pid:id, price:+custPrice(cid,id)}); });
  const dl={}; D.journal.forEach(j=>{ const sn=j.snap||{}, m=sn.meta||{}, dr=sn.dr||{}, cid=j.customerId||dr.customerId, dt=String(j.date||dr.date||""); if(m.arch || !cid) return; if(!(dr.lines||[]).some(l=>P.has(l.productId))) return;
    const o=dl[cid]=dl[cid]||{cid, n:0, last:""}; o.n++; if(dt>o.last) o.last=dt; });
  return {pids, ctrs:ctrsU, prices:pr.sort((a,b)=>String(cusNm(a.cid)).localeCompare(String(cusNm(b.cid)),"ru")), dl:Object.values(dl).sort((a,b)=>b.last.localeCompare(a.last))}; }
function cxUseSub(U){ const a=[]; if(U.ctrs.length) a.push(U.ctrs.length+" "+plural(U.ctrs.length,["договор","договора","договоров"])); if(U.prices.length) a.push("в прайсе у "+U.prices.length);
  const cs=new Set([...U.ctrs.map(o=>o.x.customerId), ...U.prices.map(o=>o.cid), ...U.dl.map(o=>o.cid)]); if(cs.size) a.push(cs.size+" "+plural(cs.size,["заказчик","заказчика","заказчиков"])); return a.join(" · ")||"ни к договору, ни к заказчику не привязан"; }
function cxCardsOff(){ navReset(); const d=document.getElementById("fd-dcard"); if(d && d.open){ d._bye=1; try{ d.close(); }catch(_){} } }
const cxTabLbl = () => { const b=document.querySelector(`nav.tabs button[data-tab="${curTab}"]`); return b ? b.textContent.replace(/[↗]/g,"").trim() : "назад"; };
function cxGoCus(cid){ const back=cxTabLbl(); cxCardsOff(); tabBackFrom(back, ()=>{ editorSel.customers=cid; showTab("customers"); setTimeout(()=>{ const e=$("#cus-editor"); e&&e.scrollIntoView({block:"start", behavior:"smooth"}); }, 80); }); }
function cxGoJournal(q){ const back=cxTabLbl(); cxCardsOff(); cxJournalFind(q, back); }
function cxUseAdd(L, pids, scopeCid){ const U=cxUse(pids), ps=x=>+x>0?fm(x).replace(/,00$/,"")+" ₽":"";
  L.sep(); const done=new Set();
  if(scopeCid) L.it("sc","Связь склада только для «"+cusNm(scopeCid)+"»","user",()=>cxGoCus(scopeCid),{sub:"открыть заказчика"});
  U.ctrs.slice(0,6).forEach(({x,it},k)=>{ done.add(x.customerId); const s=sup(x.supplierId);
    L.it("ct"+k,"Договор «"+(ctrNm(x)||"без названия")+"» · "+(cusNm(x.customerId)||"?"),"doc",()=>ctSpecCard(x.id),{sub:["в товарах по договору", it.price?ps(it.price)+(it.unit?"/"+it.unit:""):"", it.qty?"по договору "+it.qty+(it.unit?" "+it.unit:""):"", s?supSurname(s.id):""].filter(Boolean).join(" · ")}); });
  if(U.ctrs.length>6) L.it("ctm","Ещё договоров: "+(U.ctrs.length-6),"doc",()=>cxGoCus(U.ctrs[6].x.customerId));
  U.prices.filter(o=>!done.has(o.cid)).slice(0,6).forEach((o,k)=>{ done.add(o.cid); const c=ctrs(o.cid).filter(x=>!x.dateTo||x.dateTo>=todayISO());
    L.it("pr"+k,"Прайс заказчика «"+cusNm(o.cid)+"»","user",()=>cxGoCus(o.cid),{sub:[ps(o.price)+"/"+((prod(o.pid)||{}).unit||""), c.length?"договоров: "+c.length+" (товара нет в «Товарах по договору»)":"без договора"].filter(Boolean).join(" · ")}); });
  U.dl.filter(o=>!done.has(o.cid)).slice(0,4).forEach((o,k)=>L.it("dl"+k,"Возили «"+cusNm(o.cid)+"»","route",()=>cxGoJournal((prod(U.pids[0])||{}).name||""),{sub:o.n+" "+plural(o.n,["накладная","накладные","накладных"])+(o.last?" · последняя "+fd(o.last):"")+" · не в прайсе"}));
  if(!U.ctrs.length && !U.prices.length && !U.dl.length) L.it("none","Не привязан ни к договору, ни к заказчику","search",()=>{},{sub:"нет в «Товарах по договору», в прайсах и в накладных"});
  return U; }
/* общее меню товара сайта (позиции документов) */
function cxProdMenu(row, pid, extra){ const p=prod(pid); if(!p) return null; const L=cxList();
  if(extra && extra.pre) extra.pre(L);
  L.it("card","Карточка товара","card",()=>pdCard(p.id));
  const U=cxUseAdd(L, (typeof pgSameIds==="function"?pgSameIds(p.id):null)||[p.id], extra&&extra.cid);
  L.sep().it("find","Найти в журнале","search",()=>cxGoJournal(p.name));
  L.it("cpn","Скопировать название","num",()=>jcxCopy(p.name));
  if(extra && extra.post) extra.post(L);
  const a=pArt(p);
  return {row, items:L.done(), label:"Товар «"+p.name+"» — где используется", head:cxHead(p.name, [a?"арт. "+a:"", cxUseSub(U)].filter(Boolean).join(" · "), "")}; }
/* окно товара склада: связанные позиции и подсказки «Похоже по названию» */
cxRegFirst(t=>{ const row=t.closest("dialog.dcard .sklink[data-pid]"); if(!row) return null; const x=row.querySelector("[data-skunlink]");
  return cxProdMenu(row, row.dataset.pid, {cid:row.dataset.cid||"", post:L=>{ if(x && skCan()) L.sep().it("unl","Убрать связь со складом","arch",()=>{ x.click(); x.click(); },{danger:1, confirm:"Убрать связь? Нажмите ещё раз"}); }}); });
cxRegFirst(t=>{ const row=t.closest("dialog.dcard .sklsb[data-sklink]"); if(!row) return null;
  return cxProdMenu(row, skLkP(row.dataset.sklink), {pre:L=>L.it("link","Связать с этим товаром склада","plus",()=>row.click()).sep()}); });
/* окно накладной / комплекта: название товара */
cxRegFirst(t=>{ const row=t.closest("dialog.dcard [data-dcpd]"); if(!row) return null; return cxProdMenu(row, row.dataset.dcpd); });
/* «Товары»: тот же раздел «где используется» в меню строки */
{ const base=CX.find(f=>String(f).includes('#pd-body .nmr[data-id]')); if(base){ const i=CX.indexOf(base); CX[i]=t=>{ const T=base(t); if(!T) return T; const pid=T.row.dataset.id, L=cxList(); L.out.push(...T.items);
    const k=T.items.findIndex(o=>o.id==="find"); const tail=k>=0?L.out.splice(k):[]; cxUseAdd(L, (typeof pgSameIds==="function"?pgSameIds(pid):null)||[pid]); L.sep(); L.out.push(...tail);
    T.items=L.done(); T.head=T.head.replace(/<small>([^<]*)<\/small>/, (m,a)=>`<small>${a}${a?" · ":""}${esc(cxUseSub(cxUse((typeof pgSameIds==="function"?pgSameIds(pid):null)||[pid])))}</small>`); return T; }; } }
/* склад: строка товара — где используются его позиции */
{ const base=CX.find(f=>String(f).includes('t.closest("[data-skitem]")')); if(base){ const i=CX.indexOf(base); CX[i]=t=>{ const T=base(t); if(!T) return T; const it=skIdx().item[T.row.dataset.skitem]; const pids=(it&&it._links)||[]; if(!pids.length) return T;
    const L=cxList(); L.out.push(...T.items); const k=L.out.findIndex(o=>o.id==="cp"); const tail=k>=0?L.out.splice(k):[]; cxUseAdd(L, pids); L.sep(); L.out.push(...tail); T.items=L.done(); return T; }; } }
/* «Заказчики и цены» → договор (карточка) */
cxReg(t=>{ const row=t.closest("#ct-body .ctc[data-id]"); if(!row) return null; const x=ctr(row.dataset.id); if(!x) return null; const L=cxList(), n=ctSpec(x).length, u=ctUrl(x.url);
  L.it("spec", n?"Товары по договору · "+n:"Добавить товары по договору","order",()=>ctSpecCard(x.id));
  if(u) L.it("url","Открыть договор ↗","next",()=>window.open(u,"_blank","noopener"));
  L.it("nd","Новый документ по этому договору","plus",()=>{ tabBackFrom("Заказчики и цены", ()=>{ showTab("doc"); const cs=$("#d-cus"); if(cs){ cs.value=x.customerId; cs.dispatchEvent(new Event("change",{bubbles:true})); } setTimeout(()=>{ const c=$("#d-ctr"); if(c && [...c.options].some(o=>o.value===x.id)){ c.value=x.id; c.dispatchEvent(new Event("change",{bubbles:true})); } }, 60); }); })
   .sep().it("cpb","Скопировать основание","num",()=>jcxCopy(x.basis||""));
  if(x.ikz) L.it("cpi","Скопировать ИКЗ","num",()=>jcxCopy(String(x.ikz)));
  const s=sup(x.supplierId);
  return {row, items:L.done(), label:"Договор «"+(ctrNm(x)||"")+"»", head:cxHead(ctrNm(x)||x.basis||"Договор", [s?supSurname(s.id):"", n?n+" "+plural(n,["позиция","позиции","позиций"])+" по договору":"товары по договору не заполнены"].filter(Boolean).join(" · "), x.sum?fm(x.sum).replace(/,00$/,"")+" ₽":"")}; });

/* ---------- Вкладки сверху (25.11.2026, просьба Даниила): карандаш убран, всё — правой кнопкой ---------- */
Object.assign(JCX_I, { move:'<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
  left:'<path d="M15 6l-6 6 6 6"/>', right:'<path d="M9 6l6 6-6 6"/>', first:'<path d="M17 6l-6 6 6 6M7 6v12"/>', last:'<path d="M7 6l6 6-6 6M17 6v12"/>',
  newt:'<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', link:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  undo:'<path d="M3 10h11a6 6 0 0 1 0 12h-3"/><path d="M7 6l-4 4 4 4"/>' });
function cxTabUrl(id){ if(id==="pdf") return PDF_URL; if(id==="contracts") return CONTRACTS_URL; const s=TAB_SLUG[id]; return s ? location.href.split("#")[0]+"#"+s : ""; }
function cxTabMove(b, where){ if(!TABMV) return; const nav=TABMV.nav, L=[...nav.querySelectorAll("button[data-tab]")].filter(x=>!x.hidden), i=L.indexOf(b); if(i<0) return;
  const to = where==="l" ? L[i-1] : where==="r" ? L[i+1]?.nextSibling : where==="f" ? L[0] : L[L.length-1]?.nextSibling;
  if(where==="l" && !L[i-1] || where==="r" && i>=L.length-1 || where==="f" && i===0 || where==="e" && i===L.length-1) return;
  TABMV.flip(()=>nav.insertBefore(b, to||$("#tab-edit"))); TABMV.save();
  toast("ok","Вкладка «"+b.textContent.replace("↗","").trim()+"» перенесена","Порядок сохранён на всех ваших устройствах."); }
cxReg(t=>{ const b=t.closest("#fd-app nav.tabs button[data-tab]"); if(!b || b.hidden || !TABMV) return null;
  const nav=TABMV.nav, id=b.dataset.tab, nm=b.textContent.replace("↗","").trim(), ed=nav.classList.contains("editing"), url=cxTabUrl(id), ext=id==="pdf"||id==="contracts";
  const L0=[...nav.querySelectorAll("button[data-tab]")].filter(x=>!x.hidden), i=L0.indexOf(b), L=cxList();
  if(!ext && id!==curTab && !ed) L.it("open","Открыть","open",()=>goTab(id));
  if(url) L.it("newt", ext?"Открыть ↗":"Открыть в новой вкладке браузера","newt",()=>window.open(url,"_blank","noopener"));
  if(url && !ext) L.it("link","Скопировать ссылку на вкладку","link",()=>jcxCopy(url));
  L.sep();
  L.it("move","Переместить вкладки…","move",()=>openSheet(true), {sub:"все вкладки плитками — перетаскивайте"});
  if(i>0) L.it("l","Сдвинуть влево","left",()=>cxTabMove(b,"l"));
  if(i<L0.length-1) L.it("r","Сдвинуть вправо","right",()=>cxTabMove(b,"r"));
  if(i>1) L.it("f","В начало","first",()=>cxTabMove(b,"f"));
  if(i<L0.length-2) L.it("e","В конец","last",()=>cxTabMove(b,"e"));
  if((getPrefs().tabs||[]).length){ L.sep().it("reset","Вернуть порядок как было","undo",()=>{ const p=getPrefs(); delete p.tabs; setPrefs(p,true); TABMV.flip(applyTabOrder); toast("ok","Порядок вкладок — как было"); }); }
  return {row:b, items:L.done(), label:"Действия с вкладкой", head:cxHead(nm, i+1+" из "+L0.length, "")}; });
