const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(__dirname,'server.js'),'utf8').split('http.createServer')[0]+'\nglobalThis.c=ctx;';
const h={require,__dirname,process,Buffer,console};vm.createContext(h);vm.runInContext(source,h);const c=h.c;
const admin={user:'Даниил',key:'1111'}, manager={user:'Наталья',key:'2222'};
function call(p){vm.runInContext('Object.keys(MEMO_).forEach(k=>delete MEMO_[k]);Object.keys(SH_).forEach(k=>delete SH_[k]);',c);return JSON.parse(JSON.stringify(c.handle_({...admin,protocol:1,...p})));}
function load(){return call({action:'load'}).data;}
function sync(changes,base={}){return call({action:'sync',changes,base});}
let n=0;function test(name,fn){fn();console.log('PASS',name);n++;}
const fixture={suppliers:{upsert:[{id:'s',name:'Supplier',vat:'none'}]},customers:{upsert:[{id:'c',name:'Customer',address:'old',ship:'old'}]},products:{upsert:[{id:'p',name:'Product',unit:'кг'}]},prices:{upsert:[{customerId:'c',productId:'p',price:'100'}]}};
assert(sync(fixture).ok);
let original=load().customers[0];
test('different fields merge, authoritative acknowledgement',()=>{
 assert(sync({customers:{upsert:[{...original,address:'A'}]}},{customers:{c:original}}).ok);
 const r=sync({customers:{upsert:[{...original,ship:'B'}]}},{customers:{c:original}});assert(r.ok);assert.equal(r.accepted.customers.c.address,'A');assert.equal(load().customers[0].ship,'B');
});
test('same field conflict rejects the whole batch before writes',()=>{
 const r=sync({customers:{upsert:[{...original,address:'C'}]},products:{upsert:[{id:'new',name:'must not exist'}]}},{customers:{c:original}});
 assert.equal(r.error,'edit_conflict');assert(r.conflicts[0].fields.includes('address'));assert(!load().products.some(p=>p.id==='new'));
});
test('explicit rebase allows resolution',()=>{const now=load().customers[0];assert(sync({customers:{upsert:[{...now,address:'C'}]}},{customers:{c:now}}).ok);});
test('stale delete does not delete modified record',()=>{assert.equal(sync({customers:{del:['c']}},{customers:{c:original}}).error,'edit_conflict');});
test('deleted record is not silently resurrected',()=>{const old=load().customers[0];assert(sync({customers:{del:['c']}},{customers:{c:old}}).ok);assert.equal(sync({customers:{upsert:[{...old,name:'return'}]}},{customers:{c:old}}).error,'edit_conflict');assert(sync({customers:{upsert:[old]}}).ok);});
test('replayed successful save is idempotent',()=>{let old=load().customers[0], ch={customers:{upsert:[{...old,address:'D'}]}}, base={customers:{c:old}};assert(sync(ch,base).ok);assert(sync(ch,base).ok);});
test('unknown baseline on existing record is rejected',()=>{assert.equal(sync({customers:{upsert:[{id:'c',name:'overwrite'}]}}).error,'edit_conflict');});
test('old client cannot bypass the protocol',()=>{assert.equal(call({action:'sync',protocol:undefined,changes:{customers:{upsert:[{id:'c',name:'overwrite'}]}}}).ok,false);});
test('prices receive conflict protection too',()=>{let old=load().prices[0];assert(sync({prices:{upsert:[{...old,price:'110'}]}},{prices:{'c|p':old}}).ok);assert.equal(sync({prices:{upsert:[{...old,price:'120'}]}},{prices:{'c|p':old}}).error,'edit_conflict');});
const snap={dr:{id:'d',supplierId:'s',customerId:'c',number:'1',date:'2026-10-27',lines:[{productId:'p',qty:'1',price:'110'}]},s:{id:'s',vat:'none'},c:{id:'c'},prods:{p:{name:'Product',unit:'кг'}},meta:{}};
let entry={id:'d',supplierId:'s',customerId:'c',number:'1',date:'2026-10-27',sum:'110',updated:'a',snap:JSON.stringify(snap)};
assert(call({action:'saveDoc',entry,base:{journal:{d:null}}}).ok);
test('document concurrent change blocks save and bundled unrelated changes',()=>{
 const old=load().journal[0];assert(call({action:'saveDoc',entry:{...old,updated:'b'},base:{journal:{d:old}}}).ok);
 const r=call({action:'saveDoc',entry:{...old,sum:'220'},base:{journal:{d:old}},changes:{products:{upsert:[{id:'never',name:'never'}]}}});assert.equal(r.error,'edit_conflict');assert(!load().products.some(p=>p.id==='never'));
});
test('journal sync cannot bypass revision comparison',()=>{assert.equal(sync({journal:{upsert:[entry]}},{journal:{d:entry}}).error,'edit_conflict');});
test('permission failure is not acknowledged as success',()=>{const old=load().journal[0];let sn=JSON.parse(old.snap);sn.dr.lines[0].price='1';const r=call({user:'Гриша',key:'3333',action:'sync',changes:{journal:{upsert:[{...old,snap:JSON.stringify(sn)}]}},base:{journal:{d:old}}});assert.equal(r.error,'forbidden');});
test('number conflict does not partially sync bundled changes',()=>{const e={...entry,id:'d2'};const r=call({action:'saveDoc',entry:e,changes:{products:{upsert:[{id:'number-no',name:'no'}]}},base:{journal:{d2:null}}});assert(r.conflict);assert.equal(r.concurrency,1);assert(!load().products.some(p=>p.id==='number-no'));});
console.log(n+' backend concurrency tests passed');
