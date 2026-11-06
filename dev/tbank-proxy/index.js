// Посредник для «Документы ФД»: Google не может достучаться до Т-Бизнеса, а Яндекс Облако (Россия) — может.
// Функция только пересылает ЧТЕНИЕ счетов и выписки (T-API) и ничего не хранит. Платить через неё нельзя.
// Яндекс Облако → Cloud Functions → среда Node.js 22, точка входа index.handler, переменная окружения SECRET.
const https = require('https');
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
  if (path === '/ping') return out(200, { ok: true, proxy: 1 });
  if (!ALLOWED.some(r => r.test(path))) return out(400, { error: 'path not allowed' });
  try {
    let r;
    try { r = await get(path, String(p.token || ''), true); }
    catch (e) { if (!/certif|self.signed|unable to (get|verify)|SSL|TLS/i.test(String(e.message))) throw e; r = await get(path, String(p.token || ''), false); }
    return out(200, { code: r.code, body: r.body });
  } catch (e) { return out(502, { error: 'bank: ' + String(e.message || e) }); }
};
