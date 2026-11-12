/* ===== «Аналитика покупок» заказчика (вкладка «Заказчики и цены») — 12.11.2026 =====
   сравнение с прошлым периодом / годом раньше, закупка и прибыль (только admin, по docProfit), плитки нажимаются (окно документов),
   столбики — выбор дня (фильтр), «По точкам» — фильтр точки, товар раскрывается: поставки, цены, закупка, «Карточка товара ›». */
const CA={docs:[], prev:null, range:["0000","9999"], prange:null, cmp:"prev", metric:"sum", sel:"", pt:"", q:"", open:new Set(), sort:"sum", all:false, shown:{}, cid:"", load:false};
let caAll=false, caSort="sum", caLast=null;   /* старые имена — на случай внешних вызовов */
const CA_MON=["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const caRub = v => fm(v).replace(/,00$/,"");
const caQf = new Intl.NumberFormat("ru-RU",{maximumFractionDigits:3});
const caIsoAdd = (iso, d) => { const x=new Date(iso+"T12:00:00"); x.setDate(x.getDate()+d); return jIso(x); };
const caAddM = (iso, m) => { const y=+iso.slice(0,4), mo=+iso.slice(5,7)-1, d=+iso.slice(8,10), t=new Date(y, mo+m, 1, 12), last=new Date(t.getFullYear(), t.getMonth()+1, 0).getDate(); t.setDate(Math.min(d,last)); return jIso(t); };
const caMonEnd = iso => jIso(new Date(+iso.slice(0,4), +iso.slice(5,7), 0, 12));
const caDays = (a,b) => Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/864e5)+1;
function caRange(per, from, to){ const n=new Date(), wd=(n.getDay()+6)%7, mon=new Date(n.getFullYear(), n.getMonth(), n.getDate()-wd, 12);
  if(per==="week") return [jIso(mon), caIsoAdd(jIso(mon),6)];
  if(per==="pweek"){ const a=caIsoAdd(jIso(mon),-7); return [a, caIsoAdd(a,6)]; }
  return pfRange({per, from, to}); }
/* период для сравнения: календарные месяцы — сдвиг на столько же месяцев, иначе — на столько же дней; текущий период — только по сегодняшний день */
function caPrevRange(r, mode){ const [a,b]=r; if(a==="0000"||b==="9999"||mode==="none") return null; const t=todayISO();
  if(a>t) return null; const eb = b>t ? t : b;
  if(mode==="year") return [caAddM(a,-12), caAddM(eb,-12)];
  const months = a.slice(8)==="01" && b===caMonEnd(b) ? (+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5,7)-+a.slice(5,7))+1 : 0;
  if(months) return [caAddM(a,-months), eb===b ? caMonEnd(caAddM(b,-months)) : caAddM(eb,-months)];
  const span=caDays(a,b); return [caIsoAdd(a,-span), caIsoAdd(eb,-span)]; }
const caRngTxt = r => { if(!r) return ""; const [a,b]=r; if(a===b) return fd(a); return a.slice(0,4)===b.slice(0,4) ? fd(a).slice(0,5)+"–"+fd(b) : fd(a)+"–"+fd(b); };
/* документ → строки с ценой; накладная на устройстве — с закупкой (docProfit, только admin) */
function caNorm(doc, cid){
  const j = (doc.id && D.journal.find(x=>x.id===doc.id)) || D.journal.find(x=>x.customerId===cid && !isArch(x) && x.date===doc.date && String(x.number)===String(doc.number));
  let lines=[], dp=null;
  if(me().admin && j && pfLoaded){ try{ dp=docProfit(j); }catch(e){ dp=null; } }
  if(dp){ lines=dp.lines.map(r=>{ const l=r.l; let c=null;
      if(dp.src) c = dp.rev ? r2(dp.cost*l.sum/dp.rev) : 0;
      else if(r.free) c=0; else if(r.sk) c = r.c!=null ? r2(r.c*l.qty) : null; else if(r.c!=null) c = r2((r.cu!=null?r.cu:r.c)*l.qty);
      return {pid:l.pid, qty:l.qty, price:l.qty?r2(l.sum/l.qty):0, sum:l.sum, name:l.name, unit:l.unit, cost:c}; }); }
  else { const P=(doc.snap&&doc.snap.prods)||{};
    (doc.snap&&doc.snap.dr&&doc.snap.dr.lines||[]).forEach(l=>{ const q=+l.qty; if(!l.productId || !(q>0)) return; const pr=l.price===""||l.price==null?null:+l.price, p=P[l.productId]||{};
      lines.push({pid:l.productId, qty:q, price:pr, sum:pr==null||isNaN(pr)?null:r2(q*pr), name:p.name||l.name||"", unit:String(p.unit||"").trim(), cost:null}); }); }
  const ds=+doc.sum, hasSum=!(doc.sum==null||doc.sum===""||!(ds>=0));
  const pt = (j && (jWho(j).pt||kLbl(j))) || (doc.snap&&doc.snap.dr&&doc.snap.dr.ship) || "";
  return {date:doc.date||"", number:doc.number, sum:hasSum?ds:null, lines, pt:String(pt||"").trim(), j, dp}; }
