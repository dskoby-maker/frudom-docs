"""Поступления: номера из назначения указывают на накладные, которые уже отмечены оплаченными (вручную до подключения банка) или у другого ИП.
Сайт не должен подсовывать чужую накладную, должен показать нужные в окне «Выбрать накладные…» и при подтверждении не добавлять оплату второй раз."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(code): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=code.encode(), method='POST')).read())
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
TOK='tok-test-skobelkin-000000000000001'
PAY="(id=>{const j=__fd.D().journal.find(x=>x.id===id); return __fd.payOf(j);})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    info=await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0], s=D.suppliers[0], s2=D.suppliers[1]; c.inn='9724123821'; window.__cid=c.id; window.__sid=s.id; window.__s2=s2.id;
      D.products.push({id:'bk-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['bk-a']='100'; return {sid:s.id}; }""")
    nums=[]
    for i,(q,sup) in enumerate([('10','__sid'),('25','__sid'),('7','__s2'),('33','__sid')]):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'bkd{i}', customerId:window.__cid, supplierId:window.{sup}, number:'', lines:[{{productId:'bk-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
        nums.append(await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='bkd{i}').number"))
    ok(len(nums)==4, f'накладные: {nums}')
    # до подключения банка №0 и №1 отмечены оплаченными вручную
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.evaluate("['bkd0','bkd1'].forEach(id=>{const j=__fd.D().journal.find(x=>x.id===id); __fd.setPay(j, __fd.payOf(j).tot, '2026-11-01', true);})")
    ops=[{'operationId':'p1','operationDate':'2026-11-05T09:00:00Z','typeOfOperation':'Credit','accountAmount':3500,'payPurpose':f'Оплата по накладной №{nums[0]} от 10.09.2026 1000-00 руб., накладной №{nums[1]} от 01.10.2026 2500-00 руб. Без налога (НДС)','counterParty':{'inn':'9724123821','name':'ООО "АВРОРА"'}},
         {'operationId':'p2','operationDate':'2026-11-05T10:00:00Z','typeOfOperation':'Credit','accountAmount':700,'payPurpose':f'Оплата по УПД № {nums[2]}','counterParty':{'inn':'9724123821','name':'ООО "АВРОРА"'}}]
    ev("__tb="+json.dumps({'tokens':{TOK:{'accounts':['40802810000000000009'],'ops':ops}}}))
    await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-bank [data-bn="keys"]'); await pg.wait_for_timeout(400)
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]'); await row.locator('.bntok').fill(TOK); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(2500)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    st=await pg.evaluate("Object.fromEntries(__fd.D().bank.ops.map(o=>[o.opId,o.status]))")
    ok(st.get('p1')=='wait' and st.get('p2')=='wait', f'сами не разнеслись, ждут решения: {st}')
    p3=await pg.evaluate(PAY+"('bkd3')"); ok(p3['st']=='due', 'чужая накладная (№3) не тронута')
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(400)
    c1=pg.locator('#pv-bank [data-bnop="tb-p1"]'); why=await c1.locator('.bnwhy').text_content()
    ok('Уже отмечены оплаченными' in why, f'p1: понятное объяснение ({why[:120]})')
    chips=await c1.locator('.bndoc').all_text_contents(); ok(len(chips)==2 and all(f'№ {n}' in ' '.join(chips) for n in nums[:2]), f'p1: предложены №{nums[0]} и №{nums[1]}: {chips}')
    why2=await pg.locator('#pv-bank [data-bnop="tb-p2"] .bnwhy').text_content(); ok('Другой ИП' in why2, f'p2: накладная другого ИП предложена ({why2[:100]})')
    await pg.screenshot(path=f'{SHOT}/bank-paid-1.png', full_page=True)
    # окно «Выбрать накладные…» показывает оплаченные из назначения
    await c1.locator('[data-bn="pick"]').click(); await pg.wait_for_timeout(500)
    txt=await pg.text_content('#bnp-l'); ok('уже оплачена' in txt and f'№ {nums[0]}' in txt and f'№ {nums[1]}' in txt, 'в окне видны оплаченные накладные из назначения')
    tot=await pg.text_content('#bnp-t'); ok('ровно' in tot, f'выбрано ровно на сумму платежа: {tot}')
    await pg.screenshot(path=f'{SHOT}/bank-paid-pick.png')
    await pg.click('#fd-dcard [data-bnp="save"]'); await pg.wait_for_timeout(600)
    a=await pg.evaluate(PAY+"('bkd0')"); b2=await pg.evaluate(PAY+"('bkd1')")
    ok(abs(a['s']-1000)<.01 and abs(b2['s']-2500)<.01 and a['d']=='2026-11-01', f'сумма не задвоилась: {a["s"]}, {b2["s"]}, дата {a["d"]}')
    op=await pg.evaluate("__fd.D().bank.ops.find(o=>o.opId==='p1')"); ok(op['status']=='done' and 'оплата уже стояла' in op['docsText'], f'платёж связан: {op["docsText"]}')
    # отмена разнесения не снимает ручную оплату
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(300)
    u=pg.locator('#pv-bank [data-bnop="tb-p1"] [data-bn="undo"]'); await u.click(); await u.click(); await pg.wait_for_timeout(400)
    a=await pg.evaluate(PAY+"('bkd0')"); ok(a['st']=='paid', 'после отмены ручная оплата осталась')
    # «Подтвердить» по предложению
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(300)
    await pg.locator('#pv-bank [data-bnop="tb-p1"] [data-bn="ok"]').click(); await pg.wait_for_timeout(400)
    a=await pg.evaluate(PAY+"('bkd0')"); op=await pg.evaluate("__fd.D().bank.ops.find(o=>o.opId==='p1')")
    ok(abs(a['s']-1000)<.01 and op['status']=='done', 'Подтвердить: связано, сумма не задвоилась')
    # «показать и уже оплаченные»
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(300)
    await pg.locator('#pv-bank [data-bnop="tb-p2"] [data-bn="pick"]').click(); await pg.wait_for_timeout(400)
    await pg.check('#bnp-paid'); await pg.wait_for_timeout(300)
    n=await pg.locator('#bnp-l .bnpr').count(); ok(n>=3, f'с галочкой видны и оплаченные ({n} строк)')
    await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'{SHOT}/bank-paid-ph.png')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'телефон: без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
