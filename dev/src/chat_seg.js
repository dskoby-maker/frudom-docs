/* ---------- «Помощник» — встроенный Claude (только Даниил; Code.gs ≥ 38, действие aiChat) ----------
   Claude понимает вопрос и сам просит у сайта данные (инструменты ниже); цифры считает сайт по своим данным
   (журнал, оплаты, закупка, цены, склад, расходы) — Claude их не выдумывает, а пересказывает. */
const AC={open:false, busy:false, msgs:[], view:[], step:"", files:[], use:null, useAt:0};
const AC_KEY = () => "frudom-ac:"+(curUser()||"");
function acLoad(){ try{ const x=JSON.parse(localStorage.getItem(AC_KEY())||"null"); if(x&&Array.isArray(x.view)){ AC.view=x.view.slice(-60); AC.msgs=Array.isArray(x.msgs)?x.msgs:[]; } }catch(e){} }
const acIsQ = m => m && m.role==="user" && (typeof m.content==="string" || (Array.isArray(m.content) && !m.content.some(c=>c.type==="tool_result")));
const acNoFile = c => (c.type==="document"||c.type==="image") ? {type:"text", text:"(здесь был приложен файл"+(c._n?" «"+c._n+"»":"")+" — если он снова нужен, попроси приложить)"} : c;
const acClean = m => Array.isArray(m.content) ? Object.assign({}, m, {content:m.content.map(c=>{ const x=acNoFile(c); if(x!==c) return x; const y=Object.assign({},c); delete y._n; return y; })}) : m;
function acSave(){ try{ localStorage.setItem(AC_KEY(), JSON.stringify({view:AC.view.slice(-60), msgs:AC.msgs.slice(-40).map(acClean)})); }catch(e){} }
const acOk = () => { try{ return typeof MAILAPP!=="undefined" && MAILAPP ? false : !!(me() && me().admin && pass()); }catch(e){ return false; } };

/* ---------- поиск по данным сайта ---------- */
const acTk = s => String(s||"").toLowerCase().replace(/ё/g,"е").split(/[^a-zа-я0-9]+/).filter(w=>w.length>=2);
const acStem = w => w.length>4 ? w.slice(0,4) : w;
function acHit(q, text){ const Q=acTk(q).map(acStem); if(!Q.length) return true; const T=acTk(text).map(acStem); return Q.every(a=>T.some(b=>b===a || (a.length>=3 && b.startsWith(a)))); }
const acD = s => /^\d{4}-\d\d-\d\d$/.test(String(s||"")) ? String(s) : "";
function acCus(q){ if(!q) return null; const qq=String(q).trim(); return D.customers.filter(c=>c.id===qq || String(c.inn||"")===qq || acHit(qq, [c.short||"", c.name||""].join(" "))); }
function acDocs(a){ const from=acD(a.date_from), to=acD(a.date_to), cs=acCus(a.customer), sp=a.supplier?D.suppliers.filter(s=>acHit(a.supplier, [s.name, s.fio].join(" "))):null;
  return D.journal.filter(j=>j.snap && (a.include_archived || !isArch(j)) && (!from || j.date>=from) && (!to || j.date<=to)
    && (!cs || cs.some(c=>c.id===j.customerId)) && (!sp || sp.some(s=>s.id===j.supplierId)) && (!a.number || String(j.number)===String(a.number).replace(/^№\s*/,"")))
    .sort((x,y)=>(y.date||"").localeCompare(x.date||"")); }
function acPoint(j){ const c=j.snap.c||{}, dr=j.snap.dr||{}; return [c.branchLabel||"", dr.ship||""].filter(Boolean).join(" · "); }
function acCtr(j){ const x=ctr(j.snap.dr.contractId); return x ? (typeof ctrNm==="function"?ctrNm(x):x.basis||"") : (j.snap.dr.basis||""); }
const acN = x => Math.round((+x||0)*100)/100;
function acPay(j){ if(!pfLoaded) return undefined; const p=payOf(j); return p.st==="paid" ? "оплачена"+(p.d?" "+p.d:"") : p.st==="part" ? "оплачено "+acN(p.s)+" из "+acN(p.tot) : "не оплачена"; }
async function acProfitReady(){ if(!pfLoaded){ AC.step="Загружаю оплаты и закупку…"; acDraw(); await loadProfit(true); } return pfLoaded; }

