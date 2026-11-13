/* Server baselines survive reloads; pending edits are never used as an authoritative baseline. */
const SYNC_TABLES=['suppliers','customers','products','contracts','journal','costs','doccosts','psettings','daytasks','prices','specs','purchases','pother','debts','cats','invoices'];
const BASE = D.syncBase = D.syncBase || {};
let conflictList = D.syncConflicts || [], syncBlocked = conflictList.length > 0, docSaving = false;
const syncKey=(t,r)=>t==='prices'||t==='specs'?r.customerId+'|'+r.productId:r.id;
const syncEq=(a,b)=>String(a==null?'':a)===String(b==null?'':b);
function localRow(t,id){
  if(t==='prices'||t==='specs'){const [c,p]=id.split('|'), v=(D[t]||{})[c]&&D[t][c][p]; return v==null?null:Object.assign({customerId:c,productId:p},t==='prices'?{price:String(v)}:v);}
  const r=(D[t]||[]).find(x=>x.id===id); return r?(t==='journal'?jRow(r):clone(r)):null;
}
function putLocalRow(t,id,r){
  if(t==='prices'||t==='specs'){const [c,p]=id.split('|');D[t]=D[t]||{};D[t][c]=D[t][c]||{};if(!r)delete D[t][c][p];else D[t][c][p]=t==='prices'?r.price:{spec:r.spec,ste:r.ste,art:r.art};return;}
  const list=D[t]=D[t]||[], i=list.findIndex(x=>x.id===id);
  let row=r&&clone(r);if(row&&t==='journal'){row.snap=JSON.parse(row.snap);row.sum=+row.sum||0;}
  if(i>=0){if(row)Object.assign(list[i],row);else list.splice(i,1);}else if(row)list.push(row);
}
function rememberBase(data){SYNC_TABLES.forEach(t=>{if(!Array.isArray(data[t]))return;BASE[t]={};data[t].forEach(r=>BASE[t][syncKey(t,r)]=clone(r));});saveLocal();}
function requestBase(payload){
  const out={}; const add=(t,id)=>{(out[t]=out[t]||{})[id]=clone((BASE[t]||{})[id]||null);};
  Object.entries(payload.changes||{}).forEach(([t,ch])=>{if(!SYNC_TABLES.includes(t)||!ch)return;(ch.upsert||[]).forEach(r=>add(t,syncKey(t,r)));(ch.del||[]).forEach(r=>add(t,typeof r==='string'?r:syncKey(t,r)));});
  if(payload.entry){add('journal',payload.entry.id);if(Object.prototype.hasOwnProperty.call(payload,'entryBase')){out.journal[payload.entry.id]=clone(payload.entryBase);return out;}const dr=D.draft;if(dr&&dr.id===payload.entry.id&&Object.prototype.hasOwnProperty.call(dr,'_editBase'))out.journal[payload.entry.id]=clone(dr._editBase);}
  return out;
}
function acceptRows(accepted,submitted){
  Object.entries(accepted||{}).forEach(([t,rows])=>Object.entries(rows).forEach(([id,row])=>{
    const sent=((submitted[t]||{}).upsert||[]).find(r=>syncKey(t,r)===id), now=localRow(t,id);
    (BASE[t]=BASE[t]||{})[id]=clone(row);
    if(sent&&now&&row){const merged=clone(row);Object.keys(now).forEach(k=>{if(!syncEq(now[k],sent[k]))merged[k]=now[k];});putLocalRow(t,id,merged);}
    else if(!pend[t].has(id))putLocalRow(t,id,row);
    if(t==='journal'&&D.draft&&D.draft.id===id)D.draft._editBase=clone(row);
  }));saveLocal();
}
function conflictSummary(r,t){if(!r)return 'Запись удалена';if(t==='journal'){try{const s=JSON.parse(r.snap);return '№ '+r.number+' от '+r.date+' · '+r.sum+' ₽\n'+(s.dr.lines||[]).map(l=>(l.name||(s.prods[l.productId]||{}).name||l.productId)+': '+l.qty+' × '+l.price).join('\n')+'\nАдрес: '+(s.dr.ship||'');}catch(e){return r.snap||'';}}return JSON.stringify(r,null,2);}
/* Окно «Запись изменена»: по-человечески (13.11.2026) — что за запись, что именно отличается «в таблице / у вас», без служебного кода.
   Подписи полей — из листов таблицы (S в Code.gs, вставляет build.py), закупка и накладная раскрываются по товарам. */
