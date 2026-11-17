"""Закупка «Со склада»: похожие по названию сверху («Изделия макаронные» → «Макароны Ситно»), «Показать всё на складе» — весь склад, выбор любого товара."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, t=9000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
        W=int(os.environ.get('W','1300')); tag='ph' if W<600 else 'pc'
        pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          D.products.push({id:'p-mak', name:'Изделия макаронные (макароны фигурные)', code:'', unit:'кг', country:'', price:'120'}); D.prices[c.id]['p-mak']='120'; })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        await pg.evaluate("""__sk.send('bulk',{kind:'in', rows:[
          {itemId:'',newName:'Макароны фас Ситно 500гх15шт рожки',unit:'шт',qty:'405',price:'39.2',date:'2026-11-13',exp:'',supplier:'',docRef:''},
          {itemId:'',newName:'Рис круглозёрный',unit:'кг',qty:'50',price:'90',date:'2026-11-13',exp:'',supplier:'',docRef:''},
          {itemId:'',newName:'Кукуруза сахарная ж/б',unit:'шт',qty:'24',price:'80',date:'2026-11-13',exp:'',supplier:'',docRef:''}]},'тест')""")
        await pg.wait_for_timeout(1000)
        await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'mak1', customerId:window.__cid, number:'', lines:[{productId:'p-mak',qty:'10',price:'120'}]}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2000)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"mak1\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); ok(await until(pg,"!!document.querySelector('#dc-zki .dzl')"), f'{tag}: блок закупки открыт')
        await pg.click('#dc-zki .dzr:nth-child(1) [data-dzm="s"]'); await pg.wait_for_timeout(300)
        box='#dc-zki .dzr:nth-child(1) .skpk-l'
        t=await pg.text_content(box); print(t[:200])
        ok('Похоже по названию' in t and 'Макароны фас Ситно' in t, f'{tag}: сверху похожий по названию — «Макароны Ситно»')
        ok('Рис' not in t and 'Кукуруза' not in t, f'{tag}: непохожие сразу не показаны')
        ok('есть 405 шт' in t and '202,5' in t, f'{tag}: видно, что макароны есть в штуках (≈ 202,5 кг)')
        await pg.click(box+' [data-skpkall]'); await pg.wait_for_timeout(400)
        t=await pg.text_content(box)
        ok('Всё на складе' in t and 'Рис круглозёрный' in t and 'Кукуруза' in t, f'{tag}: «Показать всё на складе» — весь склад')
        ok(await pg.locator(box+'.big').count()==1, f'{tag}: список стал выше')
        await pg.locator(box+' [data-skpk]', has_text='Рис круглозёрный').click(); await pg.wait_for_timeout(500)
        sel=await pg.text_content('#dc-zki .dzr:nth-child(1) .skpk-sel'); ok('Рис круглозёрный' in sel, f'{tag}: выбран вручную товар из всего склада ({sel.strip()[:40]})')
        # поиск по вводу, «Свернуть»
        await pg.click('#dc-zki .dzr:nth-child(1) [data-skpkclr]'); await pg.wait_for_timeout(400)
        await pg.fill('#dc-zki .dzr:nth-child(1) .skpq','кукур'); await pg.wait_for_timeout(200)
        t=await pg.text_content(box); ok('Кукуруза' in t and 'Рис' not in t, f'{tag}: поиск по вводу — «кукур»')
        await pg.press('#dc-zki .dzr:nth-child(1) .skpq','Enter'); await pg.wait_for_timeout(400)
        sel=await pg.text_content('#dc-zki .dzr:nth-child(1) .skpk-sel'); ok('Кукуруза' in sel, f'{tag}: Enter выбирает найденное')
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
        if os.environ.get('SHOT'):
            await pg.click('#dc-zki .dzr:nth-child(1) [data-skpkclr]'); await pg.wait_for_timeout(300); await pg.click(box+' [data-skpkall]'); await pg.wait_for_timeout(400)
            await pg.locator(box).scroll_into_view_if_needed(); await pg.screenshot(path=os.environ['SHOT']+f'/pick-{tag}.png')
        ok(not errs, f'{tag}: ошибок JS нет {errs}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