function caAgg(L){ const P=new Map(), byDay={}, pts=new Map(); let sum=0, kg=0, last="", hasSum=true, cost=0, profit=0, cn=0, miss=0;
  L.forEach(d=>{ if(d.sum==null) hasSum=false; else sum+=d.sum; if(d.date){ if(d.date>last) last=d.date; const b=byDay[d.date]=byDay[d.date]||{sum:0,n:0,kg:0,profit:0}; b.sum+=d.sum||0; b.n++; }
    if(d.dp){ cn++; cost+=d.dp.cost; profit+=d.dp.profit; if(d.dp.miss) miss++; if(d.date) byDay[d.date].profit+=d.dp.profit; }
    const pk=d.pt||"Адрес не указан", po=pts.get(pk)||{name:pk, sum:0, n:0}; po.sum+=d.sum||0; po.n++; pts.set(pk, po);
    const seen=new Set();
    d.lines.forEach(l=>{ const rt=pgRootId(l.pid), key=rt+"|"+l.unit;
      const it=P.get(key)||{key, pid:rt, name:(rt!==l.pid&&prod(rt)?prod(rt).name:"")||l.name||"Товар из документа", unit:l.unit, qty:0, sum:0, n:0, priced:true, cost:0, cq:0, cmiss:false, lo:Infinity, hi:0, dl:[]};
      it.qty+=l.qty; if(l.sum==null) it.priced=false; else { it.sum+=l.sum; if(l.price>0){ it.lo=Math.min(it.lo,l.price); it.hi=Math.max(it.hi,l.price); } }
      if(l.cost!=null){ it.cost+=l.cost; it.cq+=l.qty; } else it.cmiss=true;
      if(l.unit==="кг"){ kg+=l.qty; if(d.date) byDay[d.date].kg+=l.qty; }
      it.dl.push({d, qty:l.qty, price:l.price, sum:l.sum, cost:l.cost});
      if(!seen.has(key)){ it.n++; seen.add(key); } P.set(key, it); }); });
  const rows=[...P.values()]; rows.forEach(r=>{ r.sum=r2(r.sum); r.cost=r2(r.cost); });
  return {n:L.length, sum:r2(sum), kg, last, hasSum, rows, byDay, pts:[...pts.values()].sort((a,b)=>b.sum-a.sum), cost:r2(cost), profit:r2(profit), cn, miss, priced:rows.length>0&&rows.every(r=>r.priced)}; }
/* общая точка входа (её зовёт renderCustomerAnalytics) */
function drawCustomerAnalytics(docs, range, prev, prange){
  const cid=analyticsCustomer, same=CA.cid===cid && CA.range[0]===range[0] && CA.range[1]===range[1];
  if(!same){ CA.sel=""; CA.pt=""; CA.open=new Set(); CA.all=false; CA.q=""; CA.shown={}; }
  CA.cid=cid; CA.range=range; CA.raw=docs; CA.docs=docs.map(d=>caNorm(d, cid)); CA.prange=prange||null; CA.prev=prev?prev.map(d=>caNorm(d, cid)):null;
  caLast={docs, range}; const fresh=!same||!$("#ca-tl"); caDraw(fresh); }
function caFiltered(){ return CA.docs.filter(d=>(!CA.sel || caBucket(d.date)===CA.sel) && (!CA.pt || (d.pt||"Адрес не указан")===CA.pt)); }
function caByMonth(){ const [a,b]=caSpan(); return a&&b ? caDays(a,b)>62 : false; }
function caSpan(){ const r=CA.range, ds=CA.docs.map(d=>d.date).filter(Boolean).sort(); return [r[0]!=="0000"?r[0]:(ds[0]||""), r[1]!=="9999"?r[1]:(ds[ds.length-1]||"")]; }
const caBucket = iso => !iso ? "" : caByMonth() ? iso.slice(0,7) : iso;
function caDraw(fresh){ const box=$("#ca-result"); if(!box) return;
  if(!CA.docs.length){ box.innerHTML=`${caCmpBar()}<div class="ca-empty"><b>Покупок нет</b><span>За ${caRngTxt(CA.range[0]==="0000"?null:CA.range)||"выбранный период"} документов у этого заказчика нет.${CA.prev&&CA.prev.length?` А за ${caRngTxt(CA.prange)} было ${CA.prev.length} ${plural(CA.prev.length,["документ","документа","документов"])} на ${caRub(caAgg(CA.prev).sum)} ₽.`:""}</span></div>`; return; }
  box.innerHTML = caCmpBar()+`<div id="ca-tl"></div><div id="ca-chw"></div><div id="ca-ptw"></div><div id="ca-chg"></div><div id="ca-tw"></div>`;
  caPart(fresh!==false); }
/* перерисовка частей (при фильтре дня/точки/поиске) — без мигания, числа доезжают плавно */
function caPart(first){ const A=caAgg(caFiltered()), P=CA.prev&&!CA.sel&&!CA.pt?caAgg(CA.prev):null;
  caTiles(A, P, first); caChart(first); caPts(first); caChanges(A, P); caTable(A, P, first); }
function caCmpBar(){ const ok=CA.range[0]!=="0000"&&CA.range[1]!=="9999";
  const b=(k,t)=>`<button type="button" data-cacmp="${k}" class="${CA.cmp===k?"on":""}" aria-pressed="${CA.cmp===k}">${t}</button>`;
  return `<div class="ca-cmp">${ok?`<span class="muted">Сравнить</span><div class="ca-per sm" role="group" aria-label="Сравнить">${b("prev","с прошлым периодом")}${b("year","с прошлым годом")}${b("none","не сравнивать")}</div>${CA.prange&&CA.cmp!=="none"?`<small class="muted">${caRngTxt([CA.range[0], CA.range[1]>todayISO()&&CA.range[0]<=todayISO()?todayISO():CA.range[1]])} ↔ ${caRngTxt(CA.prange)}</small>`:""}`:`<small class="muted">За всё время сравнивать не с чем — выберите период.</small>`}</div>`; }
