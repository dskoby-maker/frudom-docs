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
  {id:"c-dried", name:"Сухофрукты и орехи", color:"#a0522d", re:/изюм|курага|чернослив|финик|орех|миндал|кешью|фундук|арахис|семена|шиповник|инжир|сушён|сушен|сухофрукт|компот|цукат|фисташ/},
  {id:"c-groc", name:"Бакалея", color:"#7a6a58", re:/лавров|дрожж|перец обработ|ванил|казеин|какао|цикорий|кофе|чай|сахар|крахмал|рис\b|рис |горох|фасоль|макарон|вермишел|лапш|изделия макарон|мука|крупа|гречк|пшен|овсян|мёд|мед фас|соль|масло|уксус|молоко|сливки|конфет|сушки|печенье|повидло|джем|сухари|крошка|специ|мак /},
  {id:"c-frozen", name:"Замороженная продукция", color:"#2f7fb0", re:/заморож|морожен|пюре|протёрт|протерт/},
  {id:"c-bread", name:"Хлеб и выпечка", color:"#c9a227", re:/хлеб|батон|тарталет|булк|лаваш|выпечк/}
];
/* порядок проверки: сначала самые «узкие» признаки (заморозка, соленья, бакалея), потом сухофрукты и свежее */
const CAT_GUESS_ORDER=["c-frozen","c-pickle","c-bread","c-groc","c-dried","c-green","c-berry","c-fruit","c-veg"];
const CAT_COLORS=["#e0782f","#c2185b","#3f8f4f","#6aa84f","#8e6c2f","#a0522d","#7a6a58","#2f7fb0","#c9a227","#6d4c9f","#00897b","#5d6d7e"];
const catList = () => (D.cats||[]).slice().sort((a,b)=>(+a.order||0)-(+b.order||0)||String(a.name).localeCompare(String(b.name),"ru"));
const catById = id => (D.cats||[]).find(c=>c.id===id) || null;
const catOf = p => p && p.cat ? catById(p.cat) : null;
const catCan = () => !docLimited() && !!curUser();
function catGuess(name){ const n=String(name||"").toLowerCase().replace(/ё/g,"е"), L=D.cats||[];
  /* «Сельдерей (корень)» — овощ, «сельдерей черешковый» — тоже; «лук зелёный» — зелень, не овощ */
  if(/лук\s*(свеж\w*\s*)?зел|зел\w*\s*лук/.test(n)) return L.find(c=>c.id==="c-green")?"c-green":"";
  for(const id of CAT_GUESS_ORDER){ const d=CAT_DEF.find(x=>x.id===id); if(d && d.re.test(n) && L.some(c=>c.id===id)) return id; }
  /* свои категории: название категории встречается в названии товара */
  const own=L.find(c=>!CAT_DEF.some(d=>d.id===c.id) && c.name.length>=4 && n.includes(c.name.toLowerCase().replace(/ё/g,"е").slice(0,5)));
  return own?own.id:""; }
/* стандартные категории — один раз, когда таблица уже знает лист и он пуст */
function catSeed(){ if(!D.catSrv || (D.cats||[]).length || !catCan() || lsGet("frudom-cats-seed")) return;
  D.cats=CAT_DEF.map((d,i)=>({id:d.id, name:d.name, order:String((i+1)*10), color:d.color})); D.cats.forEach(c=>dirty("cats",c.id)); lsSet("frudom-cats-seed","1"); }
const catChip = (c, n, on, attr) => `<button type="button" ${attr} class="catc${on?" on":""}" style="--cc:${esc(c?c.color||"#888":"#9aa19d")}"><i></i>${esc(c?c.name:"Без категории")}${n!=null?` <em>${n}</em>`:""}</button>`;
const catTag = c => c ? `<span class="cattag" style="--cc:${esc(c.color||"#888")}">${esc(c.name)}</span>` : "";
function catOptions(sel, withNone){ return (withNone?`<option value=""${!sel?" selected":""}>— без категории —</option>`:"")+catList().map(c=>`<option value="${esc(c.id)}"${c.id===sel?" selected":""}>${esc(c.name)}</option>`).join(""); }

