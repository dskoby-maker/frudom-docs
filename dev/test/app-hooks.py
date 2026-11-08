"""Приложение Android: __fd.acct (вход для уведомлений), __fd.quick (виджет «Расход/Доход/Личное»), __fd.go, блок «Уведомления» в «Данных» только в приложении."""
import asyncio
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
FAKE="window.FrudomApp={openNotify:()=>{window.__opened=(window.__opened||0)+1}, toast:()=>{}};"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch()
    for app in (True, False):
      ctx=await b.new_context(viewport={'width':390,'height':800}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
      if app: await pg.add_init_script(FAKE)
      await pg.goto('http://localhost:8787/page'); await pg.wait_for_timeout(800)
      tag='приложение' if app else 'браузер'
      r=await pg.evaluate("__fd.quick('exp')"); ok(r=='login', f'{tag}: до входа quick → login ({r})')
      await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
      a=await pg.evaluate("__fd.acct()"); ok(a['user']=='Даниил' and a['key']=='1111' and a['admin'] and a['url'].startswith('http'), f'{tag}: acct {a}')
      for k,t in (('exp','Расход'),('inc','Доход'),('per','Личн')):
        r=await pg.evaluate(f"__fd.quick('{k}')"); await pg.wait_for_timeout(700)
        h=await pg.text_content('#pvi-t') or ''
        ok(r=='ok' and t.lower() in h.lower(), f'{tag}: quick {k} → окно «{h}»')
        await pg.fill('#pvi-sum','150'); await pg.fill('#pvi-note','тест '+tag+' '+k); await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(500)
      kinds=await pg.evaluate("__fd.D().pother.filter(x=>x.note.indexOf('тест '+'"+tag+"')==0).map(x=>x.kind)")
      ok(len(kinds)==3, f'{tag}: три записи сохранены {kinds}')
      r=await pg.evaluate("__fd.go('calendar')"); await pg.wait_for_timeout(300)
      ok(r=='ok' and await pg.evaluate("location.hash")=='#kalendar', f'{tag}: go calendar')
      await pg.evaluate("__fd.go('data')"); await pg.wait_for_timeout(300)
      vis=await pg.is_visible('#app-ntf'); ok(vis==app, f'{tag}: блок «Уведомления» виден={vis}')
      if app: await pg.click('#app-ntf-open'); ok(await pg.evaluate("window.__opened")==1, 'кнопка открывает настройки приложения')
      ok(await pg.evaluate("document.documentElement.scrollWidth")==390, f'{tag}: без прокрутки вбок')
      ok(not errs, f'{tag}: ошибок нет {errs[:2]}')
      await ctx.close()
    await b.close()
asyncio.run(main()); print('ПРОВАЛОВ:', len(fails))