function caDelta(cur, prev, inv){ if(prev==null) return ""; if(!prev && !cur) return `<span class="ca-d eq">как было</span>`; if(!prev) return `<span class="ca-d up">новое</span>`;
  const d=(cur-prev)/Math.abs(prev)*100, a=Math.abs(d); if(a<0.5) return `<span class="ca-d eq" title="было ${caRub(prev)}">≈ как было</span>`;
  const up=d>0, good=inv?!up:up; return `<span class="ca-d ${good?"up":"dn"}" title="было ${caRub(prev)}">${up?"▲":"▼"} ${a>=100?Math.round(a):a.toFixed(a<10?1:0).replace(".",",")}%</span>`; }
function caTiles(A, P, first){ const el=$("#ca-tl"); if(!el) return; const adm=me().admin, avg=A.n&&A.hasSum?r2(A.sum/A.n):0, pavg=P&&P.n&&P.hasSum?r2(P.sum/P.n):null;
  const T=[{k:"docs", l:"Документов", v:A.n, f:"n", p:P?P.n:null},
    A.hasSum&&{k:"sum", l:"Сумма покупок", v:A.sum, f:"r", p:P?P.sum:null, hi:1},
    A.hasSum&&{k:"avg", l:"Средний чек", v:avg, f:"r", p:pavg},
    A.kg>0&&{k:"kg", l:"Объём", v:A.kg, f:"kg", p:P?P.kg:null},
    {k:"items", l:"Разных товаров", v:A.rows.length, f:"n", p:P?P.rows.length:null},
    adm&&{k:"cost", l:"Закупка", v:A.cost, f:"r", p:P&&P.cn&&A.cn>A.miss?P.cost:null, inv:1, sub: !pfLoaded?"загружаю…": A.cn<A.n?`нет данных у ${A.n-A.cn}`: A.miss?`без закупки: ${A.miss}`:(A.sum?`${pct(A.cost,A.sum)} от суммы`:"")},
    adm&&{k:"profit", l:"Прибыль", v:A.profit, f:"r", p:P&&P.cn&&A.cn>A.miss?P.profit:null, good:1, sub: !(A.sum&&pfLoaded)?"": A.miss?`завышена: без закупки ${A.miss} ${plural(A.miss,["документ","документа","документов"])}`:`${pct(A.profit,A.sum)} от суммы · после налога`},
    A.last&&{k:"last", l:"Последняя поставка", last:A.last}].filter(Boolean);
  const html=T.map((t,i)=>t.last ? `<button type="button" class="ca-tile" data-cat="${t.k}" style="--d:${i*40}ms"><small>${t.l}</small><b>${fd(t.last)}</b><span>${(d=>d===0?"сегодня":dnum(d)+" назад")(daysSince(t.last))} ›</span></button>`
    : `<button type="button" class="ca-tile${t.hi?" hi":""}${t.good&&t.v<0?" neg":""}" data-cat="${t.k}" style="--d:${i*40}ms"><small>${t.l}</small><b data-cu="${t.v}" data-cf="${t.f}">${caFmt(CA.shown[t.k]!=null?CA.shown[t.k]:0, t.f)}</b><span>${caDelta(t.v, t.p, t.inv)}${t.sub?`<em>${esc(t.sub)}</em>`:""}</span></button>`).join("");
  el.innerHTML=`<div class="ca-tiles${first?"":" calm"}">${html}</div>`;
  el.querySelectorAll("[data-cu]").forEach(b=>{ const t=T.find(x=>x.k===b.parentNode.dataset.cat); caCount(b, CA.shown[t.k]!=null?CA.shown[t.k]:0, t.v, t.f); CA.shown[t.k]=t.v; }); }
const caFmt = (v,f) => f==="n" ? String(Math.round(v)) : f==="kg" ? caQf.format(Math.round(v*10)/10)+" кг" : caRub(r2(v))+" ₽";
function caCount(el, from, to, f){ if(from===to || matchMedia("(prefers-reduced-motion: reduce)").matches){ el.textContent=caFmt(to,f); return; }
  const t0=performance.now(), D=650; el._cu=(el._cu||0)+1; const id=el._cu;
  const step=t=>{ if(el._cu!==id) return; const k=Math.min(1,(t-t0)/D), e=1-Math.pow(1-k,3); el.textContent=caFmt(k<1?from+(to-from)*e:to, f); if(k<1) requestAnimationFrame(step); };
  requestAnimationFrame(step); }
