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
