"""Журнал на ПК: таблица не шире своего окошка — при нехватке ширины кнопки строки переносятся (класс jw), на широком — в одну строку."""
import asyncio, os
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE_PATH') or '/usr/bin/google-chrome')
    pg=await b.new_page(viewport={'width':1300,'height':900})
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click()"); await pg.wait_for_timeout(2500)
    f="()=>{const t=document.querySelector('#jr-body').closest('table');return [t.scrollWidth,t.parentElement.clientWidth,t.classList.contains('jw')]}"
    print('1300', await pg.evaluate(f))
    await pg.set_viewport_size({'width':900,'height':900}); await pg.wait_for_timeout(500); print('900', await pg.evaluate(f))
    await pg.screenshot(path='/tmp/jr900.png')
    await pg.set_viewport_size({'width':1300,'height':900}); await pg.wait_for_timeout(500); print('1300', await pg.evaluate(f))
    await b.close()
asyncio.run(main())
