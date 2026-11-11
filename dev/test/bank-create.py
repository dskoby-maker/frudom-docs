"""Поступления: в назначении накладные, которых нет на сайте (их не заводили). Сайт предлагает «Создать накладные…»,
открывает их на «Новом документе» уже заполненными (поставщик, заказчик, номер, дата, адрес), после сохранения — окно закупки
и следующая накладная; когда все созданы и сумма сошлась — платёж разносится сам."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(code): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=code.encode(), method='POST')).read())
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
TOK='tok-test-skobelkin-000000000000001'
LINE="(q=>{const dr=__fd.D().draft; dr.lines=[{productId:'bk-a',qty:String(q),price:'100'}]; document.querySelector('#d-add').click();})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    info=await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0], s=D.suppliers[0]; c.inn='9724123821'; window.__cid=c.id; window.__sid=s.id;
      D.products.push({id:'bk-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['bk-a']='100'; return {sid:s.id, cid:c.id}; }""")
    # одна накладная на сайте есть (№451), трёх из платежа — нет
    await pg.evaluate("""()=>{const D=__fd.D(); Object.assign(D.draft,{id:'bk451', customerId:window.__cid, supplierId:window.__sid, number:'451', numManual:true, lines:[{productId:'bk-a',qty:'255',price:'100'}]}); }""")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    pur='Оплата по накладной №447 от 10.09.2026 18480-00 руб., накладной №447 от 21.09.2026 17900-00 руб., накладной №449 от 01.10.2026 19350-00 руб. Без налога (НДС)'
    ops=[{'operationId':'c1','operationDate':'2026-11-05T09:00:00Z','typeOfOperation':'Credit','accountAmount':55730,'payPurpose':pur,'counterParty':{'inn':'9724123821','name':'ООО "АВРОРА"'}}]
    ev("__tb="+json.dumps({'tokens':{TOK:{'accounts':['40802810000000000009'],'ops':ops}}}))
    await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-bank [data-bn="keys"]'); await pg.wait_for_timeout(400)
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]'); await row.locator('.bntok').fill(TOK); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(2500)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(400)
    card=pg.locator('#pv-bank [data-bnop="tb-c1"]')
    mk=await card.locator('.bnmk').text_content(); ok('№ 447 от 10.09.2026' in mk and '№ 449 от 01.10.2026' in mk and '17 900' in mk.replace(' ',' '), f'в карточке: каких накладных нет ({mk[:140]})')
    btn=await card.locator('[data-bn="mk"]').text_content(); ok('(3)' in btn, f'кнопка «{btn}»')
    await pg.screenshot(path=f'{SHOT}/bank-create-card.png', full_page=True)
    # окно «Выбрать накладные…» тоже предлагает
    await card.locator('[data-bn="pick"]').click(); await pg.wait_for_timeout(500)
    t=await pg.text_content('#bnp-mk'); ok('нет на сайте' in t, f'в окне выбора есть предложение создать ({t[:80]})')
    await pg.screenshot(path=f'{SHOT}/bank-create-pick.png')
    await pg.click('#fd-dcard [data-bnp="mk"]'); await pg.wait_for_timeout(900)
    st=await pg.evaluate("({tab:document.querySelector('#tab-doc').hidden, dr:__fd.D().draft, n:__fd.D().multi.docs.length, bar:document.querySelector('#mulbar-bn').textContent, sup:document.querySelector('#d-sup').value, cus:document.querySelector('#d-cus').value, num:document.querySelector('#d-num').value, date:document.querySelector('#d-date').value})")
    ok(not st['tab'] and st['n']==3, 'открыт «Новый документ», накладных 3')
    ok(st['sup']==info['sid'] and st['cus']==info['cid'] and st['num']=='447' and st['date']=='2026-09-10', f'заполнено: № {st["num"]} от {st["date"]}, поставщик и заказчик стоят')
    ok('18 480' in st['bar'].replace(' ',' ') and 'не хватает' in st['bar'], f'подсказка: {st["bar"][:120]}')
    await pg.screenshot(path=f'{SHOT}/bank-create-form.png', full_page=True)
    for q,nxt,dt in [(184.8,'447','2026-09-21'),(179,'449','2026-10-01'),(193.5,None,None)]:
        await pg.evaluate(LINE+f"({q})"); await pg.wait_for_timeout(300)
        bar=await pg.text_content('#mulbar-bn'); ok('✓' in bar, f'сумма сошлась: {bar[:110]}')
        await pg.keyboard.press('Escape'); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        zk=await pg.evaluate("!!document.querySelector('#fd-dcard [data-zkc=\"toggle\"].on')"); ok(zk, 'после сохранения открыто окно накладной с закупкой')
        if q==184.8: await pg.screenshot(path=f'{SHOT}/bank-create-zk.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        if nxt:
            s=await pg.evaluate("({num:document.querySelector('#d-num').value, date:document.querySelector('#d-date').value})")
            ok(s['num']==nxt and s['date']==dt, f'форма перешла к следующей: № {s["num"]} от {s["date"]}')
    j=await pg.evaluate("__fd.D().journal.filter(j=>['447','449'].includes(String(j.number))).map(j=>[j.number,j.date,j.sum])")
    ok(len(j)==3, f'в журнале три накладные: {j}')
    op=await pg.evaluate("__fd.D().bank.ops.find(o=>o.opId==='c1')")
    ok(op['status']=='done' and '449' in op['docsText'], f'платёж разнесён сам: {op["status"]} {op["docsText"]}')
    p451=await pg.evaluate("__fd.payOf(__fd.D().journal.find(x=>x.id==='bk451'))"); ok(p451['st']=='due', 'накладная № 451 не тронута')
    await pg.wait_for_timeout(300); await pg.screenshot(path=f'{SHOT}/bank-create-done.png', full_page=True)
    head=await pg.text_content('#mul'); ok('платёж разнесён' in head, 'в списке: «платёж разнесён»')
    await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(400)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'телефон: без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
