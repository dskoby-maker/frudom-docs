"""Сжатая шапка окна (после прокрутки): «×» закрывает окно — и у окон склада («История товара»), не только у окна документа. PH=1 — телефон."""
import asyncio, os
from playwright.async_api import async_playwright
PH=os.environ.get('PH')=='1'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    pg=await b.new_page(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})('stock')"); await pg.wait_for_timeout(1200)
    for i in range(6):
      await pg.evaluate(f"__sk.send('bulk',{{kind:'in', rows:[{{itemId:'',newName:'Гречка Х',unit:'кг',qty:'{10+i}',price:'60',date:'2026-11-1{i}',exp:'',supplier:'П',docRef:'A{i}'}}]}},'тест')"); await pg.wait_for_timeout(500)
    iid=await pg.evaluate("__sk.state().items.find(i=>i.name==='Гречка Х').id")
    await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    await pg.evaluate(f"(()=>{{const b=document.createElement('button'); b.dataset.skihist='{iid}'; document.getElementById('fd-app').appendChild(b); b.click(); b.remove();}})()"); await pg.wait_for_timeout(1500)
    d=pg.locator('dialog[open]').last
    print('open', await pg.locator('dialog[open]').count(), await d.get_attribute('class'))
    await d.evaluate("d=>d.scrollTop=600"); await pg.wait_for_timeout(600)
    print('cmp', await d.get_attribute('class'))
    x=d.locator('.dc-mini .dc-x'); vis=await x.is_visible(); print('mini x visible', vis)
    box=await (x if vis else d.locator('.dc-x').first).bounding_box(); print(box)
    el=await pg.evaluate(f"(()=>{{const e=document.elementFromPoint({box['x']+box['width']/2},{box['y']+box['height']/2}); return e?e.outerHTML.slice(0,200):null}})()"); print('at point:', el)
    await pg.mouse.click(box['x']+box['width']/2, box['y']+box['height']/2); await pg.wait_for_timeout(800)
    n=await pg.locator('dialog[open]').count(); print(('OK  ' if n==0 else 'FAIL'),'× в сжатой шапке закрыл «Историю товара»'); print('ИТОГ:', 'всё прошло' if n==0 and not errs else 'ошибки', errs[:3])
    await b.close()
asyncio.run(main())