function caChart(first){ const el=$("#ca-chw"); if(!el) return; const A=caAgg(CA.docs.filter(d=>!CA.pt||(d.pt||"Адрес не указан")===CA.pt)); if(!A.hasSum){ el.innerHTML=""; return; }
  const byMonth=caByMonth(), [lo,hi]=caSpan(); if(!lo||!hi){ el.innerHTML=""; return; }
  const keys=[]; { const c=new Date(lo+"T12:00:00"), e=new Date(hi+"T12:00:00"); if(byMonth){ c.setDate(1); while(c<=e && keys.length<60){ keys.push(jIso(c).slice(0,7)); c.setMonth(c.getMonth()+1); } } else { while(c<=e && keys.length<70){ keys.push(jIso(c)); c.setDate(c.getDate()+1); } } }
  if(keys.length<2){ el.innerHTML=""; return; }
  const M=CA.metric, val=b=>!b?0:M==="n"?b.n:M==="kg"?b.kg:M==="profit"?b.profit:b.sum, B={}; Object.keys(A.byDay).forEach(d=>{ const k=byMonth?d.slice(0,7):d, x=B[k]=B[k]||{sum:0,n:0,kg:0,profit:0}, y=A.byDay[d]; x.sum+=y.sum; x.n+=y.n; x.kg+=y.kg; x.profit+=y.profit; });
  /* прошлый период — призрачные столбики того же порядкового дня/месяца */
  let G=null; if(CA.prev&&CA.prange&&CA.cmp!=="none"){ const PA=caAgg(CA.prev); G={}; const pk=[]; const c=new Date(CA.prange[0]+"T12:00:00"); if(byMonth) c.setDate(1);
    for(let i=0;i<keys.length;i++){ pk.push(byMonth?jIso(c).slice(0,7):jIso(c)); if(byMonth) c.setMonth(c.getMonth()+1); else c.setDate(c.getDate()+1); }
    Object.keys(PA.byDay).forEach(d=>{ const k=byMonth?d.slice(0,7):d, i=pk.indexOf(k); if(i<0) return; const x=G[i]=G[i]||{sum:0,n:0,kg:0,profit:0}, y=PA.byDay[d]; x.sum+=y.sum; x.n+=y.n; x.kg+=y.kg; x.profit+=y.profit; }); G.pk=pk; }
  const vals=keys.map(k=>val(B[k])), gv=G?keys.map((k,i)=>val(G[i])):[], bm=Math.max(...vals.map(Math.abs), ...gv.map(Math.abs))||1;
  const lbl=k=>byMonth?CA_MON[+k.slice(5,7)-1]+(k.slice(0,4)!==String(new Date().getFullYear())?" "+k.slice(2,4):""):String(+k.slice(8,10));
  const fv=v=>M==="n"?v+" "+plural(v,["документ","документа","документов"]):M==="kg"?caQf.format(Math.round(v*10)/10)+" кг":caRub(r2(v))+" ₽";
  const mb=(k,t)=>`<button type="button" data-camet="${k}" class="${M===k?"on":""}" aria-pressed="${M===k}">${t}</button>`;
  const head=`<div class="ca-ch-h"><b>Покупки ${byMonth?"по месяцам":"по дням"}</b><div class="ca-per sm" role="group" aria-label="Что показывать">${mb("sum","Сумма")}${mb("n","Документы")}${A.kg?mb("kg","Кг"):""}${me().admin&&pfLoaded?mb("profit","Прибыль"):""}</div>${G?`<span class="ca-lg"><i></i>${caRngTxt(CA.prange)}</span>`:""}<small class="muted">${CA.sel?"":"нажмите на столбик — покажу только этот "+(byMonth?"месяц":"день")}</small></div>`;
  const cols=keys.map((k,i)=>{ const v=vals[i], g=G?gv[i]:null, b=B[k], tt=(byMonth?CA_MON[+k.slice(5,7)-1]+" "+k.slice(0,4):fd(k))+": "+(b?fv(v):"нет покупок")+(G?` · было ${g?fv(g):"0"} (${byMonth?CA_MON[+G.pk[i].slice(5,7)-1]+" "+G.pk[i].slice(0,4):fd(G.pk[i])})`:"");
    return `<button type="button" class="ca-col${b?"":" z"}${CA.sel===k?" sel":""}${CA.sel&&CA.sel!==k?" dim":""}${v<0?" neg":""}" data-cacol="${b?k:""}" title="${esc(tt)}" aria-label="${esc(tt)}"${b?"":" tabindex=\"-1\""}>${G?`<s style="--g:${(Math.abs(g)/bm*100).toFixed(1)}"></s>`:""}<i style="--h:${(Math.abs(v)/bm*100).toFixed(1)}%;--d:${first?Math.min(i*18,600):0}ms"><em>${b?esc(fv(v)):""}</em></i><span>${keys.length<=16||i%Math.ceil(keys.length/12)===0?lbl(k):""}</span></button>`; }).join("");
  el.innerHTML=`<div class="ca-chart${first?"":" calm"}">${head}<div class="ca-cols" style="--n:${keys.length}">${cols}</div>${CA.sel?`<div class="ca-selbar">Показан только ${byMonth?CA_MON[+CA.sel.slice(5,7)-1]+" "+CA.sel.slice(0,4):fd(CA.sel)} <button type="button" class="btn ghost sm" data-caclr="sel">Весь период ×</button></div>`:""}</div>`; }
