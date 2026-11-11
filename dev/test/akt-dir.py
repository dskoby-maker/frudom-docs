"""Акты и письма из папки заказчика на Диске: подключить папку, раскладка по ОП, «С печатью и подписью» (место само у фамилии / «м.п.»),
перетаскивание запоминается, «Всё одним PDF с печатью». Нужны: pdf.js (PDFJS_DIR — iife-сборка pdf.min.js и pdf.worker.min.js), pdf-lib, тестовые PDF (PDFS)."""
import asyncio, json, os, base64, re, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SP='/tmp/claude-0/-home-claude/e050705b-f8b4-506e-91d5-ab48c1c4f576/scratchpad'
PJ=os.environ.get('PDFJS_DIR', SP+'/pdfjs'); PD=os.environ.get('PDFS', SP+'/pdfs'); PL=os.environ.get('PDFLIB','/opt/npm-tools/node_modules/pdf-lib/dist/pdf-lib.min.js')
b64=lambda p: base64.b64encode(open(p,'rb').read()).decode()
def ev(js): return urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode()
FILES=[{'id':'fAktDiet0001','name':'Акт Диет. 2026.pdf','mime':'application/pdf','b64':b64(PD+'/act.pdf')},
       {'id':'fSopDiet0002','name':'Сопровод Диет питания.pdf','mime':'application/pdf','b64':b64(PD+'/letter.pdf')},
       {'id':'fAktKomb0003','name':'Акт Комбинат2026.docx','mime':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','b64':base64.b64encode(b'PK fake docx').decode()}]
ev('__dir='+json.dumps({'id':'DIRTEST1234567890abcdef','name':'МГУ акты ноябрь','files':FILES})+'; 1')
def npages(p):
    import pypdf; return len(pypdf.PdfReader(p).pages)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ([(int(x.split('x')[0]),int(x.split('x')[1])) for x in os.environ.get('SIZES','1300x900,390x844').split(',')]):
            ctx=await b.new_context(viewport={'width':W,'height':H}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/pdf.js/*/pdf.min.js', lambda r: r.fulfill(path=PJ+'/pdf.min.js', content_type='text/javascript'))
            await pg.route('**/pdf.js/*/pdf.worker.min.js', lambda r: r.fulfill(path=PJ+'/pdf.worker.min.js', content_type='text/javascript'))
            await pg.route('**/pdf-lib.min.js', lambda r: r.fulfill(path=PL, content_type='text/javascript'))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            st='data:image/png;base64,'+b64(PD+'/stamp.png'); sg='data:image/png;base64,'+b64(PD+'/sign.png')
            cid=await pg.evaluate("""([st,sg])=>{ const D=__fd.D(), c=D.customers.find(x=>!x.priv&&x.id!=='private-buyer'); c.branches=JSON.stringify([{id:'b1',label:'Столовые диетического питания'},{id:'b2',label:'Комбинат питания'}]);
               D.suppliers.forEach(s=>{ s.stamp=''; s.sign=''; }); const s=D.suppliers[0]; s.fio='Суховерхова Анастасия Дмитриевна'; s.stamp=st; s.sign=sg; return c.id; }""", [st,sg])
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"customers\"]').click()"); await pg.wait_for_timeout(500)
            await pg.select_option('#cus-editor select.pick', cid); await pg.wait_for_timeout(1200)
            if await pg.locator('#ad-url').count():
                print('    (папка ещё не подключена)')
                ok(await pg.locator('#ad-url').count()==1, f'{W}: без папки — поле ссылки и «Подключить папку»')
                await pg.fill('#ad-url','https://drive.google.com/drive/folders/НЕТТАКОЙ'); await pg.click('[data-adset]'); await pg.wait_for_timeout(800)
                ok('не похоже' in (await pg.text_content('#akt-dir')) , f'{W}: кривая ссылка — понятная ошибка')
                await pg.fill('#ad-url','https://drive.google.com/drive/folders/DIRTEST1234567890abcdef?usp=sharing'); await pg.click('[data-adset]'); await pg.wait_for_timeout(1200)
            await pg.wait_for_function("document.querySelector('#akt-dir') && /файл/.test(document.querySelector('#akt-dir').textContent)", timeout=8000)
            t=await pg.text_content('#akt-dir'); print('   ', t[:120])
            ok('МГУ акты ноябрь' in t and '3 файла' in t, f'{W}: папка подключена, 3 файла')
            G=await pg.evaluate("__adir.groups().map(g=>[g.label, g.L.map(f=>f.kind+':'+f.name)])"); print('   ',G)
            ok(len(G)==2 and G[0][0].startswith('Столовые') and G[0][1]==['act:Акт Диет. 2026.pdf','letter:Сопровод Диет питания.pdf'] and G[1][1]==['act:Акт Комбинат2026.docx'], f'{W}: разложено по ОП, акт перед письмом')
            # окно с печатью — акт
            await pg.click('[data-adsig="fAktDiet0001"]'); await pg.wait_for_selector('#ads-page .adov[data-k="st"]:not([hidden])', timeout=15000); await pg.wait_for_timeout(500)
            L=await pg.evaluate("({L:__adir.sign.L, A:__adir.sign.A&&{x:__adir.sign.A.x,y:__adir.sign.A.y}, h:__adir.sign.R.pages[0].h})")
            stc=L['L']['st']; sgc=L['L']['sg']; Hp=L['h']; mpY=Hp-(841.89-450-90)
            ok(L['A'] and abs(L['A']['x']-(330+21*6))<60, f'{W}: нашёл фамилию поставщика: {L["A"]}')
            ok(abs(stc['x']+stc['w']/2-345)<40 and abs(stc['y']+stc['w']/2-mpY)<45, f'{W}: печать на «м.п.» в колонке поставщика: центр {stc["x"]+stc["w"]/2:.0f},{stc["y"]+stc["w"]/2:.0f} (м.п. ≈345,{mpY:.0f})')
            ok(330<sgc['x']+sgc['w']/2<330+21*6 and sgc['y']<L['A']['y']<sgc['y']+sgc['w'], f'{W}: подпись на линии слева от фамилии: {sgc}')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            await pg.screenshot(path=f'{SP}/adsign{W}.png')
            # перетащить печать
            ov=pg.locator('#ads-page .adov[data-k="st"]'); await ov.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200); bb=await ov.bounding_box()
            print('    под мышью:', await pg.evaluate(f"(e=>e&&(e.className||e.tagName))(document.elementFromPoint({bb['x']+bb['width']/2},{bb['y']+bb['height']/2}))"), bb)
            await pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); await pg.mouse.down(); await pg.mouse.move(bb['x']+bb['width']/2+40, bb['y']+bb['height']/2+10, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
            x2=await pg.evaluate("__adir.sign.L.st.x"); ok(x2>stc['x']+5, f'{W}: печать перетаскивается ({stc["x"]:.0f} → {x2:.0f})')
            sv=await pg.evaluate(f"(__fd.getPrefs?__fd.getPrefs():JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/pref/i.test(k)))||'{{}}')).aktSig")
            ok(sv and any(k.endswith('|act|b1') for k in sv), f'{W}: место запомнено: {list((sv or {}).keys())}')
            async with pg.expect_download() as dl: await pg.click('[data-adsdl]')
            d=await dl.value; fp=await d.path(); import shutil; shutil.copy(fp, f'{SP}/signed{W}.pdf'); ok(d.suggested_filename=='Акт Диет. 2026 (с печатью).pdf' and os.path.getsize(fp)>os.path.getsize(PD+'/act.pdf')+500, f'{W}: скачан PDF с печатью: {d.suggested_filename} {os.path.getsize(fp)} байт')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            # снова открыть — печать там же, где оставили
            await pg.click('[data-adsig="fAktDiet0001"]'); await pg.wait_for_selector('#ads-page .adov[data-k="st"]:not([hidden])', timeout=15000)
            x3=await pg.evaluate("__adir.sign.L.st.x"); ok(abs(x3-x2)<1, f'{W}: при следующем открытии печать на запомненном месте ({x3:.0f})')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            # письмо
            await pg.click('[data-adsig="fSopDiet0002"]'); await pg.wait_for_selector('#ads-page .adov[data-k="sg"]:not([hidden])', timeout=15000)
            L=await pg.evaluate("({L:__adir.sign.L, A:__adir.sign.A&&{x:__adir.sign.A.x,y:__adir.sign.A.y}})"); sgc=L['L']['sg']
            ok(L['A'] and abs(L['A']['y']-346)<6 and L['A']['x']>300, f'{W}: в письме опора — «/Суховерхова А.Д./»: {L["A"]}')
            ok(sgc['x']+sgc['w']/2<L['A']['x'] and sgc['x']+sgc['w']/2>200, f'{W}: подпись письма — на линии перед /Суховерхова/')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            # всё одним PDF
            async with pg.expect_download() as dl: await pg.click('[data-adall="b1"]')
            d=await dl.value; fp=await d.path(); n=npages(fp); ok(n==2 and 'с печатью' in d.suggested_filename, f'{W}: «Всё одним PDF»: {d.suggested_filename}, страниц {n}')
            # Word как есть
            async with pg.expect_download() as dl: await pg.click('[data-adget="fAktKomb0003"]')
            d=await dl.value; ok(d.suggested_filename=='Акт Комбинат2026.docx', f'{W}: исходный Word скачивается')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            await pg.screenshot(path=f'{SP}/aktdir{W}.png', full_page=False)
            await ctx.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
