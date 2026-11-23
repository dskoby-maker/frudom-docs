"""Госзаказчик определяется по признакам бюджетника (казначейский счёт, ЕИС/ПП, ГБУ/ФГБУ/ГУП…, «государственное…»),
а не «всё, что не ООО/АО/ИП»: у нового частника «Кондитерская Мневники» нет предупреждения «не по контракту»."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH")); pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        async def warn(name, extra="{}"):
            await pg.evaluate(f"""(()=>{{const D=__fd.D(), id='g'+Math.random().toString(36).slice(2); D.customers.push(Object.assign({{id, name:{name!r}}}, {extra}));
              const p=D.products.find(x=>+x.price>0); Object.assign(D.draft,{{customerId:id, lines:[{{productId:p.id, qty:'1', price:String(+p.price+7)}}]}}); }})()""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(500)
            return await pg.evaluate("document.body.innerText.includes('не по контракту')")
        ok(not await warn("Кондитерская Мневники"), 'частник «Кондитерская Мневники» — без «не по контракту»')
        ok(not await warn("Пекарня Лаврушка"), 'частник «Пекарня Лаврушка» — без предупреждения')
        ok(await warn("ГБПОУ КИГМ № 23"), 'ГБПОУ — госзаказчик, предупреждение есть')
        ok(await warn("ГАУ «Московский зоопарк»"), 'ГАУ — госзаказчик')
        ok(await warn("Столовая Ромашка", "{acct:'treasury'}"), 'казначейский счёт — госзаказчик')
        ok(await warn("Склад Ромашка", "{gov:'pp'}"), 'документы на Портале поставщиков — госзаказчик')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок: 0' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
