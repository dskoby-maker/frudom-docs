"""Склад: штуки при приходе (фасовка). Макароны 40 шт × 0,45 кг по 62,50 ₽/шт → 18 кг по 138,8889 ₽/кг, штуки видны рядом с кг."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, t=8000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for k,vw in enumerate([(1300,900),(390,844)]):
            ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1000)
            name=f'Макароны Макфа Лапша 450г {vw[0]}'
            await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(300); await pg.click('#sk-dlg [data-mi="one"]'); await pg.wait_for_timeout(300)
            await pg.fill('#sk-dlg .skf-name',name)
            ok(await pg.locator('#sk-dlg .skpackb').count()==1, f'{vw[0]}: в приходе есть блок «Штуки»')
            await pg.fill('#sk-dlg .skf-pcs','40'); await pg.fill('#sk-dlg .skf-pack','0,45'); await pg.fill('#sk-dlg .skf-ppc','62,5'); await pg.wait_for_timeout(200)
            q=await pg.input_value('#sk-dlg .skf-qty'); pr=await pg.input_value('#sk-dlg .skf-price'); sm=await pg.text_content('#sk-insum')
            ok(q=='18', f'{vw[0]}: кг посчитались сами: {q}'); ok(pr=='138,8889', f'{vw[0]}: цена за кг посчиталась: {pr}')
            ok('2 500,00' in sm.replace(' ',' ') and '40 шт' in sm, f'{vw[0]}: итог 2 500,00 ₽ и 40 шт: {sm}')
            sw=await pg.evaluate("document.querySelector('#sk-dlg').scrollWidth<=document.querySelector('#sk-dlg').clientWidth+1"); ok(sw, f'{vw[0]}: окно без прокрутки вбок')
            await pg.screenshot(path=f'/tmp/claude-0/pack-in-{vw[0]}.png')
            # единица шт — блок пропадает
            await pg.select_option('#sk-dlg .skf-unit','шт'); await pg.wait_for_timeout(200)
            ok(await pg.locator('#sk-dlg .skf-pcs').count()==0 and await pg.locator('#sk-dlg .skf-bx').count()==1, f'{vw[0]}: для «шт» — только коробки')
            await pg.select_option('#sk-dlg .skf-unit','кг'); await pg.wait_for_timeout(200)
            ok(await pg.input_value('#sk-dlg .skf-pcs')=='40', f'{vw[0]}: значения не потерялись')
            await pg.fill('#sk-dlg .skf-sup','ИП Малишава К.А.'); await pg.fill('#sk-dlg .skf-doc','№ 000008819 от 05.11.26')
            await pg.click('#sk-dlg [data-sk="inSave"]'); ok(await until(pg,"!!document.querySelector('#sk-dlg .skuv .skpcs')"), f'{vw[0]}: карточка товара показывает штуки')
            t=await pg.text_content('#sk-dlg .skuv'); ok('40 шт' in t and '18' in t, f'{vw[0]}: «18 кг · 40 шт»: {t.strip()[:80]}')
            B=[r for r in rows('Склад: партии') if r.get('Товар')==name]
            ok(B and str(B[0].get('Вес 1 шт (фасовка)'))=='0.45' and str(B[0].get('Закупочная цена за ед.'))=='138.8889', f'{vw[0]}: в таблице фасовка и цена {[(x.get("Вес 1 шт (фасовка)"),x.get("Закупочная цена за ед.")) for x in B]}')
            await pg.screenshot(path=f'/tmp/claude-0/pack-item-{vw[0]}.png')
            await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(400)
            ok('40 шт' in (await pg.text_content('#sk-list') or ''), f'{vw[0]}: в списке остатков видно 40 шт')
            # следующий приход: вес 1 шт подставляется сам, штуки суммируются
            await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(300); await pg.click('#sk-dlg [data-mi="one"]'); await pg.wait_for_timeout(300); await pg.fill('#sk-dlg .skf-name',name); await pg.wait_for_timeout(200)
            pick=pg.locator('#sk-dlg [data-skpick]:not([data-skpick=""])');
            if await pick.count(): await pick.first.click(); await pg.wait_for_timeout(200)
            ok(await pg.input_value('#sk-dlg .skf-pack')=='0,45', f'{vw[0]}: вес 1 шт подставился из прошлой партии')
            await pg.fill('#sk-dlg .skf-pcs','20'); await pg.fill('#sk-dlg .skf-price','140'); await pg.wait_for_timeout(150)
            ok(await pg.input_value('#sk-dlg .skf-qty')=='9' and await pg.input_value('#sk-dlg .skf-ppc')=='63', f'{vw[0]}: 20 шт = 9 кг, 140 ₽/кг = 63 ₽/шт')
            await pg.click('#sk-dlg [data-sk="inSave"]'); await until(pg,"!!document.querySelector('#sk-dlg .skuv .skpcs')")
            ok('60 шт' in await pg.text_content('#sk-dlg .skuv'), f'{vw[0]}: две партии — 60 шт')
            # правка фасовки в партии
            await pg.locator('#sk-dlg [data-skbatch]').first.click(); await pg.wait_for_timeout(300)
            await pg.click('#sk-dlg [data-sk="mode"][data-m="edit"]'); await pg.fill('#sk-dlg .skbpk','0,9'); await pg.click('#sk-dlg [data-sk="batchSave"]'); await pg.wait_for_timeout(1200)
            ok('10 шт' in await pg.text_content('#sk-dlg .skuv'), f'{vw[0]}: фасовка партии изменена (9 кг = 10 шт по 0,9)')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
