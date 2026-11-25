"""Вкладки сверху: карандаша нет, правая кнопка по вкладке — меню (25.11.2026)."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
ORD="[...document.querySelectorAll('#fd-app nav.tabs button[data-tab]')].filter(b=>!b.hidden).map(b=>b.dataset.tab)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1500,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        ok(not await pg.locator('#tab-edit').is_visible(), 'карандаша не видно')
        o0=await pg.evaluate(ORD)
        await pg.click('#fd-app nav.tabs button[data-tab="journal"]', button='right'); await pg.wait_for_timeout(300)
        items=await pg.evaluate("[...document.querySelectorAll('.jcx [data-jcx]')].map(x=>x.textContent.trim())")
        ok(any('Сдвинуть влево' in x for x in items) and any('Переместить вкладки' in x for x in items), f'меню вкладки: {items}')
        await pg.locator('.jcx [data-jcx]', has_text='Сдвинуть влево').click(); await pg.wait_for_timeout(500)
        o1=await pg.evaluate(ORD); i0=o0.index('journal'); ok(o1.index('journal')==i0-1, f'журнал сдвинут влево {o0[:4]} → {o1[:4]}')
        await pg.click('#fd-app nav.tabs button[data-tab="profit"]', button='right'); await pg.wait_for_timeout(300)
        await pg.locator('.jcx [data-jcx]', has_text='В начало').click(); await pg.wait_for_timeout(500)
        ok((await pg.evaluate(ORD))[0]=='profit', '«В начало»')
        await pg.click('#fd-app nav.tabs button[data-tab="stock"]', button='right'); await pg.wait_for_timeout(300)
        await pg.locator('.jcx [data-jcx]', has_text='Переместить').click(); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("!document.querySelector('#tsheet').hidden"), 'открылось окно перестановки вкладок')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
        await pg.click('#fd-app nav.tabs button[data-tab="stock"]', button='right'); await pg.wait_for_timeout(300)
        await pg.locator('.jcx [data-jcx]', has_text='Вернуть порядок').click(); await pg.wait_for_timeout(500)
        ok((await pg.evaluate(ORD))==o0, 'порядок «как было»')
        await pg.click('#fd-app nav.tabs button[data-tab="calendar"]', button='right'); await pg.wait_for_timeout(300)
        await pg.locator('.jcx [data-jcx]', has_text='Открыть').first.click(); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("document.querySelector('#fd-app nav.tabs button[data-tab=\"calendar\"]').getAttribute('aria-selected')")=='true', '«Открыть» открывает вкладку')
        ok(not errs, f'нет ошибок JS {errs}')
        await b.close()
    print("ИТОГ:", "ошибок нет" if not fails else f"ошибок: {len(fails)}")
asyncio.run(main())
