"""Журнал: «скачать» отмеченные Счёт+ТОРГ-12+УПД одним PDF — быстро даже при большом журнале, лист не просвечивает поверх страницы."""
import asyncio, os, time
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
H2C=os.environ.get('H2C','/tmp/pdflibs/html2canvas-1.4.1/package/dist/html2canvas.min.js'); JSPDF=os.environ.get('JSPDF','/tmp/pdflibs/jspdf-2.5.1/package/dist/jspdf.umd.min.js')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
        W=int(os.environ.get('W','1300')); ctx=await b.new_context(viewport={'width':W,'height':900}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/html2canvas.min.js', lambda r: r.fulfill(path=H2C, content_type='application/javascript'))
        await pg.route('**/jspdf.umd.min.js', lambda r: r.fulfill(path=JSPDF, content_type='application/javascript'))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0], p=D.products[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          const L=[]; for(let i=0;i<14;i++){ const q=D.products[i%D.products.length]; L.push({productId:q.id,qty:String(i+2),price:'100'}); }
          Object.assign(D.draft,{id:'spd1', customerId:c.id, number:'', lines:L}); })()""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        # большой журнал: 400 копий накладной (только на экране)
        await pg.evaluate("""(()=>{const D=__fd.D(), j=D.journal.find(x=>x.id==='spd1'); for(let i=0;i<400;i++){ const c=JSON.parse(JSON.stringify(j)); c.id='spdx'+i; c.number=String(1000+i); c.snap.dr.id=c.id; c.snap.dr.number=c.number; D.journal.push(c); } })()""")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(1500)
        n=await pg.evaluate("document.querySelectorAll('#jr-body tr').length"); print('строк в журнале:', n)
        for k in ['invoice','torg12','upd']:
            await pg.evaluate(f"document.querySelector('[data-jk=\"spd1\"] [data-jkk=\"{k}\"]').click()")
        await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('[data-jkd=\"spd1\"]').click()"); await pg.wait_for_timeout(1500)
        ok(await pg.evaluate("!document.querySelector('#pv').hidden"), 'открылся просмотр')
        t0=time.time()
        async with pg.expect_download(timeout=120000) as dl:
            await pg.evaluate("document.querySelector('#pv-pdf').click()")
            await pg.wait_for_timeout(300)
            box=await pg.evaluate("(()=>{const s=[...document.querySelectorAll('#fd-app > div')].find(d=>d.querySelector('.sheet')&&!d.closest('#pv')); if(!s) return null; const r=s.getBoundingClientRect(); return [r.left, r.right];})()")
        d=await dl.value; dt=time.time()-t0
        print('PDF за', round(dt,1), 'с:', d.suggested_filename)
        ok(d.suggested_filename.endswith('.pdf'), 'PDF скачан')
        ok(dt<float(os.environ.get('LIM','25')), f'PDF готов быстро: {dt:.1f} с')
        ok(box is None or box[1]<=0, f'лист для PDF не на экране (не просвечивает): {box}')
        size=os.path.getsize(await d.path()); ok(size>20000, f'в PDF есть листы ({size} байт)')
        ok(not errs, f'ошибок JS нет {errs}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