function caPts(first){ const el=$("#ca-ptw"); if(!el) return; const A=caAgg(CA.docs.filter(d=>!CA.sel||caBucket(d.date)===CA.sel)); if(A.pts.length<2){ el.innerHTML=CA.pt?`<div class="ca-selbar">Точка: ${esc(CA.pt)} <button type="button" class="btn ghost sm" data-caclr="pt">Все точки ×</button></div>`:""; return; }
  const mx=Math.max(...A.pts.map(p=>p.sum))||1, lim=CA.ptAll?A.pts:A.pts.slice(0,6);
  el.innerHTML=`<div class="ca-pts${first?"":" calm"}"><div class="ca-ch-h"><b>По точкам</b><small class="muted">${A.pts.length} ${plural(A.pts.length,["точка","точки","точек"])} · нажмите — только эта точка</small>${CA.pt?`<button type="button" class="btn ghost sm" data-caclr="pt">Все точки ×</button>`:""}</div>
    ${lim.map((p,i)=>`<button type="button" class="ca-pt${CA.pt===p.name?" on":""}${CA.pt&&CA.pt!==p.name?" dim":""}" data-capt="${esc(p.name)}" style="--d:${i*30}ms"><span class="ca-ptn">${esc(p.name)}</span><span class="ca-ptb"><i style="--w:${(p.sum/mx*100).toFixed(1)}%"></i></span><span class="ca-pts2"><b>${caRub(r2(p.sum))} ₽</b><small>${p.n} ${plural(p.n,["док.","док.","док."])}</small></span></button>`).join("")}
    ${A.pts.length>6?`<button type="button" class="btn ghost sm" data-captall="1">${CA.ptAll?"Свернуть":"Все точки ("+A.pts.length+")"}</button>`:""}</div>`; }
function caChanges(A, P){ const el=$("#ca-chg"); if(!el) return; if(!P||!P.rows.length){ el.innerHTML=""; return; }
  const pk=new Set(P.rows.map(r=>r.key)), ck=new Set(A.rows.map(r=>r.key)), nw=A.rows.filter(r=>!pk.has(r.key)), gone=P.rows.filter(r=>!ck.has(r.key)).sort((a,b)=>b.sum-a.sum);
  if(!nw.length && !gone.length){ el.innerHTML=""; return; }
  el.innerHTML=`<div class="ca-chg">${nw.length?`<div><small>Новое в этом периоде</small>${nw.slice(0,8).map(r=>`<button type="button" class="ca-chip up" data-caopen="${esc(r.key)}">${esc(r.name)}</button>`).join("")}${nw.length>8?`<em>ещё ${nw.length-8}</em>`:""}</div>`:""}
    ${gone.length?`<div><small>Брал в ${caRngTxt(CA.prange)}, а сейчас нет</small>${gone.slice(0,8).map(r=>`<span class="ca-chip dn" title="было ${caQf.format(r.qty)} ${esc(r.unit)} на ${caRub(r.sum)} ₽">${esc(r.name)} <em>${caQf.format(r.qty)} ${esc(r.unit)}</em></span>`).join("")}${gone.length>8?`<em>ещё ${gone.length-8}</em>`:""}</div>`:""}</div>`; }
