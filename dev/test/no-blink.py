"""Фоновое обновление не «мигает»: те же данные — вкладка не перерисовывается; новые — без анимации появления."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
RUN="document.getElementById('fd-main').getAnimations({subtree:true}).filter(a=>a.playState==='running' && a instanceof CSSAnimation).length"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    pg=await (await b.new_context(viewport={'width':1300,'height':900})).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("__fd.pull()"); await pg.wait_for_timeout(2500)   # первая загрузка — обычная
    for t in ['journal','calendar','profit','stock']:
        await pg.evaluate(TAB+f"('{t}')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("__fd.pull()"); await pg.wait_for_timeout(2500)   # после перехода на вкладку что-то могло сохраниться
        await pg.evaluate("window.__mark=[...document.querySelectorAll('#fd-main section:not([hidden]) *')].filter(x=>!x.closest('#sk-sync')).slice(0,400)")
        await pg.evaluate("__fd.pull()"); await pg.wait_for_timeout(2500)
        same=await pg.evaluate("window.__mark.length>0 && window.__mark.every(x=>x.isConnected)")
        ok(same, f'{t}: те же данные — экран не перерисован')
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(200)
    n0=await pg.evaluate(RUN); await pg.evaluate("__fd.calm()"); n1=await pg.evaluate(RUN)
    ok(n1==0, f'после фоновой перерисовки анимации появления не идут ({n0} → {n1})')
    ok(not errs, f'ошибок JS нет {errs}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