/* ---------- «Категории…»: создать, переименовать, цвет, порядок, удалить ---------- */
let CATM=null;
function catManage(){ CATM={add:""}; skModal(catManageHtml, false); }
function catManageHtml(){ const L=catList(), cnt=id=>D.products.filter(p=>p.cat===id).length;
  return skHead("Товары","Категории товаров","Свои категории можно добавить, переименовать, перекрасить и поставить в нужном порядке. Удалённая категория просто снимается с товаров — сами товары остаются.","Категории товаров")
   + (!D.catSrv?`<div class="sknoteb">Чтобы категории сохранялись в таблице и были видны всем — обновите Code.gs. Пока они хранятся только на этом устройстве.</div>`:"")
   + `<div class="catm">${L.map((c,i)=>`<div class="catm-r" data-cid="${esc(c.id)}"><input type="color" class="catm-col" value="${esc(c.color||"#888888")}" aria-label="Цвет"><input class="catm-n" data-keep="1" value="${esc(c.name)}" aria-label="Название категории"><span class="muted catm-c">${cnt(c.id)} ${plural(cnt(c.id),["товар","товара","товаров"])}</span>
       <span class="catm-a"><button type="button" class="btn ghost sm" data-catm="up" ${i?"":"disabled"} aria-label="Выше">↑</button><button type="button" class="btn ghost sm" data-catm="down" ${i<L.length-1?"":"disabled"} aria-label="Ниже">↓</button><button type="button" class="btn ghost sm danger" data-catm="del" aria-label="Удалить">×</button></span></div>`).join("")||`<p class="muted">Категорий пока нет.</p>`}</div>
     <div class="catm-add"><input class="catm-new" data-keep="1" value="${esc(CATM.add)}" placeholder="Новая категория, например «Молочная продукция»"><button type="button" class="btn pri" data-catm="add">Добавить</button></div>
     <div class="dc-acts"><button class="btn" data-sk="close">Готово</button></div>`; }
function catMRedraw(f){ if(!SKM || SKM.render!==catManageHtml) return; const d=SKM.d, st=d.scrollTop; d.innerHTML=catManageHtml(); d.scrollTop=st; if(f){ const el=d.querySelector(f); el&&el.focus(); } }
function catAdd(name){ name=skN(name); if(!name) return null; const ex=(D.cats||[]).find(c=>skK(c.name)===skK(name)); if(ex){ toast("info","Такая категория уже есть","«"+ex.name+"»"); return ex; }
  const L=catList(), c={id:"c"+uid(), name, order:String(((L.length?+L[L.length-1].order||0:0))+10), color:CAT_COLORS[(D.cats||[]).length%CAT_COLORS.length]};
  (D.cats=D.cats||[]).push(c); dirty("cats",c.id); logEv("Справочники","Новая категория товаров «"+name+"»"); return c; }
function catAfter(){ try{ if(curTab==="products") renderProducts(); }catch(e){} try{ if(curTab==="stock") skDrawList(); }catch(e){} try{ if(curTab==="customers" && PRV.cid) renderPrices(PRV.cid); }catch(e){} }
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest("[data-catm]"); if(!b || !CATM) return; const a=b.dataset.catm, r=b.closest(".catm-r"), id=r&&r.dataset.cid;
  if(a==="add"){ const inp=SKM.d.querySelector(".catm-new"), c=catAdd(inp.value); if(c){ CATM.add=""; catMRedraw(".catm-new"); catAfter(); toast("ok","Категория добавлена","«"+c.name+"»"); } else inp.focus(); return; }
  if(a==="up"||a==="down"){ const L=catList(), i=L.findIndex(c=>c.id===id), j=a==="up"?i-1:i+1; if(i<0||j<0||j>=L.length) return; const t=L[i]; L[i]=L[j]; L[j]=t; L.forEach((c,k)=>{ const o=String((k+1)*10); if(c.order!==o){ c.order=o; dirty("cats",c.id); } }); catMRedraw(); catAfter(); return; }
  if(a==="del"){ if(!armed(b,"Удалить?")) return; const c=catById(id); if(!c) return; let n=0; D.products.forEach(p=>{ if(p.cat===id){ p.cat=""; dirty("products",p.id); n++; } });
    D.cats=D.cats.filter(x=>x.id!==id); dirty("cats",id,true); logEv("Справочники","Удалена категория «"+c.name+"»"+(n?", снята с товаров: "+n:"")); catMRedraw(); catAfter(); toast("ok","Категория удалена", n?"Снята с "+n+" "+plural(n,["товара","товаров","товаров"])+".":""); } });
