/* ================= карточка товара номенклатуры и связанные товары =================
   Связанные товары — один и тот же товар под разными названиями («Помидоры», «Томаты», «Помидоры (томаты)»).
   Хранение: у товара поле grp = ID основного товара группы (колонка «Связан с товаром (ID)» на листе «Товары», Code.gs ≥ 18).
   У основного товара grp пустое. Названия в документах не меняются — связь нужна только для карточки (история цен и продаж вместе). */
const pgSrv = () => (D.srvVer||0)>=18 || D.products.some(p=>"grp" in p);
const pgCan = () => !docLimited() && !!curUser();
const pgRoot = p => p ? (p.grp && p.grp!==p.id && prod(p.grp) ? p.grp : p.id) : "";
function pgMembers(id){ const p=prod(id); if(!p) return []; const r=pgRoot(p);
  return D.products.filter(x=>x.id===r || (x.grp===r && x.id!==r)).sort((a,b)=>(a.id===r?-1:b.id===r?1:0) || String(a.name).localeCompare(String(b.name),"ru")); }
const pgCount = id => pgMembers(id).length;
const pgSet = (p, v) => { if((p.grp||"")===(v||"")) return; p.grp=v||""; dirty("products", p.id); };
/* связать a и b: основным остаётся основной большей группы (при равенстве — тот, из чьей карточки связывали) */
function pgLink(aId, bId){ const A=prod(aId), B=prod(bId); if(!A||!B) return; const ra=pgRoot(A), rb=pgRoot(B); if(ra===rb) return;
  const ma=pgMembers(ra), mb=pgMembers(rb), root = mb.length>ma.length ? rb : ra;
  ma.concat(mb).forEach(x=>pgSet(x, x.id===root?"":root));
  logEv("Товары", "Связаны товары: «"+(prod(root)||{}).name+"» ← "+ma.concat(mb).filter(x=>x.id!==root).map(x=>"«"+x.name+"»").join(", ")); }
function pgUnlink(id){ const p=prod(id); if(!p) return; const M=pgMembers(id); if(M.length<2) return; const r=pgRoot(p);
  if(p.id===r){ const nr=M.find(x=>x.id!==r); M.forEach(x=>{ if(x.id!==r) pgSet(x, x.id===nr.id?"":nr.id); }); }
  pgSet(p, ""); logEv("Товары", "Товар «"+p.name+"» отвязан от группы «"+(prod(pgRoot(M.find(x=>x.id!==id)))||{}).name+"»"); }
function pgMain(id){ const p=prod(id); if(!p) return; const M=pgMembers(id); M.forEach(x=>pgSet(x, x.id===id?"":id)); logEv("Товары", "Основное название группы: «"+p.name+"»"); }

/* ---- похожие названия: «Помидоры», «помидор», «Томаты», «Помидоры (томаты)» → один ключ; «Помидоры черри» — другой ---- */
const PG_SYN={"помид":"томат"};
const PG_STOP=new Set(["св","свеж","кг","шт","гр","г","уп","упак","весов","фас","сорт","сорта","первы","высши","1","2","1с","2с","вес","россия","импор","отечес"]);
function pgStem(w){ w=w.replace(/ё/g,"е"); if(w.length>4) w=w.replace(/(ами|ями|ов|ев|ей|ам|ям|ах|ях|ые|ий|ый|ая|ое|ые|ы|и|а|я|о|е|ь|й|у|ю)$/,""); w=w.replace(/ец$/,"ц"); const s=w.slice(0,5); return PG_SYN[s]||s; }
function pgKey(name){ const W=String(name||"").toLowerCase().replace(/ё/g,"е").replace(/[^а-яa-z0-9]+/g," ").split(" ").filter(w=>w && !/^\d/.test(w)).map(pgStem).filter(w=>w.length>=2 && !PG_STOP.has(w));
  return [...new Set(W)].sort().join(" "); }
