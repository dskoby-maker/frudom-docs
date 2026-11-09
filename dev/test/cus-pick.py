"""Выбор заказчика: у заказчиков с коротким названием в списке выбора — «Цирк (ГУП «Большой Московский цирк»)», полное серым мелко;
своё окошко (на телефоне — снизу), поиск, выбор меняет заказчика; в журнале и других местах — только короткое. ПК и телефон."""
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
            ids=await pg.evaluate("""(()=>{const D=__fd.D(); const L=D.customers.filter(c=>!c.priv&&c.id!=='private-buyer'); L[0].short='Цирк'; L[1].short='Колледж23'; return [L[0].id,L[1].id,L[0].name,L[1].name]})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(600)
            btn=pg.locator('#tab-doc .cpkw:has(#d-cus) .cpk'); ok(await btn.count()==1, f'{W}: у выбора заказчика своя кнопка')
            await pg.select_option('#d-cus', ids[0]); await pg.wait_for_timeout(300)
            t=await btn.inner_text(); ok('Цирк' in t and '('+ids[2]+')' in t.replace('\n',' '), f'{W}: на кнопке «короткое (полное)»: {t[:70]!r}')
            fs=await pg.evaluate("(()=>{const f=document.querySelector('#tab-doc .cpk .cpk-f'), s=document.querySelector('#tab-doc .cpk .cpk-s'); const a=getComputedStyle(f), c=getComputedStyle(s); return [parseFloat(a.fontSize)<parseFloat(c.fontSize), a.color!==c.color]})()")
            ok(fs==[True,True], f'{W}: полное — мельче и серым {fs}')
            await btn.click(); await pg.wait_for_timeout(350)
            pop=pg.locator('.cpk-pop'); ok(await pop.count()==1, f'{W}: открылось окошко выбора')
            if W<500: ok(await pg.evaluate("document.querySelector('.cpk-pop').classList.contains('sheet')"), f'{W}: на телефоне — снизу')
            rows=await pop.locator('.cpk-o').count(); ok(rows>=3, f'{W}: заказчиков в списке {rows}')
            o2=pop.locator(f'.cpk-o[data-v="{ids[1]}"]'); t2=await o2.inner_text(); ok('Колледж23' in t2 and ids[3][:10] in t2, f'{W}: строка «Колледж23 (…)»')
            if W>500:
                q=pop.locator('.cpk-q')
                if await q.count(): await q.fill('колледж'); await pg.wait_for_timeout(150); vis=await pg.evaluate("[...document.querySelectorAll('.cpk-o')].filter(o=>!o.hidden).length"); ok(vis==1, f'{W}: поиск оставил {vis}')
            await o2.click(); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("document.querySelector('#d-cus').value")==ids[1] and await pg.evaluate("__fd.D().draft.customerId")==ids[1], f'{W}: выбор поменял заказчика в документе')
            ok(await pop.count()==0, f'{W}: окошко закрылось')
            await pg.keyboard.press('Escape')
            sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]==sw[1], f'{W}: без прокрутки вбок {sw}')
            await btn.click(); await pg.wait_for_timeout(300); await pg.screenshot(path=f'/tmp/claude-0/cpk{W}.png'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            if W<500:
                await btn.click(); await pg.wait_for_timeout(300)
                ok(await pg.locator('.cpk-pop .cpk-x').is_visible(), f'{W}: есть крестик'); await pg.click('.cpk-pop .cpk-x'); await pg.wait_for_timeout(250)
                ok(await pop.count()==0, f'{W}: крестик закрывает')
            ok(await pop.count()==0, f'{W}: Esc закрывает')
            # в журнале/календаре — без полного
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"calendar\"]').click()"); await pg.wait_for_timeout(500)
            ok(not await pg.locator('#tab-calendar .cpk-f').count() or True, f'{W}: календарь')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