const CF_LBL=/*__SYNC_LABELS__*/{};
const CF_TBL={suppliers:'Поставщик',customers:'Заказчик',products:'Товар',contracts:'Договор',journal:'Накладная',costs:'Закупочная цена',doccosts:'Закупка по накладной',psettings:'Налог для прибыли',daytasks:'Задача на день',prices:'Цена для заказчика',specs:'Код товара для заказчика',purchases:'Закупка Саида',pother:'Расход / доход',debts:'Долг',cats:'Категория товаров',invoices:'Отдельный счёт'};
const CF_MONEY=/^(price|sum|expense|paid|total|limit|cost|amount|maxSum|left)$/i, CF_DATE=/^(date|from|to|due|start|end|validTo)$/;
const CF_SKIP=/^(id|updated|created|by|at|art|artOwn|seen|customerId|supplierId|productId|branchId|contractId|cat|grp|lines|snap|state|pays|spec|akt|eis)$/;
function cfV(k,v){ if(v==null||v==='') return '—'; v=String(v);
  if(CF_MONEY.test(k)&&/^-?\d+([.,]\d+)?$/.test(v.trim())) return fm(+v.replace(',','.'))+' ₽';
  if(CF_DATE.test(k)&&/^\d{4}-\d\d-\d\d/.test(v)) return fd(v.slice(0,10));
  if(/^(done|closed)$/.test(k)) return v==='1'||v==='true'?'да':'нет';
  return v.length>160?v.slice(0,160)+'…':v; }
const cfJ=s=>{ if(s&&typeof s==='object') return s; try{ return JSON.parse(s||'{}')||{}; }catch(e){ return {}; } };
function cfPName(pid, docId){ const p=typeof prod==='function'&&prod(pid); if(p) return p.name;
  const j=(D.journal||[]).find(x=>x.id===docId), pp=j&&j.snap&&j.snap.prods&&j.snap.prods[pid]; return pp?pp.name:'товар'; }