function caTable(A, P, first){ const el=$("#ca-tw"); if(!el) return; const adm=me().admin&&pfLoaded&&A.cn>0, rows=A.rows.slice(), pm=P?new Map(P.rows.map(r=>[r.key,r])):null;
  const q=CA.q.trim().toLowerCase(), L0=q?rows.filter(r=>r.name.toLowerCase().includes(q)):rows;
  const so={sum:(a,b)=>b.sum-a.sum||b.qty-a.qty, qty:(a,b)=>b.qty-a.qty, n:(a,b)=>b.n-a.n||b.sum-a.sum, name:(a,b)=>a.name.localeCompare(b.name,"ru"), price:(a,b)=>(b.qty?b.sum/b.qty:0)-(a.qty?a.sum/a.qty:0), profit:(a,b)=>(b.sum-b.cost)-(a.sum-a.cost), chg:(a,b)=>caChg(b,pm)-caChg(a,pm)};
  if(!A.priced && (CA.sort==="sum"||CA.sort==="price")) CA.sort="qty"; if(!adm && CA.sort==="profit") CA.sort="sum"; if(!pm && CA.sort==="chg") CA.sort="sum";
  L0.sort(so[CA.sort]||so.sum); const L=CA.all||q?L0:L0.slice(0,10), lsum=r2(A.rows.reduce((a,r)=>a+r.sum,0)), mx=Math.max(...A.rows.map(r=>A.priced?r.sum:r.qty))||1;
  const th=(k,l,cls)=>`<th class="${cls||""}"><button type="button" class="ca-sort${CA.sort===k?" on":""}" data-casort="${k}">${l}${CA.sort===k?" ↓":""}</button></th>`;
  const sh=A.priced&&!adm, cols=3+(A.priced?2:0)+(sh?1:0)+(pm?1:0)+(adm?2:0)+1;
  const body=L.map((r,i)=>{ const share=A.priced&&lsum?r.sum/lsum*100:0, op=CA.open.has(r.key), pr=pm&&pm.get(r.key), avgC=r.cq&&!r.cmiss?r.cost/r.cq:null, mk=avgC&&r.cost?(r.sum-r.cost)/r.cost*100:null;
    return `<tr class="ca-r${op?" open":""}" data-carow="${esc(r.key)}" tabindex="0" aria-expanded="${op}" style="--d:${first?Math.min(i*25,400):0}ms"><td class="ca-i">${i+1}</td><td class="ca-nm"><b>${esc(r.name)}</b><span class="ca-ar" aria-hidden="true">›</span></td><td class="num ca-qt">${caQf.format(r.qty)} <small class="muted">${esc(r.unit||"")}</small></td>
      ${pm?`<td class="num ca-ch">${pr?caDelta(r.qty, pr.qty):`<span class="ca-d up">новое</span>`}</td>`:""}
      ${A.priced?`<td class="num ca-sm"><b>${caRub(r.sum)}</b>${adm?`<small class="ca-rng">${share.toFixed(share<1?1:0).replace(".",",")}% от суммы</small>`:""}</td><td class="num muted ca-pr">${r.qty?fm(r.sum/r.qty):"—"}${r.hi>r.lo&&r.lo<Infinity?`<small class="ca-rng">${fm(r.lo)}–${fm(r.hi)}</small>`:""}</td>`:""}
      ${adm?`<td class="num ca-zc">${avgC!=null?fm(avgC):r.cq?`<small class="muted" title="закупка известна не по всем поставкам">частично</small>`:`<small class="muted">нет</small>`}</td><td class="num ca-pf">${avgC!=null?`<b class="${r.sum-r.cost<0?"neg":""}">${caRub(r2(r.sum-r.cost))}</b><small class="ca-rng">${mk!=null?"наценка "+Math.round(mk)+"%":""}</small>`:"—"}</td>`:""}
      ${sh?`<td class="ca-sh"><span class="ca-shb"><i style="--w:${(r.sum/mx*100).toFixed(1)}%"></i></span><small>${share.toFixed(share<1?1:0).replace(".",",")}%</small></td>`:""}
      <td class="num ca-nd">${r.n} <small class="muted">из ${A.n}</small></td></tr>
      <tr class="ca-dr${op?" open":""}"><td colspan="${cols}"><div class="ca-dw"><div class="ca-di">${op?caDetail(r, pr, adm):""}</div></div></td></tr>`; }).join("");
  el.innerHTML=`<div class="ca-tw${first?"":" calm"}"><div class="ca-ch-h"><b>Что покупает</b><small class="muted">${q?`найдено ${L0.length}`:CA.all||rows.length<=10?"все "+rows.length:"топ‑10 из "+rows.length} · нажмите на товар — подробности</small>
      <label class="ca-q"><input type="search" id="ca-q" placeholder="Найти товар…" value="${esc(CA.q)}" autocomplete="off"></label></div>
    <div class="tbl"><table class="ca-tab"><thead><tr><th class="ca-i">#</th>${th("name","Товар")}${th("qty","Купили","num")}${pm?th("chg","К прошлому","num"):""}${A.priced?th("sum","Сумма, ₽","num")+th("price","Ср. цена","num"):""}${adm?`<th class="num">Закупка ср.</th>`+th("profit","Прибыль, ₽","num"):""}${sh?`<th class="ca-sh">Доля</th>`:""}${th("n","В документах","num")}</tr></thead>
    <tbody>${body||`<tr><td colspan="${cols}" class="muted" style="padding:14px">Ничего не найдено</td></tr>`}</tbody></table></div>
    ${rows.length>10&&!q?`<div class="row"><button type="button" class="btn ghost sm" id="ca-more">${CA.all?"Свернуть до топ‑10":"Показать все "+rows.length}</button></div>`:""}</div>`;
}
const caChg = (r, pm) => { const p=pm&&pm.get(r.key); return !p ? 1e9 : p.qty ? (r.qty-p.qty)/p.qty : 0; };
function caDetail(r, pr, adm){ const dl=r.dl.slice().sort((a,b)=>(b.d.date||"").localeCompare(a.d.date||"")), first=dl[dl.length-1], lastL=dl[0];
  const pp=pr&&pr.qty&&pr.sum?pr.sum/pr.qty:null, cp=r.qty&&r.priced?r.sum/r.qty:null;
  const facts=[`${r.n} ${plural(r.n,["поставка","поставки","поставок"])}`, r.n?`в среднем ${caQf.format(Math.round(r.qty/r.n*100)/100)} ${esc(r.unit)} за раз`:"",
    r.priced&&r.hi>r.lo?`цена менялась: ${fm(first.price)} → ${fm(lastL.price)}`:"", pr?`в ${caRngTxt(CA.prange)}: ${caQf.format(pr.qty)} ${esc(pr.unit)}${pp?` по ${fm(pp)}`:""}`:"",
    pp&&cp&&Math.abs(cp-pp)>=0.01?`цена ${cp>pp?"выше":"ниже"} на ${fm(Math.abs(cp-pp))} ₽`:""].filter(Boolean);
  const pid=prod(r.pid)?r.pid:"";
  return `<div class="ca-df">${facts.map(f=>`<span>${f}</span>`).join("")}</div>
    <div class="ca-dl">${dl.slice(0,40).map(x=>`<${x.d.j?`button type="button" data-cadoc="${x.d.j.id}"`:"div"} class="ca-dli"><span><b>${fd(x.d.date)}</b>${x.d.number?" № "+esc(x.d.number):""}${x.d.pt?`<small>${esc(x.d.pt)}</small>`:""}</span><span class="num">${caQf.format(x.qty)} ${esc(r.unit)}${x.price!=null?` × ${fm(x.price)}`:""}</span><span class="num"><b>${x.sum!=null?caRub(x.sum)+" ₽":""}</b>${adm?`<small>${x.cost!=null?"закупка "+caRub(x.cost)+" ₽":"без закупки"}</small>`:""}</span>${x.d.j?`<i aria-hidden="true">›</i>`:"<i></i>"}</${x.d.j?"button":"div"}>`).join("")}${dl.length>40?`<div class="muted" style="font-size:12px;padding:4px 8px">и ещё ${dl.length-40}</div>`:""}</div>
    ${pid&&typeof pdCard==="function"?`<div class="row"><button type="button" class="btn ghost sm" data-capd="${esc(pid)}">Карточка товара ›</button></div>`:""}`; }
