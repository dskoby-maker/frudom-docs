"""Закупка по накладной + склад: накладная уже сохранена и уехала, потом в «Добавить закупку» отмечаем,
что часть товара была со склада. Проверка: связь с товаром склада, источник в накладной, списание со склада,
себестоимость по партии, цена Саида за остальное, нехватка, отгруженное не меняется, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
def rows(sheet):
    d=dump().get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, t=9000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def open_zk(pg, jid):
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
    await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
    await pg.click('#fd-dcard [data-zkc="toggle"]'); ok(await until(pg,"!!document.querySelector('#dc-zki .dzl')"), 'открылся блок «Закупка по накладной»')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        # товары и прайс заказчика
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-ris','Рис круглозерный','100'],['p-mor','Морковь','50'],['p-luk','Лук репчатый','40']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
        # склад: рис 20 кг по 60, лук 3 кг по 25 (приходом списком — без связи с позициями документа)
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Рис круглый (склад)',unit:'кг',qty:'20',price:'60',date:'2026-11-01',exp:'',supplier:'',docRef:''},{itemId:'',newName:'Лук (склад)',unit:'кг',qty:'3',price:'25',date:'2026-11-01',exp:'',supplier:'',docRef:''}]},'тест')")
        ok(len(rows('Склад: партии'))>=2, 'на складе две партии')
        # накладная сегодня: рис 10, морковь 5, лук 5 — всё «от Саида»
        await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'dzk1', customerId:window.__cid, number:'', lines:[{productId:'p-ris',qty:'10',price:'100'},{productId:'p-mor',qty:'5',price:'50'},{productId:'p-luk',qty:'5',price:'40'}]}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2000)
        jid='dzk1'; ok(await pg.evaluate("__fd.D().journal.some(j=>j.id==='dzk1')"), 'накладная сохранена')

        await open_zk(pg, jid)
        ok(await pg.locator('#dc-zki .dzseg').count()==3, 'у каждого товара выбор «Закупка / Со склада / Часть со склада»')
        ok(await pg.locator('#dc-zki .dzship').count()==0, 'пока склад не выбран — галочки списания нет')
        # рис: со склада, выбрать товар склада
        await pg.click('#dc-zki .dzr:nth-child(1) [data-dzm="s"]'); await pg.wait_for_timeout(200)
        ok(await pg.locator('#dc-zki .dzr:nth-child(1) select.dzit').count()==1, 'рис не связан — предлагается выбрать товар склада')
        opt=await pg.text_content('#dc-zki .dzr:nth-child(1) select.dzit'); ok(opt.index('Рис круглый')<opt.index('Лук'), 'похожий по названию товар — первым в списке')
        await pg.select_option('#dc-zki .dzr:nth-child(1) select.dzit', label=None, index=1); await pg.wait_for_timeout(200)
        inf=await pg.text_content('#dc-zki .dzr:nth-child(1) .dzinf'); ok('600,00' in inf and '60,00' in inf, f'себестоимость со склада видна сразу: {inf.strip()[:90]}')
        ok(await pg.locator('#dc-zki .dzr:nth-child(1) .dzc').count()==0, 'у товара «со склада» нет поля цены Саида')
        ok(await pg.locator('#dc-zki .dzship input:checked').count()==1, 'галочка «Товар уже уехал» стоит (накладная на сегодня)')
        # лук: часть со склада — 3 кг, остальные 2 кг у Саида по 30
        await pg.click('#dc-zki .dzr:nth-child(3) [data-dzm="x"]'); await pg.wait_for_timeout(200)
        await pg.select_option('#dc-zki .dzr:nth-child(3) select.dzit', index=1); await pg.wait_for_timeout(200)
        sel=await pg.evaluate("document.querySelector('#dc-zki .dzr:nth-child(3) select.dzit').selectedOptions[0].textContent"); ok('Лук' in sel, f'для лука первым предложен «Лук»: {sel}')
        await pg.fill('#dc-zki .dzr:nth-child(3) .dzq','4'); await pg.wait_for_timeout(150)
        inf=await pg.text_content('#dc-zki .dzr:nth-child(3) .dzinf'); ok('не хватает 1' in inf, f'4 кг при 3 на складе — видна нехватка: {inf.strip()[:80]}')
        await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(600)
        ok('не хватает' in (await pg.text_content('#dc-zkmsg')), 'с нехваткой сохранить нельзя — понятное сообщение')
        ok(len(rows('Склад: движения'))==2 and not rows('Склад: резервы'), 'склад не тронут')
        await pg.fill('#dc-zki .dzr:nth-child(3) .dzq','3'); await pg.wait_for_timeout(150)
        await pg.fill('#dc-zki .dzr:nth-child(2) .dzc','20'); await pg.fill('#dc-zki .dzr:nth-child(3) .dzc','30'); await pg.wait_for_timeout(150)
        zks=await pg.text_content('#dc-zks')
        # закупка: рис 10×60=600, морковь 5×20=100, лук 3×25=75 + 2×30=60 → 835
        ok('835,00' in zks.replace(' ',' '), f'живой расчёт закупки 835,00: {zks[:80]}')
        await pg.screenshot(path=f'{SHOT}/zk-stock-before.png', full_page=True)
        await pg.click('#dc-zki [data-zkc="save"]')
        ok(await until(pg,"(document.getElementById('dc-zkmsg')||{}).textContent==='Сохранено ✓'", 15000), 'закупка сохранена')
        await pg.wait_for_timeout(800)
        # проверки в таблице
        J=[r for r in rows('Журнал') if r['ID']==jid][0]; sn=json.loads(J['Данные документа (не редактировать)'])
        L={l['productId']:l for l in sn['dr']['lines']}
        ok((L['p-ris'].get('stk') or {}).get('m')=='s' and (L['p-luk'].get('stk') or {}).get('m')=='x' and str(L['p-luk']['stk'].get('q'))=='3' and not L['p-mor'].get('stk'), f"в накладной источник: рис со склада, лук 3 кг со склада, морковь от Саида")
        ok(all(l.get('lid') for l in sn['dr']['lines']), 'у строк есть постоянный номер')
        ok(any('со склада' in ' '.join(h.get('w',[])) for h in sn['meta'].get('hist',[])), 'в истории документа записано, что взяли со склада')
        moves=rows('Склад: движения'); ships=[m for m in moves if float(str(m['Количество']).replace(',','.'))<0]
        qty=sorted(round(-float(str(m['Количество']).replace(',','.')),3) for m in ships)
        ok(qty==[3.0,10.0], f'со склада списано: рис 10 и лук 3 ({qty})')
        ok(len(rows('Склад: резервы'))==0, 'резерва не осталось — всё отгружено')
        # прибыль
        cost=await pg.evaluate("(()=>{const j=__fd.D().journal.find(x=>x.id==='dzk1'); return document.querySelector('#dc-zks').textContent})()")
        ok('835,00' in cost.replace(' ',' '), f'после сохранения закупка 835,00 (по партиям + Саид)')
        lk=await pg.locator('#dc-zki .dzsk.lock').count(); ok(lk==2, f'отгруженные строки закрыты для правки ({lk})')
        ok(await pg.locator('#fd-dcard .skdoc').count()==1 and 'отгружено' in (await pg.text_content('#fd-dcard .skdoc')), 'в окне документа появился блок «Склад» с отгрузкой')
        await pg.screenshot(path=f'{SHOT}/zk-stock-after.png', full_page=True)
        # повторное открытие на «чистом» окне — всё на месте, повтор сохранения ничего не списывает второй раз
        await pg.click('#fd-dcard [data-dc="close"]'); await pg.wait_for_timeout(400)
        await open_zk(pg, jid)
        ok(await pg.locator('#dc-zki .dzsk.lock').count()==2, 'после переоткрытия: рис и лук — «отгружено со склада»')
        await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(1500)
        ok(len([m for m in rows('Склад: движения') if float(str(m['Количество']).replace(',','.'))<0])==2, 'повторное сохранение второй раз не списывает')
        ok(not errs, f'ошибок на странице нет {errs[:2]}')
        await ctx.close()
        # телефон
        ctx,pg,errs=await login(b,(390,844))
        await open_zk(pg, jid)
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=390, f'телефон: нет прокрутки вбок ({sw})')
        await pg.click('#dc-zki .dzr:nth-child(2) [data-dzm="x"]'); await pg.wait_for_timeout(300)
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=390, f'телефон: с выбором «Часть со склада» нет прокрутки вбок ({sw})')
        await pg.locator('#dc-zki').screenshot(path=f'{SHOT}/zk-stock-phone.png')
        ok(not errs, f'телефон: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
