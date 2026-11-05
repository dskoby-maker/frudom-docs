"""Декларации: несколько товаров в декларации, номер и срок, поиск и фильтры, сборка нескольких фото в один PDF,
декларации к документу (привязанные / по названию / истёкшие), скачать одним PDF и ZIP, «запомнить выбор», правка."""
import asyncio, os, io, json, re, zipfile, urllib.request
from playwright.async_api import async_playwright
from PIL import Image
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PDFLIB=os.environ.get('PDFLIB','/tmp/claude-0/pl/package/dist/pdf-lib.min.js')
def img(color):
    b=io.BytesIO(); Image.new('RGB',(600,800),color).save(b,'JPEG'); return b.getvalue()
def pdf1():
    b=io.BytesIO(); Image.new('RGB',(600,800),'white').save(b,'PDF'); return b.getvalue()
def pages(data):
    import pypdf; return len(pypdf.PdfReader(io.BytesIO(data)).pages)
async def until(pg, js, t=8000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.route('**/pdf-lib.min.js', lambda r: r.fulfill(path=PDFLIB, content_type='application/javascript'))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            # товары документов
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); [['po{W}','Огурцы свежие {W}'],['pt{W}','Томаты черри {W}'],['pa{W}','Яблоки красные {W}'],['pk{W}','Капуста белая {W}']].forEach(([id,name])=>{{ if(!D.products.find(p=>p.id===id)) D.products.push({{id,name,code:'',unit:'кг',country:'',price:'100'}}); }}); }})()""")
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(900)
            await pg.click('#sk-segs [data-skt="files"]'); await pg.wait_for_timeout(300)
            # 1) PDF: огурцы + томаты, номер, срок
            await pg.click('[data-dl="add"]'); await pg.wait_for_timeout(300)
            await pg.set_input_files('#sk-dlg .dcf-in', files=[{'name':'decl1.pdf','mimeType':'application/pdf','buffer':pdf1()}]); await pg.wait_for_timeout(200)
            await pg.fill('#sk-dlg .dcf-q', f'Огурцы {W}, Томаты {W}'); await pg.press('#sk-dlg .dcf-q','Enter'); await pg.wait_for_timeout(200)
            ok(await pg.locator('#sk-dlg .dcf-c').count()==2, f'{W}: «огурцы, томаты» + Enter → два товара')
            await pg.fill('#sk-dlg .dcf-num', f'ЕАЭС N RU Д-RU.1-{W}'); await pg.fill('#sk-dlg .dcf-to','2027-06-30'); await pg.fill('#sk-dlg .dcf-mk','ООО Тепличное')
            sw=await pg.evaluate("(d=>d.scrollWidth<=d.clientWidth+1)(document.querySelector('#sk-dlg'))"); ok(sw, f'{W}: форма без прокрутки вбок')
            await pg.screenshot(path=f'/tmp/claude-0/decl-form-{W}.png')
            await pg.click('#sk-dlg [data-dl="save"]'); ok(await until(pg,"!document.querySelector('#sk-dlg')"), f'{W}: декларация 1 добавлена')
            await pg.wait_for_timeout(600)
            R=[r for r in rows('Склад: декларации') if r.get('№ декларации')==f'ЕАЭС N RU Д-RU.1-{W}']
            ok(R and R[0].get('Что в декларации')==f'Огурцы {W}; Томаты {W}' and R[0].get('Действует до')=='2027-06-30', f'{W}: в таблице товары, номер и срок {[(r.get("Что в декларации"),r.get("Действует до")) for r in R]}')
            # 2) два фото → один PDF, точная привязка к позиции «Яблоки», срок истёк
            await pg.click('[data-dl="add"]'); await pg.wait_for_timeout(300)
            await pg.set_input_files('#sk-dlg .dcf-in', files=[{'name':'s1.jpg','mimeType':'image/jpeg','buffer':img('red')},{'name':'s2.jpg','mimeType':'image/jpeg','buffer':img('blue')}]); await pg.wait_for_timeout(200)
            await pg.fill('#sk-dlg .dcf-q', f'Яблоки красные {W}'); await pg.wait_for_timeout(200)
            await pg.click(f'#sk-dlg [data-dl="addpid"][data-id="pa{W}"]'); await pg.wait_for_timeout(200)
            ok(await pg.locator('#sk-dlg .dcf-c.lk').count()==1, f'{W}: товар привязан к позиции документов (🔗)')
            await pg.fill('#sk-dlg .dcf-num', f'ЯБЛ-{W}'); await pg.fill('#sk-dlg .dcf-to','2026-01-31')
            await pg.click('#sk-dlg [data-dl="save"]'); ok(await until(pg,"!document.querySelector('#sk-dlg')",15000), f'{W}: два фото сохранены одной декларацией')
            await pg.wait_for_timeout(600)
            R2=[r for r in rows('Склад: декларации') if r.get('№ декларации')==f'ЯБЛ-{W}']
            ok(R2 and R2[0].get('Тип')=='application/pdf' and f'pa{W}' in R2[0].get('Позиции документов (ID)',''), f'{W}: фото собраны в PDF, привязка сохранена')
            # поиск и фильтры
            await pg.fill('#sk-q', f'томаты {W}'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#sk-list .dcl').count()==1, f'{W}: поиск «томаты» находит одну декларацию')
            await pg.fill('#sk-q', ''); await pg.wait_for_timeout(200)
            await pg.click('[data-dlf="bad"]'); await pg.wait_for_timeout(200)
            t=await pg.text_content('#sk-list'); ok(f'ЯБЛ-{W}' in t and f'Д-RU.1-{W}' not in t, f'{W}: фильтр «Истекли»')
            await pg.click('[data-dlf="all"]'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'/tmp/claude-0/decl-list-{W}.png')
            # документ: огурцы, яблоки, капуста
            jid=f'dd{W}'
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', number:'', lines:[{{productId:'po{W}',qty:'5',price:'100'}},{{productId:'pa{W}',qty:'3',price:'100'}},{{productId:'pk{W}',qty:'2',price:'100'}}]}}); }})()""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
            ok(await pg.evaluate(f"!!__fd.D().journal.find(j=>j.id==='{jid}')"), f'{W}: документ сохранён')
            await pg.evaluate(f"__decl.docs([__fd.D().journal.find(j=>j.id==='{jid}')])"); await pg.wait_for_timeout(500)
            sel=await pg.evaluate(f"(M=>Object.fromEntries(Object.entries(M.sel).map(([k,v])=>[k,[...v].length])))(__decl.st().M)")
            ok(sel.get(f'po{W}')==1, f'{W}: огурцы — декларация по названию выбрана сама')
            ok(sel.get(f'pa{W}')==0, f'{W}: яблоки — истёкшая декларация не выбрана сама')
            ok(sel.get(f'pk{W}')==0 and 'нет декларации' in await pg.text_content('#sk-dlg'), f'{W}: капуста — «нет декларации»')
            await pg.check(f'#sk-dlg input[data-ddp="pa{W}"]'); await pg.wait_for_timeout(200)
            sw=await pg.evaluate("(d=>d.scrollWidth<=d.clientWidth+1)(document.querySelector('#sk-dlg'))"); ok(sw, f'{W}: окно деклараций без прокрутки вбок')
            await pg.screenshot(path=f'/tmp/claude-0/decl-doc-{W}.png')
            async with pg.expect_download() as dl: await pg.click('#sk-dlg [data-dd="pdf"]')
            d=await dl.value; data=open(await d.path(),'rb').read()
            ok(d.suggested_filename.endswith('.pdf') and pages(data)==4, f'{W}: один PDF: титул + 1 + 2 страницы = {pages(data)} ({d.suggested_filename})')
            await pg.wait_for_timeout(1500)
            R=[r for r in rows('Склад: декларации') if r.get('№ декларации')==f'ЕАЭС N RU Д-RU.1-{W}']
            ok(f'po{W}' in R[0].get('Позиции документов (ID)',''), f'{W}: «запомнить выбор» — огурцы теперь привязаны')
            async with pg.expect_download() as dl: await pg.click('#sk-dlg [data-dd="zip"]')
            d=await dl.value; z=zipfile.ZipFile(await d.path()); ok(len(z.namelist())==2, f'{W}: ZIP с 2 файлами {z.namelist()}')
            await pg.click('#sk-dlg .dc-x, #sk-dlg [data-sk="close"]') if await pg.locator('#sk-dlg [data-sk="close"]').count() else None
            await pg.wait_for_timeout(300)
            # правка: убрать «Томаты»
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(600); await pg.click('#sk-segs [data-skt="files"]'); await pg.wait_for_timeout(300)
            fid=R[0]['ID (не менять)']; await pg.click(f'[data-dl="edit"][data-id="{fid}"]'); await pg.wait_for_timeout(300)
            n0=await pg.locator('#sk-dlg .dcf-c').count()
            await pg.locator('#sk-dlg .dcf-c', has_text='Томаты').locator('button').click(); await pg.wait_for_timeout(150)
            await pg.click('#sk-dlg [data-dl="save"]'); await until(pg,"!document.querySelector('#sk-dlg')"); await pg.wait_for_timeout(600)
            R=[r for r in rows('Склад: декларации') if r['ID (не менять)']==fid]; ok('Томаты' not in R[0].get('Что в декларации','') and f'po{W}' in R[0].get('Позиции документов (ID)',''), f'{W}: правка сохранена, привязка не потерялась ({n0} → {R[0].get("Что в декларации")})')
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
