/* ================= МЕСЯЧНЫЙ АКТ ПРИЁМКИ-ПЕРЕДАЧИ (вкладка «Заказчики и цены») =================
   Акт за месяц собирается из накладных заказчика по выбранному договору: раздел 2 — спецификация договора (шаблон),
   раздел 3 — что фактически поставлено (сумма строк накладных), п. 7 — нарастающий итог по договору.
   Шаблон хранится в договоре (поле akt, лист «Контракты»); со старым скриптом — на устройстве. Файл — Word (.docx). */
var aktSrv=false;
/* у кого акт собирается сам (настраивается вручную под заказчика). Остальным — просто загрузка файлов актов */
const AKT_GEN_INN=["7736039722"];   /* ГУП «Большой Московский цирк» */
const aktGen = cid => AKT_GEN_INN.includes(String((cus(cid)||{}).inn||"").trim());
const AKT_MON_N=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"];
const AKT_CTRY={"643":"Российская Федерация","860":"Республика Узбекистан","762":"Республика Таджикистан","417":"Киргизская Республика","398":"Республика Казахстан","364":"Исламская Республика Иран","792":"Турецкая Республика","004":"Исламский Эмират Афганистан","840":"Соединенные Штаты Америки","156":"Китайская Народная Республика","376":"Государство Израиль","032":"Аргентинская Республика","152":"Республика Чили","356":"Республика Индия","818":"Арабская Республика Египет","604":"Республика Перу","188":"Республика Коста-Рика","218":"Республика Эквадор"};
const AKT_LS = id => "frudom-akt:"+id;
const aktQ = x => String(Math.round((+x||0)*1000)/1000).replace(".",",");
const aktM = x => fm(x).replace(/ /g," ");
const AKT_U = "____________________";
let AKT={cid:"", ctr:"", ym:"", date:"", off:{}, edit:false, all:false, cfg:null, dirty:false};
/* ---------- шаблон ---------- */
function aktCfg(ctr){ let c=null; try{ c=JSON.parse(ctr&&ctr.akt||"null"); }catch(e){}
  if(!c){ try{ c=JSON.parse(lsGet(AKT_LS(ctr.id))||"null"); }catch(e){} }
  return Object.assign({subject:"", from:"", to:ctr&&ctr.dateTo||"", cusFull:"", cusAs:"", cusWho:"", cusBasis:"", city:"Москва", prior:"", penalty:"Неустойка Поставщику не начисляется.", q1:"В соответствии с ТЗ", q2:"Соответствует ТЗ", spec:[]}, c||{}); }
function aktSaveCfg(ctr, cfg){ const s=JSON.stringify(cfg); ctr.akt=s; try{ lsSet(AKT_LS(ctr.id), s); }catch(e){} dirty("contracts", ctr.id); saveLocal(); AKT.dirty=false; }
const aktCtry = p => AKT_CTRY[(p&&p.country)||""] || (COUNTRIES[(p&&p.country)||""]&&p.country ? COUNTRIES[p.country] : "");
/* спецификация по умолчанию — прайс заказчика */
function aktSpecFromPrices(cid){ const pl=D.prices[cid]||{};
  return D.products.filter(p=>pl[p.id]!=null && pl[p.id]!=="").map(p=>({pid:p.id, name:p.name, unit:p.unit||"кг", qty:"", price:String(pl[p.id]), country:aktCtry(p)})); }
