"""Автозадача «Отвезти товар…» показывает, из каких накладных сделана: кнопка «Накладная № N ›» → окно документа,
у комплекта «Накладные № a–b · N шт.» → окно комплекта (оттуда — в каждую накладную и назад)."""
import asyncio
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            # сохраняем документ через форму
            day=await pg.evaluate("""(()=>{const D=__fd.D(); const dr=D.draft; const c=D.customers.find(c=>!c.priv)||D.customers[0]; const p=D.products.find(p=>+p.price>0)||D.products[0];
               const d=new Date(); d.setDate(d.getDate()+3+(innerWidth<500?1:0)); const iso=d.toISOString().slice(0,10);
               dr.customerId=c.id; dr.date=iso; dr.lines=[{productId:p.id, qty:'5', price:String(p.price||100)}]; return iso})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(600)
            await pg.evaluate("(()=>{const D=__fd.D(),p=D.products.find(p=>+p.price>0)||D.products[0]; D.draft.lines=[{productId:p.id, qty:'5', price:String(p.price||100)}];})()")
            await pg.click('#d-save'); await pg.wait_for_timeout(1500)
            num=await pg.evaluate("__fd.D().journal[0].number")
            await pg.evaluate(f"(()=>{{const c=__fd.D().cal=Object.assign(__fd.D().cal||{{}},{{sel:'{day}',ym:'{day[:7]}'}});}})()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"calendar\"]').click()"); await pg.wait_for_timeout(800)
            await pg.locator(f'#cal-grid button[data-d="{day}"]').click(); await pg.wait_for_timeout(400)
            bt=pg.locator('#dt-list .dtsrc').first
            ok(await bt.count()==1 and f'№ {num}' in await bt.inner_text(), f'{W}: у автозадачи кнопка «{(await bt.inner_text()) if await bt.count() else ""}»')
            await bt.click(); await pg.wait_for_timeout(700)
            t=await pg.inner_text('#fd-dcard') if await pg.locator('#fd-dcard[open]').count() else ''
            ok(f'№ {num}' in t or num in t, f'{W}: открылось окно накладной № {num}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            if W==1300: await pg.locator('#dt-list .dt').first.screenshot(path='/tmp/dtsrc.png')
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
