/* ================= КАТЕГОРИИ ТОВАРОВ =================
   Лист «Категории товаров» (D.cats: id, name, order, color), у товара — cat (ID категории); сервер пишет в «Товары» понятное catName.
   Стандартные категории создаются один раз с постоянными ID (два устройства не создадут дубли). Свои — «Категории…».
   Где видно: «Товары» (фильтр, колонка, «Разложить по категориям»), «Цены для заказчика» (фильтр), «Склад» (фильтр), новый товар — категория сама. */
const CAT_DEF=[
  {id:"c-fruit", name:"Фрукты", color:"#e0782f", re:/яблок|груш|апельсин|мандарин|лимон|лайм|банан|ананас|киви|виноград|гранат|грейпфрут|фейхоа|авокадо|хурм|персик|абрикос|слив(?!к)|манго|помело|нектарин|кокос|маракуй/},
  {id:"c-berry", name:"Ягоды", color:"#c2185b", re:/голубик|клубник|малин|ежевик|черник|смородин|брусник|клюкв|вишн|черешн|земляник|облепих/},
  {id:"c-veg", name:"Овощи", color:"#3f8f4f", re:/огур|томат|помидор|перец|капуст|картоф|морков|свекл|свёкл|лук|кабач|цукини|баклаж|редис|дайкон|тыкв|батат|сельдер|чеснок|шампиньон|гриб|кукуруз|имбир|хрен|редьк|репа|пастернак|брокколи|спарж/},
  {id:"c-green", name:"Зелень", color:"#6aa84f", re:/укроп|петрушк|кинза|кориандр|базилик|розмарин|тимьян|чабрец|зелен|салат|руккол|шпинат|айсберг|романо|щавел|мят[аы]|эстрагон|майоран/},
  {id:"c-pickle", name:"Соленья и консервы", color:"#8e6c2f", re:/солён|солен|квашен|маринов|консерв|в сиропе|горошек|оливк|маслин/},
  {id:"c-nuts", name:"Орехи", color:"#8d6e63", re:/орех|миндал|кешью|фундук|арахис|семена|фисташ|пекан/, extra:1},
  {id:"c-dried", name:"Сухофрукты и орехи", color:"#a0522d", re:/изюм|курага|чернослив|финик|орех|миндал|кешью|фундук|арахис|семена|шиповник|инжир|сушён|сушен|сухофрукт|компот|цукат|фисташ/},
  {id:"c-groc", name:"Бакалея", color:"#7a6a58", re:/лавров|дрожж|перец обработ|ванил|казеин|какао|цикорий|кофе|чай|сахар|крахмал|рис\b|рис |горох|фасоль|макарон|вермишел|лапш|изделия макарон|мука|крупа|гречк|пшен|овсян|мёд|мед фас|соль|масло|уксус|молоко|сливки|конфет|сушки|печенье|повидло|джем|сухари|крошка|специ|мак /},
  {id:"c-frozen", name:"Замороженная продукция", color:"#2f7fb0", re:/заморож|морожен|пюре|протёрт|протерт/},
  {id:"c-bread", name:"Хлеб и выпечка", color:"#c9a227", re:/хлеб|батон|тарталет|булк|лаваш|выпечк/}
];
/* порядок проверки: сначала самые «узкие» признаки (заморозка, соленья, бакалея), потом сухофрукты и свежее */
const CAT_GUESS_ORDER=["c-frozen","c-pickle","c-bread","c-groc","c-nuts","c-dried","c-green","c-berry","c-fruit","c-veg"];
/* свои категории с похожим названием («Овощи», «Замарозка», «Орехи») тоже узнаются; если нужной нет — ближайшая */
const CAT_KEYS={"c-fruit":["фрукт"],"c-berry":["ягод"],"c-veg":["овощ"],"c-green":["зелен","зелён"],"c-pickle":["солен","солён","консерв","маринад"],"c-dried":["сухоф","сушен","сушён"],"c-nuts":["орех"],"c-groc":["бакал"],"c-frozen":["замор","замар","мороз"],"c-bread":["хлеб","выпеч"]};
const CAT_FALL={"c-nuts":"c-dried","c-berry":"c-fruit","c-bread":"c-groc"};
function catTarget(defId, seen){ const L=D.cats||[]; if(L.some(c=>c.id===defId)) return defId; const k=CAT_KEYS[defId]||[];
  const own=L.find(c=>{ const n=String(c.name||"").toLowerCase(); return k.some(w=>n.includes(w)); }); if(own) return own.id;
  const f=CAT_FALL[defId]; if(f && !(seen||[]).includes(f)) return catTarget(f, (seen||[]).concat(defId)); return ""; }
const CAT_COLORS=["#e0782f","#c2185b","#3f8f4f","#6aa84f","#8e6c2f","#a0522d","#7a6a58","#2f7fb0","#c9a227","#6d4c9f","#00897b","#5d6d7e"];
const catList = () => (D.cats||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0)||String(a.name).localeCompare(String(b.name),"ru"));
const catById = id => (D.cats||[]).find(c=>c.id===id) || null;
const catOf = p => p && p.cat ? catById(p.cat) : null;
const catCan = () => !docLimited() && !!curUser();
function catGuess(name){ if(catTreeOn()){ const r=catTreeRes(catTreeGuess(name)); if(r) return r; } const n=String(name||"").toLowerCase().replace(/ё/g,"е"), L=D.cats||[];
  /* «Сельдерей (корень)» — овощ, «сельдерей черешковый» — тоже; «лук зелёный» — зелень, не овощ */
  if(/лук\s*(свеж\w*\s*)?зел|зел\w*\s*лук/.test(n)) return catTarget("c-green");
  for(const id of CAT_GUESS_ORDER){ const d=CAT_DEF.find(x=>x.id===id); if(d && d.re.test(n)){ const t=catTarget(id); if(t) return t; } }
  /* свои категории: название категории встречается в названии товара */
  const own=L.find(c=>!CAT_DEF.some(d=>d.id===c.id) && c.name.length>=4 && n.includes(c.name.toLowerCase().replace(/ё/g,"е").slice(0,5)));
  return own?own.id:""; }
/* стандартные категории — один раз, когда таблица уже знает лист и он пуст */
function catSeed(){ if(!D.catSrv || (D.cats||[]).length || !catCan() || lsGet("frudom-cats-seed")) return;
  D.cats=CAT_DEF.filter(d=>!d.extra).map((d,i)=>({id:d.id, name:d.name, order:String((i+1)*10), color:d.color})); D.cats.forEach(c=>dirty("cats",c.id)); lsSet("frudom-cats-seed","1"); }
const catChip = (c, n, on, attr) => `<button type="button" ${attr} class="catc${on?" on":""}" style="--cc:${esc(catCol(c))}"><i></i>${esc(c?c.name:"Без категории")}${n!=null?` <em>${n}</em>`:""}</button>`;
const catTag = c => c ? `<span class="cattag" style="--cc:${esc(catCol(c))}">${esc(catFull(c))}</span>` : "";
/* список выбора: категории, у кого есть подкатегории — группой («Овощи — вся категория», «Капуста», …) */
function catOptions(sel, withNone){ const o=c=>`<option value="${esc(c.id)}"${c.id===sel?" selected":""}>${esc(c.name)}</option>`;
  return (withNone?`<option value=""${!sel?" selected":""}>— без категории —</option>`:"")+catTops().map(t=>{ const S=catSubs(t.id); if(!S.length) return o(t);
    return `<optgroup label="${esc(t.name)}"><option value="${esc(t.id)}"${t.id===sel?" selected":""}>${esc(t.name)} — вся категория</option>${S.map(o).join("")}</optgroup>`; }).join("")
    + catList().filter(c=>c.parent && !catPar(c)).map(o).join(""); }

