/* ================= ДЕКЛАРАЦИИ: библиотека, поиск, привязка к товарам, скачать все к документу одним файлом =================
   Запись листа «Склад: декларации»: файл на Диске + что в ней (goods — текстом), товары склада (items), позиции документов (prods),
   № декларации, срок действия, изготовитель. Документ → декларации: позиция привязана (prods или через товар склада) — «привязана»,
   иначе совпадение по названию — «по названию» (подставляется, если привязанной нет). Скачивание — один PDF (pdf-lib) или ZIP. */
const dJ = v => { if(Array.isArray(v)) return v; try{ const a=JSON.parse(v||"[]"); return Array.isArray(a)?a:[]; }catch(e){ return []; } };
const dItems = f => { const a=dJ(f.items).slice(); if(f.itemId && !a.includes(f.itemId)) a.unshift(f.itemId); return a; };
const dGoods = f => String(f.goods!=null && f.goods!=="" ? f.goods : (f.itemName||"")).split(";").map(skN).filter(Boolean);
function dProds(f){ const X=skIdx(), s=new Set(dJ(f.prods)); dItems(f).forEach(id=>{ const it=X.item[id]; ((it&&it._links)||[]).forEach(p=>s.add(p)); }); return s; }
const dDays = iso => Math.round((new Date(iso+"T12:00:00")-new Date(todayISO()+"T12:00:00"))/864e5);
const dState = (f, at) => { if(!f.validTo) return ""; const d=at?Math.round((new Date(f.validTo+"T12:00:00")-new Date(at+"T12:00:00"))/864e5):dDays(f.validTo); return d<0?"bad":d<=30?"warn":"ok"; };
const dBadge = (f, at) => { const s=dState(f, at); if(!f.validTo) return `<span class="dcl-v none">срок не указан</span>`;
  return `<span class="dcl-v ${s}">${s==="bad"?(at?"истекла к поставке":"истекла")+" "+fd(f.validTo):"до "+fd(f.validTo)}</span>`; };
const dIsPdf = f => f.mime==="application/pdf" || /\.pdf$/i.test(f.name||""), dIsImg = f => /^image\//.test(f.mime||"");
const dSrvOk = () => !!(SK && SK.decl>=2);
const dTitle = f => dGoods(f).join(", ") || f.name || "Декларация";

/* ---------- совпадения для позиции документа ---------- */
function dMatch(p){ const S=stems(p.name||""), strong=[], weak=[];
  skD().files.forEach(f=>{ if(dProds(f).has(p.id)){ strong.push(f); return; }
    let best=0; dGoods(f).forEach(g=>{ const G=stems(g); if(G.length && G.every(w=>S.includes(w))){ const sc=G.length/Math.max(1,S.length); if(sc>best) best=sc; } });
    if(best>0) weak.push(Object.assign(Object.create(f),{__sc:best})); });
  weak.sort((a,b)=>b.__sc-a.__sc); return {strong, weak}; }

/* ---------- библиотека (раздел «Декларации» на складе) ---------- */
let SKDL={f:"all"};
function skDeclList(q){ const L0=skD().files.slice().sort((a,b)=>String(b.at).localeCompare(String(a.at))), words=skK(q).split(" ").filter(Boolean);
  const hay=f=>skK([dGoods(f).join(" "), f.num, f.maker, f.name, f.note, f.itemName, ...[...dProds(f)].map(id=>(prod(id)||{}).name||"")].join(" "));
  const byQ=L0.filter(f=>!words.length || words.every(w=>hay(f).includes(w)));
  const C={all:byQ.length, ok:byQ.filter(f=>dState(f)==="ok").length, warn:byQ.filter(f=>dState(f)==="warn").length, bad:byQ.filter(f=>dState(f)==="bad").length, nodate:byQ.filter(f=>!f.validTo).length};
  const L=byQ.filter(f=>SKDL.f==="all" || (SKDL.f==="nodate"?!f.validTo:dState(f)===SKDL.f));
  const chip=(k,t)=>C[k]||k==="all"||SKDL.f===k?`<button type="button" data-dlf="${k}" class="${SKDL.f===k?"on":""}">${t} <em>${C[k]}</em></button>`:"";
  return `<div class="dcl-top"><button type="button" class="btn pri sm" data-dl="add">+ Добавить декларацию</button>${skHQ("Декларации")}<span class="muted dcl-tip">Ищите по товару, номеру, изготовителю — в поиске выше</span></div>
    <div class="pfchips dcl-chips">${chip("all","Все")}${chip("ok","Действуют")}${chip("warn","Истекают ≤ 30 дн.")}${chip("bad","Истекли")}${chip("nodate","Без срока")}</div>
    ${!dSrvOk()&&L0.length?`<div class="sknoteb">Чтобы указывать в декларации несколько товаров, номер и срок — обновите Code.gs в таблице.</div>`:""}
    ${L.length?`<div class="dcl-list">${L.map((f,i)=>dRow(f,i)).join("")}</div>`:`<div class="skempty"><b>${words.length||SKDL.f!=="all"?"Ничего не найдено":"Деклараций пока нет"}</b><span>${words.length||SKDL.f!=="all"?"Попробуйте другое слово или фильтр «Все».":"Нажмите «+ Добавить декларацию»: файл, что в ней, номер и срок."}</span></div>`}`; }
