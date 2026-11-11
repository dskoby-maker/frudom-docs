"""Компактный блок «Сформировать»: «Сохранить в журнал» главная, печать рядом, всё работает (ПК и телефон)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SH=os.environ.get('SHOT','/tmp/')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844),(360,740)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'}]; if(window.GOV){const c=D.customers.find(c=>!c.priv&&c.inn); if(c) D.draft.customerId=c.id;} })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            card=pg.locator('#tab-doc .dmk'); await card.scroll_into_view_if_needed()
            h=await card.evaluate("e=>e.getBoundingClientRect().height"); print(vw[0],'высота блока',round(h))
            ok(await pg.is_visible('#d-save') and await pg.is_visible('[data-make="invoice"]') and await pg.is_visible('[data-make="torg12"]'), f'{vw[0]}: кнопки видны')
            ok(await pg.evaluate("getComputedStyle(document.querySelector('#d-save')).backgroundImage.includes('gradient')"), f'{vw[0]}: «Сохранить» — главная (цветная)')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            ok(not await pg.is_visible('#d-saved'), f'{vw[0]}: пустое сообщение не занимает место')
            await card.screenshot(path=SH+f'make-{vw[0]}.png')
            n0=await pg.evaluate("__fd.D().journal.length"); num=await pg.evaluate("__fd.D().draft.number")
            await pg.click('#d-save'); await pg.wait_for_timeout(2500)
            ok(await pg.evaluate("__fd.D().journal.length")==n0+1, f'{vw[0]}: «Сохранить в журнал» сохранил документ')
            t=await pg.text_content('#d-saved'); ok(('№ '+str(num)) in t and await pg.is_visible('#d-saved'), f'{vw[0]}: сообщение видно: {t[:60]}')
            await card.screenshot(path=SH+f'make-{vw[0]}-saved.png')
            # печать: Счёт открывает просмотр и сохраняет
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'3',price:'100'}]; })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            n1=await pg.evaluate("__fd.D().journal.length"); await pg.click('[data-make="invoice"]'); await pg.wait_for_timeout(2500)
            ok(await pg.evaluate("__fd.D().journal.length")==n1+1, f'{vw[0]}: «Счёт» тоже сохраняет в журнал')
            await pg.click('#pv-close'); await pg.wait_for_timeout(400)
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            # очистить — в два нажатия
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'7',price:'100'}]; })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            await pg.click('#d-new'); ok('Точно' in (await pg.text_content('#d-new')), f'{vw[0]}: «Очистить» спрашивает')
            await pg.click('#d-new'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("!__fd.D().draft.lines.some(l=>l.qty==='7')") and (await pg.text_content('#d-new')).strip()=='Очистить форму', f'{vw[0]}: форма очищена, подпись вернулась')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
