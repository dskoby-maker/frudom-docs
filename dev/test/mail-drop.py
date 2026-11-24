"""Почта: файл можно перетащить в ответ / новое письмо (24.11.2026).
Запуск после test/mail.py на том же сервере (там подключаются ящики и приходят письма)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
DROP="""(sel=>{ const t=document.querySelector(sel), dt=new DataTransfer();
  dt.items.add(new File(['hello'], 'акт сверки.txt', {type:'text/plain'})); dt.items.add(new File(['%PDF-1.4'], 'скан.pdf', {type:'application/pdf'}));
  t.dispatchEvent(new DragEvent('dragenter',{bubbles:true,cancelable:true,dataTransfer:dt}));
  t.dispatchEvent(new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:dt}));
  const on=document.querySelector('.mlcomp').classList.contains('mldrag');
  const r=t.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  return [on, r]; })"""
async def until(pg, js, n=60):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(TAB+"('mail')")
        ok(await until(pg, "document.querySelectorAll('#ml-list .mlr').length>0", 80), "письма есть")
        await pg.click('#ml-list .mlr >> nth=0'); await until(pg, "!!document.querySelector('#ml-view [data-ml=\"reply\"]')", 40)
        await pg.click('#ml-view [data-ml="reply"]'); await until(pg, "!!document.querySelector('.mlcomp')", 20)
        ok(await pg.locator('.mlcdh').count()==1, 'подсказка «или перетащите файлы сюда»')
        await pg.fill('#mlc-text', 'Добрый день, высылаю')
        r=await pg.evaluate(DROP, '#mlc-text')
        ok(r[0], 'при перетаскивании — рамка «Отпустите — файл прикрепится»')
        ok(r[1] is False, 'браузер не открыл файл сам')
        await pg.wait_for_timeout(300)
        chips=await pg.evaluate("[...document.querySelectorAll('.mlcomp .mlchip')].map(c=>c.textContent)")
        ok(any('акт сверки.txt' in c for c in chips) and any('скан.pdf' in c for c in chips), f'оба файла прикреплены {chips}')
        ok(await pg.evaluate("!document.querySelector('.mlcomp').classList.contains('mldrag')"), 'рамка убралась')
        ok('высылаю' in await pg.input_value('#mlc-text'), 'набранный текст не пропал')
        # бросить на список писем — тоже прикрепляется к открытому ответу
        await pg.evaluate(DROP, '#ml-list')
        await pg.wait_for_timeout(300)
        n=await pg.locator('.mlcomp .mlchip').count(); ok(n==4, f'бросили на список — тоже в письмо ({n})')
        # без открытого письма — ничего не перехватываем
        await pg.evaluate("[...document.querySelectorAll('.mlcomp [data-ml=cclose]')].find(b=>b.offsetParent).click()"); await pg.wait_for_timeout(300)
        r2=await pg.evaluate("""(()=>{ const dt=new DataTransfer(); dt.items.add(new File(['x'],'a.txt')); return document.querySelector('#ml-list').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt})); })()""")
        ok(r2 is True, 'без открытого ответа файл не перехватывается')
        ok(not errs, f'нет ошибок JS {errs}')
        await b.close()
    print("ИТОГ:", "ошибок нет" if not fails else f"ошибок: {len(fails)}")
asyncio.run(main())
