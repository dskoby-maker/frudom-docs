/**
 * Хранилище для генератора документов «Фруктовый Дом» (1c.frudom.ru).
 * Данные лежат в этой Google Таблице на листах:
 * Поставщики, Заказчики, Товары, Цены, СТЕ, Контракты, Журнал.
 *
 * ПОЛЬЗОВАТЕЛИ И ПАРОЛИ — ниже. Чтобы сменить пароль, поменяйте цифры в кавычках
 * и сделайте «Развернуть» → «Управление развёртываниями» → карандаш → «Новая версия».
 * role: admin — всё, включая «Прибыль» и «События»; manager — всё, кроме этих двух вкладок;
 *       staff — только создавать документы, печатать их и менять в них количество.
 */
const USERS = {
  'Даниил':  { pass: 'ПАРОЛЬ', role: 'admin' },
  'Наталья': { pass: 'ПАРОЛЬ', role: 'manager' },
  'Гриша':   { pass: 'ПАРОЛЬ', role: 'staff' },
  'Склад':   { pass: 'ПАРОЛЬ', role: 'staff' }
};
const MAX_EVENTS = 3000;   // сколько последних событий хранить на листе «События»

const S = {
  suppliers: { title: 'Поставщики', key: 'id', cols: [
    ['name','Наименование'],['fio','ФИО'],['inn','ИНН'],['kpp','КПП'],['ogrn','ОГРНИП/ОГРН'],['ogrnDate','Дата ОГРНИП'],
    ['address','Адрес'],['phone','Телефон'],['bank','Банк'],['bik','БИК'],['rs','Р/с'],['ks','К/с'],
    ['vat','НДС'],['next','След. номер'],['accountant','Гл. бухгалтер'],['id','ID (не менять)'],['edo','ID участника ЭДО (Диадок)'],['stamp','Печать (картинка, заполняется с сайта)'],['sign','Подпись (картинка, заполняется с сайта)']]},
  customers: { title: 'Заказчики', key: 'id', cols: [
    ['name','Наименование'],['inn','ИНН'],['kpp','КПП'],['address','Юр. адрес'],['ship','Адрес доставки'],
    ['contract','Основание'],['ikz','ИКЗ'],['acct','Тип счёта'],['bank','Банк'],['bik','БИК'],['rs','Р/с / казн. счёт'],['ks','К/с / ЕКС'],
    ['id','ID (не менять)'],['branches','Обособленные подразделения (заполняется с сайта)'],['edo','ID участника ЭДО (Диадок)'],['points','Контакты точек доставки (заполняется с сайта)'],['t12c','Страна в ТОРГ-12 (1 = да)'],['nums','Нумерация: продолжить с № (заполняется с сайта)'],['signs','Подписи поставщика: 3 = во всех графах']]},
  products: { title: 'Товары', key: 'id', cols: [
    ['name','Наименование'],['code','Код'],['unit','Ед.'],['country','Страна (код)'],['price','Базовая цена'],['id','ID (не менять)'],['packs','Вес упаковки (заполняется с сайта)'],['aliases','Другие названия в заявках (заполняется с сайта)']]},
  prices: { title: 'Цены', key: null, cols: [
    ['customerName','Заказчик'],['productName','Товар'],['price','Цена'],['customerId','ID заказчика'],['productId','ID товара']]},
  specs: { title: 'СТЕ', key: null, cols: [
    ['customerName','Заказчик'],['productName','Товар'],['spec','ID позиции спецификации (СПГЗ)'],['ste','ID СТЕ'],['art','Артикул оферты'],
    ['customerId','ID заказчика'],['productId','ID товара']]},
  contracts: { title: 'Контракты', key: 'id', cols: [
    ['customerName','Заказчик'],['supplierName','Поставщик (исполнитель)'],['basis','Основание (номер и дата)'],['ikz','ИКЗ'],
    ['maxSum','Цена контракта'],['dateTo','Действует до'],['id','ID (не менять)'],['customerId','ID заказчика'],['supplierId','ID поставщика']]},
  costs: { title: 'Закупочные цены', key: 'id', cols: [
    ['productName','Товар'],['price','Закупочная цена'],['from','Действует с'],['customerName','Только для заказчика'],['note','Примечание'],
    ['id','ID (не менять)'],['productId','ID товара'],['customerId','ID заказчика']]},
  doccosts: { title: 'Себестоимость накладных', key: 'id', cols: [
    ['number','№'],['date','Дата'],['customerName','Заказчик'],['expense','Прочие расходы'],['note','Примечание'],
    ['id','ID документа'],['lines','Закупочные цены строк (не редактировать)']]},
  psettings: { title: 'Налоги для прибыли', key: 'id', cols: [
    ['name','Поставщик'],['tax','Налог, % от выручки'],['id','ID поставщика']]},
  daytasks: { title: 'Задачи на день', key: 'id', cols: [
    ['date','Дата'],['customerName','Заказчик'],['text','Задача'],['done','Выполнено'],['by','Кто добавил'],['created','Добавлено'],['doneBy','Кто выполнил'],['doneAt','Когда выполнено'],['id','ID'],['customerId','ID заказчика'],['seen','Кто видел']]},
  uprefs: { title: 'Настройки пользователей', key: 'id', cols: [
    ['id','Пользователь'],['data','Настройки (JSON, не редактировать)'],['updated','Изменено']]},
  events: { title: 'События', key: null, cols: [
    ['at','Время'],['user','Пользователь'],['action','Действие'],['text','Описание'],['docId','ID документа']]},
  journal: { title: 'Журнал', key: 'id', cols: [
    ['date','Дата'],['number','Номер'],['supplierName','Поставщик'],['customerName','Заказчик'],['sum','Сумма'],
    ['updated','Изменён'],['id','ID'],['supplierId','ID поставщика'],['customerId','ID заказчика'],['snap','Данные документа (не редактировать)']]}
};