/* окно «документы за период» — из плиток; строка → накладная, «‹ Назад» возвращает сюда */
function caDocsCard(kind){ const L=caFiltered().slice(), adm=me().admin&&pfLoaded, cid=CA.cid;
  const so=kind==="profit"?(a,b)=>((b.dp&&b.dp.profit)||0)-((a.dp&&a.dp.profit)||0):kind==="cost"?(a,b)=>((b.dp&&b.dp.cost)||0)-((a.dp&&a.dp.cost)||0):kind==="sum"||kind==="avg"?(a,b)=>(b.sum||0)-(a.sum||0):(a,b)=>(b.date||"").localeCompare(a.date||"")||String(b.number).localeCompare(String(a.number),"ru",{numeric:true});
  L.sort(so); const A=caAgg(L);
  const sub=[caRngTxt(CA.range[0]==="0000"?null:CA.range)||"всё время", CA.sel?"только "+(caByMonth()?CA_MON[+CA.sel.slice(5,7)-1]:fd(CA.sel)):"", CA.pt?esc(CA.pt):""].filter(Boolean).join(" · ");
  const sb=(k,t)=>`<button type="button" data-dc="cads" data-k="${k}" class="${kind===k||(!["sum","cost","profit"].includes(kind)&&k==="docs")?"on":""}">${t}</button>`;
  CARD_RE=()=>caDocsCard(kind);
  openCard(`<div class="dc-head"><div><div class="dc-kicker">Документы заказчика · ${sub}</div><h3>${esc(cusNm(cid)||"")}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="ld-chips" role="group" aria-label="Порядок">${sb("docs","Новые сверху")}${sb("sum","По сумме")}${adm?sb("cost","По закупке")+sb("profit","По прибыли"):""}</div>
    <div class="ld-list">${L.map((d,i)=>{ const p=d.dp; const inner=`<span class="ld-n"><b>${d.number?"№ "+esc(d.number):"без номера"}</b><small>${fd(d.date)}</small></span><span class="ld-m"><div>${esc(d.pt||"Адрес не указан")}</div><small>${d.lines.length} ${posWord(d.lines.length)}${adm?(p?` · закупка ${caRub(p.cost)} ₽${p.miss?" (не вся)":""}`:" · нет закупки на устройстве"):""}</small></span><span class="ld-s">${d.sum!=null?fm(d.sum)+" ₽":""}${adm&&p?`<small class="${p.profit<0?"neg":""}">прибыль ${caRub(p.profit)} ₽</small>`:`<small>${d.j?"открыть ›":""}</small>`}</span>`;
      return d.j?`<button type="button" class="ld-row" data-dc="doc" data-id="${d.j.id}" style="animation-delay:${Math.min(i,10)*0.03}s">${inner}</button>`:`<div class="ld-row" style="animation-delay:${Math.min(i,10)*0.03}s">${inner}</div>`; }).join("")||`<div class="ld-empty">Документов нет</div>`}</div>
    <div class="dc-total"><span>Всего ${L.length} ${docsWord(L.length)}${adm&&A.cn?` · закупка ${caRub(A.cost)} ₽ · прибыль ${caRub(A.profit)} ₽`:""}</span><b>${fm(A.sum)} ₽</b></div>`, false, (a,b)=>{
      if(a==="doc"){ const j=D.journal.find(x=>x.id===b.dataset.id); if(j) docCard(j, false); return; }
      if(a==="cads"){ caDocsCard(b.dataset.k); } }); }
/* загрузка: сначала журнал на устройстве, потом полная история из таблицы; период для сравнения — параллельно */
async function caFetch(cid, range){ const [s,e]=range, local=()=>D.journal.filter(j=>j.customerId===cid && j.date>=s && j.date<=e && !isArch(j) && Array.isArray(j.snap?.dr?.lines)).map(j=>({id:j.id, date:j.date, number:j.number, sum:j.sum, snap:j.snap}));
  if(!online() || pend.journal.size) return {docs:local(), local:true};
  try{ const r=await api({action:"customerAnalytics", customerId:cid, from:s, to:e}); const docs=r.documents||[], loc=local();
    return {docs: docs.length && docs[0].date==null && docs.length===loc.length ? loc : docs}; }
  catch(x){ return {docs:local(), local:true, err:x.message}; } }
