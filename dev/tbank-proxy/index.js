// Посредник для «Документы ФД»: Google не может достучаться до Т-Бизнеса и до почтовых ящиков по IMAP, а Яндекс Облако (Россия) — может.
// Банк: функция только пересылает ЧТЕНИЕ счетов и выписки (T-API) и ничего не хранит. Платить через неё нельзя.
// Почта (/mail/…): читает письма из ящика по IMAP и отправляет ответы по SMTP; логин и пароль ящика приходят из скрипта таблицы в каждом запросе, здесь ничего не хранится.
// Яндекс Облако → Cloud Functions → среда Node.js 22, точка входа index.handler, переменная окружения SECRET, таймаут 60 с, память 256 МБ.
const https = require('https'), tls = require('tls'), crypto = require('crypto');
const ALLOWED = [/^\/api\/v4\/bank-accounts(\?.*)?$/, /^\/api\/v1\/statement\?[\w=&%.:\-+]*$/];

function get(path, token, strict) {
  return new Promise((resolve, reject) => {
    const req = https.request({ host: 'business.tbank.ru', path: '/openapi' + path, method: 'GET', timeout: 25000,
      rejectUnauthorized: strict,   // у банка сертификат Минцифры; если Node ему не доверяет — повтор без проверки (только чтение)
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } }, res => {
      let b = ''; res.setEncoding('utf8'); res.on('data', d => b += d); res.on('end', () => resolve({ code: res.statusCode, body: b }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject); req.end();
  });
}

module.exports.handler = async (event) => {
  const out = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(obj) });
  const h = event.headers || {}, key = h['X-Proxy-Key'] || h['x-proxy-key'] || '';
  if (!process.env.SECRET || key !== process.env.SECRET) return out(403, { error: 'wrong secret' });
  let p = {};
  try { p = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}')); } catch (e) { return out(400, { error: 'bad json' }); }
  const path = String(p.path || '');
  if (path === '/ping') return out(200, { ok: true, proxy: 2, mail: 2 });
  if (/^\/mail\//.test(path)) { try { return out(200, await mailOp(path, p)); } catch (e) { return out(200, { error: String(e && e.message || e).slice(0, 300) }); } }
  if (!ALLOWED.some(r => r.test(path))) return out(400, { error: 'path not allowed' });
  try {
    let r;
    try { r = await get(path, String(p.token || ''), true); }
    catch (e) { if (!/certif|self.signed|unable to (get|verify)|SSL|TLS/i.test(String(e.message))) throw e; r = await get(path, String(p.token || ''), false); }
    return out(200, { code: r.code, body: r.body });
  } catch (e) { return out(502, { error: 'bank: ' + String(e.message || e) }); }
};

/* ===================== ПОЧТА: IMAP (чтение) и SMTP (отправка) — только встроенные модули Node.js =====================
   /mail/test  {acc}                         — войти в ящик (IMAP) и на сервер отправки (SMTP), ничего не меняя
   /mail/fetch {acc, since, uidv, days, max} — новые письма папки «Входящие» (UID > since), не больше max за раз; письмо НЕ помечается прочитанным
   /mail/att   {acc, uid, idx}               — одно вложение письма целиком (до 2,5 МБ)
   /mail/send  {acc, msg}                    — отправить письмо и положить копию в «Отправленные»
   acc = {user, pass, ih, ip, sh, sp}: логин, пароль (для внешних приложений), IMAP-сервер и порт (993), SMTP-сервер и порт (465). */
const MAIL_TMO = 25000, MAIL_BUDGET = 2400000;
/* большие письма (импорт старой почты с тяжёлыми вложениями): больше MAIL_BIG читаем только начало — текст и заголовки,
   за один раз забираем не больше MAIL_BATCH байт писем, иначе функции не хватает памяти и она падает («user code crashed») */
const MAIL_BIG = 12 * 1048576, MAIL_HEAD = 600000, MAIL_BATCH = 24 * 1048576;
const tlsOpt = h => ({ host: h, servername: h, rejectUnauthorized: process.env.MAIL_INSECURE !== '1' });
async function mailOp(path, p) {
  const a = p.acc || {};
  if (!a.user || !a.pass || !a.ih) throw new Error('не указан ящик (логин, пароль, сервер)');
  if (path === '/mail/test') {
    const r = { imap: '', smtp: '' };
    try { const c = await imapOpen(a); const box = await c.select('INBOX'); r.imap = 'ok'; r.exists = box.exists; r.uidv = box.uidv; await c.logout(); } catch (e) { r.imap = String(e.message || e); }
    if (a.sh) { try { const s = await smtpOpen(a); await s.quit(); r.smtp = 'ok'; } catch (e) { r.smtp = String(e.message || e); } }
    return r;
  }
  if (path === '/mail/fetch') {
    const c = await imapOpen(a);
    try {
      const box = await c.select('INBOX'); let since = +p.since || 0;
      if (p.uidv && String(p.uidv) !== String(box.uidv)) since = 0;   // ящик пересоздан — UID начались заново
      let uids;
      if (since) uids = (await c.search('UID ' + (since + 1) + ':*')).filter(u => u > since);
      else { const d = new Date(Date.now() - (Math.min(+p.days || 30, 365)) * 864e5), M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        uids = await c.search('SINCE ' + d.getUTCDate() + '-' + M[d.getUTCMonth()] + '-' + d.getUTCFullYear()); }
      uids.sort((x, y) => x - y); const max = Math.min(+p.max || 15, 40), want = since ? uids.slice(0, max) : uids.slice(-max);
      const msgs = []; let budget = MAIL_BUDGET, more = since ? uids.length > want.length : false, last = since, took = 0;
      const sizes = want.length ? await c.sizes(want) : {};
      for (const uid of want) {
        const sz = sizes[uid] || 0, big = sz > MAIL_BIG;
        if (msgs.length && took + Math.min(sz, MAIL_BIG) > MAIL_BATCH) { more = true; break; }
        const raw = big ? await c.fetchHead(uid, MAIL_HEAD) : await c.fetchRaw(uid); if (!raw) { last = uid; continue; }
        took += raw.length;
        let m; try { m = mimeMsg(raw); } catch (e) { m = { date: new Date().toISOString(), from: { n: '', a: '' }, to: [], cc: [], replyTo: '', subject: '(письмо не разобрано)', msgid: '', inReply: '', refs: '', text: 'Письмо не удалось разобрать — откройте его в обычной почте.', html: '', atts: [] }; }
        m.uid = uid; m.size = sz || raw.length;
        if (big) { m.big = 1;
          m.text = 'Письмо очень большое (' + (sz / 1048576).toFixed(1).replace('.', ',') + ' МБ) — на сайт пришёл только текст. Вложения откройте в обычной почте.\n\n' + m.text; }
        let cost = Buffer.byteLength(m.text) + Buffer.byteLength(m.html || '');
        if (cost > budget && msgs.length) { more = true; break; }
        m.atts.forEach(x => { const b64 = x.buf.toString('base64'); if (b64.length <= budget - cost && b64.length < 1800000) { x.data = b64; cost += b64.length; } delete x.buf; });
        budget -= cost; msgs.push(m); last = uid;
      }
      return { uidv: box.uidv, exists: box.exists, last: Math.max(last, since), more, msgs };
    } finally { c.logout().catch(() => {}); }
  }
  if (path === '/mail/att') {
    const c = await imapOpen(a);
    try { await c.select('INBOX'); const sz = (await c.sizes([+p.uid]))[+p.uid] || 0;
      if (sz > 40 * 1048576) throw new Error('письмо больше 40 МБ — откройте вложение в обычной почте');
      const raw = await c.fetchRaw(+p.uid); if (!raw) throw new Error('письмо не найдено в ящике (удалено?)');
      const x = mimeMsg(raw).atts[+p.idx || 0]; if (!x) throw new Error('вложение не найдено');
      if (x.buf.length > 2500000) throw new Error('файл больше 2,5 МБ — откройте его в обычной почте');
      return { name: x.name, mime: x.mime, size: x.buf.length, data: x.buf.toString('base64') };
    } finally { c.logout().catch(() => {}); }
  }
  if (path === '/mail/send') {
    const m = p.msg || {}, to = [].concat(m.to || [], m.cc || []).map(String).filter(Boolean);
    if (!to.length) throw new Error('не указан получатель');
    const raw = mimeBuild(Object.assign({ from: a.email || a.user }, m));
    const s = await smtpOpen(a);
    try { await s.send(a.email || a.user, to, raw); } finally { s.quit().catch(() => {}); }
    let saved = false; try { const c = await imapOpen(a); try { saved = await c.appendSent(raw); } finally { c.logout().catch(() => {}); } } catch (e) {}
    return { ok: true, saved, msgid: (raw.toString('latin1').match(/^Message-ID: (<[^>]+>)/mi) || [])[1] || '' };
  }
  throw new Error('неизвестная команда почты');
}
/* ---- IMAP ---- */
function imapOpen(a) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect(Object.assign({ port: +a.ip || 993 }, tlsOpt(a.ih))); let buf = Buffer.alloc(0), cur = null, need = null, n = 0, wait = null, greet = true;
    const fail = e => { if (wait) { const w = wait; wait = null; w.rej(e); } else reject(e); try { sock.destroy(); } catch (x) {} };
    sock.setTimeout(MAIL_TMO, () => fail(new Error('почтовый сервер не отвечает (IMAP)')));
    sock.on('error', e => fail(new Error('IMAP: ' + e.message)));
    const onResp = r => {
      if (greet) { greet = false; if (!/^\* (OK|PREAUTH)/i.test(r.text)) return reject(new Error('IMAP: сервер не готов')); login(); return; }
      if (!wait) return;
      if (r.text.startsWith('+')) { if (wait.cont) wait.cont(); return; }
      if (r.text.startsWith(wait.tag + ' ')) { const w = wait; wait = null; if (/^\S+ OK/i.test(r.text)) w.res(w.un); else w.rej(new Error(r.text.replace(/^\S+ (NO|BAD) ?/i, '').replace(/\[[^\]]*\]\s*/, '') || 'ошибка IMAP')); return; }
      wait.un.push(r);
    };
    let parts = [], plen = 0;   // кусочки большого письма копим списком и склеиваем один раз (иначе память и время растут квадратично)
    sock.on('data', d => {
      if (need != null && buf.length + plen + d.length < need) { if (buf.length) { parts.push(buf); plen += buf.length; buf = Buffer.alloc(0); } parts.push(d); plen += d.length; return; }
      if (parts.length) { parts.push(buf, d); buf = Buffer.concat(parts); parts = []; plen = 0; } else buf = buf.length ? Buffer.concat([buf, d]) : d;
      for (;;) {
        if (need != null) { if (buf.length < need) return; cur.lits.push(Buffer.from(buf.subarray(0, need))); buf = buf.subarray(need); need = null; continue; }
        const i = buf.indexOf('\r\n'); if (i < 0) return;
        const line = buf.subarray(0, i).toString('utf8'); buf = buf.subarray(i + 2);
        if (!cur) cur = { text: '', lits: [] }; cur.text += line;
        const m = line.match(/\{(\d+)\}$/); if (m) { need = +m[1]; cur.text += '\u0000'; continue; }
        const r = cur; cur = null; onResp(r); } });
    const cmd = (c, cont) => new Promise((res, rej) => { const tag = 'A' + (++n); wait = { tag, res, rej, un: [], cont }; sock.write(tag + ' ' + c + '\r\n'); });
    const q = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    const api = {
      async select(b) { const un = await cmd('SELECT ' + q(b)); const t = un.map(x => x.text).join('\n');
        return { uidv: +((t.match(/UIDVALIDITY (\d+)/i) || [])[1] || 0), exists: +((t.match(/\* (\d+) EXISTS/i) || [])[1] || 0) }; },
      async search(crit) { const un = await cmd('UID SEARCH ' + crit); const L = [];
        un.forEach(x => { const m = x.text.match(/^\* SEARCH ?(.*)$/i); if (m) m[1].trim().split(/\s+/).filter(Boolean).forEach(v => L.push(+v)); }); return L; },
      async sizes(L) { const un = await cmd('UID FETCH ' + L.join(',') + ' (UID RFC822.SIZE)'), o = {};
        un.forEach(x => { const u = x.text.match(/UID (\d+)/i), z = x.text.match(/RFC822\.SIZE (\d+)/i); if (u && z) o[+u[1]] = +z[1]; }); return o; },
      async fetchHead(uid, n) { const un = await cmd('UID FETCH ' + uid + ' (UID BODY.PEEK[]<0.' + n + '>)'); const r = un.find(x => x.lits.length && new RegExp('UID ' + uid + '\\b').test(x.text)) || un.find(x => x.lits.length); return r ? r.lits[0] : null; },
      async fetchRaw(uid) { const un = await cmd('UID FETCH ' + uid + ' (UID BODY.PEEK[])'); const r = un.find(x => x.lits.length && new RegExp('UID ' + uid + '\\b').test(x.text)) || un.find(x => x.lits.length); return r ? r.lits[0] : null; },
      async appendSent(raw) { const un = await cmd('LIST "" "*"'); let box = '';
        for (const x of un) { const m = x.text.match(/^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$/i); if (!m) continue; const nm = m[2].replace(/^"|"$/g, '');
          if (/\\Sent/i.test(m[1])) { box = nm; break; } if (!box && /^(Sent|Sent Items|Отправленные|INBOX[./]Sent)$/i.test(nm)) box = nm; }
        if (!box) return false;
        await cmd('APPEND ' + q(box) + ' (\\Seen) {' + raw.length + '}', () => { sock.write(raw); sock.write('\r\n'); }); return true; },
      async logout() { try { await cmd('LOGOUT'); } catch (e) {} try { sock.end(); } catch (e) {} }
    };
    const login = () => cmd('LOGIN ' + q(a.user) + ' ' + q(a.pass)).then(() => resolve(api), e => { reject(new Error('ящик не пустил: ' + e.message + ' — проверьте логин и пароль для внешних приложений')); try { sock.destroy(); } catch (x) {} });
  });
}
/* ---- SMTP (порт 465, сразу шифрованное соединение) ---- */
function smtpOpen(a) {
  return new Promise((resolve, reject) => {
    const sock = tls.connect(Object.assign({ port: +a.sp || 465 }, tlsOpt(a.sh))); let buf = '', lines = [], wait = null;
    const fail = e => { if (wait) { const w = wait; wait = null; w.rej(e); } else reject(e); try { sock.destroy(); } catch (x) {} };
    sock.setTimeout(MAIL_TMO, () => fail(new Error('сервер отправки не отвечает (SMTP)')));
    sock.on('error', e => fail(new Error('SMTP: ' + e.message)));
    sock.setEncoding('utf8');
    sock.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\r\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 2); lines.push(l);
      if (/^\d{3} /.test(l) || /^\d{3}$/.test(l)) { const code = +l.slice(0, 3), all = lines; lines = []; if (wait) { const w = wait; wait = null; w.res({ code, text: all.join('\n') }); } } } });
    const next = () => new Promise((res, rej) => { wait = { res, rej }; });
    const say = async (c, ok) => { const p = next(); if (c != null) sock.write(c + '\r\n'); const r = await p; if (ok && !ok.test(String(r.code))) { const e = new Error('SMTP: ' + r.text.replace(/^\d{3}[- ]/gm, '').slice(0, 200)); e.code = r.code; throw e; } return r; };
    (async () => {
      await say(null, /^220$/);
      const e = await say('EHLO frudom', /^250$/);
      if (/AUTH[ =][^\n]*PLAIN/i.test(e.text)) await say('AUTH PLAIN ' + Buffer.from('\0' + a.user + '\0' + a.pass).toString('base64'), /^235$/);
      else { await say('AUTH LOGIN', /^334$/); await say(Buffer.from(a.user).toString('base64'), /^334$/); await say(Buffer.from(a.pass).toString('base64'), /^235$/); }
      resolve({
        async send(from, to, raw) { await say('MAIL FROM:<' + from + '>', /^250$/); for (const t of to) await say('RCPT TO:<' + mailAddr(t).a + '>', /^25[01]$/);
          await say('DATA', /^354$/); const body = raw.toString('latin1').replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
          const p = next(); sock.write(Buffer.from(body + (body.endsWith('\r\n') ? '' : '\r\n') + '.\r\n', 'latin1')); const r = await p; if (!/^250$/.test(String(r.code))) throw new Error('SMTP: ' + r.text.slice(0, 200)); },
        async quit() { try { await say('QUIT'); } catch (x) {} try { sock.end(); } catch (x) {} } });
    })().catch(e => { reject(e.code === 535 || e.code === 534 || /authent/i.test(e.message) ? new Error('сервер отправки не пустил: ' + e.message.replace(/^SMTP: /, '') + ' — проверьте пароль для внешних приложений') : e); try { sock.destroy(); } catch (x) {} });
  });
}
/* ---- разбор письма (MIME) ---- */
function mailAddr(s) { s = String(s || '').trim(); const m = s.match(/^(.*?)\s*<([^>]+)>\s*$/); return m ? { n: m[1].replace(/^"|"$/g, '').trim(), a: m[2].trim() } : { n: '', a: s.replace(/^"|"$/g, '') }; }
function addrList(s) { const out = []; let cur = '', q = false, ang = 0; for (const ch of String(s || '')) { if (ch === '"') q = !q; if (!q && ch === '<') ang++; if (!q && ch === '>') ang--; if (ch === ',' && !q && ang <= 0) { out.push(cur); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur);
  return out.map(x => mailAddr(decWords(x))).filter(x => x.a); }
function cs(label) { label = String(label || 'utf-8').trim().toLowerCase().replace(/^"|"$/g, ''); if (/^(cp|win|windows)[-_]?1251$/.test(label)) label = 'windows-1251'; if (/^(us-ascii|ascii)$/.test(label)) label = 'utf-8';
  try { return new TextDecoder(label); } catch (e) { return new TextDecoder('utf-8'); } }
function decBytes(b, label) { return cs(label).decode(b); }
function qpBytes(s) { const out = []; s = s.replace(/=\r?\n/g, ''); for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) { out.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else out.push(s.charCodeAt(i) & 255); } return Buffer.from(out); }
function decWords(s) { return String(s || '').replace(/(=\?[^?]+\?[BbQq]\?[^?]*\?=)\s+(?==\?)/g, '$1').replace(/=\?([^?*]+)(?:\*[^?]*)?\?([BbQq])\?([^?]*)\?=/g, (_, c, e, t) => {
  try { const b = /b/i.test(e) ? Buffer.from(t, 'base64') : qpBytes(t.replace(/_/g, ' ')); return decBytes(b, c); } catch (x) { return t; } }); }
