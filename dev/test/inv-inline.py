"""Форма «Отдельного счёта» — не окно, а блок на вкладке «Новый документ»: раскрывается плавно под «Отдельным счётом»,
закрывается обратно; из «Все счета» — окно закрывается, после «Отмена»/«Сохранить» возвращается; на телефоне итог с кнопками над нижней панелью."""
import asyncio
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            await pg.click('#inv-new2'); await pg.wait_for_timeout(150)
            mid=await pg.evaluate("(()=>{const w=document.querySelector('#inv-wrap'); return w?parseFloat(getComputedStyle(w.firstElementChild).height):-1})()")
            await pg.wait_for_timeout(700)
            st=await pg.evaluate("""(()=>{const w=document.querySelector('#inv-wrap'), f=document.querySelector('#inv-dlg');
              return [!!w && w.classList.contains('open'), f&&f.tagName, !!document.querySelector('dialog[open]'), document.querySelector('#inv-dc').nextElementSibling===w, document.querySelector('#inv-new2').getAttribute('aria-expanded'), Math.round(f.getBoundingClientRect().top)]})()""")
            ok(st[0] and st[1]=='SECTION' and not st[2], f'{W}: форма — блок на странице, не окно {st[:3]}')
            ok(st[3], f'{W}: блок сразу под «Отдельным счётом»')
            ok(st[4]=='true', f'{W}: кнопка «+ Отдельный счёт» отмечена как открытая')
            ok(0<=st[5]<H*0.4, f'{W}: страница прокрутилась к форме (верх на {st[5]} px)')
            ok(mid<await pg.evaluate("document.querySelector('#inv-dlg').offsetHeight"), f'{W}: раскрывается плавно (в начале высота {mid:.0f})')
            await pg.select_option('#inv-dlg select[data-f="customerId"]', index=1); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("__inv.st().dirty"), f'{W}: выбор заказчика — есть изменения')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            if W<500:
                await pg.evaluate("scrollBy(0, 400)"); await pg.wait_for_timeout(300)
                r=await pg.evaluate("[document.querySelector('#inv-dlg .invfoot').getBoundingClientRect().bottom, document.querySelector('#mbar').getBoundingClientRect().top]")
                ok(abs(r[0]-r[1])<=2, f'{W}: итог с кнопками прилип над нижней панелью {r}')
                await pg.screenshot(path='/tmp/claude-0/inv-inline-ph.png')
            await pg.click('#inv-dlg .invfh [data-invx]'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#inv-wrap').count()==0 and await pg.evaluate("__inv.st()") is None, f'{W}: «×» (с подтверждением) — блок свернулся')
            ok(await pg.evaluate("document.querySelector('#inv-new2').getAttribute('aria-expanded')")!='true', f'{W}: кнопка снова обычная')
            # из окна «Все счета»
            await pg.click('#inv-all'); await pg.wait_for_timeout(500); await pg.click('#inv-new'); await pg.wait_for_timeout(800)
            ok(not await pg.evaluate("!!document.querySelector('dialog[open]')") and await pg.locator('#inv-wrap.open').count()==1, f'{W}: «+ Новый счёт» в окне — окно закрылось, форма на странице')
            await pg.click('#inv-dlg [data-invx]:not(.dc-x)'); await pg.wait_for_timeout(700)
            ok(await pg.evaluate("!!document.querySelector('dialog[open] #inv-list')"), f'{W}: «Отмена» — вернулись в «Все счета»')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('\nПРОВАЛОВ:', len(fails)); [print(' -',f) for f in fails]
asyncio.run(main())