async function renderCustomerAnalytics(){
  const request = ++analyticsRequest, cid = analyticsCustomer, status = $("#ca-status"), per = $("#ca-period").value, custom = per === "custom";
  $("#ca-perseg").querySelectorAll("button").forEach(b=>{ const on=b.dataset.per===per; b.classList.toggle("on",on); b.setAttribute("aria-pressed",on); });
  $("#ca-from-label").hidden = $("#ca-to-label").hidden = !custom;
  const from = $("#ca-from").value, to = $("#ca-to").value;
  if(!cid){ $("#ca-result").textContent=""; status.textContent = "Выберите заказчика."; return; }
  if(custom && (!from || !to || from > to)){ $("#ca-result").textContent=""; status.textContent = "Укажите обе даты. Дата начала должна быть не позже даты окончания."; return; }
  if(me().admin && !pfLoaded && online()) loadProfit(true).then(()=>{ if(request===analyticsRequest && CA.raw) drawCustomerAnalytics(CA.raw, CA.range, CA.praw, CA.prange); });
  const range = caRange(per, from, to), prange = caPrevRange(range, CA.cmp);
  const loc = (r)=>r?D.journal.filter(j=>j.customerId===cid && j.date>=r[0] && j.date<=r[1] && !isArch(j) && Array.isArray(j.snap?.dr?.lines)).map(j=>({id:j.id, date:j.date, number:j.number, sum:j.sum, snap:j.snap})):null;
  CA.praw=loc(prange); drawCustomerAnalytics(loc(range), range, CA.praw, prange); $("#ca-result").classList.add("ca-load");
  status.textContent = online() ? "Загружаем полную историю…" : "Показан журнал на этом устройстве. Для полной истории подключитесь к интернету.";
  try{ if(pend.journal.size && online()) await flush(); }catch(e){}
  const [m, p] = await Promise.all([caFetch(cid, range), prange ? caFetch(cid, prange) : Promise.resolve(null)]);
  if(request !== analyticsRequest) return;
  $("#ca-result").classList.remove("ca-load");
  status.textContent = m.local ? (m.err && /unknown action/.test(m.err) ? "Показан журнал на этом устройстве. Для полной истории обновите скрипт Google Таблицы." : online() ? "Показан журнал на этом устройстве (полная история недоступна)." : status.textContent) : "";
  CA.praw = p ? p.docs : null; drawCustomerAnalytics(m.docs, range, CA.praw, prange); }
/* нажатия и поиск в блоке */
$("#ca-result").addEventListener("click", e=>{ const t=e.target;
  const so=t.closest("[data-casort]"); if(so){ CA.sort=so.dataset.casort; caPart(); return; }
  if(t.closest("#ca-more")){ CA.all=!CA.all; caPart(); return; }
  const cm=t.closest("[data-cacmp]"); if(cm){ if(CA.cmp!==cm.dataset.cacmp){ CA.cmp=cm.dataset.cacmp; try{ localStorage.setItem("frudom-cacmp", CA.cmp); }catch(x){} renderCustomerAnalytics(); } return; }
  const mt=t.closest("[data-camet]"); if(mt){ CA.metric=mt.dataset.camet; caChart(); return; }
  const col=t.closest("[data-cacol]"); if(col){ const k=col.dataset.cacol; if(!k) return; CA.sel = CA.sel===k ? "" : k; caPart(); return; }
  const cl=t.closest("[data-caclr]"); if(cl){ CA[cl.dataset.caclr]=""; caPart(); return; }
  const pt=t.closest("[data-capt]"); if(pt){ CA.pt = CA.pt===pt.dataset.capt ? "" : pt.dataset.capt; caPart(); return; }
  if(t.closest("[data-captall]")){ CA.ptAll=!CA.ptAll; caPts(); return; }
  const ti=t.closest("[data-cat]"); if(ti){ const k=ti.dataset.cat; if(k==="items"||k==="kg"){ if(k==="kg") CA.sort="qty"; caPart(); const w=$("#ca-tw"); if(w) w.scrollIntoView({behavior:"smooth", block:"start"}); return; } caDocsCard(k); return; }
  const dc=t.closest("[data-cadoc]"); if(dc){ const j=D.journal.find(x=>x.id===dc.dataset.cadoc); if(j) docCard(j, false); return; }
  const pd=t.closest("[data-capd]"); if(pd){ pdCard(pd.dataset.capd); return; }
  const op=t.closest("[data-caopen]"); if(op){ CA.open.add(op.dataset.caopen); CA.all=true; CA.q=""; caPart(); const r=$("#ca-tw").querySelector(`[data-carow="${CSS.escape(op.dataset.caopen)}"]`); if(r) r.scrollIntoView({behavior:"smooth", block:"center"}); return; }
  const row=t.closest("[data-carow]"); if(row) caToggle(row); });
$("#ca-result").addEventListener("keydown", e=>{ const row=e.target.closest&&e.target.closest("[data-carow]"); if(row && (e.key==="Enter"||e.key===" ") && e.target===row){ e.preventDefault(); caToggle(row); }
  if(e.target.id==="ca-q" && e.key==="Escape"){ e.target.value=""; CA.q=""; caQ(); } });
$("#ca-result").addEventListener("input", e=>{ if(e.target.id==="ca-q"){ CA.q=e.target.value; caQ(); } });
function caQ(){ const pos=$("#ca-q")?$("#ca-q").selectionStart:null; caPart(); const q=$("#ca-q"); if(q){ q.focus(); if(pos!=null) try{ q.setSelectionRange(pos,pos); }catch(x){} } }
/* раскрытие товара: плавно (grid 0fr → 1fr), без перерисовки таблицы */
function caToggle(row){ const k=row.dataset.carow, dr=row.nextElementSibling; if(!dr) return; const on=!CA.open.has(k);
  if(on){ CA.open.add(k); const A=caAgg(caFiltered()), r=A.rows.find(x=>x.key===k), P=CA.prev&&!CA.sel&&!CA.pt?caAgg(CA.prev):null; dr.querySelector(".ca-di").innerHTML=r?caDetail(r, P&&P.rows.find(x=>x.key===k), me().admin&&pfLoaded&&A.cn>0):""; }
  else CA.open.delete(k);
  row.classList.toggle("open", on); row.setAttribute("aria-expanded", on); requestAnimationFrame(()=>dr.classList.toggle("open", on)); }
try{ const c=localStorage.getItem("frudom-cacmp"); if(c==="prev"||c==="year"||c==="none") CA.cmp=c; }catch(x){}
