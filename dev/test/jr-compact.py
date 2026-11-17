"""Журнал на телефоне: фильтры компактные — период, поиск с кнопкой «Фильтры N»; остальное раскрывается по кнопке; «Сбросить» — только при фильтрах. На ПК без изменений."""
import asyncio
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((360,780),(412,900),(1300,900)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("localStorage.removeItem('frudom-jfopen'); location.hash='#zhurnal'"); await pg.wait_for_timeout(900)
            hj=lambda: pg.evaluate("document.querySelector('#jr-q').closest('.jf').getBoundingClientRect().height")
            if W<700:
                h=await hj(); ok(h<=100, f'{W}: фильтры свёрнуты, высота {h}')
                ok(not await pg.is_visible('#jr-sup') and await pg.is_visible('#jr-more'), f'{W}: видно только период, поиск и «Фильтры»')
                ok(not await pg.is_visible('#jr-reset'), f'{W}: «Сбросить» спрятан без фильтров')
                await pg.click('#jr-more'); await pg.wait_for_timeout(400)
                ok(await pg.is_visible('#jr-sup') and await pg.is_visible('#jr-sort'), f'{W}: «Фильтры» раскрывает поставщика, заказчика, порядок')
                await pg.select_option('#jr-sup', index=1); await pg.wait_for_timeout(300)
                await pg.click('#jr-more'); await pg.wait_for_timeout(300)
                ok((await pg.inner_text('#jr-moren')).strip()=='1' and not await pg.is_visible('#jr-sup'), f'{W}: свёрнуто, на кнопке «1»')
                ok(await pg.is_visible('#jr-reset'), f'{W}: «Сбросить фильтры» появился')
                await pg.click('#jr-reset'); await pg.wait_for_timeout(300)
                ok(await pg.is_hidden('#jr-moren'), f'{W}: после сброса счётчика нет')
                ok(await pg.evaluate('document.documentElement.scrollWidth')<=W, f'{W}: без прокрутки вбок')
            else:
                ok(not await pg.is_visible('#jr-more') and await pg.is_visible('#jr-sup'), 'ПК: всё как раньше, кнопки «Фильтры» нет')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
