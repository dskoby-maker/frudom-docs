const fs=require('fs'),path=require('path'),assert=require('assert'),{spawn}=require('child_process'),{JSDOM,VirtualConsole}=require('../tools/node_modules/jsdom');
const root=path.join(__dirname,'../..'),srv=spawn(process.execPath,['dev/test/server.js'],{cwd:root}),doms=[],errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function create(){
 const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Not implemented'))errors.push(e.message)});
 const html=fs.readFileSync(path.join(root,'dev/out/test.html'),'utf8').replace(/\}\)\(\);\s*<\/script>/,'window.T={ev:s=>eval(s)};})();</script>');
 const dom=new JSDOM(html,{url:'http://localhost:8787/page',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.AbortController=AbortController;w.TextDecoder=TextDecoder;w.fetch=(u,o)=>{assert(String(u).startsWith('http://localhost:8787'));return fetch(u,o)};w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};}});doms.push(dom);const w=dom.window;w.document.querySelector('[data-who="Даниил"]').click();w.document.querySelector('#fd-pass').value='1111';await w.document.querySelector('#fd-enter').onclick();await settle(w);await w.T.ev('pull()');await settle(w);return w;
}
async function settle(w){for(let i=0;i<15;i++){await w.T.ev('flush()');await delay(40);if(!w.T.ev('flushing||hasPending()'))return;}throw Error('pending did not settle: '+w.T.ev('$("#fd-status").textContent'));}
(async()=>{await new Promise((ok,bad)=>{srv.stdout.once('data',ok);srv.once('error',bad);srv.once('exit',c=>bad(Error('server exit '+c)));});
const a=await create(),b=await create();
for(const w of [a,b])for(const t of ['doc','order','calendar','journal','archive','customers','products','suppliers','data','profit','events','tasks']){w.document.querySelector('nav.tabs [data-tab="'+t+'"]').click();await delay(25);}await settle(a);await settle(b);
await a.T.ev('pull()');await settle(a);await b.T.ev('pull()');await settle(b);
assert(a.T.ev('eisServerReady'));const id=a.T.ev('D.customers[0].id');a.testId=b.testId=id;
a.T.ev('cus(window.testId).address="A local";dirty("customers",window.testId)');b.T.ev('cus(window.testId).ship="B remote";dirty("customers",window.testId)');await settle(b);await settle(a);assert.equal(a.T.ev('cus(window.testId).address'),'A local');assert.equal(a.T.ev('cus(window.testId).ship'),'B remote');console.log('PASS two sessions merge independent fields');
await b.T.ev('pull()');await settle(b);
a.T.ev('cus(window.testId).address="A conflict";dirty("customers",window.testId)');b.T.ev('cus(window.testId).address="B conflict";dirty("customers",window.testId)');await settle(b);await a.T.ev('flush()');assert(a.T.ev('syncBlocked'));assert(a.document.querySelector('#fd-conflict').open);a.document.querySelector('#fd-conflict [data-choice="server"]').click();await settle(a);assert.equal(a.T.ev('cus(window.testId).address'),'B conflict');assert(!a.T.ev('syncBlocked'));console.log('PASS visible conflict resolution preserves remote value');
// EIS settings dialog is usable with the current document and server capability.
a.T.ev('D.draft.contractId=D.contracts.find(x=>x.customerId===D.draft.customerId)?.id||""');
const contract=a.T.ev('D.contracts.find(x=>x.customerId===D.draft.customerId)');if(contract){a.T.ev('eisSetup(calc(D.draft))');assert(a.document.querySelector('#fd-eis').open);a.document.querySelector('#eis-close').click();console.log('PASS EIS setup dialog opens and closes');}
assert.deepEqual(errors,[]);console.log('PASS 12 application tabs in both sessions without runtime errors');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{doms.forEach(d=>d.window.close());srv.kill();});
