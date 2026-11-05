/**
 * Хранилище для генератора документов «Фруктовый Дом» (1c.frudom.ru).
 * Данные лежат в этой Google Таблице на листах:
 * Поставщики, Заказчики, Товары, Цены, СТЕ, Контракты, Журнал и др.
 *
 * ПОЛЬЗОВАТЕЛИ И ПАРОЛИ — НЕ ЗДЕСЬ, а в отдельном файле «Пароли» этого же проекта Apps Script
 * (слева «Файлы» → «Пароли.gs»). Поэтому этот файл можно целиком заменять новой версией —
 * пароли не потеряются. Шаблон файла паролей: dev/Passwords.template.gs в GitHub.
 */
const MAX_EVENTS = 3000;   // сколько последних событий хранить на листе «События»

const S = {
  suppliers: { title: 'Поставщики', key: 'id', cols: [
    ['name','Наименование'],['fio','ФИО'],['inn','ИНН'],['kpp','КПП'],['ogrn','ОГРНИП/ОГРН'],['ogrnDate','Дата ОГРНИП'],
    ['address','Адрес'],['phone','Телефон'],['bank','Банк'],['bik','БИК'],['rs','Р/с'],['ks','К/с'],
    ['vat','НДС'],['next','След. номер'],['accountant','Гл. бухгалтер'],['id','ID (не менять)'],['edo','ID участника ЭДО (Диадок)'],['stamp','Печать (картинка, заполняется с сайта)'],['sign','Подпись (картинка, заполняется с сайта)'],['eisLogin','Логин ЕИС подписанта']]},
  customers: { title: 'Заказчики', key: 'id', cols: [
    ['name','Наименование'],['inn','ИНН'],['kpp','КПП'],['address','Юр. адрес'],['ship','Адрес доставки'],
    ['contract','Основание'],['ikz','ИКЗ'],['acct','Тип счёта'],['bank','Банк'],['bik','БИК'],['rs','Р/с / казн. счёт'],['ks','К/с / ЕКС'],
    ['id','ID (не менять)'],['branches','Обособленные подразделения (заполняется с сайта)'],['edo','ID участника ЭДО (Диадок)'],['points','Контакты точек доставки (заполняется с сайта)'],['t12c','Страна в ТОРГ-12 (1 = да)'],['nums','Нумерация: продолжить с № (заполняется с сайта)'],['signs','Подписи поставщика: 3 = во всех графах'],['vat','НДС в документах (10+ = 10% сверху цены)'],['plist','Цены из моего прайса (1 = да)']]},
  products: { title: 'Товары', key: 'id', cols: [
    ['name','Наименование'],['code','Код'],['unit','Ед.'],['country','Страна (код)'],['price','Базовая цена'],['id','ID (не менять)'],['packs','Вес упаковки (заполняется с сайта)'],['aliases','Другие названия в заявках (заполняется с сайта)']]},
  prices: { title: 'Цены', key: null, cols: [
    ['customerName','Заказчик'],['productName','Товар'],['price','Цена'],['customerId','ID заказчика'],['productId','ID товара']]},
  specs: { title: 'СТЕ', key: null, cols: [
    ['customerName','Заказчик'],['productName','Товар'],['spec','ID позиции спецификации (СПГЗ)'],['ste','ID СТЕ'],['art','Артикул оферты'],
    ['customerId','ID заказчика'],['productId','ID товара']]},
  contracts: { title: 'Контракты', key: 'id', cols: [
    ['customerName','Заказчик'],['supplierName','Поставщик (исполнитель)'],['basis','Основание (номер и дата)'],['ikz','ИКЗ'],
    ['maxSum','Цена контракта'],['dateTo','Действует до'],['id','ID (не менять)'],['customerId','ID заказчика'],['supplierId','ID поставщика'],['eis','Сопоставление ЕИС (заполняется с сайта)'],['akt','Шаблон месячного акта (заполняется с сайта)']]},
  costs: { title: 'Закупочные цены', key: 'id', cols: [
    ['productName','Товар'],['price','Закупочная цена'],['from','Действует с'],['customerName','Только для заказчика'],['note','Примечание'],
    ['id','ID (не менять)'],['productId','ID товара'],['customerId','ID заказчика']]},
  doccosts: { title: 'Себестоимость накладных', key: 'id', cols: [
    ['number','№'],['date','Дата'],['customerName','Заказчик'],['expense','Прочие расходы'],['note','Примечание'],
    ['id','ID документа'],['lines','Закупочные цены строк (не редактировать)'],['paid','Оплачено']]},
  psettings: { title: 'Налоги для прибыли', key: 'id', cols: [
    ['name','Поставщик'],['tax','Налог, % от выручки'],['id','ID поставщика']]},
  pother: { title: 'Прочие доходы и расходы', key: 'id', cols: [
    ['date','Дата'],['kind','Тип'],['sum','Сумма'],['note','На что / откуда'],['supplierName','Поставщик'],['id','ID (не менять)'],['supplierId','ID поставщика'],['by','Кто добавил']]},
  purchases: { title: 'Закупки', key: 'id', cols: [
    ['date','Дата закупки'],['points','Точки'],['total','Потрачено'],['status','Статус'],['text','Сообщения закупщика'],['updated','Изменено'],['id','ID (не менять)'],['state','Выбор накладных (не редактировать)']]},
  daytasks: { title: 'Задачи на день', key: 'id', cols: [
    ['date','Дата'],['customerName','Заказчик'],['text','Задача'],['done','Выполнено'],['by','Кто добавил'],['created','Добавлено'],['doneBy','Кто выполнил'],['doneAt','Когда выполнено'],['id','ID'],['customerId','ID заказчика'],['seen','Кто видел'],['addr','Точка доставки']]},
  taskphotos: { title: 'Фото задач', key: 'id', cols: [
    ['taskId','ID задачи'],['by','Кто добавил'],['created','Добавлено'],['file','Файл на Google Диске'],['w','Ширина'],['h','Высота'],['id','ID'],['thumb','Миниатюра (не редактировать)']]},
  uprefs: { title: 'Настройки пользователей', key: 'id', cols: [
    ['id','Пользователь'],['data','Настройки (JSON, не редактировать)'],['updated','Изменено']]},
  events: { title: 'События', key: null, cols: [
    ['at','Время'],['user','Пользователь'],['action','Действие'],['text','Описание'],['docId','ID документа']]},
  /* склад: см. раздел «СКЛАД» ниже. Пишется только действием stock */
  sunits: { title: 'Склад: единицы', key: 'id', cols: [['name','Единица'],['by','Кто добавил'],['at','Когда'],['id','ID (не менять)'],['op','Операция']]},
  sitems: { title: 'Склад: товары', key: 'id', cols: [
    ['name','Товар на складе'],['alt','Другие названия'],['unit','Основная единица'],['note','Комментарий к товару'],['linkNames','Позиции в документах'],['id','ID (не менять)'],['links','ID позиций (не редактировать)'],['by','Кто добавил'],['at','Когда'],['op','Операция'],['def','Брать со склада по умолчанию (s = да)'],['defC','Только для заказчиков (ID)']]},
  sbatches: { title: 'Склад: партии', key: 'id', cols: [
    ['itemName','Товар'],['name','Партия'],['date','Дата приёмки'],['qty','Количество'],['unit','Ед.'],['price','Закупочная цена за ед.'],['supplier','Поставщик'],['docRef','Входящий документ'],['exp','Годен до'],['kind','Вид'],['id','ID (не менять)'],['itemId','ID товара'],['parent','Из партии'],['by','Кто'],['at','Когда'],['op','Операция'],['cancel','Приход отменён']]},
  smoves: { title: 'Склад: движения', key: 'id', cols: [
    ['at','Когда'],['by','Кто'],['typeName','Операция'],['itemName','Товар'],['qty','Количество'],['unit','Ед.'],['cost','Себестоимость за ед.'],['price','Цена продажи за ед.'],['doc','Документ'],['party','Контрагент'],['reason','Причина'],['id','ID (не менять)'],['type','Код операции'],['itemId','ID товара'],['batchId','ID партии'],['docId','ID документа'],['lineId','ID строки'],['op','Операция']]},
  sres: { title: 'Склад: резервы', key: 'id', cols: [
    ['doc','Документ'],['itemName','Товар'],['qty','Количество'],['unit','Ед.'],['id','ID (не менять)'],['docId','ID документа'],['lineId','ID строки'],['itemId','ID товара'],['batchId','ID партии'],['at','Когда'],['op','Операция']]},
  sfiles: { title: 'Склад: декларации', key: 'id', cols: [
    ['name','Файл'],['itemName','Товар'],['batchName','Партия'],['by','Кто'],['at','Когда'],['mime','Тип'],['size','Размер'],['id','ID (не менять)'],['itemId','ID товара'],['batchId','ID партии'],['file','ID файла на Диске'],['op','Операция']]},
  sacts: { title: 'Склад: инвентаризация', key: 'id', cols: [['at','Когда'],['by','Кто'],['diff','Расхождений'],['rows','Строки акта (не редактировать)'],['id','ID (не менять)'],['op','Операция']]},
  slog: { title: 'Склад: история', key: 'id', cols: [
    ['at','Когда'],['by','Кто'],['action','Действие'],['object','Объект'],['before','Было'],['after','Стало'],['reason','Причина'],['id','ID'],['docId','ID документа'],['batchId','ID партии'],['itemId','ID товара'],['op','Операция']]},
  sops: { title: 'Склад: операции (служебный)', key: 'id', cols: [['id','ID запроса'],['at','Когда'],['by','Кто'],['kind','Операция'],['status','Статус'],['data','Данные (не редактировать)']]},
  journal: { title: 'Журнал', key: 'id', cols: [
    ['date','Дата'],['number','Номер'],['supplierName','Поставщик'],['customerName','Заказчик'],['sum','Сумма'],
    ['updated','Изменён'],['id','ID'],['supplierId','ID поставщика'],['customerId','ID заказчика'],['snap','Данные документа (не редактировать)']]}
};

/* ДОСТУП К GOOGLE ДИСКУ (для фото задач и «Моего прайса»).
 * Один раз: вверху выберите функцию «authorize» → «Выполнить» → «Предоставить доступ» → ваш аккаунт →
 * «Дополнительно» → «Перейти к проекту» → «Разрешить». Потом «Развернуть» → «Управление развёртываниями» → карандаш → «Новая версия». */
function authorize() {
  DriveApp.getRootFolder().getName();
  UrlFetchApp.fetch('https://generativelanguage.googleapis.com/', { muteHttpExceptions: true });   // доступ в интернет — для чтения сканов заявок (Gemini)
  const f = photoFolder_();
  Logger.log('Доступ к Диску есть. Папка для фото: ' + f.getName());
  return 'ok';
}

/* скан/фото заявки → Gemini (Google) переписывает её в JSON; товары и цены потом подбирает сам сайт.
   Ключ — в свойствах скрипта GEMINI_KEY (вставляется на сайте админом), в репозитории его нет. */
