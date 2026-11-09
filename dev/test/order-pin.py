"""Заявка, «Адреса в строках»: подразделение и № док. закреплены при прокрутке вправо (телефон — только подразделение), шапка не просвечивает."""
import asyncio, os
from playwright.async_api import async_playwright
O=os.environ.get('SHOT','/tmp/')
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE_PATH'))
    for nm,vw in [('pc',(1300,900)),('ph',(390,844))]:
      pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
      await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"order\"]').click()"); await pg.wait_for_timeout(500)
      # pick customer with most branches & many products
      opts=await pg.evaluate("[...document.querySelectorAll('#o-cus option')].map(o=>o.value).filter(Boolean)")
      best=None
      for v in opts:
        await pg.select_option('#o-cus', v); await pg.wait_for_timeout(250)
        r=await pg.evaluate("[document.querySelectorAll('#o-body tr').length, document.querySelectorAll('#o-head th').length, document.querySelector('#o-tbl').classList.contains('ov')]")
        if r[2]: continue
        if r[0]>=2 and r[1]>8: best=v; break
      print(nm,'customer',best)
      if not best: continue
      await pg.select_option('#o-cus', best); await pg.wait_for_timeout(400)
      wrap=await pg.query_selector('#o-tbl'); await wrap.scroll_into_view_if_needed()
      pos="(()=>{const r=s=>{const e=document.querySelector(s);return e?Math.round(e.getBoundingClientRect().left):null};return {c1:r('#o-body tr td:nth-child(1)'),c2:r('#o-body tr td:nth-child(2)'),c3:r('#o-body tr td:nth-child(3)'),h1:r('#o-head th:nth-child(1)'),f1:r('#o-foot td:nth-child(1)')}})()"
      print(nm,'before',await pg.evaluate(pos))
      await pg.evaluate("document.querySelector('#o-tbl').parentElement.scrollLeft=500; window.scrollBy(0,-60)"); await pg.wait_for_timeout(400)
      print(nm,'after ',await pg.evaluate(pos), 'sw',await pg.evaluate("document.documentElement.scrollWidth"))
      card=await pg.evaluate_handle("document.querySelector('#o-tbl').closest('.card')"); await card.as_element().screenshot(path=O+nm+'-pin.png')
      print(nm,'errors',errs); await pg.close()
    await b.close()
asyncio.run(main())
