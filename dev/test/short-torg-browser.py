"""Run against dev/test/server.js: short TORG-12 keeps both rows and footer."""
import asyncio, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE_PATH'))
        for width in [1300,390]:
            page=await b.new_page(viewport={'width':width,'height':900})
            await page.goto('http://localhost:8787/page')
            await page.click('[data-who="Даниил"]');await page.fill('#fd-pass','1111');await page.click('#fd-enter')
            await page.wait_for_selector('#fd-main:not([hidden])')
            await page.evaluate('''()=>{const D=__fd.D();const c=D.customers[0];c.name='Тестовый университет — подразделение общественного питания '.repeat(4);D.draft={supplierId:D.suppliers[0].id,customerId:c.id,number:'22',date:'2026-10-29',lines:D.products.slice(0,2).map(p=>({productId:p.id,qty:40,price:155.67}))};__fd.showPreview('torg12',__fd.calc(D.draft));}''')
            assert await page.locator('#pv-pages .sheet').count()==1
            assert await page.locator('#pv-pages .m-row').count()==2
            assert 'Груз получил' in await page.locator('#pv-pages .m-foot').inner_text()
            print(width,'PASS short TORG-12: one sheet, both rows, footer')
            await page.close()
        await b.close()
asyncio.run(main())
