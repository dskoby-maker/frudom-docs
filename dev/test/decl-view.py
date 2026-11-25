"""Декларации к документу: выбор свёрнут, «Сайт сам подобрал…» только когда всё верно, сомнения ведут к товару,
«Открыть» — стандартный просмотр (#pv) с «Печать» и «Скачать PDF». ПК и телефон. Нужны pdf.js (PDFJS_DIR) и pdf-lib (PDFLIB)."""
import asyncio, os, io, sys
from playwright.async_api import async_playwright
from PIL import Image
PJ=os.environ.get('PDFJS_DIR','/tmp/pj/package/build'); PDFLIB=os.environ.get('PDFLIB','/tmp/claude-0/pl/package/dist/pdf-lib.min.js')
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def pdf1(c):
    b=io.BytesIO(); Image.new('RGB',(600,800),c).save(b,'PDF'); return b.getvalue()
async def until(pg, js, t=10000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':W,'height':vw[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/pdf.js/*/pdf.min.js', lambda r: r.fulfill(path=PJ+'/pdf.min.js', content_type='text/javascript'))
            await pg.route('**/pdf.js/*/pdf.worker.min.js', lambda r: r.fulfill(path=PJ+'/pdf.worker.min.js', content_type='text/javascript'))
            await pg.route('**/pdf-lib.min.js', lambda r: r.fulfill(path=PDFLIB, content_type='application/javascript'))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); [['vg{W}','Груши зелёные {W}'],['vl{W}','Лимоны жёлтые {W}']].forEach(([id,name])=>{{ if(!D.products.find(p=>p.id===id)) D.products.push({{id,name,code:'',unit:'кг',country:'',price:'100'}}); }}); }})()""")
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(900); await pg.click('#sk-segs [data-skt="files"]'); await pg.wait_for_timeout(300)
            # декларация на оба товара, привязана, со сроком
            await pg.click('[data-dl="add"]'); await pg.wait_for_timeout(300)
            await pg.set_input_files('#sk-dlg .dcf-in', files=[{'name':'fr.pdf','mimeType':'application/pdf','buffer':pdf1('white')}]); await pg.wait_for_timeout(200)
            await pg.evaluate(f"""(()=>{{ const F=__decl.st().F; F.chips=[{{t:'Груши {W}',pid:'vg{W}'}},{{t:'Лимоны {W}',pid:'vl{W}'}}]; }})()""")
            await pg.fill('#sk-dlg [name="num"], #sk-dlg .dcf-num', f'ФР-{W}') if await pg.locator('#sk-dlg .dcf-num, #sk-dlg [name="num"]').count() else None
            await pg.evaluate("(()=>{ const i=document.querySelector('#sk-dlg input[type=date]'); if(i){ i.value='2030-01-01'; i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new Event('change',{bubbles:true})); } })()")
            await pg.click('#sk-dlg [data-dl="save"]'); ok(await until(pg,"!document.querySelector('#sk-dlg')"), f'{W}: декларация сохранена'); await pg.wait_for_timeout(500)
            jid=f'dv{W}'
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', number:'', lines:[{{productId:'vg{W}',qty:'4',price:'100'}},{{productId:'vl{W}',qty:'2',price:'100'}}]}}); }})()""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
            await pg.evaluate(f"__decl.docs([__fd.D().journal.find(j=>j.id==='{jid}')])"); await pg.wait_for_timeout(600)
            t=await pg.text_content('#sk-dlg .dd-auto') or ''
            ok('Сайт сам подобрал декларации ко всем 2 товарам' in t and '1 декларация' in t, f'{W}: всё верно — «Сайт сам подобрал…» ({t[:90]!r})')
            ok(await pg.evaluate("document.querySelector('#sk-dlg .dd-auto').classList.contains('ok') && !document.querySelector('#sk-dlg .dd-fold').classList.contains('on')"), f'{W}: зелёная плашка, выбор свёрнут')
            ok(not await pg.locator('#sk-dlg [data-dd="pdf"]').count() and await pg.locator('#sk-dlg [data-dd="view"]').is_visible(), f'{W}: вместо «Скачать» — «Открыть»')
            sw=await pg.evaluate("(d=>{ const r=d.getBoundingClientRect(), R=r.left+d.clientLeft+d.clientWidth+2; return ![...d.querySelectorAll('*')].some(e=>!e.closest('#fd-toasts') && e.getBoundingClientRect().width>0 && e.getBoundingClientRect().right>R); })(document.querySelector('#sk-dlg'))"); ok(sw, f'{W}: окно без прокрутки вбок')
            await pg.screenshot(path=f'/tmp/claude-0/declv-ok-{W}.png')
            # снимаем выбор вручную → сомнение
            await pg.click('#sk-dlg [data-dd="tog"]'); await pg.wait_for_timeout(450)
            ok(await pg.evaluate("document.querySelector('#sk-dlg .dd-fold').classList.contains('on')"), f'{W}: «Показать выбор» раскрывает')
            await pg.uncheck(f'#sk-dlg input[data-ddp="vl{W}"]'); await pg.wait_for_timeout(300)
            t=await pg.text_content('#sk-dlg .dd-auto'); ok('Не ко всем товарам' in t and 'Лимоны' in t and 'нет декларации' in t and 'Сайт сам' not in t, f'{W}: снят выбор — «нет декларации», похвалы нет')
            await pg.click('#sk-dlg [data-dd="tog"]'); await pg.wait_for_timeout(450)
            await pg.click('#sk-dlg .dd-dq [data-dd="fix"]'); await pg.wait_for_timeout(700)
            ok(await pg.evaluate(f"document.querySelector('#sk-dlg .dd-fold').classList.contains('on') && document.querySelector('#sk-dlg .dd-p[data-pid=\"vl{W}\"]').classList.contains('dd-flash')"), f'{W}: нажатие на сомнение раскрывает и показывает товар')
            await pg.screenshot(path=f'/tmp/claude-0/declv-doubt-{W}.png')
            await pg.check(f'#sk-dlg input[data-ddp="vl{W}"]'); await pg.wait_for_timeout(300)
            t=await pg.text_content('#sk-dlg .dd-auto'); ok('Декларации выбраны ко всем 2 товарам' in t, f'{W}: выбрано вручную — «выбраны», а не «сайт сам»')
            # просмотр
            await pg.click('#sk-dlg [data-dd="view"]')
            ok(await until(pg,"!document.querySelector('#pv').hidden && !document.querySelector('#sk-dlg') && document.querySelectorAll('#pv-pages .sheet.dpv img').length===1 && !document.querySelector('.dpv-load')"), f'{W}: стандартный просмотр с листом декларации')
            ok('Декларации к документу' in await pg.text_content('#pv-title'), f'{W}: заголовок просмотра')
            sw=await pg.evaluate("(()=>{ const s=document.querySelector('#pv-pages .sheet.dpv').getBoundingClientRect(); return s.right<=innerWidth+1 && s.left>=-1; })()"); ok(sw, f'{W}: лист влезает по ширине')
            await pg.screenshot(path=f'/tmp/claude-0/declv-pv-{W}.png')
            n0=await pg.evaluate("document.querySelectorAll('iframe').length")
            await pg.evaluate("window.__p=0; const o=HTMLIFrameElement.prototype; new MutationObserver(m=>m.forEach(r=>r.addedNodes.forEach(n=>{ if(n.tagName==='IFRAME'){ try{ n.contentWindow.print=()=>{ window.__p=n.contentWindow.document.images.length; }; }catch(e){} } }))).observe(document.body,{childList:true})")
            await pg.click('#pv-print'); ok(await until(pg,"window.__p===1",5000), f'{W}: «Печать» — лист декларации ушёл на печать')
            async with pg.expect_download() as dl: await pg.click('#pv-pdf')
            d=await dl.value; ok(d.suggested_filename.endswith('.pdf') and open(await d.path(),'rb').read()[:4]==b'%PDF', f'{W}: «Скачать PDF» — {d.suggested_filename}')
            await pg.click('#pv-close'); ok(await until(pg,"document.querySelector('#pv').hidden && !!document.querySelector('#sk-dlg .dd-auto')"), f'{W}: «Закрыть» — назад к декларациям')
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}'); sys.exit(1 if fails else 0)
asyncio.run(main())
