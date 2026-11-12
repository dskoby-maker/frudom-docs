"""Печать декларации без скачивания: кнопка в списке и в карточке, PDF (2 стр.) и фото → окно печати с картинками страниц; телефон.
Нужны: pdf.js (PDFJS_DIR — папка build из pdfjs-dist@3.11.174), тестовый PDF (DPDF)."""
import asyncio, os, base64
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PJ=os.environ['PDFJS_DIR']; DPDF=os.environ['DPDF']
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
HOOK="""(()=>{ window.__pr=[]; const ap=Element.prototype.appendChild; Element.prototype.appendChild=function(n){ const r=ap.call(this,n); if(n&&n.tagName==='IFRAME'&&!n.src){ try{ n.contentWindow.print=()=>{ const d=n.contentWindow.document; window.__pr.push({imgs:d.images.length, ok:[...d.images].every(i=>i.naturalWidth>0)}); }; }catch(e){} } return r; }; })()"""
async def add(pg, name, mime, buf, goods):
    await pg.click('[data-dl="add"]'); await pg.wait_for_timeout(300)
    await pg.set_input_files('#sk-dlg .dcf-in', files=[{'name':name,'mimeType':mime,'buffer':buf}]); await pg.wait_for_timeout(200)
    await pg.fill('#sk-dlg .dcf-q', goods); await pg.press('#sk-dlg .dcf-q','Enter'); await pg.wait_for_timeout(200)
    await pg.click('#sk-dlg [data-dl="save"]'); await pg.wait_for_timeout(1500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H,first in [(1300,900,True),(390,844,False)]:
            ctx=await b.new_context(viewport={'width':W,'height':H}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/pdf.js/*/pdf.min.js', lambda r: r.fulfill(path=PJ+'/pdf.min.js', content_type='text/javascript'))
            await pg.route('**/pdf.js/*/pdf.worker.min.js', lambda r: r.fulfill(path=PJ+'/pdf.worker.min.js', content_type='text/javascript'))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Склад"]'); await pg.fill('#fd-pass','4444'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(HOOK)
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(900); await pg.click('#sk-segs [data-skt="files"]'); await pg.wait_for_timeout(300)
            if first:
                await add(pg,'dp.pdf','application/pdf',open(DPDF,'rb').read(),'Огурцы печать')
                await add(pg,'dp.png','image/png',PNG,'Томаты печать')
            n=await pg.locator('.dcl [data-skfprn]').count(); ok(n>=2, f'{W}: у деклараций есть кнопка «Печать» ({n})')
            pdfb=pg.locator('.dcl', has_text='Огурцы печать').locator('[data-skfprn]')
            await pdfb.click(); await pg.wait_for_function('window.__pr.length>=1', timeout=15000)
            r=await pg.evaluate('window.__pr[0]'); ok(r['imgs']==2 and r['ok'], f'{W}: PDF из 2 страниц ушёл на печать картинками {r}')
            await pg.locator('.dcl', has_text='Томаты печать').locator('[data-dl="view"]').click(); await pg.wait_for_timeout(500)
            await pg.locator('#sk-dlg [data-skfprn]').click(); await pg.wait_for_function('window.__pr.length>=2', timeout=15000)
            r=await pg.evaluate('window.__pr[1]'); ok(r['imgs']==1 and r['ok'], f'{W}: фото из карточки декларации — на печать {r}')
            ok(await pg.evaluate('document.documentElement.scrollWidth')==W, f'{W}: без прокрутки вбок')
            await pg.screenshot(path=os.environ.get('SHOTS','/tmp')+f'/decl-print-{W}.png')
            ok(not errs, f'{W}: без ошибок {errs}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
