"""«Последние документы» в форме: номер, дата и кнопка на одной линии; окно со списком → накладная → «‹ Документы заказчика»; фильтр по поставщику; ПК и телефон."""
import asyncio, os
from playwright.async_api import async_playwright
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"calendar\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
O=os.environ.get('SHOT','/tmp/')
CID=[None]
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE_PATH'))
    for nm,vw in [('pc',(1300,900)),('ph',(390,844))]:
      pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
      await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(300)
      # pick customer with most docs
      cid=CID[0] or await pg.evaluate("__fd.D().customers.find(c=>!c.priv && c.inn).id"); CID[0]=cid
      if nm=='pc':
        pid=await pg.evaluate("__fd.D().products[0].id")
        for jid,dt in [('ld1','2026-10-14'),('ld2','2026-10-28'),('ld3','2026-11-05')]:
          await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:'{cid}', number:'', date:'{dt}', lines:[{{productId:'{pid}',qty:'3',price:'150'}}]}}); }})()")
          await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
        await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1200)
        await pg.evaluate("Object.assign(__fd.D().draft,{id:'new1',customerId:'',lines:[]})"); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300)
      print(nm,'cid',cid)
      if cid:
        await pg.select_option('#d-cus', cid); await pg.wait_for_timeout(500)
      el=await pg.query_selector('#d-num'); await el.scroll_into_view_if_needed()
      box=await pg.evaluate("(()=>{const r=e=>{const x=document.querySelector(e).getBoundingClientRect();return [Math.round(x.top),Math.round(x.height)]};return {num:r('#d-num'),date:r('#d-date'),btn:document.querySelector('#d-ldw').hidden?null:r('#d-lastdocs')}})()"); print(nm,box)
      g=await pg.query_selector('#d-num'); 
      card=await pg.evaluate_handle("document.querySelector('#d-num').closest('.card')"); await card.as_element().screenshot(path=O+nm+'-form.png')
      if box['btn']:
        await pg.click('#d-lastdocs'); await pg.wait_for_timeout(700); await pg.screenshot(path=O+nm+'-list.png')
        await pg.click('#fd-dcard .ld-row'); await pg.wait_for_timeout(700); await pg.screenshot(path=O+nm+'-doc.png')
        await pg.click('#fd-dcard [data-navback]'); await pg.wait_for_timeout(700); await pg.screenshot(path=O+nm+'-back.png')
        print(nm,'after back:', await pg.evaluate("document.querySelector('#fd-dcard .dc-kicker').textContent"))
        ch=await pg.query_selector('#fd-dcard .ld-chips button:nth-child(2)')
        if ch: await ch.click(); await pg.wait_for_timeout(600); print(nm,'chip ok', await pg.evaluate("document.querySelectorAll('#fd-dcard .ld-row').length"))
        sw=await pg.evaluate("document.documentElement.scrollWidth"); print(nm,'scrollWidth',sw)
      print(nm,'errors',errs); await pg.close()
    await b.close()
asyncio.run(main())
