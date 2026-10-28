const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm');
const {JSDOM,VirtualConsole}=require('../tools/node_modules/jsdom');
const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const html=fs.readFileSync(path.join(__dirname,'../out/test.html'),'utf8').replace(/\}\)\(\);\s*<\/script>/,'window.T={ev:s=>eval(s)};})();</script>');
const dom=new JSDOM(html,{url:'http://localhost:8787/page',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false,addListener(){},addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};}});
(async()=>{try{
 const w=dom.window,D=w.__fd.D();const supplier=D.suppliers[0],customer=D.customers[0];assert(customer);customer.name='Тестовый университет — подразделение общественного питания '.repeat(4);
 D.draft={supplierId:supplier.id,customerId:customer.id,number:'22',date:'2026-10-29',lines:D.products.slice(0,2).map(p=>({productId:p.id,qty:40,price:155.67}))};
 // Emulate long requisites exceeding the unscaled page budget: the second row stays with signatures.
 w.HTMLElement.prototype.getBoundingClientRect=function(){return {height:1000,width:1000}};
 let pages=w.T.ev('pagesFor("torg12",calc(D.draft))');assert.equal(pages.length,1);
 const doc=new JSDOM(pages[0]).window.document;assert.equal(doc.querySelectorAll('.m-row').length,2);assert(doc.querySelector('.m-foot').textContent.includes('Груз получил'));assert(doc.querySelector('.items').textContent.includes('Всего по накладной'));
 D.draft.lines.pop();assert.equal(w.T.ev('pagesFor("torg12",calc(D.draft))').length,1);assert.deepEqual(errors,[]);
 console.log('PASS 1–2 rows stay on one TORG-12 page with totals and signatures despite tall requisites');
 const app=fs.readFileSync(path.join(__dirname,'../src/app.html'),'utf8'),src=app.slice(app.indexOf('async function addSheets('),app.indexOf('function pagesFor('));
 class PDF{constructor(opts){this.pages=[opts.orientation];this.images=[]}addPage(_,o){this.pages.push(o)}addImage(image,type,x,y,width,height){this.images.push({image,x,y,width,height})}}
 const ctx={window:{jspdf:{jsPDF:PDF},html2canvas:async sh=>sh},scanify:x=>x};vm.createContext(ctx);vm.runInContext(src,ctx);
 const st={};await ctx.addSheets(st,[{width:2970,height:2500},{width:2970,height:2100}],true);await ctx.addSheets(st,[{width:2100,height:2970}],false);
 assert.deepEqual(st.pdf.pages,['l','l','p']);assert.equal(st.pdf.images.length,3);
 st.pdf.images.forEach((p,i)=>{const W=i<2?297:210,H=i<2?210:297;assert(p.x>=-1e-8&&p.y===0&&p.x+p.width<=W+1e-8&&p.height<=H+1e-8);assert(Math.abs(p.width/p.height-p.image.width/p.image.height)<1e-8)});
 console.log('PASS oversized logical sheet fits one A4 page without clipping; multi-page set and aspect ratio preserved');
 }finally{dom.window.close()}})().catch(e=>{console.error(e);process.exitCode=1});