function rawHead(b) { /* заголовки без кодировки бывают в UTF-8 или в 1251 */ try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { return decBytes(b, 'windows-1251'); } }
function headers(txt) { const H = {}; txt.replace(/\r?\n[ \t]+/g, ' ').split(/\r?\n/).forEach(l => { const i = l.indexOf(':'); if (i > 0) { const k = l.slice(0, i).trim().toLowerCase(); if (!(k in H)) H[k] = l.slice(i + 1).trim(); } }); return H; }
function params(v) { const parts = []; let cur = '', q = false; for (const ch of String(v || '')) { if (ch === '"') q = !q; if (ch === ';' && !q) { parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur);
  const o = { _: parts.shift().trim().toLowerCase() }, star = {};
  parts.forEach(x => { const i = x.indexOf('='); if (i < 0) return; let k = x.slice(0, i).trim().toLowerCase(), val = x.slice(i + 1).trim().replace(/^"|"$/g, '');
    const m = k.match(/^([^*]+)\*(\d+)?(\*)?$/); if (m) { (star[m[1]] = star[m[1]] || []).push({ n: +(m[2] || 0), v: val, enc: !!m[3] || (!m[2] && /\*$/.test(k)) }); } else o[k] = decWords(val); });
  Object.keys(star).forEach(k => { const L = star[k].sort((x, y) => x.n - y.n); let charset = 'utf-8', bytes = [];
    L.forEach((x, i) => { let v = x.v; if (x.enc) { if (i === 0) { const mm = v.match(/^([^']*)'[^']*'(.*)$/); if (mm) { charset = mm[1] || charset; v = mm[2]; } }
        bytes.push(Buffer.from(v.replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))), 'latin1')); } else bytes.push(Buffer.from(v, 'utf8')); });
    o[k] = decBytes(Buffer.concat(bytes), charset); });
  return o; }
function splitHB(b) { let i = b.indexOf('\r\n\r\n'), sep = 4; const j = b.indexOf('\n\n'); if (i < 0 || (j >= 0 && j < i)) { i = j; sep = 2; } if (i < 0) return { h: b, body: Buffer.alloc(0) }; return { h: b.subarray(0, i), body: b.subarray(i + sep) }; }
function transfer(body, enc) { enc = String(enc || '').toLowerCase(); if (enc === 'base64') return Buffer.from(body.toString('latin1').replace(/[^A-Za-z0-9+/=]/g, ''), 'base64'); if (enc === 'quoted-printable') return qpBytes(body.toString('latin1')); return body; }
function htmlText(h) { return String(h || '').replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|h\d|li|table|blockquote)>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<\/t[dh]>/gi, '\t').replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]+);/gi, (_, d) => String.fromCodePoint(parseInt(d, 16))).replace(/&amp;/g, '&')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(); }
function walk(b, out, depth) {
  const { h, body } = splitHB(b), H = headers(rawHead(h)), ct = params(H['content-type'] || 'text/plain'), cd = params(H['content-disposition'] || ''), type = ct._ || 'text/plain';
  if (/^multipart\//.test(type) && ct.boundary && depth < 8) {
    const bnd = Buffer.from('--' + ct.boundary), parts = []; let pos = body.indexOf(bnd);
    while (pos >= 0) { let start = body.indexOf('\n', pos); if (start < 0) break; start++; const nx = body.indexOf(bnd, start); if (nx < 0) break; let end = nx; if (body[end - 1] === 10) end--; if (body[end - 1] === 13) end--; parts.push(body.subarray(start, end)); if (body.subarray(nx + bnd.length, nx + bnd.length + 2).toString() === '--') break; pos = nx; }
    parts.forEach(p => walk(p, out, depth + 1)); return;
  }
  const data = transfer(body, H['content-transfer-encoding']), name = cd.filename || ct.name || '';
  const isAtt = /attachment/.test(cd._) || (name && !/^text\/(plain|html)$/.test(type)) || (/^message\/rfc822/.test(type));
  if (!isAtt && type === 'text/plain') { out.text.push(decBytes(data, ct.charset)); return; }
  if (!isAtt && type === 'text/html') { out.html.push(decBytes(data, ct.charset)); return; }
  if (!name && /inline/.test(cd._ || 'inline') && /^image\//.test(type) && H['content-id']) return;   // картинки внутри оформления письма
  if (!name && !/^(application|image|message)\//.test(type)) return;
  out.atts.push({ name: name || ('вложение' + (out.atts.length + 1) + (/rfc822/.test(type) ? '.eml' : '')), mime: type, buf: data, size: data.length });
}
function mimeMsg(raw) {
  const { h } = splitHB(raw), H = headers(rawHead(h)), out = { text: [], html: [], atts: [] }; walk(raw, out, 0);
  const html = out.html.join('\n'), text = (out.text.join('\n\n').trim() || htmlText(html)).replace(/\r\n/g, '\n');
  const d = new Date(H.date || ''), fr = addrList(H.from)[0] || { n: '', a: '' };
  return { date: isNaN(d) ? new Date().toISOString() : d.toISOString(), from: fr, to: addrList(H.to), cc: addrList(H.cc), replyTo: (addrList(H['reply-to'])[0] || {}).a || '',
    subject: decWords(H.subject || '').replace(/\s+/g, ' ').trim(), msgid: (H['message-id'] || '').trim(), inReply: (H['in-reply-to'] || '').trim(), refs: (H.references || '').trim().slice(0, 2000),
    text: text.slice(0, 60000), html: html.length > 400000 ? '' : html, atts: out.atts };
}
/* ---- сборка письма для отправки ---- */
function encW(s) { s = String(s || ''); return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + Buffer.from(s).toString('base64') + '?='; }
function encAddr(x) { const o = typeof x === 'string' ? mailAddr(x) : x; return o.n ? encW(o.n) + ' <' + o.a + '>' : o.a; }
function b64lines(b) { return b.toString('base64').replace(/.{76}/g, '$&\r\n'); }
function mimeBuild(m) {
  const B = 'fd' + crypto.randomBytes(12).toString('hex'), dom = String(m.from).split('@')[1] || 'frudom.ru', id = '<' + crypto.randomBytes(10).toString('hex') + '@' + dom + '>';
  const H = ['From: ' + encAddr({ n: m.fromName || '', a: m.from }), 'To: ' + [].concat(m.to || []).map(encAddr).join(', ')];
  if (m.cc && m.cc.length) H.push('Cc: ' + [].concat(m.cc).map(encAddr).join(', '));
  H.push('Subject: ' + encW(m.subject || ''), 'Date: ' + new Date().toUTCString().replace('GMT', '+0000'), 'Message-ID: ' + id, 'MIME-Version: 1.0');
  if (m.inReply) H.push('In-Reply-To: ' + m.inReply); if (m.refs) H.push('References: ' + String(m.refs).slice(0, 1800));
  const txt = 'Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64lines(Buffer.from(String(m.text || '').replace(/\r?\n/g, '\r\n')));
  const atts = (m.atts || []).filter(x => x && x.data);
  if (!atts.length) return Buffer.from(H.join('\r\n') + '\r\n' + txt + '\r\n', 'latin1');
  let b = H.join('\r\n') + '\r\nContent-Type: multipart/mixed; boundary="' + B + '"\r\n\r\n--' + B + '\r\n' + txt + '\r\n';
  atts.forEach(x => { const n = String(x.name || 'file'), fn = /^[\x20-\x7e]*$/.test(n) ? 'filename="' + n.replace(/"/g, '') + '"' : "filename*=UTF-8''" + encodeURIComponent(n);
    b += '--' + B + '\r\nContent-Type: ' + (x.mime || 'application/octet-stream') + '; name="' + encW(n).replace(/"/g, '') + '"\r\nContent-Disposition: attachment; ' + fn + '\r\nContent-Transfer-Encoding: base64\r\n\r\n' + b64lines(Buffer.from(String(x.data), 'base64')) + '\r\n'; });
  return Buffer.from(b + '--' + B + '--\r\n', 'latin1');
}
module.exports._t = { mimeMsg, mimeBuild, imapOpen, smtpOpen, mailOp };
