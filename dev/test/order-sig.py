"""Заявка: вид таблицы поменялся в настройках без перерисовки (пришли с другого устройства) — при вводе количества шапка, строки и итог не разъезжаются."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE_PATH') or '/usr/bin/google-chrome')
    pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"order\"]').click()"); await pg.wait_for_timeout(500)
    opts=await pg.evaluate("[...document.querySelectorAll('#o-cus option')].map(o=>o.value).filter(Boolean)")
    best=None
    for v in opts:
      await pg.select_option('#o-cus', v); await pg.wait_for_timeout(250)
      if await pg.evaluate("document.querySelectorAll('#o-body tr').length>=2 && document.querySelectorAll('#o-head th').length>=5"): best=v; break
    ok(best is not None, f'заказчик {best}')
    await pg.click('#o-view button[data-v="h"]'); await pg.wait_for_timeout(300)
    # настройки сменились «где-то ещё»: вид «Товары в строках», а таблица не перерисована
    await pg.evaluate("""cid=>{ const k=Object.keys(localStorage).find(k=>k.startsWith('frudom-docs-prefs:')); const p=JSON.parse(localStorage.getItem(k)||'{}'); p.ov=p.ov||{}; p.ov[cid]='v'; localStorage.setItem(k, JSON.stringify(p)); }""", best)
    ok(not await pg.evaluate("document.querySelector('#o-tbl').classList.contains('ov')"), 'таблица ещё в старом виде')
    q=pg.locator('#o-body input.q').nth(1); await q.click(); await q.fill('3'); await pg.wait_for_timeout(400)
    n=await pg.evaluate("[document.querySelector('#o-head tr').children.length, document.querySelector('#o-foot tr').children.length, [...document.querySelectorAll('#o-body tr')].map(r=>r.children.length)]")
    ok(not await pg.evaluate("document.querySelector('#o-tbl').classList.contains('ov')"), 'вид под рукой не переключился')
    ok(n[0]==n[1] and all(x==n[0] for x in n[2]), f'столбцов в шапке, итоге и строках поровну {n[0]}/{n[1]}/{set(n[2])}')
    ok(await pg.evaluate("document.activeElement && document.activeElement.matches('#o-tbl input')"), 'курсор остался в таблице')
    ok(not errs, f'ошибок нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
