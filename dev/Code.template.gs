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
    ['maxSum','Цена контракта'],['dateTo','Действует до'],['id','ID (не менять)'],['customerId','ID заказчика'],['supplierId','ID поставщика'],['eis','Сопоставление ЕИС (заполняется с сайта)']]},
  costs: { title: 'Закупочные цены', key: 'id', cols: [
    ['productName','Товар'],['price','Закупочная цена'],['from','Действует с'],['customerName','Только для заказчика'],['note','Примечание'],
    ['id','ID (не менять)'],['productId','ID товара'],['customerId','ID заказчика']]},
  doccosts: { title: 'Себестоимость накладных', key: 'id', cols: [
    ['number','№'],['date','Дата'],['customerName','Заказчик'],['expense','Прочие расходы'],['note','Примечание'],
    ['id','ID документа'],['lines','Закупочные цены строк (не редактировать)']]},
  psettings: { title: 'Налоги для прибыли', key: 'id', cols: [
    ['name','Поставщик'],['tax','Налог, % от выручки'],['id','ID поставщика']]},
  daytasks: { title: 'Задачи на день', key: 'id', cols: [
    ['date','Дата'],['customerName','Заказчик'],['text','Задача'],['done','Выполнено'],['by','Кто добавил'],['created','Добавлено'],['doneBy','Кто выполнил'],['doneAt','Когда выполнено'],['id','ID'],['customerId','ID заказчика'],['seen','Кто видел'],['addr','Точка доставки']]},
  taskphotos: { title: 'Фото задач', key: 'id', cols: [
    ['taskId','ID задачи'],['by','Кто добавил'],['created','Добавлено'],['file','Файл на Google Диске'],['w','Ширина'],['h','Высота'],['id','ID'],['thumb','Миниатюра (не редактировать)']]},
  uprefs: { title: 'Настройки пользователей', key: 'id', cols: [
    ['id','Пользователь'],['data','Настройки (JSON, не редактировать)'],['updated','Изменено']]},
  events: { title: 'События', key: null, cols: [
    ['at','Время'],['user','Пользователь'],['action','Действие'],['text','Описание'],['docId','ID документа']]},
  journal: { title: 'Журнал', key: 'id', cols: [
    ['date','Дата'],['number','Номер'],['supplierName','Поставщик'],['customerName','Заказчик'],['sum','Сумма'],
    ['updated','Изменён'],['id','ID'],['supplierId','ID поставщика'],['customerId','ID заказчика'],['snap','Данные документа (не редактировать)']]}
};

/* ДОСТУП К GOOGLE ДИСКУ (для фото задач и «Моего прайса»).
 * Один раз: вверху выберите функцию «authorize» → «Выполнить» → «Предоставить доступ» → ваш аккаунт →
 * «Дополнительно» → «Перейти к проекту» → «Разрешить». Потом «Развернуть» → «Управление развёртываниями» → карандаш → «Новая версия». */
function authorize() {
  DriveApp.getRootFolder().getName();
  const f = photoFolder_();
  Logger.log('Доступ к Диску есть. Папка для фото: ' + f.getName());
  Logger.log('Письма о заказах с сайта: осталось на сегодня ' + MailApp.getRemainingDailyQuota());
  return 'ok';
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
/* ===== Магазин frudom.ru: открытые действия без пароля (только каталог и приём заказа) ===== */
const SHOP_SHEET = 'Витрина', SHOP_ORDERS = 'Заказы с сайта';
const SHOP_ORDER_COLS = ['№ заказа','Время','Тип','Статус','Имя / компания','Телефон','Email','Адрес доставки','Комментарий','ИНН','КПП','ОГРН','Юр. адрес',
  'Зона','Товары','Сумма товаров','Доставка','НДС','Итого (сайт)','Итого (проверка сервера)','Состав (JSON)'];
const num_ = v => { const x = parseFloat(String(v == null ? '' : v).replace(/\s| /g, '').replace(',', '.')); return isNaN(x) ? 0 : x; };
const str_ = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n || 200);

