/* ===== Меню правой кнопкой по всему сайту (16.11.2026, cx_seg.js) =====
   Одно оформление и поведение с меню журнала (jcxOpen): у курсора, не за краем экрана, ↑↓ / Enter / Esc, плавно.
   Провайдер — функция (элемент под курсором) → {row, head, items, label} или null; первый подошедший открывает меню.
   Shift + правая кнопка, поля ввода и выделенный текст — обычное меню браузера. */
const CX=[];
const cxReg = f => CX.push(f);
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
  if(t.closest("input,textarea,select,[contenteditable=''],[contenteditable='true'],.jcx,dialog")) return;
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
function cxJournalFind(q, back){ tabBackFrom(back, ()=>{ showTab("journal"); JF().q=q; saveLocal(); renderJournal(); const i=$("#jr-q"); if(i) i.value=q; }); }
cxReg(t=>{ const row=t.closest("#pd-body .nmr[data-id]"); if(!row) return null; const p=prod(row.dataset.id); if(!p) return null;
  const lim=docLimited(), a=pArt(p), L=cxList(), open=PDL.open===p.id;
  L.it("edit", open?"Свернуть":"Изменить", "edit", ()=>{ pdToggle(p.id); if(!open) setTimeout(()=>{ const i=document.querySelector(`#pd-body .nmr[data-id="${CSS.escape(p.id)}"] input[data-k="name"]`); i&&i.focus({preventScroll:true}); }, 60); }, {kbd:"Enter"})
   .it("card","Карточка товара","card",()=>pdCard(p.id))
   .sep().it("doc","Добавить в новый документ","plus",()=>cxToDoc(p.id,"Товары"))
   .it("find","Найти в журнале","search",()=>cxJournalFind(p.name,"Товары"));
  if(typeof skItemOf==="function" && SK_READY){ const it=skItemOf(p.id); if(it) L.it("stock","На складе: "+it.name,"box",()=>skItemCard(it.id)); }
  if(!lim && D.catSrv && typeof catList==="function"){ const C=catList(); if(C.length){ L.sep().chips("Категория", C.map(c=>({lbl:c.name, dot:c.color||"#bbb", on:p.cat===c.id,
    fn:()=>{ if(p.cat===c.id) return; p.cat=c.id; delete p._ca; dirty("products",p.id); pdToolbar(); renderProducts(); toast("ok","Категория: "+c.name,"«"+p.name+"»"); }}))); } }
  L.sep().it("cpn","Скопировать название","num",()=>jcxCopy(p.name));
  if(a) L.it("cpa","Скопировать артикул «"+a+"»","num",()=>jcxCopy(a));
  if(!lim) L.sep().it("del","Удалить товар","arch",()=>pdDelete(p.id),{danger:1, confirm:"Точно удалить? Нажмите ещё раз"});
  const pr=+p.price>0 ? fm(p.price).replace(/,00$/,"")+" ₽/"+(p.unit||"") : "";
  return {row, items:L.done(), label:"Действия с товаром «"+p.name+"»", head:cxHead(p.name||"Без названия", [a?"арт. "+a:"", (catOf(p)||{}).name||"", p.unit||""].filter(Boolean).join(" · "), pr)}; });

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
    .it("pdf","Скачать все Счета+ТОРГ","pdf",()=>{ cxCalSel(iso); setTimeout(()=>{ const b=$("#cal-pdf"); b&&!b.disabled&&b.click(); }, 60); });
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
