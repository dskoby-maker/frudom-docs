"""Декларации в любом печатном формате: Word/Excel… превращаются в PDF через Google Диск (Code.gs ≥ 22).
Загрузка: Word один — хранится как есть; фото + Word — собираются в один PDF. «Скачать одним PDF» к документу вставляет и Word.
Старый скрипт / ошибка Диска — понятное предупреждение, PDF всё равно скачивается."""
import asyncio, os, io, json, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
def ev(js): return json.load(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PDFLIB=os.environ.get('PDFLIB','/opt/npm-tools/node_modules/pdf-lib/dist/pdf-lib.min.js')
DOCX='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
def img(color):
    b=io.BytesIO(); Image.new('RGB',(600,800),color).save(b,'JPEG'); return b.getvalue()
def pages(data):
    import pypdf; return len(pypdf.PdfReader(io.BytesIO(data)).pages)
async def until(pg, js, t=8000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def add(pg, files, name):
    await pg.click('[data-dl="add"]'); await pg.wait_for_timeout(300)
    await pg.set_input_files('#sk-dlg .dcf-in', files=files); await pg.wait_for_timeout(200)
    await pg.fill('#sk-dlg .dcf-q', name); await pg.press('#sk-dlg .dcf-q','Enter'); await pg.wait_for_timeout(200)
    await pg.click('#sk-dlg [data-dl="save"]'); return await until(pg,"!document.querySelector('#sk-dlg')")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/pdf-lib.min.js', lambda r: r.fulfill(path=PDFLIB, content_type='application/javascript'))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); [['fk{W}','Капуста белая {W}'],['fc{W}','Какао-порошок {W}']].forEach(([id,name])=>{{ if(!D.products.find(p=>p.id===id)) D.products.push({{id,name,code:'',unit:'кг',country:'',price:'100'}}); }}); }})()""")
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(900); await pg.click('#sk-segs [data-skt="files"]'); await pg.wait_for_timeout(300)
            await pg.click('[data-dl="add"]'); await pg.wait_for_timeout(300); hint=await pg.text_content('#sk-dlg .dcf-file'); acc=await pg.get_attribute('#sk-dlg .dcf-in','accept')
            ok('Word' in hint and '.rtf' in acc and '.pptx' in acc, f'{W}: в форме написано про Word/Excel, файлы .rtf/.odt/.pptx выбираются')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            # 1) один Word — хранится как есть
            ok(await add(pg,[{'name':f'Декларация_капуста_{W}.docx','mimeType':DOCX,'buffer':b'PK\x03\x04 docx'}], f'Капуста белая {W}'), f'{W}: Word-декларация загружена')
            await pg.wait_for_timeout(600)
            R=[r for r in rows('Склад: декларации') if r.get('Файл')==f'Декларация_капуста_{W}.docx']
            ok(R and R[0].get('Тип')==DOCX, f'{W}: Word хранится как есть {[r.get("Тип") for r in R]}')
            # 2) фото + Word (+ rtf без типа от браузера) → один PDF; временный файл на Диске удалён
            n0=ev("typeof __conv==='undefined'?0:__conv.n")
            ok(await add(pg,[{'name':'p1.jpg','mimeType':'image/jpeg','buffer':img('red')},{'name':f'стр2_{W}.docx','mimeType':DOCX,'buffer':b'PK docx2'},{'name':f'стр3_{W}.rtf','mimeType':'','buffer':b'{\\rtf1 x}'}], f'Какао-порошок {W}'), f'{W}: фото + Word + RTF сохранены одной декларацией')
            await pg.wait_for_timeout(600)
            R=[r for r in rows('Склад: декларации') if f'Какао-порошок {W}' in (r.get('Что в декларации') or '')]
            ok(R and R[0].get('Тип')=='application/pdf', f'{W}: собраны в один PDF {[r.get("Тип") for r in R]}')
            ok(ev("typeof __conv==='undefined'?0:__conv.n")-n0==2 and ev("__conv.last.mimeType")=='application/vnd.google-apps.document', f'{W}: Word и RTF превращены через Google Документ')
            fl=json.load(urllib.request.urlopen('http://localhost:8787/files')); ok(not any((f.get('name') or '').startswith('pdf-src') for f in fl), f'{W}: временных файлов на Диске не осталось')
            # 3) документ: капуста (Word) + какао → «Скачать одним PDF»
            jid=f'df{W}'
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', number:'', lines:[{{productId:'fk{W}',qty:'5',price:'100'}},{{productId:'fc{W}',qty:'2',price:'100'}}]}}); }})()""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
            await pg.evaluate(f"__decl.docs([__fd.D().journal.find(j=>j.id==='{jid}')])"); await pg.wait_for_timeout(500)
            sel=await pg.evaluate("(M=>Object.values(M.sel).map(v=>[...v].length))(__decl.st().M)"); ok(sel==[1,1], f'{W}: у обоих товаров декларация выбрана {sel}')
            n0=ev("__conv.n")
            async with pg.expect_download() as dl: await pg.click('#sk-dlg [data-dd="pdf"]')
            d=await dl.value; data=open(await d.path(),'rb').read(); await pg.wait_for_timeout(500)
            toasts=await pg.text_content('#fd-toasts') or ''
            ok(pages(data)==1+1+3, f'{W}: один PDF: титул + Word (1) + фото/Word/RTF (3) = {pages(data)}')
            ok('не всё вошло' not in toasts, f'{W}: без предупреждения «не всё вошло»')
            ok(ev("__conv.n")-n0==1, f'{W}: Word-декларация превращена в PDF на сервере')
            # 4) Диск не смог — PDF всё равно скачан, в предупреждении причина
            await pg.evaluate("__decl.st().M && Object.keys(window).length"); ev("__conv.fail=true; 1")
            await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(t=>t.remove())")
            # сбросить кэш превращённого файла
            await pg.evaluate("location.hash");
            await pg.click('#sk-dlg .dc-x') if await pg.locator('#sk-dlg .dc-x').count() else None
            await pg.reload(); await pg.wait_for_timeout(2500)
            await pg.route('**/pdf-lib.min.js', lambda r: r.fulfill(path=PDFLIB, content_type='application/javascript'))
            await pg.evaluate(f"__decl.docs([__fd.D().journal.find(j=>j.id==='{jid}')])"); await pg.wait_for_timeout(500)
            async with pg.expect_download() as dl: await pg.click('#sk-dlg [data-dd="pdf"]')
            d=await dl.value; data=open(await d.path(),'rb').read(); await pg.wait_for_timeout(500)
            toasts=await pg.text_content('#fd-toasts') or ''
            ok(pages(data)==4 and 'не всё вошло' in toasts and 'Google Диск' in toasts and f'Декларация_капуста_{W}.docx' in toasts, f'{W}: Диск не смог — PDF без этого файла, причина в предупреждении: {toasts[:160]}')
            ev("__conv.fail=false; 1")
            # 5) старый скрипт таблицы
            await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(t=>t.remove()); __fd.D().srvVer=21")
            async with pg.expect_download() as dl: await pg.click('#sk-dlg [data-dd="pdf"]')
            await dl.value; await pg.wait_for_timeout(500); toasts=await pg.text_content('#fd-toasts') or ''
            ok('обновите Code.gs' in toasts, f'{W}: со старым скриптом — «обновите Code.gs»')
            sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{W}: без прокрутки вбок {sw}')
            await pg.screenshot(path=f'/tmp/claude-0/declfmt-{W}.png')
            ok(not errs, f'{W}: ошибок на странице нет {errs[:2]}')
            await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
