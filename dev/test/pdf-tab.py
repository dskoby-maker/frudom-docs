"""Вкладка «Редактор PDF»: по нажатию открывается https://frudom.ru/pdf в новой вкладке, на сайте — страница с кнопкой (ПК и телефон)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); await ctx.route('https://frudom.ru/**', lambda r: r.fulfill(status=200, body='pdf editor'))
            pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Гриша"]'); await pg.fill('#fd-pass','3333'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            async with ctx.expect_page() as np:
                if vw[0]>700: await pg.click('nav.tabs button[data-tab="pdf"]')
                else:
                    await pg.click('#mbar [data-mt="__more"]'); await pg.wait_for_timeout(500); await pg.click('#ts-grid [data-tile="pdf"]')
            n=await np.value; await n.wait_for_load_state(); ok(n.url=='https://frudom.ru/pdf', f'{vw[0]}: открылся {n.url}')
            await pg.wait_for_timeout(400); ok(await pg.is_visible('#tab-pdf #pdf-go'), f'{vw[0]}: на сайте страница с кнопкой «Открыть редактор PDF»')
            ok(await pg.get_attribute('#pdf-go','href')=='https://frudom.ru/pdf', f'{vw[0]}: ссылка кнопки верная')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'{vw[0]}: нет прокрутки вбок')
            await pg.screenshot(path=os.environ.get('SHOTS','/tmp')+f'/pdf-{vw[0]}.png')
            ok(not errs, f'{vw[0]}: ошибок JS: {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё ок' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
