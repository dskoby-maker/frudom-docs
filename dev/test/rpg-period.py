"""Общий выбор периода календарём (rpgBar): карточка товара (в окне), Журнал, Прибыль → Обзор, События, Закупка, Счета.
Открыть, выбрать вариант, выбрать свои даты двумя нажатиями, стрелки ‹ ›, Esc закрывает только календарь. ПК и телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def pick(pg, k, a, b):
    await pg.click(f'[data-rpg="{k}"]'); await pg.wait_for_timeout(300)
    for d in (a,b):
        cell=pg.locator(f'.rgp [data-rgd="{d}"]')
        for _ in range(6):
            if await cell.count(): break
            await pg.click('.rgp [data-rgm="-1"]'); await pg.wait_for_timeout(250)
        await cell.click(); await pg.wait_for_timeout(150)
    await pg.wait_for_timeout(400)
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    t=await pg.evaluate("(()=>{const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})()")
    a,bb=t+'-03', t+'-12'
    # Журнал
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(700)
    ok(await pg.locator('#jr-per').is_hidden() and await pg.locator('[data-rpg="jr"]').count()==1, f'{tag}: Журнал — календарь вместо списка')
    await pick(pg,'jr',a,bb); R=await pg.evaluate("__rpg.R('jr')"); jf=await pg.evaluate("JSON.stringify(__fd.D().jf)")
    ok(R['a']==a and R['b']==bb and '"per":"custom"' in jf, f'{tag}: Журнал — свои даты {R["lab"]}')
    await pg.click('[data-rpg="jr"]'); await pg.wait_for_timeout(250); await pg.locator('.rgp .pvrpc', has_text='Всё время').click(); await pg.wait_for_timeout(400)
    ok(await pg.evaluate("__rpg.R('jr').all"), f'{tag}: Журнал — «Всё время»')
    # Прибыль
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1200)
    if await pg.locator('[data-rpg="pf"]').count():
        await pg.click('[data-rpg="pf"]'); await pg.wait_for_timeout(250); await pg.locator('.rgp .pvrpc', has_text='Прошлый месяц').click(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__rpg.R('pf').lab")=='Прошлый месяц', f'{tag}: Прибыль — «Прошлый месяц»')
        await pg.click('[data-rpgs="pf|-1"]'); await pg.wait_for_timeout(400); R=await pg.evaluate("__rpg.R('pf')"); ok(not R['all'], f'{tag}: Прибыль — стрелка ‹ ({R["lab"]})')
    # События
    await pg.evaluate(TAB+"('events')"); await pg.wait_for_timeout(1200)
    ok(await pg.evaluate("__rpg.R('ev').lab")=='7 дней', f'{tag}: События — по умолчанию 7 дней')
    await pick(pg,'ev',a,bb); ok(await pg.evaluate("__rpg.R('ev').a")==a, f'{tag}: События — свои даты')
    # Закупка
    await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1000)
    await pick(pg,'zkp',a,bb); ok(await pg.evaluate("__rpg.R('zkp').b")==bb, f'{tag}: Закупка — свои даты')
    # Карточка товара (в окне) — Esc закрывает только календарь
    await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(800)
    pid=await pg.evaluate("__fd.D().products[0].id"); await pg.fill('#pd-q', await pg.evaluate("__fd.D().products[0].name")); await pg.wait_for_timeout(300)
    await pg.click(f'#pd-body .nmr[data-id="{pid}"] .nmh'); await pg.wait_for_timeout(200); await pg.click(f'#pd-body [data-pcard="{pid}"]'); await pg.wait_for_timeout(900)
    await pg.click('#fd-dcard [data-rpg="pcd"]'); await pg.wait_for_timeout(300)
    box=await pg.evaluate("(()=>{const r=document.querySelector('.rgp').getBoundingClientRect(); return [r.left>=0, r.right<=innerWidth+1, r.top>=0, r.bottom<=innerHeight+1]})()")
    ok(all(box), f'{tag}: окно календаря целиком на экране {box}')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    ok(await pg.locator('.rgp').count()==0 and await pg.locator('#fd-dcard[open]').count()==1, f'{tag}: Esc закрыл календарь, карточка осталась')
    await pick(pg,'pcd',a,bb); ok(await pg.evaluate("__rpg.R('pcd').a")==a and a[8:].lstrip('0') in await pg.text_content('#fd-dcard [data-rpg="pcd"] b'), f'{tag}: карточка товара — свои даты')
    await pg.click('#fd-dcard [data-rpg="pcd"]'); await pg.wait_for_timeout(300); await pg.mouse.click(5,5); await pg.wait_for_timeout(300)
    ok(await pg.locator('.rgp').count()==0, f'{tag}: нажатие мимо закрывает')
    sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'{tag}: без прокрутки вбок')
    ok(not errs, f'{tag}: без ошибок {errs[:2]}'); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        await run(b,(1300,900),'ПК'); await run(b,(390,844),'телефон'); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
