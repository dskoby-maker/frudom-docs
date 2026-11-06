"""Поступления из Т-Бизнеса: подключение токена, автоматическое разнесение при точном совпадении, подтверждение сомнительных, выбор вручную, «не накладные», отмена. Тестовый банк — ctx.__tb в test/server.js."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(code): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=code.encode(), method='POST')).read())
def dump(t): return json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
TOK='tok-test-suhoverhova-000000000001'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    info=await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0], s=D.suppliers[0]; c.inn='7714061756'; window.__cid=c.id; window.__sid=s.id;
      D.products.push({id:'bk-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['bk-a']='100'; return {cid:c.id, sid:s.id}; }""")
    nums=[]
    for i,q in enumerate(['10','25','7']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'bkd{i}', customerId:window.__cid, supplierId:window.__sid, number:'', lines:[{{productId:'bk-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
        nums.append(await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='bkd{i}').number"))
    ok(len(nums)==3, f'три накладные: {nums}')
    ops=[{'operationId':'op1','operationDate':'2026-11-06T09:00:00Z','typeOfOperation':'Credit','accountAmount':1000,'payPurpose':f'Оплата по УПД № {nums[0]} от 06.11.2026 по контракту. Без НДС','counterParty':{'inn':'7714061756','name':'ФГБУ НМИЦ гематологии'}},
         {'operationId':'op2','operationDate':'2026-11-06T10:00:00Z','typeOfOperation':'Credit','accountAmount':2500,'payPurpose':'Оплата за продукты питания','counterParty':{'inn':'7714061756','name':'ФГБУ НМИЦ гематологии'}},
         {'operationId':'op3','operationDate':'2026-11-06T11:00:00Z','typeOfOperation':'Credit','accountAmount':300,'payPurpose':'Частичная оплата','counterParty':{'inn':'7714061756','name':'ФГБУ НМИЦ гематологии'}},
         {'operationId':'op4','operationDate':'2026-11-06T12:00:00Z','typeOfOperation':'Credit','accountAmount':5000,'payPurpose':'Возврат займа','counterParty':{'inn':'500100732259','name':'Иванов И.И.'}},
         {'operationId':'op5','operationDate':'2026-11-06T12:30:00Z','typeOfOperation':'Debit','accountAmount':777,'payPurpose':'Списание','counterParty':{'inn':'1','name':'x'}}]
    ev("__tb="+json.dumps({'tokens':{TOK:{'accounts':['40802810000000000001'],'ops':ops}}, 'sslFail':True}))
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{SHOT}/bank-0.png')
    await pg.click('#pv-bank [data-bn="keys"]'); await pg.wait_for_timeout(400)
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]')
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]')
    await row.locator('.bntok').fill(TOK); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(1500)
    t=await pg.evaluate("[...document.querySelectorAll('#fd-toasts .fd-toast')].map(x=>x.textContent).join(' | ')")
    ok('посредник' in t, f'Google не достаёт до банка — понятная подсказка про посредника ({t[-160:]})')
    # посредник: неверный секрет, потом верный
    sec=await pg.input_value('#bnx-key'); ok(len(sec)>=20, f'секрет сгенерирован ({len(sec)} знаков)')
    ev("__tb.proxy={key:'другой-секрет-0000000000'}")
    await pg.fill('#bnx-url','https://functions.yandexcloud.net/d4etestproxy'); await pg.click('#fd-dcard [data-bnx="save"]'); await pg.wait_for_timeout(1500)
    t=await pg.evaluate("[...document.querySelectorAll('#fd-toasts .fd-toast')].map(x=>x.textContent).join(' | ')")
    ok('секрет' in t, f'неверный секрет — понятная ошибка ({t[-140:]})')
    ev("__tb.proxy={key:"+json.dumps(sec)+"}")
    await pg.click('#fd-dcard [data-bnx="save"]'); await pg.wait_for_timeout(1500)
    ok(await pg.locator('#fd-dcard .bnpx.on').count()==1, 'посредник подключён (зелёная плашка)')
    await pg.screenshot(path=f'{SHOT}/bank-proxy.png')
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]')
    await row.locator('.bntok').fill('bad-token-000000000000000000'); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(1500)
    t=await pg.evaluate("[...document.querySelectorAll('#fd-toasts .fd-toast')].map(x=>x.textContent).join(' | ')")
    ok('не принял' in t, f'плохой токен — понятная ошибка ({t[-160:]})')
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]')
    await row.locator('.bntok').fill(TOK); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(2500)
    ok(await pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"].on').count()==1, 'ИП подключён, видно «подключено»')
    ok((ev('typeof __pxCalls==="number"?__pxCalls:0') or 0)>0, 'выписка шла через посредника')
    await pg.screenshot(path=f'{SHOT}/bank-keys.png')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
    st=await pg.evaluate("Object.fromEntries(__fd.D().bank.ops.map(o=>[o.opId,o.status]))")
    ok(st.get('op1')=='auto' and st.get('op2')=='auto', f'точные совпадения разнесены сами: {st}')
    ok(st.get('op3')=='wait' and st.get('op4')=='wait' and 'op5' not in st, 'сомнительные ждут, списание не попало')
    pays=await pg.evaluate("['bkd0','bkd1','bkd2'].map(id=>{const j=__fd.D().journal.find(x=>x.id===id); return __fd.payOf(j).st;})")
    ok(pays==['paid','paid','due'], f'№1 и №2 оплачены, №3 нет: {pays}')
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'{SHOT}/bank-1.png', full_page=True)
    # op3: выбрать накладные вручную
    c3=pg.locator('#pv-bank [data-bnop="tb-op3"]'); await c3.locator('[data-bn="pick"]').click(); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{SHOT}/bank-pick.png')
    tot=await pg.text_content('#bnp-t'); ok('300' in tot, f'итог выбора: {tot}')
    await pg.click('#fd-dcard [data-bnp="save"]'); await pg.wait_for_timeout(600)
    p3=await pg.evaluate("(()=>{const j=__fd.D().journal.find(x=>x.id==='bkd2'); return __fd.payOf(j);})()")
    ok(p3['st']=='part' and abs(p3['s']-300)<0.01, f'№3 частично оплачен на 300: {p3["s"]}')
    # op4: не оплата накладных
    await pg.locator('#pv-bank [data-bnop="tb-op4"] [data-bn="skip"]').click(); await pg.wait_for_timeout(300)
    # op1: отменить
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(300)
    u=pg.locator('#pv-bank [data-bnop="tb-op1"] [data-bn="undo"]'); await u.click(); await u.click(); await pg.wait_for_timeout(400)
    p1=await pg.evaluate("(()=>{const j=__fd.D().journal.find(x=>x.id==='bkd0'); return __fd.payOf(j).st;})()")
    ok(p1=='due', f'после отмены №1 снова не оплачен: {p1}')
    await pg.wait_for_timeout(3000)
    d=dump('Поступления (банк)'); h=d[0]; rows={r[h.index('ID операции банка')]:r for r in d[1:]}
    ok(len(rows)==4, f'в таблице 4 поступления: {list(rows)}')
    stc=lambda k: rows[k][h.index('Код статуса')] if k in rows else None
    ok(stc('op2')=='auto' and stc('op3')=='done' and stc('op4')=='skip' and stc('op1')=='wait', f"статусы в таблице: {[(k,stc(k)) for k in rows]}")
    ok(rows['op2'][h.index('Разнесено по накладным')].startswith('№'), 'в таблице видно, по каким накладным разнесено')
    # повторная синхронизация не дублирует и не разносит заново
    await pg.click('#pv-bank [data-bn="sync"]'); await pg.wait_for_timeout(2000)
    d=dump('Поступления (банк)'); ok(len(d)-1==4, 'повторное обновление не дублирует')
    p1=await pg.evaluate("(()=>{const j=__fd.D().journal.find(x=>x.id==='bkd0'); return __fd.payOf(j).st;})()")
    ok(p1=='due', 'отменённое не разнеслось заново')
    # телефон
    await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'{SHOT}/bank-ph.png', full_page=True)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'телефон: без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
