"""Журнал: у заказчика с 2+ договорами под названием мелко — короткое имя договора документа; у заказчика с одним договором — ничего."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(f"""(()=>{{const D=__fd.D(), cs=D.customers.filter(x=>!x.priv), a=cs[0], c={{id:'cz'+Date.now(), name:'ООО Один договор', inn:'', addresses:[], branches:[]}}; D.customers.push(c), s=D.suppliers[0].id;
              D.contracts.push({{id:'kA{W}',customerId:a.id,supplierId:s,basis:'Договор № 1-КР от 01.01.2026',short:'Краги'}},{{id:'kB{W}',customerId:a.id,supplierId:s,basis:'Договор № 2-МЛ от 01.01.2026',short:''}},{{id:'kC{W}',customerId:c.id,supplierId:s,basis:'Договор № 9 от 01.01.2026',short:'Один'}});
              const mk=(id,cid,k,b)=>({{id, number:id, date:'2026-11-0'+(id.length%9+1), customerId:cid, supplierId:s, sum:100, arch:'', snap:{{dr:{{customerId:cid, supplierId:s, contractId:k, basis:b, lines:[]}}, c:{{name:'x'}}, meta:{{}}}}}});
              D.journal.push(mk('ja{W}',a.id,'kA{W}','Договор № 1-КР от 01.01.2026'), mk('jb{W}',a.id,'','Договор № 2-МЛ от 01.01.2026'), mk('jn{W}',a.id,'',''), mk('jc{W}',c.id,'kC{W}','Договор № 9 от 01.01.2026')); }})()""")
            await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
            async def tag(jid): return await pg.evaluate(f"(()=>{{const td=document.querySelector('#jr-body [data-card=\"{jid}\"]'); const t=td&&td.querySelector('.jctr'); return td? (t?t.textContent:'') : null}})()")
            ok(await tag(f'ja{W}')=='Краги', f'{W}: договор по ID — короткое «Краги»')
            ok(await tag(f'jb{W}')=='Договор № 2-МЛ от 01.01.2026', f'{W}: без ID — договор найден по основанию')
            ok(await tag(f'jn{W}')=='без договора', f'{W}: без договора — «без договора»')
            ok(await tag(f'jc{W}')=='', f'{W}: у заказчика с одним договором — ничего')
            fs=await pg.evaluate(f"getComputedStyle(document.querySelector('#jr-body [data-card=\"ja{W}\"] .jctr')).fontSize")
            ok(fs=='12px', f'{W}: мелкий шрифт ({fs})')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            await pg.locator(f'#jr-body [data-card="ja{W}"]').screenshot(path=f'/tmp/jctr{W}.png')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
