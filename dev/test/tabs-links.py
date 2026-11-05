"""Адрес вкладки (#zhurnal): после обновления — та же вкладка, у каждого пользователя своя последняя; ссылка на договор и кнопка «Открыть ↗»; карточка декларации по нажатию."""
import asyncio, os, json, io, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
def pdf1():
    b=io.BytesIO(); Image.new('RGB',(300,400),'white').save(b,'PDF'); return b.getvalue()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
            await pg.reload(); await pg.wait_for_timeout(2500)
            # вкладки
            await pg.evaluate("goTab=null") if False else None
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click()"); await pg.wait_for_timeout(300)
            ok(pg.url.endswith('#zhurnal'), f'{W}: адрес вкладки «Журнал» — #zhurnal ({pg.url[-12:]})')
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"stock\"]').click()"); await pg.wait_for_timeout(300)
            await pg.reload(); await pg.wait_for_timeout(2500)
            ok(await pg.is_visible('#tab-stock'), f'{W}: после обновления открылась та же вкладка «Склад»')
            await pg.goto('http://localhost:8787/page#zakazchiki'); await pg.wait_for_timeout(2500)
            ok(await pg.is_visible('#tab-customers'), f'{W}: ссылка #zakazchiki открывает «Заказчики и цены»')
            await pg.goto('http://localhost:8787/page'); await pg.wait_for_timeout(2500)
            ok(await pg.is_visible('#tab-customers'), f'{W}: без адреса (как в приложении) — последняя вкладка')
            await pg.evaluate("location.hash='#tovary'"); await pg.wait_for_timeout(400)
            ok(await pg.is_visible('#tab-products'), f'{W}: смена адреса переключает вкладку')
            # ссылка на договор
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"customers\"]').click()"); await pg.wait_for_timeout(500)
            if await pg.locator('#ct-body tr[data-id]').count()==0: await pg.click('#ct-add'); await pg.wait_for_timeout(200)
            inp=pg.locator('#ct-body tr[data-id] input[data-k=url]').first
            ok(await inp.is_enabled(), f'{W}: поле ссылки доступно (новый Code.gs)')
            await inp.fill(f'drive.google.com/file/d/abc{W}'); await pg.wait_for_timeout(300)
            a=pg.locator('#ct-body tr[data-id] .cturl a').first
            ok(await a.count()==1 and await a.get_attribute('href')==f'https://drive.google.com/file/d/abc{W}', f'{W}: кнопка «Открыть ↗» с правильной ссылкой')
            await pg.wait_for_timeout(2500)
            ok(any(r.get('Ссылка на договор')==f'drive.google.com/file/d/abc{W}' for r in rows('Контракты')), f'{W}: ссылка сохранилась в таблице')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            await pg.locator('#ct-body').scroll_into_view_if_needed(); await pg.screenshot(path=f'/tmp/claude-0/ct-{W}.png')
            # декларация: карточка
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"stock\"]').click()"); await pg.wait_for_timeout(800)
            await pg.click('#sk-segs [data-skt="files"]'); await pg.wait_for_timeout(300)
            await pg.click('[data-dl="add"]'); await pg.wait_for_timeout(300)
            await pg.set_input_files('#sk-dlg .dcf-in', files=[{'name':'d.pdf','mimeType':'application/pdf','buffer':pdf1()}])
            await pg.fill('#sk-dlg .dcf-q', f'Картофель {W}'); await pg.press('#sk-dlg .dcf-q','Enter'); await pg.fill('#sk-dlg .dcf-num', f'N-{W}')
            await pg.click('#sk-dlg [data-dl="save"]'); await pg.wait_for_timeout(1500)
            ok(await pg.locator('#sk-list .dcl-i').count()==0, f'{W}: квадратика «PDF» больше нет')
            await pg.locator('#sk-list .dcl-m', has_text=f'Картофель {W}').first.click(); await pg.wait_for_timeout(400)
            t=await pg.text_content('#sk-dlg'); ok(f'N-{W}' in t and 'Скачать' in t and 'Изменить' in t and 'Удалить' in t, f'{W}: по нажатию — карточка декларации с действиями')
            await pg.screenshot(path=f'/tmp/claude-0/dv-{W}.png')
            await pg.click('#sk-dlg [data-dl="edit"]'); await pg.wait_for_timeout(300); ok(await pg.locator('#sk-dlg .dcf-num').count()==1, f'{W}: «Изменить» открывает правку')
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
