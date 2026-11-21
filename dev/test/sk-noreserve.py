"""Склад без резерва: «Со склада» в документе — списывается сразу при сохранении; если не вышло — «Ждут отгрузки» → «Списать всё сразу»."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
async def until(pg, js, t=12000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
        W=int(os.environ.get('W','1300')); pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          D.products.push({id:'p-ris', name:'Рис круглый', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]['p-ris']='100'; })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Рис Мистраль',unit:'кг',qty:'50',price:'80',date:'2026-11-13',exp:'',supplier:'',docRef:''}]},'тест')"); await pg.wait_for_timeout(900)
        iid=await pg.evaluate("__sk.state().items.find(i=>i.name==='Рис Мистраль').id")
        await pg.evaluate("id=>__sk.linkTo(id,['p-ris'],'','all')", iid); await pg.wait_for_timeout(900)
        async def mkdoc(did, q):
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{did}', customerId:window.__cid, number:'', lines:[{{productId:'p-ris',qty:'{q}',price:'100',stk:{{m:'s'}},stkSet:1}}]}}); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save')
        await mkdoc('nr1', 13.5)
        ok(await until(pg,"(document.getElementById('fd-toasts')||{textContent:''}).textContent.includes('списано со склада')"), 'после сохранения уведомление «списано со склада»')
        await pg.wait_for_timeout(800)
        sh=[m for m in rows('Склад: движения') if m['Код операции']=='ship' and m['ID документа']=='nr1']; ok(len(sh)==1 and abs(float(sh[0]['Количество'])+13.5)<1e-6, 'в таблице сразу списано 13,5 кг')
        ok(not [r for r in rows('Склад: резервы') if r['ID документа']=='nr1' and r['Количество']], 'резерва не осталось')
        # списание не прошло — запасной путь
        async def block(route):
            if '"op":"ship"' in (route.request.post_data or ''): await route.abort()
            else: await route.continue_()
        await pg.route('**/*', block)
        await mkdoc('nr2', 5)
        ok(await until(pg,"(document.getElementById('fd-toasts')||{textContent:''}).textContent.includes('не списалось сразу')"), 'нет связи — предупреждение «не списалось сразу»')
        await pg.unroute('**/*', block); await pg.wait_for_timeout(500)
        await pg.evaluate("__sk.state().moves&&0"); await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        q=await pg.evaluate("JSON.parse(localStorage.getItem('frudom-stockq:Даниил')||'[]').length")
        if q:   # операция стоит в очереди — отправится сама; для проверки кнопки уберём её
            await pg.evaluate("localStorage.setItem('frudom-stockq:Даниил','[]')")
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(800)
        ok(await until(pg,"!!document.querySelector('#sk-alerts [data-skdet=\"wait\"]')"), 'на складе «Ждут отгрузки»')
        await pg.click('#sk-alerts [data-skdet="wait"]'); await pg.wait_for_timeout(300)
        btn=pg.locator('#sk-det [data-sk="shipAll"]'); ok(await btn.count()==1, 'кнопка «Списать всё сразу»')
        await btn.click(); await pg.wait_for_timeout(200); ok('Да' in await btn.text_content(), 'в два нажатия'); await btn.click()
        ok(await until(pg,"!document.querySelector('#sk-alerts [data-skdet=\"wait\"]')"), 'после — ничего не ждёт отгрузки')
        sh=[m for m in rows('Склад: движения') if m['Код операции']=='ship' and m['ID документа']=='nr2']; ok(len(sh)==1, 'вторая накладная списана')
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
        ok(not errs, f'ошибок JS нет {errs}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