document.addEventListener("change", e=>{ const t=e.target; if(!CATM || !t.closest || !t.closest(".catm-r")) return; const c=catById(t.closest(".catm-r").dataset.cid); if(!c) return;
  if(t.classList.contains("catm-col")){ c.color=t.value; dirty("cats",c.id); catAfter(); return; }
  if(t.classList.contains("catm-n")){ const v=skN(t.value); if(!v){ t.value=c.name; return; } if((D.cats||[]).some(x=>x.id!==c.id && skK(x.name)===skK(v))){ toast("err","Такая категория уже есть",""); t.value=c.name; return; } if(v!==c.name){ c.name=v; dirty("cats",c.id); catAfter(); } } });
document.addEventListener("keydown", e=>{ if(e.key==="Enter" && CATM && e.target.classList && e.target.classList.contains("catm-new")){ e.preventDefault(); const b=SKM&&SKM.d.querySelector('[data-catm="add"]'); b&&b.click(); } });

/* ---------- «Разложить по категориям»: предложение для товаров без категории ---------- */
let CATA=null;
function catAuto(){ const L=D.products.filter(p=>!p.cat && p.name), sel={}; L.forEach(p=>{ const g=catGuess(p.name); if(g) sel[p.id]=g; });
  CATA={L, sel}; skModal(catAutoHtml, true); }
function catAutoHtml(){ const A=CATA, groups=catList().map(c=>({c, L:A.L.filter(p=>A.sel[p.id]===c.id)})).filter(g=>g.L.length), rest=A.L.filter(p=>!A.sel[p.id]), n=Object.keys(A.sel).length;
  return skHead("Товары","Разложить по категориям","Сайт подобрал категорию по названию. Проверьте: любую можно поменять в списке справа или выбрать «— без категории —».","Категории товаров")
   + `<div class="cata">${groups.map(g=>`<div class="cata-g"><div class="cata-h">${catChip(g.c, g.L.length, true, "disabled")}</div>${g.L.map(p=>catARow(p)).join("")}</div>`).join("")}
      ${rest.length?`<div class="cata-g"><div class="cata-h">${catChip(null, rest.length, false, "disabled")}<small class="muted">не узнал — выберите сами или оставьте</small></div>${rest.map(p=>catARow(p)).join("")}</div>`:""}</div>
     <div class="mi-bar"><div class="dc-acts"><button class="btn" data-sk="close">Отмена</button><button class="btn pri" data-cata="apply"${n?"":" disabled"}>Применить · ${n} ${plural(n,["товар","товара","товаров"])}</button></div></div>`; }
const catARow = p => `<label class="cata-r"><span>${esc(p.name)}</span><select data-cata-p="${esc(p.id)}">${catOptions(CATA.sel[p.id]||"", true)}</select></label>`;
document.addEventListener("change", e=>{ const t=e.target; if(!CATA || !t.dataset || !t.dataset.cataP) return; if(t.value) CATA.sel[t.dataset.cataP]=t.value; else delete CATA.sel[t.dataset.cataP];
  const b=SKM&&SKM.d.querySelector('[data-cata="apply"]'), n=Object.keys(CATA.sel).length; if(b){ b.disabled=!n; b.textContent="Применить · "+n+" "+plural(n,["товар","товара","товаров"]); } });
