"""Прибыль: разделы «По заказчикам» (быстрая закупка «от кого — сумма») и «Расходы и доходы» (категории), ПК и телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(t): return json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    jid='pv'+tag
    await pg.evaluate("""(t)=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
      D.products.push({id:'pp'+t, name:'Рис пропаренный', code:'', unit:'кг', country:'', price:'178.6'}); D.prices[c.id]['pp'+t]='178.6';
      Object.assign(D.draft,{id:'pv'+t, customerId:c.id, number:'', lines:[{productId:'pp'+t,qty:'13.5',price:'178.6'}]}); }""", tag)
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2500)
    ok(await pg.locator('#pv-seg button').count()==4, f'{tag}: переключатель из четырёх разделов')
    await pg.click('#pv-seg [data-pv="cus"]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#pv-cus .pvcus').count()>=1, f'{tag}: плитки заказчиков')
    ok(await pg.locator('#pf-cards').is_hidden(), f'{tag}: «Обзор» скрыт в разделе заказчиков')
    await pg.screenshot(path=f'{SHOT}/pv-{tag}-cus.png')
    cid=await pg.evaluate("window.__cid")
    await pg.click(f'#pv-cus [data-pvc="{cid}"]'); await pg.wait_for_timeout(600)
    ok(await pg.locator('#fd-dcard.pvl-d').count()==1, f'{tag}: окно заказчика открылось')
    await pg.click(f'#fd-dcard [data-pve="{jid}"]'); await pg.wait_for_timeout(500)
    await pg.click('#fd-dcard .pvq[data-n="Саид"]'); await pg.keyboard.type('1000'); 
    await pg.click('#fd-dcard .pvq[data-n="Склад"]'); await pg.keyboard.type('500,5'); await pg.wait_for_timeout(200)
    calc=await pg.text_content('#pvcalc'); ok('1 500,50' in calc.replace(' ',' '), f'{tag}: живой расчёт закупки 1 500,50 ({calc[:80]})')
    await pg.screenshot(path=f'{SHOT}/pv-{tag}-led.png')
    await pg.click('#fd-dcard [data-pvs="save"]'); await pg.wait_for_timeout(300)
    chips=await pg.evaluate(f"[...document.querySelectorAll('[data-pvr=\"{jid}\"] .pvchip')].map(x=>x.textContent)")
    ok(len(chips)==2 and 'Саид' in chips[0], f'{tag}: в строке видно «Саид» и «Склад»: {chips}')
    x=await pg.evaluate(f"(()=>{{const j=__fd.D().journal.find(x=>x.id==='{jid}'); return __fd.docProfit(j);}})()")
    ok(abs(x['cost']-1500.5)<0.01 and x['miss']==0, f"{tag}: закупка накладной = 1500,50 (по источникам): {x['cost']}")
    await pg.wait_for_timeout(2500)
    d=dump('Себестоимость накладных'); h=d[0]; row=[r for r in d[1:] if r[h.index('ID документа')]==jid]
    ok(row and '_src' in row[0][h.index('Закупочные цены строк (не редактировать)')], f'{tag}: быстрая закупка записана в таблицу')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    # расходы и доходы
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(400)
    await pg.click('#pv-fin [data-pva="exp"]'); await pg.wait_for_timeout(400)
    await pg.fill('#pvi-sum','2500'); await pg.click('#fd-dcard [data-pvcat="c-fuel"]'); await pg.fill('#pvi-note','Бензин Гриша '+tag)
    await pg.screenshot(path=f'{SHOT}/pv-{tag}-item.png')
    await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(600)
    it=await pg.evaluate(f"__fd.D().pother.find(x=>x.note==='Бензин Гриша {tag}')")
    ok(it and it['cat']=='c-fuel' and it['catName']=='Бензин и машина' and it['sum']=='2500', f'{tag}: расход с категорией сохранён {it and it.get("cat")}')
    ok(await pg.locator('#pv-fin .pvcb[data-pvf="exp:c-fuel"]').count()==1, f'{tag}: категория появилась в разбивке')
    await pg.screenshot(path=f'{SHOT}/pv-{tag}-fin.png')
    # правка
    await pg.click(f'#pv-fin [data-pvx="{it["id"]}"]'); await pg.wait_for_timeout(400); await pg.fill('#pvi-sum','3000'); await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(500)
    ok(await pg.evaluate(f"__fd.D().pother.find(x=>x.id==='{it['id']}').sum")=='3000', f'{tag}: правка суммы')
    # категории: новая
    await pg.click('#pv-fin [data-pva="cats"]'); await pg.wait_for_timeout(400)
    n0=await pg.locator('#fd-dcard .pvcr').count(); await pg.click('#fd-dcard [data-pvcm="new"]'); await pg.wait_for_timeout(200)
    await pg.keyboard.type('Упаковка'); await pg.click('#fd-dcard .pvpi button:nth-child(5)'); await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'{SHOT}/pv-{tag}-cats.png')
    cats=await pg.evaluate("JSON.parse(localStorage.getItem('frudom-docs-prefs:Даниил')||'{}').poCats||[]")
    ok(len(cats)==n0+1 and cats[-1]['n']=='Упаковка', f'{tag}: новая категория сохранена ({cats[-1]["n"] if cats else None})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    # удаление записи
    await pg.click(f'#pv-fin [data-pvx="{it["id"]}"]'); await pg.wait_for_timeout(400); await pg.click('#fd-dcard [data-pvi="del"]'); await pg.click('#fd-dcard [data-pvi="del"]'); await pg.wait_for_timeout(500)
    ok(not await pg.evaluate(f"!!__fd.D().pother.find(x=>x.id==='{it['id']}')"), f'{tag}: удаление записи')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        await run(b,(1300,900),'pc'); await run(b,(390,844),'ph'); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