/* ---------- документы и расчёт ---------- */
const aktYmEnd = ym => { const [y,m]=ym.split("-").map(Number); return ym+"-"+String(new Date(y,m,0).getDate()).padStart(2,"0"); };
const aktDefYm = () => { const d=new Date(); if(d.getDate()<=15) d.setMonth(d.getMonth()-1,1); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"); };
const aktOn = (j, ctr) => j.snap && !isArch(j) && j.customerId===ctr.customerId && (j.snap.dr.contractId===ctr.id || (!j.snap.dr.contractId && (!ctr.supplierId || j.supplierId===ctr.supplierId)));
function aktModel(){
  const ctr=(D.contracts||[]).find(x=>x.id===AKT.ctr); if(!ctr) return null;
  const c=cus(ctr.customerId), s=sup(ctr.supplierId)||{}, cfg=AKT.cfg||aktCfg(ctr), ym=AKT.ym, d1=ym+"-01", d2=aktYmEnd(ym);
  const all=D.journal.filter(j=>aktOn(j,ctr)), inM=all.filter(j=>j.date>=d1 && j.date<=d2).sort((a,b)=>a.date.localeCompare(b.date)||jNumSort(a,b));
  const docs=inM.filter(j=>!AKT.off[j.id]), other=D.journal.filter(j=>j.snap && !isArch(j) && j.customerId===ctr.customerId && j.date>=d1 && j.date<=d2 && !aktOn(j,ctr));
  const spec=(cfg.spec&&cfg.spec.length?cfg.spec:aktSpecFromPrices(ctr.customerId)).map((r,i)=>Object.assign({i},r));
  const sByPid={}; spec.forEach(r=>{ if(r.pid && !sByPid[r.pid]) sByPid[r.pid]=r; });
  /* факт: строки накладных, сгруппированные по товару и цене */
  const fact=new Map(); let total=0, vat=0, rate=null;
  docs.forEach(j=>{ const k=calc(j.snap.dr, j.snap); if(k.rate) rate=k.rate; k.lines.forEach(l=>{ const key=l.pid+"|"+l.price, sr=sByPid[l.pid];
      const o=fact.get(key)||{pid:l.pid, name:sr?sr.name:l.name, unit:l.unit||(sr&&sr.unit)||"", price:l.price, qty:0, sum:0, country:(sr&&sr.country)||aktCtry(prod(l.pid)), ord:sr?sr.i:1e6, inSpec:!!sr, sp:sr?+String(sr.price).replace(",","."):null};
      o.qty+=l.qty; o.sum+=l.sum; fact.set(key,o); total+=l.sum; vat+=l.vat; }); });
  const F=[...fact.values()].map(o=>Object.assign(o,{qty:Math.round(o.qty*1000)/1000, sum:r2(o.sum)})).sort((a,b)=>a.ord-b.ord||a.name.localeCompare(b.name,"ru")||a.price-b.price);
  total=r2(total); vat=r2(vat);
  /* нарастающий итог по договору (до конца месяца) */
  const upto=all.filter(j=>j.date<=d2 && (j.date<d1 || !AKT.off[j.id])), prior=+String(cfg.prior||"").replace(",",".").replace(/\s/g,"")||0;
  const cum=r2(prior+upto.reduce((a,j)=>a+(+j.sum||0),0)), cumQ={};
  upto.forEach(j=>calc(j.snap.dr,j.snap).lines.forEach(l=>{ cumQ[l.pid]=(cumQ[l.pid]||0)+l.qty; }));
  /* замечания */
  const W=[], noQ=spec.filter(r=>!(+String(r.qty).replace(",",".")>0));
  if(!(cfg.spec&&cfg.spec.length)) W.push({l:1, t:"Шаблон акта ещё не настроен: раздел 2 собран из прайса заказчика без количеств по договору. Нажмите «Настроить шаблон» или загрузите прошлый акт (.docx) — всё подставится само."});
  else if(noQ.length) W.push({l:1, t:"В спецификации нет количества по договору у "+noQ.length+" поз.: "+noQ.slice(0,4).map(r=>"«"+r.name+"»").join(", ")+(noQ.length>4?" и др.":"")+"."});
  F.filter(o=>!o.inSpec).forEach(o=>W.push({l:0, t:"«"+o.name+"» нет в спецификации договора — проверьте, можно ли было его поставлять."}));
  F.filter(o=>o.inSpec && o.sp!=null && Math.abs(o.sp-o.price)>0.004).forEach(o=>W.push({l:0, t:"«"+o.name+"»: цена в накладных "+aktM(o.price)+" ₽, по договору "+aktM(o.sp)+" ₽."}));
  spec.forEach(r=>{ const q=+String(r.qty).replace(",","."); if(r.pid && q>0 && (cumQ[r.pid]||0)>q+0.0005) W.push({l:0, t:"«"+r.name+"»: с начала договора поставлено "+aktQ(cumQ[r.pid])+" "+(r.unit||"")+", а по договору "+aktQ(q)+" — превышение."}); });
  if(+ctr.maxSum>0 && cum>+ctr.maxSum+0.004) W.push({l:0, t:"Нарастающим итогом поставлено на "+aktM(cum)+" ₽ — больше цены договора ("+aktM(+ctr.maxSum)+" ₽)."});
  F.filter(o=>!o.country).forEach(o=>W.push({l:1, t:"«"+o.name+"»: не указана страна происхождения."}));
  if(other.length) W.push({l:1, t:other.length+" "+plural(other.length,["документ","документа","документов"])+" этого заказчика за месяц по другому договору — в акт не вошли."});
  const dates=docs.map(j=>j.date).sort();
  return {ctr, c, s, cfg, ym, d1, d2, inM, docs, F, spec, total, vat, rate, cum, prior, W, df:dates[0]||"", dl:dates[dates.length-1]||"", date:AKT.date||d2};
}
/* ---------- текст акта ---------- */
const aktFem = fio => /(вна|чна|кызы|қызы)$/i.test(String(fio||"").trim().split(/\s+/)[2]||"");
const aktIni = fio => { const p=String(fio||"").trim().split(/\s+/); return p[0] ? (p[1]?p[1][0]+".":"")+(p[2]?p[2][0]+".":"")+" "+p[0] : ""; };
function aktBasis(b, kase){ b=String(b||"").replace(/‑/g,"-").trim(); if(!b) return kase==="i"?"Договором":"Договору";
  const m=b.match(/^(\S+)\s*(.*)$/), w=m[1].toLowerCase(), rest=m[2];
  const word = /^контракт/.test(w) ? (kase==="i"?"Контрактом":"Контракту") : /^соглашени/.test(w) ? (kase==="i"?"Соглашением":"Соглашению") : (kase==="i"?"Договором":"Договору");
  const isWord=/^(договор|контракт|соглашени)/.test(w); let t=(isWord?word+" "+rest:word+" "+b).trim(); if(/\d{4}$/.test(t)) t+="г."; return t; }
const aktShort = b => /^контракт/i.test(String(b||"").trim()) ? ["Контракт","Контракту","Контрактом"] : ["Договор","Договору","Договором"];
function aktDateL(iso){ if(!iso) return "«__»__________ г."; const [y,m,d]=iso.split("-"); return "«"+d+"» "+MON[+m-1]+" "+y+" г."; }
const aktFd = iso => iso ? fd(iso)+"г." : "__.__.____г.";
function aktWords(x){ const c=Math.round(x*100), r=Math.floor(c/100), k=c%100; return "("+cap(intWords(r,false))+") "+plural(r,["рубль","рубля","рублей"])+" "+String(k).padStart(2,"0")+" "+plural(k,["копейка","копейки","копеек"]); }
function aktCusAs(cfg, full){ if(cfg.cusAs) return cfg.cusAs; const w=String(full||"").trim().split(/\s+/)[0]||""; return /(ый|ий|ой)$/i.test(w)?"именуемый":/(ая|яя)$/i.test(w)?"именуемая":"именуемое"; }
function aktSupText(s){ const ip=isIP(s)||String(s.ogrn||"").replace(/\D/g,"").length===15, fem=aktFem(s.fio);
  if(ip) return "Индивидуальный предприниматель "+(s.fio||String(s.name||"").replace(/^ИП\s+/i,""))+" (ОГРНИП "+(s.ogrn||"_______________")+", ИНН "+(s.inn||"____________")+"), "+(fem?"именуемая":"именуемый")+" в дальнейшем «Поставщик», "+(fem?"действующая":"действующий")+" от своего имени на основании записи в ЕГРИП (ОГРНИП "+(s.ogrn||"_______________")+")";
  return (s.name||"")+" (ОГРН "+(s.ogrn||"_____________")+", ИНН "+(s.inn||"__________")+"), именуемое в дальнейшем «Поставщик», в лице "+(s.fio||AKT_U)+", действующего на основании Устава"; }
/* ---------- Word (.docx) ---------- */
const AKT_W=[2376,709,1276,969,1304,1588,1417];
const xs = t => String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
function wr(t, o){ o=o||{}; const rp=(o.b?"<w:b/>":"")+(o.sz?`<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>`:"");
  return String(t).split("\n").map((x,i)=>(i?"<w:r><w:br/></w:r>":"")+`<w:r>${rp?`<w:rPr>${rp}</w:rPr>`:""}<w:t xml:space="preserve">${xs(x)}</w:t></w:r>`).join(""); }
function wp(parts, o){ o=o||{}; const pp=`<w:pPr>${o.keep?"<w:keepNext/>":""}<w:spacing w:before="${o.before||0}" w:after="${o.after==null?0:o.after}" w:line="${o.line||240}" w:lineRule="auto"/>${o.ind?`<w:ind w:firstLine="${o.ind}"/>`:""}<w:jc w:val="${o.jc||"both"}"/></w:pPr>`;
  return `<w:p>${pp}${(Array.isArray(parts)?parts:[[parts,o]]).map(x=>Array.isArray(x)?wr(x[0],Object.assign({sz:o.sz},x[1]||{})):wr(x,{sz:o.sz})).join("")}</w:p>`; }
function wc(t, w, o){ o=o||{}; return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.nb?`<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/></w:tcBorders>`:""}<w:vAlign w:val="${o.va||"center"}"/></w:tcPr>${wp(o.parts||[[t,{b:o.b}]],{jc:o.jc||"left",after:o.after==null?0:o.after,line:240,sz:o.sz})}</w:tc>`; }
function wtbl(rows, widths, o){ o=o||{}; const brd=o.nb?"":`<w:tblBorders>${["top","left","bottom","right","insideH","insideV"].map(k=>`<w:${k} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join("")}</w:tblBorders>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:jc w:val="center"/>${brd}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="70" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`; }
const wtr = (cells, head) => `<w:tr>${head?"<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>":"<w:trPr><w:cantSplit/></w:trPr>"}${cells.join("")}</w:tr>`;
function aktGoodsTbl(rows, q){ const W=AKT_W, h=["Наименование товарной позиции","Ед.изм.","Количество","Цена за ед. (руб.), в т.ч. НДС","Сумма (в руб.), в т.ч. НДС","Страна происхождения","Качество"];
  return wtbl([wtr(h.map((t,i)=>wc(t,W[i],{b:1,jc:"center",sz:18})),true)].concat(rows.map(r=>wtr([wc(r.name,W[0],{sz:18}),wc(r.unit,W[1],{jc:"center",sz:18}),wc(r.qty,W[2],{jc:"center",sz:18}),wc(r.price,W[3],{jc:"center",sz:18}),wc(r.sum,W[4],{jc:"center",sz:18}),wc(r.country,W[5],{sz:18}),wc(q,W[6],{sz:18})]))), W); }
function aktDocXml(M){ const {ctr,c,s,cfg}=M, b=ctr.basis||"", nm=aktShort(b), cusFull=cfg.cusFull||c.name||"", vatT=M.rate?"в т.ч. НДС "+aktM(M.vat)+" руб.":"НДС не облагается";
  const spec=M.spec.map(r=>{ const q=+String(r.qty).replace(",","."), p=+String(r.price).replace(",",".")||0; return {name:r.name, unit:r.unit||"", qty:q>0?aktQ(q):"", price:p?aktM(p):"", sum:q>0&&p?aktM(r2(q*p)):"", country:r.country||""}; });
  const fact=M.F.map(o=>({name:o.name, unit:o.unit, qty:aktQ(o.qty), price:aktM(o.price), sum:aktM(o.sum), country:o.country||""}));
  const [y,mm]=M.ym.split("-"), per=AKT_MON_N[+mm-1]+" "+y+" г.", yr=(M.date||M.d2).slice(0,4);
  const body=[
    wp([["АКТ приемки-передачи товара (партии товара)",{b:1}]],{jc:"center",before:280,after:200}),
    wtbl([wtr([wc("",5400,{nb:1,parts:[["Дата составления и подписания Акта\nПоставщиком\n"+aktDateL(M.date)+", "+(cfg.city||"Москва"),{b:1}]]}), wc("",4239,{nb:1,parts:[["Дата подписания Акта\nЗаказчиком\n«__»__________"+yr+"г., "+(cfg.city||"Москва"),{b:1}]]})])],[5400,4239],{nb:1}),
    wp(cusFull+", "+aktCusAs(cfg,cusFull)+" в дальнейшем «Заказчик», в лице "+(cfg.cusWho||"__________________________________________________")+" действующего на основании "+(cfg.cusBasis||"__________________________________")+", с одной стороны, и "+aktSupText(s)+", с другой стороны, совместно именуемые «Стороны» и каждый в отдельности «Сторона», составили настоящий акт о нижеследующем:",{before:200}),
    wp("1. В соответствии с "+aktBasis(b,"i")+" Поставщик выполнил обязательства по поставке товаров"+(cfg.subject?", а именно: "+cfg.subject.replace(/\.?$/,"."):".")),
    wp("2. "+nm[2]+" предусмотрена поставка:",{keep:1}), aktGoodsTbl(spec, cfg.q1||"В соответствии с ТЗ"),
    wp("3. Фактически поставлено по "+nm[1]+", что подтверждено соответствующими Отчетами о поставке:",{before:120,keep:1}), aktGoodsTbl(fact, cfg.q2||"Соответствует ТЗ"),
    wp("4. Сведения о сопутствующих услугах: не предусмотрены.",{before:120}),
    wp("5. Сведения о проведенной экспертизе поставленного товара: ____________________"),
    wp([["6. Срок поставки по "+nm[1]+": с "+aktFd(cfg.from)+" по "+aktFd(cfg.to||ctr.dateTo)+"",{b:1}]]),
    wp([["Фактический срок поставки: с "+aktFd(M.df)+" по "+aktFd(M.dl)+"",{b:1}]],{ind:709}),
    wp("7. Всего с даты начала поставки по "+nm[1]+" поставлено товара на сумму "+aktM(M.cum)+" руб., "+vatT.replace("в т.ч.","в том числе")+", в том числе за отчетный период ("+per+") "+aktM(M.total)+" руб., "+vatT.replace("в т.ч.","в том числе")+"."),
    cfg.penalty?wp([[cfg.penalty,{b:1}]],{ind:709,before:80}):"",
    wp("8. Сумма, подлежащая уплате Поставщику, за товар, принятый по настоящему акту, — "+aktM(M.total)+" руб. "+aktWords(M.total)+", "+vatT+"."),
    wtbl([wtr([wc("",4819,{nb:1,va:"top",parts:[["Заказчик:\n\n"+(c.name||"")+"\n\n_____________/______________/\n\nМ.П.",{b:1}]]}), wc("",4819,{nb:1,va:"top",parts:[["Поставщик:\n\n"+(isIP(s)||String(s.ogrn||"").replace(/\D/g,"").length===15?"Индивидуальный предприниматель":(s.name||""))+"\n\n_______________/ "+aktIni(s.fio)+"/\n\nМ.П.",{b:1}]]})])],[4819,4819],{nb:1})
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="567" w:right="850" w:bottom="567" w:left="1417" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`; }
async function aktDocx(M){ const z=new EisZip();
  z.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  z.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file("word/_rels/document.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  z.file("word/styles.xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ru-RU" w:eastAsia="ru-RU"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="a"><w:name w:val="Normal"/></w:style></w:styles>`);
  z.file("word/document.xml", aktDocXml(M));
  return z.generateAsync({type:"blob", mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}); }
/* ---------- загрузка прошлого акта (.docx) — заполняет шаблон ---------- */
async function aktImport(file, ctr){
  const z=await EisZip.loadAsync(await file.arrayBuffer()), f=z.file("word/document.xml"); if(!f) throw new Error("это не файл Word (.docx)");
  const xml=await f.async("string"), doc=new DOMParser().parseFromString(xml,"application/xml"), W="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const txt = el => [...el.getElementsByTagNameNS(W,"p")].map(p=>[...p.getElementsByTagNameNS(W,"t")].map(t=>t.textContent).join("")).join(" ").replace(/\s+/g," ").trim();
  const tbls=[...doc.getElementsByTagNameNS(W,"tbl")].filter(t=>/наименование/i.test(txt(t).slice(0,200)) && /количеств/i.test(txt(t).slice(0,300)));
  if(!tbls.length) throw new Error("в файле не нашёл таблицу товаров «Наименование … Количество»");
  const rows=[...tbls[0].getElementsByTagNameNS(W,"tr")].map(tr=>[...tr.getElementsByTagNameNS(W,"tc")].map(txt)).filter(r=>r.length>=5 && !/наименование/i.test(r[0]) && r[0]);
  const num = v => String(v||"").replace(/\s| /g,"").replace(",",".");
  const pl=D.prices[ctr.customerId]||{}, inPl=D.products.filter(p=>pl[p.id]!=null && pl[p.id]!==""), used=new Set();
  const spec=rows.map(r=>{ const name=r[0], price=num(r[3]); let p=inPl.find(x=>!used.has(x.id) && norm(x.name)===norm(name)) || D.products.find(x=>!used.has(x.id) && norm(x.name)===norm(name));
      if(!p){ const tk=s=>norm(s).replace(/[()«»"',.]/g," ").split(" ").filter(w=>w.length>=4).map(w=>w.slice(0,5)), A=new Set(tk(name));
        p=inPl.filter(x=>!used.has(x.id) && Math.abs((+pl[x.id]||0)-(+price||-1))<0.005).find(x=>tk(x.name).some(w=>A.has(w))) || inPl.find(x=>!used.has(x.id) && tk(x.name).length && tk(x.name).every(w=>A.has(w))); }
      if(p) used.add(p.id); return {pid:p?p.id:"", name, unit:r[1]||"кг", qty:num(r[2]), price, country:r[5]||""}; });
  const all=txt(doc.documentElement), cfg=aktCfg(ctr);
  const sub=all.match(/а именно:\s*(.+?)\s*2\.\s*(?:Договором|Контрактом)/i); if(sub) cfg.subject=sub[1].replace(/\.$/,"");
  const per=all.match(/Срок поставки по \S+:\s*с\s*(\d{2})\.(\d{2})\.(\d{4})г?\.?\s*по\s*(\d{2})\.(\d{2})\.(\d{4})/i); if(per){ cfg.from=per[3]+"-"+per[2]+"-"+per[1]; cfg.to=per[6]+"-"+per[5]+"-"+per[4]; }
  { const k=all.search(/,\s*именуем\S+\s+в дальнейшем «Заказчик»/i); if(k>0){ let pre=all.slice(0,k); const cut=Math.max(pre.lastIndexOf("г.,"), pre.lastIndexOf("г ,")); if(cut>=0) pre=pre.slice(cut+3).replace(/^\s*[А-ЯЁ][а-яё-]+\s+/,"");   /* после «…г., Москва» */
    cfg.cusFull=pre.trim(); const as=all.slice(k).match(/именуем\S+/i); if(as) cfg.cusAs=as[0]; } }
  const who=all.match(/«Заказчик», в лице\s*(.*?)\s*действующ\S*\s+на основании\s*(.*?),\s*с одной/i); if(who){ if(!/^_+$/.test(who[1].replace(/\s/g,""))) cfg.cusWho=who[1]; if(!/^_+$/.test(who[2].replace(/\s/g,""))) cfg.cusBasis=who[2]; }
  cfg.spec=spec; return {cfg, n:spec.length, matched:spec.filter(r=>r.pid).length}; }
/* ---------- карточка на вкладке ---------- */
function renderAkt(cid){ const box=$("#akt-box"); if(!box) return; const L=ctrs(cid), gen=aktGen(cid);
  if(ADIR.cid!==cid) aktDirLoad(cid); else aktDirDraw();
  if(AKT.cid!==cid) aktFilesLoad(cid);
  $("#akt-desc").textContent = gen ? "Акт приёмки-передачи за месяц собирается сам из накладных по договору — выберите месяц и скачайте. Подписанные акты загружайте ниже." : "Загрузите сюда акты этого заказчика (Word, PDF, скан) — они сохранятся за ним и будут доступны с любого устройства.";
  if(!gen){ if(AKT.cid!==cid) AKT={cid, ctr:"", ym:aktDefYm(), date:"", off:{}, edit:false, all:false, cfg:null, dirty:false}; $("#akt-name").textContent=cusNm(cid)?"— "+cusNm(cid):""; box.innerHTML=""; aktFilesDraw(); return; }
  if(AKT.cid!==cid){ AKT={cid, ctr:(L.find(x=>!x.dateTo||x.dateTo>=todayISO())||L[0]||{}).id||"", ym:aktDefYm(), date:"", off:{}, edit:false, all:false, cfg:null, dirty:false}; }
  $("#akt-name").textContent=cusNm(cid)?"— "+cusNm(cid):"";
  aktFilesDraw();
  if(!L.length){ box.innerHTML=`<p class="muted">У заказчика нет договоров — добавьте договор выше, и здесь можно будет собрать акт за месяц.</p>`; return; }
  const ctr=L.find(x=>x.id===AKT.ctr)||L[0]; AKT.ctr=ctr.id; if(!AKT.cfg || AKT.cfg.__id!==ctr.id){ AKT.cfg=Object.assign(aktCfg(ctr),{__id:ctr.id}); AKT.dirty=false; }
  const M=aktModel(), sh=AKT.all?M.F:M.F.slice(0,8);
  box.innerHTML=`<h4 class="akth first">Собрать акт за месяц${skHQ("Месячный акт")}</h4><div class="aktbar">
      <label class="f">Договор<select id="akt-ctr">${L.map(x=>ctrOpt(x, ctr.id)).join("")}</select></label>
      <label class="f">Месяц<input type="month" id="akt-ym" value="${esc(AKT.ym)}"></label>
      <label class="f">Дата акта<input type="date" id="akt-date" value="${esc(M.date)}"></label></div>
    <div class="akttiles"><div><small>Документов</small><b>${M.docs.length}${M.inM.length!==M.docs.length?` <em>из ${M.inM.length}</em>`:""}</b></div><div class="hi"><small>Поставлено за месяц</small><b>${aktM(M.total)} ₽</b></div><div><small>Позиций в акте</small><b>${M.F.length}</b></div><div><small>С начала договора</small><b>${aktM(M.cum)} ₽</b>${+ctr.maxSum>0?`<span>из ${aktM(+ctr.maxSum)}</span>`:""}</div><div><small>Фактический срок</small><b class="sm">${M.df?fd(M.df).slice(0,5)+" – "+fd(M.dl).slice(0,5):"—"}</b></div></div>
    ${M.W.length?`<div class="aktw">${M.W.map(w=>`<div class="l${w.l}">${esc(w.t)}</div>`).join("")}</div>`:`<div class="aktw ok"><div>Всё сходится: цены как в договоре, количество в пределах договора.</div></div>`}
    ${M.inM.length?`<details class="aktdocs"><summary>Документы в акте: ${M.docs.length} ${plural(M.docs.length,["документ","документа","документов"])} — снять галочку, чтобы не включать</summary><div class="aktdl">${M.inM.map(j=>`<label class="chk"><input type="checkbox" data-aktoff="${j.id}"${AKT.off[j.id]?"":" checked"}> № ${esc(j.number)} от ${fd(j.date)}${j.snap.c&&j.snap.c.branchLabel?" · "+esc(j.snap.c.branchLabel):""} — <b>${fm(j.sum)} ₽</b></label>`).join("")}</div></details>`:""}
    ${M.F.length?`<div class="tbl"><table class="akt-t"><thead><tr><th>Наименование</th><th>Ед.</th><th class="num">Кол-во</th><th class="num">Цена</th><th class="num">Сумма, ₽</th><th>Страна</th></tr></thead><tbody>${sh.map(o=>`<tr${o.inSpec?"":` class="bad"`}><td>${esc(o.name)}</td><td>${esc(o.unit)}</td><td class="num">${aktQ(o.qty)}</td><td class="num">${fm(o.price)}</td><td class="num">${fm(o.sum)}</td><td>${esc(o.country||"—")}</td></tr>`).join("")}</tbody><tfoot><tr><td colspan="4">Итого за ${AKT_MON_N[+M.ym.slice(5)-1]}</td><td class="num">${fm(M.total)}</td><td></td></tr></tfoot></table></div>${M.F.length>8?`<button type="button" class="btn ghost sm" id="akt-all">${AKT.all?"Свернуть":"Показать все "+M.F.length+" позиций"}</button>`:""}`:`<p class="muted">За ${AKT_MON_N[+M.ym.slice(5)-1]} ${M.ym.slice(0,4)} по этому договору документов нет.</p>`}
    <div class="row aktact"><button type="button" class="btn pri" id="akt-dl"${M.docs.length?"":" disabled"}>Скачать акт (Word)</button><button type="button" class="btn" id="akt-edit" aria-expanded="${AKT.edit}">${AKT.edit?"Скрыть шаблон":"Настроить шаблон"}</button><label class="btn ghost">Загрузить прошлый акт (.docx)<input type="file" id="akt-imp" accept=".docx" hidden></label>${aktSrv||!API_URL?"":`<span class="muted aktold">Шаблон пока хранится только на этом устройстве — обновите скрипт таблицы, чтобы он был виден всем.</span>`}</div>
    ${AKT.edit?aktEditHtml(M):""}`;
}
function aktEditHtml(M){ const c=AKT.cfg, sp=(c.spec&&c.spec.length?c.spec:aktSpecFromPrices(M.ctr.customerId));
  return `<div class="aktedit"><div class="skgrid">
      <label class="f wide">Заказчик полностью (как в договоре)<input data-akt="cusFull" value="${esc(c.cusFull)}" placeholder="${esc(M.c.name||"")}"></label>
      <label class="f">в лице (должность, ФИО)<input data-akt="cusWho" value="${esc(c.cusWho)}" placeholder="пусто — линия для подписи"></label>
      <label class="f">действующего на основании<input data-akt="cusBasis" value="${esc(c.cusBasis)}" placeholder="пусто — линия"></label>
      <label class="f wide">Предмет договора (п. 1, «а именно: …»)<input data-akt="subject" value="${esc(c.subject)}" placeholder="Поставка овощей и фруктов свежих и консервированных для столовой"></label>
      <label class="f">Срок поставки по договору — с<input type="date" data-akt="from" value="${esc(c.from)}"></label>
      <label class="f">по<input type="date" data-akt="to" value="${esc(c.to)}"></label>
      <label class="f">Поставлено до начала учёта на сайте, ₽<input data-akt="prior" inputmode="decimal" value="${esc(c.prior)}" placeholder="0"></label>
      <label class="f">Город<input data-akt="city" value="${esc(c.city)}"></label>
      <label class="f wide">Фраза о неустойке (пусто — не писать)<input data-akt="penalty" value="${esc(c.penalty)}"></label></div>
    <h4 class="akth">Раздел 2 — спецификация договора <small class="muted">${sp.length} поз. · количество — на весь срок договора</small></h4>
    <div class="tbl aktspec"><table><thead><tr><th>Наименование (как в договоре)</th><th>Ед.</th><th>Кол-во</th><th>Цена</th><th>Страна происхождения</th><th>Товар на сайте</th><th></th></tr></thead><tbody>${sp.map((r,i)=>`<tr data-i="${i}"><td><input data-s="name" value="${esc(r.name)}"></td><td><input data-s="unit" value="${esc(r.unit)}" class="sm"></td><td><input data-s="qty" inputmode="decimal" value="${esc(r.qty)}" class="sm"></td><td><input data-s="price" inputmode="decimal" value="${esc(r.price)}" class="sm"></td><td><input data-s="country" value="${esc(r.country)}" list="akt-ctry"></td><td><select data-s="pid"><option value="">— не связан —</option>${(()=>{ const pl=D.prices[M.ctr.customerId]||{}; return D.products.filter(p=>p.id===r.pid || (pl[p.id]!=null&&pl[p.id]!=="")).map(p=>`<option value="${p.id}"${p.id===r.pid?" selected":""}>${esc(p.name)}</option>`).join(""); })()}</select></td><td><button type="button" class="btn ghost sm danger" data-aktdel="${i}" aria-label="Удалить строку">×</button></td></tr>`).join("")}</tbody></table></div>
    <datalist id="akt-ctry">${[...new Set(Object.values(AKT_CTRY))].map(x=>`<option value="${esc(x)}">`).join("")}</datalist>
    <div class="row"><button type="button" class="btn sm" id="akt-addrow">+ Строка</button><button type="button" class="btn ghost sm" id="akt-fromprice">Заполнить из прайса заказчика</button><span style="flex:1"></span><button type="button" class="btn pri" id="akt-save">Сохранить шаблон</button></div>
    <p class="muted sk-hint">«Товар на сайте» связывает строку договора с товаром из накладных: по ней сайт кладёт поставленное в раздел 3 в том же порядке и проверяет превышение количества.</p></div>`; }
function aktReadEdit(){ const c=AKT.cfg; document.querySelectorAll("#akt-box [data-akt]").forEach(el=>{ c[el.dataset.akt]=el.value.trim(); });
  const rows=[...document.querySelectorAll("#akt-box .aktspec tr[data-i]")]; if(rows.length){ c.spec=rows.map(tr=>{ const o={}; tr.querySelectorAll("[data-s]").forEach(el=>o[el.dataset.s]=el.value.trim()); return o; }); } }
$("#akt-box").addEventListener("change", async e=>{ const t=e.target, ctr=(D.contracts||[]).find(x=>x.id===AKT.ctr);
  if(t.id==="akt-ctr"){ AKT.ctr=t.value; AKT.cfg=null; AKT.off={}; renderAkt(AKT.cid); return; }
  if(t.id==="akt-ym"){ if(t.value){ AKT.ym=t.value; AKT.date=""; AKT.off={}; } renderAkt(AKT.cid); return; }
  if(t.id==="akt-date"){ AKT.date=t.value; return; }
  if(t.dataset.aktoff){ AKT.off[t.dataset.aktoff]=!t.checked; if(AKT.edit) aktReadEdit(); renderAkt(AKT.cid); const d=$("#akt-box details.aktdocs"); if(d) d.open=true; return; }
  if(t.id==="akt-imp"){ const f=t.files[0]; t.value=""; if(!f||!ctr) return;
    try{ const r=await aktImport(f, ctr); AKT.cfg=Object.assign(r.cfg,{__id:ctr.id}); AKT.edit=true; AKT.dirty=true; renderAkt(AKT.cid);
      toast(r.matched<r.n?"warn":"ok","Прошлый акт прочитан","Строк спецификации: "+r.n+", связано с товарами сайта: "+r.matched+(r.matched<r.n?". Остальные свяжите в колонке «Товар на сайте»":"")+". Проверьте и нажмите «Сохранить шаблон».", {ms:9000}); }
    catch(er){ toast("err","Не получилось прочитать акт", er.message); } return; }
  if(t.closest(".aktedit")) AKT.dirty=true; });
$("#akt-box").addEventListener("click", async e=>{ const t=e.target, ctr=(D.contracts||[]).find(x=>x.id===AKT.ctr); if(!ctr) return;
  if(t.closest("#akt-edit")){ if(AKT.edit) aktReadEdit(); AKT.edit=!AKT.edit; renderAkt(AKT.cid); return; }
  if(t.closest("#akt-all")){ AKT.all=!AKT.all; renderAkt(AKT.cid); return; }
  if(t.closest("#akt-addrow")){ aktReadEdit(); AKT.cfg.spec=(AKT.cfg.spec&&AKT.cfg.spec.length?AKT.cfg.spec:aktSpecFromPrices(ctr.customerId)).concat([{pid:"",name:"",unit:"кг",qty:"",price:"",country:"Российская Федерация"}]); AKT.dirty=true; renderAkt(AKT.cid); const L=document.querySelectorAll("#akt-box .aktspec tr[data-i] [data-s=name]"); L.length&&L[L.length-1].focus(); return; }
  if(t.closest("#akt-fromprice")){ aktReadEdit(); const old=AKT.cfg.spec||[], q={}; old.forEach(r=>{ if(r.pid) q[r.pid]=r; }); AKT.cfg.spec=aktSpecFromPrices(ctr.customerId).map(r=>q[r.pid]?Object.assign(r,{qty:q[r.pid].qty, country:q[r.pid].country||r.country, name:q[r.pid].name||r.name}):r); AKT.dirty=true; renderAkt(AKT.cid); toast("info","Спецификация заполнена из прайса","Количество по договору сохранено у уже связанных строк. Проверьте и сохраните."); return; }
  const del=t.closest("[data-aktdel]"); if(del){ aktReadEdit(); AKT.cfg.spec.splice(+del.dataset.aktdel,1); AKT.dirty=true; renderAkt(AKT.cid); return; }
  if(t.closest("#akt-save")){ aktReadEdit(); const cfg=Object.assign({},AKT.cfg); delete cfg.__id; aktSaveCfg(ctr, cfg); logEv("Справочники","Шаблон месячного акта сохранён: "+(ctr.basis||"")+" — "+(cus(ctr.customerId).name||"")); toast("ok","Шаблон акта сохранён","Теперь каждый месяц достаточно выбрать месяц и нажать «Скачать акт»."); AKT.edit=false; renderAkt(AKT.cid); return; }
  if(t.closest("#akt-dl")){ if(AKT.edit) aktReadEdit(); const M=aktModel(); if(!M||!M.docs.length) return; const b=t.closest("#akt-dl"), t0=b.textContent; b.disabled=true; b.textContent="Готовлю…";
    try{ const blob=await aktDocx(M), [y,m]=M.ym.split("-"), a=document.createElement("a"), url=URL.createObjectURL(blob);
      a.href=url; a.download=fileSafe("Акт приемки-передачи "+String(M.c.name||"").replace(/[«»"]/g,"")+" за "+AKT_MON_N[+m-1]+" "+y)+".docx"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000);
      logEv("Скачивание","Скачан месячный акт за "+AKT_MON_N[+m-1]+" "+y+" — "+(M.c.name||"")+", "+fm(M.total)+" ₽, документов: "+M.docs.length);
      if(AKT.dirty && !(M.cfg.spec&&M.cfg.spec.length)) {}
      const fname=a.download;
      toast(M.W.some(w=>w.l===0)?"warn":"ok","Акт скачан", M.W.some(w=>w.l===0)?"Есть замечания (красные) — проверьте их перед отправкой заказчику.":AKT_MON_N[+m-1]+" "+y+": "+fm(M.total)+" ₽, "+M.F.length+" поз.", {ms:9000, action:{label:"Сохранить копию в акты заказчика", fn:()=>aktFileUp(new File([blob], fname, {type:blob.type}), M.c.id, M.ym)}});
    }catch(er){ toast("err","Не получилось сделать акт", er.message); } finally{ b.disabled=false; b.textContent=t0; } return; }
});
/* ---------- файлы актов заказчика (Google Диск, лист «Акты заказчиков») ---------- */
const AKTF={cid:"", list:null, err:"", ym:aktDefYm(), busy:0};
const AKT_EXT=/\.(pdf|docx?|xlsx?|jpe?g|png|webp|heic|heif|txt)$/i;
async function aktFilesLoad(cid){ AKTF.cid=cid; AKTF.list=null; AKTF.err=""; aktFilesDraw();
  if(!API_URL || !pass()){ AKTF.list=[]; aktFilesDraw(); return; }
  try{ const j=await api({action:"aktList", customerId:cid}); if(AKTF.cid!==cid) return; AKTF.list=j.list||[]; }
  catch(e){ if(AKTF.cid!==cid) return; AKTF.list=[]; AKTF.err=/unknown action/.test(e.message)?"Чтобы загружать акты, обновите скрипт Google Таблицы (новая версия Code.gs).":"Список актов не загрузился: "+e.message; }
  aktFilesDraw(); }
const aktMonL = ym => ym ? AKT_MON_N[+ym.slice(5)-1]+" "+ym.slice(0,4) : "";
function aktFilesDraw(){ const box=$("#akt-files"); if(!box) return; const L=(AKTF.list||[]).slice().sort((a,b)=>String(b.month||"").localeCompare(String(a.month||""))||String(b.at).localeCompare(String(a.at)));
  box.innerHTML=`<div class="aktfh">${aktGen(AKTF.cid)?`<b>Подписанные и прошлые акты</b><span style="flex:1"></span>`:""}<label class="f aktfm">За месяц<input type="month" id="aktf-ym" value="${esc(AKTF.ym)}"></label><label class="btn pri sm${AKTF.busy?" dis":""}">${AKTF.busy?"Загружаю…":"+ Загрузить акт"}<input type="file" id="aktf-file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic" hidden${AKTF.busy?" disabled":""}></label></div>
    ${AKTF.err?`<p class="note">${esc(AKTF.err)}</p>`:""}
    ${AKTF.list==null?`<p class="muted">Загружаю список актов…</p>`:L.length?`<div class="aktfl">${L.map(f=>{ const pdf=f.mime==="application/pdf", im=/^image\//.test(f.mime||""), w=/word|msword/.test(f.mime||""), x=/excel|sheet/.test(f.mime||"");
      return `<div class="skfile"><span class="skfi">${pdf?"PDF":im?"Фото":w?"DOC":x?"XLS":"Файл"}</span><span class="skfn"><b>${esc(f.name)}</b><small>${f.month?"за "+esc(aktMonL(f.month))+" · ":""}${esc(f.by||"")} · ${skWhen(f.at)}</small></span><span class="skfa">${pdf||im?`<button type="button" class="btn ghost sm" data-aktfv="${f.id}">Открыть</button>`:""}<button type="button" class="btn ghost sm" data-aktfg="${f.id}">Скачать</button><button type="button" class="btn ghost sm danger" data-aktfd="${f.id}" aria-label="Удалить">×</button></span></div>`; }).join("")}</div>`:`<p class="muted">Актов пока нет. Нажмите «+ Загрузить акт» — файл сохранится за этим заказчиком.</p>`}`; }
async function aktFileUp(f, cid, ym){ if(!f) return; if(!AKT_EXT.test(f.name)){ toast("err","Такой файл не подходит","Можно Word, PDF, Excel или фото."); return; } if(f.size>20*1024*1024){ toast("err","Файл больше 20 МБ",""); return; }
  if(!API_URL || !pass()){ toast("err","Нет связи с таблицей","Акты хранятся в Google Таблице — войдите в систему."); return; }
  const data=await new Promise((ok,bad)=>{ const r=new FileReader(); r.onload=()=>ok(String(r.result).split(",")[1]||""); r.onerror=()=>bad(new Error("не получилось прочитать файл")); r.readAsDataURL(f); });
  const rid="a"+Date.now().toString(36)+uid(), body={action:"aktAdd", rid, customerId:cid, name:f.name, mime:skMime(f), month:ym||"", data};
  AKTF.busy++; aktFilesDraw(); let j=null;
  for(let i=0;i<3 && !j;i++){ try{ j=await api(body); }catch(e){ if(!e.net || i===2){ AKTF.busy--; aktFilesDraw(); toast("err","Акт не загрузился", e.net?"Нет связи — попробуйте ещё раз, файл не задвоится.":(/unknown action/.test(e.message)?"Обновите скрипт Google Таблицы (новая версия Code.gs).":e.message)); return; } await new Promise(r=>setTimeout(r,1500)); } }
  AKTF.busy--; if(AKTF.cid===cid){ AKTF.list=(AKTF.list||[]).filter(x=>x.id!==j.item.id).concat([j.item]); } aktFilesDraw(); toast("ok","Акт сохранён",f.name+(ym?" — за "+aktMonL(ym):"")); }
async function aktFileGet(id, view){ try{ const j=await api({action:"aktGet", id}), bin=atob(j.data), u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i);
    const blob=new Blob([u8],{type:j.mime||"application/octet-stream"}), url=URL.createObjectURL(blob);
    if(view){ const im=/^image\//.test(j.mime), v=document.createElement("dialog"); v.className="dcard wide skview"; v.innerHTML=`<div class="dc-head"><div><div class="dc-kicker">Акт</div><h3>${esc(j.name)}</h3></div><button class="dc-x" aria-label="Закрыть">×</button></div>${im?`<img src="${url}" alt="${esc(j.name)}">`:`<iframe src="${url}" title="${esc(j.name)}"></iframe>`}<div class="dc-acts"><a class="btn" href="${url}" download="${esc(j.name)}">Скачать</a></div>`;
      document.getElementById("fd-app").appendChild(v); v.querySelector(".dc-x").onclick=()=>v.close(); v.addEventListener("close",()=>{ v.remove(); URL.revokeObjectURL(url); }); v.showModal(); requestAnimationFrame(()=>v.classList.add("in")); }
    else { const a=document.createElement("a"); a.href=url; a.download=j.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),60000); }
  }catch(e){ toast("err","Файл не открылся", e.message); } }
$("#akt-files").addEventListener("change", e=>{ const t=e.target; if(t.id==="aktf-ym"){ AKTF.ym=t.value; return; } if(t.id==="aktf-file"){ const f=t.files[0]; t.value=""; aktFileUp(f, AKTF.cid, AKTF.ym); } });
$("#akt-files").addEventListener("click", async e=>{ const v=e.target.closest("[data-aktfv],[data-aktfg]"); if(v){ aktFileGet(v.dataset.aktfv||v.dataset.aktfg, !!v.dataset.aktfv); return; }
  const d=e.target.closest("[data-aktfd]"); if(d){ if(!armed(d,"Удалить?")) return; const id=d.dataset.aktfd; try{ await api({action:"aktDel", id}); AKTF.list=(AKTF.list||[]).filter(x=>x.id!==id); aktFilesDraw(); toast("info","Акт удалён",""); }catch(er){ toast("err","Не удалилось", er.message); } } });
window.__akt={model:()=>aktModel(), get st(){ return AKT; }, files:AKTF};   /* для тестов */   /* для тестов */

/* ---------- папка заказчика на Google Диске: акты и сопроводительные письма по ОП, скачивание с печатью и подписью ----------
   Даниил сам кладёт файлы в свою папку (каждый месяц меняет), сайт берёт их оттуда (действие aktDir в Code.gs ≥ 27).
   Подразделение (ОП) — по словам в названии файла («Диет», «Комбинат»), вид — «Акт» / «Сопровод…» / «Счёт».
   Печать и подпись — картинки поставщика (карточка «Поставщики»). Место находится само: подпись — на линии «______» рядом
   с фамилией поставщика, печать — на «м.п.» в колонке поставщика; поправленное руками запоминается (prefs.aktSig) относительно
   фамилии, поэтому в следующем месяце встаёт так же, даже если таблица в письме стала длиннее. */
const ADIR={cid:"", st:null, err:"", busy:0, url:"", chg:false};
const AD_KL={act:"Акт", letter:"Письмо", inv:"Счёт", other:"Файл"}, AD_KF={act:"Акт сдачи-приёмки", letter:"Сопроводительное письмо", inv:"Счёт", other:"Документ"};
const adKind = n => /сопровод|письм/i.test(n)?"letter":/(^|[^а-я])акт/i.test(n)?"act":/сч[её]т/i.test(n)?"inv":"other";
const AD_STOP=new Set(["моск","госу","унив","имен","ломо","обос","подр","учре","обра","феде","бюдж","выс","высш","мгу","2026","2025","2027"]);
const adToks = s => norm(s).replace(/\.[a-z0-9]{2,5}$/,"").replace(/[«»"().,_\-–—№]/g," ").split(" ").filter(Boolean);
const adStems = s => adToks(s).filter(w=>w.length>=4 && !/^\d/.test(w)).map(w=>w.slice(0,4)).filter(w=>!AD_STOP.has(w));
function adBranch(name, bl){ const T=adToks(name); let best=null, bs=0, tie=false;
  bl.forEach(b=>{ const st=[...new Set(adStems(b.label||b.fullName||""))], sc=st.filter(x=>T.some(t=>t.startsWith(x))).length; if(sc>bs){ best=b; bs=sc; tie=false; } else if(sc && sc===bs) tie=true; });
  return bs && !tie ? best : null; }
const adOk = f => /\.(pdf|docx?|odt|rtf|xlsx?|ods)$/i.test(f.name) || /pdf|word|document|spreadsheet|excel|rtf/.test(f.mime||"");
function adGroups(){ const c=cus(ADIR.cid)||{}, bl=branches(c), F=((ADIR.st||{}).files||[]).filter(adOk), G=bl.map(b=>({k:b.id, b, label:b.label||b.fullName||"Подразделение", L:[]})), gen={k:"", label:bl.length?"Общие (подразделение не понятно из названия)":"Файлы", L:[]};
  F.forEach(f=>{ const b=adBranch(f.name, bl), g=b?G.find(x=>x.k===b.id):gen; g.L.push(Object.assign({kind:adKind(f.name)}, f)); });
  const ko={act:0, letter:1, inv:2, other:3}; [...G, gen].forEach(g=>g.L.sort((a,b)=>ko[a.kind]-ko[b.kind]||a.name.localeCompare(b.name,"ru")));
  return [...G, gen].filter(g=>g.L.length); }
async function aktDirLoad(cid, quiet){ ADIR.cid=cid; if(!quiet){ ADIR.st=null; ADIR.err=""; ADIR.chg=false; } aktDirDraw();
  if(!API_URL || !pass()){ ADIR.st={folder:null, files:[]}; aktDirDraw(); return; }
  try{ const j=await api({action:"aktDir", customerId:cid}); if(ADIR.cid!==cid) return; ADIR.st=j; ADIR.err=""; }
  catch(e){ if(ADIR.cid!==cid) return; ADIR.st={folder:null, files:[]}; ADIR.err=/unknown action/.test(e.message)?"old":e.message; }
  aktDirDraw(); }
function aktDirDraw(){ const box=$("#akt-dir"); if(!box) return; if(isStaff()){ box.innerHTML=""; return; }
  const st=ADIR.st, fo=st&&st.folder, help=`<p class="muted adhelp">Каждый месяц кладите новые акты и письма в эту папку на своём Google Диске (старые можно заменить) — сайт возьмёт их оттуда сам. Подразделение сайт понимает по названию файла (например, «Акт Диет», «Сопровод Комбинат»).</p>`;
  if(ADIR.err==="old"){ box.innerHTML=`<h4 class="akth first">Акты и письма из папки на Диске</h4><p class="note">Чтобы брать акты из папки на Google Диске, обновите скрипт Google Таблицы (Code.gs версии 27) — жёлтая плашка сверху, кнопка «Как обновить».</p>`; return; }
  if(!st){ box.innerHTML=`<h4 class="akth first">Акты и письма из папки на Диске</h4><p class="muted">Смотрю папку…</p>`; return; }
  if(!fo || ADIR.chg){ box.innerHTML=`<h4 class="akth first">Акты и письма из папки на Диске</h4>${help}
      ${fo&&fo.err?`<p class="note">${esc(fo.err)}</p>`:""}${ADIR.err?`<p class="note">${esc(ADIR.err)}</p>`:""}
      <div class="adset"><label class="f">Ссылка на папку Google Диска<input id="ad-url" type="url" inputmode="url" placeholder="https://drive.google.com/drive/folders/…" value="${esc(ADIR.url)}"></label><button type="button" class="btn pri" data-adset${ADIR.busy?" disabled":""}>${ADIR.busy?"Проверяю…":"Подключить папку"}</button>${ADIR.chg?`<button type="button" class="btn ghost" data-adchg="0">Отмена</button>`:""}</div>`; return; }
  const G=adGroups(), n=G.reduce((s,g)=>s+g.L.length,0);
  box.innerHTML=`<h4 class="akth first">Акты и письма из папки на Диске</h4>
    <div class="adbar"><span class="adfo">Папка: <b>${esc(fo.name||"")}</b> · ${n} ${plural(n,["файл","файла","файлов"])}</span><span class="adbtns"><a class="btn ghost sm" href="${esc(fo.url||"")}" target="_blank" rel="noopener">Открыть папку ↗</a><button type="button" class="btn ghost sm" data-adre>Обновить</button><button type="button" class="btn ghost sm" data-adchg="1">Другая папка</button></span></div>
    ${n?G.map(g=>`<div class="adg"><div class="adgh"><b>${esc(g.label)}</b>${g.L.length>1&&g.L.some(f=>f.kind!=="other")?`<button type="button" class="btn sm" data-adall="${esc(g.k)}" title="Все файлы подразделения одним PDF — с печатью и подписью">Всё одним PDF с печатью</button>`:""}</div>
      ${g.L.map(f=>`<div class="adr"><span class="adk k-${f.kind}">${AD_KL[f.kind]}</span><span class="adn"><b>${esc(f.name)}</b><small>${AD_KF[f.kind]} · изменён ${f.at?fd(f.at.slice(0,10)):"—"}</small></span><span class="ada"><button type="button" class="btn pri sm" data-adsig="${esc(f.id)}">С печатью и подписью</button><button type="button" class="btn ghost sm" data-adview="${esc(f.id)}">Открыть</button><button type="button" class="btn ghost sm" data-adget="${esc(f.id)}" title="Исходный файл, как лежит в папке">${/\.docx?$/i.test(f.name)?"Word":"Файл"}</button></span></div>`).join("")}</div>`).join("")
      :`<p class="muted">В папке пока нет актов и писем (Word или PDF).</p>`}
    ${help}`; }
/* --- файлы --- */
const ADPDF={};
const adB64 = d => { const b=atob(d), u=new Uint8Array(b.length); for(let i=0;i<b.length;i++) u[i]=b.charCodeAt(i); return u; };
const adFile = id => ((ADIR.st||{}).files||[]).find(x=>x.id===id);
async function adPdf(f){ const k=f.id+"|"+f.at; if(ADPDF[k]) return ADPDF[k]; const j=await api({action:"aktDir", customerId:ADIR.cid, op:"pdf", id:f.id}); return ADPDF[k]=adB64(j.data); }
async function adPdfJs(){ const L=await ftLib("pdf.js/3.11.174/pdf.min.js",()=>window.pdfjsLib,"PDF"); const P=L||window.pdfjsLib; if(!P) throw new Error("не загрузилась библиотека PDF"); if(!P.GlobalWorkerOptions.workerSrc) P.GlobalWorkerOptions.workerSrc=LIBCDN+"pdf.js/3.11.174/pdf.worker.min.js"; return P; }
async function adRead(u8){ const P=await adPdfJs(), doc=await P.getDocument({data:u8.slice()}).promise, pages=[];
  for(let n=1;n<=doc.numPages;n++){ const pg=await doc.getPage(n), vp=pg.getViewport({scale:1}), tc=await pg.getTextContent();
    pages.push({pg, w:vp.width, h:vp.height, it:tc.items.filter(i=>i.str&&i.str.trim()).map(i=>{ const t=P.Util&&P.Util.transform?P.Util.transform(vp.transform, i.transform):[1,0,0,1,i.transform[4],vp.height-i.transform[5]]; return {s:i.str, x:t[4], y:t[5], w:i.width||0, fh:Math.abs(i.transform[3])||Math.abs(i.height)||10}; })}); }
  return {doc, pages}; }
/* --- картинки поставщика --- */
const adSurname = s => String((s&&s.fio)||"").trim().split(/\s+/)[0]||"";
const adSups = () => D.suppliers.filter(s=>s.stamp||s.sign);
function adImg(src){ return new Promise(ok=>{ if(!src) return ok(null); const im=new Image(); im.onload=()=>ok({src, w:im.naturalWidth||1, h:im.naturalHeight||1, im}); im.onerror=()=>ok(null); im.src=src; }); }
function adSupFor(R, cid){ const L=adSups(); if(!L.length) return null; const txt=norm(R.pages.map(p=>p.it.map(i=>i.s).join(" ")).join(" "));
  const hit=L.find(s=>{ const sn=norm(adSurname(s)); return sn.length>3 && txt.includes(sn); }); if(hit) return hit;
  const cs=ctrs(cid).filter(x=>!x.dateTo||x.dateTo>=todayISO()); const bySup=cs.map(x=>L.find(s=>s.id===x.supplierId)).find(Boolean); return bySup||L[0]; }
/* опорная точка — последнее упоминание фамилии поставщика (обычно строка подписи) */
function adAnchor(R, s){ const sn=norm(adSurname(s)); let a=null;
  if(sn.length>3) R.pages.forEach((p,pi)=>p.it.forEach(i=>{ const t=norm(i.s), k=t.lastIndexOf(sn); if(k<0) return; const cw=i.w/Math.max(1,i.s.length);
    const c={pi, x:i.x+k*cw, y:i.y, fh:i.fh, it:i, cw}; if(!a || pi>a.pi || (pi===a.pi && (c.y>a.y+2 || (Math.abs(c.y-a.y)<=2 && c.x>a.x)))) a=c; }));
  return a; }
function adAuto(R, s, A, sz){ const pi=A?A.pi:R.pages.length-1, P=R.pages[pi], o={pi, st:null, sg:null};
  const sgW=sz.sg?Math.min(110, P.w*0.19):0, sgH=sz.sg?sgW*sz.sg.h/sz.sg.w:0, stW=sz.st?Math.min(118, P.w*0.2):0, stH=sz.st?stW*sz.st.h/sz.st.w:0;
  let ux=null, by=A?A.y:P.h*0.85;
  if(A){ const us=/_{4,}/, line=P.it.filter(i=>Math.abs(i.y-A.y)<4 && us.test(i.s));
    let best=null; line.forEach(i=>{ const m=i.s.match(/_{4,}/g)||[]; let from=0; const cw=i.w/Math.max(1,i.s.length); m.forEach(run=>{ const k=i.s.indexOf(run, from); from=k+run.length; const cx=i.x+(k+run.length/2)*cw; if(cx<A.x+2 && (!best || cx>best)) best=cx; }); });
    ux = best!=null ? best : A.x-sgW*0.55; }
  else ux=P.w*0.7;
  if(sz.sg) o.sg={x:ux-sgW/2, y:by-sgH*0.72, w:sgW};
  if(sz.st){ const mp=[]; P.it.forEach(i=>{ const t=norm(i.s), k=t.search(/м\.\s?п\.?/); if(k>=0){ const cw=i.w/Math.max(1,i.s.length); mp.push({x:i.x+k*cw+cw*2, y:i.y-i.fh*0.35}); } });
    const ax=A?A.x:ux; let m=null; mp.filter(p=>Math.abs(p.x-ax)<P.w*0.4 && (!A || p.y>A.y-40)).forEach(p=>{ const d=Math.abs(p.x-ax)+Math.abs(p.y-by)*0.5; if(!m || d<m.d) m={...p, d}; });
    const cx=m?m.x:ux-sgW*0.25, cy=m?Math.min(m.y, by+stH*0.6):by-sgH*0.2; o.st={x:cx-stW/2, y:cy-stH/2, w:stW}; }
  return o; }
const adKey = (cid, f, gk) => cid+"|"+f.kind+"|"+(gk||"");
function adLayout(R, s, A, sz, key){ const auto=adAuto(R, s, A, sz), sv=(getPrefs().aktSig||{})[key]; if(!sv || sv.sid!==s.id) return Object.assign(auto,{auto:1});
  const pi=A?A.pi:Math.min(sv.pi||0, R.pages.length-1), ax=A?A.x:0, ay=A?A.y:0, o={pi};
  ["st","sg"].forEach(k=>{ const v=sv[k]; o[k]= !sz[k] ? null : v===0 ? null : v ? {x:ax+v.dx, y:ay+v.dy, w:v.w} : auto[k]; }); return o; }
function adRemember(key, s, A, L){ const p=getPrefs(); p.aktSig=p.aktSig||{}; const ax=A?A.x:0, ay=A?A.y:0;
  p.aktSig[key]={sid:s.id, pi:L.pi, st:L.st?{dx:+(L.st.x-ax).toFixed(1), dy:+(L.st.y-ay).toFixed(1), w:+L.st.w.toFixed(1)}:0, sg:L.sg?{dx:+(L.sg.x-ax).toFixed(1), dy:+(L.sg.y-ay).toFixed(1), w:+L.sg.w.toFixed(1)}:0};
  setPrefs(p, true); }
/* --- PDF с картинками (pdf-lib) --- */
/* белый фон у картинки (фото печати на бумаге, JPG) делаем прозрачным — иначе в PDF он закроет текст под печатью */
const ADCLR={};
function adClear(im){ if(ADCLR[im.src]) return ADCLR[im.src]; const c=document.createElement("canvas"), k=Math.min(1, 1200/Math.max(im.w, im.h)); c.width=Math.round(im.w*k); c.height=Math.round(im.h*k);
  const x=c.getContext("2d"); x.drawImage(im.im,0,0,c.width,c.height); try{ const d=x.getImageData(0,0,c.width,c.height), a=d.data; for(let i=0;i<a.length;i+=4){ const m=Math.min(a[i],a[i+1],a[i+2]); if(m>238) a[i+3]=0; else if(m>205) a[i+3]=Math.min(a[i+3], Math.round((238-m)*255/33)); } x.putImageData(d,0,0); }catch(e){}
  return ADCLR[im.src]=c.toDataURL("image/png"); }
async function adEmbed(out, im){ return out.embedPng(adB64(adClear(im).split(",")[1])); }
async function adStampPdf(u8, jobs){ const L=await dLib(), doc=await L.PDFDocument.load(u8.slice(), {ignoreEncryption:true});
  for(const j of jobs){ const pg=doc.getPages()[j.pi]; if(!pg) continue; const H=pg.getHeight();
    for(const k of ["sg","st"]){ const b=j[k]; if(!b || !j.img[k]) continue; const e=await adEmbed(doc, j.img[k]), h=b.w*j.img[k].h/j.img[k].w; pg.drawImage(e, {x:b.x, y:H-b.y-h, width:b.w, height:h}); } }
  return doc; }
const adOut = (f, sfx) => fileSafe(String(f.name||"документ").replace(/\.[^.]+$/,""))+(sfx||"")+".pdf";
/* --- окно «С печатью и подписью» --- */
const ADS={};
async function aktSignOpen(id){ const f=adFile(id); if(!f) return; const fl=adGroups().flatMap(g=>g.L.map(x=>Object.assign({gk:g.k}, x))).find(x=>x.id===id)||f;
  if(!adSups().length){ toast("warn","Нет печати и подписи","Загрузите картинки печати и подписи в карточке поставщика (вкладка «Поставщики»)."); return; }
  const btn=document.querySelector(`[data-adsig="${CSS.escape(id)}"]`), t0=btn&&btn.textContent; if(btn){ btn.disabled=true; btn.textContent="Готовлю PDF…"; }
  try{ const u8=await adPdf(f), R=await adRead(u8); let s=adSupFor(R, ADIR.cid);
    Object.assign(ADS, {f:fl, u8, R, cid:ADIR.cid, scrolled:0}); await adSetSup(s, true);
    CARD_RE=null; openCard(adSignHtml(), true); adPaint(); }
  catch(e){ toast("err","Не получилось открыть", e.message); }
  finally{ if(btn){ btn.disabled=false; btn.textContent=t0; } } }
async function adSetSup(s, first){ const [st, sg]=await Promise.all([adImg(s.stamp), adImg(s.sign)]); ADS.s=s; ADS.img={st, sg}; ADS.A=adAnchor(ADS.R, s);
  ADS.key=adKey(ADS.cid, ADS.f, ADS.f.gk); ADS.L=adLayout(ADS.R, s, ADS.A, {st, sg}, ADS.key); ADS.on={st:!!ADS.L.st || (first?false:!!st), sg:!!ADS.L.sg || (first?false:!!sg)};
  if(!ADS.L.st && st) ADS.L.st=adAuto(ADS.R, s, ADS.A, {st, sg}).st; if(!ADS.L.sg && sg) ADS.L.sg=adAuto(ADS.R, s, ADS.A, {st, sg}).sg; }
function adSignHtml(){ const f=ADS.f, L=adSups(), n=ADS.R.pages.length;
  return `<div class="dc-head"><div><div class="dc-kicker">${esc(AD_KF[f.kind])} · ${esc(cusNm(ADS.cid)||"")}</div><h3>${esc(f.name.replace(/\.[^.]+$/,""))}</h3></div><button class="dc-x" data-dc="close" aria-label="Закрыть">×</button></div>
    <div class="adtool"><label class="f">Чья печать<select id="ads-sup">${L.map(s=>`<option value="${s.id}"${s.id===ADS.s.id?" selected":""}>${esc(s.name)}</option>`).join("")}</select></label>
      <label class="chk"><input type="checkbox" id="ads-st"${ADS.on.st?" checked":""}${ADS.img.st?"":" disabled"}> Печать</label><label class="chk"><input type="checkbox" id="ads-sg"${ADS.on.sg?" checked":""}${ADS.img.sg?"":" disabled"}> Подпись</label>
      ${n>1?`<span class="adpg"><button type="button" class="btn ghost sm" data-adpg="-1" aria-label="Предыдущая страница">‹</button><b id="ads-pn"></b><button type="button" class="btn ghost sm" data-adpg="1" aria-label="Следующая страница">›</button></span>`:""}
      <button type="button" class="btn ghost sm" data-adauto title="Поставить печать и подпись туда, где сайт нашёл их место сам">Как было</button></div>
    <p class="muted adtip">${ADS.A?"Печать и подпись стоят у фамилии «"+esc(adSurname(ADS.s))+"».":"Фамилию поставщика в файле не нашёл — поставил внизу страницы."} Перетащите их пальцем или мышью, уголок справа внизу — размер. Новое место запомнится для этого вида документа.</p>
    <div class="adstage" id="ads-stage"><div class="adpage" id="ads-page"><canvas id="ads-cv"></canvas><div class="adov" data-k="st" tabindex="0" aria-label="Печать — перетащите; стрелки двигают"><img alt="Печать"><i class="adrs" aria-hidden="true"></i></div><div class="adov" data-k="sg" tabindex="0" aria-label="Подпись — перетащите; стрелки двигают"><img alt="Подпись"><i class="adrs" aria-hidden="true"></i></div></div></div>
    <div class="dc-acts adacts"><button type="button" class="btn pri" data-adsdl>Скачать PDF с печатью</button><button type="button" class="btn" data-adsed title="Скачает PDF с печатью и откроет редактор PDF — там можно поправить что угодно">В редактор PDF ↗</button><button type="button" class="btn ghost" data-adsplain>Без печати</button></div>`; }
async function adPaint(){ const pg=$("#ads-page"), cv=$("#ads-cv"); if(!pg||!cv) return; const P=ADS.R.pages[ADS.L.pi], st=$("#ads-stage");
  const W=Math.min(st.clientWidth||600, 820), sc=W/P.w, dpr=Math.min(2.5, window.devicePixelRatio||1); ADS.sc=sc;
  pg.style.width=W+"px"; pg.style.height=(P.h*sc)+"px"; cv.width=Math.round(W*dpr); cv.height=Math.round(P.h*sc*dpr); cv.style.width=W+"px"; cv.style.height=(P.h*sc)+"px";
  const pn=$("#ads-pn"); if(pn) pn.textContent="стр. "+(ADS.L.pi+1)+" из "+ADS.R.pages.length;
  const vp=P.pg.getViewport({scale:sc*dpr}), ctx=cv.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height);
  try{ if(ADS.task) ADS.task.cancel(); ADS.task=P.pg.render({canvasContext:ctx, canvas:cv, viewport:vp}); await ADS.task.promise; }catch(e){ if(!/cancel/i.test(e&&e.name||e&&e.message||"")) console.warn(e); }
  adOvPaint();
  if(!ADS.scrolled){ ADS.scrolled=1; const b=ADS.L.sg||ADS.L.st; if(b){ st.scrollTop=Math.max(0, b.y*sc - st.clientHeight/2); st.scrollLeft=Math.max(0, b.x*sc - st.clientWidth/2); } } }
function adOvPaint(){ ["st","sg"].forEach(k=>{ const el=document.querySelector(`#ads-page .adov[data-k="${k}"]`); if(!el) return; const b=ADS.L[k], im=ADS.img[k];
  el.hidden=!(b && im && ADS.on[k]); if(el.hidden) return; const sc=ADS.sc; el.querySelector("img").src=im.src;
  el.style.left=(b.x*sc)+"px"; el.style.top=(b.y*sc)+"px"; el.style.width=(b.w*sc)+"px"; el.style.height=(b.w*im.h/im.w*sc)+"px"; }); }
function adSave(){ const L={pi:ADS.L.pi, st:ADS.on.st?ADS.L.st:null, sg:ADS.on.sg?ADS.L.sg:null}; adRemember(ADS.key, ADS.s, ADS.A && ADS.A.pi===ADS.L.pi ? ADS.A : null, L); }
function adJob(){ return [{pi:ADS.L.pi, st:ADS.on.st?ADS.L.st:null, sg:ADS.on.sg?ADS.L.sg:null, img:ADS.img}]; }
async function adSignDl(mode){ const f=ADS.f;
  try{ let blob; if(mode==="plain") blob=new Blob([ADS.u8],{type:"application/pdf"});
    else { const doc=await adStampPdf(ADS.u8, adJob()); blob=new Blob([await doc.save()],{type:"application/pdf"}); adSave(); }
    const name=adOut(f, mode==="plain"?"":" (с печатью)"); dDownload(blob, name);
    if(mode==="ed"){ window.open(PDF_URL, "_blank", "noopener"); toast("info","PDF скачан — откройте его в редакторе", name+" — нажмите в редакторе «Открыть файл» и выберите его из «Загрузок»."); }
    else toast("ok","PDF скачан", name); }
  catch(e){ toast("err","PDF не получился", e.message); } }
/* перетаскивание и размер */
let ADDG=null;
document.addEventListener("pointerdown", e=>{ const ov=e.target.closest && e.target.closest("#ads-page .adov"); if(!ov) return; e.preventDefault();
  const k=ov.dataset.k, b=ADS.L[k]; ADDG={k, rs:!!e.target.closest(".adrs"), x0:e.clientX, y0:e.clientY, b0:{...b}, id:e.pointerId}; ov.classList.add("drag"); try{ ov.setPointerCapture(e.pointerId); }catch(er){} });
document.addEventListener("pointermove", e=>{ if(!ADDG || e.pointerId!==ADDG.id) return; const sc=ADS.sc, P=ADS.R.pages[ADS.L.pi], b=ADS.L[ADDG.k], im=ADS.img[ADDG.k], dx=(e.clientX-ADDG.x0)/sc, dy=(e.clientY-ADDG.y0)/sc;
  if(ADDG.rs){ b.w=Math.max(30, Math.min(P.w*0.6, ADDG.b0.w+dx)); }
  else { const h=b.w*im.h/im.w; b.x=Math.max(-b.w*0.3, Math.min(P.w-b.w*0.7, ADDG.b0.x+dx)); b.y=Math.max(-h*0.3, Math.min(P.h-h*0.7, ADDG.b0.y+dy)); }
  adOvPaint(); });
const adDgEnd = e => { if(!ADDG || (e.pointerId!=null && e.pointerId!==ADDG.id)) return; document.querySelectorAll("#ads-page .adov.drag").forEach(x=>x.classList.remove("drag")); const moved=Math.abs(e.clientX-ADDG.x0)+Math.abs(e.clientY-ADDG.y0)>2; ADDG=null; if(moved) adSave(); };
document.addEventListener("pointerup", adDgEnd); document.addEventListener("pointercancel", adDgEnd);
document.addEventListener("keydown", e=>{ const ov=e.target.closest && e.target.closest("#ads-page .adov"); if(!ov || !/^Arrow/.test(e.key)) return; e.preventDefault(); const b=ADS.L[ov.dataset.k], st=e.shiftKey?10:2;
  if(e.key==="ArrowLeft") b.x-=st; if(e.key==="ArrowRight") b.x+=st; if(e.key==="ArrowUp") b.y-=st; if(e.key==="ArrowDown") b.y+=st; adOvPaint(); adSave(); });
document.addEventListener("change", async e=>{ const t=e.target; if(!t.closest || !t.closest("#ads-page") && !/^ads-/.test(t.id||"")) return;
  if(t.id==="ads-sup"){ const s=D.suppliers.find(x=>x.id===t.value); if(!s) return; await adSetSup(s, false); $("#ads-st").checked=ADS.on.st; $("#ads-st").disabled=!ADS.img.st; $("#ads-sg").checked=ADS.on.sg; $("#ads-sg").disabled=!ADS.img.sg; adPaint(); return; }
  if(t.id==="ads-st" || t.id==="ads-sg"){ const k=t.id.slice(4); ADS.on[k]=t.checked; if(t.checked && !ADS.L[k]) ADS.L[k]=adAuto(ADS.R, ADS.s, ADS.A, ADS.img)[k]; adOvPaint(); adSave(); } });
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-adsdl],[data-adsed],[data-adsplain],[data-adauto],[data-adpg]"); if(!b || !b.closest("dialog")) return;
  if(b.dataset.adsdl!=null) return adSignDl("st"); if(b.dataset.adsed!=null) return adSignDl("ed"); if(b.dataset.adsplain!=null) return adSignDl("plain");
  if(b.dataset.adauto!=null){ const a=adAuto(ADS.R, ADS.s, ADS.A, ADS.img); ADS.L=Object.assign(a, {}); ADS.on={st:!!ADS.img.st, sg:!!ADS.img.sg}; $("#ads-st").checked=ADS.on.st; $("#ads-sg").checked=ADS.on.sg; const p=getPrefs(); if(p.aktSig){ delete p.aktSig[ADS.key]; setPrefs(p, true); } adPaint(); return; }
  if(b.dataset.adpg){ const n=ADS.R.pages.length, pi=Math.max(0, Math.min(n-1, ADS.L.pi+ +b.dataset.adpg)); if(pi===ADS.L.pi) return; const P0=ADS.R.pages[ADS.L.pi], P1=ADS.R.pages[pi];
    ["st","sg"].forEach(k=>{ const x=ADS.L[k]; if(x){ x.x=x.x*P1.w/P0.w; x.y=Math.min(x.y, P1.h-40); } }); ADS.L.pi=pi; adPaint(); adSave(); } });
/* «Всё одним PDF с печатью»: акт + письмо подразделения, места — запомненные или найденные сами */
async function adAll(gk, btn){ const g=adGroups().find(x=>x.k===gk); if(!g) return; if(!adSups().length){ toast("warn","Нет печати и подписи","Загрузите их в карточке поставщика."); return; }
  const t0=btn.textContent; btn.disabled=true; btn.textContent="Собираю…";
  try{ const L=await dLib(), out=await L.PDFDocument.create(), miss=[];
    for(const f of g.L){ try{ const u8=await adPdf(f), R=await adRead(u8), s=adSupFor(R, ADIR.cid), [st, sg]=await Promise.all([adImg(s.stamp), adImg(s.sign)]), A=adAnchor(R, s), lay=adLayout(R, s, A, {st, sg}, adKey(ADIR.cid, f, gk));
        const doc=await adStampPdf(u8, [{pi:lay.pi, st:lay.st, sg:lay.sg, img:{st, sg}}]), pp=await out.copyPages(doc, doc.getPageIndices()); pp.forEach(p=>out.addPage(p)); }
      catch(er){ miss.push(f.name+": "+er.message); } }
    if(!out.getPageCount()) throw new Error(miss.join("; ")||"нет файлов");
    const name=fileSafe((cusNm(ADIR.cid)||"Заказчик")+" — "+g.label+" — с печатью")+".pdf"; dDownload(new Blob([await out.save()],{type:"application/pdf"}), name);
    toast(miss.length?"warn":"ok", miss.length?"Скачано не всё":"PDF скачан", miss.length?miss.join("; "):name+" — проверьте места печати; поправить можно кнопкой «С печатью и подписью» у файла."); }
  catch(e){ toast("err","Не получилось собрать PDF", e.message); }
  finally{ btn.disabled=false; btn.textContent=t0; } }
async function adSetFolder(){ const u=($("#ad-url")||{}).value||""; ADIR.url=u.trim(); if(!ADIR.url){ toast("warn","Вставьте ссылку на папку",""); return; }
  ADIR.busy=1; aktDirDraw(); try{ const j=await api({action:"aktDir", customerId:ADIR.cid, op:"set", url:ADIR.url}); ADIR.st=j; ADIR.chg=false; ADIR.err=""; ADIR.url=""; toast("ok","Папка подключена", (j.folder&&j.folder.name)||""); }
  catch(e){ ADIR.err=/unknown action/.test(e.message)?"old":e.message; } finally{ ADIR.busy=0; aktDirDraw(); } }
$("#akt-dir").addEventListener("click", async e=>{ const b=e.target.closest("button,a"); if(!b) return; const d=b.dataset;
  if(d.adset!=null) return adSetFolder(); if(d.adre!=null){ b.disabled=true; await aktDirLoad(ADIR.cid, true); return; }
  if(d.adchg!=null){ ADIR.chg=d.adchg==="1"; ADIR.err=""; aktDirDraw(); if(ADIR.chg){ const i=$("#ad-url"); if(i) i.focus(); } return; }
  if(d.adsig) return aktSignOpen(d.adsig); if(d.adall!=null) return adAll(d.adall, b);
  if(d.adview || d.adget){ const f=adFile(d.adview||d.adget); if(!f) return; const t0=b.textContent; b.disabled=true; b.textContent="…";
    try{ if(d.adview){ const u8=await adPdf(f), url=URL.createObjectURL(new Blob([u8],{type:"application/pdf"})), v=document.createElement("dialog"); v.className="dcard wide skview"; v.innerHTML=`<div class="dc-head"><div><div class="dc-kicker">${esc(AD_KF[adKind(f.name)])}</div><h3>${esc(f.name)}</h3></div><button class="dc-x" aria-label="Закрыть">×</button></div><iframe src="${url}" title="${esc(f.name)}"></iframe><div class="dc-acts"><a class="btn" href="${url}" download="${esc(adOut(f))}">Скачать PDF</a></div>`;
        document.getElementById("fd-app").appendChild(v); v.querySelector(".dc-x").onclick=()=>v.close(); v.addEventListener("close",()=>{ v.remove(); URL.revokeObjectURL(url); }); v.showModal(); requestAnimationFrame(()=>v.classList.add("in")); }
      else { const j=await api({action:"aktDir", customerId:ADIR.cid, op:"get", id:f.id}); dDownload(new Blob([adB64(j.data)],{type:j.mime||"application/octet-stream"}), j.name); } }
    catch(er){ toast("err","Файл не открылся", er.message); } finally{ b.disabled=false; b.textContent=t0; } } });
$("#akt-dir").addEventListener("keydown", e=>{ if(e.key==="Enter" && e.target.id==="ad-url"){ e.preventDefault(); adSetFolder(); } });
window.__adir={st:ADIR, sign:ADS, groups:()=>adGroups()};   /* для тестов */