/* ---------- «Категории…»: создать, переименовать, цвет, порядок, удалить ---------- */
let CATM=null;
function catManage(){ CATM={add:""}; skModal(catManageHtml, false); }
function catManageHtml(){ const T=catTops(), cnt=id=>D.products.filter(p=>catIn(p,id)).length, tree=catTreeSrv();
  const row=(c,i,n,sub)=>`<div class="catm-r${sub?" sub":""}" data-cid="${esc(c.id)}">${sub?`<i class="catm-dot" style="--cc:${esc(catCol(c))}"></i>`:`<input type="color" class="catm-col" value="${esc(c.color||"#888888")}" aria-label="Цвет">`}<input class="catm-n" data-keep="1" value="${esc(c.name)}" aria-label="${sub?"Название подкатегории":"Название категории"}"><span class="muted catm-c">${cnt(c.id)} ${plural(cnt(c.id),["товар","товара","товаров"])}</span>
       <span class="catm-a"><button type="button" class="btn ghost sm" data-catm="up" ${i?"":"disabled"} aria-label="Выше">↑</button><button type="button" class="btn ghost sm" data-catm="down" ${i<n-1?"":"disabled"} aria-label="Ниже">↓</button><button type="button" class="btn ghost sm danger" data-catm="del" aria-label="Удалить">×</button></span></div>`;
  return skHead("Товары","Категории товаров","Свои категории можно добавить, переименовать, перекрасить и поставить в нужном порядке. Удалённая категория просто снимается с товаров — сами товары остаются.","Категории товаров")
   + (!D.catSrv?`<div class="sknoteb">Чтобы категории сохранялись в таблице и были видны всем — обновите Code.gs. Пока они хранятся только на этом устройстве.</div>`:"")
   + (tree&&catCan()?`<div class="catm-tree"><span>${catTreeOn()?"Сайт может заново разложить товары по категориям и подкатегориям — вы увидите всё до применения.":"Подкатегорий пока нет. Сайт сам создаст их и разложит все товары по смыслу — вы увидите всё до применения."}</span><button type="button" class="btn sm" data-ctt="open">${catTreeOn()?"Разложить заново…":"Разложить по подкатегориям…"}</button></div>`:"")
   + `<div class="catm">${T.map((c,i)=>{ const S=catSubs(c.id); return `<div class="catm-g">${row(c,i,T.length)}${S.map((x,k)=>row(x,k,S.length,1)).join("")}</div>`; }).join("")||`<p class="muted">Категорий пока нет.</p>`}</div>
     <div class="catm-add"><input class="catm-new" data-keep="1" value="${esc(CATM.add)}" placeholder="${tree?"Новая категория или подкатегория":"Новая категория, например «Молочная продукция»"}">${tree&&T.length?`<select class="catm-par" aria-label="Куда добавить"><option value="">Новая категория</option>${T.map(c=>`<option value="${esc(c.id)}"${CATM.par===c.id?" selected":""}>Подкатегория в «${esc(c.name)}»</option>`).join("")}</select>`:""}<button type="button" class="btn pri" data-catm="add">Добавить</button></div>
     <div class="dc-acts"><button class="btn" data-sk="close">Готово</button></div>`; }
function catMRedraw(f){ if(!SKM || SKM.render!==catManageHtml) return; const d=SKM.d, st=d.scrollTop; d.innerHTML=catManageHtml(); d.scrollTop=st; if(f){ const el=d.querySelector(f); el&&el.focus(); } }
function catAdd(name, parent){ name=skN(name); if(!name) return null; const par=parent&&catById(parent)?parent:"", L=par?catSubs(par):catTops();
  const ex=L.find(c=>skK(c.name)===skK(name)); if(ex){ toast("info","Такая "+(par?"подкатегория":"категория")+" уже есть","«"+catFull(ex)+"»"); return ex; }
  const c={id:"c"+uid(), name, order:String(((L.length?+L[L.length-1].order||0:0))+10), color:par?(catById(par).color||""):CAT_COLORS[(D.cats||[]).length%CAT_COLORS.length]}; if(par||catTreeSrv()) c.parent=par;
  (D.cats=D.cats||[]).push(c); dirty("cats",c.id); logEv("Справочники",(par?"Новая подкатегория «"+catFull(c)+"»":"Новая категория товаров «"+name+"»")); return c; }
function catAfter(){ try{ if(curTab==="products") renderProducts(); }catch(e){} try{ if(curTab==="stock") skDrawList(); }catch(e){} try{ if(curTab==="customers" && PRV.cid) renderPrices(PRV.cid); }catch(e){} }
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-catm]"); if(!b || !CATM) return; const a=b.dataset.catm, r=b.closest(".catm-r"), id=r&&r.dataset.cid;
  if(a==="add"){ const inp=SKM.d.querySelector(".catm-new"), ps=SKM.d.querySelector(".catm-par"); CATM.par=ps?ps.value:""; const c=catAdd(inp.value, CATM.par); if(c){ CATM.add=""; catMRedraw(".catm-new"); catAfter(); toast("ok","Категория добавлена","«"+c.name+"»"); } else inp.focus(); return; }
  if(a==="up"||a==="down"){ const me=catById(id), L=me&&me.parent&&catPar(me)?catSubs(me.parent):catTops(), i=L.findIndex(c=>c.id===id), j=a==="up"?i-1:i+1; if(i<0||j<0||j>=L.length) return; const t=L[i]; L[i]=L[j]; L[j]=t; L.forEach((c,k)=>{ const o=String((k+1)*10); if(c.order!==o){ c.order=o; dirty("cats",c.id); } }); catMRedraw(); catAfter(); return; }
  if(a==="del"){ const c=catById(id); if(!c) return; const S=catSubs(id); if(!armed(b,S.length?"Удалить вместе с "+S.length+" подкат.?":"Удалить?")) return; const ids=[id].concat(S.map(x=>x.id)), dd=[]; let n=0;
    D.products.forEach(p=>{ if(ids.includes(p.cat)){ p.cat=""; dd.push(p.id); n++; } }); if(dd.length) dirtyMany("products", dd);
    D.cats=D.cats.filter(x=>!ids.includes(x.id)); ids.forEach(x=>dirty("cats",x,true)); logEv("Справочники","Удалена "+(c.parent?"подкатегория «"+c.name+"»":"категория «"+c.name+"»")+(S.length?" с подкатегориями: "+S.length:"")+(n?", снята с товаров: "+n:"")); catMRedraw(); catAfter(); toast("ok","Категория удалена", n?"Снята с "+n+" "+plural(n,["товара","товаров","товаров"])+".":""); } });
document.addEventListener("change", e=>{ const t=e.target; if(!CATM || !t.closest || !t.closest(".catm-r")) return; const c=catById(t.closest(".catm-r").dataset.cid); if(!c) return;
  if(t.classList.contains("catm-col")){ c.color=t.value; dirty("cats",c.id); catSubs(c.id).forEach(x=>{ if(x.color!==t.value){ x.color=t.value; dirty("cats",x.id); } }); catAfter(); return; }
  if(t.classList.contains("catm-n")){ const v=skN(t.value); if(!v){ t.value=c.name; return; } if((c.parent&&catPar(c)?catSubs(c.parent):catTops()).some(x=>x.id!==c.id && skK(x.name)===skK(v))){ toast("err","Такая категория уже есть",""); t.value=c.name; return; } if(v!==c.name){ c.name=v; dirty("cats",c.id); catAfter(); } } });
document.addEventListener("keydown", e=>{ if(e.key==="Enter" && CATM && e.target.classList && e.target.classList.contains("catm-new")){ e.preventDefault(); const b=SKM&&SKM.d.querySelector('[data-catm="add"]'); b&&b.click(); } });

/* ---------- категория по разделу прайса и через ИИ (19.11.2026, просьба Даниила) ---------- */
/* какие категории сайта упоминаются в тексте раздела («Овощи свежие» → Овощи, «Консервация» → Соленья и консервы, «Молочная продукция» → своя) */
function catSecHits(sec){ const s=String(sec||"").toLowerCase().replace(/ё/g,"е"); if(!s.trim()) return []; const out=[];
  Object.entries(CAT_KEYS).forEach(([id,k])=>{ if(k.some(w=>s.includes(w.replace(/ё/g,"е")))){ const t=catTarget(id); if(t && !out.includes(t)) out.push(t); } });
  (D.cats||[]).forEach(c=>{ const n=String(c.name||"").toLowerCase().replace(/ё/g,"е"); if(n.length>=4 && s.includes(n.slice(0,5)) && !out.includes(c.id)) out.push(c.id); });
  return out; }
/* категория товара из прайса: раздел однозначный — по разделу; иначе по названию вместе с разделом (узкие признаки — заморозка, соленья — важнее) */
function catPick(name, sec){ if(catTreeOn()){ const r=catTreeRes(catTreeGuess(name, sec)); if(r) return r; } const H=catSecHits(sec); if(H.length===1) return H[0];
  const g=catGuess(String(name||"")+(sec?" | "+sec:"")); if(g) return g; return H[0]||""; }
/* название категории от ИИ → ID категории сайта; нет такой — "" (её можно создать) */
function catByName(n){ const k=skK(n); if(!k) return ""; const L=D.cats||[];
  const m=String(n).split(/\s*\/\s*/); if(m.length===2){ const t=catTops().find(c=>skK(c.name)===skK(m[0])); if(t){ const x=catSubs(t.id).find(c=>skK(c.name)===skK(m[1])); return x?x.id:""; } } const ex=L.find(c=>skK(c.name)===k); if(ex) return ex.id;
  const H=catSecHits(n); return H.length===1?H[0]:""; }
const catAiSrv = () => (D.srvVer||0)>=48;
/* ИИ раскладывает товары по категориям: list = [{n: название, s: раздел прайса}] → массив названий категорий ("" — не знает) */
async function catAi(list, onStep){ const out=new Array(list.length).fill(""), cats=catTreeOn()?catTops().flatMap(t=>{ const S=catSubs(t.id); return S.length?S.map(x=>t.name+" / "+x.name):[t.name]; }):catList().map(c=>c.name);
  for(let i=0;i<list.length;i+=150){ const part=list.slice(i,i+150); onStep&&onStep(i, list.length);
    const text="Категории сайта: "+(cats.join("; ")||"(пока нет)")+"\n\nТовары:\n"+part.map((x,k)=>(k+1)+". "+x.n+(x.s?" (раздел прайса: "+x.s+")":"")).join("\n");
    let j; try{ j=await apiFetch(API_URL,{method:"POST", tmo:150000, body:JSON.stringify({key:pass(), user:curUser(), action:"aiRead", kind:"cat", text})}); }
    catch(e){ const m=e.message||""; throw new Error(m==="nokey"||m==="badkey"?"не настроен ключ ИИ — «Данные» → «ИИ»":m==="unknown action"?"скрипт таблицы старый — обновите Code.gs":m); }
    let x; try{ x=JSON.parse(String(j.text).replace(/^```(json)?|```$/g,"").trim()); }catch(e){ throw new Error("ИИ ответил не по форме — попробуйте ещё раз"); }
    (x.c||[]).forEach(r=>{ const k=+(Array.isArray(r)?r[0]:r.i)-1, c=String((Array.isArray(r)?r[1]:r.c)||"").trim(); if(k>=0 && k<part.length) out[i+k]=c; }); }
  return out; }
/* ответ ИИ → значение выбора: ID категории сайта или "new:Название" (создастся при сохранении) */
const catAiVal = n => { n=skN(n||""); if(!n) return ""; return catByName(n) || "new:"+n; };
/* список выбора: категории сайта + предложенные ИИ новые */
function catOptsX(sel, extra){ const nw=[...new Set((extra||[]).filter(v=>/^new:/.test(v)))];
  return catOptions(sel, true)
    + nw.map(v=>`<option value="${esc(v)}"${v===sel?" selected":""}>${esc(v.slice(4))} (новая)</option>`).join(""); }
/* "new:Название" → создать категорию (один раз на название), вернуть ID */
function catEnsure(v, made){ if(!v) return ""; if(!/^new:/.test(v)) return catById(v)?v:""; const n=v.slice(4); if(made && made[n]) return made[n];
  const ex=catByName(n); if(ex){ if(made) made[n]=ex; return ex; } const m=n.split(/\s*\/\s*/);
  let c; if(m.length===2 && catTreeSrv()){ const t=catTops().find(x=>skK(x.name)===skK(m[0]))||catAdd(m[0]); c=t?catAdd(m[1], t.id):null; } else c=catAdd(n); const id=c?c.id:""; if(made) made[n]=id; return id; }
const catLabel = v => !v ? "" : /^new:/.test(v) ? v.slice(4) : catFull(catById(v));

/* ---------- «Разложить по категориям»: предложение для товаров без категории ---------- */
let CATA=null;
function catAuto(){ const L=D.products.filter(p=>!p.cat && p.name), sel={}; L.forEach(p=>{ const g=catGuess(p.name); if(g) sel[p.id]=g; });
  CATA={L, sel}; skModal(catAutoHtml, true); }
function catAutoHtml(){ const A=CATA, groups=catList().map(c=>({c, L:A.L.filter(p=>A.sel[p.id]===c.id)})).filter(g=>g.L.length), rest=A.L.filter(p=>!A.sel[p.id]), n=Object.keys(A.sel).length;
  return skHead("Товары","Разложить по категориям","Сайт подобрал категорию по названию. Проверьте: любую можно поменять в списке справа или выбрать «— без категории —».","Категории товаров")
   + `<div class="cata">${groups.map(g=>`<div class="cata-g"><div class="cata-h">${catChip(g.c, g.L.length, true, "disabled")}</div>${g.L.map(p=>catARow(p)).join("")}</div>`).join("")}
      ${A.nw&&A.nw.length?A.nw.map(v=>{ const L=A.L.filter(p=>A.sel[p.id]===v); return L.length?`<div class="cata-g"><div class="cata-h"><span class="catc on"><i></i>${esc(v.slice(4))} <em>${L.length}</em></span><small class="muted">новая категория — появится при «Применить»</small></div>${L.map(p=>catARow(p)).join("")}</div>`:""; }).join(""):""}
      ${rest.length?`<div class="cata-g"><div class="cata-h">${catChip(null, rest.length, false, "disabled")}<small class="muted">не узнал — выберите сами или оставьте</small>${catAiSrv()&&!A.busy?`<button type="button" class="btn sm cata-ai" data-cata="ai">Подобрать ИИ · ${rest.length}</button>`:""}${A.busy?`<span class="cata-busy"><i></i>${esc(A.busy)}</span>`:""}${A.err?`<small class="cata-err">${esc(A.err)}</small>`:""}</div>${rest.map(p=>catARow(p)).join("")}</div>`:""}</div>
     <div class="mi-bar"><div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-cata="apply"${n?"":" disabled"}>Применить · ${n} ${plural(n,["товар","товара","товаров"])}</button></div></div>`; }
const catARow = p => `<label class="cata-r"><span>${esc(p.name)}</span><select data-cata-p="${esc(p.id)}">${catOptsX(CATA.sel[p.id]||"", CATA.nw)}</select></label>`;
document.addEventListener("change", e=>{ const t=e.target; if(!CATA || !t.dataset || !t.dataset.cataP) return; if(t.value) CATA.sel[t.dataset.cataP]=t.value; else delete CATA.sel[t.dataset.cataP];
  const b=SKM&&SKM.d.querySelector('[data-cata="apply"]'), n=Object.keys(CATA.sel).length; if(b){ b.disabled=!n; b.textContent="Применить · "+n+" "+plural(n,["товар","товара","товаров"]); } });
/* «Подобрать ИИ»: товары без категории, которые сайт не узнал по названию */
document.addEventListener("click", async e=>{ const b=e.target.closest && e.target.closest('[data-cata="ai"]'); if(!b || !CATA || CATA.busy) return; const A=CATA, rest=A.L.filter(p=>!A.sel[p.id]);
  A.busy="ИИ раскладывает "+rest.length+" "+plural(rest.length,["товар","товара","товаров"])+"…"; A.err=""; skModalRefresh();
  try{ const R=await catAi(rest.map(p=>({n:p.name})), (i,n)=>{ if(n>150){ A.busy="ИИ раскладывает: "+i+" из "+n+"…"; skModalRefresh(); } });
    let k=0; rest.forEach((p,i)=>{ const v=catAiVal(R[i]); if(v){ A.sel[p.id]=v; k++; if(/^new:/.test(v)) (A.nw=A.nw||[]).includes(v)||A.nw.push(v); } });
    A.busy=""; if(CATA!==A) return; skModalRefresh(); toast(k?"ok":"info", k?"ИИ подобрал категории":"ИИ не смог подобрать", k?k+" из "+rest.length+" — проверьте и нажмите «Применить».":"Выберите категории сами.");
  }catch(er){ A.busy=""; A.err="ИИ не ответил: "+(er.message||String(er)); if(CATA===A) skModalRefresh(); } });
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest('[data-cata="apply"]'); if(!b || !CATA) return; let n=0; const made={};
  Object.entries(CATA.sel).forEach(([pid,v])=>{ const p=prod(pid); if(!p || !p.id || p.cat) return; const c=catEnsure(v, made); if(c){ p.cat=c; delete p._ca; dirty("products",p.id); n++; } });
  logEv("Справочники","Товары разложены по категориям: "+n); CATA=null; skClose(); toast("ok","Категории расставлены", n+" "+plural(n,["товар","товара","товаров"])+"."); catAfter(); });

/* ---------- вкладка «Товары»: поиск, фильтр по категории, колонка «Категория» ---------- */
const PDV={q:"", cat:"all"};
function pdFiltered(){ const q=norm(PDV.q); return D.products.filter(p=>(typeof pdSrcOk!=="function"||pdSrcOk(p)) && (!q||norm(p.name+" "+(p.code||"")+" "+pArt(p)).includes(q)||(/^\d+$/.test(q)&&+pArt(p)===+q)) && catPdOk(p)); }
const catPdOk = p => PDV.cat==="all" || (PDV.cat==="none" ? !catOf(p) : /^d:/.test(PDV.cat) ? p.cat===PDV.cat.slice(2) : catIn(p, PDV.cat));
function pdToolbar(){ const box=$("#pd-cats"); if(!box) return; if(typeof pdSrcBar==="function") pdSrcBar(); const q=norm(PDV.q), base=D.products.filter(p=>(typeof pdSrcOk!=="function"||pdSrcOk(p))).filter(p=>!q||norm(p.name+" "+(p.code||"")+" "+pArt(p)).includes(q)||(/^\d+$/.test(q)&&+pArt(p)===+q)), none=base.filter(p=>!catOf(p)).length;
  if(PDV.cat!=="all" && PDV.cat!=="none" && !catById(PDV.cat.replace(/^d:/,""))) PDV.cat="all";
  const selC=catById(PDV.cat.replace(/^d:/,"")), selT=selC?catTop(selC):null;
  box.innerHTML=`<button type="button" data-pdc="all" class="catc all${PDV.cat==="all"?" on":""}">Все <em>${base.length}</em></button>`
    + catTops().map(c=>{ const n=base.filter(p=>catIn(p,c.id)).length; return n||selT===c?catChip(c,n,selT===c,`data-pdc="${esc(c.id)}"`):""; }).join("")
    + (none?catChip(null,none,PDV.cat==="none",'data-pdc="none"'):"");
  /* подкатегории выбранной категории — второй строкой */
  const sb=$("#pd-subs"), S=selT?catSubs(selT.id):[];
  if(sb){ if(!S.length) sb.innerHTML=""; else { const inT=base.filter(p=>catIn(p,selT.id)).length, direct=base.filter(p=>p.cat===selT.id).length;
    sb.style.setProperty("--cc", catCol(selT));
    sb.innerHTML=`<span class="catsub-h">${esc(selT.name)}:</span><button type="button" data-pdc="${esc(selT.id)}" class="catc all${PDV.cat===selT.id?" on":""}" style="--cc:${esc(catCol(selT))}">Все <em>${inT}</em></button>`
      + S.map(x=>{ const n=base.filter(p=>p.cat===x.id).length; return n||PDV.cat===x.id?catChip(x,n,PDV.cat===x.id,`data-pdc="${esc(x.id)}"`):""; }).join("")
      + (direct?`<button type="button" data-pdc="d:${esc(selT.id)}" class="catc${PDV.cat==="d:"+selT.id?" on":""}" style="--cc:${esc(catCol(selT))}"><i></i>Без подкатегории <em>${direct}</em></button>`:""); } }
  const tb=$("#pd-tree"); if(tb) tb.innerHTML = catCan() && D.catSrv && !catTreeOn() ? (catTreeSrv()
      ? `<div class="cattb"><span><b>Подкатегории</b>Сайт сам создаст категории и подкатегории (например «Кондитерские → Печенье, Вафли, Пряники») и разложит все товары по смыслу. Перед применением всё покажет.</span><button type="button" class="btn pri sm" data-ctt="open">Разложить товары…</button></div>`
      : `<div class="cattb"><span><b>Подкатегории</b>заработают после обновления Code.gs в таблице (версия 49) — до этого таблица их не сохранит.</span><button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`) : "";
  const nn=D.products.filter(p=>!p.cat && p.name).length, au=$("#pd-auto"), canA=catCan() && D.catSrv && (D.cats||[]).length && nn && (catAiSrv() || D.products.some(p=>!p.cat && catGuess(p.name)));
  if(au){ au.hidden=!canA; au.textContent="Разложить по категориям ("+nn+")"; }
  const mg=$("#pd-catm"); if(mg) mg.hidden=!catCan() || !D.catSrv;
  /* старый скрипт таблицы не сохраняет категории — не даём их расставлять, чтобы работа не пропала */
  if(!D.catSrv) box.innerHTML=`<div class="sknoteb catold">Категории заработают после обновления Code.gs в таблице — до этого их нельзя расставить: таблица их не сохранит. <button type="button" class="btn sm" id="srvOldHow">Как обновить</button></div>`; }
document.addEventListener("click", e=>{ const t=e.target; if(!t.closest) return;
  const c=t.closest("[data-pdc]"); if(c){ PDV.cat=c.dataset.pdc; renderProducts(); return; }
  if(t.closest("#pd-catm")){ catManage(); return; } if(t.closest("#pd-auto")){ catAuto(); return; }
  const pc=t.closest("[data-prc]"); if(pc){ PRV.cat=pc.dataset.prc; PRV.page=0; if(PRV.cid) prRedraw(); return; }
  const sc=t.closest("[data-skc]"); if(sc){ SKV.cat=sc.dataset.skc; skDrawList(); return; } });
document.addEventListener("input", e=>{ if(e.target.id==="pd-q"){ PDV.q=e.target.value; renderProducts(); } });
/* «Цены для заказчика»: фильтр по категории */
function prCatChips(cid){ const box=$("#pr-cats"); if(!box) return; const L=catList(); if(!L.length){ box.innerHTML=""; return; }
  const pl=D.prices[cid]||{}, inPl=p=>pl[p.id]!=null&&pl[p.id]!=="", base=D.products.filter(p=>PRV.f==="all"||(PRV.f==="has")===inPl(p));
  if(PRV.cat && PRV.cat!=="all" && PRV.cat!=="none" && !catById(PRV.cat)) PRV.cat="all";
  box.innerHTML=`<button type="button" data-prc="all" class="catc all${!PRV.cat||PRV.cat==="all"?" on":""}">Все</button>`+catTops().map(c=>{ const n=base.filter(p=>catIn(p,c.id)).length; return n?catChip(c,n,PRV.cat===c.id,`data-prc="${esc(c.id)}"`):""; }).join("")
    + (base.some(p=>!catOf(p))?catChip(null,base.filter(p=>!catOf(p)).length,PRV.cat==="none",'data-prc="none"'):""); }
const prCatOk = p => !PRV.cat || PRV.cat==="all" || (PRV.cat==="none"?!catOf(p):catIn(p, PRV.cat));
/* склад: категория товара склада — по связанной позиции документов, иначе угадываем по названию */
function skCatOf(it){ for(const pid of (it._links||[])){ const c=catOf(prod(pid)); if(c) return c; } const g=catGuess(it.name); return g?catById(g):null; }
function skCatChips(items){ const L=catTops(); if(!L.length) return ""; if(!SKV.cat) SKV.cat="all"; const cnt=id=>items.filter(i=>{ const c=catTop(skCatOf(i)); return id==="none"?!c:c&&c.id===id; }).length;
  return `<div class="catrow">${`<button type="button" data-skc="all" class="catc all${SKV.cat==="all"?" on":""}">Все <em>${items.length}</em></button>`+L.map(c=>{ const n=cnt(c.id); return n?catChip(c,n,SKV.cat===c.id,`data-skc="${esc(c.id)}"`):""; }).join("")+(cnt("none")?catChip(null,cnt("none"),SKV.cat==="none",'data-skc="none"'):"")}</div>`; }
const skCatOk = it => !SKV.cat || SKV.cat==="all" || (SKV.cat==="none" ? !skCatOf(it) : (catTop(skCatOf(it))||{}).id===SKV.cat);

/* ================= ДЕРЕВО КАТЕГОРИЙ: категории и подкатегории (20.11.2026, просьба Даниила) =================
   У подкатегории в листе «Категории товаров» — parent = ID категории (Code.gs ≥ 49). Товару ставится подкатегория, фильтр по категории берёт и её подкатегории.
   CAT_TREE — как сайт раскладывает сам (catTreeGuess: название + раздел прайса поставщика). ID категорий верхнего уровня — те, что уже есть в таблице Даниила;
   в новой таблице они создаются с этими же ID. ID подкатегорий постоянные (c-…), поэтому два устройства не создадут дубли.
   В JS \\w и \\b не знают русских букв — CT_RX переводит их. */
const CT_RX = re => new RegExp(re.source.replace(/\\w/g,"[а-яa-z]").replace(/\\b/g,"(?![а-яa-z0-9])"), re.flags);
const CAT_TREE=[
  {id:"c7mwmgxkt", name:"Овощи", color:"#e0782f", sub:[["c-v-root","Картофель и корнеплоды"],["c-v-cab","Капуста"],["c-v-tom","Томаты и огурцы"],["c-v-pep","Перец, баклажаны, кабачки, тыква"],["c-v-onion","Лук и чеснок"],["c-v-mush","Грибы свежие"],["c-v-other","Другие овощи"]]},
  {id:"cnbn2y8lk", name:"Фрукты и ягоды", color:"#c2185b", sub:[["c-f-cit","Цитрусовые"],["c-f-apl","Яблоки и груши"],["c-f-grape","Виноград"],["c-f-trop","Тропические и экзотические"],["c-f-stone","Сливы, персики, абрикосы"],["c-f-melon","Арбузы и дыни"],["c-f-berry","Ягоды"]]},
  {id:"ccy6nxr18", name:"Зелень и салаты", color:"#6aa84f", sub:[["c-g-herb","Пряная зелень"],["c-g-salad","Салаты и листовые"]]},
  {id:"ctnq2ttem", name:"Сухофрукты", color:"#7a6a58", sub:[]},
  {id:"c8a59kpej", name:"Орехи и семена", color:"#2f7fb0", sub:[]},
  {id:"c38wx85yj", name:"Консервация", color:"#3f8f4f", sub:[["c-k-pickle","Соленья и маринады"],["c-k-veg","Овощные консервы"],["c-k-mush","Грибы консервированные"],["c-k-olive","Оливки и маслины"],["c-k-fruit","Фруктовые консервы и компоты"],["c-k-jam","Джемы, варенье, мёд"],["c-k-ready","Готовые супы и блюда"],["c-k-meat","Мясные и рыбные консервы"]]},
  {id:"cy0k85y7u", name:"Заморозка", color:"#42c0c2", sub:[["c-z-veg","Овощи и грибы"],["c-z-berry","Ягоды и фрукты"],["c-z-puree","Пюре фруктовое и ягодное"],["c-z-dough","Тесто и выпечка"]]},
  {id:"cj13m0r4e", name:"Бакалея", color:"#a0522d", sub:[["c-b-grain","Крупы и бобовые"],["c-b-pasta","Макароны и лапша"],["c-b-flour","Мука"],["c-b-sugar","Сахар и соль"],["c-b-oil","Масло растительное и уксус"],["c-b-sauce","Соусы, кетчуп, майонез"],["c-b-spice","Специи и приправы"],["c-b-bake","Для выпечки"],["c-b-soup","Бульоны и быстрого приготовления"],["c-b-break","Сухие завтраки"]]},
  {id:"c-tea", name:"Чай, кофе, какао", color:"#8e5a3c", sub:[["c-t-tea","Чай"],["c-t-cof","Кофе в зёрнах и молотый"],["c-t-inst","Кофе растворимый и 3 в 1"],["c-t-cocoa","Какао, цикорий, кисель"],["c-t-gift","Подарочные наборы"]]},
  {id:"cq31d1lxr", name:"Кондитерские изделия", color:"#d4567a", sub:[["c-s-choc","Шоколад и батончики"],["c-s-cand","Конфеты"],["c-s-caram","Карамель, леденцы, драже"],["c-s-gum","Жевательная резинка"],["c-s-marsh","Мармелад, зефир, пастила"],["c-s-cook","Печенье"],["c-s-waf","Вафли"],["c-s-ginger","Пряники"],["c-s-cake","Торты и пирожные"],["c-s-cupc","Кексы, рулеты, круассаны"],["c-s-east","Халва и восточные сладости"],["c-s-kids","Детские сладости"]]},
  {id:"c-snack", name:"Снеки", color:"#e3a21a", sub:[["c-n-chips","Чипсы"],["c-n-crack","Сухарики и снеки"],["c-n-nuts","Орешки и семечки"],["c-n-pop","Попкорн и кукурузные палочки"],["c-n-crk","Крекеры и галеты"]]},
  {id:"c-bread", name:"Хлеб и выпечка", color:"#c9a227", sub:[["c-h-bread","Хлеб, булочки, лаваш"],["c-h-crisp","Хлебцы и хлебные палочки"],["c-h-dry","Сушки, сухари, баранки"],["c-h-tart","Тарталетки и коржи"]]},
  {id:"cc1ejzmda", name:"Молочная продукция", color:"#00897b", sub:[["c-m-milk","Молоко и сливки"],["c-m-sour","Кефир, йогурт, сметана"],["c-m-cott","Творог"],["c-m-cheese","Сыр"],["c-m-butter","Масло сливочное и маргарин"],["c-m-cond","Сгущёнка и сухое молоко"]]},
  {id:"cmm731m10", name:"Мясо, птица, рыба", color:"#6d4c9f", sub:[["c-mt-meat","Мясо и птица"],["c-mt-saus","Колбасы и гастрономия"],["c-mt-fish","Рыба и морепродукты"]]},
  {id:"cj4c580yt", name:"Вода и напитки", color:"#5d6d7e", sub:[["c-w-water","Вода"],["c-w-sweet","Лимонады и газировка"],["c-w-juice","Соки, нектары, морсы"]]},
  {id:"c0rdwelsn", name:"Другое", color:"#9e9e9e", sub:[["c-o-house","Хозтовары и инвентарь"],["c-o-serv","Услуги"]]}
];
const CTN = s => String(s||"").toLowerCase().replace(/ё/g,"е").replace(/[«»"“”]/g," ").replace(/\s+/g," ").trim();
/* разделы прайсов, где всё одного вида: раздел важнее названия */
const CT_SEC_HARD=[
  [/^жевательн\w* резин/, "c-s-gum"], [/^чипсы/, "c-n-chips"], [/сухие завтрак/, "c-b-break"], [/быстрого приготовл/, "c-b-soup"],
  [/^пряники/, "c-s-ginger"], [/^чай$/, "c-t-tea"], [/^какао$/, "c-t-cocoa"], [/кофе молотый|зерно, капсул/, "c-t-cof"], [/наборы подарочн/, "c-t-gift"],
  [/^сухарики, снэки|^сухарики, снеки/, "c-n-crack"], [/кукурузн\w* палочк|попкорн/, "c-n-pop"], [/^орехи\. семечки/, "c-n-nuts"], [/^крекер/, "c-n-crk"], [/^коржи/, "c-h-tart"],
  [/^майонез$/, "c-b-sauce"], [/^томатная паста$/, "c-b-sauce"], [/^мука$/, "c-b-flour"], [/^соль$/, "c-b-sugar"], [/^сахар$/, "c-b-sugar"]
];
/* раздел прайса → подкатегория, если по названию не узнали */
const CT_SEC_SOFT=[
  [/жевательн\w* резин/, "c-s-gum"], [/^какао/, "c-t-cocoa"], [/карамель|леденц/, "c-s-caram"], [/^конфеты/, "c-s-cand"], [/кофе\. цикорий/, "c-t-inst"],
  [/мармелад|зефир|пастил/, "c-s-marsh"], [/^печенье/, "c-s-cook"], [/^рулеты|кексы\.круассаны/, "c-s-cupc"], [/^сушки/, "c-h-dry"], [/^халва|восточн\w* сладост/, "c-s-east"],
  [/^хлебцы/, "c-h-crisp"], [/^шоколад/, "c-s-choc"], [/^вафли/, "c-s-waf"], [/для детей/, "c-s-kids"], [/чипсы|снэки весовые/, "c-n-chips"],
  [/кондитерск/, "c-s-cook"], [/гастроном/, "c-mt-saus"], [/^мясо/, "c-mt-meat"], [/рыбн/, "c-mt-fish"], [/мясная консерв/, "c-k-meat"], [/приправ/, "c-b-spice"],
  [/чай\/кофе/, "c-t-tea"], [/^вода/, "c-w-water"], [/^соки/, "c-w-juice"], [/овощи заморож/, "c-z-veg"], [/ягоды заморож/, "c-z-berry"], [/выпечка, тесто/, "c-z-dough"],
  [/^соленья/, "c-k-pickle"], [/сухофрукты/, "ctnq2ttem"], [/^крупы/, "c-b-grain"], [/^макароны/, "c-b-pasta"], [/масло подсолн|масло оливк/, "c-b-oil"],
  [/кетчуп|соусы/, "c-b-sauce"], [/оливки|маслины/, "c-k-olive"], [/горошек и кукуруз|овощная консерв|фасоль консерв/, "c-k-veg"], [/^грибы/, "c-k-mush"],
  [/джем|варенье|повидло/, "c-k-jam"], [/компот|морс/, "c-k-fruit"], [/фруктовая консерв/, "c-k-fruit"], [/^молоко$/, "c-m-milk"], [/сгущ/, "c-m-cond"],
  [/кефир|ряженк|сметан|йогурт/, "c-m-sour"], [/^сыр/, "c-m-cheese"], [/творо/, "c-m-cott"], [/^сливки/, "c-m-milk"], [/масло и маргарин/, "c-m-butter"], [/змж/, "c-m-milk"]
];
const CT_BERRY=/голубик|клубник|малин|ежевик|черник|смородин|брусник|клюкв|вишн|земляник|облепих|крыжовн|морошк|жимолост|рябин/;
const CT_FRUIT=/яблок|груш|апельсин|мандарин|лимон|лайм|банан|ананас|киви|виноград|гранат|грейпфрут|персик|абрикос|слив(?!оч|к)|манго|маракуй|нектарин|черешн|юдзу|фрукт/;
/* правила по названию: первое совпавшее */
const CT_RULES=[
  [/^перчатк|^рукавиц|краги|^стружк|мыльн\w* пузыр|^пакет\w* (фасов|майк)|^салфетк|^посуд/, "c-o-house"], [/^доставк|^услуг/, "c-o-serv"],
  /* заморозка */
  [/^пюре (фрукт|ягод)|^фрукты \(ягоды\) прот/, "c-z-puree"],
  /* напитки */
  [/^сок\b|^нектар\b|^морс\b|^морс /, "c-w-juice"], [/^квас|^лимонад|^кола\b|^напиток газ|^газированн\w* напит|^энергетич/, "c-w-sweet"],
  [/^вода .*(аскания|чай|кола|лимонад|байкал|дюшес|тархун|чудо-ключик|апельсин|мандарин|лимон|вишня|груша|клубник|яблоко)/, "c-w-sweet"], [/^вода\b/, "c-w-water"],
  /* чай, кофе, какао */
  [/^чай\b|^каркаде|^чайн\w* напит/, "c-t-tea"],
  [/^кофе\b.*(зерн|молот|капсул|дрип|в чалд)/, "c-t-cof"], [/^напиток кофейн\w* 3 ?в ?1|^кофе\b.*(раствор|субл|3 ?в ?1|капучин|латте|гранулир|порошк|стик|нескафе|ст\/б|с\/б|голд|gold|монарх|пакет)/, "c-t-inst"], [/^кофе\b|^кофейн\w* зерн/, "@coffee"],
  [/^какао(?! ?-? ?(масло|бобы)?\s*(тертое))|^горяч\w* шоколад|^цикори|^кофейн\w* нап|^кисель|^напиток кофейн|^капучино|^латте/, "c-t-cocoa"],
  /* молочка */
  [/^(молоко|сливки) [^,]{0,30}сгущ|^сгущ|^молоко сух|^молоко .*сух|^сухое молоко|^казеин/, "c-m-cond"], [/^молоко\b|^сливки|^крем на раст/, "c-m-milk"],
  [/^кефир|^ряженк|^йогурт|^биойогурт|^сметан|^простокваш|^варенец|^айран/, "c-m-sour"], [/^творог|^творожн|^сырок/, "c-m-cott"],
  [/^сыр\b|^брынз|^моцарел|^пармезан|^сулугун/, "c-m-cheese"], [/^масло сливоч|^маргарин|^спред/, "c-m-butter"],
  /* мясо, рыба */
  [/^тушенк|^тушен|^говядина туш|^свинина туш|^паштет/, "c-k-meat"],
  [/^(горбуша|сайра|сардин\w*|шпроты|тунец|скумбри\w*|печень трески|килька|бычки)\b.*(конс|ж\/?б|с\/к|натур|в масле|в томат)|^шпроты|^консервы рыб/, "c-k-meat"],
  [/^колбас|^сосиск|^сардельк|^ветчин|^бекон|^буженин|^карбонад|^грудинк|^шпикачк|^сервелат|^салями/, "c-mt-saus"],
  [/^говядин|^свинин|^баранин|^куры\b|^курица|^цыпл|^филе (грудк|бедр|кур|индей)|^печень кур|^индейк|^фарш|^окорок/, "c-mt-meat"],
  [/^филе (сельд|минта|трески|хек|лосос|семг|пангас|тилап)|^сельдь|^рыба\b|^минтай|^лосось|^семга|^краб|^кревет|^кальмар|^мидии|^морепродукт/, "c-mt-fish"],
  /* консервация */
  [/^оливк|^маслин/, "c-k-olive"],
  [/^грибы .*(консерв|мар\b|маринов)|^грибы мар\b|^опята мар/, "c-k-mush"],
  [/^щи\b|^борщ|^рассольник|^солянка\b|^каша .*(ж\/?б|конс)/, "c-k-ready"],
  [/^[а-я ]{0,30}(по-корейски)|^(капуста|огурц\w*|огурчики|томаты|помидоры|черри|перец|чеснок|черемша|патиссоны|ассорти|кабачки|грибы|арбуз\w*|лук|свекла|морковь|корнишон\w*)\b[^,]{0,25}(квашен|солен|маринов)|^квашен|^солен\w* |^маринов|^листья виноград|^черемш|^огурц\w* .*(с зеленью|в залив)|^томаты .*(в залив|маринов|с зеленью)|^ассорти овощ|^корнишон/, "c-k-pickle"],
  [/^зелен\w* горошек(?!.*с\/м)|^горошек зел\w* конс|^горошек .*ж\/б|^кукуруза .*(ж\/?б|жб|конс)|^фасоль конс|икра кабач|кабачков\w* икр|икра баклаж|^лечо|халапеньо|морской капуст|^морская капуст/, "c-k-veg"],
  [/^[^,]{0,40}в сиропе|^компот\b|^ананасы .*(кусочк|кольц|консерв)|^персики .*консерв|^фрукты конс/, "c-k-fruit"],
  [/^джем|^варенье|^повидло|^конфитюр|^мед\b|^мед нат|^ягода протерт|протерт\w* с сахаром/, "c-k-jam"],
  /* бакалея */
  [/^(специи-)?(дрожж|разрыхлит|ванил|желатин|сахарн\w* пудр|крахмал|лимонн\w* кислот|агар|сода пищ|мак кондит|крошка вафел|сухари панир|кондитерск\w* посыпк|пищев\w* краситель)/, "c-b-bake"],
  [/^специи|^приправ|^перец (черн|душист|бел|молот|обработ)|^лист лавров|^лавров|^паприка|^корица|^куркума|^хмели|^гвоздик|^мускат|^зира|^кумин|^карри/, "c-b-spice"],
  [/^бульон|^суп\b.*(быстр|б\/п)|^лапша быстр|^пюре картоф.*быстр/, "c-b-soup"],
  [/^мука\b/, "c-b-flour"], [/^сахар(?!н\w* (вата|пудра))|^рафинад|^соль\b/, "c-b-sugar"],
  [/^масло (подсолн|оливк|кунжут|растит|рапс|кукуруз|льнян|горчичн|фритюр)|^уксус/, "c-b-oil"],
  [/^майонез|^кетчуп|^соус|^томатн\w* паст|^аджика|^горчица|^хрен\b|^ткемали|^сацебели|^заправк/, "c-b-sauce"],
  [/^гречк|^рис\b|^пшено|^перловк|^манк|^геркулес|^овсян|^хлопья овс|^булгур|^кускус|^чечевиц|^горох\b|^фасоль(?! (стручк|зелен))|^нут\b|^крупа|^ячнев|^ячмен|^киноа|^полба|^маш\b/, "c-b-grain"],
  [/^макарон(ы|\b)|^изделия макарон|^вермишел|^лапша|^спагетти|^фунчоз|^удон/, "c-b-pasta"],
  [/^хлопья|^мюсли|^сухой завтрак|^завтрак/, "c-b-break"],
  /* хлеб */
  [/^хлебц|^хлебн\w* палоч|^гриссини/, "c-h-crisp"],
  [/^сушк|^сухар(?!.*панир)|^баранк|^бублик|^соломк/, "c-h-dry"],
  [/^хлеб|^батон(?!ч)|^булочк|^булка|^лаваш|^багет|^чиабат|^лепешк|^пита\b/, "c-h-bread"],
  [/^тарталет|^корж(?!ик)|^вафельн\w* корж/, "c-h-tart"],
  /* снеки */
  [/^чипс|^картофел\w* хрустящ|^принглс|^лейс/, "c-n-chips"], [/^сухарик|^снек|^снэк|^сырцеед/, "c-n-crack"], [/^попкорн|^кукурузн\w* палоч|^сахарн\w* вата/, "c-n-pop"],
  [/^крекер|^галет/, "c-n-crk"],
  /* кондитерские */
  [/^жев\w* резин|^жевательн\w* резин|^дирол|^орбит/, "c-s-gum"],
  [/^халва|^конфеты .*халва|^козинак|^гозинак|^лукум|^рахат|^пахлав|^шербет|^щербет|^нуга\b|^чурчхел|^восточн/, "c-s-east"],
  [/^карамел|^леденц|^драже|^монпансье|^чупа|^ирис|^тик.?так|^холлс|^ментос|^петушок|^жеват\w* конфет|^жев\w* конфет/, "c-s-caram"],
  [/^мармелад|^зефир|^пастил|^маршмел|^суфле|^желе\b|^птичье/, "c-s-marsh"],
  [/^вафл|^вафельн|^торт вафельн/, "c-s-waf"], [/^пряник|^коврижк/, "c-s-ginger"],
  [/^торт|^пирожн|^эклер|^корзиночк|^трубочк|^буше|^макарон[иcс]\b|^пирог/, "c-s-cake"],
  [/^кекс|^рулет|^круассан|^слойк|^маффин|^бисквит|^мини.?рулет|^пончик|^ромов|^кулич|^штрудел|^мини-?кекс/, "c-s-cupc"],
  [/^печень/, "c-s-cook"],
  [/^шоколад|^батончик|^плитка|^яйцо шоколад|шоколадн\w* яйц|^паста шоколад|^киндер/, "c-s-choc"],
  [/^конфет|^набор конфет|^трюфел|^пралине|^ассорти конфет/, "c-s-cand"],
  /* сухофрукты и орехи */
  [/^изюм|^курага|^чернослив|^финик|^инжир суш|^(апельсин|манго|яблок\w*|груш\w*|банан\w*|ананас\w*|клюква|вишня|черника|ягоды|папайя|киви|дыня|томаты)\b.{0,12}(сушен|сушён|вялен)|^сушен|^сухофрукт|^компотн\w* смес|^смесь сушен|^шиповник|^цукат|^вялен/, "ctnq2ttem"],
  [/^орех|^миндал|^кешью|^фундук|^арахис|^фисташ|^пекан|^макадам|^семена (подсолн|тыкв|льна|чиа)|^семечк|^кедров/, "c8a59kpej"],
  /* свежее */
  [/^лук\s*(свеж\w*\s*)?зел|^зел\w*\s*лук|^укроп|^петрушк|^кинза|^кориандр свеж|^базилик|^розмарин|^тимьян|^мят[аы]|^эстрагон|^зелень|^щавел|^шалфе|^орегано|^майоран/, "c-g-herb"],
  [/^салат [^,]*пекинск|^капуст|^брокколи|^кольраби/, "c-v-cab"],
  [/^салат|^руккол|^рукол|^шпинат|^айсберг|^мангольд|^латук|^микс салат|^романо|^лолло|^фриллис|^радиккио|^кресс/, "c-g-salad"],
  [/^шампиньон|^грибы (шампиньон|вешен|свеж)|^вешенк|^шиитаке свеж|^опята свеж/, "c-v-mush"],
  [/^картоф|^морков|^свекл|^редис|^редьк|^дайкон|^батат|^репа\b|^пастернак|^имбир|^сельдерей.*(корен|корнепл)|^топинамбур/, "c-v-root"],
  [/^огур|^томат|^помидор/, "c-v-tom"],
  [/^перец|^баклаж|^кабач|^цукини|^тыкв|^патиссон/, "c-v-pep"],
  [/^лук\b|^лук-порей|^чеснок|^шалот/, "c-v-onion"],
  [/^спарж|^фенхел|^сельдерей|^кукуруз|^артишок|^бамия|^фасоль (стручк|зелен)/, "c-v-other"],
  [/^апельсин|^мандарин|^лимон|^лайм|^грейпфрут|^помело|^кумкват/, "c-f-cit"], [/^яблок|^груш/, "c-f-apl"], [/^виноград/, "c-f-grape"],
  [/^банан|^ананас|^манго|^киви|^авокадо|^папай|^фейхоа|^гранат|^маракуй|^хурм|^кокос|^личи|^питай|^физалис|^инжир/, "c-f-trop"],
  [/^слив|^персик|^абрикос|^нектарин|^черешн|^алыча/, "c-f-stone"], [/^арбуз|^дын/, "c-f-melon"],
  [new RegExp("^("+CT_BERRY.source+")"), "c-f-berry"]
];
/* внутри кондитерских разделов: вид по слову в любом месте названия («Ламбада, пирожное…», «Французский круассан-мини…») */
const CT_SWEET_ANY=[[/в тесте|^булочк|сдобн/,"c-h-bread"],[/пирожн|эклер|корзиночк|тирамису|чизкейк|торт(?!ил)/,"c-s-cake"],[/круассан|кекс|рулет(?!ик)|маффин|бискв|штрудел|слойк|пончик/,"c-s-cupc"],[/вафл|трубочк/,"c-s-waf"],[/пряник|коврижк/,"c-s-ginger"],
  [/мармелад|зефир|пастил|суфле|маршмел/,"c-s-marsh"],[/халв|пахлав|лукум|козинак|щербет|шербет|чак-?чак|нуга/,"c-s-east"],[/карамел|леденц|драже|ирис/,"c-s-caram"],[/шоколад/,"c-s-choc"],[/печень|крекер|галет|сухар/,"c-s-cook"]];
const CT_SWEET_OK=/^c-(s|h|n)-/;
const CT_SWEET_SEC=/конфет|печень|пирож|кекс|вафл|шоколад|мармел|халв|рулет|для детей|кондитер|пряник/;
const CT_FROZEN=CT_RX(/с\/м|заморож|(^|[^а-я])зам\.|(^|[^а-я])зам\b|замороз|шоков\w* заморо/);
[CT_SEC_HARD, CT_SEC_SOFT, CT_RULES, CT_SWEET_ANY].forEach(L=>L.forEach(r=>{ r[0]=CT_RX(r[0]); }));
function catTreeGuess(name, sec){ const n=CTN(name), s=CTN(sec);
  if(!n) return "";
  const frz=CT_FROZEN.test(n) || /заморож|\(заморозка\)/.test(s);
  /* заморозка: всё замороженное — в «Заморозку» */
  if(frz && !/^мороженое/.test(n)){
    if(/^пюре|прот[её]рт/.test(n)) return "c-z-puree";
    if(/^тесто|^слойк|^круассан|^беляш|^тортилья|^пельмен|^вареник|^блин|^выпечк|^пирож|^хачапур|^самса/.test(n)) return "c-z-dough";
    if(CT_BERRY.test(n) || CT_FRUIT.test(n) || /компотн\w* смес|ягод/.test(n)) return "c-z-berry";
    return "c-z-veg"; }
  if(/^фрукты \(ягоды\) прот/.test(n)) return "c-z-puree";
  for(const [re,id] of CT_SEC_HARD) if(s && re.test(s)) return id;
  if(/мыльн\w* пузыр|водн\w* пистолет|игрушк/.test(n)) return "c-o-house"; if(/^жев\w*\.? ?марм/.test(n)) return "c-s-marsh"; if(/^жев\w*\.? ?резин/.test(n)) return "c-s-gum"; if(/^сдобн\w* печень/.test(n)) return "c-s-cook"; if(/^вафельн\w* драже/.test(n)) return "c-s-caram";
  const sw=!!s && CT_SWEET_SEC.test(s);
  for(const [re,id] of CT_RULES) if(re.test(n)){ if(sw && !CT_SWEET_OK.test(id)) continue; if(id==="@frz-dough") return "c-z-dough"; if(id==="@coffee") return /цикорий|3 в 1/.test(s)?"c-t-inst":"c-t-cof"; return id; }
  if(s && CT_SWEET_SEC.test(s)) for(const [re,id] of CT_SWEET_ANY) if(re.test(n)) return id;
  for(const [re,id] of CT_SEC_SOFT) if(s && re.test(s)) return id;
  return ""; }

/* ---------- дерево на сайте: помощники ---------- */
const catTreeSrv = () => (D.srvVer||0)>=49;   /* старый Code.gs не хранит parent — подкатегории стали бы обычными категориями */
const catPar = c => c && c.parent ? catById(c.parent) : null;
const catTop = c => c ? (catPar(c)||c) : null;
const catTops = () => catList().filter(c=>!catPar(c));
const catSubs = id => catList().filter(c=>c.parent===id);
const catTreeOn = () => (D.cats||[]).some(c=>c.parent && catById(c.parent));
const catCol = c => c ? ((catPar(c)||{}).color || c.color || "#888") : "#9aa19d";
const catFull = (c, sep) => !c ? "" : catPar(c) ? catPar(c).name+(sep||" · ")+c.name : c.name;
const catIn = (p, id) => !!(p && p.cat) && (p.cat===id || (catById(p.cat)||{}).parent===id);
/* ID из CAT_TREE → ID категории на сайте (верхний уровень мог быть в таблице под другим ID — ищем по названию) */
function catTreeRes(tid){ if(!tid) return ""; if(catById(tid)) return tid; const t=CAT_TREE.find(x=>x.id===tid); if(!t) return "";
  const c=catTops().find(x=>skK(x.name)===skK(t.name)); return c?c.id:""; }
/* по каким словам узнаём старые категории («Соленья и консервы» → «Консервация», «Замарозка» → «Заморозка») */
const CT_KEYS={c7mwmgxkt:["овощ"], cnbn2y8lk:["фрукт","ягод"], ccy6nxr18:["зелен","салат"], ctnq2ttem:["сухоф","сушен"], c8a59kpej:["орех","семеч"], c38wx85yj:["консерв","солен","маринад"],
  cy0k85y7u:["замор","замар","мороз"], cj13m0r4e:["бакал"], "c-tea":["чай","кофе"], cq31d1lxr:["кондит","сладост"], "c-snack":["снек","снэк"], "c-bread":["хлеб","выпеч"],
  cc1ejzmda:["молоч"], cmm731m10:["мяс","рыб"], cj4c580yt:["напит","вода"], c0rdwelsn:["друг","проч"]};
const ctK = s => String(s||"").toLowerCase().replace(/ё/g,"е");
/* какая категория сайта станет какой категорией дерева: по ID, по названию, по словам — каждая не больше одного раза */
function catTreeMatch(){ const M={}, used=new Set(), tops=(D.cats||[]).filter(c=>!c.parent);
  CAT_TREE.forEach(t=>{ const c=tops.find(x=>x.id===t.id); if(c){ M[t.id]=c; used.add(c.id); } });
  CAT_TREE.forEach(t=>{ if(M[t.id]) return; const c=tops.find(x=>!used.has(x.id) && skK(x.name)===skK(t.name)); if(c){ M[t.id]=c; used.add(c.id); } });
  CAT_TREE.forEach(t=>{ if(M[t.id]) return; for(const k of CT_KEYS[t.id]||[]){ const c=tops.find(x=>!used.has(x.id) && ctK(x.name).startsWith(k)) || tops.find(x=>!used.has(x.id) && ctK(x.name).includes(k)); if(c){ M[t.id]=c; used.add(c.id); return; } } });
  return M; }
/* старая категория товара → куда в дереве (если по названию не узнали) */
function catTreeOld(c, M){ if(!c) return ""; if(CAT_TREE.some(t=>t.sub.some(x=>x[0]===c.id))) return c.id; const top=catTop(c);
  for(const t of CAT_TREE) if(M[t.id] && M[t.id].id===top.id) return t.id;
  const n=ctK(top.name); for(const t of CAT_TREE) if((CT_KEYS[t.id]||[]).some(k=>n.includes(k))) return t.id; return top.id; }
const ctName = v => { for(const t of CAT_TREE){ if(t.id===v) return t.name; const x=t.sub.find(s=>s[0]===v); if(x) return t.name+" · "+x[1]; } const c=catById(v); return c?catFull(c):"Без категории"; };
const ctColor = v => { for(const t of CAT_TREE){ if(t.id===v || t.sub.some(s=>s[0]===v)) return t.color; } return catCol(catById(v)); };

/* ---------- «Разложить по подкатегориям»: предпросмотр и применение ---------- */
let CTT=null;
async function catTreeOpen(){ if(!catCan() || !catTreeSrv()){ toast("warn","Нужно обновить Code.gs","Подкатегории заработают со скриптом таблицы версии 49."); return; }
  if(typeof vpRows==="function" && VP.rows==null && typeof vpLoad==="function"){ toast("info","Собираю разделы прайсов…",""); try{ await vpLoad(true); }catch(e){} }
  const sec={}, at={}; (typeof vpRows==="function"?vpRows():[]).forEach(r=>{ if(!r.productId) return; const c=vpCatOf(r); if(c && (!at[r.productId] || String(r.date)>at[r.productId])){ sec[r.productId]=c; at[r.productId]=String(r.date); } });
  const M=catTreeMatch(), sel={}, old={}; let un=0;
  D.products.forEach(p=>{ if(!p.name) return; const cur=catOf(p), keepSub=cur && catPar(cur) && catTreeOn();
    const g=keepSub ? cur.id : catTreeGuess(p.name, sec[p.id]);
    sel[p.id]=g || catTreeOld(cur, M) || ""; old[p.id]=p.cat||""; if(!sel[p.id]) un++; });
  CTT={sel, old, sec, M, open:{}, all:{}, n:Object.keys(sel).length, un}; skModal(catTreeHtml, true); }
function ctOptsAll(){ const own=catList().filter(c=>!CAT_TREE.some(t=>t.id===c.id || t.sub.some(s=>s[0]===c.id)) && !Object.values(CTT.M).some(m=>m.id===c.id));
  return `<option value="">— без категории —</option>`+CAT_TREE.map(t=>`<optgroup label="${esc(t.name)}"><option value="${t.id}">${esc(t.name)}${t.sub.length?" — вся категория":""}</option>${t.sub.map(s=>`<option value="${s[0]}">${esc(s[1])}</option>`).join("")}</optgroup>`).join("")
    + (own.length?`<optgroup label="Ваши категории">${own.map(c=>`<option value="${esc(c.id)}">${esc(catFull(c))}</option>`).join("")}</optgroup>`:""); }
function catTreeHtml(){ const A=CTT, G={}; Object.entries(A.sel).forEach(([pid,v])=>{ (G[v]=G[v]||[]).push(pid); });
  const M=A.M, ren=CAT_TREE.filter(t=>M[t.id] && M[t.id].name!==t.name).map(t=>`«${esc(M[t.id].name)}» → «${esc(t.name)}»`), add=CAT_TREE.filter(t=>!M[t.id]).map(t=>`«${esc(t.name)}»`);
  const keep=new Set(Object.values(M).map(c=>c.id)), rm=(D.cats||[]).filter(c=>!c.parent && !keep.has(c.id) && !Object.values(A.sel).includes(c.id)).map(c=>`«${esc(c.name)}»`);
  const chg=Object.keys(A.sel).filter(pid=>ctReal(A.sel[pid])!==A.old[pid]).length, nsub=CAT_TREE.reduce((a,t)=>a+t.sub.length,0);
  const opts=ctOptsAll();
  const list=v=>{ const L=(G[v]||[]).map(prod).filter(Boolean).sort((a,b)=>a.name.localeCompare(b.name,"ru")), lim=A.all[v]?L.length:120;
    return `<div class="ctt-l">${L.slice(0,lim).map(p=>`<label class="ctt-r"><span>${esc(p.name)}${A.sec[p.id]?`<small>${esc(A.sec[p.id])}</small>`:""}</span><select data-ctt-p="${esc(p.id)}">${opts.replace(`value="${A.sel[p.id]}"`,`value="${A.sel[p.id]}" selected`)}</select></label>`).join("")}${L.length>lim?`<button type="button" class="btn ghost sm" data-ctt="all" data-v="${esc(v)}">Показать все ${L.length}</button>`:""}</div>`; };
  const grp=(v,name,n,sub)=>`<div class="ctt-g${A.open[v]?" open":""}"><button type="button" class="ctt-s${sub?" sub":""}" data-ctt="tg" data-v="${esc(v)}" aria-expanded="${A.open[v]?"true":"false"}"><span>${esc(name)}</span><em>${n}</em><i aria-hidden="true">›</i></button>${A.open[v]?list(v):""}</div>`;
  const cnt=v=>(G[v]||[]).length;
  return skHead("Товары","Категории и подкатегории","Сайт разложил товары по смыслу: по названию и разделу прайса поставщика. Нажмите на подкатегорию — увидите товары, любой можно перенести. В документы ничего не идёт.","Категории товаров")
   + `<div class="ctt-sum"><span><b>${A.n}</b> ${plural(A.n,["товар","товара","товаров"])}</span><span><b>${CAT_TREE.length}</b> категорий · <b>${nsub}</b> подкатегорий</span><span><b>${chg}</b> ${plural(chg,["товар поменяет","товара поменяют","товаров поменяют"])} категорию</span>${A.un?`<span class="warn"><b>${A.un}</b> не узнал — внизу</span>`:""}</div>`
   + (ren.length||add.length||rm.length?`<div class="ctt-ch">${ren.length?`<p><b>Переименую:</b> ${ren.join(", ")}</p>`:""}${add.length?`<p><b>Новые категории:</b> ${add.join(", ")}</p>`:""}${rm.length?`<p><b>Уберу опустевшие:</b> ${rm.join(", ")}</p>`:""}</div>`:"")
   + `<div class="ctt">${CAT_TREE.map(t=>{ const n=cnt(t.id)+t.sub.reduce((a,s)=>a+cnt(s[0]),0);
        return `<section class="ctt-t" style="--cc:${t.color}"><h4><i></i>${esc(t.name)}<em>${n}</em></h4>${t.sub.map(s=>grp(s[0],s[1],cnt(s[0]),1)).join("")}${t.sub.length?(cnt(t.id)?grp(t.id,"Без подкатегории",cnt(t.id),1):""):grp(t.id,"Все товары",cnt(t.id),1)}</section>`; }).join("")}
      ${Object.keys(G).filter(v=>v && !CAT_TREE.some(t=>t.id===v||t.sub.some(s=>s[0]===v))).map(v=>`<section class="ctt-t" style="--cc:${esc(ctColor(v))}"><h4><i></i>${esc(ctName(v))}<em>${cnt(v)}</em></h4>${grp(v,"Товары",cnt(v),1)}</section>`).join("")}
      ${cnt("")?`<section class="ctt-t none" style="--cc:#9aa19d"><h4><i></i>Без категории<em>${cnt("")}</em></h4>${grp("","Не узнал — выберите или оставьте",cnt(""),1)}</section>`:""}</div>
     <div class="mi-bar"><div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-ctt="apply">Применить</button></div></div>`; }
/* выбор в списке → настоящий ID на сайте (для подсчёта «поменяет») */
const ctReal = v => { if(!v) return ""; if(CTT && CTT.M[v]) return CTT.M[v].id; return v; };
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-ctt]"); if(!b) return; const a=b.dataset.ctt;
  if(a==="open"){ catTreeOpen(); return; } if(!CTT) return;
  if(a==="tg"){ const v=b.dataset.v; CTT.open[v]=!CTT.open[v]; skModalRefresh(); return; }
  if(a==="all"){ CTT.all[b.dataset.v]=1; skModalRefresh(); return; }
  if(a==="apply") catTreeApply(); });
document.addEventListener("change", e=>{ const t=e.target; if(!CTT || !t.dataset || t.dataset.cttP==null) return; CTT.sel[t.dataset.cttP]=t.value; t.closest(".ctt-r").classList.add("moved"); });
function catTreeApply(){ const A=CTT; if(!A) return; const un=typeof UNDO!=="undefined"&&UNDO; if(un) un.paused++;
  try{ const made={}, M=A.M, cd=[]; D.cats=D.cats||[];
    CAT_TREE.forEach((t,i)=>{ let c=M[t.id]; if(!c){ c={id:t.id}; D.cats.push(c); } const o=String((i+1)*10);
      if(c.name!==t.name || c.order!==o || c.color!==t.color || c.parent){ c.name=t.name; c.order=o; c.color=t.color; c.parent=""; cd.push(c.id); } else if(c.parent==null){ c.parent=""; cd.push(c.id); }
      made[t.id]=c.id;
      t.sub.forEach(([sid,sn],k)=>{ let x=catById(sid); if(!x){ x={id:sid}; D.cats.push(x); } const so=String((k+1)*10);
        if(x.name!==sn || x.order!==so || x.parent!==c.id || x.color!==t.color){ Object.assign(x,{name:sn, order:so, color:t.color, parent:c.id}); cd.push(sid); } made[sid]=sid; }); });
    const dd=[]; Object.entries(A.sel).forEach(([pid,v])=>{ const p=prod(pid); if(!p) return; const nv=v?(made[v]||(catById(v)?v:"")):""; if((p.cat||"")!==nv){ p.cat=nv; delete p._ca; dd.push(pid); } });
    const keep=new Set(Object.values(made)), rm=D.cats.filter(c=>!c.parent && !keep.has(c.id) && !D.products.some(p=>catIn(p,c.id)) && !catSubs(c.id).length);
    D.cats=D.cats.filter(c=>!rm.includes(c)); if(cd.length) dirtyMany("cats", [...new Set(cd)]); rm.forEach(c=>dirty("cats",c.id,true)); if(dd.length) dirtyMany("products", dd);
    logEv("Справочники","Товары разложены по категориям и подкатегориям: поменяли категорию "+dd.length+(rm.length?", убраны пустые категории: "+rm.map(c=>c.name).join(", "):""));
    CTT=null; skClose(); toast("ok","Готово: категории и подкатегории", dd.length+" "+plural(dd.length,["товар поменял","товара поменяли","товаров поменяли"])+" категорию. Всё сохранится в таблице само."); PDV.cat="all"; catAfter();
  } finally { if(un){ un.paused--; try{ unResync(); }catch(e){} } } }

window.__cats = { guess: catGuess, manage: catManage, auto: catAuto, tree: catTreeGuess, treeOpen: catTreeOpen };