/* похожие на группу товары (не в группе): тот же ключ названия */
function pgSimilar(id){ const M=pgMembers(id), ids=new Set(M.map(x=>x.id)), keys=new Set(M.map(x=>pgKey(x.name)).filter(Boolean));
  const out=[]; D.products.forEach(p=>{ if(ids.has(p.id) || !p.name) return; const k=pgKey(p.name); if(!k) return; if(keys.has(k)) out.push({p, s:2}); });
  return out.sort((a,b)=>b.s-a.s || String(a.p.name).localeCompare(String(b.p.name),"ru")).map(x=>x.p); }
/* все возможные группы одинаковых товаров во всей номенклатуре */
function pgClusters(){ const by={}, no=new Set(getPrefs().pgNo||[]);
  D.products.forEach(p=>{ if(!p.name) return; const k=pgKey(p.name); if(!k) return; (by[k]=by[k]||[]).push(p); });
  return Object.entries(by).filter(([k,L])=>L.length>1 && new Set(L.map(p=>pgRoot(p))).size>1 && !no.has(k)).map(([k,L])=>({k, L:L.sort((a,b)=>String(a.name).localeCompare(String(b.name),"ru"))}))
    .sort((a,b)=>b.L.length-a.L.length || a.L[0].name.localeCompare(b.L[0].name,"ru")); }

/* ---- данные карточки: продажи по журналу, закупка из накладных, «Закупочных цен» и склада ---- */
function pcdData(id){ const M=pgMembers(id), ids=new Set(M.map(x=>x.id)), adm=!!me().admin, sales=[], buys=[];
  (D.journal||[]).forEach(j=>{ if(!j.snap || !j.snap.dr || isArch(j)) return; if(!(j.snap.dr.lines||[]).some(l=>ids.has(l.productId) && +l.qty>0)) return;
    let x=null, k=null; try{ if(adm && typeof docProfit==="function") x=docProfit(j); else k=calc(j.snap.dr, j.snap); }catch(e){ return; }
    const rows = x ? x.lines : k.lines.map(l=>({l})); const who=jWho(j).main;
    rows.forEach(r=>{ const l=r.l; if(!ids.has(l.pid) || !(l.qty>0)) return; const un=l.unit||(prod(l.pid)||{}).unit||"";
      sales.push({d:j.date, j, pid:l.pid, name:l.name||(prod(l.pid)||{}).name||"", unit:un, qty:l.qty, price:l.priceNet, sum:l.net, cus:who, cid:j.customerId, c: x&&!x.src ? r.c : null});
      if(x && !x.src && r.own && !r.sk && r.c!=null) buys.push({d:j.date, p:+r.c, u:un, q:r.bq||l.qty, src:"накл. № "+j.number+" · "+who, jid:j.id, pid:l.pid}); }); });
  if(adm){ pfArr("costs").forEach(e=>{ if(!ids.has(e.productId) || !(+e.price>0)) return; const p=prod(e.productId)||{};
      buys.push({d:e.from||"", p:+e.price, u:p.unit||"", q:0, src:"«Закупочные цены»"+(e.customerId?" · для "+(cus(e.customerId).name||""):""), pid:e.productId}); }); }
  const items=[]; try{ M.forEach(p=>{ const it=skItemOf(p.id); if(it && !items.some(x=>x.id===it.id)) items.push(it); }); }catch(e){}
  if(adm) items.forEach(it=>{ try{ skhPrices(skIdx().byItem[it.id]||[]).forEach(b=>buys.push({d:b.d, p:b.p, u:b.u, q:b.q, src:"приход на склад"+(b.sup?" от "+b.sup:""), bid:b.id, item:it.id})); }catch(e){} });
  sales.sort((a,b)=>String(b.d).localeCompare(String(a.d))); buys.sort((a,b)=>String(b.d).localeCompare(String(a.d)));
  return {M, ids, sales, buys, items, adm}; }
