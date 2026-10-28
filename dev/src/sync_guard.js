/* Server baselines survive reloads; pending edits are never used as an authoritative baseline. */
const SYNC_TABLES=['suppliers','customers','products','contracts','journal','costs','doccosts','psettings','daytasks','prices','specs'];
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
function showConflicts(list){
  syncBlocked=true;conflictList=list;D.syncConflicts=clone(list);saveLocal();clearTimeout(syncT);setStatus('err','Конфликт правок — нажмите здесь');
  let box=document.getElementById('fd-conflict');if(box)box.remove();box=document.createElement('dialog');box.id='fd-conflict';box.style.cssText='box-sizing:border-box;max-width:calc(100vw - 24px);width:min(760px,94vw);max-height:88vh;overflow:auto;border:0;border-radius:16px;padding:22px;font:15px Arial;color:#29232a';
  const x=list[0];if(!x)return;
  const fields=x.fields.filter(k=>!k.startsWith('_')&&k!=='snap');
  box.innerHTML='<h2 style="margin-top:0">Запись изменена другим пользователем</h2><p>Ваши правки сохранены на этом устройстве. Проверьте различия перед отправкой. Конфликтов: '+list.length+'</p><p><b>'+esc(x.table==='journal'?'Накладная № '+((x.proposed||x.current||{}).number||''):((x.proposed||x.current||{}).name||x.id))+'</b></p>'+fields.map(k=>'<p><b>'+esc(({name:'Название',address:'Юридический адрес',ship:'Адрес доставки',rs:'Расчётный счёт',bank:'Банк',price:'Цена',text:'Текст задачи',date:'Дата',done:'Выполнение'})[k]||k)+'</b><br>В таблице: '+esc((x.current||{})[k]||'—')+'<br>Ваш вариант: '+esc((localRow(x.table,x.id)||x.proposed||{})[k]||'—')+'</p>').join('')+(fields.length?'':'<div style="display:flex;flex-wrap:wrap;gap:12px"><div style="flex:1;min-width:220px"><b>В таблице</b><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto">'+esc(conflictSummary(x.current,x.table))+'</pre></div><div style="flex:1;min-width:220px"><b>Ваш вариант</b><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:240px;overflow:auto">'+esc(conflictSummary(localRow(x.table,x.id),x.table))+'</pre></div></div>')+'<div style="display:flex;flex-wrap:wrap;gap:10px"><button data-choice="server">Оставить текущий вариант</button><button data-choice="mine">Сохранить мой вариант</button><button data-choice="later">Решить позже</button></div>';
  box.querySelectorAll('button').forEach(b=>{b.style.cssText='padding:12px;border:1px solid #ccc;border-radius:8px;background:#f6f2f4;cursor:pointer';b.onclick=()=>{
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
