"""Вкладка «Контракты ↗» (18.11.2026): только Даниил, открывает frudom.ru/contracts в новой вкладке; на телефоне — в «Все разделы»."""
import asyncio, os
from playwright.async_api import async_playwright
W=int(os.environ.get('W','1300'))
async def run(who, pw):
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path='/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None, args=['--no-sandbox'])
    ctx=await b.new_context(viewport={'width':W,'height':860}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await ctx.route('https://frudom.ru/**', lambda r: r.fulfill(status=200, content_type='text/html', body='<h1>contracts</h1>'))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass', pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    vis = await pg.evaluate("!document.querySelector('nav.tabs button[data-tab=contracts]').hidden")
    res={'who':who,'visible':vis}
    if vis:
      cur0 = await pg.evaluate("(document.querySelector('nav.tabs button[aria-selected=true]')||{}).dataset?.tab")
      async with ctx.expect_page() as np:
        if W<700:
          await pg.click('#mbar [data-mt="__more"]'); await pg.wait_for_timeout(500)
          await pg.click('#ts-grid [data-tile="contracts"]')
        else:
          await pg.click('nav.tabs button[data-tab=contracts]')
      newp = await np.value; await newp.wait_for_load_state()
      res['opened']=newp.url; res['sameTab']= (await pg.evaluate("(document.querySelector('nav.tabs button[aria-selected=true]')||{}).dataset?.tab"))==cur0
    res['errs']=errs; print(res); await b.close(); return res
async def main():
  a=await run('Даниил','1111'); assert a['visible'] and a['opened'].startswith('https://frudom.ru/contracts') and a['sameTab'] and not a['errs']
  for who,pw in [('Наталья','2222'),('Гриша','3333')]:
    r=await run(who,pw); assert not r['visible'] and not r['errs']
  print('ok')
asyncio.run(main())
