"""Проверка моста приложения (bridge.js) на настоящем сайте в Chromium: скачивание PDF/JSON, печать документа.
Нужен тестовый сервер (node dev/test/server.js) и папка с html2canvas/jspdf (LIBS)."""
import asyncio, os, json, sys
from playwright.async_api import async_playwright
H=os.path.dirname(os.path.abspath(__file__)); LIBS=os.environ['LIBS']
FAKE="""window.__calls=[]; window.FrudomApp={saveFile:(b,n,m)=>__calls.push(['saveFile',n,m,b.length]), download:(u,n)=>__calls.push(['download',u,n]),
 printPage:t=>__calls.push(['printPage',t]), printHtml:(h,t)=>__calls.push(['printHtml',t,h.length,/class="pg/.test(h)]), toast:t=>__calls.push(['toast',t]), reload:()=>0, version:()=>'t'};"""
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/html2canvas.min.js', lambda r: r.fulfill(path=LIBS+'/html2canvas/dist/html2canvas.min.js'))
        await pg.route('**/jspdf.umd.min.js', lambda r: r.fulfill(path=LIBS+'/jspdf/dist/jspdf.umd.min.js'))
        await pg.add_init_script(FAKE)
        await pg.goto('http://localhost:8787/page'); bj=open(H+'/app/src/main/assets/bridge.js').read()
        await pg.evaluate(bj); await pg.evaluate(bj)   # как onPageFinished, дважды — не должно ломаться
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D();D.draft.lines=D.products.slice(0,2).map(p=>({productId:p.id,qty:'3',price:'100'}));__fd.showPreview('invoice',__fd.calc(D.draft));})()""")
        await pg.wait_for_timeout(500)
        await pg.click('#pv-print'); await pg.wait_for_timeout(1500)
        c=await pg.evaluate('__calls'); ok(any(x[0]=='printHtml' and x[3] for x in c), 'печать документа уходит в приложение: '+str([x[:3] for x in c if x[0].startswith('print')]))
        await pg.click('#pv-pdf'); await pg.wait_for_timeout(9000)
        c=await pg.evaluate('__calls'); s=[x for x in c if x[0]=='saveFile']
        ok(any(x[1].endswith('.pdf') and x[2]=='application/pdf' and x[3]>1000 for x in s), 'PDF уходит в приложение: '+str(s))
        await pg.evaluate("document.getElementById('pv-close').click()")
        ok(await pg.evaluate('__fdBack()')==False, '«Назад» без открытых окон — выход')
        await pg.evaluate("__fd.showPreview('invoice',__fd.calc(__fd.D().draft))"); await pg.wait_for_timeout(300)
        ok(await pg.evaluate('__fdBack()')==True and await pg.evaluate("document.getElementById('pv').hidden"), '«Назад» закрывает просмотр документа')
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"data\"]').click()"); await pg.wait_for_timeout(400)
        await pg.evaluate("document.getElementById('dt-export').click()"); await pg.wait_for_timeout(800)
        c=await pg.evaluate('__calls'); ok(any(x[0]=='saveFile' and x[1].endswith('.json') for x in c), 'выгрузка данных (.json) уходит в приложение')
        await pg.evaluate("window.print()"); c=await pg.evaluate('__calls'); ok(any(x[0]=='printPage' for x in c), 'обычная печать страницы')
        ok(not errs, 'нет ошибок JS '+str(errs[:3]))
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else 'провалов '+str(len(fails)))
asyncio.run(main())