/* основная единица группы — та, в которой больше всего продаж/закупок (для графика и средних) */
function pcdUnit(X){ const n={}; X.sales.forEach(s=>n[s.unit]=(n[s.unit]||0)+1); X.buys.forEach(b=>n[b.u]=(n[b.u]||0)+1); X.M.forEach(p=>n[p.unit]=(n[p.unit]||0)+0.5);
  return Object.keys(n).sort((a,b)=>n[b]-n[a])[0]||"кг"; }
const pcdPct = v => (v>0?"+":v<0?"−":"")+String(Math.abs(Math.round(v*10)/10)).replace(".",",")+"%";
const pcdWavg = (L, f, w) => { const W=L.reduce((a,x)=>a+(w(x)||0),0); return W>0 ? L.reduce((a,x)=>a+f(x)*(w(x)||0),0)/W : (L.length? L.reduce((a,x)=>a+f(x),0)/L.length : null); };
/* график: закупка (сплошная) и продажа (пунктир) по датам */
function pcdChart(B, S){ const pts=B.concat(S); if(pts.length<2) return ""; const W=320, H=96, t=d=>Date.parse(d+"T12:00:00");
  const t0=Math.min(...pts.map(x=>t(x.d))), t1=Math.max(...pts.map(x=>t(x.d))), ts=t1-t0||1, mn=Math.min(...pts.map(x=>x.p)), mx=Math.max(...pts.map(x=>x.p)), sp=mx-mn||1;
  const xy=x=>[Math.round(8+(t(x.d)-t0)/ts*(W-16)), Math.round(H-12-(x.p-mn)/sp*(H-26))];
  const line=(L,cls)=>{ if(!L.length) return ""; const P=L.slice().sort((a,b)=>t(a.d)-t(b.d)).map(xy); return (P.length>1?`<polyline class="${cls}" points="${P.map(p=>p.join(",")).join(" ")}"/>`:"")+P.map((p,i)=>`<circle class="${cls}" cx="${p[0]}" cy="${p[1]}" r="2.6"/>`).join(""); };
  return `<svg class="pcd-ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Цены: от ${fm(mn)} до ${fm(mx)} ₽"><text x="2" y="10">${fm(mx)}</text><text x="2" y="${H-1}">${fm(mn)}</text>${line(S,"s")}${line(B,"b")}</svg>`; }
/* за день — одна средняя точка, чтобы график не прыгал от десяти накладных одного дня */
const pcdDay = L => { const by={}; L.forEach(x=>{ const o=by[x.d]||(by[x.d]={d:x.d, s:0, q:0, n:0, ps:0}); o.s+=x.p*(x.q||0); o.q+=x.q||0; o.n++; o.ps+=x.p; }); return Object.values(by).map(o=>({d:o.d, p:o.q>0?o.s/o.q:o.ps/o.n})); };

let PCD=null;
const PCD_PER=[["all","Всё время"],["90","3 месяца"],["30","Месяц"]];
function pdCard(id){ const p=prod(id); if(!p){ toast("info","Товара уже нет"); return; }
  PCD={id, per:(PCD&&PCD.id===id&&PCD.per)||"all", f:(PCD&&PCD.id===id&&PCD.f)||"", n:15, q:"", sug:false};
  if(me().admin && typeof pfLoaded!=="undefined" && !pfLoaded){ loadProfit(true).then(()=>pcdRedraw()).catch(()=>{}); }
  try{ if(typeof SK!=="undefined" && !SK && skCan()) skLoad(true).then(()=>pcdRedraw()).catch(()=>{}); }catch(e){}
  CARD_RE=()=>pdCard(id);
  openCard(`<div id="pcd">${pcdHtml()}</div>`, true, (a,b)=>{
    if(a==="doc"){ const j=D.journal.find(x=>x.id===b.dataset.id); if(j) docCard(j); return; }
    if(a==="skh"){ skItemHist(b.dataset.id); return; }
    if(a==="go"){ pdCard(b.dataset.id); return; } }); }