/* ---------- «видит весь сайт»: любой раздел данных, текущий экран, справка по сайту, разбор бизнеса ---------- */
const AC_LONG={data:1500, spec:1500, text:1000, note:600, state:1200, lines:1500, branches:1500, contacts:1200, addrs:1200};
function acRow(o){ const r={}; if(!o||typeof o!=="object") return o; for(const k in o){ if(k[0]==="_"||/^(snap|photo|photos|img|html|sig|seal|stamp|sign|pass|token|key)$/i.test(k)) continue; let v=o[k];
    if(v==null||v===""||(Array.isArray(v)&&!v.length)) continue; const lim=AC_LONG[k]||400;
    if(typeof v==="string"){ if(/^data:/.test(v)) continue; if(v.length>lim) v=v.slice(0,lim)+"…"; }
    else if(typeof v==="object"){ let s; try{ s=JSON.stringify(v); }catch(e){ continue; } if(/"data:/.test(s)) s=s.replace(/"data:[^"]*"/g,'"(картинка)"'); if(s==="{}") continue; v=s.length>lim?s.slice(0,lim)+"…":JSON.parse(s); }
    r[k]=v; } return r; }
const acPname = pid => { const p=D.products.find(x=>x.id===pid); return p?p.name:pid; };
async function acStock(){ if(typeof SK_READY==="undefined"||!SK_READY) return null; try{ const S=skD(); if(!S.items||!S.items.length) await skLoad(true); return skD(); }catch(e){ return null; } }
const AC_COLL={
  customers:["Заказчики: реквизиты, адреса, подразделения (ОП), контакты точек, условия приёмки", ()=>D.customers],
  suppliers:["Поставщики — три ИП: реквизиты, банк, ID ЭДО", ()=>D.suppliers],
  products:["Товары (справочник): название, ед., базовая цена, категория, артикул, страна, вес упаковки, другие названия из заявок", ()=>D.products],
  prices:["Цены для заказчиков (прайсы)", ()=>{ const R=[]; for(const c in D.prices||{}) for(const p in D.prices[c]) R.push({customer:cusNm(c)||c, product:acPname(p), price:D.prices[c][p]}); return R; }],
  contracts:["Договоры/контракты: основание, ИП, цена договора, срок, ИКЗ, товары по договору (spec), ссылка", ()=>D.contracts||[]],
  portal_specs:["Сопоставление с Порталом поставщиков: ID спецификации, СТЕ, артикул по заказчику и товару", ()=>{ const R=[]; for(const c in D.specs||{}) for(const p in D.specs[c]) R.push(Object.assign({customer:cusNm(c)||c, product:acPname(p)}, D.specs[c][p])); return R; }],
  day_tasks:["Задачи на день (календарь, для водителя и команды): дата, заказчик, точка, текст, кто прочитал, нужны ли документы", ()=>D.daytasks||[]],
  my_tasks:["Мои личные задачи Даниила (вкладка «Задачи»)", ()=>(getPrefs().tasks||[])],
  invoices:["Отдельные счета на оплату (не накладные)", ()=>D.invoices||[]],
  drafts:["Черновики — незаконченные документы и заявки", ()=>D.drafts||[]],
  other_money:["Прочие расходы, доходы и личные траты", ()=>D.pother||[], 1],
  debts_book:["Книжка долгов «Мне должны / Я должен»", ()=>D.debts||[], 1],
  credits:["Кредиты и кредитные карты (kind loan/card, own Бизнес/Личный, debt — долг сейчас, next/nsum — ближайший платёж; в data: rate, pmt, day, limit, ops — операции pay/extra/spend/cpay/fee с суммой s, процентами pct)", ()=>D.credits||[], 1],
  money_boards:["Доска денег: истории денег (шаги — JSON в data: k=loan взял в долг/in пришли/out потратил/repay вернул долг/give платёж/me себе/lend дал в долг/back мне вернули, done — сделано), заметки", ()=>D.mboard||[], 1],
  purchases_said:["Закупки Саида из сообщений MAX (текст, дата, по каким накладным)", ()=>D.purchases||[], 1],
  purchase_prices:["Закупочные цены (список цен закупки по товарам)", ()=>(D.costs||[]).map(x=>Object.assign({product:acPname(x.productId)}, x)), 1],
  doc_costs:["Себестоимость накладных — закупка по каждой накладной (lines: цены за ед., _pay оплата, _src одной суммой, _bq куплено)", ()=>D.doccosts||[], 1],
  bank:["Поступления из банка (Т-Бизнес и вручную): плательщик, сумма, назначение, статус, на какие накладные разнесено", ()=>(typeof BNK==="function"?BNK().ops:[])||[], 1],
  mail:["Почта: письма (от кого, тема, начало текста, ящик, прочитано, заявка, обработано)", ()=>(typeof ML!=="undefined"?ML.rows:[])||[], 2],
  stock_items:["Склад: товары склада", async()=>((await acStock())||{}).items||[]],
  stock_batches:["Склад: партии (приходы, цена, срок годности, поставщик)", async()=>((await acStock())||{}).batches||[]],
  stock_moves:["Склад: движения (приход, отгрузка, списание…) за 180 дней", async()=>((await acStock())||{}).moves||[]],
  categories:["Категории товаров", ()=>D.cats||[]],
  vendor_prices:["Цены других поставщиков из их прайсов (Роспродукт и др.): поставщик, дата прайса, товар, цена — для сравнения, это не закупка", async()=>{ if(typeof VP!=="undefined" && VP.rows==null){ try{ await vpLoad(true); }catch(e){} } return typeof vpRows==="function"?vpRows():[]; }]
};
function acDay(o){ for(const k of ["date","at","created","updated","d"]){ const v=String(o[k]||""); let m=v.match(/^(\d{4}-\d\d-\d\d)/); if(m) return m[1]; m=v.match(/^(\d\d)\.(\d\d)\.(\d{4})/); if(m) return m[3]+"-"+m[2]+"-"+m[1]; } return ""; }
function acScreen(){ const sq=s=>String(s||"").replace(/[ \t]+/g," ").replace(/\n\s*\n+/g,"\n").trim();
  const tabBtn=document.querySelector('nav.tabs [data-tab="'+curTab+'"]'), sec=document.getElementById("tab-"+curTab);
  const dlg=[...document.querySelectorAll("dialog[open]")].filter(d=>!d.closest("#ac-pan")).pop();
  const o={tab:curTab, tab_title:tabBtn?sq(tabBtn.textContent):undefined, screen_text:sec?sq(sec.innerText).slice(0,6000):undefined, open_window:dlg?sq(dlg.innerText).slice(0,4000):undefined};
  if(curTab==="doc"&&D.draft){ try{ const k=calc(D.draft, makeSnap(D.draft)); o.new_document_form={customer:cusNm(D.draft.customerId)||"", supplier:(sup(D.draft.supplierId)||{}).name||"", number:D.draft.number, date:D.draft.date, sum:acN(k.t.sum), lines:k.lines.slice(0,40).map(l=>({name:l.name, qty:+l.qty||0, unit:l.unit, price:acN(l.price), sum:acN(l.sum)}))}; }catch(e){} }
  return o; }
const AC_HELP=[
 ["Кредиты","«Прибыль» → «Долги» → «Кредиты»: кредит с одинаковым платежом (остаток долга, ставка, платёж, ближайшая дата) и кредитная карта (лимит, долг, минимальный платёж, льготный период). «Заплатил» делит платёж на проценты и долг; у кредита бизнеса проценты сами записываются в «Расходы и доходы» (Банк и кредит), у личного — весь платёж как «Личное». График платежей, досрочное погашение, напоминание за 3 дня в «Сайт нашёл сам» и в утреннем уведомлении."],
 ["Новый документ","Вкладка «Новый документ»: поставщик (ИП), заказчик, подразделение (ОП), договор, номер, дата, адрес. Товар ищется по мере ввода (сначала прайс заказчика), «+ Создать новый товар». Кнопки: «Сохранить в журнал», Счёт / ТОРГ‑12 / УПД (сохраняют и открывают печатную форму), «Одним PDF» — отмеченные документы одним файлом, «Печать». «Умная проверка» переспрашивает необычное количество или цену. Номер — своя серия у каждого договора. Строки можно переставлять за номер."],
 ["Заказ из файла","На «Новом документе»: загрузить заявку (PDF, Word, Excel, текст) — сайт сам найдёт заказчика, дату, товары, адреса; несколько адресов — несколько накладных. Сканы и фото — «Распознать с ИИ». Ненайденные товары — красным, выбрать из подсказок. Можно загрузить несколько файлов сразу. После ИИ — проверить товары, количество, дату, заказчика."],
 ["Заявка","Вкладка «Заявка» — для заказчиков с многими точками (МГУ и др.): таблица точки × товары, на каждую точку своя накладная. Выбор договора задаёт товары и цены. «Сохранить в журнал» или «Сохранить и скачать PDF» (что скачать — галочки Счёт / ТОРГ‑12 / УПД)."],
 ["Журнал","Вкладка «Журнал»: все накладные, фильтры, поиск (и по комментариям), комплекты (накладные одной заявки), Счёт+ТОРГ / Счёт / ТОРГ / УПД, «Изменить», «Ещё» → XML для ЕИС, XML для Портала поставщиков, архив. Значок тележки — закупка заполнена/нет. Нажатие на заказчика — окно накладной с историей правок, комментарием, закупкой, декларациями."],
 ["Календарь и водитель","Вкладка «Календарь»: накладные и задачи по дням, «Маршрут для водителя» (точки, товары, вес), текст для MAX, «Без документов: N» — поставки без накладных. Задачи на день: текст, фото, кто прочитал, галочка «Сделать документы»."],
 ["Заказчики и цены","Вкладка «Заказчики»: реквизиты, подразделения, адреса и контакты точек, договоры (товары по договору, короткое название, ссылка), цены для заказчика, нумерация, акты, «Аналитика покупок» (что и сколько берёт, сравнение с прошлым периодом), сопоставление с Порталом поставщиков (СТЕ)."],
 ["Прибыль","Вкладка «Прибыль» (только Даниил): «Обзор» (выручка, закупка, налог 8%, прибыль, оплачено/ждём, кто сколько должен, товары в минус), «По заказчикам» (по месяцам, оплата у каждой накладной), «Расходы и доходы» (прочие и личные траты, категории, календарь, поиск), «Поступления» (банк), «Долги» (книжка). Все плитки нажимаются и показывают подробности."],
 ["Закупка","Закупка накладной: в окне накладной «Добавить закупку» — цена по товарам, «Куплено фактически», сумма под ценой, «₽/шт», «Бесплатно», «Записать одной суммой», «Вставить сообщение Саида», прочие расходы (телега). Вкладка «Закупка» — «Закупка по накладным» списком/календарём, фильтр «Нужно заполнить», Excel; ниже — разбор сообщений Саида из MAX."],
 ["Банк","«Прибыль» → «Поступления»: платежи из Т-Бизнеса (Скобёлкин, Суховерхова) сами разносятся по накладным по номерам из назначения и сумме; иначе «Подтвердить» / «Выбрать накладные…» / «Это не оплата накладных». Байдаров — «+ Приход вручную». Если в платеже накладные, которых нет на сайте, — «Создать накладные»."],
 ["Склад","Вкладка «Склад»: остатки по партиям, «+ Приход» (по накладной, фото → ИИ), резерв под накладные, «Отгрузить» в окне документа, списание, инвентаризация, возврат, перевзвешивание (шт → кг), история товара, декларации (загрузить, срок, привязка к товарам, скачать одним PDF, печать)."],
 ["Почта","Вкладка «Почта»: ящики frudom.ru@mail.ru и info@frudom.ru, входящие, заявки (сайт сам находит — перепроверять), не обработаны, неважные, спам, свои папки; ответ и пересылка; «Сделать документы» из заявки в письме. Есть отдельное приложение «Почта ФД» с уведомлениями."],
 ["Счета на оплату","Внизу «Нового документа» — «Отдельный счёт на оплату» (например, за месяц по ОП): накладные за период галочками или строки вручную, загрузка по шаблону Excel, оплата по счёту. Это не накладная — не влияет на прибыль и договор."],
 ["Портал поставщиков и ЕИС","Журнал → «Ещё» → «XML для Портала поставщиков» (УПД 5.03; нужны ID спецификации и страна у каждого товара — «Сопоставить с Порталом поставщиков» в «Заказчиках»), на Портале — «Импортировать XML УПД», проверить, подписать. «XML для ЕИС» — для 44-ФЗ (НИИР, НМИЦ), документ о приёмке в ЕИС в день поставки. Дата документа — день отправки, дата отгрузки — из накладной."],
 ["Акты","Карточка заказчика → «Акты»: загрузка актов, папка на Google Диске с актами и письмами — «С печатью и подписью» (ставит сам, место запоминается), «Всё одним PDF». Месячный акт для цирка собирается сам по накладным."],
 ["Товары","Вкладка «Товары»: справочник, категории, артикулы, карточка товара (продажи, закупка, наценка, движение цен), связанные названия (один товар под разными названиями), «Одинаковые товары…», каталог в Excel."],
 ["События","Вкладка «События» (только Даниил): кто что делал — создал/изменил накладную, печать, входы, просмотры, почта, склад; фильтр по людям, действиям, периоду."],
 ["Задачи и Сайт нашёл сам","Вкладка «Задачи»: «Сайт нашёл сам» — долги старше 30 дней, накладные без закупки или в минус, без договора, поставки без документов, остаток договора, реквизиты, склад; и «Мои задачи» Даниила."],
 ["Данные","Вкладка «Данные»: состояние сервисов (таблица, Диск, посредник, банк, почта, ИИ) и «Если что-то сломалось», резервные копии, ИИ (ключи Gemini и Claude, модели, расход), уведомления приложения."],
 ["Цены других поставщиков","Вкладка «Поставщики» → «Цены других поставщиков»: «Скачать шаблон» — Excel-шаблон прайса (поставщик, дата, с НДС или без; Наименование | Ед. | Цена | Категория), заполненный шаблон и любые таблицы Excel сайт читает сам без ИИ; «Загрузить прайс» (Excel, PDF, Word, фото) — сканы и PDF перепишет ИИ, проверьте и нажмите «Сохранить прайс». Новые товары появятся во «Товарах» с пометкой поставщика и цены. Поиск по всем прайсам — кто дешевле. «Загруженные прайсы» → «Открыть прайс» — весь прайс одного поставщика (поиск, разделы, порядок, Excel, «Показать в «Товарах»»). Во «Товарах» переключатель «Мои товары / <поставщик> / Все»: мои отдельно, товары из прайса поставщика — с его ценами. Это цены для сравнения, на закупку и прибыль не влияют."],
 ["Отмена и черновики","Кнопка «Отменить» внизу слева и Ctrl+Z — отмена последних действий на вкладке. Незаконченные документы и заявки сами сохраняются в «Черновики» вверху формы — «Продолжить»."],
 ["Пользователи","Даниил — всё; Наталья (менеджер) — всё, кроме «Прибыли», «Событий», «Задач»; Гриша (водитель) — календарь, документы только по прайсу и количество; Склад — журнал, документы, склад. Все действия видны в «Событиях»."],
 ["Без связи и сохранение","Всё сохраняется на устройстве и уходит в Google Таблицу, когда есть связь. Окно «Эту запись уже изменили» — выбрать «как в таблице» или «мой вариант». «Скрипт таблицы старый» — обновить Code.gs по инструкции."]
];
async function acBizReview(a){ if(!await acProfitReady()) return {error:"не удалось загрузить закупку"};
  const t=todayISO(), m=/^\d{4}-\d\d$/.test(a.month||"")?a.month:t.slice(0,7), y=+m.slice(0,4), mo=+m.slice(5,7);
  const last=new Date(y,mo,0).getDate(), cur=m===t.slice(0,7), dd=cur?+t.slice(8,10):last;
  const pm=new Date(y,mo-2,1), pms=pm.getFullYear()+"-"+String(pm.getMonth()+1).padStart(2,"0"), pdd=Math.min(dd,new Date(pm.getFullYear(),pm.getMonth()+1,0).getDate());
  const inR=(j,ms,d)=>j.date&&j.date.slice(0,7)===ms&&+j.date.slice(8,10)<=d;
  const live=D.journal.filter(j=>j.snap&&!isArch(j)), P={}, R0={rev:0,cost:0,profit:0,docs:0,miss:0}, R1={rev:0,cost:0,profit:0,docs:0,miss:0}, C={}, G={};
  live.forEach(j=>{ const a0=inR(j,m,dd), a1=inR(j,pms,pdd); if(!a0&&!a1) return; let p; try{ p=docProfit(j); }catch(e){ return; } const R=a0?R0:R1;
    R.rev=acN(R.rev+p.rev); R.cost=acN(R.cost+p.cost); R.profit=acN(R.profit+p.profit); R.docs++; if(p.miss) R.miss++;
    const c=C[j.customerId]||(C[j.customerId]={customer:cusNm(j.customerId)||"", rev:0, rev_prev:0, profit:0}); if(a0){ c.rev=acN(c.rev+p.rev); c.profit=acN(c.profit+p.profit); } else c.rev_prev=acN(c.rev_prev+p.rev);
    if(a0) p.lines.forEach(x=>{ const l=x.l, cu=x.cu!=null?x.cu:x.c, g=G[l.name+"|"+l.unit]||(G[l.name+"|"+l.unit]={product:l.name, unit:l.unit, qty:0, rev:0, cost:0, no_cost_qty:0}); g.qty=acN(g.qty+(+l.qty||0)); g.rev=acN(g.rev+(+l.sum||0)); if(cu==null) g.no_cost_qty=acN(g.no_cost_qty+(+l.qty||0)); else g.cost=acN(g.cost+cu*(+l.qty||0)); }); });
  const Gl=Object.values(G).map(g=>Object.assign(g,{margin_pct:g.cost&&g.rev&&!g.no_cost_qty?Math.round((g.rev-g.cost)/g.rev*1000)/10:undefined}));
  const since=d=>{ const x=new Date(t); x.setDate(x.getDate()-d); return x.toISOString().slice(0,10); }, lastBy={};
  live.forEach(j=>{ if(!lastBy[j.customerId]||j.date>lastBy[j.customerId].d) lastBy[j.customerId]={d:j.date, n:0}; if(j.date>=since(90)) lastBy[j.customerId].n++; });
  const quiet=Object.entries(lastBy).filter(([c,x])=>x.d<since(14)&&x.d>=since(120)).map(([c,x])=>({customer:cusNm(c)||"", last_doc:x.d, days:daysSince(x.d)})).sort((a,b)=>a.days-b.days);
  let debt=0, old=0; live.forEach(j=>{ const p=payOf(j); if(p.left>0.005){ debt+=p.left; if(daysSince(j.date)>30) old+=p.left; } });
  return {period:m+" (1–"+dd+")", compare_with:pms+" (1–"+pdd+")", this:R0, previous:R1, by_customer:Object.values(C).sort((a,b)=>b.rev-a.rev),
    top_products:Gl.sort((a,b)=>b.rev-a.rev).slice(0,15), low_margin:Gl.filter(g=>g.margin_pct!=null&&g.margin_pct<12).sort((a,b)=>a.margin_pct-b.margin_pct).slice(0,12),
    customers_quiet_14d:quiet.slice(0,12), unpaid_total:acN(debt), unpaid_older_30d:acN(old),
    note:R0.miss?"у "+R0.miss+" накладных нет закупки — прибыль и наценка завышены":undefined}; }

const AC_TOOLS=[
  {name:"search_docs", description:"Найти накладные (документы) в журнале сайта: по датам, заказчику, товару, поставщику (ИП), номеру. Возвращает накладные со строками (товар, количество, единица, цена, сумма), точку/адрес, договор, оплату и итоги по найденным товарам. Товар и заказчик ищутся по началу слов (картошка = «карт…», помидоры могут называться «томаты» — тогда ищи ещё раз). Даты — ГГГГ-ММ-ДД.",
   input_schema:{type:"object", properties:{date_from:{type:"string"}, date_to:{type:"string"}, customer:{type:"string", description:"название, короткое название или ИНН заказчика"}, product:{type:"string"}, supplier:{type:"string", description:"ИП: Скобёлкин / Суховерхова / Байдаров"}, number:{type:"string"}, include_archived:{type:"boolean"}, limit:{type:"integer", description:"сколько накладных вернуть, по умолчанию 40"}}}},
  {name:"debts", description:"Кто сколько должен по накладным (неоплаченные остатки) — по заказчикам, с возрастом долга и списком накладных. Плюс личная книжка долгов «Мне должны / Я должен».", input_schema:{type:"object", properties:{customer:{type:"string"}}}},
  {name:"prices", description:"Цены на товар: по каким ценам продавали (по накладным, с датой и заказчиком), цены в прайсах заказчиков сейчас, и закупочная цена из закупки накладных.", input_schema:{type:"object", properties:{product:{type:"string"}, customer:{type:"string"}, date_from:{type:"string"}, date_to:{type:"string"}}, required:["product"]}},
  {name:"profit", description:"Выручка, закупка, налог 8%, расходы и прибыль по накладным за период (можно по заказчику), плюс прочие расходы/доходы и личные траты за период.", input_schema:{type:"object", properties:{date_from:{type:"string"}, date_to:{type:"string"}, customer:{type:"string"}}}},
  {name:"expenses", description:"Прочие расходы, доходы и личные траты (раздел «Расходы и доходы»): по датам, виду и тексту.", input_schema:{type:"object", properties:{date_from:{type:"string"}, date_to:{type:"string"}, kind:{type:"string", description:"Расход / Доход / Личное"}, text:{type:"string"}}}},
  {name:"customers", description:"Заказчики: короткое и полное название, ИНН, договоры (основание, ИП, цена договора, срок, сколько уже поставлено), подразделения и адреса.", input_schema:{type:"object", properties:{query:{type:"string"}}}},
  {name:"stock", description:"Остатки на складе: что есть, сколько, в резерве.", input_schema:{type:"object", properties:{product:{type:"string"}}}},
  {name:"make_document", description:"Заполнить накладную(ые) на вкладке «Новый документ» — как «Заказ из файла»: сайт сам подберёт товары заказчика, цены прайса, адрес/подразделение, договор и номер. Даниил проверит и сам нажмёт «Сохранить». Используй, когда просят сделать накладную/документ (например, по приложенной заявке). Несколько адресов или подразделений — передай address у каждого вызова отдельно или columns + qtys.",
   input_schema:{type:"object", properties:{customer:{type:"string", description:"заказчик (как на сайте или ИНН)"}, supplier:{type:"string", description:"ИП, если известен"}, contract:{type:"string", description:"номер договора, если есть в заявке"}, date:{type:"string", description:"дата поставки ГГГГ-ММ-ДД"}, address:{type:"string", description:"адрес доставки или название подразделения"},
     columns:{type:"array", items:{type:"string"}, description:"если в заявке количества по подразделениям/адресам столбцами — их названия"},
     items:{type:"array", items:{type:"object", properties:{name:{type:"string"}, qty:{type:"number"}, unit:{type:"string"}, price:{type:"number", description:"только если цена указана в заявке"}, qtys:{type:"object", description:"количества по columns"}}, required:["name"]}}}, required:["customer","items"]}},
  {name:"remember", description:"Запомнить для Даниила заметку, правило или напоминание (сохраняется между разговорами). date — когда напомнить (ГГГГ-ММ-ДД), если это напоминание.", input_schema:{type:"object", properties:{text:{type:"string"}, date:{type:"string"}}, required:["text"]}},
  {name:"forget", description:"Удалить заметку/напоминание из памяти по id.", input_schema:{type:"object", properties:{id:{type:"string"}}, required:["id"]}},
  {name:"events", description:"Журнал «События» — кто из сотрудников что делал на сайте: создал/изменил/удалил накладную, отправил в архив, печатал, вошёл, правил заказчиков, цены, склад, закупку, почту и т. д. Ищи по датам, человеку (Даниил, Наталья, Гриша — водитель, Склад), действию и тексту (номер накладной, заказчик, товар). Для «кто создал накладную № N» — text: номер. Даты — ГГГГ-ММ-ДД.", input_schema:{type:"object", properties:{date_from:{type:"string"}, date_to:{type:"string"}, who:{type:"string"}, action:{type:"string", description:"вид действия: Документ (создан/изменён/удалён — подробность в тексте), Архив, Печать, Просмотр, Скачивание, Почта, Заявка, Склад, Закупка, Прибыль, Банк, Счета, Товары, Справочники, Задача на день, Вход, Выход, Отмена"}, text:{type:"string"}, limit:{type:"number"}}}},
  {name:"site_data", description:"Любой раздел данных сайта (всё, что есть в Google Таблице и на сайте). Без collection — список разделов с количеством записей. С collection — записи раздела с фильтром по тексту и датам. Накладные — через search_docs, события — через events.", input_schema:{type:"object", properties:{collection:{type:"string", enum:Object.keys(AC_COLL)}, text:{type:"string", description:"слова для поиска по записи"}, date_from:{type:"string"}, date_to:{type:"string"}, limit:{type:"number"}}}},
  {name:"screen", description:"Что сейчас на экране у Даниила: открытая вкладка, её текст, открытое окно (например, накладная), заполняемый «Новый документ». Используй, когда спрашивают «что здесь», «проверь это», «что не так на экране», «объясни эту страницу».", input_schema:{type:"object", properties:{}}},
  {name:"site_help", description:"Справка: как устроен сайт и как в нём что-то сделать (вкладки, кнопки, порядок действий). Без topic — список тем.", input_schema:{type:"object", properties:{topic:{type:"string"}}}},
  {name:"business_review", description:"Разбор бизнеса за месяц для советов: выручка, закупка, прибыль против того же числа прошлого месяца, по заказчикам, топ товаров, товары с низкой наценкой, заказчики, которые давно не заказывали, неоплаченные долги. month — ГГГГ-ММ (по умолчанию текущий).", input_schema:{type:"object", properties:{month:{type:"string"}}}},
  {name:"site_checks", description:"Что сайт сам нашёл: забытое и возможные ошибки (долги старше 30 дней, накладные без закупки или в минус, без договора, поставки без документов, остаток по договорам, склад, реквизиты, товары без единицы). Используй, когда спрашивают «что я забыл», «где ошибки», «что важно сегодня».", input_schema:{type:"object", properties:{}}}
];
/* память помощника — в личных настройках (prefs.acMem: [{id, t, d, at}]) */
const acMem = () => { const m=getPrefs().acMem; return Array.isArray(m)?m:[]; };
function acMemSet(L){ const p=getPrefs(); p.acMem=L.slice(-80); setPrefs(p, true); }
const acDue = () => acMem().filter(x=>x.d && x.d<=todayISO());

/* история правок накладной: кто создал и кто что менял (snap.meta.hist) */
function acHist(j){ const h=((j.snap||{}).meta||{}).hist; if(!Array.isArray(h)||!h.length) return undefined;
  return h.slice(-8).map(x=>({at:x.at, who:x.by||"", what:(x.w||[]).join("; ").slice(0,200)})); }
const AC_RUN={
  async search_docs(a){ const L=acDocs(a), lim=Math.min(+a.limit||40, 120), tot={}; let sum=0, n=0; const out=[];
    for(const j of L){ const k=calc(j.snap.dr, j.snap); let lines=k.lines;
      if(a.product){ lines=lines.filter(l=>acHit(a.product, l.name)); if(!lines.length) continue; }
      n++; lines.forEach(l=>{ const key=l.name+"|"+l.unit, t=tot[key]||(tot[key]={name:l.name, unit:l.unit, qty:0, sum:0, docs:0}); t.qty=acN(t.qty+(+l.qty||0)); t.sum=acN(t.sum+(+l.sum||0)); t.docs++; });
      sum+=a.product ? lines.reduce((s,l)=>s+(+l.sum||0),0) : (+k.t.sum||0);
      if(out.length<lim) out.push({id:j.id, number:j.number, date:j.date, customer_id:j.customerId, customer:cusNm(j.customerId)||j.customerName||"", point:acPoint(j)||undefined, supplier:(sup(j.supplierId)||{}).name||"", contract:acCtr(j)||undefined,
        doc_sum:acN(k.t.sum), payment:acPay(j), archived:isArch(j)||undefined, history:acHist(j), lines:lines.slice(0,40).map(l=>({name:l.name, qty:+l.qty||0, unit:l.unit, price:acN(l.price), sum:acN(l.sum)}))}); }
    const note=[out.length<n?"показаны "+out.length+" из "+n+" — сузь даты или заказчика":"", D.journal.length>=2000?"на устройстве последние 2000 накладных":""].filter(Boolean).join("; ");
    return {found_docs:n, total_sum:acN(sum), product_totals:a.product?Object.values(tot).slice(0,40):undefined, docs:out, note:note||undefined}; },
  async debts(a){ if(!await acProfitReady()) return {error:"не удалось загрузить оплаты"}; const cs=acCus(a.customer), M={};
    D.journal.forEach(j=>{ if(!j.snap||isArch(j)||(cs&&!cs.some(c=>c.id===j.customerId))) return; const p=payOf(j); if(p.left<=0.005) return;
      const m=M[j.customerId]||(M[j.customerId]={customer_id:j.customerId, customer:cusNm(j.customerId)||j.customerName||"", debt:0, docs:[]}); m.debt=acN(m.debt+p.left); m.docs.push({id:j.id, number:j.number, date:j.date, left:acN(p.left), age_days:daysSince(j.date), future:j.date>todayISO()||undefined}); });
    const R=Object.values(M).sort((x,y)=>y.debt-x.debt).map(m=>Object.assign(m,{docs_count:m.docs.length, oldest:m.docs.map(d=>d.date).sort()[0], docs:m.docs.sort((x,y)=>x.date.localeCompare(y.date)).slice(0,30)}));
    const book=(D.debts||[]).filter(x=>!+x.closed && (!a.customer || acHit(a.customer, x.name))).map(x=>({side:x.side, who:x.name, sum:acN(x.sum), paid:acN(x.paid), left:acN((+x.sum||0)-(+x.paid||0)), date:x.date, due:x.due||undefined, note:x.note||undefined}));
    return {total_debt:acN(R.reduce((s,m)=>s+m.debt,0)), customers:R, personal_book:book.length?book:undefined}; },
  async prices(a){ const from=acD(a.date_from), to=acD(a.date_to), cs=acCus(a.customer), sold=[]; const prof=pfLoaded;
    D.journal.filter(j=>j.snap&&!isArch(j)&&(!from||j.date>=from)&&(!to||j.date<=to)&&(!cs||cs.some(c=>c.id===j.customerId))).sort((x,y)=>(y.date||"").localeCompare(x.date||"")).forEach(j=>{ if(sold.length>=80) return;
      const k=calc(j.snap.dr, j.snap), hit=k.lines.filter(l=>acHit(a.product, l.name)); if(!hit.length) return; let dp=null; if(prof){ try{ dp=docProfit(j); }catch(e){} }
      hit.forEach(l=>{ const pl=dp&&dp.lines.find(x=>x.l.pid===l.pid); sold.push({date:j.date, customer:cusNm(j.customerId)||"", doc_id:j.id, number:j.number, name:l.name, unit:l.unit, qty:+l.qty||0, price:acN(l.price), purchase_per_unit:pl&&pl.c!=null?acN(pl.cu!=null?pl.cu:pl.c):undefined}); }); });
    const P=D.products.filter(p=>acHit(a.product, p.name)).slice(0,20), now=[];
    P.forEach(p=>{ (cs||D.customers).forEach(c=>{ const pr=custPrice(c.id,p.id); if(pr!=null&&pr!=="") now.push({customer:cusNm(c.id), product:p.name, unit:p.unit, price:acN(pr)}); }); });
    return {sold:sold, price_lists_now:now.slice(0,60), base_prices:P.map(p=>({product:p.name, unit:p.unit, base_price:p.price?acN(p.price):undefined})), purchase_note:prof?undefined:"закупка не загружена"}; },
  async profit(a){ if(!await acProfitReady()) return {error:"не удалось загрузить закупку"}; const from=acD(a.date_from), to=acD(a.date_to), cs=acCus(a.customer), C={}; let T={rev:0,cost:0,tax:0,exp:0,profit:0,docs:0,no_purchase:0};
    D.journal.forEach(j=>{ if(!j.snap||isArch(j)||(from&&j.date<from)||(to&&j.date>to)||(cs&&!cs.some(c=>c.id===j.customerId))) return; let p; try{ p=docProfit(j); }catch(e){ return; }
      const c=C[j.customerId]||(C[j.customerId]={customer:cusNm(j.customerId)||j.customerName||"", rev:0, cost:0, profit:0, docs:0});
      ["rev","cost","tax","exp","profit"].forEach(k=>T[k]=acN(T[k]+(+p[k]||0))); T.docs++; if(p.miss) T.no_purchase++; c.rev=acN(c.rev+p.rev); c.cost=acN(c.cost+p.cost); c.profit=acN(c.profit+p.profit); c.docs++; });
    const po=(D.pother||[]).filter(x=>(!from||x.date>=from)&&(!to||x.date<=to)), sk=k=>acN(po.filter(x=>x.kind===k).reduce((s,x)=>s+(+x.sum||0),0));
    return {by_docs:T, note:T.no_purchase?"у "+T.no_purchase+" накладных не заполнена закупка — прибыль завышена":undefined, by_customer:Object.values(C).sort((x,y)=>y.rev-x.rev), other_expenses:sk("Расход"), other_income:sk("Доход"), personal:sk("Личное")}; },
  async expenses(a){ await acProfitReady(); const from=acD(a.date_from), to=acD(a.date_to);
    const L=(D.pother||[]).filter(x=>(!from||x.date>=from)&&(!to||x.date<=to)&&(!a.kind||String(x.kind||"").toLowerCase()===String(a.kind).toLowerCase())&&(!a.text||acHit(a.text,[x.note,x.catName,x.kind].join(" ")))).sort((x,y)=>(y.date||"").localeCompare(x.date||""));
    return {count:L.length, total:acN(L.reduce((s,x)=>s+(+x.sum||0),0)), items:L.slice(0,80).map(x=>({date:x.date, kind:x.kind, sum:acN(x.sum), what:x.note||"", category:x.catName||undefined}))}; },
  async customers(a){ const L=a.query?acCus(a.query):D.customers.filter(c=>c.id!=="private-buyer");
    return {customers:L.slice(0,30).map(c=>({id:c.id, short:c.short||undefined, name:c.name, inn:c.inn||undefined, address:c.address||undefined, ship:c.ship||undefined,
      branches:(typeof branches==="function"?branches(c):[]).map(b=>b.label).filter(Boolean),
      contracts:(D.contracts||[]).filter(x=>x.customerId===c.id).map(x=>{ const sh=D.journal.filter(j=>!isArch(j)&&j.snap&&j.snap.dr.contractId===x.id).reduce((s,j)=>s+(+j.sum||0),0);
        return {basis:x.basis, short:x.short||undefined, supplier:(sup(x.supplierId)||{}).name||"", max_sum:x.maxSum?acN(x.maxSum):undefined, until:x.dateTo||undefined, shipped_sum:acN(sh)}; })}))}; },
  async make_document(a){ const cs=acCus(a.customer||"")||[];
    if(!cs.length) return {error:"заказчик «"+(a.customer||"")+"» не найден на сайте — уточни название"}; if(cs.length>1) return {error:"подходят несколько заказчиков — уточни", candidates:cs.map(c=>cusNm(c.id))};
    const c=cs[0], x={customer:c.name, inn:c.inn||"", contract:a.contract||"", supplier:a.supplier||"", date:acD(a.date)||"", address:a.address||"", columns:Array.isArray(a.columns)?a.columns:undefined,
      items:(Array.isArray(a.items)?a.items:[]).filter(i=>i&&i.name).map(i=>({name:i.name, unit:i.unit||"", qty:i.qty, price:i.price, qtys:i.qtys}))};
    if(!x.items.length) return {error:"нет ни одной строки товара"};
    let r; try{ showTab("doc"); IMP={file:"Помощник"}; IMP.r=r=impResolve(ftParse(aiSrc(x))); impShow(); }catch(e){ return {error:String(e.message||e)}; }
    AC.made=1; setTimeout(()=>{ acShow(false); aiWarn(); }, 300);
    return {ok:true, opened:"вкладка «Новый документ» — накладные заполнены, Даниил проверит и нажмёт «Сохранить»", customer:cusNm(c.id), date:r.date||undefined,
      documents:(r.groups||[]).map(g=>({address:g.ship||g.addr||"", lines:(g.items||[]).length, sum:acN(g.sum), not_found:(g.miss||[]).map(l=>l.name), warnings:(g.warn||[]).map(w=>w.m).slice(0,8)})), warnings:(r.warn||[]).map(w=>w.m||w).slice(0,8)}; },
  async remember(a){ const t=String(a.text||"").trim(); if(!t) return {error:"пустая заметка"}; const L=acMem(), x={id:Date.now().toString(36), t:t.slice(0,500), d:acD(a.date)||"", at:todayISO()}; L.push(x); acMemSet(L); return {ok:true, saved:x}; },
  async forget(a){ const L=acMem(), n=L.length, M=L.filter(x=>x.id!==String(a.id)); if(M.length===n) return {error:"нет заметки с таким id"}; acMemSet(M); return {ok:true}; },
  async events(a){
    if(!evCache){ try{ const j=await api({action:"events", limit:3200}); evCache=j.events||[]; }catch(e){ return {error:/unknown action/.test(e.message||"")?"журнал событий недоступен — нужен новый Code.gs":"не загрузился журнал событий: "+(e.message||e)}; } }
    const day=e=>{ const d=evParse(e.at); return d ? d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0") : ""; };
    const low=x=>String(x||"").toLowerCase().replace(/ё/g,"е"), lim=Math.min(+a.limit||60, 200);
    let L=evCache.filter(e=>{ const d=day(e);
      if(a.date_from && d && d<a.date_from) return false; if(a.date_to && d && d>a.date_to) return false;
      if(a.who && !low(e.user).includes(low(a.who))) return false; if(a.action && !low(e.action).includes(low(a.action))) return false;
      if(a.text){ const t=low(e.text); if(!low(a.text).split(/\s+/).filter(Boolean).every(w=>t.includes(w) || (w.length>4 && acHit(w, e.text)))) return false; }
      return true; });
    L=L.slice().sort((x,y)=>(evParse(y.at)||0)-(evParse(x.at)||0));
    return {found:L.length, events:L.slice(0,lim).map(e=>({at:e.at, who:e.user, action:e.action, text:String(e.text||"").slice(0,300)})),
      note:[L.length>lim?"показаны последние "+lim+" из "+L.length+" — сузь даты/человека":"", "в журнале последние "+evCache.length+" событий"].filter(Boolean).join("; ")}; },
  async site_data(a){ if(!a.collection){ const L=[]; for(const k in AC_COLL){ let n; try{ const v=AC_COLL[k][2]?null:await AC_COLL[k][1](); n=v?v.length:"загружается по запросу"; }catch(e){ n="?"; } L.push({collection:k, what:AC_COLL[k][0], count:n}); } return {collections:L}; }
    const C=AC_COLL[a.collection]; if(!C) return {error:"нет такого раздела", collections:Object.keys(AC_COLL)};
    if(C[2]===1) await acProfitReady(); if(C[2]===2 && typeof ML!=="undefined" && !ML.loaded){ try{ AC.step="Загружаю почту…"; acDraw(); await mlLoad(false,true); }catch(e){} }
    if(a.collection==="bank" && typeof BNK==="function" && !BNK().ops.length && typeof bnSync==="function"){ try{ await bnSync(true); }catch(e){} }
    let L; try{ L=(await C[1]())||[]; }catch(e){ return {error:"не загрузилось: "+(e.message||e)}; }
    const from=acD(a.date_from), to=acD(a.date_to), lim=Math.min(+a.limit||30, 100);
    let R=L.filter(o=>{ if(from||to){ const d=acDay(o); if(d&&((from&&d<from)||(to&&d>to))) return false; } if(a.text){ let s=""; try{ s=JSON.stringify(o); }catch(e){} if(!acHit(a.text, s)) return false; } return true; });
    if(R.some(o=>acDay(o))) R=R.slice().sort((x,y)=>acDay(y).localeCompare(acDay(x)));
    return {collection:a.collection, found:R.length, total:L.length, rows:R.slice(0,lim).map(acRow), note:R.length>lim?"показаны "+lim+" из "+R.length+" — уточни текст или даты":undefined}; },
  async screen(){ try{ return acScreen(); }catch(e){ return {error:String(e.message||e)}; } },
  async site_help(a){ if(!a.topic) return {topics:AC_HELP.map(h=>h[0])}; const W=acTk(a.topic), sc=h=>W.reduce((n,w)=>n+(acHit(w,h[0])?3:0)+(acHit(w,h[1])?1:0),0);
    return {help:AC_HELP.map(h=>[sc(h),h]).filter(x=>x[0]>0).sort((x,y)=>y[0]-x[0]).slice(0,4).map(x=>({topic:x[1][0], text:x[1][1]}))}; },
  async business_review(a){ return acBizReview(a); },
  async site_checks(){ let T=[]; try{ T=autoTasks(); }catch(e){ return {error:"не получилось: "+(e.message||e)}; }
    const hid=(getPrefs().tkHide)||{}; T=T.filter(x=>!hid[x.key]); const o={err:0,warn:1,info:2}; T.sort((a,b)=>(o[a.lvl]??3)-(o[b.lvl]??3));
    return {count:T.length, items:T.slice(0,40).map(x=>({level:x.lvl==="err"?"важно":x.lvl==="warn"?"внимание":"к сведению", group:x.g, title:x.title, text:String(x.text||"").replace(/<[^>]+>/g,"").slice(0,300)}))}; },
  async stock(a){ if(typeof SK_READY==="undefined" || !SK_READY) return {error:"склад ещё не загружен — откройте вкладку «Склад» и спросите снова"};
    const X=skIdx(), L=X.S.items.filter(i=>!a.product || acHit(a.product, [i.name, i.alt||""].join(" ")));
    return {items:L.slice(0,60).map(i=>({name:i.name, units:skUnitsOf(i.id).map(u=>({unit:u.unit, on_hand:u.fact, reserved:u.res}))})).filter(i=>!a.product ? i.units.some(u=>u.on_hand>0) : true)}; }
};

function acSystem(){ const d=new Date(), dn=["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][d.getDay()];
  return `Ты — встроенный помощник сайта «Фруктовый Дом · документы» (замена 1С) у Даниила, владельца бизнеса «Фруктовый Дом» (сухофрукты, овощи, фрукты, поставки госзаказчикам и компаниям в Москве). Сегодня ${todayISO()} (${dn}).
Бизнес: три ИП на АУСН без НДС (налог 8% с выручки): Скобёлкин Даниил, Суховерхова Анастасия, Байдаров Ростислав. Закупщик — Саид, водитель — Гриша. Госконтракты всегда без НДС.
Как отвечать:
- Любые цифры (количество, цены, суммы, долги, даты) бери ТОЛЬКО из инструментов. Ничего не выдумывай и не округляй «на глаз». Если данных нет — так и скажи.
- Перед ответом сам вызывай нужные инструменты, можно несколько раз (например, сначала уточнить заказчика, потом искать накладные). Если по названию ничего не нашлось — попробуй другое написание (картошка/картофель, помидоры/томаты, Кинодом/КиноДом).
- Дата без года — ближайшая прошедшая (или сегодняшняя). «12 числа» — 12-е текущего месяца, если оно уже было.
- Отвечай по-русски, коротко и по-человечески: сначала ответ, потом 1–5 строк подробностей. Деньги — «1 234,50 ₽», количество с единицей («85 кг»).
- Накладные называй ссылками ровно в таком виде: [[doc:ID|№ 69 от 12.11]] (ID — поле id из инструмента). Заказчика можно ссылкой [[cus:ID|Цирк]] (ID — customer_id или id).
- Кто что сделал на сайте (кто создал, изменил, удалил, напечатал накладную, кто заходил, что делали Наталья, Гриша, Склад) — смотри инструмент events (журнал «События») и поле history у накладных из search_docs (кто создал и что менял). Пользователи: Даниил (владелец), Наталья (менеджер), Гриша (водитель), Склад.
- Ты видишь весь сайт: site_data — любой раздел (заказчики, товары, цены, договоры, задачи на день, мои задачи, счета, черновики, расходы, долги, закупки Саида, закупочные цены, банк, почта, склад); screen — что сейчас открыто у Даниила на экране; site_help — как пользоваться сайтом (объясняй по шагам: какая вкладка, какая кнопка); business_review — разбор месяца.
- Ты советник по бизнесу: когда уместно (вопрос «как дела», «что улучшить», разбор месяца, прибыль, цены), давай 2–4 конкретных совета по цифрам: где низкая наценка, кто давно не заказывал, какие долги висят, где не заполнена закупка, что растёт или падает по сравнению с прошлым месяцем. Советы — коротко, с цифрами и ссылками на накладные/заказчиков. Без воды.
- Если вопрос неоднозначный (несколько заказчиков с похожим названием) — коротко уточни.
- Ты только читаешь данные: изменить, удалить или создать документ не можешь — подскажи, где это сделать на сайте.
- Данные — те, что загружены на этом устройстве (журнал — последние 2000 накладных).
- Если Даниил прислал файл (заявку, накладную, фото) и просит сделать документ — прочитай файл, уточни заказчика (при сомнении — инструментом customers) и вызови make_document с товарами как в заявке (названия как в заявке, количество, единица; цену — только если она есть в заявке). Потом коротко скажи, что открыл «Новый документ», что не нашлось или вызвало сомнения — и что нужно проверить и нажать «Сохранить».
- Ты помощник: если видишь в данных возможную ошибку (цена не как в прайсе или договоре, повтор накладной, дата не та, долг давно висит, превышение по договору) — коротко скажи об этом, даже если не спрашивали.
- Память: важное, что Даниил просит запомнить (правила, предпочтения, договорённости, напоминания), сохраняй инструментом remember (у напоминания — date). Не запоминай то, что и так есть в данных сайта. Удалить — forget.${acMemTxt()}`; }
function acMemTxt(){ const L=acMem(); if(!L.length) return ""; return "\nТвоя память (заметки Даниила, id в скобках):\n"+L.map(x=>"- ("+x.id+") "+(x.d?"[напомнить "+x.d+"] ":"")+x.t).join("\n"); }

/* ---------- разговор ---------- */
/* перед новым вопросом: прошлые «размышления» Claude (thinking) убираем целиком — они привязаны к неизменной истории,
   а сайт историю сжимает (старые данные, файлы); внутри одного вопроса (цепочка инструментов) они идут без изменений */
function acNoThink(){ AC.msgs.forEach(m=>{ if(m.role==="assistant" && Array.isArray(m.content)){ const c=m.content.filter(x=>x.type!=="thinking" && x.type!=="redacted_thinking"); m.content=c.length?c:[{type:"text", text:"…"}]; } }); }
function acSquash(){ acNoThink(); let q=0; for(let i=AC.msgs.length-1;i>=0;i--){ const m=AC.msgs[i]; if(acIsQ(m)) q++;
    if(m.role==="user" && Array.isArray(m.content)) m.content=m.content.map(c=>{ if(c.type==="tool_result" && String(c.content||"").length>200) return Object.assign({},c,{content:"(старые данные — при необходимости запроси заново)"}); return q>2?acNoFile(c):c; }); } }
function acTrim(){ let n=0; for(let i=AC.msgs.length-1;i>=0;i--){ if(acIsQ(AC.msgs[i])){ n++; if(n>12){ AC.msgs=AC.msgs.slice(i+1); while(AC.msgs.length && !acIsQ(AC.msgs[0])) AC.msgs.shift(); break; } } } }
const AC_STEP={site_data:"Смотрю данные сайта…", screen:"Смотрю экран…", site_help:"Смотрю справку…", business_review:"Разбираю месяц…", events:"Смотрю журнал событий…", search_docs:"Ищу в накладных…", debts:"Считаю долги…", prices:"Смотрю цены…", profit:"Считаю прибыль…", expenses:"Смотрю расходы…", customers:"Смотрю заказчиков…", stock:"Смотрю склад…"};
async function acAsk(text){ text=String(text||"").trim(); const F=AC.files.filter(f=>f.block); if((!text&&!F.length)||AC.busy) return; if(AC.files.some(f=>f.busy)){ toast("info","Подождите","Файл ещё готовится."); return; } if(!online()){ toast("warn","Нет связи","Помощнику нужен интернет."); return; }
  if(!text) text="Посмотри файл.";
  AC.busy=true; acSquash(); AC.view.push({r:"u", t:text, f:F.map(f=>f.name)}); AC.msgs.push({role:"user", content: F.length ? F.map(f=>f.block).concat([{type:"text", text}]) : text}); AC.files=[]; acTrim(); AC.step=F.length?"Читаю файл…":"Думаю…"; acDraw(true);
  try{
    for(let round=0; round<10; round++){
      const send=()=>apiFetch(API_URL,{method:"POST", tmo:120000, body:JSON.stringify({key:pass(), user:curUser(), action:"aiChat", system:acSystem(), tools:JSON.stringify(AC_TOOLS), msgs:JSON.stringify(AC.msgs, (k,v)=>k==="_n"?undefined:v)})});
      let j; try{ j=await send(); }
      catch(e){ if(!/signature|thinking/i.test(e.message||"")) throw e; acNoThink(); j=await send(); }   /* страховка: Claude не принял свои прошлые «размышления» — убираем все и повторяем */
      const content=j.content||[]; AC.msgs.push({role:"assistant", content}); if(j.use){ AC.use=j.use; acUseDraw(); }
      const uses=content.filter(c=>c.type==="tool_use");
      if(j.stop!=="tool_use" || !uses.length){ const t=content.filter(c=>c.type==="text").map(c=>c.text).join("\n").trim(); AC.view.push({r:"a", t:t||"(пустой ответ)"}); break; }
      const res=[]; for(const u of uses){ AC.step=AC_STEP[u.name]||"Ищу…"; acDraw(); let out; try{ const f=AC_RUN[u.name]; out=f ? await f(u.input||{}) : {error:"нет такого инструмента"}; }catch(e){ out={error:String(e.message||e)}; }
        res.push({type:"tool_result", tool_use_id:u.id, content:JSON.stringify(out).slice(0,60000)}); }
      AC.msgs.push({role:"user", content:res});
      if(round===9) AC.view.push({r:"a", t:"Не успел разобраться — уточните вопрос, пожалуйста."});
    }
  }catch(e){ const m=e.message||String(e);
    AC.msgs=AC.msgs.map(acClean);
    const t = m==="unknown action" ? "Скрипт таблицы старый — обновите Code.gs (нужна версия 38), тогда я заработаю." : m==="nokey" ? "Не вставлен ключ Claude: «Данные» → «ИИ» → ключ Claude." : m==="badkey" ? "Ключ Claude не подходит — проверьте его в «Данные» → «ИИ»." : m==="forbidden" ? "Помощник доступен только Даниилу." : "Не получилось: "+m;
    AC.view.push({r:"a", t, err:1});
    while(AC.msgs.length && !acIsQ(AC.msgs[AC.msgs.length-1])) AC.msgs.pop(); AC.msgs.pop(); }
  AC.busy=false; AC.step=""; acSave(); acDraw(true); }

/* ---------- оформление ответа ---------- */
function acMd(t){ let h=esc(t);
  h=h.replace(/\[\[doc:([\w-]+)\|([^\]]+)\]\]/g,(m,id,tx)=>`<button type="button" class="acl" data-acdoc="${id}">${tx}</button>`)
     .replace(/\[\[cus:([\w-]+)\|([^\]]+)\]\]/g,(m,id,tx)=>`<button type="button" class="acl c" data-accus="${id}">${tx}</button>`);
  const L=h.split("\n"), out=[]; let ul=false, tb=null;
  const flush=()=>{ if(ul){ out.push("</ul>"); ul=false; } if(tb){ out.push(`<div class="actw"><table>${tb.map((r,i)=>`<tr>${r.map(c=>i?`<td>${c}</td>`:`<th>${c}</th>`).join("")}</tr>`).join("")}</table></div>`); tb=null; } };
  L.forEach(l=>{ const s=l.trim();
    if(/^\|.*\|$/.test(s)){ if(/^\|[\s:|-]+\|$/.test(s)) return; if(ul){ out.push("</ul>"); ul=false; } (tb=tb||[]).push(s.slice(1,-1).split("|").map(x=>x.trim())); return; }
    if(tb) flush();
    if(/^[-•*]\s+/.test(s)){ if(!ul){ out.push("<ul>"); ul=true; } out.push(`<li>${s.replace(/^[-•*]\s+/,"")}</li>`); return; }
    flush(); if(/^#{1,4}\s+/.test(s)) out.push(`<p class="ach">${s.replace(/^#+\s+/,"")}</p>`); else if(s) out.push(`<p>${s}</p>`); });
  flush(); return out.join("").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>"); }

const AC_IC=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>`;
const AC_SUG=["Кто сколько мне должен?","Куда уходила картошка 12 числа?","Сколько заработали в этом месяце?","По какой цене продавали помидоры Цирку в октябре?","Что Гриша везёт завтра?","Сколько осталось по договорам МОК?"];
function acEl(){ let b=document.getElementById("ac-pan"); if(b) return;
  const st=document.createElement("style"); st.textContent=`
#ac-pan .acrm{margin:0 0 4px;padding:10px 12px;border-radius:12px;background:#fff8e6;border:1px solid #f0dfb0;font-size:14px}#ac-pan .acrm b{display:block;margin-bottom:4px}
#ac-pan .acrm div{display:flex;gap:8px;align-items:flex-start;margin:4px 0}#ac-pan .acrm div span{flex:1}#ac-pan .acrm button{border:1px solid #e6d29c;background:#fff;border-radius:8px;padding:3px 8px;font:inherit;font-size:12.5px;cursor:pointer}
#ac-pan .acchk{border:1px dashed #d8c8d2;background:#fff;border-radius:12px;padding:8px 12px;font:inherit;font-size:13.5px;color:#5b2a4e;cursor:pointer;text-align:left}
#ac-pan .acfs{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px}#ac-pan .acfs:empty{display:none}#ac-pan .acfs span{display:inline-flex;align-items:center;gap:6px;background:#f3e9ef;color:#5b2a4e;border-radius:8px;padding:4px 8px;font-size:13px;max-width:100%}
#ac-pan .acfs span i{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:220px}#ac-pan .acfs span.err{background:#fdecea;color:#a3322a}#ac-pan .acfs button{border:0;background:none;font-size:16px;color:inherit;cursor:pointer;padding:0}
#ac-att{width:44px;height:44px;flex:none;align-self:flex-end;border:1px solid #e0d7dd;border-radius:12px;background:#fff;color:#5b2a4e;cursor:pointer}#ac-att svg{width:20px;height:20px}
#ac-list .am .acfn{display:block;font-size:12.5px;opacity:.85;margin-bottom:4px}#ac-pan[hidden]{display:none}
#ac-pan{font-family:"Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;position:fixed;right:16px;bottom:16px;z-index:61;width:min(440px,calc(100vw - 32px));height:min(680px,calc(100vh - 32px));display:flex;flex-direction:column;background:#fbfaf8;border-radius:18px;box-shadow:0 18px 60px rgba(40,20,40,.3);overflow:hidden;font-size:15px;color:#29232a}
#ac-pan .ach0{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 16px;border-bottom:1px solid #ece6ea;background:#fff}
#ac-pan .ach0 b{font-size:16px;flex:1}#ac-pan .ach0 small{display:block;font-weight:400;color:#8a7f87;font-size:12px;margin-top:2px}
#ac-pan .acx{border:0;background:none;width:34px;height:34px;border-radius:10px;font-size:22px;color:#6c6068;cursor:pointer}#ac-pan .acx:hover{background:#f3eef1}
#ac-pan .acnew{border:1px solid #e3dbe0;background:#fff;border-radius:10px;padding:6px 10px;font:inherit;font-size:13px;color:#5b2a4e;cursor:pointer}
#ac-list{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
#ac-list .am{max-width:88%;padding:10px 13px;border-radius:14px;line-height:1.45;overflow-wrap:anywhere}
#ac-list .am.u{align-self:flex-end;background:#5b2a4e;color:#fff;border-bottom-right-radius:4px;white-space:pre-wrap}
#ac-list .am.a{align-self:flex-start;background:#fff;border:1px solid #ece6ea;border-bottom-left-radius:4px}
#ac-list .am.a.err{border-color:#f0c9c4;background:#fdf3f2}
#ac-list .am p{margin:0 0 6px}#ac-list .am p:last-child{margin:0}#ac-list .am ul{margin:2px 0 6px;padding-left:18px}#ac-list .am li{margin:2px 0}#ac-list .ach{font-weight:700}
#ac-list .actw{overflow-x:auto;margin:4px 0 6px}#ac-list table{border-collapse:collapse;font-size:13px}#ac-list th,#ac-list td{border-bottom:1px solid #eee6ea;padding:4px 8px;text-align:left;white-space:nowrap}#ac-list th{color:#7a6e76;font-weight:600}
#ac-list .acl{border:0;background:#f3e9ef;color:#5b2a4e;border-radius:7px;padding:1px 7px;font:inherit;font-weight:600;cursor:pointer}#ac-list .acl.c{background:#eef2ec;color:#2f5a35}
#ac-list .acstep{align-self:flex-start;color:#8a7f87;font-size:14px;display:flex;align-items:center;gap:8px}
#ac-list .acstep i{width:14px;height:14px;border:2px solid #d9c9d3;border-top-color:#5b2a4e;border-radius:50%;animation:acsp .8s linear infinite}@keyframes acsp{to{transform:rotate(360deg)}}
#ac-list .achello{color:#5d525a;line-height:1.5}#ac-list .acsug{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
#ac-list .acsug button{border:1px solid #e3dbe0;background:#fff;border-radius:16px;padding:7px 12px;font:inherit;font-size:13.5px;color:#4a3f47;cursor:pointer;text-align:left}#ac-list .acsug button:hover{border-color:#5b2a4e}
#ac-pan form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid #ece6ea;background:#fff}
#ac-in{flex:1;resize:none;min-height:42px;max-height:140px;border:1px solid #e0d7dd;border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;line-height:1.35}
#ac-in:focus{outline:none;border-color:#5b2a4e}
#ac-go{width:44px;height:44px;flex:none;align-self:flex-end;border:0;border-radius:12px;background:#5b2a4e;color:#fff;font-size:20px;cursor:pointer}#ac-go:disabled{opacity:.45;cursor:default}
@media (max-width:640px){#ac-pan{right:0;bottom:0;width:100vw;height:100dvh;border-radius:0}}
@media print{#ac-pan{display:none!important}}`;
  document.head.appendChild(st);
  const p=document.createElement("section"); p.id="ac-pan"; p.hidden=true; p.setAttribute("aria-label","Помощник");
  p.innerHTML=`<div class="ach0"><b>Помощник<small id="ac-use">Claude · отвечает по данным сайта</small></b><button type="button" class="acnew" data-acnew>Новый разговор</button><button type="button" class="acx" data-acx aria-label="Закрыть">×</button></div>
    <div id="ac-list"></div><div class="acfs" id="ac-fs"></div><form id="ac-f"><button type="button" id="ac-att" aria-label="Приложить файл" title="Приложить файл: заявку, накладную, фото, Excel, Word"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg></button><input type="file" id="ac-fin" multiple hidden><textarea id="ac-in" rows="1" placeholder="Спросите: куда уходила картошка 12 числа?" autocomplete="off"></textarea><button id="ac-go" type="submit" aria-label="Отправить">➤</button></form>`;
  document.body.appendChild(p);
  const inp=p.querySelector("#ac-in"), grow=()=>{ inp.style.height="auto"; inp.style.height=Math.min(140,inp.scrollHeight)+"px"; };
  inp.addEventListener("input",grow);
  inp.addEventListener("keydown",e=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); p.querySelector("#ac-f").requestSubmit(); } if(e.key==="Escape") acShow(false); });
  p.querySelector("#ac-f").addEventListener("submit",e=>{ e.preventDefault(); const t=inp.value; if((!t.trim()&&!AC.files.length)||AC.busy) return; inp.value=""; grow(); acAsk(t); });
  p.querySelector("#ac-att").onclick=()=>p.querySelector("#ac-fin").click();
  p.querySelector("#ac-fin").onchange=e=>{ [...e.target.files].forEach(acAddFile); e.target.value=""; };
  p.addEventListener("dragover",e=>{ if(e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  p.addEventListener("drop",e=>{ if(!e.dataTransfer||!e.dataTransfer.files.length) return; e.preventDefault(); [...e.dataTransfer.files].forEach(acAddFile); });
  p.addEventListener("paste",e=>{ const F=[...((e.clipboardData||{}).files||[])]; if(F.length){ e.preventDefault(); F.forEach(acAddFile); } });
  p.addEventListener("click",e=>{ const t=e.target.closest("[data-acx],[data-acnew],[data-acdoc],[data-accus],[data-acsug],[data-acfx],[data-acrm],[data-acchk]"); if(!t) return;
    if(t.dataset.acfx!==undefined){ AC.files.splice(+t.dataset.acfx,1); acFilesDraw(); return; }
    if(t.dataset.acrm){ acMemSet(acMem().filter(x=>x.id!==t.dataset.acrm)); acDraw(false); tkfSync(); return; }
    if(t.dataset.acchk!==undefined){ acAsk("Что я забыл и где могут быть ошибки? Кратко, по важности."); return; }
    if(t.dataset.acx!==undefined) acShow(false);
    else if(t.dataset.acnew!==undefined){ if(AC.busy) return; AC.view=[]; AC.msgs=[]; AC.files=[]; acFilesDraw(); acSave(); acDraw(true); inp.focus(); }
    else if(t.dataset.acsug!==undefined) acAsk(t.textContent);
    else if(t.dataset.acdoc){ const j=D.journal.find(x=>x.id===t.dataset.acdoc); if(j) docCard(j, isArch(j)); else toast("warn","Накладной нет на этом устройстве",""); }
    else if(t.dataset.accus){ if(typeof pvLedger==="function"){ acProfitReady().then(()=>pvLedger(t.dataset.accus)); } } });
}
function acShow(on){ acEl(); AC.open=!!on; const p=document.getElementById("ac-pan"); p.hidden=!on; { const f=document.getElementById("tkf-fab"); if(f) f.hidden=on||!tkfOk(); } tkfSync();
  if(on){ if(!AC.view.length) acLoad(); acDraw(true); acFilesDraw(); acUseDraw(); if(Date.now()-AC.useAt>60000){ AC.useAt=Date.now(); apiFetch(API_URL,{method:"POST", body:JSON.stringify({key:pass(), user:curUser(), action:"aiChat", op:"use"})}).then(j=>{ if(j.use){ AC.use=j.use; acUseDraw(); } }).catch(()=>{}); } setTimeout(()=>{ const i=document.getElementById("ac-in"); if(i && matchMedia("(hover:hover)").matches) i.focus(); },50); } }
function acDraw(down){ const box=document.getElementById("ac-list"); if(!box) return;
  const due=acDue(); let h = due.length ? `<div class="acrm"><b>Напоминания</b>${due.map(x=>`<div><span>${esc(x.t)}${x.d<todayISO()?` <small>(${esc(fd(x.d))})</small>`:""}</span><button type="button" data-acrm="${esc(x.id)}">Готово</button></div>`).join("")}</div>` : "";
  if(!AC.view.length) h += `<button type="button" class="acchk" data-acchk>Что я забыл и где могут быть ошибки? — проверить</button>`;
  h += AC.view.length ? "" : `<div class="achello">Здравствуйте! Я знаю ваши накладные, цены, оплаты, закупку, расходы и склад. Спросите своими словами — например:<div class="acsug">${AC_SUG.map(s=>`<button type="button" data-acsug>${esc(s)}</button>`).join("")}</div></div>`;
  h += AC.view.map(m=>m.r==="u" ? `<div class="am u">${(m.f||[]).map(n=>`<span class="acfn">📎 ${esc(n)}</span>`).join("")}${esc(m.t)}</div>` : `<div class="am a${m.err?" err":""}">${acMd(m.t)}</div>`).join("");
  if(AC.busy) h += `<div class="acstep"><i></i>${esc(AC.step||"Думаю…")}</div>`;
  box.innerHTML=h; const go=document.getElementById("ac-go"); if(go) go.disabled=AC.busy; if(down!==false) box.scrollTop=box.scrollHeight; }
/* расход на Claude — в шапке окна */
function acUseDraw(){ const el=document.getElementById("ac-use"); if(!el) return; const u=AC.use; if(!u){ el.textContent="Claude · отвечает по данным сайта"; return; }
  const $$ = v => "$"+(+v||0).toFixed(v>=1?2:3).replace(".",","); const mon=["январь","февраль","март","апрель","май","июнь","июль","август","сентябрь","октябрь","ноябрь","декабрь"][(+String(u.m||"").slice(5,7)||1)-1];
  el.textContent="Потрачено: сегодня "+$$(u.dusd)+" · "+mon+" "+$$(u.usd)+" ("+(u.n||0)+" "+plural(u.n||0,["вопрос","вопроса","вопросов"])+")"; el.title="Цены Anthropic: Sonnet 5.5 — $2 за 1 млн токенов вопроса, $10 — ответа. Всего с начала: $"+(u.all||0); }
/* файлы к вопросу: PDF и фото — как есть, Excel/Word/текст — сайт переводит в текст (как «Распознать с ИИ») */
async function acAddFile(f){ if(AC.files.length>=5){ toast("warn","Не больше 5 файлов",""); return; } const x={name:f.name, busy:1}; AC.files.push(x); acFilesDraw();
  try{ const d=await aiInput(f);
    if(d.text) x.block={type:"text", text:"Файл «"+f.name+"»"+(d.cut?" (начало)":"")+":\n"+d.text, _n:f.name};
    else if(d.mime==="application/pdf"){ if(d.data.length>27e6) throw new Error("PDF больше 20 МБ"); x.block={type:"document", source:{type:"base64", media_type:"application/pdf", data:d.data}, _n:f.name}; }
    else if(/^image\/(jpeg|png|webp|gif)$/.test(d.mime)){ if(d.data.length>6.9e6) throw new Error("фото больше 5 МБ — уменьшите"); x.block={type:"image", source:{type:"base64", media_type:d.mime, data:d.data}, _n:f.name}; }
    else throw new Error(/heic|heif/.test(d.mime)?"фото HEIC Claude не читает — сохраните как JPG":"такой файл помощник не читает");
  }catch(e){ x.err=String(e.message||e); }
  x.busy=0; acFilesDraw(); if(x.err){ toast("warn","Файл «"+f.name+"» не приложен", x.err); AC.files.splice(AC.files.indexOf(x),1); setTimeout(acFilesDraw,2500); } }
function acFilesDraw(){ const b=document.getElementById("ac-fs"); if(!b) return; b.innerHTML=AC.files.map((f,i)=>`<span class="${f.err?"err":""}">📎 <i>${esc(f.name)}</i>${f.busy?" …":""}<button type="button" data-acfx="${i}" aria-label="Убрать">×</button></span>`).join(""); }
/* ===== кнопка «Задачи» справа внизу (вместо прежней кнопки помощника; помощник — вкладка «Помощник» в «Ещё»).
   Только у Даниила. Нажатие — окошко: задачи на сегодня из календаря, «Мои задачи» (галочка — сделано, строка — добавить),
   напоминания помощника на сегодня. Цифра на кнопке — сколько всего открыто на сегодня. ===== */
const TKF={open:false};
const TKF_IC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="17" rx="2.5"/><path d="M8 9.5l1.6 1.6L12.5 8M8 15.5l1.6 1.6 2.9-3.1M15 10h2M15 16h2"/></svg>';
const tkfOk = () => { try{ return typeof MAILAPP!=="undefined" && MAILAPP ? false : !!(me() && me().admin && pass()); }catch(e){ return false; } };
/* в окне — только «Мои задачи» из вкладки «Задачи» (просьба Даниила, 23.11.2026): без задач календаря и напоминаний помощника */
function tkfData(){ const p=tkPrefs(), my=p.tasks.filter(x=>!x.done); return {day:[], my, rem:[], n:my.length}; }
function tkfEl(){ if(document.getElementById("tkf-fab")) return;
  const st=document.createElement("style"); st.textContent=`
#tkf-fab{font-family:"Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;position:fixed;right:16px;bottom:16px;z-index:60;display:flex;align-items:center;gap:6px;height:38px;padding:0 13px 0 11px;border:1px solid rgba(91,42,78,.16);border-radius:19px;background:rgba(255,255,255,.94);color:#5b2a4e;font-weight:600;font-size:13.5px;box-shadow:0 4px 16px rgba(60,20,50,.16);cursor:pointer;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);transition:transform .18s,box-shadow .18s}
#tkf-fab:hover{box-shadow:0 6px 20px rgba(60,20,50,.22)}#tkf-fab:active{transform:scale(.95)}#tkf-fab[hidden],#tkf-pan[hidden]{display:none}
#tkf-fab svg{width:18px;height:18px}#tkf-fab b{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;border-radius:9px;background:#5b2a4e;color:#fff;font-size:11px;line-height:18px;text-align:center;padding:0 5px;box-shadow:0 0 0 2px #fff}
#tkf-fab.on{background:#5b2a4e;color:#fff}#tkf-fab.on b{background:#fff;color:#5b2a4e;box-shadow:0 0 0 2px #5b2a4e}
#tkf-pan{font-family:"Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;position:fixed;right:16px;z-index:61;width:min(360px,calc(100vw - 32px));max-height:min(560px,calc(100vh - 120px));display:flex;flex-direction:column;background:#fff;color:#2b2430;border-radius:18px;box-shadow:0 18px 50px rgba(40,15,35,.22),0 0 0 1px rgba(91,42,78,.08);overflow:hidden;transform-origin:bottom right;animation:tkfIn .2s cubic-bezier(.2,.8,.3,1)}
#tkf-pan.out{animation:tkfOut .14s ease-in forwards}
@keyframes tkfIn{from{opacity:0;transform:translateY(8px) scale(.96)}}@keyframes tkfOut{to{opacity:0;transform:translateY(6px) scale(.97)}}
.tkfh{display:flex;align-items:center;gap:8px;padding:14px 14px 8px 16px}.tkfh b{font-size:16px;flex:1}.tkfh b small{display:block;font-weight:400;font-size:12px;color:#8a7f8c;margin-top:2px}
.tkfh button{border:0;background:none;color:#5b2a4e;font:inherit;font-size:13px;font-weight:600;cursor:pointer;padding:6px 8px;border-radius:8px}.tkfh button:hover{background:#f5eef3}.tkfh .tkfx{font-size:20px;line-height:1;color:#8a7f8c;padding:4px 8px}
.tkfadd{display:flex;gap:6px;padding:0 14px 10px}.tkfadd input{flex:1;min-width:0;width:auto!important;height:38px;border:1px solid #e6dde3;border-radius:10px;padding:0 11px;font:inherit;font-size:14px;background:#fbf9fa}
.tkfadd input:focus{outline:none;border-color:#5b2a4e;background:#fff}.tkfadd button{height:38px;border:0;border-radius:10px;background:#5b2a4e;color:#fff;font:inherit;font-weight:600;font-size:13px;padding:0 13px;cursor:pointer}
.tkfb{overflow:auto;padding:0 8px 10px;overscroll-behavior:contain}.tkfs{font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#9a8f9c;padding:10px 8px 4px;display:flex;justify-content:space-between}
.tkfr{display:flex;align-items:flex-start;gap:10px;padding:8px;border-radius:10px;cursor:pointer;transition:background .15s,opacity .25s}.tkfr:hover{background:#f7f2f5}
.tkfr .tkfd{flex:none;width:8px;height:8px;border-radius:50%;margin:6px 3px 0;background:var(--c,#5b2a4e)}.tkfr span{flex:1;min-width:0;font-size:14px;line-height:1.35;overflow-wrap:anywhere}.tkfr span small{display:block;font-size:12px;color:#8a7f8c;margin-top:1px}
.tkfr input{flex:none;width:18px!important;height:18px;margin:1px 2px 0;accent-color:#5b2a4e;cursor:pointer}.tkfr.gone{opacity:0}.tkfr i{flex:none;color:#b7aab5;font-style:normal;margin-top:1px}
.tkfr button{flex:none;border:1px solid #e6dde3;background:#fff;border-radius:8px;font:inherit;font-size:12px;padding:3px 8px;color:#5b2a4e;cursor:pointer}
.tkfe{padding:18px 10px 14px;text-align:center;color:#8a7f8c;font-size:13.5px}.tkfe b{display:block;color:#2f7d4f;font-size:15px;margin-bottom:3px}
@media (max-width:640px){#tkf-fab{right:12px;width:42px;height:42px;padding:0;justify-content:center;border-radius:21px}#tkf-fab span{display:none}
 #tkf-pan{left:8px;right:8px;width:auto;max-height:min(70vh,560px);border-radius:18px;transform-origin:bottom center}.tkfr{padding:10px 8px}}
@media print{#tkf-fab,#tkf-pan{display:none!important}}`;
  document.head.appendChild(st);
  const b=document.createElement("button"); b.type="button"; b.id="tkf-fab"; b.hidden=true; b.innerHTML=TKF_IC+"<span>Задачи</span>"; b.title="Мои задачи"; b.setAttribute("aria-expanded","false");
  b.onclick=()=>tkfShow(!TKF.open);
  const p=document.createElement("section"); p.id="tkf-pan"; p.hidden=true; p.setAttribute("aria-label","Задачи");
  document.body.appendChild(b); document.body.appendChild(p);
  p.addEventListener("click",e=>{ const t=e.target;
    if(t.closest(".tkfx")){ tkfShow(false); return; }
    if(t.closest("[data-tkfall]")){ tkfShow(false); showTab("tasks"); return; }
    if(t.closest("[data-tkfadd]")){ tkfAdd(); return; }
    const rm=t.closest("[data-tkfrm]"); if(rm){ acMemSet(acMem().filter(x=>x.id!==rm.dataset.tkfrm)); tkfDraw(); tkfSync(); return; }
    if(t.matches("input[type=checkbox]")) return;
    const my=t.closest("[data-tkfmy]"); if(my){ const c=my.querySelector("input"); c.checked=!c.checked; c.dispatchEvent(new Event("change",{bubbles:true})); return; }
    const d=t.closest("[data-tkfday]"); if(d){ tkfShow(false); try{ CAL().sel=isoToday(); }catch(x){} showTab("calendar"); setTimeout(()=>{ const el=document.querySelector(`#dt-list [data-dt="${CSS.escape(d.dataset.tkfday)}"]`)||document.getElementById("dt-list"); if(el) el.scrollIntoView({block:"center",behavior:"smooth"}); },200); } });
  p.addEventListener("change",e=>{ const c=e.target.closest("[data-tkfmy] input"); if(!c) return; const row=c.closest("[data-tkfmy]"), pr=tkPrefs(), x=pr.tasks.find(y=>y.id===row.dataset.tkfmy); if(!x) return;
    x.done=c.checked; if(x.done) x.dd=isoToday(); else delete x.dd; x.u=Date.now(); setPrefs(pr,true); tkfSync(); if(curTab==="tasks") drawTasks();
    if(x.done){ row.classList.add("gone"); toast("ok","Задача выполнена",x.t,{action:{label:"Вернуть", fn:()=>{ const q=tkPrefs(), y=q.tasks.find(z=>z.id===x.id); if(y){ y.done=false; delete y.dd; y.u=Date.now(); setPrefs(q,true); } tkfSync(); if(TKF.open) tkfDraw(); if(curTab==="tasks") drawTasks(); }}}); setTimeout(()=>{ if(TKF.open) tkfDraw(); },280); } });
  p.addEventListener("keydown",e=>{ if(e.key==="Enter" && e.target.id==="tkf-in"){ e.preventDefault(); tkfAdd(); } if(e.key==="Escape"){ e.stopPropagation(); tkfShow(false); b.focus(); } });
  document.addEventListener("pointerdown",e=>{ if(TKF.open && !e.target.closest("#tkf-pan,#tkf-fab,#fd-toasts")) tkfShow(false); }, true);
}
function tkfAdd(){ const inp=document.getElementById("tkf-in"); if(!inp) return; const v=inp.value.trim(); if(!v){ inp.focus(); return; }
  const p=tkPrefs(); p.tasks.unshift({id:uid(), t:v, d:isoToday(), u:Date.now()}); setPrefs(p,true); inp.value=""; tkfDraw(); tkfSync(); if(curTab==="tasks") drawTasks();
  const i2=document.getElementById("tkf-in"); if(i2) i2.focus(); }
function tkfDraw(){ const p=document.getElementById("tkf-pan"); if(!p) return; const D0=tkfData(), keep=document.getElementById("tkf-in"), val=keep?keep.value:"";
  const dt=new Date(), wd=["воскресенье","понедельник","вторник","среда","четверг","пятница","суббота"][dt.getDay()];
  const day=D0.day.map(x=>{ const c=x.customerId?cusNm(x.customerId):(x.customerName||""), hue=(typeof dtHue==="function" && x.customerId)?dtHue(x.customerId):"";
      return `<div class="tkfr" data-tkfday="${esc(x.id)}" role="button" tabindex="0"><i class="tkfd" style="${hue!==""&&hue!=null?`--c:hsl(${hue} 50% 55%)`:"--c:#c9bcc6"}"></i><span>${esc(fmtPlain(x.text||"").slice(0,160))}${c||x.addr?`<small>${esc([c,x.addr].filter(Boolean).join(" · "))}</small>`:""}</span><i aria-hidden="true">›</i></div>`; }).join("");
  const my=D0.my.map(x=>`<label class="tkfr" data-tkfmy="${esc(x.id)}"><input type="checkbox" aria-label="Сделано"><span>${esc(x.t)}<small>добавлено ${esc(fd(x.d))}</small></span></label>`).join("");
  const rem=D0.rem.map(x=>`<div class="tkfr"><i class="tkfd" style="--c:#d9a400"></i><span>${esc(x.t)}</span><button type="button" data-tkfrm="${esc(x.id)}">Готово</button></div>`).join("");
  p.innerHTML=`<div class="tkfh"><b>Мои задачи<small>сегодня, ${dt.getDate()} ${["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"][dt.getMonth()]}, ${wd}</small></b><button type="button" data-tkfall>Все ›</button><button type="button" class="tkfx" aria-label="Закрыть">×</button></div>
    <div class="tkfadd"><input id="tkf-in" placeholder="Новая задача…" maxlength="300" autocomplete="off"><button type="button" data-tkfadd>Добавить</button></div>
    <div class="tkfb">${D0.n ? (day?`<div class="tkfs"><span>В календаре на сегодня</span><span>${D0.day.length}</span></div>${day}`:"")+my+(rem?`<div class="tkfs"><span>Напоминания помощника</span><span>${D0.rem.length}</span></div>${rem}`:"")
      : `<div class="tkfe"><b>✓ Всё сделано</b>Открытых задач нет. Впишите выше, что нужно не забыть.</div>`}</div>`;
  const ni=document.getElementById("tkf-in"); if(ni && val) ni.value=val; }
function tkfShow(on){ tkfEl(); const p=document.getElementById("tkf-pan"), b=document.getElementById("tkf-fab");
  if(on){ TKF.open=true; p.classList.remove("out"); p.hidden=false; tkfDraw(); tkfPlace(); b.classList.add("on"); b.setAttribute("aria-expanded","true");
    if(matchMedia("(hover:hover)").matches) setTimeout(()=>{ const i=document.getElementById("tkf-in"); if(i) i.focus({preventScroll:true}); },60); }
  else if(TKF.open){ TKF.open=false; b.classList.remove("on"); b.setAttribute("aria-expanded","false"); p.classList.add("out"); setTimeout(()=>{ if(!TKF.open){ p.hidden=true; p.classList.remove("out"); } },150); } }
function tkfPlace(){ const f=document.getElementById("tkf-fab"), p=document.getElementById("tkf-pan"); if(!f) return;
  const mb=document.getElementById("mbar"), h=mb && !mb.hidden && getComputedStyle(mb).display!=="none" ? mb.getBoundingClientRect().height : 0;
  const fb=h ? h+12 : 16; f.style.bottom=fb+"px"; if(p) p.style.bottom=(fb+(f.offsetHeight||40)+10)+"px"; }
function tkfSync(){ const f=document.getElementById("tkf-fab"); if(!f) return; let n=0; try{ n=tkfData().n; }catch(e){}
  let b=f.querySelector("b"); if(n){ if(!b){ b=document.createElement("b"); f.appendChild(b); } b.textContent=n>99?"99+":n; } else if(b) b.remove();
  f.title=n?"Мои задачи: "+n:"Мои задачи — всё сделано"; tkfPlace(); }
/* кнопка видна, пока Даниил вошёл и не открыт помощник во весь экран */
setInterval(()=>{ try{ const ok=tkfOk(); if(!ok && !document.getElementById("tkf-fab")) return; tkfEl(); const f=document.getElementById("tkf-fab"), acOpen=typeof AC!=="undefined" && AC.open;
  f.hidden=!ok||acOpen; if((!ok||acOpen) && TKF.open) tkfShow(false); if(ok){ tkfSync(); if(TKF.open && !document.activeElement?.closest?.("#tkf-pan")) tkfDraw(); } }catch(e){} }, 1500);
/* вкладка «Помощник» (в «Ещё» на телефоне, в строке вкладок на ПК) открывает окно помощника, текущая вкладка не меняется */
function acOpenTab(){ if(!acOk()){ toast("warn","Помощник недоступен","Он есть только у Даниила."); return; } tkfShow(false); acShow(true); }
