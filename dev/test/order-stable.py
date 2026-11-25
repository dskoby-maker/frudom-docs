"""Заявка: пока вписываешь количество, столбцы таблицы не сдвигаются (оба вида, ПК и телефон)."""
import asyncio, os, sys
from playwright.async_api import async_playwright
POS="(()=>{const t=document.querySelector('#o-tbl'),L=t.getBoundingClientRect().left;return [...t.querySelectorAll('#o-head tr:first-child>th')].slice(1).map(e=>{const r=e.getBoundingClientRect();return Math.round((r.left-L)*2)/2+':'+Math.round(r.width*2)/2}).join(' ')})()"
async def main():
  bad=0
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE_PATH'))
    for nm,vw in [('pc',(1300,900)),('ph',(390,844))]:
      pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
      await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
      await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"order\"]').click()"); await pg.wait_for_timeout(500)
      opts=await pg.evaluate("[...document.querySelectorAll('#o-cus option')].map(o=>o.value).filter(Boolean)")
      for v in opts:
        await pg.select_option('#o-cus', v); await pg.wait_for_timeout(250)
        if await pg.evaluate("document.querySelectorAll('#o-body input.q').length")>=4: break
      for view in ['a','v']:
        await pg.evaluate("v=>{const b=document.querySelector('#o-view button[data-v=\"'+v+'\"]'); if(b && !b.hidden) b.click()}", view); await pg.wait_for_timeout(400)
        cells=await pg.query_selector_all('#o-body input.q')
        base=await pg.evaluate(POS); seen=set()
        for i,val in enumerate(['3','30','300','3000','12345','0,5','','7']):
          c=cells[i%2]; await c.click(); await c.fill(''); await c.type(val); await pg.wait_for_timeout(120)
          s=await pg.evaluate(POS); seen.add(s)
        ok=len(seen)==1 and base in seen
        if not ok: bad+=1
        print(nm,view,'OK' if ok else 'СДВИГ', len(seen))
        if not ok: print(' было ',base); [print(' стало',x) for x in seen]
      sw=await pg.evaluate("document.documentElement.scrollWidth")
      print(nm,'ширина',sw,'ошибки',errs); bad+= (sw>vw[0]) + len(errs)
      await pg.close()
    await b.close()
  sys.exit(1 if bad else 0)
asyncio.run(main())