function pcdRedraw(){ const el=document.getElementById("pcd"); if(!el || !PCD) return; const d=el.closest("dialog"), st=d?d.scrollTop:0; el.innerHTML=pcdHtml(); if(d){ d.scrollTop=st; try{ navDecorate(d); }catch(e){} } }
function pcdHtml(){ const p=prod(PCD.id); if(!p) return `<div class="dc-head"><div><h3>Товара уже нет</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>`;
  const X=pcdData(p.id), M=X.M, root=pgRoot(p), U=pcdUnit(X), can=pgCan(), srv=pgSrv();
  const from = PCD.per==="all" ? "0000" : jIso(new Date(Date.now()-(+PCD.per)*864e5));
  const S=X.sales.filter(s=>s.d>=from), B=X.buys.filter(b=>(b.d||"0000")>=from || (!b.d && PCD.per==="all"));
  const SU=S.filter(s=>s.unit===U), BU=B.filter(b=>b.u===U && b.d);
  /* итоги */
  const qty={}; S.forEach(s=>qty[s.unit]=r3((qty[s.unit]||0)+s.qty)); const rev=r2(S.reduce((a,s)=>a+s.sum,0));
  const docs=new Set(S.map(s=>s.j.id)).size, cuss=new Set(S.map(s=>s.cid)).size, lastS=S[0];
  const avgS=pcdWavg(SU, s=>s.price, s=>s.qty), avgB=pcdWavg(BU, b=>b.p, b=>b.q);
  const known=S.filter(s=>s.c!=null), cost=r2(known.reduce((a,s)=>a+s.c*s.qty,0)), krev=r2(known.reduce((a,s)=>a+s.sum,0));
  const BL=BU.slice().sort((a,b)=>String(b.d).localeCompare(String(a.d))), lastB=BL[0], prevB=BL.find(b=>b.d<(lastB||{}).d);
  const chB=lastB&&prevB&&prevB.p ? (lastB.p-prevB.p)/prevB.p*100 : null;
  const tile=(l,v,s,cls)=>`<div class="${cls||""}"><small>${l}</small><b>${v}</b>${s?`<span>${s}</span>`:""}</div>`;
  const cat=catOf(p), aliases=[...new Set(M.flatMap(x=>String(x.aliases||"").split(/[;\n]/).map(s=>s.trim()).filter(Boolean)))];
  let h=`<div class="dc-head"><div><div class="dc-kicker">Карточка товара${M.length>1?" · "+M.length+" "+plural(M.length,["название","названия","названий"]):""}</div><h3>${esc((prod(root)||p).name||"Без названия")}</h3>
    <p class="muted sk-sub">${[cat?esc(cat.name):"", esc(p.unit||""), p.country&&COUNTRIES[p.country]?esc(COUNTRIES[p.country]):"", +p.price>0?"базовая цена "+fm(p.price)+" ₽":""].filter(Boolean).join(" · ")}</p></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>`;
  /* связанные названия */
  h+=`<div class="skbox pcd-grp"><div class="skbh"><b>Названия этого товара</b><small class="muted">в документах печатается название из строки — как в контракте</small></div><div class="pcd-ms">`
    + M.map(x=>`<div class="pcd-m${x.id===p.id?" cur":""}"><button type="button" class="pcd-mn" ${x.id===p.id?"disabled":`data-dc="go" data-id="${x.id}"`}><b>${esc(x.name||"—")}</b><small>${esc(x.unit||"")}${x.id===root&&M.length>1?" · основное":""}</small></button>`
      + (can&&srv&&M.length>1?`<span class="pcd-ma">${x.id!==root?`<button type="button" class="btn ghost sm" data-pgmain="${x.id}" title="Показывать это название заголовком карточки">Основное</button>`:""}<button type="button" class="btn ghost sm" data-pgun="${x.id}">Отвязать</button></span>`:"")+`</div>`).join("") + `</div>`;
  if(can){ if(!srv) h+=`<div class="sknoteb">Связывать товары можно после обновления Code.gs в таблице — сейчас таблица не сохранит связь. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`;
    else { const sim=pgSimilar(p.id);
      h+=(sim.length?`<div class="pcd-sim"><small class="muted">Похоже, это тот же товар:</small> ${sim.slice(0,8).map(x=>`<button type="button" class="pcd-chip" data-pglink="${x.id}" title="Связать с этой карточкой">+ ${esc(x.name)} <em>${esc(x.unit||"")}</em></button>`).join("")}</div>`:"")
        + `<div class="pcd-add"><input id="pcd-q" type="search" placeholder="Связать с товаром: начните вводить название" autocomplete="off" value="${esc(PCD.q)}" aria-label="Найти товар, чтобы связать"><div class="pcd-sug" id="pcd-sug">${pcdSugHtml()}</div></div>`; } }
  if(aliases.length) h+=`<p class="muted pcd-al">Так его пишут в заявках: ${aliases.slice(0,12).map(esc).join(", ")}${aliases.length>12?" и ещё "+(aliases.length-12):""}</p>`;
  h+=`</div>`;
  /* период */
  h+=`<div class="pfchips pcd-per">${PCD_PER.map(([k,t])=>`<button type="button" data-pcdper="${k}" class="${PCD.per===k?"on":""}">${t}</button>`).join("")}</div>`;
  /* плитки */
  h+=`<div class="skh-kpi pcd-kpi">`
    + tile("Продано", Object.keys(qty).map(u=>skQf(qty[u],u)).join(" · ")||"—", docs?docs+" "+plural(docs,["накладная","накладные","накладных"])+" · "+cuss+" "+plural(cuss,["заказчик","заказчика","заказчиков"]):"")
    + tile("Выручка", rev?fm(rev)+" ₽":"—", lastS?"последняя продажа "+fd(lastS.d):"")
    + tile("Средняя продажа", avgS!=null?fm(avgS)+" ₽/"+esc(U):"—", "без НДС")
    + (X.adm ? tile("Средняя закупка", avgB!=null?fm(avgB)+" ₽/"+esc(U):"—", lastB?"последняя "+fm(lastB.p)+" ₽"+(chB!=null&&Math.abs(chB)>=0.05?` <i class="${chB>0?"miss":"okc"}">${chB>0?"▲":"▼"} ${pcdPct(chB).replace(/^[+−]/,"")}</i>`:""):"")
      + tile("Наценка", avgS!=null&&avgB?pcdPct((avgS/avgB-1)*100):"—", krev?"прибыль до налога "+fm(r2(krev-cost))+" ₽":"", avgS!=null&&avgB&&avgS<avgB?"bad":"") : "")
    + `</div>`;
  /* закупочные цены */
  if(X.adm){ const ch=pcdChart(pcdDay(BU), pcdDay(SU.map(s=>({d:s.d, p:s.price, q:s.qty}))));
    h+=`<div class="skbox"><div class="skbh"><b>Движение цен${M.length>1||X.buys.some(b=>b.u!==U)?` <small class="muted">за ${esc(U)}</small>`:""}</b>${ch?`<small class="pcd-lg"><i class="b"></i>закупка <i class="s"></i>продажа</small>`:""}</div>`
      + (ch||(!B.length?`<p class="muted">Закупочных цен ещё нет. Они появятся, когда вы заполните закупку в окне накладной или на вкладке «Закупка», впишете «Закупочные цены» или оформите приход на склад.</p>`:""))
      + (BL.length?`<div class="pcd-bl">${BL.slice(0,8).map((x,i)=>{ const nx=BL.slice(i+1).find(y=>y.d<x.d), d=nx&&nx.p?(x.p-nx.p)/nx.p*100:null;
          return `<button type="button" class="skh-pr" ${x.jid?`data-dc="doc" data-id="${x.jid}"`:x.item?`data-dc="skh" data-id="${x.item}"`:"disabled"}><span>${fd(x.d)} · ${esc(x.src)}${M.length>1&&x.pid?" · "+esc((prod(x.pid)||{}).name||""):""}</span><b>${fm(x.p)} ₽</b>${d!=null&&Math.abs(d)>=0.05?`<em class="${d>0?"up":"dn"}">${pcdPct(d)}</em>`:`<em></em>`}</button>`; }).join("")}${BL.length>8?`<small class="muted">и ещё ${BL.length-8} раньше — все в списке ниже</small>`:""}</div>
        <p class="muted skh-note">Мин. ${fm(Math.min(...BL.map(x=>x.p)))} ₽ · средняя ${fm(avgB)} ₽ (по количеству) · макс. ${fm(Math.max(...BL.map(x=>x.p)))} ₽</p>`:"")
      + (B.some(b=>b.u!==U)?`<p class="muted skh-note">Есть цены в других единицах (${[...new Set(B.filter(b=>b.u!==U).map(b=>b.u))].map(esc).join(", ")}) — они в списке ниже, в график и средние не входят.</p>`:"")
      + `</div>`; }
  /* цены заказчиков */
  const CP=[]; D.customers.forEach(c=>{ M.forEach(x=>{ const v=custPrice(c.id,x.id); if(v==null||v==="") return; const L=X.sales.filter(s=>s.cid===c.id && s.pid===x.id);
    CP.push({c, x, v:+v, last:L[0], q:r3(L.filter(s=>s.d>=from).reduce((a,s)=>a+s.qty,0))}); }); });
  CP.sort((a,b)=>String((b.last||{}).d||"").localeCompare(String((a.last||{}).d||"")) || a.c.name.localeCompare(b.c.name,"ru"));
  if(CP.length) h+=`<div class="skbox"><div class="skbh"><b>Цены у заказчиков</b><small class="muted">${CP.length} ${plural(CP.length,["цена","цены","цен"])} в прайсах заказчиков</small></div><div class="pcd-cp">${CP.map(o=>`<div class="pcd-cr"><span><b>${esc(o.c.name)}</b><small>${M.length>1?esc(o.x.name)+" · ":""}${o.last?"последняя поставка "+fd(o.last.d)+(o.q?" · "+skQf(o.q,o.x.unit):""):"ещё не поставляли"}</small></span><b>${fm(o.v)} ₽<small>/${esc(o.x.unit||"")}</small></b>${X.adm&&avgB&&o.x.unit===U?`<em class="${o.v<avgB?"up":"dn"}">${pcdPct((o.v/avgB-1)*100)}</em>`:"<em></em>"}</div>`).join("")}</div>${X.adm&&avgB?`<p class="muted skh-note">Справа — наценка цены заказчика к средней закупке.</p>`:""}</div>`;
  /* склад */
  if(X.items.length) h+=`<div class="skbox"><div class="skbh"><b>На складе</b></div>${X.items.map(it=>{ let now=""; try{ now=skUnitsOf(it.id).filter(u=>u.fact).map(u=>skQf(u.fact,u.unit)+(u.res?" (в резерве "+skQf(u.res,u.unit)+")":"")).join(" · "); }catch(e){}
      return `<button type="button" class="skh-pr pcd-sk" data-dc="skh" data-id="${it.id}"><span>${esc(it.name)}</span><b>${now||"0"}</b><em>›</em></button>`; }).join("")}</div>`;
  /* лента: продажи и закупки */
  const ev=S.map(s=>({k:"s", d:s.d, s})).concat(B.filter(b=>b.d).map(b=>({k:"b", d:b.d, b}))).sort((a,b)=>String(b.d).localeCompare(String(a.d)) || (a.k<b.k?1:-1));
  const EF=PCD.f, EL=ev.filter(e=>!EF||e.k===EF);
  h+=`<div class="skbox"><div class="skbh"><b>История</b></div>`
    + (X.adm?`<div class="pfchips">${[["","Всё",ev.length],["s","Продажи",S.length],["b","Закупка",ev.length-S.length]].map(([k,t,n])=>`<button type="button" data-pcdf="${k}" class="${EF===k?"on":""}">${t} <i>${n}</i></button>`).join("")}</div>`:"")
    + (EL.length?`<div class="pcd-ev">${EL.slice(0,PCD.n).map(e=>{ if(e.k==="s"){ const s=e.s, m=s.c!=null&&s.price?(s.price/s.c-1)*100:null;
          return `<button type="button" class="pcd-er s" data-dc="doc" data-id="${s.j.id}"><span class="pcd-ed">${fd(s.d)}</span><span class="pcd-et"><b>${esc(s.cus)}</b><small>№ ${esc(s.j.number)}${M.length>1?" · "+esc(s.name):""}</small></span><span class="pcd-eq"><b>${skQf(s.qty,s.unit)} × ${fm(s.price)} ₽</b><small>${fm(s.sum)} ₽${X.adm&&s.c!=null?" · закупка "+fm(s.c)+(m!=null?" ("+pcdPct(m)+")":""):""}</small></span></button>`; }
        const b=e.b; return `<button type="button" class="pcd-er b" ${b.jid?`data-dc="doc" data-id="${b.jid}"`:b.item?`data-dc="skh" data-id="${b.item}"`:"disabled"}><span class="pcd-ed">${fd(b.d)}</span><span class="pcd-et"><b>Закупка</b><small>${esc(b.src)}</small></span><span class="pcd-eq"><b>${fm(b.p)} ₽/${esc(b.u)}</b>${b.q?`<small>${skQf(b.q,b.u)}</small>`:""}</span></button>`; }).join("")}</div>`
        + (EL.length>PCD.n?`<div class="skmv-more"><span class="muted">Показано ${PCD.n} из ${EL.length}</span><button type="button" class="btn ghost sm" data-pcdmore="15">Ещё 15</button><button type="button" class="btn ghost sm" data-pcdmore="all">Все</button></div>`:"")
      :`<div class="skempty"><b>Пока пусто</b><span>${PCD.per!=="all"?"Выберите «Всё время».":"Этот товар ещё не продавали."}</span></div>`)
    + `<p class="muted skh-note">По документам на этом устройстве (последние 2000), без архива.</p></div>`;
  return h + `<div class="dc-acts"><button class="btn pri" data-dc="close">Закрыть</button></div>`; }