function shopItems_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHOP_SHEET);
  if (!sh) return null;
  const n = sh.getLastRow();
  if (n < 2) return [];
  const rows = sh.getRange(2, 1, n - 1, 16).getDisplayValues(), out = [];
  rows.forEach((r, i) => {
    const name = str_(r[0], 120), p = num_(r[8]);
    if (!name || !(p > 0) || String(r[2]).trim().toLowerCase() !== 'да') return;
    const o = { id: i + 1, n: name, c: str_(r[1], 60) || 'Другое', o: num_(r[3]) || 9999, p: p, u: 'кг', w: String(r[13]).trim().toLowerCase() === 'да' ? 1 : 0, vat: num_(r[14]) };
    const pack = str_(r[10], 30).toLowerCase(), step = num_(r[11]), th = num_(r[12]), pk = num_(r[9]);
    if (pack && step > 0 && th > 0 && pk > 0) Object.assign(o, { pk: pk, pack: pack, step: step, th: th });
    if (/^https:\/\//.test(r[15])) o.img = str_(r[15], 500);
    out.push(o);
  });
  return out.sort((a, b) => a.o - b.o);
}

function shopCatalog_() {
  const items = shopItems_();
  if (!items) return { ok: false, error: 'нет листа «' + SHOP_SHEET + '»' };
  return { ok: true, updated: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm'), items: items };
}

function shopOrder_(p) {
  let o = p.order; if (typeof o === 'string') { try { o = JSON.parse(o); } catch (x) { o = null; } }
  if (!o || typeof o !== 'object') return { ok: false, error: 'пустой заказ' };
  if (o.hp) return { ok: true, no: 0 };                       /* ловушка для роботов: молча игнорируем */
  const phone = str_(o.phone, 40), who = o.who === 'nds' ? 'nds' : 'nonds', zone = o.zone === 'mo' ? 'mo' : 'msk', co = o.company || {};
  if (phone.replace(/\D/g, '').length < 10) return { ok: false, error: 'укажите телефон' };
  if (who === 'nds' && (!str_(co.inn) || !str_(co.name))) return { ok: false, error: 'укажите ИНН и название компании' };
  const items = shopItems_() || [], byName = {}; items.forEach(x => byName[x.n] = x);
  const lines = (Array.isArray(o.items) ? o.items : []).slice(0, 80).map(l => {
    const it = byName[str_(l.n, 120)], k = Math.max(0, num_(l.qty)), pack = l.mode === 'pack';
    const up = !it ? num_(l.price) : (!it.pk || pack || k >= it.th) ? it.p : it.pk;
    return { n: str_(l.n, 120), qty: k, mode: pack ? 'pack' : 'kg', price: up, sum: Math.round(k * up * 100) / 100, known: !!it };
  }).filter(l => l.qty > 0);
  if (!lines.length) return { ok: false, error: 'в заказе нет товаров' };
  const goods = lines.reduce((s, l) => s + l.sum, 0), thr = zone === 'msk' ? 30000 : 50000;
  const fee = goods >= thr ? 0 : (zone === 'msk' ? 690 : 1290), vat = who === 'nds' ? Math.round((goods + fee) * 0.10) : 0, total = Math.round((goods + fee + vat) * 100) / 100;
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  let no;
  try {
    const pr = PropertiesService.getScriptProperties();
    no = (parseInt(pr.getProperty('shopNo') || '1000', 10) || 1000) + 1; pr.setProperty('shopNo', String(no));
    const ss = SpreadsheetApp.getActive(); let sh = ss.getSheetByName(SHOP_ORDERS);
    if (!sh) { sh = ss.insertSheet(SHOP_ORDERS); sh.getRange(1, 1, 1, SHOP_ORDER_COLS.length).setValues([SHOP_ORDER_COLS]); sh.setFrozenRows(1); }
    const list = lines.map(l => l.n + ' — ' + String(l.qty).replace('.', ',') + ' кг × ' + l.price + ' ₽' + (l.known ? '' : ' (нет на витрине!)')).join('\n');
    const row = [no, Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm'), who === 'nds' ? 'С НДС (счёт)' : 'Без НДС', 'Новый',
      who === 'nds' ? str_(co.name) : str_(o.name, 100), phone, str_(who === 'nds' ? co.email : o.email, 100), str_(o.addr || co.daddr, 300), str_(o.comment, 500),
      str_(co.inn, 12), str_(co.kpp, 9), str_(co.ogrn, 15), str_(co.addr, 300), zone === 'msk' ? 'Москва' : 'МО', list,
      Math.round(goods * 100) / 100, fee, vat, num_(o.total), total, JSON.stringify(lines).slice(0, 45000)];
    sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
    try { if (typeof MailApp !== 'undefined') MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Заказ с сайта № ' + no + ' — ' + total + ' ₽',
      'Новый заказ с сайта frudom.ru\n\n' + SHOP_ORDER_COLS.slice(0, 20).map((h, i) => h + ': ' + row[i]).join('\n')); } catch (x) {}
  } finally { lock.releaseLock(); }
  return { ok: true, no: no, total: total, goods: goods, fee: fee, vat: vat };
}

