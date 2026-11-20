"""«Прибыль» → «Кто сколько должен»: нажатие на «дата · № накладной» открывает обычное окно накладной (docCard). ПК и телефон (PH=1)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); TG='тел' if PH else 'ПК'
async def main():
    P='dd'+('m' if PH else 'p')
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; window.__s1=D.suppliers[0].id; D.products.push({id:'dd-a', name:'Груши', unit:'кг', price:'150'});})()""")
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}0', supplierId:window.__s1, customerId:window.__cid, number:'', date:'2026-11-16', lines:[{{productId:'dd-a',qty:'2',price:'150'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
        await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2500)
        h=pg.locator(f'#pf-debt [data-dopen="{await pg.evaluate("window.__cid")}"]'); await h.scroll_into_view_if_needed(); await h.click(); await pg.wait_for_timeout(500)
        btn=pg.locator(f'#pf-debt [data-pdoc="{P}0"]'); ok(await btn.count()==1, f'{TG}: у накладной кнопка «дата · №»')
        txt=(await btn.text_content()) or ''; ok('16.11.2026' in txt and '№' in txt, f'{TG}: текст кнопки «{txt.strip()[:40]}»')
        await btn.click(); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("!!(document.getElementById('fd-dcard')||{}).open"), f'{TG}: открылось окно накладной')
        t=await pg.evaluate("(document.getElementById('fd-dcard')||{}).textContent||''"); ok('Груши' in t, f'{TG}: в окне товар накладной')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        ok(await pg.locator(f'#pf-debt [data-pay="{P}0"]').count()==1, f'{TG}: «Оплачено» на месте, накладная не отмечена')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=VW[0], f'{TG}: без прокрутки вбок')
        await pg.screenshot(path=f'/tmp/debt-{TG}.png')
        ok(not errs, f'{TG}: без ошибок {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