function doGet(e)  { return out_(handle_(Object.assign({}, e && e.parameter))); }
function doPost(e) { let p = {}; try { p = JSON.parse(e.postData.contents); } catch (x) {} return out_(handle_(p)); }
function out_(o)   { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* кто вошёл: имя + пароль; старые версии страницы присылают только пароль администратора */
function auth_(p) {
  const name = String(p.user || ''), key = String(p.key || '');
  const mk = n => ({ name: n, role: USERS[n].role, admin: USERS[n].role === 'admin' });
  if (name) { const u = USERS[name]; return (u && key === u.pass) ? mk(name) : null; }
  for (const n in USERS) if (USERS[n].role === 'admin' && key === USERS[n].pass) return mk(n);
  return null;
}

/* сотрудник склада (staff): новый документ — только по ценам прайса; существующий — меняется только количество */
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

function handle_(p) {
  const me = auth_(p);
  if (!me) return { ok: false, error: 'auth' };
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (p.action === 'load') return { ok: true, me: me, prefs: (read_('uprefs').find(r => r.id === me.name) || {}).data || '', data: {
      suppliers: me.role === 'staff' ? read_('suppliers').map(s => { const x = Object.assign({}, s); delete x.stamp; delete x.sign; return x; }) : read_('suppliers'), customers: read_('customers'), products: read_('products'),
      prices: read_('prices'), specs: read_('specs'), contracts: read_('contracts'), journal: read_('journal').slice(-2000),
      daytasks: (function () { const d = new Date(); d.setDate(d.getDate() - 120); const from = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd'); return read_('daytasks').filter(r => String(r.date) >= from); })() } };
    if (p.action === 'login')   { log_(me, [{ action: 'Вход', text: 'Вход в систему' + (p.device ? ' (' + String(p.device).slice(0, 60) + ')' : '') }]); return { ok: true, me: me }; }
    if (p.action === 'profit')  { if (!me.admin) return { ok: false, error: 'forbidden' }; return { ok: true, costs: read_('costs'), doccosts: read_('doccosts'), psettings: read_('psettings') }; }
    if (p.action === 'setPrefs') { upsertList_('uprefs', { upsert: [{ id: me.name, data: String(p.data || '').slice(0, 20000), updated: new Date().toISOString() }] }); return { ok: true }; }
    if (p.action === 'events')  { if (!me.admin) return { ok: false, error: 'forbidden' }; return { ok: true, events: readEvents_(+p.limit || 1000) }; }
    if (p.action === 'sync')    { let ch = p.changes || {};
      if (me.role === 'staff') { const j = ch.journal ? { upsert: (ch.journal.upsert || []).filter(staffOk_), del: [] } : null;
        let dt = ch.daytasks || null; if (dt) { const own = {}; read_('daytasks').forEach(r => { if (r.by === me.name) own[r.id] = 1; }); dt = { upsert: dt.upsert || [], del: (dt.del || []).filter(id => own[id]) }; }
        ch = { journal: j, events: ch.events, daytasks: dt }; if (!j) delete ch.journal; if (!dt) delete ch.daytasks; }
      applySync_(ch, me); if (Array.isArray(ch.events)) log_(me, ch.events); return { ok: true }; }
    if (p.action === 'saveDoc') { if (me.role === 'staff' && !staffOk_(p.entry || {})) return { ok: false, error: 'forbidden' }; return saveDoc_(p.entry, me); }
    return { ok: false, error: 'unknown action' };
  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

function sheet_(t) {
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
  const sh = sheet_(t), n = sh.getLastRow(), cols = S[t].cols;
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, cols.length).getDisplayValues()
    .map(r => { const o = {}; cols.forEach((c, i) => o[c[0]] = r[i]); return o; })
    .filter(o => (t === 'prices' || t === 'specs') ? (o.customerId && o.productId) : o.id);
}

function write_(t, rows) {
  const sh = sheet_(t), n = sh.getLastRow(), cols = S[t].cols;
  if (n > 1) sh.getRange(2, 1, n - 1, cols.length).clearContent();
  if (!rows.length) return;
  const rng = sh.getRange(2, 1, rows.length, cols.length);
  rng.setNumberFormat('@');
  rng.setValues(rows.map(o => cols.map(c => o[c[0]] == null ? '' : String(o[c[0]]))));
}

function mergeSeen_(a, b) {
  const p = v => { try { const o = JSON.parse(v || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } };
  const A = p(a), B = p(b); Object.keys(B).forEach(k => { if (!A[k] || String(B[k]) < String(A[k])) A[k] = B[k]; });
  return Object.keys(A).length ? JSON.stringify(A) : '';
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