function pcdSugHtml(){ if(!PCD) return ""; const q=norm(PCD.q); if(!q) return ""; const ids=new Set(pgMembers(PCD.id).map(x=>x.id)), W=q.split(" ").filter(Boolean);
  const L=D.products.filter(p=>!ids.has(p.id) && p.name && W.every(w=>norm(p.name).includes(w))).slice(0,8);
  return L.length ? L.map(p=>{ const n=pgCount(p.id); return `<button type="button" data-pglink="${p.id}"><b>${esc(p.name)}</b><small>${esc(p.unit||"")}${n>1?" · уже связан с "+(n-1)+" "+plural(n-1,["товаром","товарами","товарами"]):""}</small></button>`; }).join("") : `<p class="muted">Ничего не найдено</p>`; }
document.addEventListener("input", e=>{ if(e.target.id!=="pcd-q" || !PCD) return; PCD.q=e.target.value; const s=document.getElementById("pcd-sug"); if(s) s.innerHTML=pcdSugHtml(); });
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest || !PCD || !t.closest("#pcd")) return;
  const pf=t.closest("[data-pcdper]"); if(pf){ PCD.per=pf.dataset.pcdper; PCD.n=15; pcdRedraw(); return; }
  const ff=t.closest("[data-pcdf]"); if(ff){ PCD.f=ff.dataset.pcdf; PCD.n=15; pcdRedraw(); return; }
  const mo=t.closest("[data-pcdmore]"); if(mo){ PCD.n = mo.dataset.pcdmore==="all" ? 1e9 : PCD.n+15; pcdRedraw(); return; }
  if(!pgCan() || !pgSrv()) return;
  const lk=t.closest("[data-pglink]"); if(lk){ const o=prod(lk.dataset.pglink); pgLink(PCD.id, lk.dataset.pglink); PCD.q=""; pcdRedraw(); if(curTab==="products") renderProducts(); toast("ok","Товары связаны","«"+(o||{}).name+"» теперь в этой карточке. В документах названия не меняются."); return; }
  const un=t.closest("[data-pgun]"); if(un){ const id=un.dataset.pgun, o=prod(id); pgUnlink(id); pcdRedraw(); if(curTab==="products") renderProducts(); toast("ok","Отвязан","«"+(o||{}).name+"» — снова отдельный товар."); return; }
  const mn=t.closest("[data-pgmain]"); if(mn){ pgMain(mn.dataset.pgmain); pcdRedraw(); if(curTab==="products") renderProducts(); } });