function handle_(p) {
  if (p.action === 'shopCatalog') return shopCatalog_();
  if (p.action === 'shopOrder') return shopOrder_(p);
  if (typeof USERS === 'undefined') return { ok: false, error: 'в Apps Script нет файла «Пароли» — создайте его по инструкции (dev/Passwords.template.gs)' };
  const me = auth_(p);
  if (!me) return { ok: false, error: 'auth' };
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (p.action === 'load' && me.admin) seedEis_();
    if (p.action === 'load') return { ok: true, concurrency: 1, eis: 1, me: me, prefs: (read_('uprefs').find(r => r.id === me.name) || {}).data || '', data: {
      suppliers: me.role === 'staff' ? read_('suppliers').map(s => { const x = Object.assign({}, s); delete x.stamp; delete x.sign; return x; }) : read_('suppliers'), customers: read_('customers'), products: read_('products'),
      prices: read_('prices'), specs: read_('specs'), contracts: read_('contracts'), journal: read_('journal').slice(-2000),
      daytasks: (function () { const d = new Date(); d.setDate(d.getDate() - 120); const from = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        const ph = {}; photosClean_().forEach(r => (ph[r.taskId] = ph[r.taskId] || []).push({ id: r.id, by: r.by, w: +r.w || 0, h: +r.h || 0 }));
        return read_('daytasks').filter(r => String(r.date) >= from).map(r => { if (ph[r.id]) r.photos = ph[r.id]; return r; }); })() } };
    if (p.action === 'login')   { log_(me, [{ action: 'Вход', text: 'Вход в систему' + (p.device ? ' (' + String(p.device).slice(0, 60) + ')' : '') }]); return { ok: true, me: me }; }
    if (p.action === 'profit')  { if (!me.admin) return { ok: false, error: 'forbidden' }; return { ok: true, costs: read_('costs'), doccosts: read_('doccosts'), psettings: read_('psettings') }; }
    if (p.action === 'setPrefs') { upsertList_('uprefs', { upsert: [{ id: me.name, data: String(p.data || '').slice(0, 20000), updated: new Date().toISOString() }] }); return { ok: true }; }
    if (p.action === 'events')  { if (!me.admin) return { ok: false, error: 'forbidden' }; return { ok: true, events: readEvents_(+p.limit || 1000) }; }
    if (p.action === 'sync') { const g = guardChanges_(p.changes, p.base, p.protocol, me); if (g.error) return g; syncIn_(g.changes, me); return { ok: true, concurrency: 1, accepted: syncState_(g.changes, me) }; }
    if (p.action === 'plist')    { if (me.role === 'staff') return { ok: false, error: 'forbidden' }; return plist_(p, me); }
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
    if (ch.psettings) { const sn = nameMap_('suppliers'); (ch.psettings.upsert || []).forEach(o => o.name = sn[o.id] || ''); upsertList_('psettings', ch.psettings); }
  }
  if (me && ev.length) log_(me, ev);
}

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
  applySync_({ journal: { upsert: [e] } });
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
  const allowed = lim_(me) ? ['journal','daytasks'] : me.role === 'staff' ? ['suppliers','products','prices','journal','daytasks'] : ['suppliers','customers','products','prices','specs','contracts','journal','daytasks'].concat(me.admin ? ['costs','doccosts','psettings'] : []);
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