document.addEventListener("click", e=>{ const b=e.target.closest && e.target.closest('[data-cata="apply"]'); if(!b || !CATA) return; let n=0;
  Object.entries(CATA.sel).forEach(([pid,c])=>{ const p=prod(pid); if(p && p.id && !p.cat && catById(c)){ p.cat=c; dirty("products",p.id); n++; } });
  logEv("Справочники","Товары разложены по категориям: "+n); CATA=null; skClose(); toast("ok","Категории расставлены", n+" "+plural(n,["товар","товара","товаров"])+"."); catAfter(); });

/* ---------- вкладка «Товары»: поиск, фильтр по категории, колонка «Категория» ---------- */
const PDV={q:"", cat:"all"};
function pdFiltered(){ const q=norm(PDV.q); return D.products.filter(p=>(!q||norm(p.name+" "+(p.code||"")).includes(q)) && (PDV.cat==="all" || (PDV.cat==="none"?!catOf(p):p.cat===PDV.cat))); }
function pdToolbar(){ const box=$("#pd-cats"); if(!box) return; const q=norm(PDV.q), base=D.products.filter(p=>!q||norm(p.name+" "+(p.code||"")).includes(q)), none=base.filter(p=>!catOf(p)).length;
  if(PDV.cat!=="all" && PDV.cat!=="none" && !catById(PDV.cat)) PDV.cat="all";
  box.innerHTML=`<button type="button" data-pdc="all" class="catc all${PDV.cat==="all"?" on":""}">Все <em>${base.length}</em></button>`
    + catList().map(c=>{ const n=base.filter(p=>p.cat===c.id).length; return n||PDV.cat===c.id?catChip(c,n,PDV.cat===c.id,`data-pdc="${esc(c.id)}"`):""; }).join("")
    + (none?catChip(null,none,PDV.cat==="none",'data-pdc="none"'):"");
  const nn=D.products.filter(p=>!p.cat && p.name).length, au=$("#pd-auto"), canA=catCan() && (D.cats||[]).length && nn && D.products.some(p=>!p.cat && catGuess(p.name));
  if(au){ au.hidden=!canA; au.textContent="Разложить по категориям ("+nn+")"; }
  const mg=$("#pd-catm"); if(mg) mg.hidden=!catCan(); }
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
  box.innerHTML=`<button type="button" data-prc="all" class="catc all${!PRV.cat||PRV.cat==="all"?" on":""}">Все</button>`+L.map(c=>{ const n=base.filter(p=>p.cat===c.id).length; return n?catChip(c,n,PRV.cat===c.id,`data-prc="${esc(c.id)}"`):""; }).join("")
    + (base.some(p=>!catOf(p))?catChip(null,base.filter(p=>!catOf(p)).length,PRV.cat==="none",'data-prc="none"'):""); }
const prCatOk = p => !PRV.cat || PRV.cat==="all" || (PRV.cat==="none"?!catOf(p):p.cat===PRV.cat);
/* склад: категория товара склада — по связанной позиции документов, иначе угадываем по названию */
function skCatOf(it){ for(const pid of (it._links||[])){ const c=catOf(prod(pid)); if(c) return c; } const g=catGuess(it.name); return g?catById(g):null; }
function skCatChips(items){ const L=catList(); if(!L.length) return ""; if(!SKV.cat) SKV.cat="all"; const cnt=id=>items.filter(i=>{ const c=skCatOf(i); return id==="none"?!c:c&&c.id===id; }).length;
  return `<div class="catrow">${`<button type="button" data-skc="all" class="catc all${SKV.cat==="all"?" on":""}">Все <em>${items.length}</em></button>`+L.map(c=>{ const n=cnt(c.id); return n?catChip(c,n,SKV.cat===c.id,`data-skc="${esc(c.id)}"`):""; }).join("")+(cnt("none")?catChip(null,cnt("none"),SKV.cat==="none",'data-skc="none"'):"")}</div>`; }
const skCatOk = it => !SKV.cat || SKV.cat==="all" || (SKV.cat==="none" ? !skCatOf(it) : (skCatOf(it)||{}).id===SKV.cat);
window.__cats = { guess: catGuess, manage: catManage, auto: catAuto };
