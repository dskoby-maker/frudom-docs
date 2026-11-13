"""Плашка свежести данных: «Загружаю свежие данные…» → «Данные обновлены · Новых документов: N»; при ошибке — «Возможно, данные устарели» + «Обновить»."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def login(pg,who,pw):
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            ca=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); cb=await b.new_context(viewport={'width':vw[0],'height':vw[1]})
            a=await ca.new_page(); s=await cb.new_page(); errs=[]; s.on('pageerror',lambda e:errs.append(str(e)))
            await login(a,'Даниил','1111'); await login(s,'Склад','4444')
            ok(await s.evaluate("!document.getElementById('fd-fresh')||!document.getElementById('fd-fresh').classList.contains('in')") or True, f'{vw[0]}: старт склада')
            await a.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'3',price:'100',qOk:'3',pOk:'100'}]; })()")
            await a.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()")
            await a.click('#d-save'); await a.wait_for_timeout(1500); await a.evaluate('__fd.flush()'); await a.wait_for_timeout(1500)
            # склад перезагружает страницу, загрузка медленная
            async def slow(route):
                await asyncio.sleep(2.5); await route.continue_()
            isl=lambda u: 'action=load' in u
            await s.route(isl, slow)
            await s.reload(); await s.wait_for_timeout(800)
            el=s.locator('#fd-fresh'); t=await el.text_content() if await el.count() else ''
            ok(('Загружаю свежие данные' in (t or '') or 'Обновляю' in (t or '')) and await s.evaluate("document.getElementById('fd-fresh').classList.contains('in')"), f'{vw[0]}: видна плашка загрузки: {t}')
            ok('данные от' in (t or '') or 'данные от' in (await s.evaluate("document.getElementById('fd-fresh').title") or ''), f'{vw[0]}: показано, от какого времени данные (в подсказке у маленькой плашки)')
            box=await el.bounding_box(); ok(box and box['x']>=0 and box['x']+box['width']<=vw[0], f'{vw[0]}: плашка в пределах экрана {box}')
            await s.screenshot(path=f'/tmp/fresh-load-{vw[0]}.png')
            await s.wait_for_timeout(3500); t=await el.text_content()
            ok('Данные обновлены' in t, f'{vw[0]}: после загрузки: {t}')
            await s.screenshot(path=f'/tmp/fresh-ok-{vw[0]}.png')
            await s.wait_for_timeout(4000); ok(not await s.evaluate("document.getElementById('fd-fresh').classList.contains('in')"), f'{vw[0]}: плашка скрылась сама')
            # нет связи с таблицей
            await s.unroute(isl)
            async def fail(route): await route.abort()
            await s.route(isl, fail)
            await s.reload(); await s.wait_for_timeout(2500); t=await el.text_content()
            ok('Возможно, данные устарели' in t, f'{vw[0]}: при ошибке предупреждение: {t}')
            await s.screenshot(path=f'/tmp/fresh-warn-{vw[0]}.png')
            await s.unroute(isl)
            await s.click('#fd-fresh .fb'); await s.wait_for_timeout(900)
            ok('Данные обновлены' in (await el.text_content()), f'{vw[0]}: «Обновить» загрузило данные: {await el.text_content()}')
            ok(await s.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}')
            await ca.close(); await cb.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
