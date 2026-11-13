"""Закупка — отдельной страницей в окне: из окна накладной «Закупка» открывает широкое окно закупки, «‹ Документ № …» и Esc возвращают к накладной,
значок закупки в журнале открывает закупку сразу (назад — к накладной), комплект — так же; телефон без прокрутки вбок."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1400,950),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            for i,jid in enumerate([f'zn{W}a',f'zn{W}b',f'zn{W}c']):
                await pg.evaluate(f"""(()=>{{const D=__fd.D(), c=D.customers[0], p=D.products.slice(0,2); Object.assign(D.draft,{{id:'{jid}', customerId:c.id, number:'', date:'2026-11-1{i}', ship:'', lines:p.map(x=>({{productId:x.id, qty:'2', price:'100', qOk:'2', pOk:'100'}})) }}); if({i}>0) D.draft.batch='zb{W}'; }})()""")
                await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(900)
            await pg.evaluate(f"__fd.D().journal.filter(j=>['zn{W}b','zn{W}c'].includes(j.id)).forEach(j=>{{ j.snap.meta=Object.assign(j.snap.meta||{{}},{{batch:'zb{W}'}}); }})")
            await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
            await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"zn{W}a\"]').click()"); await pg.wait_for_timeout(700)
            w0=await pg.evaluate("document.getElementById('fd-dcard').getBoundingClientRect().width")
            await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1300)
            ok(await pg.locator('#fd-dcard.zkpage').count()==1, f'{W}: «Закупка» открыла страницу закупки')
            w1=await pg.evaluate("document.getElementById('fd-dcard').getBoundingClientRect().width")
            ok(w1>w0+100 if W>1000 else w1>=w0, f'{W}: окно закупки шире ({w0:.0f} → {w1:.0f})')
            ok(await pg.locator('#fd-dcard #dc-zki .dzr').count()>=2, f'{W}: товары накладной в закупке')
            bk=await pg.text_content('#fd-dcard .dc-head [data-navback]') or ''
            ok('Документ' in bk, f'{W}: сверху «‹ {bk.strip()}»')
            await pg.fill('#dc-zki .dzc >> nth=0','55'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(1200)
            ok(await pg.evaluate(f"(()=>{{const j=__fd.D().journal.find(x=>x.id==='zn{W}a'); return __fd.docProfit(j).cost>0}})()"), f'{W}: закупка сохраняется на странице')
            await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
            ok(await pg.locator('#fd-dcard.zkpage').count()==0 and 'Документ' in (await pg.text_content('#fd-dcard .dc-kicker')), f'{W}: «Назад» — к окну накладной')
            ok('Закупка' in (await pg.text_content('#fd-dcard [data-zkc="toggle"]')), f'{W}: на кнопке видна заполненная закупка')
            await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1000)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
            ok(await pg.locator('#fd-dcard.zkpage').count()==0 and await pg.locator('#fd-dcard').count()==1, f'{W}: Esc — тоже назад к накладной')
            await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(500)
            # значок закупки в журнале → сразу страница закупки, назад — к накладной
            await pg.evaluate(f"(()=>{{const z=document.querySelector('#jr-body [data-zkj=\"zn{W}a\"]'); z&&z.click();}})()"); await pg.wait_for_timeout(1300)
            ok(await pg.locator('#fd-dcard.zkpage #dc-zk').count()==1, f'{W}: значок в журнале открывает закупку сразу')
            await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
            ok('Документ' in (await pg.text_content('#fd-dcard .dc-kicker')) and await pg.locator('#fd-dcard.zkpage').count()==0, f'{W}: из неё «Назад» — к накладной')
            await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(500)
            # комплект
            await pg.evaluate("(()=>{ const t=document.querySelector('#jr-body tr.grp [data-gcard]'); t&&t.click(); })()"); await pg.wait_for_timeout(800)
            if await pg.locator('#fd-dcard [data-bzk="toggle"]').count():
                await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(1300)
                ok(await pg.locator('#fd-dcard.zkpage #bz-zk').count()==1 and await pg.locator('#bz-zki .bzr, #bz-zki .dzr').count()>=1, f'{W}: закупка комплекта — страницей')
                ok('Комплект' in (await pg.text_content('#fd-dcard .dc-head [data-navback]') or ''), f'{W}: назад — «‹ Комплект»')
                await pg.locator('#bz-zk').screenshot(path=f'/tmp/zknav-b{W}.png') if W<1000 else None
                await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
                ok('Комплект' in (await pg.text_content('#fd-dcard .dc-kicker')), f'{W}: вернулись в окно комплекта')
                await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(500)
            else: ok(False, f'{W}: комплект в журнале не нашёлся')
            await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"zn{W}a\"]').click()"); await pg.wait_for_timeout(600)
            await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1300)
            sw=await pg.evaluate("[document.documentElement.scrollWidth, document.getElementById('fd-dcard').scrollWidth-document.getElementById('fd-dcard').clientWidth]")
            ok(sw[0]<=W and sw[1]<=2, f'{W}: нет прокрутки вбок {sw}')
            await pg.screenshot(path=f'/tmp/zknav{W}.png')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
