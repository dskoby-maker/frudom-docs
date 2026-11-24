"""Строка, заполненная «по прошлым данным»: после правки количества надпись «Исправлено вручную…» — во всю ширину строки, а не узкой кнопкой (класс .ed занят кнопкой-карандашом). PH=1 — телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    pg=await b.new_page(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("(()=>{const D=__fd.D(); const c=D.customers.find(c=>c.id!=='__private'); const p=D.products[0]; Object.assign(D.draft,{customerId:c.id, lines:[{productId:p.id,qty:'15',price:'100',auto:'в заявке «1 кор», 1 кор ≈ 15 кг. Проверьте вес.',pack:{t:'1 кор',u:'кор',n:1}}]}); })()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(600)
    ok(await pg.locator('#tab-doc .line .lnote').count()==1, 'подсказка «по прошлым данным» есть')
    q=pg.locator('#tab-doc .line .qty').first; await q.fill('14'); await q.dispatch_event('input'); await pg.wait_for_timeout(300)
    r=await pg.evaluate("(()=>{const n=document.querySelector('#tab-doc .line .lnote'), l=n.closest('.line'); return {t:n.textContent, w:n.getBoundingClientRect().width, lw:l.getBoundingClientRect().width, bw:getComputedStyle(n).borderTopWidth}})()")
    ok('Исправлено вручную' in r['t'], 'надпись «Исправлено вручную»')
    ok(r['w']>r['lw']*0.8 and r['bw']=='0px', f"во всю ширину строки, без рамки кнопки ({r['w']:.0f} из {r['lw']:.0f}, рамка {r['bw']})")
    ok(await pg.locator('#tab-doc .line button.ed').count()>=1, 'кнопка-карандаш на месте')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