/* ---- «Найти одинаковые товары»: все группы похожих названий во всей номенклатуре ---- */
let PGF=null;
function pgFind(){ PGF={sel:{}}; pgClusters().forEach(g=>g.L.forEach(p=>PGF.sel[g.k+"|"+p.id]=1)); CARD_RE=null;
  openCard(`<div id="pgf">${pgFindHtml()}</div>`, true, ()=>{}); }
function pgFindHtml(){ const C=pgClusters();
  return `<div class="dc-head"><div><div class="dc-kicker">Номенклатура</div><h3>Одинаковые товары под разными названиями</h3><p class="muted sk-sub">Связанные названия собираются в одну карточку: история цен и продаж — общая. В документах названия не меняются.</p></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>`
    + (!pgSrv()?`<div class="sknoteb">Связывать товары можно после обновления Code.gs в таблице. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`:"")
    + (C.length?`<div class="pgf-l">${C.map(g=>`<div class="skbox pgf-g" data-pgk="${esc(g.k)}"><div class="pgf-n">${g.L.map(p=>{ const n=pgCount(p.id); return `<label class="pgf-c"><input type="checkbox" data-pgc="${esc(g.k)}|${p.id}"${PGF.sel[g.k+"|"+p.id]?" checked":""}><span><b>${esc(p.name)}</b><small>${esc(p.unit||"")}${n>1?" · в группе из "+n:""}</small></span></label>`; }).join("")}</div>
        <div class="pgf-a"><button type="button" class="btn sm pri" data-pgjoin="${esc(g.k)}"${pgSrv()?"":" disabled"}>Связать отмеченные</button><button type="button" class="btn ghost sm" data-pgno="${esc(g.k)}" title="Больше не предлагать эту группу">Это разные товары</button></div></div>`).join("")}</div>`
      :`<div class="skempty"><b>Похожих названий не нашлось</b><span>Связать товары можно и вручную — в карточке товара («Связать с товаром»).</span></div>`)
    + `<div class="dc-acts"><button class="btn pri" data-dc="close">Готово</button></div>`; }
function pgfRedraw(){ const el=document.getElementById("pgf"); if(el) el.innerHTML=pgFindHtml(); }
document.addEventListener("change", e=>{ const c=e.target.closest&&e.target.closest("[data-pgc]"); if(!c||!PGF) return; PGF.sel[c.dataset.pgc]=c.checked?1:0; });
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest || !t.closest("#pgf")) return;
  const j=t.closest("[data-pgjoin]"); if(j){ if(!pgCan()||!pgSrv()) return; const k=j.dataset.pgjoin, g=pgClusters().find(x=>x.k===k); if(!g) return; const L=g.L.filter(p=>PGF.sel[k+"|"+p.id]);
    if(L.length<2){ toast("info","Отметьте хотя бы два названия",""); return; } L.slice(1).forEach(p=>pgLink(L[0].id, p.id)); pgfRedraw(); if(curTab==="products") renderProducts();
    toast("ok","Связано: "+L.length+" "+plural(L.length,["название","названия","названий"]),"Теперь это одна карточка товара."); return; }
  const n=t.closest("[data-pgno]"); if(n){ const p=getPrefs(); p.pgNo=[...new Set((p.pgNo||[]).concat(n.dataset.pgno))]; setPrefs(p,true); pgfRedraw(); } });
