"""«Товары»: цена за кг/л по весу из названия («Сметана 300г» 71,1 ₽/шт → ≈ 237 ₽/кг), вверх до копеек; у кг — не пишется."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw):
    ctx=await b.new_context(viewport={'width':vw,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
    await pg.evaluate("""()=>{ const D=__fd.D(); [['tkg1','Сметана 20% 300гх6','шт',71.1],['tkg2','Молоко 0,9л','шт',80],['tkg3','Масло сливочное 180 г','уп',199.99],['tkg4','Картофель мешок 3кг','кг',50],['tkg5','Яблоки Гала','шт',10]]
       .forEach(([id,name,unit,price])=>{ if(!D.products.some(p=>p.id===id)) D.products.push({id,name,unit,price}); }); }""")
    await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(400)
    async def cell(q):
        await pg.fill('#pd-q', q) if await pg.locator('#pd-q').count() else None; await pg.wait_for_timeout(300)
        return await pg.evaluate("q=>{const r=[...document.querySelectorAll('#pd-body .nmr')].find(r=>r.textContent.includes(q)); return r?r.querySelector('.nmp').textContent:null}", q)
    for q,exp in [('Сметана 20%','≈ 237 ₽/кг'),('Молоко 0,9л','≈ 88,89 ₽/л'),('Масло сливочное','≈ 1 111,06 ₽/кг')]:
        t=await cell(q); ok(t and exp in t.replace('\xa0',' ').replace(' ',' '), f'{vw}: {q} → {exp} ({t})')
    for q in ['Картофель мешок','Яблоки Гала']:
        t=await cell(q); ok(t is not None and '≈' not in t, f'{vw}: {q} — без лишней строки ({t})')
    if vw<500: ok(await pg.evaluate("document.documentElement.scrollWidth")<=vw, f'{vw}: без прокрутки вбок')
    ok(not errs, f'{vw}: ошибок нет {errs[:2]}'); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or "/usr/bin/google-chrome")
        await run(b,1300); await run(b,375); await b.close()
    print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