function dRow(f, i){ const G=dGoods(f), P=[...dProds(f)].length, pdf=dIsPdf(f), im=dIsImg(f);
  return `<div class="dcl" style="--d:${Math.min(i||0,12)*22}ms">
    <button type="button" class="dcl-m" data-dl="view" data-id="${f.id}" title="Подробнее о декларации"><span class="dcl-g">${G.slice(0,8).map(g=>`<i>${esc(g)}</i>`).join("")}${G.length>8?`<i class="more">ещё ${G.length-8}</i>`:""}${!G.length?`<i class="miss">товары не указаны</i>`:""}</span>
      <small>${[f.num?"№ "+esc(f.num):"", f.maker?esc(f.maker):"", P?`привязана к ${P} ${plural(P,["позиции","позициям","позициям"])}`:"", esc(f.name||"")].filter(Boolean).join(" · ")}</small></button>
    <span class="dcl-s">${dBadge(f)}</span>
    <span class="dcl-a">${pdf||im?`<button type="button" class="btn ghost sm" data-skfview="${f.id}">Открыть</button>`:""}<button type="button" class="btn ghost sm" data-skfprn="${f.id}" aria-label="Печать" title="Распечатать">${D_PRN}</button><button type="button" class="btn ghost sm" data-skfget="${f.id}" aria-label="Скачать">⤓</button><button type="button" class="btn ghost sm" data-dl="edit" data-id="${f.id}" aria-label="Изменить">✎</button><button type="button" class="btn ghost sm danger" data-skfdel="${f.id}" aria-label="Удалить">×</button></span></div>`; }

