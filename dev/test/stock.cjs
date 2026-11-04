/* Склад на сервере (настоящий Code.gs в тестовом сервере): сценарии приёмки 1–3, 4 (единицы, перевзвешивание, инвентаризация),
   возврат, повтор запроса, сбой посередине операции, декларации с повтором загрузки.
   Запуск: node test/server.js & node test/stock.cjs */
const U='http://localhost:8787/exec';
let fails=0; const ok=(c,m)=>{ console.log((c?'PASS ':'FAIL ')+m); if(!c) fails++; };
const call=async(user,key,o)=>{ const r=await fetch(U,{method:'POST',body:JSON.stringify(Object.assign({user,key},o))}); return r.json(); };
const D=o=>call('Даниил','1111',o), G=o=>call('Гриша','3333',o);
const ev=async code=>{ const r=await fetch('http://localhost:8787/eval',{method:'POST',body:code}); return r.json(); };
let n=0; const rid=()=>'t'+Date.now().toString(36)+(n++)+Math.random().toString(36).slice(2,6);
const st=async(op,d,who)=>(who||D)({action:'stock',op,rid:rid(),d});
const r3=x=>Math.round(x*1000)/1000;
function calc(S){ const fact={}, res={}; S.moves.forEach(m=>{ if(m.type!=='close'&&m.type!=='direct') fact[m.batchId]=r3((fact[m.batchId]||0)+(+m.qty)); }); S.res.forEach(r=>res[r.batchId]=r3((res[r.batchId]||0)+(+r.qty))); return {fact,res}; }
const itemFact=(S,id)=>{ const {fact}=calc(S); return r3(S.batches.filter(b=>b.itemId===id).reduce((a,b)=>a+(fact[b.id]||0),0)); };
const itemRes=(S,id)=>r3(S.res.filter(r=>r.itemId===id).reduce((a,r)=>a+(+r.qty),0));
async function doc(id, pid, qty, price, src, unit){
  const snap={dr:{id, supplierId:'s1', customerId:'c-test', number:String(900+n++), date:'2026-11-05', lines:[{productId:pid, qty:String(qty), price:String(price), lid:'L1', stk:src}]}, s:{name:'ИП'}, c:{name:'Тестовый заказчик'}, prods:{[pid]:{name:'Огурцы свежие', unit:unit||'кг'}}, meta:{}};
  return D({action:'sync', protocol:1, base:{journal:{[id]:null}}, changes:{journal:{upsert:[{id, supplierId:'s1', customerId:'c-test', number:snap.dr.number, date:'2026-11-05', sum:String(qty*price), updated:new Date().toISOString(), snap:JSON.stringify(snap)}], del:[]}}});
}
(async()=>{
  let r=await D({action:'stock',op:'load'}); ok(r.ok && Array.isArray(r.stock.items), 'загрузка склада');
  // --- 1. огурцы: приход 8 кг по 70, накладная 10 кг по 140 целиком со склада
  r=await st('in',{newName:'  огурцы ', unit:'кг', qty:'8', price:'70', date:'2026-11-01', supplier:'Рынок', docRef:'н1'}); ok(r.ok, 'приход 8 кг');
  const cuc=r.out.itemId; r=await st('in',{newName:'Огурцы', unit:'кг', qty:'1', price:'70', date:'2026-11-01', supplier:'Рынок', docRef:'н1'}); ok(!r.ok && r.code==='similar', 'похожий приход — нужно подтверждение');
  ok(r.stock===undefined, 'похожий не проведён');
  r=await st('item',{itemId:cuc, links:['p-cuc']}); ok(r.ok, 'связь с позицией документа');
  r=await doc('doc1','p-cuc',10,140,{m:'s'}); ok(r.ok, 'накладная 10 кг со склада сохранена: '+(r.error||''));
  r=await D({action:'stock',op:'load'}); let S=r.stock;
  ok(itemFact(S,cuc)===8 && itemRes(S,cuc)===8, 'факт 8, резерв 8 (нехватка 2): '+itemFact(S,cuc)+'/'+itemRes(S,cuc));
  ok(S.log.some(l=>l.action==='Резерв с нехваткой'), 'в истории — резерв с нехваткой');
  r=await st('in',{itemId:cuc, unit:'кг', qty:'2', price:'75', date:'2026-11-02', supplier:'Рынок', docRef:'н2'}); S=r.stock;
  ok(itemRes(S,cuc)===8, 'новый приход сам не распределяется');
  r=await st('reserve',{docId:'doc1'}); S=r.stock; ok(itemRes(S,cuc)===10, 'обновление резерва устранило нехватку: '+itemRes(S,cuc));
  // повтор того же запроса
  const R0=rid(); r=await D({action:'stock',op:'wo',rid:R0,d:{batchId:S.batches.find(b=>b.itemId===cuc).id, qty:'1', reason:'тест'}}); ok(!r.ok, 'списание сверх свободного запрещено (всё в резерве)');
  // --- 2. отдельный товар: 8 кг со склада + 2 кг от Саида
  r=await st('in',{newName:'Помидоры', unit:'кг', qty:'8', price:'70', date:'2026-11-01', supplier:'Рынок', docRef:'н3'}); const tom=r.out.itemId; await st('item',{itemId:tom, links:['p-tom']});
  r=await doc('doc2','p-tom',10,140,{m:'x', q:'8', pd:'80'}); ok(r.ok,'смешанная строка сохранена');
  S=(await D({action:'stock',op:'load'})).stock; ok(itemRes(S,tom)===8,'резерв 8 по смешанной строке');
  const RS=rid(); r=await D({action:'stock',op:'ship',rid:RS,d:{docId:'doc2', lines:[{lineId:'L1', qty:'5', direct:'2'}]}}); ok(r.ok,'частичная отгрузка 5 кг + 2 кг от Саида');
  r=await D({action:'stock',op:'ship',rid:RS,d:{docId:'doc2', lines:[{lineId:'L1', qty:'5', direct:'2'}]}}); ok(r.ok&&r.dup,'повтор отгрузки ничего не меняет');
  S=r.stock; ok(itemFact(S,tom)===3 && itemRes(S,tom)===3, 'после отгрузки 5: факт 3, резерв 3: '+itemFact(S,tom)+'/'+itemRes(S,tom));
  ok(S.moves.filter(m=>m.docId==='doc2'&&m.type==='ship').length===1, 'одно движение отгрузки, без дублей');
  ok(S.moves.some(m=>m.docId==='doc2'&&m.type==='direct'&&+m.qty===2), 'отгрузка от Саида записана отдельно');
  r=await doc('doc2','p-tom',10,140,{m:'x', q:'8', pd:'80'}); S=(await D({action:'stock',op:'load'})).stock; ok(itemRes(S,tom)===3, 'пересохранение (печать) не меняет резерв');
  r=await st('ship',{docId:'doc2', lines:[{lineId:'L1', qty:'3'}]}); S=r.stock; ok(itemFact(S,tom)===0 && itemRes(S,tom)===0, 'допоставка 3 кг');
  const cost=S.moves.filter(m=>m.docId==='doc2'&&m.type==='ship').reduce((a,m)=>a+(-m.qty)*(+m.cost),0); ok(cost===560, 'себестоимость складской части 560 (+2×80 = 720)');
  r=await st('ret',{docId:'doc2', lineId:'L1', qty:'3', reason:'брак'}); S=r.stock; ok(itemFact(S,tom)===3, 'частичный возврат 3 кг');
  r=await st('ret',{docId:'doc2', lineId:'L1', qty:'6'}); ok(!r.ok, 'вернуть больше отгруженного нельзя');
  // --- 3. две партии: 5 по 180 и 10 по 200, отгрузка 8 → 1500
  r=await st('in',{newName:'Курага', unit:'кг', qty:'5', price:'180', date:'2026-10-01', supplier:'А', docRef:'к1', exp:'2027-03-01'}); const kur=r.out.itemId; const b1=r.out.batchId;
  r=await st('in',{itemId:kur, unit:'кг', qty:'10', price:'200', date:'2026-10-05', supplier:'А', docRef:'к2'}); const b2=r.out.batchId; await st('item',{itemId:kur, links:['p-kur']});
  r=await st('in',{itemId:kur, unit:'кг', qty:'1', price:'200', date:'2026-10-05', supplier:'А', docRef:'к1-bad', exp:'2026-09-01'}); ok(!r.ok, 'срок годности раньше приёмки запрещён');
  await doc('doc3','p-kur',8,300,{m:'s'}); r=await st('ship',{docId:'doc3', lines:[{lineId:'L1', qty:'8'}]}); S=r.stock;
  const c3=S.moves.filter(m=>m.docId==='doc3'&&m.type==='ship').reduce((a,m)=>a+(-m.qty)*(+m.cost),0); ok(c3===1500, 'FIFO: себестоимость 1500 ('+c3+')');
  const {fact}=calc(S); ok(fact[b1]===0 && fact[b2]===7, 'осталось 7 кг второй партии');
  r=await st('batch',{batchId:b2, exp:'2027-01-01'}); r=await st('batch',{batchId:b1, exp:''}); S=r.stock;
  ok(S.batches.find(b=>b.id===b1).exp==='' && S.log.filter(l=>l.action==='Срок годности').length>=2, 'срок задан и очищен, в журнале');
  r=await st('batch',{batchId:b2, price:'210'}); S=r.stock; ok(S.moves.filter(m=>m.docId==='doc3'&&m.type==='ship').reduce((a,m)=>a+(-m.qty)*(+m.cost),0)===1500 && S.batches.find(b=>b.id===b2).price==='210', 'новая цена не меняет историческую себестоимость');
  r=await st('batch',{batchId:b2, price:'1'},G); ok(!r.ok, 'Гриша не меняет цену партии');
  r=await st('batch',{batchId:b2, qty:'2', reason:'ошибка'}); ok(!r.ok, 'приход нельзя уменьшить ниже отгруженного');
  // --- 4. мешки, перевзвешивание, инвентаризация
  r=await st('in',{newName:'Картофель', unit:' Мешок', qty:'4', price:'1000', date:'2026-11-01', supplier:'Б', docRef:'m1'}, G); ok(r.ok, 'Гриша оформил приход в новых единицах «мешок»');
  const pot=r.out.itemId, bm=r.out.batchId; S=r.stock; ok(S.units.some(u=>u.name==='Мешок'), 'единица сохранена в справочнике');
  r=await st('in',{itemId:pot, unit:'мешок', qty:'1.5', price:'1000', date:'2026-11-02', supplier:'Б', docRef:'m2'}); ok(r.ok && !r.stock.units.some(u=>u.name==='мешок'), 'дубль единицы по регистру не создаётся');
  r=await st('in',{itemId:pot, unit:'шт', qty:'1.5', price:'10', date:'2026-11-02', supplier:'Б', docRef:'m3'}); ok(!r.ok, 'штуки только целые');
  r=await st('rw',{batchId:bm, n:'2', kg:'95'}); S=r.stock; const nb=S.batches.find(b=>b.parent===bm); ok(nb && nb.unit==='кг' && +nb.price===stR2(2000/95), 'перевзвешивание 2 мешков в 95 кг, цена '+(nb&&nb.price));
  r=await st('batch',{batchId:bm, exp:'2026-12-01'}); S=r.stock; ok(S.batches.find(b=>b.id===bm).exp==='2026-12-01', 'срок исходной партии (перевзвешенная часть берёт его)');
  r=await st('inv',{rows:[{batchId:bm, fact:'0'},{batchId:nb.id, fact:''}]}); S=r.stock; ok(r.ok && calc(S).fact[bm]===0 && calc(S).fact[nb.id]===95, 'инвентаризация: ноль — факт, пустое — пропуск');
  ok(S.acts.length>=1, 'акт сохранён');
  r=await st('inv',{rows:[{batchId:nb.id, fact:'95'}]}); ok(r.ok && r.out.diffN===0 && r.stock.acts.length>=2, 'акт без расхождений сохраняется');
  r=await st('item',{itemId:pot, note:'Заказывает только ревматология'}); r=await st('item',{itemId:pot, note:''}); ok(r.stock.log.filter(l=>l.action==='Комментарий к товару').length===2, 'комментарий добавлен и очищен, в журнале');
  // --- 5. связь не по названию: похожее название без связи не резервирует
  r=await doc('doc5','p-unlinked',3,100,{m:'s'}); S=(await D({action:'stock',op:'load'})).stock; ok(!S.res.some(x=>x.docId==='doc5'), 'без явной связи — ни резерва, ни списания');
  // --- 7. сбой посередине операции: подготовлено, но не дописано → следующий запрос достраивает
  await ev(`stCommit_=(function(orig){ return function(rid,me,kind,W){ Object.keys(W).forEach(t=>(W[t].upsert||[]).forEach(o=>{o.op=rid;})); const json=JSON.stringify(W); sheet_('sops').getRange(sheet_('sops').getLastRow()+1,1,1,6).setValues([[rid,new Date().toISOString(),me.name,kind,'prep',json]]); delete MEMO_.sops; throw new Error('обрыв'); }; })(stCommit_); 1`);
  const RC=rid(); r=await D({action:'stock',op:'in',rid:RC,d:{itemId:cuc, unit:'кг', qty:'3', price:'70', date:'2026-11-03', supplier:'Рынок', docRef:'н9'}}); ok(!r.ok, 'операция оборвалась');
  await ev(`stCommit_=undefined; 1`); // восстановим настоящую функцию перезапуском кода ниже
  await ev(require('fs').readFileSync(require('path').join(__dirname,'../Code.template.gs'),'utf8').match(/function stCommit_[\s\S]*?\n}\n/)[0]+'; 1');
  r=await D({action:'stock',op:'load'}); S=r.stock; ok(S.batches.filter(b=>b.docRef==='н9').length===1 && itemFact(S,cuc)===13, 'после сбоя операция достроена один раз: '+itemFact(S,cuc));
  r=await D({action:'stock',op:'in',rid:RC,d:{itemId:cuc, unit:'кг', qty:'3', price:'70', date:'2026-11-03', supplier:'Рынок', docRef:'н9'}}); ok(r.ok && r.dup && r.stock.batches.filter(b=>b.docRef==='н9').length===1, 'повтор после сбоя не создаёт второй приход');
  // --- 6. декларации: повтор загрузки не дублирует файл
  const RF=rid(), body={itemId:kur, batchId:b2, name:'декл.pdf', mime:'application/pdf', data:Buffer.from('%PDF-1.4 test').toString('base64')};
  await ev(`(function(){ const o=ST_OPS.file; ST_OPS.file=function(d,me,c,rid){ const r=o(d,me,c,rid); ST_OPS.file=o; throw new Error('связь оборвалась'); }; })(); 1`);
  r=await D({action:'stock',op:'file',rid:RF,d:body}); ok(!r.ok, 'сбой после загрузки на Диск');
  r=await D({action:'stock',op:'file',rid:RF,d:body}); ok(r.ok, 'повтор завершил привязку');
  const fl=await (await fetch('http://localhost:8787/files')).json(); ok(fl.filter(f=>f.name===RF+'__декл.pdf').length===1, 'файл на Диске один');
  const fid=r.out.fileId; r=await G({action:'stock',op:'fileGet',d:{id:fid}}); ok(r.ok && Buffer.from(r.data,'base64').toString().startsWith('%PDF'), 'Гриша открывает декларацию');
  r=await call('Гриша','0000',{action:'stock',op:'fileGet',d:{id:fid}}); ok(!r.ok && r.error==='auth', 'без входа — нет доступа');
  r=await st('file',{itemId:kur, name:'x.exe', mime:'application/x-msdownload', data:'AAAA'}); ok(!r.ok, 'чужой тип файла отклонён');
  // --- 7. одновременно: два документа на один остаток → без двойного резерва
  r=await st('in',{newName:'Лимоны', unit:'кг', qty:'5', price:'100', date:'2026-11-01', supplier:'В', docRef:'л1'}); const lem=r.out.itemId; await st('item',{itemId:lem, links:['p-lem']});
  await Promise.all([doc('dA','p-lem',4,200,{m:'s'}), doc('dB','p-lem',4,200,{m:'s'})]);
  S=(await D({action:'stock',op:'load'})).stock; ok(itemRes(S,lem)===5, 'два документа по 4 кг при остатке 5 — резерв ровно 5: '+itemRes(S,lem));
  // архив освобождает резерв
  const row=(await (await fetch('http://localhost:8787/dump')).json())['Журнал'].find(r=>r.includes('dA'));
  console.log(fails?'\nПРОВАЛОВ: '+fails:'\nВСЕ ПРОВЕРКИ СКЛАДА ПРОШЛИ'); process.exit(fails?1:0);
})();
function stR2(x){ return Math.round(x*100)/100; }