const AI_PROMPT_ = [
  'Это заявка заказчика на поставку продуктов (скан или фото). Перепиши её в JSON строго по тому, что написано, ничего не придумывай.',
  'Формат: {"customer":"заказчик как написано","inn":"ИНН заказчика или пусто","contract":"номер и дата договора/контракта как написано","request":"номер и дата заявки",',
  '"date":"дата ПОСТАВКИ в виде ДД.ММ.ГГГГ (не дата заявки и не дата договора; если не указана — пусто)","address":"адрес поставки","supplier":"поставщик, если указан",',
  '"columns":["названия колонок количества, если их несколько, например Бюджет, ОМС, Внебюджет; иначе пустой список"],',
  '"items":[{"name":"наименование товара как написано","unit":"единица (кг, шт, уп...)","price":цена за единицу числом или null,',
  '"qty":количество числом (если колонок количества несколько — итого) или null,"qtys":{"название колонки":количество числом} или null,',
  '"qty_text":"количество как написано, если это не число в кг/шт (например 2 кор, 1 уп)","unsure":true если плохо видно, исправлено от руки или сомневаешься}]}',
  'Правила: строку «Итого» не включай; строки с нулевым или пустым количеством не включай; десятичные числа с точкой; если значение исправлено от руки — бери исправленное и ставь unsure:true.'
].join('\n');
function aiRead_(p) {
  const pr = PropertiesService.getScriptProperties(), key = pr.getProperty('GEMINI_KEY');
  if (!key) return { ok: false, error: 'nokey' };
  const mime = String(p.mime || ''), data = String(p.data || '');
  if (!/^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/.test(mime)) return { ok: false, error: 'такой файл ИИ не читает — нужен PDF или фото' };
  if (data.length > 18e6) return { ok: false, error: 'файл больше 13 МБ — для ИИ слишком большой' };
  const body = { contents: [{ parts: [{ inline_data: { mime_type: mime, data: data } }, { text: AI_PROMPT_ }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } };
  const models = [pr.getProperty('GEMINI_MODEL') || 'gemini-flash-latest', 'gemini-3.8-flash']; let last = '';
  for (let i = 0; i < models.length; i++) {
    const r = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + models[i] + ':generateContent',
      { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, payload: JSON.stringify(body), muteHttpExceptions: true });
    const code = r.getResponseCode(), t = r.getContentText();
    if (code === 200) { let j; try { j = JSON.parse(t); } catch (x) { return { ok: false, error: 'Gemini вернул непонятный ответ' }; }
      const txt = ((((j.candidates || [])[0] || {}).content || {}).parts || []).map(x => x.text || '').join('');
      if (!txt) return { ok: false, error: 'Gemini не смог прочитать файл' };
      return { ok: true, text: txt, model: models[i], tokens: (j.usageMetadata || {}).totalTokenCount || 0 }; }
    last = code + ' ' + t.slice(0, 300);
    if (code !== 404) break;
  }
  if (/^429/.test(last)) return { ok: false, error: 'исчерпан бесплатный лимит Gemini на сегодня/минуту — попробуйте позже' };
  if (/^(400|401|403)/.test(last) && /key|API_KEY|permission/i.test(last)) return { ok: false, error: 'badkey' };
  return { ok: false, error: 'Gemini не ответил (' + last.slice(0, 150) + ')' };
}

function doGet(e)  { return out_(handle_(Object.assign({}, e && e.parameter))); }
function doPost(e) { let p = {}; try { p = JSON.parse(e.postData.contents); } catch (x) {} return out_(handle_(p)); }
function out_(o)   { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* кто вошёл: имя + пароль; старые версии страницы присылают только пароль администратора */
function auth_(p) {
  const name = String(p.user || ''), key = String(p.key || '');
  const mk = n => ({ name: n, role: USERS[n].role, admin: USERS[n].role === 'admin', docs: USERS[n].docs === true });
  if (name) { const u = USERS[name]; return (u && key === u.pass) ? mk(name) : null; }
  for (const n in USERS) if (USERS[n].role === 'admin' && key === USERS[n].pass) return mk(n);
  return null;
}

/* сотрудник склада (staff): новый документ — только по ценам прайса; существующий — меняется только количество */
/* staff без docs:true — ограниченный (только цены прайса и количество); staff с docs:true редактирует документы полностью */
function lim_(me) { return me.role === 'staff' && !me.docs; }

function staffOk_(e) {
  let ns; try { ns = JSON.parse(e.snap || '{}'); } catch (x) { return false; }
  if (!ns || !ns.dr) return false;
  const old = read_('journal').find(r => r.id === e.id), nm = ns.meta || {};
  if (old) {
    let os; try { os = JSON.parse(old.snap || '{}'); } catch (x) { return false; }
    const om = os.meta || {}, a = os.dr || {}, b = ns.dr;
    if (String(om.arch || '') !== String(nm.arch || '') || om.batch !== nm.batch) return false;
    if (JSON.stringify(os.s) !== JSON.stringify(ns.s) || JSON.stringify(os.c) !== JSON.stringify(ns.c)) return false;
    if (['supplierId', 'customerId', 'branchId', 'contractId', 'number', 'date', 'basis', 'ship'].some(k => String(a[k] || '') !== String(b[k] || ''))) return false;
    const la = a.lines || [], lb = b.lines || [];
    if (la.length !== lb.length) return false;
    for (let i = 0; i < la.length; i++) if (String(la[i].productId) !== String(lb[i].productId) || String(la[i].name || '') !== String(lb[i].name || '') || Math.abs((+la[i].price || 0) - (+lb[i].price || 0)) > 0.0001) return false;
    return String(old.number) === String(e.number) && String(old.date) === String(e.date);
  }
  if (nm.arch) return false;
  const pm = {}; read_('prices').forEach(r => pm[r.customerId + '|' + r.productId] = +r.price);
  return (ns.dr.lines || []).filter(l => +l.qty > 0).every(l => { const v = pm[ns.dr.customerId + '|' + l.productId]; return v != null && Math.abs(v - (+l.price || 0)) < 0.006; });
}

// Optional private EIS template, filled only in the owner's delivered Code.gs.
// Never commit a real contract template to the public repository.
const EIS_INITIAL = null;
function seedEis_() {
  if (!EIS_INITIAL) return;
  const props=PropertiesService.getScriptProperties();
  if(props.getProperty('eis_initial_v1')) return;
  const c=read_('contracts').find(r=>r.id===EIS_INITIAL.id && r.customerId===EIS_INITIAL.customerId && r.supplierId===EIS_INITIAL.supplierId);
  if(!c) return;
  if(!c.eis)upsertList_('contracts',{upsert:[Object.assign({},c,{eis:JSON.stringify(EIS_INITIAL.config)})]});
  props.setProperty('eis_initial_v1','1');
}
function handle_(p) {
  if (typeof USERS === 'undefined') return { ok: false, error: 'в Apps Script нет файла «Пароли» — создайте его по инструкции (dev/Passwords.template.gs)' };
  const me = auth_(p);
  if (!me) return { ok: false, error: 'auth' };
  if (p.action === 'aiRead') return aiRead_(p);        // без блокировки: ИИ думает до минуты, остальные в это время работают
  if (p.action === 'aiKey') { if (!me.admin) return { ok: false, error: 'forbidden' }; const k = String(p.gkey || '').trim();
    if (!/^[\w\-]{20,}$/.test(k)) return { ok: false, error: 'это не похоже на ключ Gemini' }; PropertiesService.getScriptProperties().setProperty('GEMINI_KEY', k); return { ok: true }; }
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (p.action === 'load' && me.admin) seedEis_();
    if (p.action === 'load') return { ok: true, concurrency: 1, eis: 1, akt: 1, me: me, prefs: (read_('uprefs').find(r => r.id === me.name) || {}).data || '', data: {
      suppliers: me.role === 'staff' ? read_('suppliers').map(s => { const x = Object.assign({}, s); delete x.stamp; delete x.sign; return x; }) : read_('suppliers'), customers: read_('customers'), products: read_('products'),
      prices: read_('prices'), specs: read_('specs'), contracts: read_('contracts'), journal: read_('journal').slice(-2000),
      daytasks: (function () { const d = new Date(); d.setDate(d.getDate() - 120); const from = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const ph = {}; photosClean_().forEach(r => (ph[r.taskId] = ph[r.taskId] || []).push({ id: r.id, by: r.by, w: +r.w || 0, h: +r.h || 0 }));
        return read_('daytasks').filter(r => String(r.date) >= from).map(r => { if (ph[r.id]) r.photos = ph[r.id]; return r; }); })() } };
    if (p.action === 'customerAnalytics') {
      if (me.role === 'staff') return { ok: false, error: 'forbidden' };
      const cid = String(p.customerId || ''), from = String(p.from || ''), to = String(p.to || '');
      const date = /^(?:\d{4}-\d{2}-\d{2}|0000|9999)$/;
      if (!cid || !date.test(from) || !date.test(to) || from > to) return { ok: false, error: 'invalid period' };
      const documents = [];
      read_('journal').forEach(row => {
        if (row.customerId !== cid || !row.date || row.date < from || row.date > to) return;
        let snap;
        try { snap = JSON.parse(row.snap); } catch (e) { return; }
        if (!snap || (snap.meta && snap.meta.arch) || !snap.dr || !Array.isArray(snap.dr.lines)) return;
        const lines = snap.dr.lines.map(l => ({productId:l.productId, qty:l.qty, name:l.name, price:l.price}));
        const prods = Object.create(null);
        Object.keys(snap.prods || {}).forEach(id => {
          const item = snap.prods[id];
          if (item) prods[id] = {name:item.name, unit:item.unit};
        });
        documents.push({date: row.date, number: row.number, sum: row.sum, snap:{dr:{lines, ship: snap.dr.ship || ''}, prods}});
      });
      return { ok: true, documents };
    }
    if (p.action === 'login')   { log_(me, [{ action: 'Вход', text: 'Вход в систему' + (p.device ? ' (' + String(p.device).slice(0, 60) + ')' : '') }]); return { ok: true, me: me }; }
    if (p.action === 'profit')  { if (!me.admin) return { ok: false, error: 'forbidden' }; return { ok: true, costs: read_('costs'), doccosts: read_('doccosts'), psettings: read_('psettings'), purchases: read_('purchases'), pother: read_('pother') }; }
    if (p.action === 'setPrefs') { upsertList_('uprefs', { upsert: [{ id: me.name, data: String(p.data || '').slice(0, 20000), updated: new Date().toISOString() }] }); return { ok: true }; }
    if (p.action === 'events')  { if (!me.admin) return { ok: false, error: 'forbidden' }; return { ok: true, events: readEvents_(+p.limit || 1000) }; }
    if (p.action === 'sync') { const g = guardChanges_(p.changes, p.base, p.protocol, me); if (g.error) return g; syncIn_(g.changes, me); return { ok: true, concurrency: 1, accepted: syncState_(g.changes, me) }; }
    if (p.action === 'plist')    { if (me.role === 'staff') return { ok: false, error: 'forbidden' }; return plist_(p, me); }
    if (p.action === 'stock') return stock_(p, me);
    if (p.action === 'addPhoto') return addPhoto_(p, me);
    if (p.action === 'photo')    { const r = read_('taskphotos').find(x => x.id === String(p.id)); if (!r) return { ok: false, error: 'фото не найдено' };
      const b = DriveApp.getFileById(r.file).getBlob(); return { ok: true, data: 'data:' + (b.getContentType() || 'image/jpeg') + ';base64,' + Utilities.base64Encode(b.getBytes()) }; }
    if (p.action === 'thumbs')   { const want = {}; (p.ids || []).slice(0, 200).forEach(id => want[id] = 1); const t = {}; read_('taskphotos').forEach(r => { if (want[r.id]) t[r.id] = r.thumb; }); return { ok: true, thumbs: t }; }
    if (p.action === 'delPhoto') { const rows = read_('taskphotos'), r = rows.find(x => x.id === String(p.id)); if (!r) return { ok: true };
      if (me.role === 'staff' && r.by !== me.name) return { ok: false, error: 'forbidden' };
      try { DriveApp.getFileById(r.file).setTrashed(true); } catch (x) {}
      write_('taskphotos', rows.filter(x => x.id !== r.id)); log_(me, [{ action: 'Задача на день', text: 'Удалено фото из задачи' }]); return { ok: true }; }
    if (p.action === 'saveDoc') {
      const all = JSON.parse(JSON.stringify(p.changes || {}));
      all.journal = all.journal || { upsert: [], del: [] };
      all.journal.upsert = (all.journal.upsert || []).filter(x => x.id !== (p.entry || {}).id).concat([p.entry || {}]);
      const g = guardChanges_(all, p.base, p.protocol, me); if (g.error) return g;
      const entry = g.changes.journal.upsert.find(x => x.id === p.entry.id);
      if (lim_(me) && !staffOk_(entry)) return { ok: false, error: 'forbidden' };
      // Check everything before the first write. Number conflicts must not acknowledge unsaved changes.
      const rows = read_('journal');
      const clash = rows.some(r => { let sn = {}; try { sn = JSON.parse(r.snap || '{}'); } catch(x) {}
        return r.id !== entry.id && r.supplierId === entry.supplierId && r.customerId === entry.customerId && String(r.number) === String(entry.number) && !(sn.meta && sn.meta.arch); });
      if (clash) return { ok: true, concurrency: 1, conflict: true, next: rows.filter(r => r.supplierId === entry.supplierId && r.customerId === entry.customerId).reduce((n,r) => Math.max(n,parseInt(r.number,10)||0),0)+1 };
      g.changes.journal.upsert = g.changes.journal.upsert.filter(x => x.id !== entry.id);
      syncIn_(g.changes, me);
      const r = saveDoc_(entry, me); r.synced = !!p.changes; r.concurrency = 1;
      g.changes.journal.upsert.push(entry); r.accepted = syncState_(g.changes, me); return r;
    }
    return { ok: false, error: 'unknown action' };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function syncIn_(ch, me) { ch = ch || {};
  if (lim_(me)) { const j = ch.journal ? { upsert: (ch.journal.upsert || []).filter(staffOk_), del: [] } : null;
    let dt = ch.daytasks || null; if (dt) { const own = {}; read_('daytasks').forEach(r => { if (r.by === me.name) own[r.id] = 1; }); dt = { upsert: dt.upsert || [], del: (dt.del || []).filter(id => own[id]) }; }
    ch = { journal: j, events: ch.events, daytasks: dt }; if (!j) delete ch.journal; if (!dt) delete ch.daytasks; }
  applySync_(ch, me); if (Array.isArray(ch.events)) log_(me, ch.events);
}

/* ускорение: каждый лист читаем один раз за запрос; заголовки проверяем, только когда поменялась версия скрипта */
const MEMO_ = {}, SH_ = {};
function sheet_(t) {
  if (SH_[t]) return SH_[t];
  const ss = SpreadsheetApp.getActive(), want = S[t].cols.map(c => c[1]), pr = PropertiesService.getScriptProperties(), pk = 'hdr_' + t, sig = want.join('|');
  let sh = ss.getSheetByName(S[t].title);
  if (sh && pr.getProperty(pk) === sig) return SH_[t] = sh;
  sh = sheet0_(t); pr.setProperty(pk, sig); return SH_[t] = sh;
}
function sheet0_(t) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(S[t].title);
  if (!sh) {
    sh = ss.insertSheet(S[t].title);
    sh.getRange(1, 1, sh.getMaxRows(), S[t].cols.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, S[t].cols.length).setValues([S[t].cols.map(c => c[1])]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else {
    const head = sh.getRange(1, 1, 1, S[t].cols.length);
    const want = S[t].cols.map(c => c[1]);
    if (head.getDisplayValues()[0].join('|') !== want.join('|')) {
      sh.getRange(1, 1, sh.getMaxRows(), S[t].cols.length).setNumberFormat('@');
      head.setValues([want]).setFontWeight('bold');
    }
  }
  return sh;
}

function read_(t) {
  if (MEMO_[t]) return MEMO_[t].map(o => Object.assign({}, o));
  const sh = sheet_(t), n = sh.getLastRow(), cols = S[t].cols;
  if (n < 2) { MEMO_[t] = []; return []; }
  MEMO_[t] = sh.getRange(2, 1, n - 1, cols.length).getDisplayValues()
    .map(r => { const o = {}; cols.forEach((c, i) => o[c[0]] = r[i]); return o; })
    .filter(o => (t === 'prices' || t === 'specs') ? (o.customerId && o.productId) : o.id);
  return MEMO_[t].map(o => Object.assign({}, o));
}

function write_(t, rows) {
  delete MEMO_[t];
  const sh = sheet_(t), n = sh.getLastRow(), cols = S[t].cols;
  if (rows.length) { const rng = sh.getRange(2, 1, rows.length, cols.length); rng.setNumberFormat('@');
    rng.setValues(rows.map(o => cols.map(c => o[c[0]] == null ? '' : String(o[c[0]])))); }
  if (n - 1 > rows.length) sh.getRange(rows.length + 2, 1, n - 1 - rows.length, cols.length).clearContent();   /* лишние старые строки снизу */
}

function mergeSeen_(a, b) {
  const p = v => { try { const o = JSON.parse(v || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const A = p(a), B = p(b); Object.keys(B).forEach(k => { if (!A[k] || String(B[k]) < String(A[k])) A[k] = B[k]; });
  return Object.keys(A).length ? JSON.stringify(A) : '';
}

/* ---------- фото к задачам: сами снимки лежат в папке на Google Диске владельца таблицы, в таблице — только миниатюры ---------- */
function photoFolder_() {
  const pr = PropertiesService.getScriptProperties(), id = pr.getProperty('photoFolder');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (x) {} }
  const f = DriveApp.createFolder('Документы ФД — фото задач'); pr.setProperty('photoFolder', f.getId()); return f;
}
function addPhoto_(p, me) {
  const data = String(p.data || ''), thumb = String(p.thumb || '');
  if (!p.taskId || !data || data.length > 9000000 || thumb.length > 45000 || !/^data:image\//.test(thumb)) return { ok: false, error: 'неверное фото' };
  const id = 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const blob = Utilities.newBlob(Utilities.base64Decode(data), 'image/jpeg', String(p.taskId) + '_' + id + '.jpg');
  const file = photoFolder_().createFile(blob);
  const rows = read_('taskphotos'); rows.push({ taskId: String(p.taskId), by: me.name, created: new Date().toISOString(), file: file.getId(), w: String(+p.w || 0), h: String(+p.h || 0), id: id, thumb: thumb });
  write_('taskphotos', rows);
  const t = read_('daytasks').find(x => x.id === String(p.taskId));
  log_(me, [{ action: 'Задача на день', text: 'Добавлено фото к задаче' + (t ? ': ' + String(t.text).slice(0, 120) : '') }]);
  return { ok: true, id: id };
}
/* фото, у которых задачу удалили (или не дописали) больше 3 дней назад, убираем в корзину Диска */
function photosClean_() {
  const rows = read_('taskphotos'); if (!rows.length) return rows;
  const pr = PropertiesService.getScriptProperties(), today = new Date().toISOString().slice(0, 10);
  if (pr.getProperty('photosCleaned') === today) return rows; pr.setProperty('photosCleaned', today);
  const tasks = {}; read_('daytasks').forEach(r => tasks[r.id] = 1);
  const old = Date.now() - 3 * 86400000, keep = [], gone = [];
  rows.forEach(r => (tasks[r.taskId] || !(new Date(r.created).getTime() < old) ? keep : gone).push(r));
  if (gone.length) { gone.forEach(r => { try { DriveApp.getFileById(r.file).setTrashed(true); } catch (x) {} }); write_('taskphotos', keep); }
  return keep;
}

/* «Мой прайс»: файл на Google Диске владельца (Excel или Google Таблица). Сайт берёт из него цены для выбранных заказчиков */
const PLIST_DEFAULT = '1u-vIEVcVgk69ttd48kn3yzI-cA5pJn4b';
function plist_(p, me) {
  const pr = PropertiesService.getScriptProperties();
  if (p.link) { const m = String(p.link).match(/[-\w]{25,}/); if (!m) return { ok: false, error: 'не похоже на ссылку на файл Google Диска' };
    pr.setProperty('plistFile', m[0]); log_(me, [{ action: 'Справочники', text: 'Изменена ссылка на мой прайс' }]); }
  const id = pr.getProperty('plistFile') || PLIST_DEFAULT;
  let f; try { f = DriveApp.getFileById(id); } catch (x) { return { ok: false, error: /permission|разрешени|authoriz/i.test(String(x)) ? 'нет доступа к Google Диску — в Apps Script выполните функцию authorize' : 'файл прайса не открывается — проверьте ссылку' }; }
  const r = { ok: true, id: id, name: f.getName(), modified: f.getLastUpdated().toISOString() };
  if (p.since && p.since === r.modified) return r;
  if (f.getMimeType() === 'application/vnd.google-apps.spreadsheet') r.rows = SpreadsheetApp.openById(id).getSheets()[0].getDataRange().getValues().map(x => x.slice(0, 6));
  else r.data = Utilities.base64Encode(f.getBlob().getBytes());
  return r;
}

function nameMap_(t) { const m = {}; read_(t).forEach(o => m[o.id] = o.name); return m; }

function upsertList_(t, ch) {
  const res = { added: [], changed: [], removed: [] };
  if (!ch) return res;
  const rows = read_(t), idx = {}, cols = S[t].cols.map(c => c[0]);
  rows.forEach((r, i) => idx[r.id] = i);
  (ch.upsert || []).forEach(o => {
    if (idx[o.id] != null) {
      const old = rows[idx[o.id]], diff = cols.filter(k => k !== 'next' && o[k] != null && String(o[k]) !== String(old[k] == null ? '' : old[k]));
      if (diff.length) res.changed.push(o);
      rows[idx[o.id]] = Object.assign(old, o);
    } else { idx[o.id] = rows.length; rows.push(o); res.added.push(o); }
  });
  const del = {}; (ch.del || []).forEach(id => del[id] = 1);
  rows.forEach(r => { if (del[r.id]) res.removed.push(r); });
  write_(t, rows.filter(r => !del[r.id]));
  return res;
}

function applySync_(ch, me) {
  const ev = [], WHAT = { suppliers: ['поставщик', 'поставщиков'], customers: ['заказчик', 'заказчиков'], products: ['товар', 'товаров'], contracts: ['контракт', 'контрактов'] };
  const say = (t, r) => {
    const nm = o => o.name || o.basis || '(без названия)', w = WHAT[t];
    [['added', 'Добавлен', 'Добавлено'], ['changed', 'Изменён', 'Изменено'], ['removed', 'Удалён', 'Удалено']].forEach(([k, one, many]) => {
      const L = r[k]; if (!L.length) return;
      ev.push({ action: 'Справочники', text: L.length <= 3 ? L.map(o => one + ' ' + w[0] + ' «' + nm(o) + '»').join('; ') : many + ' ' + w[1] + ': ' + L.length });
    });
  };
  ['suppliers', 'customers', 'products'].forEach(t => say(t, upsertList_(t, ch[t])));
  if (ch.prices) {
    const cn0 = nameMap_('customers'), per = {};
    (ch.prices.upsert || []).concat(ch.prices.del || []).forEach(o => per[o.customerId] = (per[o.customerId] || 0) + 1);
    Object.keys(per).forEach(c => ev.push({ action: 'Справочники', text: 'Цены заказчика «' + (cn0[c] || c) + '»: изменено позиций — ' + per[c] }));
  }
  if (ch.prices) {
    const cn = nameMap_('customers'), pn = nameMap_('products'), map = {}, order = [];
    read_('prices').forEach(r => { const k = r.customerId + '|' + r.productId; map[k] = r; order.push(k); });
    (ch.prices.upsert || []).forEach(o => { const k = o.customerId + '|' + o.productId; if (!map[k]) order.push(k); map[k] = o; });
    (ch.prices.del || []).forEach(o => { delete map[o.customerId + '|' + o.productId]; });
    const ids = {}; read_('products').forEach(p => ids[p.id] = 1);
    const cids = {}; read_('customers').forEach(c => cids[c.id] = 1);
    write_('prices', order.filter((k, i) => map[k] && order.indexOf(k) === i && ids[map[k].productId] && cids[map[k].customerId])
      .map(k => Object.assign(map[k], { customerName: cn[map[k].customerId] || '', productName: pn[map[k].productId] || '' })));
  }
  if (ch.specs) {
    const cn = nameMap_('customers'), pn = nameMap_('products'), map = {}, order = [];
    read_('specs').forEach(r => { const k = r.customerId + '|' + r.productId; if (!map[k]) order.push(k); map[k] = r; });
    (ch.specs.upsert || []).forEach(o => { const k = o.customerId + '|' + o.productId; if (!map[k]) order.push(k); map[k] = o; });
    (ch.specs.del || []).forEach(o => { delete map[o.customerId + '|' + o.productId]; });
    write_('specs', order.filter(k => map[k] && pn[map[k].productId] != null && cn[map[k].customerId] != null)
      .map(k => Object.assign(map[k], { customerName: cn[map[k].customerId] || '', productName: pn[map[k].productId] || '' })));
  }
  if (ch.contracts) {
    const sn = nameMap_('suppliers'), cn = nameMap_('customers');
    (ch.contracts.upsert || []).forEach(o => { o.supplierName = sn[o.supplierId] || 'любой'; o.customerName = cn[o.customerId] || ''; });
    say('contracts', upsertList_('contracts', ch.contracts));
  }
  if (ch.journal) {
    const sn = nameMap_('suppliers'), cn = nameMap_('customers');
    (ch.journal.upsert || []).forEach(o => { o.supplierName = sn[o.supplierId] || ''; o.customerName = cn[o.customerId] || ''; });
    upsertList_('journal', ch.journal);
    stAfterDocs_((ch.journal.upsert || []).map(o => o.id).concat(ch.journal.del || []), me);   /* резерв склада по сохранённым накладным */
  }
  if (ch.daytasks) {
    const cn = nameMap_('customers'), was = {}; read_('daytasks').forEach(r => was[r.id] = r);
    (ch.daytasks.upsert || []).forEach(o => { o.customerName = o.customerId ? (cn[o.customerId] || '') : '';
      /* «кто видел» складываем с тем, что уже в таблице (двое могли открыть задачу одновременно); если текст поменяли — отметки начинаются заново */
      const r = was[o.id]; if (r && String(r.text) === String(o.text == null ? r.text : o.text)) o.seen = mergeSeen_(r.seen, o.seen); });
    upsertList_('daytasks', ch.daytasks);
  }
  /* данные о прибыли меняет только администратор */
  if (me && me.admin) {
    if (ch.costs) {
      const pn = nameMap_('products'), cn = nameMap_('customers');
      (ch.costs.upsert || []).forEach(o => { o.productName = pn[o.productId] || o.productName || ''; o.customerName = o.customerId ? (cn[o.customerId] || '') : ''; });
      const r = upsertList_('costs', ch.costs);
      if (r.added.length) ev.push({ action: 'Прибыль', text: 'Добавлены закупочные цены: ' + r.added.length + ' поз.' + (r.added[0].from ? ' (действуют с ' + String(r.added[0].from).split('-').reverse().join('.') + ')' : '') });
      if (r.removed.length) ev.push({ action: 'Прибыль', text: 'Удалены закупочные цены: ' + r.removed.length + ' поз.' });
    }
    if (ch.doccosts) upsertList_('doccosts', ch.doccosts);
    if (ch.purchases) upsertList_('purchases', ch.purchases);
    if (ch.pother) { const sn = nameMap_('suppliers'); (ch.pother.upsert || []).forEach(o => o.supplierName = o.supplierId ? (sn[o.supplierId] || '') : 'Общие'); upsertList_('pother', ch.pother); }
    if (ch.psettings) { const sn = nameMap_('suppliers'); (ch.psettings.upsert || []).forEach(o => o.name = sn[o.id] || ''); upsertList_('psettings', ch.psettings); }
  }
  if (me && ev.length) log_(me, ev);
}


/* ======================= СКЛАД =======================
 * Один общий склад на всю команду. Все складские записи меняются ТОЛЬКО через действие «stock» (под блокировкой),
 * универсальная синхронизация сайта их не трогает. Каждая операция — один запрос с постоянным номером (rid):
 * повтор того же rid ничего не меняет второй раз.
 * Надёжность: перед записью на несколько листов операция целиком (подготовленные строки) пишется в «Склад: операции»
 * со статусом prep, потом строки ложатся на листы по постоянным ключам, потом статус done. Остатки и резервы считаются
 * только по операциям done. Если скрипт оборвался посередине — следующий запрос допишет недостающее (stRepair_). */
const ST_UNITS0 = ['кг', 'г', 'шт', 'л', 'упак', 'короб'];
const ST_TYPES = { in: 'Приход', init: 'Начальный остаток', ship: 'Отгрузка', ret: 'Возврат', wo: 'Списание', inv: 'Инвентаризация', rwout: 'Перевзвешивание (из упаковок)', rwin: 'Перевзвешивание (в кг)', fix: 'Исправление прихода', close: 'Остаток закрыт', direct: 'Отгружено от Саида' };
const ST_NOSTOCK = { close: 1, direct: 1 };   /* записи, которые не меняют остаток */
const stN_ = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
const stK_ = v => stN_(v).toLowerCase().replace(/ё/g, 'е');
const stR3_ = x => Math.round((+x || 0) * 1000) / 1000;
const stR2_ = x => Math.round((+x || 0) * 100) / 100;
const stD_ = iso => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[3] + '.' + m[2] + '.' + m[1].slice(2) : String(iso || ''); };
const stQ_ = (q, u) => String(stR3_(q)).replace('.', ',') + ' ' + (u || '');
function stParse_(s, d) { try { const v = JSON.parse(s || ''); return v == null ? d : v; } catch (e) { return d; } }

function stDone_() { const d = {}; read_('sops').forEach(o => { if (o.status === 'done' && String(o.id).indexOf('#') < 0) d[o.id] = 1; }); return d; }
function stRows_(t, done) { return read_(t).filter(r => !r.op || done[r.op]); }

/* дописать операции, которые оборвались между записями на листы */
function stRepair_() {
  const ops = read_('sops'), prep = ops.filter(o => o.status === 'prep' && String(o.id).indexOf('#') < 0);
  if (!prep.length) return 0;
  prep.forEach(o => {
    const parts = ops.filter(x => x.id === o.id || String(x.id).indexOf(o.id + '#') === 0).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const W = stParse_(parts.map(x => x.data || '').join(''), null);
    if (W) stApply_(W);
    stMark_(o.id);
  });
  return prep.length;
}
function stMark_(rid) {
  const rows = read_('sops'); let ch = false;
  rows.forEach(r => { if (r.id === rid) { r.status = 'done'; r.data = ''; ch = true; } else if (String(r.id).indexOf(rid + '#') === 0) { r.status = 'done'; r.data = ''; ch = true; } });
  const old = new Date(Date.now() - 45 * 86400000).toISOString();   /* номера старых операций держим 45 дней — этого хватает для безопасного повтора */
  if (ch) write_('sops', rows.filter(r => !(String(r.id).indexOf(rid + '#') === 0) && !(r.status === 'done' && String(r.at) < old)));
}
/* запись подготовленных строк: новые — дописываются в конец листа, существующие — заменяются по ключу */
function stApply_(W) {
  Object.keys(W).forEach(t => {
    const part = W[t] || {}, up = part.upsert || [], del = part.del || [];
    if (!up.length && !del.length) return;
    const have = {}; read_(t).forEach(r => have[r.id] = 1);
    if (!del.length && up.every(o => !have[o.id])) {
      const sh = sheet_(t), n = sh.getLastRow(), cols = S[t].cols;
      const rng = sh.getRange(n + 1, 1, up.length, cols.length); rng.setNumberFormat('@');
      rng.setValues(up.map(o => cols.map(c => o[c[0]] == null ? '' : String(o[c[0]]))));
      delete MEMO_[t];
    } else upsertList_(t, { upsert: up, del: del });
  });
}
function stCommit_(rid, me, kind, W) {
  Object.keys(W).forEach(t => (W[t].upsert || []).forEach(o => { o.op = rid; }));
  const json = JSON.stringify(W), parts = [], N = 45000;
  for (let i = 0; i < json.length; i += N) parts.push(json.slice(i, i + N));
  const at = new Date().toISOString();
  const rows = parts.map((d, i) => ({ id: i ? rid + '#' + ('00' + i).slice(-3) : rid, at: at, by: me.name, kind: kind, status: 'prep', data: d }));
  const sh = sheet_('sops'), n = sh.getLastRow(), cols = S.sops.cols;
  const rng = sh.getRange(n + 1, 1, rows.length, cols.length); rng.setNumberFormat('@');
  rng.setValues(rows.map(o => cols.map(c => o[c[0]] == null ? '' : String(o[c[0]])))); delete MEMO_.sops;
  stApply_(W);
  stMark_(rid);
  PropertiesService.getScriptProperties().setProperty('stockOn', '1');
}

/* текущее состояние склада (только завершённые операции) */
function stCtx_() {
  const done = stDone_(), c = { done: done };
  ['sunits', 'sitems', 'sbatches', 'smoves', 'sres', 'sfiles', 'sacts'].forEach(t => c[t] = stRows_(t, done));
  c.item = {}; c.sitems.forEach(i => c.item[i.id] = i);
  c.batch = {}; c.sbatches.forEach(b => c.batch[b.id] = b);
  c.link = {}; c.sitems.forEach(i => stParse_(i.links, []).forEach(pid => c.link[pid] = i.id));
  c.fact = {}; c.smoves.forEach(m => { if (!ST_NOSTOCK[m.type]) c.fact[m.batchId] = stR3_((c.fact[m.batchId] || 0) + (+m.qty || 0)); });
  c.resB = {}; c.sres.forEach(r => c.resB[r.batchId] = stR3_((c.resB[r.batchId] || 0) + (+r.qty || 0)));
  return c;
}
/* старые движения (старше 180 дней) сайту отдаём итогами: остаток по партии и итоги по строкам накладных — так склад открывается быстро и через год */
const ST_KEEP_DAYS = 180;
function stState_(limitLog) {
  const done = stDone_(), log = stRows_('slog', done), cut = new Date(Date.now() - ST_KEEP_DAYS * 86400000).toISOString(), all = stRows_('smoves', done), recent = [], agg = { fact: {}, done: {}, n: 0 };
  all.forEach(m => { if (String(m.at) >= cut) { recent.push(m); return; } agg.n++;
    if (!ST_NOSTOCK[m.type]) agg.fact[m.batchId] = stR3_((agg.fact[m.batchId] || 0) + (+m.qty || 0));
    if (m.docId) { const k = m.docId + '|' + m.lineId, o = agg.done[k] = agg.done[k] || { shipped: 0, closed: 0, ret: 0, direct: 0, cost: 0, retCost: 0 };
      if (m.type === 'ship') { o.shipped = stR3_(o.shipped - (+m.qty || 0)); o.cost += (-(+m.qty || 0)) * (+m.cost || 0); if (m.cost === '' || m.cost == null) o.noCost = 1; }
      else if (m.type === 'close') o.closed = stR3_(o.closed + (+m.qty || 0)); else if (m.type === 'ret') { o.ret = stR3_(o.ret + (+m.qty || 0)); o.retCost += (+m.qty || 0) * (+m.cost || 0); } else if (m.type === 'direct') o.direct = stR3_(o.direct + (+m.qty || 0)); } });
  return { units: stRows_('sunits', done), items: stRows_('sitems', done), batches: stRows_('sbatches', done), moves: recent, agg: agg, keepDays: ST_KEEP_DAYS,
    res: stRows_('sres', done), files: stRows_('sfiles', done).map(f => { const x = Object.assign({}, f); delete x.file; return x; }), acts: stRows_('sacts', done),
    log: log.slice(-(limitLog || 1500)), at: new Date().toISOString() };
}
const stUnitOk_ = u => !!stN_(u) && stN_(u).length <= 20;
function stBatchSort_(a, b) { return String(a.date).localeCompare(String(b.date)) || String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)); }
function stBatchName_(c, itemId, date, skip) {
  const same = c.sbatches.filter(b => b.itemId === itemId && b.date === date && b.id !== skip).length;
  return 'Партия от ' + stD_(date) + (same ? ' №' + (same + 1) : '');
}
function stFree_(c, bid, exceptDoc) {
  let r = 0; c.sres.forEach(x => { if (x.batchId === bid && x.docId !== exceptDoc) r += +x.qty || 0; });
  return stR3_((c.fact[bid] || 0) - r);
}
/* корень цепочки перевзвешиваний: срок годности и декларации берутся у исходного прихода */
function stRoot_(c, b) { let x = b, n = 0; while (x && x.parent && c.batch[x.parent] && n++ < 20) x = c.batch[x.parent]; return x || b; }

/* ---------- строки накладной, которые берутся со склада ---------- */
function stDocLines_(c, row) {
  const sn = stParse_(row && row.snap, null); if (!sn || !sn.dr) return { sn: null, lines: [], arch: true };
  const arch = !!(sn.meta && sn.meta.arch), out = [];
  (sn.dr.lines || []).forEach((l, i) => {
    if (!l.productId || !(+l.qty > 0)) return;
    const lid = String(l.lid || ('i' + i + ':' + l.productId)), src = l.stk || {}, qty = stR3_(+l.qty), unit = stN_(((sn.prods || {})[l.productId] || {}).unit);
    const req = src.m === 's' ? qty : src.m === 'x' ? Math.min(qty, Math.max(0, stR3_(+src.q || 0))) : 0;
    out.push({ lid: lid, pid: l.productId, itemId: c.link[l.productId] || '', qty: qty, req: stR3_(req), unit: unit, price: +l.price || 0, name: String(l.name || ((sn.prods || {})[l.productId] || {}).name || ''), m: src.m || '' });
  });
  return { sn: sn, lines: out, arch: arch };
}
function stLineDone_(c, docId, lid) {
  let shipped = 0, closed = 0, ret = 0;
  c.smoves.forEach(m => { if (m.docId !== docId || m.lineId !== lid) return;
    if (m.type === 'ship') shipped -= +m.qty || 0; else if (m.type === 'close') closed += +m.qty || 0; else if (m.type === 'ret') ret += +m.qty || 0; });
  return { shipped: stR3_(shipped), closed: stR3_(closed), ret: stR3_(ret) };
}
/* пересчёт резерва одной накладной: старый резерв этой же накладной не считается занятым; партии — с самой ранней даты прихода */
function stPlanDoc_(c, row, docId) {
  const D = stDocLines_(c, row), rows = [], plan = [], at = new Date().toISOString();
  const docLbl = row ? '№ ' + row.number + ' от ' + stD_(row.date) : '';
  if (row && !D.arch) D.lines.forEach(L => {
    if (!L.req || !L.itemId) return;
    const dn = stLineDone_(c, docId, L.lid), need = stR3_(Math.max(0, L.req - dn.shipped - dn.closed));
    let left = need; const uk = stK_(L.unit);
    c.sbatches.filter(b => b.itemId === L.itemId && stK_(b.unit) === uk).sort(stBatchSort_).forEach(b => {
      if (left <= 0) return; const free = stFree_(c, b.id, docId) - rows.filter(r => r.batchId === b.id).reduce((a, r) => a + r.qty, 0);
      const q = stR3_(Math.min(left, Math.max(0, free))); if (q <= 0) return; left = stR3_(left - q);
      rows.push({ id: docId + '|' + L.lid + '|' + b.id, docId: docId, lineId: L.lid, itemId: L.itemId, batchId: b.id, qty: q, unit: b.unit, doc: docLbl, itemName: (c.item[L.itemId] || {}).name || '', at: at });
    });
    const sameUnit = c.sbatches.some(b => b.itemId === L.itemId && stK_(b.unit) === uk);
    plan.push({ lid: L.lid, itemId: L.itemId, name: L.name, need: need, got: stR3_(need - left), short: stR3_(left), unit: L.unit, unitMiss: !sameUnit });
  });
  return { rows: rows, plan: plan, docLbl: docLbl };
}
function stResSum_(list) { const m = {}; list.forEach(r => { const k = r.lineId; m[k] = stR3_((m[k] || 0) + (+r.qty || 0)); }); return m; }
/* резерв по списку накладных: возвращает подготовленные изменения листов */
function stReserveW_(c, me, ids, rid, reason) {
  const W = { sres: { upsert: [], del: [] }, slog: { upsert: [] } }, journal = {}, at = new Date().toISOString();
  read_('journal').forEach(r => { if (ids.indexOf(r.id) >= 0) journal[r.id] = r; });
  let n = 0;
  ids.forEach(docId => {
    const old = c.sres.filter(r => r.docId === docId);
    const P = stPlanDoc_(c, journal[docId], docId), keep = {};
    P.rows.forEach(r => { keep[r.id] = 1; const o = old.find(x => x.id === r.id); if (!o || +o.qty !== +r.qty) W.sres.upsert.push(r); });
    old.forEach(o => { if (!keep[o.id]) W.sres.del.push(o.id); });
    /* применяем к контексту — следующая накладная в этом же запросе видит занятое */
    c.sres = c.sres.filter(r => r.docId !== docId).concat(P.rows);
    const a = stResSum_(old), b = stResSum_(P.rows);
    P.plan.forEach(L => {
      const was = a[L.lid] || 0, now = b[L.lid] || 0; if (was === now && !L.short) return; if (was === now && reason !== 'manual') return;
      W.slog.upsert.push({ id: rid + ':L' + (n++), at: at, by: me.name, action: L.short ? 'Резерв с нехваткой' : 'Резерв', object: P.docLbl + ' — ' + ((c.item[L.itemId] || {}).name || L.name),
        before: was ? stQ_(was, L.unit) : '—', after: stQ_(now, L.unit) + (L.short ? ' (нехватка ' + stQ_(L.short, L.unit) + ')' : ''), reason: reason === 'manual' ? 'обновлён вручную' : '', docId: docId, itemId: L.itemId });
    });
    const gone = Object.keys(a).filter(k => !P.plan.some(L => L.lid === k));
    if (gone.length) W.slog.upsert.push({ id: rid + ':L' + (n++), at: at, by: me.name, action: 'Резерв снят', object: P.docLbl || 'накладная', before: gone.length + ' поз.', after: '—', reason: journal[docId] ? (stDocLines_(c, journal[docId]).arch ? 'документ в архиве' : 'источник «От Саида» или строка убрана') : 'документ удалён', docId: docId });
  });
  return W;
}
/* после сохранения накладных (любой путь: документ, заявка, комплект, импорт, синхронизация без связи) — обновить их резерв */
function stAfterDocs_(ids, me) {
  if (!ids || !ids.length) return;
  if (PropertiesService.getScriptProperties().getProperty('stockOn') !== '1') return;
  try {
    /* быстро: склад трогаем, только если у накладной есть складские строки или уже был резерв */
    const has = {}; read_('sres').forEach(r => has[r.docId] = 1); const jr = {}; read_('journal').forEach(r => jr[r.id] = r);
    const want = ids.filter(id => has[id] || (jr[id] && /"m":"[sx]"/.test(String(jr[id].snap || ''))));
    if (!want.length) return;
    stRepair_(); const c = stCtx_();
    const rid = 'auto' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), W = stReserveW_(c, me || { name: 'система' }, want, rid, 'doc');
    if (W.sres.upsert.length || W.sres.del.length || W.slog.upsert.length) stCommit_(rid, me || { name: 'система' }, 'reserve', W);
  } catch (e) { /* склад не должен ломать сохранение документов */ }
}

/* ---------- папка деклараций (закрытая, как фото задач) ---------- */
function stFolder_() {
  const pr = PropertiesService.getScriptProperties(), id = pr.getProperty('stockFolder');
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (x) {} }
  const f = DriveApp.createFolder('Документы ФД — склад, декларации'); pr.setProperty('stockFolder', f.getId()); return f;
}
const ST_MIME = { 'application/pdf': 1, 'image/jpeg': 1, 'image/png': 1, 'image/webp': 1, 'image/heic': 1, 'image/heif': 1, 'image/gif': 1,
  'application/msword': 1, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 1, 'application/vnd.ms-excel': 1, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 1, 'text/plain': 1 };
const ST_FILE_MAX = 20 * 1024 * 1024;

/* ---------- операции ---------- */
function stock_(p, me) {
  stRepair_();
  const op = String(p.op || 'load'), d = p.d || {};
  if (op === 'load') return { ok: true, stock: stState_() };
  if (op === 'fileGet') {
    const f = read_('sfiles').find(x => x.id === String(d.id || '')); if (!f) return { ok: false, error: 'файл не найден' };
    const b = DriveApp.getFileById(f.file).getBlob();
    return { ok: true, name: f.name, mime: f.mime || b.getContentType(), data: Utilities.base64Encode(b.getBytes()) };
  }
  const rid = String(p.rid || '');
  if (!/^[\w\-]{6,80}$/.test(rid)) return { ok: false, error: 'нет номера операции — обновите страницу' };
  const was = read_('sops').find(o => o.id === rid);
  if (was && was.status === 'done') return { ok: true, dup: true, stock: stState_() };
  const fn = ST_OPS[op]; if (!fn) return { ok: false, error: 'unknown action' };
  const c = stCtx_(); let r;
  try { r = fn(d, me, c, rid); } catch (e) { return { ok: false, error: e.message || String(e) }; }
  if (r && r.code) return { ok: false, error: r.error, code: r.code, info: r.info || null };
  stCommit_(rid, me, op, r.W);
  return { ok: true, stock: stState_(), out: r.out || null };
}
function stErr_(t) { throw new Error(t); }
function stLog_(W, rid, me, n, o) { (W.slog = W.slog || { upsert: [] }).upsert.push(Object.assign({ id: rid + ':L' + n, at: new Date().toISOString(), by: me.name }, o)); }
function stQty_(q, unit) {
  q = +String(q).replace(',', '.'); if (!(q > 0) || !isFinite(q)) stErr_('Количество должно быть больше нуля');
  if (stK_(unit) === 'шт' && Math.round(q) !== q) stErr_('Штуки — только целым числом');
  return stR3_(q);
}
function stPrice_(v) { if (v === '' || v == null) return ''; const x = +String(v).replace(',', '.'); if (!(x >= 0) || !isFinite(x)) stErr_('Неверная цена'); return String(stR2_(x)); }
function stDate_(v, what) { const s = String(v || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) stErr_('Укажите ' + what); return s; }
function stUnit_(c, W, rid, me, u, n) {
  const k = stK_(u); if (!stUnitOk_(u)) stErr_('Укажите единицу измерения');
  const known = ST_UNITS0.concat(c.sunits.map(x => x.name)).find(x => stK_(x) === k);
  if (known) return known;
  const name = stN_(u); (W.sunits = W.sunits || { upsert: [] }).upsert.push({ id: rid + ':u' + (n || ''), name: name, by: me.name, at: new Date().toISOString() });
  c.sunits.push({ name: name }); stLog_(W, rid, me, 'u' + (n || ''), { action: 'Новая единица', object: name, after: name });
  return name;
}
function stItemByName_(c, name) { const k = stK_(name); return c.sitems.find(i => stK_(i.name) === k) || null; }
function stDocRow_(id) { return read_('journal').find(r => r.id === id) || null; }

/* одна строка прихода (для одиночного прихода и для ввода списком) */
function stInRow_(d, me, c, rid, n, W) {
  const at = new Date().toISOString(), kind = d.kind === 'init' ? 'init' : 'in';
  let it = d.itemId ? c.item[d.itemId] : null;
  if (d.itemId && !it) stErr_('Товар склада не найден — обновите страницу');
  if (!it) { const nm = stN_(d.newName); if (!nm) stErr_('Укажите товар'); it = stItemByName_(c, nm);
    if (!it) { it = { id: rid + ':i' + n, name: nm, alt: '', unit: stN_(d.unit) || 'кг', note: '', links: '[]', by: me.name, at: at };
      (W.sitems = W.sitems || { upsert: [] }).upsert.push(it); c.sitems.push(it); c.item[it.id] = it; stLog_(W, rid, me, 'i' + n, { action: 'Новый товар склада', object: nm, after: nm, itemId: it.id }); } }
  const unit = stUnit_(c, W, rid, me, d.unit, n), qty = stQty_(d.qty, unit), price = stPrice_(d.price), date = stDate_(d.date, 'дату приёмки');
  const exp = d.exp ? stDate_(d.exp, 'срок годности') : ''; if (exp && exp < date) stErr_('Срок годности не может быть раньше даты приёмки');
  const sup0 = stN_(d.supplier).slice(0, 120), supK = c.sbatches.find(x => x.supplier && stK_(x.supplier) === stK_(sup0)), supplier = supK ? supK.supplier : sup0, docRef = stN_(d.docRef).slice(0, 200);   /* «саид» = «Саид»: одно написание */
  if (!d.force) {
    const sim = c.sbatches.find(b => b.itemId === it.id && stK_(b.supplier) === stK_(supplier) && (docRef ? stK_(b.docRef) === stK_(docRef) : (b.date === date && +b.qty === qty)));
    if (sim) return { code: 'similar', error: 'Похожий приход уже есть: ' + sim.name + ', ' + stQ_(sim.qty, sim.unit) + (sim.docRef ? ', документ «' + sim.docRef + '»' : ''), info: { batchId: sim.id } };
  }
  const b = { id: rid + ':b' + n, itemId: it.id, itemName: it.name, name: stBatchName_(c, it.id, date), date: date, qty: qty, unit: unit, price: price, supplier: supplier, docRef: docRef, exp: exp, kind: kind, parent: '', by: me.name, at: at };
  W.sbatches.upsert.push(b); c.sbatches.push(b); c.batch[b.id] = b;
  W.smoves.upsert.push({ id: rid + ':m' + n, at: at, by: me.name, type: kind, typeName: ST_TYPES[kind], itemId: it.id, itemName: it.name, batchId: b.id, qty: qty, unit: unit, cost: price, party: supplier, doc: docRef });
  stLog_(W, rid, me, 'n' + n, { action: ST_TYPES[kind], object: it.name + ' — ' + b.name, after: stQ_(qty, unit) + (price !== '' ? ' по ' + price + ' ₽' : ' (цена не указана)'), reason: docRef ? 'документ: ' + docRef : '', batchId: b.id, itemId: it.id });
  return { batchId: b.id, itemId: it.id };
}

const ST_OPS = {
  /* новый складской товар или правка: название, другие названия, комментарий, основная единица, связи с позициями документов */
  item: function (d, me, c, rid) {
    const W = { sitems: { upsert: [] } }, at = new Date().toISOString(); let n = 0;
    let it = d.itemId ? c.item[d.itemId] : null; if (d.itemId && !it) stErr_('Товар склада не найден — обновите страницу');
    const isNew = !it; it = it ? Object.assign({}, it) : { id: rid + ':i', name: '', alt: '', unit: 'кг', note: '', links: '[]', by: me.name, at: at };
    const was = Object.assign({}, it);
    if (d.name != null) { const nm = stN_(d.name); if (!nm) stErr_('Укажите название товара');
      const dup = stItemByName_(c, nm); if (dup && dup.id !== it.id) stErr_('Такой товар уже есть на складе: «' + dup.name + '»'); it.name = nm; }
    if (isNew && !it.name) stErr_('Укажите название товара');
    if (d.alt != null) it.alt = (Array.isArray(d.alt) ? d.alt : String(d.alt).split(/[;\n]/)).map(stN_).filter(Boolean).filter((x, i, a) => a.findIndex(y => stK_(y) === stK_(x)) === i).join('; ');
    if (d.note != null) it.note = String(d.note).slice(0, 2000).trim();
    if (d.unit != null) it.unit = stUnit_(c, W, rid, me, d.unit);
    if (d.links != null) {
      const L = (Array.isArray(d.links) ? d.links : []).map(String).filter(Boolean).filter((x, i, a) => a.indexOf(x) === i);
      L.forEach(pid => { const other = c.link[pid]; if (other && other !== it.id) {   /* позиция была связана с другим товаром — переносим явно */
        const o = Object.assign({}, c.item[other]); o.links = JSON.stringify(stParse_(o.links, []).filter(x => x !== pid)); W.sitems.upsert.push(o);
        stLog_(W, rid, me, n++, { action: 'Связь перенесена', object: o.name, before: pid, after: '→ ' + (it.name || 'новый товар'), itemId: o.id }); } });
      it.links = JSON.stringify(L);
      const pn = nameMap_('products'); it.linkNames = L.map(x => pn[x] || x).join('; ');
    }
    if (d.def != null) { it.def = d.def === 's' ? 's' : ''; it.defC = JSON.stringify((Array.isArray(d.defC) ? d.defC : []).map(String).filter(Boolean)); }
    W.sitems.upsert.push(it);
    if (!isNew && (String(was.def || '') !== String(it.def || '') || String(was.defC || '[]') !== String(it.defC || '[]'))) {
      const cn = nameMap_('customers'), txt = o => o.def === 's' ? 'со склада' + (stParse_(o.defC, []).length ? ' для: ' + stParse_(o.defC, []).map(x => cn[x] || x).join(', ') : ' для всех') : 'от Саида';
      stLog_(W, rid, me, n++, { action: 'Источник по умолчанию', object: it.name, before: txt(was), after: txt(it), itemId: it.id }); }
    const F = { name: 'Название', alt: 'Другие названия', note: 'Комментарий к товару', unit: 'Основная единица', linkNames: 'Связь с позициями документов' };
    if (isNew) stLog_(W, rid, me, n++, { action: 'Новый товар склада', object: it.name, after: it.name, itemId: it.id });
    else Object.keys(F).forEach(k => { if (String(was[k] || '') !== String(it[k] || '')) stLog_(W, rid, me, n++, { action: F[k], object: it.name, before: String(was[k] || '—'), after: String(it[k] || '—'), itemId: it.id }); });
    return { W: W, out: { itemId: it.id } };
  },
  unit: function (d, me, c, rid) { const W = {}; const u = stUnit_(c, W, rid, me, d.name); if (!W.sunits) stErr_('Единица «' + u + '» уже есть'); return { W: W, out: { unit: u } }; },
  /* приход и начальный остаток: отдельная партия на каждый приход */
  in: function (d, me, c, rid) { const W = { sbatches: { upsert: [] }, smoves: { upsert: [] } }; const r = stInRow_(d, me, c, rid, '', W); if (r.code) return r; return { W: W, out: r }; },
  /* ввод остатков (или приходов) списком: всё одной операцией — либо проводится целиком, либо не проводится ничего */
  bulk: function (d, me, c, rid) {
    const rows = (d.rows || []).filter(Boolean); if (!rows.length) stErr_('Список пуст'); if (rows.length > 300) stErr_('За один раз — не больше 300 строк');
    const W = { sbatches: { upsert: [] }, smoves: { upsert: [] } }, out = [];
    rows.forEach((x, i) => { let r; try { r = stInRow_(Object.assign({}, x, { kind: d.kind, force: true }), me, c, rid, String(i), W); } catch (e) { stErr_('Строка ' + (i + 1) + ' («' + stN_(x.newName || (c.item[x.itemId] || {}).name || '') + '»): ' + e.message); } out.push(r); });
    return { W: W, out: { n: out.length } };
  },
  /* отменить ошибочный приход: только если из партии ещё ничего не брали */
  cancelIn: function (d, me, c, rid) {
    const b = c.batch[d.batchId]; if (!b) stErr_('Партия не найдена'); if (b.cancel) stErr_('Приход уже отменён'); if (b.kind === 'rw') stErr_('Перевзвешенную партию не отменить — сделайте инвентаризацию');
    const reason = stN_(d.reason); if (!reason) stErr_('Укажите причину');
    const used = c.smoves.some(m => m.batchId === b.id && ['in', 'init', 'fix'].indexOf(m.type) < 0) || c.sbatches.some(x => x.parent === b.id);
    if (used || (c.resB[b.id] || 0) > 0) stErr_('Из этой партии уже брали товар (резерв, отгрузка, списание или перевзвешивание) — отменить нельзя. Исправьте количество с причиной или сделайте инвентаризацию.');
    const f = c.fact[b.id] || 0, it = c.item[b.itemId] || {}, at = new Date().toISOString();
    const W = { sbatches: { upsert: [Object.assign({}, b, { cancel: at.slice(0, 10) })] }, smoves: { upsert: f ? [{ id: rid + ':m', at: at, by: me.name, type: 'fix', typeName: 'Приход отменён', itemId: b.itemId, itemName: it.name, batchId: b.id, qty: -f, unit: b.unit, cost: b.price, reason: reason }] : [] } };
    stLog_(W, rid, me, 0, { action: 'Приход отменён', object: it.name + ' — ' + b.name, before: stQ_(f, b.unit), after: '0', reason: reason, batchId: b.id, itemId: b.itemId });
    return { W: W };
  },
  /* объединить два товара склада в один (например, «Огурец» и «Огурцы»): партии, движения, резервы, декларации и связи переходят в оставшийся */
  merge: function (d, me, c, rid) {
    const a = c.item[d.fromId], b = c.item[d.toId]; if (!a || !b || a.id === b.id) stErr_('Выберите два разных товара');
    if (lim_(me)) stErr_('Объединять товары может Даниил, Наталья или Склад');
    const W = { sitems: { upsert: [], del: [a.id] }, sbatches: { upsert: [] }, smoves: { upsert: [] }, sres: { upsert: [] }, sfiles: { upsert: [] } };
    const L = stParse_(b.links, []).concat(stParse_(a.links, [])).filter((x, i, arr) => arr.indexOf(x) === i), pn = nameMap_('products');
    const alt = [b.alt, a.name, a.alt].join(';').split(';').map(stN_).filter(Boolean).filter(x => stK_(x) !== stK_(b.name)).filter((x, i, arr) => arr.findIndex(y => stK_(y) === stK_(x)) === i).join('; ');
    W.sitems.upsert.push(Object.assign({}, b, { links: JSON.stringify(L), linkNames: L.map(x => pn[x] || x).join('; '), alt: alt, note: [b.note, a.note].filter(Boolean).join('\n') }));
    c.sbatches.filter(x => x.itemId === a.id).forEach(x => W.sbatches.upsert.push(Object.assign({}, x, { itemId: b.id, itemName: b.name })));
    c.smoves.filter(x => x.itemId === a.id).forEach(x => W.smoves.upsert.push(Object.assign({}, x, { itemId: b.id, itemName: b.name })));
    c.sres.filter(x => x.itemId === a.id).forEach(x => W.sres.upsert.push(Object.assign({}, x, { itemId: b.id, itemName: b.name })));
    c.sfiles.filter(x => x.itemId === a.id).forEach(x => W.sfiles.upsert.push(Object.assign({}, x, { itemId: b.id, itemName: b.name })));
    stLog_(W, rid, me, 0, { action: 'Товары объединены', object: b.name, before: '«' + a.name + '» + «' + b.name + '»', after: '«' + b.name + '»', reason: 'партий перенесено: ' + W.sbatches.upsert.length, itemId: b.id });
    return { W: W, out: { itemId: b.id } };
  },
  /* правка партии: цена (к текущему остатку), срок, документ, поставщик, количество прихода (компенсирующим движением) */
  batch: function (d, me, c, rid) {
    const b0 = c.batch[d.batchId]; if (!b0) stErr_('Партия не найдена — обновите страницу');
    const b = Object.assign({}, b0), W = { sbatches: { upsert: [b] } }, it = c.item[b.itemId] || {}, at = new Date().toISOString(); let n = 0;
    const L = (a, bf, af, extra) => stLog_(W, rid, me, n++, Object.assign({ action: a, object: (it.name || '') + ' — ' + b.name, before: bf, after: af, batchId: b.id, itemId: b.itemId }, extra || {}));
    if (d.price != null && String(stPrice_(d.price)) !== String(b0.price || '')) {
      if (lim_(me)) stErr_('Цену партии меняет Даниил, Наталья или Склад');
      b.price = stPrice_(d.price); L('Закупочная цена партии', b0.price !== '' ? b0.price + ' ₽' : 'не указана', b.price !== '' ? b.price + ' ₽' : 'не указана', { reason: 'к текущему остатку; себестоимость прошлых отгрузок не меняется' }); }
    if (d.exp != null) { const root = stRoot_(c, b0); const tgt = root.id === b.id ? b : Object.assign({}, root);
      const e = d.exp ? stDate_(d.exp, 'срок годности') : ''; if (e && e < tgt.date) stErr_('Срок годности не может быть раньше даты приёмки (' + stD_(tgt.date) + ')');
      if (String(tgt.exp || '') !== e) { const old = tgt.exp; tgt.exp = e; if (tgt !== b) W.sbatches.upsert.push(tgt);
        stLog_(W, rid, me, n++, { action: 'Срок годности', object: (it.name || '') + ' — ' + tgt.name, before: old ? stD_(old) : 'не указан', after: e ? stD_(e) : 'не указан', batchId: tgt.id, itemId: b.itemId }); } }
    if (d.docRef != null && stN_(d.docRef) !== String(b0.docRef || '')) { b.docRef = stN_(d.docRef).slice(0, 200); L('Входящий документ', b0.docRef || '—', b.docRef || '—'); }
    if (d.supplier != null && stN_(d.supplier) !== String(b0.supplier || '')) { b.supplier = stN_(d.supplier).slice(0, 120); L('Поставщик партии', b0.supplier || '—', b.supplier || '—'); }
    if (d.qty != null && stR3_(+String(d.qty).replace(',', '.')) !== stR3_(b0.qty)) {
      if (b0.kind === 'rw') stErr_('Количество перевзвешенной партии не правится — сделайте инвентаризацию');
      const nq = +String(d.qty).replace(',', '.'); if (!(nq >= 0)) stErr_('Неверное количество');
      if (stK_(b0.unit) === 'шт' && Math.round(nq) !== nq) stErr_('Штуки — только целым числом');
      const delta = stR3_(nq - (+b0.qty || 0)), fact = c.fact[b0.id] || 0, res = c.resB[b0.id] || 0;
      if (fact + delta < res - 0.0005) stErr_('Нельзя уменьшить приход: из партии уже зарезервировано ' + stQ_(res, b0.unit) + ', на складе ' + stQ_(fact, b0.unit) + '. Сначала снимите резерв.');
      if (fact + delta < -0.0005) stErr_('Нельзя уменьшить приход ниже уже отгруженного: на складе осталось ' + stQ_(fact, b0.unit));
      if (!d.reason) stErr_('Укажите причину исправления');
      b.qty = stR3_(nq);
      W.smoves = { upsert: [{ id: rid + ':m', at: at, by: me.name, type: 'fix', typeName: ST_TYPES.fix, itemId: b.itemId, itemName: it.name, batchId: b.id, qty: delta, unit: b.unit, cost: b.price, reason: stN_(d.reason) }] };
      L('Исправление прихода', stQ_(b0.qty, b0.unit), stQ_(nq, b0.unit), { reason: stN_(d.reason) });
    }
    if (!n) stErr_('Нечего сохранять — ничего не изменилось');
    return { W: W };
  },
  /* ручное списание — с причиной и в пределах свободного остатка */
  wo: function (d, me, c, rid) {
    const b = c.batch[d.batchId]; if (!b) stErr_('Партия не найдена'); const it = c.item[b.itemId] || {};
    const q = stQty_(d.qty, b.unit), reason = stN_(d.reason); if (!reason) stErr_('Укажите причину списания');
    const free = stFree_(c, b.id); if (q > free + 0.0005) stErr_('Свободно только ' + stQ_(free, b.unit) + ' (остальное в резерве)');
    const at = new Date().toISOString(), W = { smoves: { upsert: [{ id: rid + ':m', at: at, by: me.name, type: 'wo', typeName: ST_TYPES.wo, itemId: b.itemId, itemName: it.name, batchId: b.id, qty: -q, unit: b.unit, cost: b.price, reason: reason }] } };
    stLog_(W, rid, me, 0, { action: 'Списание', object: it.name + ' — ' + b.name, before: stQ_(c.fact[b.id] || 0, b.unit), after: stQ_((c.fact[b.id] || 0) - q, b.unit), reason: reason, batchId: b.id, itemId: b.itemId });
    return { W: W };
  },
  /* инвентаризация: пустая строка — пропуск, ноль — введённый факт; проводится только разница; акт сохраняется всегда */
  inv: function (d, me, c, rid) {
    const rows = (d.rows || []).filter(r => r && r.fact !== '' && r.fact != null), at = new Date().toISOString();
    if (!rows.length) stErr_('Впишите фактическое количество хотя бы по одной партии');
    const W = { smoves: { upsert: [] }, sacts: { upsert: [] } }, act = [], bad = []; let n = 0, diffN = 0;
    rows.forEach(r => { const b = c.batch[r.batchId]; if (!b) stErr_('Партия не найдена — обновите страницу');
      const f = +String(r.fact).replace(',', '.'); if (!(f >= 0) || !isFinite(f)) stErr_('Неверный факт: ' + b.name);
      if (stK_(b.unit) === 'шт' && Math.round(f) !== f) stErr_('Штуки — только целым числом: ' + b.name);
      const fact = c.fact[b.id] || 0, res = c.resB[b.id] || 0, it = c.item[b.itemId] || {};
      if (f < res - 0.0005) bad.push(it.name + ' — ' + b.name + ': факт ' + stQ_(f, b.unit) + ' меньше резерва ' + stQ_(res, b.unit));
      const diff = stR3_(f - fact); act.push({ batchId: b.id, item: it.name, batch: b.name, unit: b.unit, was: fact, fact: stR3_(f), diff: diff });
      if (diff) { diffN++; W.smoves.upsert.push({ id: rid + ':m' + (n++), at: at, by: me.name, type: 'inv', typeName: ST_TYPES.inv, itemId: b.itemId, itemName: it.name, batchId: b.id, qty: diff, unit: b.unit, cost: b.price, reason: 'акт ' + stD_(at.slice(0, 10)), doc: rid }); } });
    if (bad.length) return { code: 'reserve', error: 'Факт меньше резерва — сначала разберитесь с резервом: ' + bad.join('; '), info: { bad: bad } };
    W.sacts.upsert.push({ id: rid, at: at, by: me.name, diff: String(diffN), rows: JSON.stringify(act).slice(0, 49000) });
    stLog_(W, rid, me, 0, { action: 'Инвентаризация', object: act.length + ' парт.', after: diffN ? 'расхождений: ' + diffN : 'расхождений нет', reason: stN_(d.note) });
    return { W: W, out: { diffN: diffN } };
  },
  /* перевзвешивание свободных упаковок в кг: стоимость переходит в новую связанную партию */
  rw: function (d, me, c, rid) {
    const b = c.batch[d.batchId]; if (!b) stErr_('Партия не найдена'); if (stK_(b.unit) === 'кг') stErr_('Партия уже в килограммах');
    const it = c.item[b.itemId] || {}, n = stQty_(d.n, b.unit), kg = stQty_(d.kg, 'кг'), free = stFree_(c, b.id);
    if (n > free + 0.0005) stErr_('Свободно только ' + stQ_(free, b.unit) + ' — зарезервированные упаковки не перевзвешиваются');
    const at = new Date().toISOString(), price = b.price !== '' && b.price != null ? String(stR2_(n * (+b.price) / kg)) : '';
    const nb = { id: rid + ':b', itemId: b.itemId, itemName: it.name, name: 'Перевзвешено из «' + b.name + '»', date: b.date, qty: kg, unit: 'кг', price: price, supplier: b.supplier, docRef: b.docRef, exp: '', kind: 'rw', parent: b.id, by: me.name, at: at };
    const W = { sbatches: { upsert: [nb] }, smoves: { upsert: [
      { id: rid + ':m1', at: at, by: me.name, type: 'rwout', typeName: ST_TYPES.rwout, itemId: b.itemId, itemName: it.name, batchId: b.id, qty: -n, unit: b.unit, cost: b.price, reason: 'перевзвешено: ' + stQ_(kg, 'кг') },
      { id: rid + ':m2', at: at, by: me.name, type: 'rwin', typeName: ST_TYPES.rwin, itemId: b.itemId, itemName: it.name, batchId: nb.id, qty: kg, unit: 'кг', cost: price, reason: 'из ' + stQ_(n, b.unit) } ] } };
    stLog_(W, rid, me, 0, { action: 'Перевзвешивание', object: it.name + ' — ' + b.name, before: stQ_(n, b.unit), after: stQ_(kg, 'кг') + (price ? ' по ' + price + ' ₽/кг' : ''), batchId: nb.id, itemId: b.itemId });
    return { W: W, out: { batchId: nb.id } };
  },
  /* явное обновление резерва накладной (например, после нового прихода) */
  reserve: function (d, me, c, rid) {
    const row = stDocRow_(String(d.docId || '')); if (!row) stErr_('Накладная не найдена — возможно, ещё не сохранена в таблицу');
    const W = stReserveW_(c, me, [row.id], rid, 'manual');
    if (!W.slog.upsert.length) stLog_(W, rid, me, 'x', { action: 'Резерв проверен', object: '№ ' + row.number + ' от ' + stD_(row.date), after: 'без изменений', docId: row.id });
    return { W: W };
  },
  /* фактическая отгрузка: складская часть списывается только в пределах резерва; резерв снимается */
  ship: function (d, me, c, rid) {
    const row = stDocRow_(String(d.docId || '')); if (!row) stErr_('Накладная не найдена в таблице');
    const D = stDocLines_(c, row); if (D.arch) stErr_('Накладная в архиве');
    const at = new Date().toISOString(), W = { smoves: { upsert: [] }, sres: { upsert: [], del: [] } }, lbl = '№ ' + row.number + ' от ' + stD_(row.date), party = (D.sn.c && D.sn.c.name) || row.customerName || '';
    let n = 0, any = 0; const want = {}; (d.lines || []).forEach(x => want[x.lineId] = x);
    D.lines.forEach(L => {
      const w = want[L.lid]; if (!w) return;
      const q = w.qty === '' || w.qty == null ? 0 : stR3_(+String(w.qty).replace(',', '.')); if (q < 0) stErr_('Неверное количество');
      if (q > 0) {
        if (!L.itemId) stErr_('«' + L.name + '» не связан со складским товаром');
        const R = c.sres.filter(r => r.docId === row.id && r.lineId === L.lid).sort((a, b) => stBatchSort_(c.batch[a.batchId] || {}, c.batch[b.batchId] || {}));
        const tot = R.reduce((a, r) => a + (+r.qty || 0), 0);
        if (q > tot + 0.0005) stErr_('«' + L.name + '»: в резерве только ' + stQ_(tot, L.unit) + ' — со склада можно отгрузить не больше резерва');
        let left = q;
        R.forEach(r => { if (left <= 0) return; const b = c.batch[r.batchId] || {}, t = stR3_(Math.min(left, +r.qty)); left = stR3_(left - t);
          W.smoves.upsert.push({ id: rid + ':m' + (n++), at: at, by: me.name, type: 'ship', typeName: ST_TYPES.ship, itemId: L.itemId, itemName: (c.item[L.itemId] || {}).name || '', batchId: r.batchId, qty: -t, unit: b.unit || L.unit, cost: b.price, price: String(L.price), doc: lbl, party: party, docId: row.id, lineId: L.lid });
          const rest = stR3_(+r.qty - t); if (rest > 0) W.sres.upsert.push(Object.assign({}, r, { qty: rest, at: at })); else W.sres.del.push(r.id); });
        any++;
      }
      const dq = w.direct === '' || w.direct == null ? 0 : stR3_(+String(w.direct).replace(',', '.'));
      if (dq > 0) { W.smoves.upsert.push({ id: rid + ':d' + (n++), at: at, by: me.name, type: 'direct', typeName: ST_TYPES.direct, itemId: L.itemId, itemName: (c.item[L.itemId] || {}).name || L.name, batchId: '', qty: dq, unit: L.unit, price: String(L.price), doc: lbl, party: party, docId: row.id, lineId: L.lid }); any++; }
    });
    if (!any) stErr_('Укажите, сколько отгружено');
    const st = W.smoves.upsert.filter(m => m.type === 'ship'), dr = W.smoves.upsert.filter(m => m.type === 'direct');
    stLog_(W, rid, me, 0, { action: 'Отгрузка', object: lbl + ' — ' + party, after: (st.length ? 'со склада: ' + st.map(m => m.itemName + ' ' + stQ_(-m.qty, m.unit)).join(', ') : '') + (dr.length ? (st.length ? '; ' : '') + 'от Саида: ' + dr.map(m => m.itemName + ' ' + stQ_(m.qty, m.unit)).join(', ') : ''), docId: row.id });
    return { W: W };
  },
  /* закрыть недопоставку (остаток к допоставке) с причиной — резерв этой строки снимается */
  close: function (d, me, c, rid) {
    const row = stDocRow_(String(d.docId || '')); if (!row) stErr_('Накладная не найдена'); const reason = stN_(d.reason); if (!reason) stErr_('Укажите причину');
    const D = stDocLines_(c, row), at = new Date().toISOString(), W = { smoves: { upsert: [] }, sres: { upsert: [], del: [] } }, lbl = '№ ' + row.number + ' от ' + stD_(row.date); let n = 0;
    D.lines.filter(L => L.req && L.itemId && (!d.lineId || d.lineId === L.lid)).forEach(L => {
      const dn = stLineDone_(c, row.id, L.lid), need = stR3_(L.req - dn.shipped - dn.closed); if (need <= 0) return;
      W.smoves.upsert.push({ id: rid + ':m' + (n++), at: at, by: me.name, type: 'close', typeName: ST_TYPES.close, itemId: L.itemId, itemName: (c.item[L.itemId] || {}).name || '', batchId: '', qty: need, unit: L.unit, doc: lbl, docId: row.id, lineId: L.lid, reason: reason });
      c.sres.filter(r => r.docId === row.id && r.lineId === L.lid).forEach(r => W.sres.del.push(r.id));
      stLog_(W, rid, me, n, { action: 'Остаток закрыт', object: lbl + ' — ' + ((c.item[L.itemId] || {}).name || L.name), before: stQ_(need, L.unit) + ' к допоставке', after: '—', reason: reason, docId: row.id, itemId: L.itemId });
    });
    if (!n) stErr_('Закрывать нечего — всё отгружено');
    return { W: W };
  },
  /* возврат: по исходным партиям и себестоимости, в пределах отгруженного и ещё не возвращённого */
  ret: function (d, me, c, rid) {
    const row = stDocRow_(String(d.docId || '')); if (!row) stErr_('Накладная не найдена');
    const lid = String(d.lineId || ''), lbl = '№ ' + row.number + ' от ' + stD_(row.date), at = new Date().toISOString();
    const ships = c.smoves.filter(m => m.docId === row.id && m.lineId === lid && m.type === 'ship'); if (!ships.length) stErr_('По этой строке со склада ничего не отгружалось');
    const unit = ships[0].unit, q = stQty_(d.qty, unit), byB = {};
    ships.forEach(m => { const x = byB[m.batchId] = byB[m.batchId] || { out: 0, back: 0, cost: m.cost, at: m.at }; x.out += -(+m.qty || 0); });
    c.smoves.filter(m => m.docId === row.id && m.lineId === lid && m.type === 'ret').forEach(m => { if (byB[m.batchId]) byB[m.batchId].back += +m.qty || 0; });
    const can = stR3_(Object.keys(byB).reduce((a, k) => a + byB[k].out - byB[k].back, 0)); if (q > can + 0.0005) stErr_('Вернуть можно не больше ' + stQ_(can, unit));
    const W = { smoves: { upsert: [] } }; let left = q, n = 0; const it = c.item[ships[0].itemId] || {};
    Object.keys(byB).sort((a, b) => String(byB[b].at).localeCompare(String(byB[a].at))).forEach(bid => { if (left <= 0) return; const x = byB[bid], t = stR3_(Math.min(left, x.out - x.back)); if (t <= 0) return; left = stR3_(left - t);
      W.smoves.upsert.push({ id: rid + ':m' + (n++), at: at, by: me.name, type: 'ret', typeName: ST_TYPES.ret, itemId: ships[0].itemId, itemName: it.name, batchId: bid, qty: t, unit: unit, cost: x.cost, doc: lbl, party: ships[0].party, docId: row.id, lineId: lid, reason: stN_(d.reason) }); });
    stLog_(W, rid, me, 0, { action: 'Возврат', object: lbl + ' — ' + it.name, after: stQ_(q, unit), reason: stN_(d.reason), docId: row.id, itemId: ships[0].itemId });
    return { W: W };
  },
  /* декларация: файл в закрытой папке Диска; повтор того же запроса находит уже загруженный файл по имени и не дублирует его */
  file: function (d, me, c, rid) {
    const it = c.item[d.itemId]; if (!it) stErr_('Товар склада не найден');
    if (d.batchId && !c.batch[d.batchId]) stErr_('Партия не найдена');
    const mime = String(d.mime || ''), name = stN_(d.name).replace(/[\\/:*?"<>|]+/g, ' ').slice(0, 150) || 'декларация';
    if (!ST_MIME[mime]) stErr_('Такой тип файла не поддерживается. Можно PDF, фото (JPG, PNG, WEBP, HEIC), Word, Excel');
    const data = String(d.data || ''); if (!data) stErr_('Пустой файл');
    if (data.length * 0.75 > ST_FILE_MAX) stErr_('Файл больше 20 МБ');
    const folder = stFolder_(), fname = rid + '__' + name; let file = null;
    const it2 = folder.getFilesByName ? folder.getFilesByName(fname) : null; if (it2 && it2.hasNext()) file = it2.next();
    if (!file) file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data), mime, fname));
    const b = d.batchId ? c.batch[d.batchId] : null, at = new Date().toISOString();
    const W = { sfiles: { upsert: [{ id: rid + ':f', name: name, itemName: it.name, batchName: b ? b.name : '(весь товар)', by: me.name, at: at, mime: mime, size: String(Math.round(data.length * 0.75)), itemId: it.id, batchId: b ? b.id : '', file: file.getId() }] } };
    stLog_(W, rid, me, 0, { action: 'Декларация прикреплена', object: it.name + (b ? ' — ' + b.name : ' (весь товар)'), after: name, itemId: it.id, batchId: b ? b.id : '' });
    return { W: W, out: { fileId: rid + ':f' } };
  },
  fileDel: function (d, me, c, rid) {
    const f = c.sfiles.find(x => x.id === String(d.id || '')); if (!f) stErr_('Файл уже удалён');
    if (me.role === 'staff' && f.by !== me.name) stErr_('Удалить чужой файл может только Даниил или Наталья');
    try { DriveApp.getFileById(f.file).setTrashed(true); } catch (x) {}
    const W = { sfiles: { del: [f.id] } }; stLog_(W, rid, me, 0, { action: 'Декларация удалена', object: f.itemName + (f.batchId ? ' — ' + f.batchName : ''), before: f.name, after: '—', itemId: f.itemId, batchId: f.batchId });
    return { W: W };
  }
};

/* ---------- журнал событий (лист «События») ---------- */
function log_(me, list) {
  if (!list || !list.length) return;
  const tz = Session.getScriptTimeZone() || 'Europe/Moscow';
  const rows = list.slice(0, 200).map(e => {
    let d = e.at ? new Date(e.at) : new Date(); if (isNaN(d.getTime()) || d > new Date(Date.now() + 600000)) d = new Date();
    return [Utilities.formatDate(d, tz, 'dd.MM.yyyy HH:mm:ss'), me.name, String(e.action || '').slice(0, 40), String(e.text || '').slice(0, 1000), String(e.docId || '').slice(0, 40)];
  });
  const sh = sheet_('events'), n = sh.getLastRow();
  const rng = sh.getRange(n + 1, 1, rows.length, 5); rng.setNumberFormat('@'); rng.setValues(rows);
  const total = sh.getLastRow() - 1;
  if (total > MAX_EVENTS + 200) sh.deleteRows(2, total - MAX_EVENTS);   // старые события удаляются, остаются последние MAX_EVENTS
}
function readEvents_(limit) {
  const sh = sheet_('events'), n = sh.getLastRow(); if (n < 2) return [];
  const from = Math.max(2, n - Math.min(limit, MAX_EVENTS + 200) + 1);
  return sh.getRange(from, 1, n - from + 1, 5).getDisplayValues().map(r => ({ at: r[0], user: r[1], action: r[2], text: r[3], docId: r[4] })).reverse();
}

function saveDoc_(e, me) {
  if (!e || !e.id) return { ok: false, error: 'пустой документ' };
  const rows = read_('journal'), sups = read_('suppliers');
  const year = String(e.date).slice(0, 4);
  const arch = r => { try { const k = JSON.parse(r.snap || '{}'); return !!(k.meta && k.meta.arch); } catch (x) { return false; } };
  // у каждой пары «поставщик + заказчик» своя нумерация
  const same = rows.filter(r => r.supplierId === e.supplierId && r.customerId === e.customerId);
  const clash = same.find(r => r.id !== e.id && String(r.number) === String(e.number) && !arch(r));
  const s = sups.find(x => x.id === e.supplierId);
  if (clash) {
    const max = same.reduce((m, r) => Math.max(m, parseInt(r.number, 10) || 0), 0);
    return { ok: true, conflict: true, next: max + 1 };
  }
  const was = rows.some(r => r.id === e.id);
  applySync_({ journal: { upsert: [e] } }, me);
  if (me) { const cn = nameMap_('customers'); let k = {}; try { k = JSON.parse(e.snap || '{}'); } catch (x) {}
    const pt = k && k.dr && k.dr.ship ? ', ' + k.dr.ship : '', who = (k && k.c && k.c.name) || cn[e.customerId] || '';
    log_(me, [{ action: 'Документ', text: (was ? 'Изменён документ № ' : 'Создан документ № ') + e.number + ' от ' + String(e.date).split('-').reverse().join('.') + ' — ' + who + pt + ', сумма ' + Number(e.sum || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽' + (s ? ' (' + s.name + ')' : ''), docId: e.id }]); }
  let next = parseInt(s && s.next, 10) || 1;
  const num = parseInt(e.number, 10);
  if (s && num && num + 1 > next) { next = num + 1; upsertList_('suppliers', { upsert: [{ id: s.id, next: String(next) }] }); }
  return { ok: true, next: next };
}

/* Optimistic concurrency: compare and merge under handle_'s script lock, before any mutation. */
function rowKey_(t, r) { return S[t].key ? String(r.id || '') : String(r.customerId || '') + '|' + String(r.productId || ''); }
function sameValue_(a,b) { return String(a == null ? '' : a) === String(b == null ? '' : b); }
function guardChanges_(input, base, protocol, me) {
  const changes = JSON.parse(JSON.stringify(input || {})), conflicts = [];
  if (protocol !== 1) return { ok: false, error: 'Обновите страницу: для сохранения нужна новая версия сайта.' };
  const allowed = lim_(me) ? ['journal','daytasks'] : me.role === 'staff' ? ['suppliers','products','prices','journal','daytasks'] : ['suppliers','customers','products','prices','specs','contracts','journal','daytasks'].concat(me.admin ? ['costs','doccosts','psettings','purchases','pother'] : []);
  for (const t of Object.keys(changes)) {
    if (t === 'events') continue;
    if (!allowed.includes(t)) return { ok: false, error: 'forbidden' };
    const part = changes[t]; if (!part) continue;
    const current = {}; read_(t).forEach(r => current[rowKey_(t,r)] = r);
    const cols = S[t].cols.map(c => c[0]).filter(k => !['customerName','supplierName','productName'].includes(k));
    const bases = (base || {})[t] || {};
    const check = (o, deleting) => {
      const id = deleting && S[t].key ? String(o) : rowKey_(t,o), now = current[id] || null;
      const known = Object.prototype.hasOwnProperty.call(bases,id), old = known ? bases[id] : null;
      let fields = [];
      if (!known && now) fields = ['_base'];
      else if (!old && now) { if (deleting || cols.some(k => o[k] != null && !sameValue_(o[k],now[k]))) fields = ['_created']; }
      else if (old && !now) { if (!deleting) fields = ['_deleted']; }
      else if (old && now) {
        if (deleting || t === 'journal') {
          if (cols.some(k => !sameValue_(old[k],now[k])) && (deleting || cols.some(k => o[k] != null && !sameValue_(o[k],now[k])))) fields = [t === 'journal' ? 'snap' : '_record'];
        } else fields = cols.filter(k => o[k] != null && !sameValue_(o[k],old[k]) && !sameValue_(now[k],old[k]) && !sameValue_(o[k],now[k]) && !(t === 'daytasks' && k === 'seen') && !(t === 'suppliers' && k === 'next'));
      }
      if (fields.length) conflicts.push({table:t,id,fields,current:now,base:old,proposed:deleting?null:o});
      if (deleting || !now || !old || fields.length || t === 'journal') return o;
      const merged = Object.assign({},now);
      cols.forEach(k => { if (o[k] != null && !sameValue_(o[k],old[k])) merged[k]=o[k]; });
      if (t === 'suppliers') merged.next = String(Math.max(+now.next||1,+o.next||1));
      return merged;
    };
    part.upsert = (part.upsert || []).map(o => check(o,false));
    (part.del || []).forEach(o => check(o,true));
    if (lim_(me) && t === 'journal' && ((part.del || []).length || part.upsert.some(o => !staffOk_(o)))) return {ok:false,error:'forbidden'};
  }
  return conflicts.length ? {ok:false,error:'edit_conflict',conflicts} : {changes};
}
function syncState_(changes, me) {
  const out = {};
  Object.keys(changes).filter(t => S[t] && t !== 'events').forEach(t => {
    const part=changes[t] || {}, keys={};
    (part.upsert||[]).forEach(o => keys[rowKey_(t,o)]=1);
    (part.del||[]).forEach(o => keys[S[t].key?String(o):rowKey_(t,o)]=1);
    const rows={}; read_(t).forEach(r => { const key=rowKey_(t,r); if(keys[key]) { if(t==='suppliers' && me.role==='staff'){delete r.stamp;delete r.sign;} rows[key]=r; } });
    out[t]={}; Object.keys(keys).forEach(k => out[t][k]=rows[k]||null);
  }); return out;
}
