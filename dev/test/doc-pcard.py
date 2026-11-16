"""Окно накладной и комплекта: нажатие на название товара открывает карточку товара, «‹ Назад» / Esc возвращают к документу. ПК и телефон, Гриша."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw, who, pw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx,pg,errs
async def run(b, vw, tag):
    P='pc'+str(vw[0]); ctx,pg,errs=await login(b,vw,'Даниил','1111')
    await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id;
      D.products.push({id:'pcA', name:'Груши конференс', unit:'кг', price:'150'}, {id:'pcB', name:'Лимоны', unit:'кг', price:'200'});})()""")
    for i in range(2):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}d{i}', customerId:window.__cid, number:'', date:'2026-11-12', lines:[{{productId:'pcA',qty:'2',price:'150'}},{{productId:'pcB',qty:'1',price:'200'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
    await pg.evaluate(f"()=>{{const D=__fd.D(); D.journal.filter(j=>j.id.startsWith('{P}')).forEach(j=>{{ j.snap.meta.batch='{P}'; }});}}")
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(700)
    # окно накладной
    await pg.evaluate(f"(()=>{{const j=__fd.D().journal.find(x=>x.id==='{P}d0'); __fd.docCard? __fd.docCard(j,false) : document.querySelector('[data-card=\"{P}d0\"]').click(); }})()"); await pg.wait_for_timeout(900)
    n=await pg.locator('#fd-dcard .dc-pn').count(); ok(n==2, f'{tag}: названия товаров нажимаются ({n})')
    await pg.locator('#fd-dcard .dc-pn', has_text='Груши').click(); await pg.wait_for_timeout(1100)
    h=await pg.text_content('#fd-dcard h3'); ok('Груши' in (h or ''), f'{tag}: открылась карточка товара «{h}»')
    bk=await pg.locator('#fd-dcard .dc-back').first.text_content() if await pg.locator('#fd-dcard .dc-back').count() else ''
    ok('Документ' in bk or '№' in bk, f'{tag}: есть «‹ Назад» к документу ({bk.strip()})')
    await pg.locator('#fd-dcard .dc-back').first.click(); await pg.wait_for_timeout(1000)
    ok(await pg.locator('#fd-dcard .dc-pn').count()==2, f'{tag}: «Назад» вернул к накладной')
    await pg.locator('#fd-dcard .dc-pn', has_text='Лимоны').click(); await pg.wait_for_timeout(1000)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(1000)
    ok(await pg.locator('#fd-dcard .dc-pn').count()==2 and await pg.locator('#fd-dcard[open]').count()==1, f'{tag}: Esc тоже возвращает к накладной')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    # комплект
    g=pg.locator('#jr-body tr.grp [data-gcard]').first
    if await g.count():
        await g.click(); await pg.wait_for_timeout(1000)
        ok(await pg.locator('#fd-dcard .dc-pn').count()==4, f'{tag}: в комплекте названия тоже нажимаются')
        await pg.locator('#fd-dcard .dc-pn').nth(3).click(); await pg.wait_for_timeout(1000)
        ok('Лимоны' in (await pg.text_content('#fd-dcard h3') or ''), f'{tag}: из комплекта — карточка товара')
        await pg.locator('#fd-dcard .dc-back').first.click(); await pg.wait_for_timeout(1000)
        ok(await pg.locator('#fd-dcard .dc-pn').count()==4, f'{tag}: назад — к комплекту')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    else: ok(False, f'{tag}: комплект не найден')
    sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'{tag}: без прокрутки вбок')
    ok(not errs, f'{tag}: без ошибок {errs[:2]}'); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        await run(b,(1300,900),'ПК'); await run(b,(390,844),'телефон')
        ctx,pg,errs=await login(b,(390,844),'Гриша','3333')
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(700)
        c=pg.locator('#jr-body [data-card]').first
        if await c.count():
            await c.click(); await pg.wait_for_timeout(900); n=await pg.locator('#fd-dcard .dc-pn').count()
            if n: await pg.locator('#fd-dcard .dc-pn').first.click(); await pg.wait_for_timeout(900)
            ok(not errs, f'Гриша: открывается без ошибок {errs[:2]}')
        await ctx.close(); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
