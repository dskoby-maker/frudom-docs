"""«Цены поставщиков» на телефоне (15.11.2026): строки проверки прайса не ломаются (галочка 20 px, название во всю ширину),
значок лупы не наезжает на текст поиска, при загрузке видна анимация с шагами, после сохранения нет «Отменить: добавление товара».
Сервер: AI_FAKE=/tmp/claude-0/vp-ai.json PORT=8787 node test/server.js (на чистом сервере)"""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
B='http://localhost:8787'
def srv(js): return urllib.request.urlopen(urllib.request.Request(B+'/eval', data=js.encode(), method='POST')).read().decode()
F='/tmp/claude-0/vpm.txt'; open(F,'w').write('прайс\n')
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); 1")
    json.dump({"supplier":"ООО РосПродукт","date":"09.11.2026","items":[[f"Оливки Оливиссимо вариант номер {i} очень длинное название ж/б","шт",90+i] for i in range(485)]}, open('/tmp/claude-0/vp-ai.json','w'), ensure_ascii=False)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':360,'height':760}, has_touch=True, is_mobile=True); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("location.hash='#postavshchiki'"); await pg.wait_for_selector('#vp-card:not([hidden]) .vph', timeout=8000); await pg.wait_for_timeout(500)
        await pg.evaluate("""window.__pr=0; new MutationObserver(()=>{ if(document.querySelector('#vp-card .vpprog .vpst li')) window.__pr++; }).observe(document.body,{subtree:true,childList:true,attributes:true})""")
        await pg.set_input_files('#vp-file', F); await pg.wait_for_selector('#vp-card .vpuph', timeout=20000)
        ok(await pg.evaluate("window.__pr")>0, 'при загрузке видна анимация с шагами')
        r=await pg.evaluate("""(()=>{ const l=document.querySelector('#vp-card .vpu'), c=l.querySelector('input'), n=l.querySelector('.vprn'); return {cw:c.getBoundingClientRect().width, nw:n.getBoundingClientRect().width, lw:l.getBoundingClientRect().width}; })()""")
        ok(r['cw']<=22 and r['nw']>r['lw']*0.45, f'строка проверки: галочка маленькая, название широкое {r}')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=360, 'без прокрутки вбок (проверка)')
        await pg.click('#vp-card [data-vp="save"]'); await pg.wait_for_selector('#vp-card .vpl', timeout=20000); await pg.wait_for_timeout(1200)
        u=await pg.evaluate("(document.querySelector('#fd-undo')||{}).innerText||''")
        ok('добавление товара' not in u, f'после сохранения нет «Отменить: добавление товара»: {u!r}')
        n=await pg.evaluate("__fd.D().products.filter(p=>/Оливиссимо вариант/.test(p.name)).length"); ok(n==485, f"создано 485 товаров: {n}")
        s=await pg.evaluate("""(()=>{ const i=document.querySelector('#vp-q'), sv=i.parentElement.querySelector('svg'); return {pl:parseFloat(getComputedStyle(i).paddingLeft), ir:sv.getBoundingClientRect().right-i.getBoundingClientRect().left}; })()""")
        ok(s['pl']>=s['ir']+4, f'лупа не наезжает на текст поиска {s}')
        s=await pg.evaluate("""(()=>{ const i=document.querySelector('#vp-card [data-vpiq]'), sv=i.parentElement.querySelector('svg'); return {pl:parseFloat(getComputedStyle(i).paddingLeft), ir:sv.getBoundingClientRect().right-i.getBoundingClientRect().left}; })()""")
        ok(s['pl']>=s['ir']+4, f'лупа не наезжает в «Поиск в этом прайсе» {s}')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=360, 'без прокрутки вбок (список)')
        await pg.screenshot(path='/tmp/claude-0/vpm.png')
        ok(not errs, f'без ошибок {errs}')
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