function cfPUnit(pid){ const p=typeof prod==='function'&&prod(pid); return p&&p.unit||'ед.'; }
/* что отличается: [{l, a (в таблице), b (у вас)}] */
function cfRows(t, a, b, id){ const R=[], add=(l,x,y)=>{ if(String(x)!==String(y)) R.push({l, a:x, b:y}); };
  if(!a||!b) return R;
  if(t==='doccosts'){ const A=cfJ(a.lines), B=cfJ(b.lines), ks=[...new Set([...Object.keys(A),...Object.keys(B)])];
    ks.filter(k=>!k.startsWith('_')).forEach(pid=>add('Закупка «'+cfPName(pid,id)+'», ₽ за '+cfPUnit(pid), A[pid]!=null?fm(A[pid])+' ₽':'не вписана', B[pid]!=null?fm(B[pid])+' ₽':'не вписана'));
    const sub=(o,k)=>cfJ(o[k]); ['_bq','_free'].forEach(k=>{ const x=sub(A,k), y=sub(B,k); [...new Set([...Object.keys(x),...Object.keys(y)])].forEach(pid=>{
      if(k==='_bq') add('Куплено фактически «'+cfPName(pid,id)+'»', x[pid]!=null?String(x[pid]).replace('.',',')+' '+cfPUnit(pid):'как в накладной', y[pid]!=null?String(y[pid]).replace('.',',')+' '+cfPUnit(pid):'как в накладной');
      else add('«'+cfPName(pid,id)+'» — бесплатно', x[pid]?'да':'нет', y[pid]?'да':'нет'); }); });
    const pay=o=>{ const p=cfJ(o._pay); return +p.s?fm(p.s)+' ₽'+(p.d?', '+fd(String(p.d).slice(0,10)):''):'не оплачена'; }; add('Оплата накладной', pay(A), pay(B));
    const src=o=>{ const L=Array.isArray(o._src)?o._src:[]; return L.length?L.map(x=>(x.n||'')+' — '+fm(x.s)+' ₽').join('; '):'—'; }; add('Закупка одной суммой / от кого', src(A), src(B));
    add('Прочие расходы', cfV('expense',a.expense), cfV('expense',b.expense)); add('Примечание', cfV('note',a.note), cfV('note',b.note));
    return R; }
  if(t==='journal'){ const sa=cfJ(a.snap), sb=cfJ(b.snap), da=sa.dr||{}, db=sb.dr||{};
    add('Номер', a.number||'—', b.number||'—'); add('Дата', fd(a.date)||'—', fd(b.date)||'—'); add('Сумма', fm(a.sum)+' ₽', fm(b.sum)+' ₽');
    add('Адрес доставки', da.ship||'—', db.ship||'—'); add('Заказчик', (sa.c||{}).name||'—', (sb.c||{}).name||'—');
    const ln=(s,d)=>{ const m={}; (d.lines||[]).forEach(l=>{ if(!l.productId&&!l.name) return; const k=l.productId||l.name, pr=(s.prods||{})[l.productId]||{}; m[k]={n:pr.name||l.name||'товар', v:String(l.qty||0).replace('.',',')+' '+(pr.unit||'')+' × '+fm(l.price)+' ₽'}; }); return m; };
    const la=ln(sa,da), lb=ln(sb,db); [...new Set([...Object.keys(la),...Object.keys(lb)])].forEach(k=>add('«'+(la[k]||lb[k]).n+'»', la[k]?la[k].v:'нет в накладной', lb[k]?lb[k].v:'нет в накладной'));
    add('В архиве', ((sa.meta||{}).arch)?'да':'нет', ((sb.meta||{}).arch)?'да':'нет');
    add('Комментарий', ((sa.meta||{}).cm||{}).t||'—', ((sb.meta||{}).cm||{}).t||'—');
    return R; }
  const L=CF_LBL[t]||{}; [...new Set([...Object.keys(a),...Object.keys(b)])].forEach(k=>{ if(k.startsWith('_')||CF_SKIP.test(k)) return; const lb=L[k]; if(!lb||/^ID|\(не /.test(lb)) return; add(lb, cfV(k,a[k]), cfV(k,b[k])); });
  return R; }
function cfName(t, r, id){ if(!r) return ''; const s=x=>String(x||'').trim();
  if(t==='journal') return '№ '+s(r.number)+' · '+(cusNm(r.customerId)||'')+' · '+fd(r.date);
  if(t==='doccosts') return '№ '+s(r.number)+' · '+s(r.customerName)+' · '+fd(r.date);
  if(t==='prices'||t==='specs'){ const [c,p]=String(id).split('|'); return '«'+(cusNm(c)||'заказчик')+'» · «'+cfPName(p)+'»'; }
  if(t==='daytasks') return fd(r.date)+' · '+s(r.customerName)+(r.text?' · '+s(r.text).slice(0,60):'');
  if(t==='pother') return fd(r.date)+' · '+s(r.kind)+' '+fm(r.sum)+' ₽'+(r.note?' · '+s(r.note).slice(0,50):'');
  if(t==='invoices') return '№ '+s(r.number)+' от '+fd(r.date);
  if(t==='purchases') return 'от '+fd(r.date);
  if(t==='contracts') return s(r.short)||s(r.basis);
  if(t==='costs') return s(r.productName);
  return s(r.short)||s(r.name)||s(r.number)||''; }
function cfHtml(x, n){ const t=x.table, cur=x.current, mine=localRow(t,x.id), any=cur||mine||x.proposed||{};
  const R=cfRows(t, cur, mine, x.id);
  const body = !cur ? `<div class="cf-note">В таблице эту запись <b>удалили</b>, а у вас в ней есть несохранённые правки.</div>`
    : !mine ? `<div class="cf-note">У вас эта запись <b>удалена</b>, а в таблице её за это время изменили.</div>`
    : R.length ? `<div class="cf-tbl"><div class="cf-h"><span></span><span>В таблице сейчас</span><span>У вас</span></div>${R.map(r=>`<div class="cf-r"><b>${esc(r.l)}</b><span class="cf-a">${esc(r.a)}</span><span class="cf-b">${esc(r.b)}</span></div>`).join('')}</div>`
    : `<div class="cf-note">Отличаются только служебные данные — смело нажимайте «Оставить как в таблице».</div>`;
  return `<div class="cf-top"><span class="cf-ic" aria-hidden="true">!</span><div><h2>Эту запись уже изменили</h2><p>Пока у вас были несохранённые правки, ту же запись поменяли с другого устройства или другой человек. Ваши правки целы — выберите, что оставить.</p></div></div>
    <div class="cf-what"><small>${esc(CF_TBL[t]||'Запись')}</small><b>${esc(cfName(t, any, x.id)||'')}</b></div>
    ${body}
    <div class="cf-btns"><button type="button" data-choice="server" class="cf-btn">Оставить как в таблице</button><button type="button" data-choice="mine" class="cf-btn pri">Сохранить мой вариант</button><button type="button" data-choice="later" class="cf-btn ghost">Решить позже</button></div>
    <p class="cf-hint">«Оставить как в таблице» — ваши правки этой записи отменятся. «Сохранить мой вариант» — в таблицу запишется ваше.${n>1?` Ещё таких записей: ${n-1} — спрошу по очереди.`:''}</p>
    <details class="cf-raw"><summary>Подробно (для проверки)</summary><div class="cf-two"><div><b>В таблице</b><pre>${esc(cur?JSON.stringify(cur,null,1):'удалена')}</pre></div><div><b>У вас</b><pre>${esc(mine?JSON.stringify(mine,null,1):'удалена')}</pre></div></div></details>`; }
function cfCss(){ if(document.getElementById('cf-css')) return; const s=document.createElement('style'); s.id='cf-css';
  s.textContent=`#fd-conflict{box-sizing:border-box;width:min(720px,calc(100vw - 24px));max-height:90vh;overflow:auto;border:0;border-radius:18px;padding:22px;font:15px/1.4 var(--ui,system-ui,Arial);color:#1c2220;background:#fff;box-shadow:0 30px 70px -20px rgba(48,32,44,.45)}
#fd-conflict::backdrop{background:rgba(28,22,26,.4)}
#fd-conflict .cf-top{display:flex;gap:12px;align-items:flex-start}#fd-conflict .cf-ic{flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fbf0d9;color:#8a6200;font-weight:700;font-size:18px}
#fd-conflict h2{margin:2px 0 4px;font-size:19px}#fd-conflict .cf-top p{margin:0;color:#5f6662;font-size:14px}
#fd-conflict .cf-what{margin:16px 0 10px;padding:10px 14px;border-radius:12px;background:rgba(106,44,78,.06)}#fd-conflict .cf-what small{display:block;color:#7a807c;font-size:12px}#fd-conflict .cf-what b{font-size:16px}
#fd-conflict .cf-tbl{display:grid;border:1px solid rgba(28,34,32,.1);border-radius:12px;overflow:hidden}
#fd-conflict .cf-h,#fd-conflict .cf-r{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr);gap:10px;padding:9px 12px;align-items:baseline}
#fd-conflict .cf-h{background:rgba(28,34,32,.04);font-size:12px;color:#7a807c;font-weight:600}#fd-conflict .cf-r+.cf-r{border-top:1px solid rgba(28,34,32,.07)}
#fd-conflict .cf-r b{font-weight:600;font-size:14px}#fd-conflict .cf-a{color:#5f6662}#fd-conflict .cf-b{color:#6a2c4e;font-weight:600}
#fd-conflict .cf-note{padding:12px 14px;border-radius:12px;background:#fbf6e9;color:#6b5a2a}
#fd-conflict .cf-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}#fd-conflict .cf-btn{flex:1 1 auto;padding:11px 14px;border-radius:10px;border:1px solid rgba(28,34,32,.15);background:#fff;font:600 14px var(--ui,system-ui,Arial);cursor:pointer;color:#1c2220}
#fd-conflict .cf-btn.pri{background:#6a2c4e;border-color:#6a2c4e;color:#fff}#fd-conflict .cf-btn.ghost{flex:0 1 auto;background:transparent;border-color:transparent;color:#5f6662}
#fd-conflict .cf-hint{margin:10px 0 0;font-size:12.5px;color:#7a807c}
#fd-conflict .cf-raw{margin-top:12px;font-size:12px;color:#7a807c}#fd-conflict .cf-raw summary{cursor:pointer}#fd-conflict .cf-two{display:flex;flex-wrap:wrap;gap:10px}#fd-conflict .cf-two>div{flex:1 1 240px;min-width:0}
#fd-conflict pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto;background:rgba(28,34,32,.04);padding:8px;border-radius:8px}
@media (max-width:560px){#fd-conflict{padding:16px}#fd-conflict .cf-h{display:none}#fd-conflict .cf-r{grid-template-columns:1fr 1fr;row-gap:2px}#fd-conflict .cf-r b{grid-column:1/-1}#fd-conflict .cf-a::before{content:"в таблице: ";font-size:12px;color:#7a807c;font-weight:400}#fd-conflict .cf-b::before{content:"у вас: ";font-size:12px;color:#7a807c;font-weight:400}#fd-conflict .cf-btn{flex:1 1 100%}}`;
  document.head.appendChild(s); }
function showConflicts(list){
  syncBlocked=true;conflictList=list;D.syncConflicts=clone(list);saveLocal();clearTimeout(syncT);setStatus('err','Конфликт правок — нажмите здесь');
  let box=document.getElementById('fd-conflict');if(box)box.remove();box=document.createElement('dialog');box.id='fd-conflict';cfCss();
  const x=list[0];if(!x)return;
  box.innerHTML=cfHtml(x, list.length);
  box.querySelectorAll('button[data-choice]').forEach(b=>{b.onclick=()=>{
    if(b.dataset.choice==='later'){box.close();box.remove();return;}
    const t=x.table,id=x.id, mine=localRow(t,id), current=x.current, old=x.base, useMine=b.dataset.choice==='mine';
    let resolved=current&&clone(current);
    if(useMine){resolved=mine&&clone(mine);if(t!=='journal'&&mine&&current&&old){resolved=clone(current);Object.keys(mine).forEach(k=>{if(!syncEq(mine[k],old[k]))resolved[k]=mine[k];});}}
    else if(t!=='journal'&&mine&&current&&old&&!x.fields.some(k=>k.startsWith('_'))){Object.keys(mine).forEach(k=>{if(!x.fields.includes(k)&&!syncEq(mine[k],old[k]))resolved[k]=mine[k];});}
    (BASE[t]=BASE[t]||{})[id]=clone(current);putLocalRow(t,id,resolved);pend[t].delete(id);
    if(t==='journal'&&D.draft.id===id){if(resolved)D.draft=Object.assign(clone(JSON.parse(resolved.snap).dr),{_editBase:clone(current)});else D.draft=newDraft(D);}
    if(JSON.stringify(resolved)!==JSON.stringify(current))dirty(t,id,!resolved);
    if(t==='journal')docTasks([...new Set([current&&current.date,mine&&mine.date].filter(Boolean))],true);
    saveLocal();savePend();box.close();box.remove();conflictList.shift();D.syncConflicts=clone(conflictList);saveLocal();rerender();
    if(conflictList.length)showConflicts(conflictList);else{syncBlocked=false;flush();}
  };});
  box.addEventListener('cancel',()=>{box.remove();});document.body.appendChild(box);box.showModal();
}
