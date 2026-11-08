"""Маршрут для водителя: точки одного заказчика — одна свёрнутая карточка, раскрывается; один заказчик с одной точкой — обычная карточка."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOT','/tmp/claude-0/')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'},{productId:D.products[1].id,qty:'3',price:'50'}]; })()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
            await pg.evaluate("""(()=>{const D=__fd.D(), j=D.journal[0]; ['ул. Вторая, д. 2','ул. Третья, д. 3'].forEach((a,i)=>{ const c=JSON.parse(JSON.stringify(j)); c.id='dvt'+i; c.number=String(900+i); c.snap.dr.ship='г. Москва, '+a; D.journal.unshift(c); });
              const o=JSON.parse(JSON.stringify(j)); o.id='dvo'; o.number='950'; o.customerId=D.customers[1].id; o.snap.dr.customerId=D.customers[1].id; o.snap.c=D.customers[1]; o.snap.dr.ship='г. Москва, ул. Другая, 9'; D.journal.unshift(o);
              try{localStorage.removeItem('frudom-dvg')}catch(e){} })()""")
            await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(600)
            ok(await pg.evaluate("document.querySelector('#dv-body').getBoundingClientRect().height")<2 and 'Развернуть' in (await pg.text_content('#dv-h')), f'{W}: «Маршрут для водителя» по умолчанию свёрнут')
            ok('точ' in (await pg.text_content('#dv-date-lbl')), f'{W}: в свёрнутой шапке видно число точек: {await pg.text_content("#dv-date-lbl")}')
            await pg.click('#dv-h .hq'); await pg.wait_for_timeout(300)
            ok(not await pg.evaluate("document.querySelector('#dv-card').classList.contains('open')"), f'{W}: «?» подсказка не разворачивает раздел'); await pg.keyboard.press('Escape')
            await pg.click('#dv-h .dvfx'); await pg.wait_for_timeout(500)
            ok(await pg.evaluate("document.querySelector('#dv-body').getBoundingClientRect().height")>100, f'{W}: нажатие на шапку разворачивает')
            ok(await pg.locator('#dv-points .dvg').count()==1, f'{W}: 3 точки заказчика собраны в одну карточку')
            ok(await pg.locator('#dv-points > .dvp').count()>=1, f'{W}: заказчик с одной точкой — обычная карточка')
            t=await pg.text_content('#dv-points .dvg .dtg-h'); ok('3 точки' in t and '3 накладные' in t, f'{W}: шапка: {t.strip()[:90]}')
            ok(await pg.evaluate("document.querySelector('#dv-points .dvg .dtg-b').getBoundingClientRect().height")<2, f'{W}: по умолчанию свёрнуто')
            await pg.evaluate("document.querySelector('#dv-card').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT+f'dvg-closed-{W}.png')
            await pg.click('#dv-points .dvg .dtg-h'); await pg.wait_for_timeout(500)
            ok(await pg.evaluate("document.querySelector('#dv-points .dvg .dtg-b').getBoundingClientRect().height")>150, f'{W}: раскрылось')
            ok(await pg.locator('#dv-points .dvg .dvp').count()==3, f'{W}: внутри 3 точки')
            await pg.screenshot(path=SHOT+f'dvg-open-{W}.png')
            await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("document.querySelector('#dv-points .dvg').classList.contains('open')"), f'{W}: раскрытие запомнилось')
            ok(await pg.evaluate("document.querySelector('#dv-card').classList.contains('open')"), f'{W}: развёрнутый маршрут запомнился')
            await pg.click('#dv-h .dvfx'); await pg.wait_for_timeout(500)
            ok(await pg.evaluate("document.querySelector('#dv-body').getBoundingClientRect().height")<2, f'{W}: повторное нажатие сворачивает')
            sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{W}: без прокрутки вбок {sw}')
            await pg.evaluate("document.querySelector('#dv-card').scrollIntoView({block:'start'})"); await pg.screenshot(path=SHOT+f'dvfold-{W}.png')
            await pg.click('#dv-h .dvfx'); await pg.wait_for_timeout(400)
            txt=await pg.input_value('#dv-text'); ok('ул. Вторая' in txt or 'Вторая' in txt, f'{W}: текст для MAX по-прежнему со всеми точками')
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: нет прокрутки вбок')
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
