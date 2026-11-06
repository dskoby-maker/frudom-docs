"""Склад: коробки в приходе по накладной. 40 шт, в коробке 17 → 2,353 кор; штук в коробке запоминается;
коробки × штук в коробке = штуки → кг; цена за коробку → цена за шт → цена за кг; товар в «шт»; остатки показывают коробки."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SHOT=os.environ.get('SHOT','/tmp/claude-0/')
async def until(pg, js, t=8000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def typ(pg, sel, v):
    await pg.fill(sel, ''); await pg.type(sel, v, delay=10); await pg.wait_for_timeout(120)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(900)
            name=f'Лапша Макфа 450г {W}'; nm2=f'Сок яблочный 0,2 л {W}'
            await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(400)
            await pg.fill('#sk-dlg .mi-sup','Таня'); 
            r0='#sk-dlg .mi-row:nth-child(1)'
            await typ(pg, f'{r0} .mi-name', name)
            await pg.click(f'{r0} [data-mi="pcs"]'); await pg.wait_for_timeout(300)
            ok(await pg.locator(f'{r0} .mi-box-x').count()==1 and await pg.locator(f'{r0} .mi-pcs-n').count()==1, f'{W}: в блоке «Штуки» и «Коробки»')
            await typ(pg, f'{r0} .mi-pcs-n','40'); await typ(pg, f'{r0} .mi-pcs-w','0,45'); await typ(pg, f'{r0} .mi-pcs-p','62,5')
            ok(await pg.input_value(f'{r0} .mi-qty')=='18', f'{W}: кг = 18')
            await typ(pg, f'{r0} .mi-box-x','17')
            bn=await pg.input_value(f'{r0} .mi-box-n'); ok(bn=='2,353', f'{W}: коробок посчиталось само: {bn}')
            ok(await pg.input_value(f'{r0} .mi-box-p')=='1062,5', f'{W}: цена за коробку = 62,5 × 17')
            t=await pg.text_content(f'{r0} .mi-pcs'); ok('40 шт' in t and '2,35 кор' in t, f'{W}: под количеством «40 шт · 2,35 кор»: {t}')
            # коробки → штуки → кг
            await typ(pg, f'{r0} .mi-box-n','3')
            ok(await pg.input_value(f'{r0} .mi-pcs-n')=='51' and await pg.input_value(f'{r0} .mi-qty')=='22,95', f'{W}: 3 кор × 17 = 51 шт = 22,95 кг')
            await typ(pg, f'{r0} .mi-box-p','1020')
            ok(await pg.input_value(f'{r0} .mi-pcs-p')=='60' and await pg.input_value(f'{r0} .mi-price')=='133,3333', f'{W}: цена за коробку → за шт 60 → за кг 133,3333')
            await typ(pg, f'{r0} .mi-pcs-n','40')
            ok(await pg.input_value(f'{r0} .mi-box-n')=='2,353', f'{W}: изменили штуки — коробки пересчитались')
            await pg.screenshot(path=SHOT+f'box-{W}.png')
            # строка 2: товар в штуках
            r1='#sk-dlg .mi-row:nth-child(2)'
            await typ(pg, f'{r1} .mi-name', nm2); await pg.select_option(f'{r1} .mi-unit','шт'); await pg.wait_for_timeout(200)
            await pg.click(f'{r1} [data-mi="pcs"]'); await pg.wait_for_timeout(300)
            ok(await pg.locator(f'{r1} .mi-pcs-n').count()==0 and await pg.locator(f'{r1} .mi-box-x').count()==1, f'{W}: для «шт» — только коробки')
            await typ(pg, f'{r1} .mi-box-x','27'); await typ(pg, f'{r1} .mi-box-n','2'); await typ(pg, f'{r1} .mi-box-p','810')
            ok(await pg.input_value(f'{r1} .mi-qty')=='54' and await pg.input_value(f'{r1} .mi-price')=='30', f'{W}: 2 кор × 27 = 54 шт по 30 ₽')
            await typ(pg, f'{r1} .mi-qty','60'); ok(await pg.input_value(f'{r1} .mi-box-n')=='2,222', f'{W}: шт изменили — коробки 2,222')
            # строка 3: штуки и коробки известны — «Штук в коробке» считается само
            r2='#sk-dlg .mi-row:nth-child(3)'
            await typ(pg, f'{r2} .mi-name', f'Рис Мистраль 900г {W}'); await pg.click(f'{r2} [data-mi="pcs"]'); await pg.wait_for_timeout(300)
            await typ(pg, f'{r2} .mi-box-x',''); await typ(pg, f'{r2} .mi-pcs-n','36'); await typ(pg, f'{r2} .mi-pcs-w','0,9'); await typ(pg, f'{r2} .mi-box-n','3')
            ok(await pg.input_value(f'{r2} .mi-box-x')=='12', f'{W}: 36 шт ÷ 3 кор = 12 в коробке')
            ok(await pg.input_value(f'{r2} .mi-qty')=='32,4', f'{W}: кг не сбились: 32,4')
            await typ(pg, f'{r2} .mi-box-n','4'); ok(await pg.input_value(f'{r2} .mi-box-x')=='9', f'{W}: коробок 4 — в коробке 9 (посчитанное пересчитывается)')
            ok(await pg.input_value(f'{r2} .mi-pcs-n')=='36', f'{W}: штуки остались 36')
            await typ(pg, f'{r2} .mi-pcs-n','48'); ok(await pg.input_value(f'{r2} .mi-box-x')=='12' and await pg.input_value(f'{r2} .mi-box-n')=='4', f'{W}: штуки 48 — в коробке 12, коробок 4')
            await typ(pg, f'{r2} .mi-box-x','10'); ok(await pg.input_value(f'{r2} .mi-box-n')=='4,8', f'{W}: вписали 10 в коробке руками — коробок 4,8')
            await typ(pg, f'{r2} .mi-pcs-n','50'); ok(await pg.input_value(f'{r2} .mi-box-x')=='10' and await pg.input_value(f'{r2} .mi-box-n')=='5', f'{W}: ручное «в коробке» не трогается, коробки 5')
            await typ(pg, f'{r2} .mi-box-x',''); await typ(pg, f'{r2} .mi-box-n',''); await typ(pg, f'{r2} .mi-pcs-p','135'); await typ(pg, f'{r2} .mi-box-p','1620')
            ok(await pg.input_value(f'{r2} .mi-box-x')=='12', f'{W}: цена за коробку 1620 ÷ 135 за шт = 12 в коробке')
            sw=await pg.evaluate("document.querySelector('#sk-dlg').scrollWidth<=document.querySelector('#sk-dlg').clientWidth+1"); ok(sw, f'{W}: окно без прокрутки вбок')
            await pg.screenshot(path=SHOT+f'box2-{W}.png')
            await pg.click('#sk-dlg [data-mi="save"]'); await until(pg, "!document.querySelector('#sk-dlg')", 9000); await pg.wait_for_timeout(1500)
            B={r.get('Товар'):r for r in rows('Склад: партии')}
            ok(str(B.get(name,{}).get('Штук в коробке'))=='17' and str(B.get(nm2,{}).get('Штук в коробке'))=='27', f'{W}: в таблице «Штук в коробке» 17 и 27')
            # остатки показывают коробки
            await pg.fill('#sk-q', name) if await pg.locator('#sk-q').count() else None; await pg.wait_for_timeout(500)
            txt=await pg.text_content('#fd-app [data-tab-panel="stock"], #tab-stock') if await pg.locator('#tab-stock').count() else await pg.text_content('body')
            ok('2,35 кор' in txt, f'{W}: на складе видно «2,35 кор»')
            # следующий приход — штук в коробке подставилось само
            await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(400)
            await typ(pg, f'{r0} .mi-name', name); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(200)
            await pg.click(f'{r0} [data-mi="pcs"]'); await pg.wait_for_timeout(300)
            ok(await pg.input_value(f'{r0} .mi-box-x')=='17', f'{W}: в новом приходе «Штук в коробке» = 17 само')
            await pg.click('#sk-dlg [data-mi="close"]'); await pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('frudom-stockin')).forEach(k=>localStorage.removeItem(k))")
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