/* ---------- карточка декларации: всё о ней и все действия ---------- */
let SKDV=null;
function dView(id){ SKDV={id}; SK_RE=()=>dView(id); skModal(dViewHtml, true); }
function dViewHtml(){ const f=skD().files.find(x=>x.id===SKDV.id); if(!f) return skHead("Декларации","Декларация удалена","Обновите список.");
  const G=dGoods(f), X=skIdx(), P=dJ(f.prods).map(id=>prod(id)).filter(p=>p&&p.id), I=dItems(f).map(id=>X.item[id]).filter(Boolean), pdf=dIsPdf(f), im=dIsImg(f);
  const info=[["№ декларации",f.num||"—"],["Действует до",f.validTo?fd(f.validTo):"не указан"],["Изготовитель",f.maker||"—"],["Файл",(f.name||"")+(+f.size?" · "+(+f.size>=1048576?(f.size/1048576).toFixed(1).replace(".",",")+" МБ":Math.max(1,Math.round(f.size/1024))+" КБ"):"")],["Добавил",(f.by||"—")+(f.at?" · "+skWhen(f.at):"")]].concat(f.batchName?[["Партия",f.batchName]]:[]).concat(f.note?[["Комментарий",f.note]]:[]);
  return skHead("Декларация", esc(G.join(", ")||f.name||"Декларация"), "", "Декларации")
   + `<div class="dv-st">${dBadge(f)}</div>
     <div class="dcl-g dv-g">${G.map(g=>`<i>${esc(g)}</i>`).join("")||`<i class="miss">товары не указаны</i>`}</div>
     <dl class="dc-info">${info.map(([a,v])=>`<div><dt>${a}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
     ${P.length||I.length?`<div class="skbox"><div class="skbh"><b>Привязана к позициям</b><small class="muted">в документах с этими товарами подставится сама</small></div>${P.map(p=>`<span class="sklink">${esc(p.name)}</span>`).join("")}${I.map(i=>`<span class="sklink">🔗 ${esc(i.name)} <small class="muted">склад</small></span>`).join("")}</div>`:""}
     <div class="dc-acts dv-acts">${pdf||im?`<button class="btn" data-skfview="${f.id}">Открыть</button>`:""}<button class="btn" data-skfprn="${f.id}">${D_PRN} Печать</button><button class="btn" data-skfget="${f.id}">Скачать</button><button class="btn" data-dl="edit" data-id="${f.id}">Изменить</button><button class="btn ghost danger" data-skfdel="${f.id}">Удалить</button><button class="btn pri" data-sk="close">Готово</button></div>`; }

/* ---------- форма: добавить / изменить декларацию ---------- */
let SKDF=null;
function dForm(pre, onDone){ const f=pre&&pre.id?skD().files.find(x=>x.id===pre.id):null;
  const chips = f ? dGoods(f).map(t=>({t})).concat(dItems(f).filter(id=>skIdx().item[id] && !dGoods(f).some(g=>skK(g)===skK(skIdx().item[id].name))).map(id=>({t:skIdx().item[id].name, item:id}))) : [];
  if(f){ const X=skIdx(); dItems(f).forEach(id=>{ const c=chips.find(x=>X.item[id] && skK(x.t)===skK(X.item[id].name)); if(c) c.item=id; }); dJ(f.prods).forEach(pid=>{ const p=prod(pid); if(!p) return; const c=chips.find(x=>skK(x.t)===skK(p.name)); if(c) c.pid=pid; else chips.push({t:p.name, pid}); }); }
  SKDF=Object.assign({id:f?f.id:"", files:[], chips, num:f?f.num||"":"", validTo:f?f.validTo||"":"", maker:f?f.maker||"":"", note:f?f.note||"":"", batchId:"", q:"", ai:null, busy:false}, pre&&!pre.id?pre:{}, {onDone});
  if(!SKDF.chips) SKDF.chips=[]; skModal(dFormHtml, true); }
function dFormHtml(){ const F=SKDF, edit=!!F.id, f=edit?skD().files.find(x=>x.id===F.id):null;
  return skHead("Декларации", edit?"Изменить декларацию":"Новая декларация", edit?esc(f?f.name:""):"Файл, на какие товары, номер и срок — по ним потом найдёте и скачаете декларации к документу.", "Декларации")
   + (edit?"":`<div class="dcf-file"><label class="dcf-drop${F.files.length?" has":""}"><input type="file" class="dcf-in" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.doc,.docx,.xls,.xlsx,.rtf,.odt,.ods,.odp,.ppt,.pptx,.txt,.csv" hidden>
       ${F.files.length?`<span class="dcf-fl">${F.files.map(x=>`<span><b>${esc(x.name)}</b><small>${(x.size/1024/1024).toFixed(x.size>1048576?1:2).replace(".",",")} МБ</small></span>`).join("")}</span><span class="dcf-ch">Заменить</span>`:`<span class="dcf-ic">📄</span><span><b>Выберите файл или сфотографируйте</b><small>PDF, фото, Word, Excel и другие; несколько файлов соберутся в один PDF</small></span>`}</label>
       ${F.files.length?`<button type="button" class="btn sm dcf-ai${F.ai&&F.ai.busy?" busy":""}" data-dl="ai"${F.ai&&F.ai.busy?" disabled":""}>${F.ai&&F.ai.busy?`<i class="spin"></i>ИИ читает…`:"✨ Заполнить по файлу (ИИ)"}</button>`:""}</div>
       ${F.ai&&F.ai.err?`<div class="mi-errs"><span>ИИ не прочитал: ${esc(F.ai.err)}</span></div>`:""}${F.ai&&F.ai.done?`<div class="mi-rest ok">${esc(F.ai.done)}</div>`:""}`)
   + `<div class="dcf-goods"><div class="dcf-lbl">На какие товары декларация${skHQ("Товары в декларации")}</div>
       <div class="dcf-chips">${F.chips.map((c,i)=>`<span class="dcf-c${c.pid||c.item?" lk":""}" title="${c.pid?"Привязана к позиции документов":c.item?"Привязана к товару склада":"По названию"}">${c.pid||c.item?"🔗 ":""}${esc(c.t)}<button type="button" data-dl="unchip" data-i="${i}" aria-label="Убрать">×</button></span>`).join("")}
       <input class="dcf-q" data-keep="1" autocomplete="off" enterkeyhint="done" value="${esc(F.q)}" placeholder="${F.chips.length?"ещё товар…":"Огурцы, томаты… — Enter"}"></div>
       <div class="dcf-sug" id="dcf-sug">${dSugHtml()}</div></div>
     <div class="skgrid dcf-meta"><label class="f">№ декларации<input class="dcf-num" data-keep="1" value="${esc(F.num)}" placeholder="ЕАЭС N RU Д-…"></label>
       <label class="f">Действует до<input type="date" class="dcf-to" data-keep="1" value="${esc(F.validTo)}"></label>
       <label class="f">Изготовитель<input class="dcf-mk" data-keep="1" value="${esc(F.maker)}" placeholder="необязательно"></label>
       <label class="f wide">Комментарий<input class="dcf-nt" data-keep="1" value="${esc(F.note)}" placeholder="необязательно"></label></div>
     <div class="dc-acts"><button class="btn" data-dl="cancel">Отмена</button><button class="btn pri" data-dl="save"${F.busy?" disabled":""}>${F.busy?"Сохраняю…":edit?"Сохранить":"Добавить декларацию"}</button></div>`; }
function dPickItem(id){ const it=skIdx().item[id]; if(!it) return; const ex=SKDF.chips.find(c=>skK(c.t)===skK(it.name)); if(ex) ex.item=it.id; else SKDF.chips.push({t:it.name, item:it.id}); }
function dPickPid(id){ const p=prod(id); if(!p||!p.id) return; const ex=SKDF.chips.find(c=>skK(c.t)===skK(p.name)); if(ex) ex.pid=p.id; else SKDF.chips.push({t:p.name, pid:p.id}); }
function dSugList(){ const F=SKDF, q=skK(F.q), X=skIdx(), has=(k,id)=>F.chips.some(c=>c[k]===id), w=q.split(" ").filter(Boolean), hit=n=>w.every(x=>skK(n).includes(x));
  if(!q) return {I:[], P:[]};
  return {I:X.S.items.filter(i=>!has("item",i.id) && [i.name,i.alt||""].some(hit)).slice(0,8), P:D.products.filter(p=>!has("pid",p.id) && hit(p.name)).slice(0,12)}; }
function dSugHtml(){ const F=SKDF, q=skK(F.q); if(!q) return F.chips.length?"":`<small class="muted">Начните вводить — предложу товары склада и позиции документов. Можно просто вписать название и нажать Enter.</small>`;
  const {I, P}=dSugList(), n=I.length+P.length;
  return `<div class="dcf-sh"><small class="muted">${n?"Нажимайте на нужные — можно выбрать несколько подряд":"Больше ничего не найдено"}</small>${n>1?`<button type="button" class="btn ghost sm" data-dl="addall">Выбрать все (${n})</button>`:""}<button type="button" class="btn ghost sm" data-dl="qclr">Готово</button></div>
    <button type="button" class="dcf-s new" data-dl="addtxt"><b>+ «${esc(skN(F.q))}»</b><small>по названию — найдётся во всех документах с похожим товаром</small></button>`
    + I.map(i=>`<button type="button" class="dcf-s" data-dl="additem" data-id="${i.id}"><b>🔗 ${esc(i.name)}</b><small>товар склада${(i._links||[]).length?" · "+i._links.length+" поз. документов":""}</small></button>`).join("")
    + P.map(p=>`<button type="button" class="dcf-s" data-dl="addpid" data-id="${p.id}"><b>🔗 ${esc(p.name)}</b><small>позиция документов</small></button>`).join(""); }
function dFormRead(){ const d=SKM&&SKM.d; if(!d||!SKDF) return; const v=c=>{ const el=d.querySelector(c); return el?el.value:null; };
  [["num",".dcf-num"],["validTo",".dcf-to"],["maker",".dcf-mk"],["note",".dcf-nt"],["q",".dcf-q"]].forEach(([k,c])=>{ const x=v(c); if(x!=null) SKDF[k]=x; }); }
function dRedraw(focus){ if(!SKM||SKM.render!==dFormHtml) return; const d=SKM.d, st=d.scrollTop; d.innerHTML=dFormHtml(); d.scrollTop=st; if(focus){ const el=d.querySelector(focus); if(el){ el.focus({preventScroll:true}); try{ const n=el.value.length; el.setSelectionRange(n,n); }catch(e){} } } }
function dAddText(t){ String(t||"").split(/[,;\n]/).map(skN).filter(Boolean).forEach(x=>{ if(!SKDF.chips.some(c=>skK(c.t)===skK(x))) SKDF.chips.push({t:x}); }); SKDF.q=""; }
/* несколько фото/PDF → один PDF */
async function dLib(){ await loadScript(LIBCDN+"pdf-lib/1.17.1/pdf-lib.min.js", ()=>window.PDFLib); return window.PDFLib; }
const dU8 = f => new Promise((ok,bad)=>{ const r=new FileReader(); r.onload=()=>ok(new Uint8Array(r.result)); r.onerror=()=>bad(new Error("не получилось прочитать «"+f.name+"»")); r.readAsArrayBuffer(f); });
function dToJpeg(u8, mime){ return new Promise((ok,bad)=>{ const url=URL.createObjectURL(new Blob([u8],{type:mime||"image/jpeg"})), im=new Image();
  im.onload=()=>{ const k=Math.min(1, 2400/Math.max(im.width,im.height)), c=document.createElement("canvas"); c.width=Math.round(im.width*k); c.height=Math.round(im.height*k); const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.drawImage(im,0,0,c.width,c.height); URL.revokeObjectURL(url);
    c.toBlob(b=>{ if(!b) return bad(new Error("картинка не читается")); b.arrayBuffer().then(a=>ok({u8:new Uint8Array(a), w:c.width, h:c.height})); },"image/jpeg",0.88); };
  im.onerror=()=>{ URL.revokeObjectURL(url); bad(new Error("этот формат фото браузер не открывает (HEIC) — сохраните как JPG")); }; im.src=url; }); }
async function dAddToPdf(out, u8, mime, name){ const L=window.PDFLib;
  if(mime==="application/pdf" || /\.pdf$/i.test(name||"")){ const src=await L.PDFDocument.load(u8,{ignoreEncryption:true}); (await out.copyPages(src, src.getPageIndices())).forEach(p=>out.addPage(p)); return; }
  if(/^image\//.test(mime||"")){ const j=await dToJpeg(u8, mime), img=await out.embedJpg(j.u8), W=595.28, H=841.89, m=18, k=Math.min((W-2*m)/j.w,(H-2*m)/j.h), w=j.w*k, h=j.h*k; const pg=out.addPage([W,H]); pg.drawImage(img,{x:(W-w)/2, y:(H-h)/2, width:w, height:h}); return; }
  throw new Error("не PDF и не фото"); }
/* Word, Excel, PowerPoint, RTF, TXT… → PDF через Google Диск (Code.gs ≥ 22): сохранённая декларация — по ID, файл с устройства — содержимым */
const dDirect = (mime, name) => mime==="application/pdf" || /\.pdf$/i.test(name||"") || /^image\//.test(mime||"");
const dB64u8 = b => { const bin=atob(b), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return u8; };
const dU8b64 = u8 => { let bin=""; for(let i=0;i<u8.length;i+=0x8000) bin+=String.fromCharCode.apply(null, u8.subarray(i,i+0x8000)); return btoa(bin); };
async function dPdfOf(src){ if((D.srvVer||0)<22) throw new Error("обновите Code.gs — старый скрипт таблицы не превращает Word и Excel в PDF");
  const ck=src.id?"pdf:"+src.id:""; if(ck && DFC[ck]) return DFC[ck];
  const j=await api(src.id?{action:"stock", op:"filePdf", d:{id:src.id}}:{action:"stock", op:"toPdf", d:{name:src.name, mime:src.mime, data:dU8b64(src.u8)}});
  if(!j || !j.data) throw new Error((j&&j.error)||"не получилось сделать PDF");
  const r={name:j.name, mime:"application/pdf", u8:dB64u8(j.data)}; if(ck) DFC[ck]=r; return r; }
async function dSave(){ dFormRead(); const F=SKDF, edit=!!F.id; if(F.q.trim()) dAddText(F.q);
  if(!F.chips.length){ toast("err","Укажите, на какие товары декларация","Впишите название и нажмите Enter или выберите из подсказок."); dRedraw(".dcf-q"); return; }
  if(!edit && !F.files.length){ toast("err","Выберите файл декларации",""); return; }
  const meta={goods:F.chips.map(c=>c.t), items:F.chips.filter(c=>c.item).map(c=>c.item), prods:F.chips.filter(c=>c.pid).map(c=>c.pid), num:F.num, validTo:F.validTo, maker:F.maker, note:F.note};
  if(!dSrvOk()){ if(edit){ toast("err","Сначала обновите Code.gs","Старый скрипт таблицы не умеет менять описание декларации."); return; }
    if(!meta.items.length){ toast("err","Сначала обновите Code.gs","Со старым скриптом декларацию можно прикрепить только к товару склада — выберите товар со значком 🔗."); return; } }
  F.busy=true; dRedraw();
  try{ if(edit){ await skSend("fileEdit", Object.assign({id:F.id}, meta), "Декларация: "+meta.goods.join(", ")); toast("ok","Декларация сохранена",meta.goods.join(", ")); }
    else { let name=F.files[0].name, mime=skMime(F.files[0]), u8;
      if(F.files.length>1){ const L=await dLib(), out=await L.PDFDocument.create();
        for(const x of F.files){ let u=await dU8(x), m=skMime(x);
          if(!dDirect(m, x.name)){ try{ u=(await dPdfOf({name:x.name, mime:m, u8:u})).u8; m="application/pdf"; }catch(e){ throw new Error("«"+x.name+"»: "+e.message); } }
          await dAddToPdf(out, u, m, x.name); }
        u8=await out.save(); mime="application/pdf"; name=(meta.goods.slice(0,3).join(", ")||"Декларация").replace(/[\\/:*?"<>|]+/g," ")+".pdf"; }
      else { if(!skFileOk(F.files[0])) throw new Error("файл не подходит"); u8=await dU8(F.files[0]); }
      if(u8.length>20*1024*1024) throw new Error("файл больше 20 МБ");
      let bin=""; for(let i=0;i<u8.length;i+=0x8000) bin+=String.fromCharCode.apply(null, u8.subarray(i,i+0x8000));
      await skSend("file", Object.assign({itemId:meta.items[0]||"", batchId:F.batchId||"", name, mime, size:u8.length, data:btoa(bin)}, meta), "Декларация: "+name);
      toast("ok","Декларация добавлена", meta.goods.join(", ")); }
    const cb=F.onDone; SKDF=null; skClose(true); if(cb) cb(); else if(curTab==="stock"){ SKV.tab="files"; try{ skDrawList(); }catch(e){} }
  }catch(e){ if(e.queued){ const cb=F.onDone; SKDF=null; skErr(e,"декларация"); skClose(); if(cb) cb(); return; } F.busy=false; dRedraw(); toast("err","Декларация не сохранена", e.message); } }
async function dAi(){ const F=SKDF; const x0=F.files.find(x=>/^image\//.test(skMime(x))||skMime(x)==="application/pdf"); if(!x0){ toast("err","ИИ читает только PDF или фото",""); return; }
  dFormRead(); F.ai={busy:1}; dRedraw();
  try{ const d=await aiPrep(x0); if(d.data.length>18e6) throw new Error("файл больше 13 МБ");
    let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:150000, body:JSON.stringify({key:pass(), user:curUser(), action:"aiRead", kind:"decl", mime:d.mime, data:d.data})}); }
    catch(e){ const m=e.message||""; if(m==="nokey"||m==="badkey") throw new Error(m==="nokey"?"не вставлен ключ Gemini (вкладка «Данные» → «ИИ»)":"ключ Gemini не подходит (вкладка «Данные» → «ИИ»)"); if(m==="unknown action") throw new Error("скрипт таблицы старый — нужно обновить Code.gs"); throw e; }
    let x; try{ x=JSON.parse(String(j.text).replace(/^```(json)?|```$/g,"").trim()); }catch(e){ throw new Error("ИИ ответил не по форме — попробуйте ещё раз"); }
    if(!x.number && !Array.isArray(x.goods)) throw new Error("это не похоже на декларацию — или скрипт таблицы старый (обновите Code.gs)");
    const dt=s=>{ const m=String(s||"").match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/); return m?(m[3].length===2?"20"+m[3]:m[3])+"-"+m[2].padStart(2,"0")+"-"+m[1].padStart(2,"0"):""; };
    if(x.number && !skN(F.num)) F.num=skN(x.number); if(x.validTo && !F.validTo) F.validTo=dt(x.validTo); if((x.maker||x.applicant) && !skN(F.maker)) F.maker=skN(x.maker||x.applicant);
    const n0=F.chips.length; (Array.isArray(x.goods)?x.goods:[]).forEach(g=>dAddText(String(g).replace(/[,;]/g," ")));
    F.ai={done:"ИИ заполнил: "+[x.number?"номер":"", x.validTo?"срок":"", (F.chips.length-n0)?"товары ("+(F.chips.length-n0)+")":""].filter(Boolean).join(", ")+". Проверьте с документом."};
  }catch(e){ F.ai={err:e.message||String(e)}; }
  dRedraw(); }

/* ---------- декларации к документу (или комплекту): выбрать и скачать одним файлом ---------- */
let SKDD=null;
function dDocPositions(docs){ const m=new Map(); docs.forEach(j=>{ const P=(j.snap&&j.snap.prods)||{}; ((j.snap&&j.snap.dr&&j.snap.dr.lines)||[]).forEach(l=>{ if(!l.productId || !(+l.qty>0)) return;
    const p=P[l.productId]||prod(l.productId)||{}; const o=m.get(l.productId)||{id:l.productId, name:l.name||p.name||"", unit:p.unit||"", qty:0}; o.qty=r3(o.qty+(+l.qty||0)); m.set(l.productId,o); }); });
  return [...m.values()]; }
function skDeclDocs(docs){ if(!SK_READY) return; docs=(docs||[]).filter(j=>j&&j.snap); if(!docs.length) return;
  const date=docs.map(j=>j.date).sort()[0], pos=dDocPositions(docs), sel={}, extra={};
  pos.forEach(p=>{ const m=dMatch(p), ok=f=>dState(f,date)!=="bad"; const st=m.strong.filter(ok); sel[p.id]=new Set((st.length?st:m.weak.filter(ok).slice(0,1)).map(f=>f.id)); extra[p.id]=new Set(); });
  SKDD={docs, date, pos, sel, extra, cover:true, keep:true, busy:""}; { const M=SKDD; SK_RE=function r(){ SKDD=M; SK_RE=r; skModal(dDocHtml, true); }; } skModal(dDocHtml, true); if(!SK || !SK.at) skLoad(true); }
function dDocHtml(){ const M=SKDD, files=skD().files, by=id=>files.find(f=>f.id===id), j0=M.docs[0], nums=M.docs.map(j=>j.number);
  const lbl=(M.docs.length>1?"Комплект № "+(nums.length>2?nums[0]+"–"+nums[nums.length-1]:nums.join(", ")):"Документ № "+j0.number)+" от "+fd(M.date)+" · "+jWho(j0).main;
  const all=new Set(); M.pos.forEach(p=>M.sel[p.id].forEach(id=>all.add(id))); const none=M.pos.filter(p=>!M.sel[p.id].size).length;
  const opt=(p,f,kind)=>{ const st=dState(f,M.date), on=M.sel[p.id].has(f.id);
    return `<label class="dd-o${on?" on":""}${st==="bad"?" bad":""}"><input type="checkbox" data-ddp="${p.id}" value="${f.id}"${on?" checked":""}><span><b>${esc(dTitle(f))}</b><small>${[f.num?"№ "+esc(f.num):"", kind==="s"?"привязана":kind==="w"?"по названию":"выбрана вручную"].filter(Boolean).join(" · ")}</small></span>${dBadge(f, M.date)}</label>`; };
  const rows=M.pos.map((p,i)=>{ const m=dMatch(p), shown=new Set(), parts=[];
    m.strong.forEach(f=>{ shown.add(f.id); parts.push(opt(p,f,"s")); }); m.weak.slice(0,4).forEach(f=>{ if(shown.has(f.id)) return; shown.add(f.id); parts.push(opt(p,f,"w")); });
    M.extra[p.id].forEach(id=>{ const f=by(id); if(f && !shown.has(id)){ shown.add(id); parts.push(opt(p,f,"m")); } });
    const rest=files.filter(f=>!shown.has(f.id));
    return `<div class="dd-p${M.sel[p.id].size?"":" miss"}" style="--d:${Math.min(i,10)*25}ms"><div class="dd-ph"><b>${esc(p.name)}</b><small>${esc(qfmt(p.qty,p.unit))}</small>${M.sel[p.id].size?"":`<em>нет декларации</em>`}</div>
      ${parts.length?`<div class="dd-os">${parts.join("")}</div>`:""}
      <div class="dd-more">${rest.length?`<select class="dd-pick" data-ddp="${p.id}"><option value="">Другая декларация…</option>${rest.map(f=>`<option value="${f.id}">${esc(dTitle(f).slice(0,70))}${f.num?" · № "+esc(f.num):""}${f.validTo?" · до "+fd(f.validTo):""}</option>`).join("")}</select>`:""}<button type="button" class="btn ghost sm" data-dd="new" data-p="${p.id}">+ Новая декларация</button></div></div>`; }).join("");
  return skHead("Декларации", "Декларации к документу", esc(lbl), "Декларации к документу")
   + `<div class="dd-sum"><span>Товаров: <b>${M.pos.length}</b></span><span>Деклараций выбрано: <b>${all.size}</b></span>${none?`<span class="miss">без декларации: ${none}</span>`:`<span class="pos">✓ на все товары</span>`}</div>`
   + `<div class="dd-list">${rows||`<p class="muted">В документе нет товаров.</p>`}</div>`
   + `<div class="mi-bar"><div class="dd-opts"><label class="chk"><input type="checkbox" class="dd-cover"${M.cover?" checked":""}> Первая страница — список товаров и деклараций</label><label class="chk"><input type="checkbox" class="dd-keep"${M.keep?" checked":""}> Запомнить выбор для этих товаров</label></div>
       <div class="dc-acts"><button class="btn" data-dd="zip"${all.size&&!M.busy?"":" disabled"}>ZIP-архив</button><button class="btn pri" data-dd="pdf"${all.size&&!M.busy?"":" disabled"}>${M.busy?`<i class="spin"></i>${esc(M.busy)}`:"Скачать одним PDF"+(all.size?" · "+all.size:"")}</button></div></div>`; }
function dDocRedraw(){ if(!SKM||SKM.render!==dDocHtml) return; const d=SKM.d, st=d.scrollTop; d.innerHTML=dDocHtml(); d.scrollTop=st; }
const DFC={};
async function dFetch(id){ if(DFC[id]) return DFC[id]; const j=await api({action:"stock", op:"fileGet", d:{id}}); const bin=atob(j.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i); return DFC[id]={name:j.name, mime:j.mime, u8}; }
/* титульный лист: рисуем на холсте (кириллица без шрифтов), вставляем картинкой */
function dCover(M, list){ const c=document.createElement("canvas"); c.width=1240; c.height=1754; const x=c.getContext("2d"), j0=M.docs[0]; x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height); x.fillStyle="#1c2220";
  let y=120; const L=90, R=1150, line=(t,f,lh)=>{ x.font=f; const ws=String(t).split(" "); let s=""; ws.forEach(w=>{ const tt=s?s+" "+w:w; if(x.measureText(tt).width>R-L){ x.fillText(s,L,y); y+=lh; s=w; } else s=tt; }); if(s){ x.fillText(s,L,y); y+=lh; } };
  line("Декларации о соответствии","bold 46px Arial, sans-serif",58);
  line((M.docs.length>1?"к накладным № "+M.docs.map(j=>j.number).join(", "):"к накладной № "+j0.number)+" от "+fd(M.date),"28px Arial, sans-serif",40);
  line((j0.snap.c&&(j0.snap.c.full||j0.snap.c.name))||jWho(j0).main,"28px Arial, sans-serif",40); line("Поставщик: "+((j0.snap.s&&j0.snap.s.name)||""),"24px Arial, sans-serif",46);
  y+=14; x.fillStyle="#7a264a"; x.fillRect(L,y-30,R-L,3); x.fillStyle="#1c2220"; y+=20;
  M.pos.forEach((p,i)=>{ if(y>1640) return; const ids=[...M.sel[p.id]]; line((i+1)+". "+p.name,"bold 26px Arial, sans-serif",34);
    const t=ids.length?ids.map(id=>{ const f=list.find(z=>z.id===id)||{}; const n=list.indexOf(f)+1; return (f.num?"№ "+f.num:"декларация")+(f.validTo?", до "+fd(f.validTo):"")+(n?" — стр. файла "+n:""); }).join("; "):"декларация не приложена";
    x.fillStyle=ids.length?"#4b5450":"#b3261e"; line(t,"22px Arial, sans-serif",30); x.fillStyle="#1c2220"; y+=10; });
  x.fillStyle="#8a918d"; x.font="18px Arial, sans-serif"; x.fillText("Сформировано "+new Date().toLocaleString("ru-RU")+" · Фруктовый Дом",L,1700);
  return new Promise(ok=>c.toBlob(b=>b.arrayBuffer().then(a=>ok(new Uint8Array(a))),"image/jpeg",0.9)); }
function dFileName(M, ext){ const j0=M.docs[0]; return ("Декларации "+(M.docs.length>1?"№ "+M.docs[0].number+"–"+M.docs[M.docs.length-1].number:"№ "+j0.number)+" от "+fd(M.date)+" — "+cusShort(jWho(j0).main)).replace(/[\\/:*?"<>|]+/g," ").slice(0,120)+"."+ext; }
function dDownload(blob, name){ const url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000); }
async function dRemember(){ const M=SKDD; if(!M.keep || !dSrvOk()) return; const add={};
  M.pos.forEach(p=>M.sel[p.id].forEach(id=>{ const f=skD().files.find(x=>x.id===id); if(f && !dProds(f).has(p.id)) (add[id]=add[id]||new Set()).add(p.id); }));
  for(const id of Object.keys(add)){ const f=skD().files.find(x=>x.id===id); try{ await skSend("fileEdit",{id, prods:[...new Set(dJ(f.prods).concat([...add[id]]))]},"Декларация: привязка к позициям"); }catch(e){} } }
async function dBuild(kind){ const M=SKDD, ids=[]; M.pos.forEach(p=>M.sel[p.id].forEach(id=>{ if(!ids.includes(id)) ids.push(id); })); if(!ids.length) return;
  const list=ids.map(id=>skD().files.find(f=>f.id===id)).filter(Boolean);
  try{ M.busy="Загружаю файлы 0/"+list.length; dDocRedraw(); const got=[];
    for(let i=0;i<list.length;i++){ M.busy="Загружаю файлы "+(i+1)+"/"+list.length; dDocRedraw(); got.push(Object.assign({f:list[i]}, await dFetch(list[i].id))); }
    if(kind==="zip"){ M.busy="Собираю архив"; dDocRedraw(); const z=new EisZip(), used={};
      got.forEach((g,i)=>{ let n=String(i+1).padStart(2,"0")+" "+(g.f.num?g.f.num.replace(/[\\/:*?"<>|]+/g," ")+" ":"")+g.name; if(used[n]) n=i+"_"+n; used[n]=1; z.file(n.slice(0,150), g.u8); });
      dDownload(await z.generateAsync({type:"blob", mimeType:"application/zip"}), dFileName(M,"zip")); toast("ok","Архив скачан", list.length+" "+plural(list.length,["файл","файла","файлов"])+"."); }
    else { M.busy="Собираю PDF"; dDocRedraw(); const L=await dLib(), out=await L.PDFDocument.create(), skipped=[];
      if(M.cover){ const img=await out.embedJpg(await dCover(M, list)), pg=out.addPage([595.28,841.89]); pg.drawImage(img,{x:0,y:0,width:595.28,height:841.89}); }
      for(const g of got){ try{ let u=g.u8, m=g.mime;
          if(!dDirect(m, g.name)){ M.busy="Превращаю в PDF: "+g.name; dDocRedraw(); const p=await dPdfOf({id:g.f.id}); u=p.u8; m="application/pdf"; }
          await dAddToPdf(out, u, m, g.name); }catch(e){ skipped.push(Object.assign({why:e.message}, g)); } }
      if(out.getPageCount()===(M.cover?1:0)) throw new Error("ни один файл не удалось вставить в PDF — скачайте ZIP-архивом");
      dDownload(new Blob([await out.save()],{type:"application/pdf"}), dFileName(M,"pdf"));
      toast(skipped.length?"warn":"ok", skipped.length?"PDF скачан, но не всё вошло":"PDF скачан", skipped.length?"Не вставились: "+skipped.map(g=>"«"+g.name+"» — "+g.why).join("; ")+". Их можно скачать ZIP-архивом.":list.length+" "+plural(list.length,["декларация","декларации","деклараций"])+" в одном файле.", skipped.length?{ms:14000}:{}); }
    logEv("Склад","Скачаны декларации ("+list.length+") к "+(M.docs.length>1?"комплекту":"документу")+" № "+M.docs.map(j=>j.number).join(", "));
    M.busy=""; dDocRedraw(); dRemember();
  }catch(e){ M.busy=""; dDocRedraw(); toast("err","Не получилось собрать декларации", e.message); } }

/* ---------- обработчики ---------- */
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest) return;
  const ch=t.closest("[data-dlf]"); if(ch){ SKDL.f=ch.dataset.dlf; skDrawList(); return; }
  const b=t.closest("[data-dl]"); if(b){ const a=b.dataset.dl;
    if(a==="add"){ dForm(); return; } if(a==="edit"){ dForm({id:b.dataset.id}); return; } if(a==="view"){ dView(b.dataset.id); return; }
    if(!SKDF) return; dFormRead();
    if(a==="cancel"){ const cb=SKDF.onDone; SKDF=null; skClose(); if(cb) setTimeout(cb,200); return; }
    if(a==="save"){ dSave(); return; } if(a==="ai"){ dAi(); return; }
    if(a==="unchip"){ SKDF.chips.splice(+b.dataset.i,1); dRedraw(); return; }
    if(a==="addtxt"){ dAddText(SKDF.q); dRedraw(".dcf-q"); return; }
    /* выбранное пропадает из подсказок, а поиск остаётся — можно выбрать подряд несколько */
    if(a==="additem"){ dPickItem(b.dataset.id); dRedraw(matchMedia("(pointer:fine)").matches?".dcf-q":null); return; }
    if(a==="addpid"){ dPickPid(b.dataset.id); dRedraw(matchMedia("(pointer:fine)").matches?".dcf-q":null); return; }
    if(a==="addall"){ const S=dSugList(); S.I.forEach(i=>dPickItem(i.id)); S.P.forEach(p=>dPickPid(p.id)); SKDF.q=""; dRedraw(".dcf-q"); return; }
    if(a==="qclr"){ SKDF.q=""; dRedraw(".dcf-q"); return; }
    return; }
  const dd=t.closest("[data-dd]"); if(dd && SKDD){ const a=dd.dataset.dd;
    if(a==="pdf"||a==="zip"){ dBuild(a); return; }
    if(a==="new"){ const M=SKDD, p=M.pos.find(x=>x.id===dd.dataset.p); const back=()=>{ SKDD=M; skModal(dDocHtml, true); const nf=skD().files[skD().files.length-1]; if(nf && p && dProds(nf).has(p.id)) M.sel[p.id].add(nf.id); dDocRedraw(); };
      skClose(true); dForm({chips:p?[{t:p.name, pid:p.id}]:[]}, back); return; } } });
document.addEventListener("change", e=>{ const t=e.target; if(!t.closest) return;
  if(t.classList.contains("dcf-in") && SKDF){ dFormRead(); SKDF.files=[...(t.files||[])]; SKDF.ai=null; dRedraw(); return; }
  if(SKDD && t.closest("#sk-dlg")){ const M=SKDD;
    if(t.dataset.ddp && t.type==="checkbox"){ if(t.checked) M.sel[t.dataset.ddp].add(t.value); else M.sel[t.dataset.ddp].delete(t.value); dDocRedraw(); return; }
    if(t.classList.contains("dd-pick") && t.value){ M.extra[t.dataset.ddp].add(t.value); M.sel[t.dataset.ddp].add(t.value); dDocRedraw(); return; }
    if(t.classList.contains("dd-cover")){ M.cover=t.checked; return; } if(t.classList.contains("dd-keep")){ M.keep=t.checked; return; } } });
document.addEventListener("input", e=>{ const t=e.target; if(!SKDF || !t.classList || !t.classList.contains("dcf-q")) return; SKDF.q=t.value; const s=$("#dcf-sug"); if(s) s.innerHTML=dSugHtml(); });
document.addEventListener("keydown", e=>{ const t=e.target; if(!SKDF || !t.classList) return;
  if(t.classList.contains("dcf-q")){ if(e.key==="Enter"||e.key===","){ if(!t.value.trim()) { if(e.key==="Enter") e.preventDefault(); return; } e.preventDefault(); SKDF.q=t.value; dFormRead(); dAddText(t.value); dRedraw(".dcf-q"); return; }
    if(e.key==="Backspace" && !t.value && SKDF.chips.length){ dFormRead(); SKDF.chips.pop(); dRedraw(".dcf-q"); } } }, true);
window.__decl = { form: dForm, docs: skDeclDocs, st: () => ({F:SKDF, M:SKDD}), match: dMatch };

/* печать декларации без скачивания: PDF → картинки страниц (pdf.js), фото — как есть, Word/Excel — сначала в PDF на сервере; печать через скрытую рамку (в приложении Android её ловит мост) */
const D_PRN='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>';
let DPRN=false;
async function dPrint(id){ if(DPRN) return; DPRN=true; const t=toast("info","Готовлю к печати…","", {sticky:true});
  try{ let F=await dFetch(id); logEvSoft("Склад","Напечатана декларация «"+(F.name||"")+"»"); if(!dDirect(F.mime, F.name)) F=await dPdfOf({id});
    let pages=[];
    if(/^image\//.test(F.mime||"") && !/heic|heif/i.test(F.mime)) pages=[URL.createObjectURL(new Blob([F.u8],{type:F.mime}))];
    else if(/^image\//.test(F.mime||"")) throw new Error("фото HEIC браузер не печатает — скачайте файл");
    else { const P=await adPdfJs(), doc=await P.getDocument({data:F.u8.slice()}).promise;
      for(let i=1;i<=doc.numPages;i++){ const pg=await doc.getPage(i), v=pg.getViewport({scale:2}), c=document.createElement("canvas"); c.width=v.width; c.height=v.height; const x=c.getContext("2d"); x.fillStyle="#fff"; x.fillRect(0,0,c.width,c.height);
        await pg.render({canvasContext:x, viewport:v}).promise; pages.push(c.toDataURL("image/jpeg",0.92)); } }
    if(!pages.length) throw new Error("в файле нет страниц");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(F.name||"Декларация")}</title><style>@page{size:A4;margin:6mm}html,body{margin:0;padding:0;background:#fff}
      .p{height:285mm;display:flex;align-items:center;justify-content:center;break-after:page;page-break-after:always}.p:last-child{break-after:auto;page-break-after:auto}.p img{max-width:100%;max-height:100%;object-fit:contain}</style></head>
      <body>${pages.map(u=>`<div class="p"><img src="${u}"></div>`).join("")}</body></html>`;
    const f=document.createElement("iframe"); f.setAttribute("aria-hidden","true"); f.style.cssText="position:fixed;left:-4000px;top:0;width:900px;height:1200px;border:0;visibility:hidden";
    document.body.appendChild(f); const d=f.contentWindow.document; d.open(); d.write(html); d.close();
    await Promise.all([...d.images].map(im=>im.complete?0:new Promise(ok=>{ im.onload=im.onerror=ok; })));
    typeof t==="function"&&t(); f.contentWindow.focus(); f.contentWindow.print(); setTimeout(()=>{ f.remove(); pages.forEach(u=>/^blob:/.test(u)&&URL.revokeObjectURL(u)); }, 60000);
  }catch(e){ typeof t==="function"&&t(); toast("err","Не получилось распечатать", e.message); }
  finally{ DPRN=false; } }
