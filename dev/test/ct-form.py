"""Договоры заказчика — карточки с подписями: шапка (название, ИП, срок, отгружено из цены), подсказки по основанию и ИКЗ, дата словами → цифры, новый договор с поставщиком последней накладной, удаление в два нажатия; ПК и телефон."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            cid=await pg.evaluate("(()=>{const D=__fd.D(); return D.customers.find(x=>!x.priv&&x.id!=='private-buyer').id})()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"customers\"]').click()"); await pg.wait_for_timeout(500)
            await pg.select_option('#cus-editor select.pick', cid); await pg.wait_for_timeout(500)
            n0=await pg.locator('#ct-body .ctc').count()
            await pg.click('#ct-add'); await pg.wait_for_timeout(600)
            card=pg.locator('#ct-body .ctc').last
            ok(await pg.locator('#ct-body .ctc').count()==n0+1, f'{W}: новый договор — карточка')
            ok(await pg.evaluate("document.activeElement && document.activeElement.dataset.k")=='basis', f'{W}: курсор сразу в «Основании»')
            ok('Новый договор' in await card.locator('.ctname').inner_text(), f'{W}: заголовок «Новый договор»')
            bs=card.locator('[data-k=basis]'); await bs.fill('Договор № 77 от 18 января 2026 г.'); await bs.dispatch_event('change'); await pg.wait_for_timeout(200)
            v=await bs.input_value(); ok('18.01.2026' in v, f'{W}: дата словами → цифры: {v!r}')
            ok('Договор № 77' in await card.locator('.ctname').inner_text(), f'{W}: заголовок = основание')
            ok('✓' in await card.locator('[data-h=basis]').inner_text(), f'{W}: подсказка «номер и дата есть»')
            ik=card.locator('[data-k=ikz]'); await ik.fill('2617'); await pg.wait_for_timeout(100)
            ok('4 из 36' in await card.locator('[data-h=ikz]').inner_text(), f'{W}: ИКЗ — счётчик цифр')
            ms=card.locator('[data-k=maxSum]'); await ms.fill('100000'); await pg.wait_for_timeout(200)
            ok('из 100 000' in (await card.locator('.ctuse').inner_text()).replace('\xa0',' '), f'{W}: «Отгружено … из цены договора»')
            shown=await ms.evaluate("e=>Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').get.call(e)")
            ok(shown.replace('\xa0',' ')=='100 000', f'{W}: цена с пробелами на экране: {shown!r}')
            await card.locator('[data-k=dateTo]').fill('2026-12-01'); await pg.wait_for_timeout(200)
            ok('осталось' in await card.locator('.ctch').inner_text(), f'{W}: срок «осталось N дней»')
            sh=card.locator('[data-k=short]')
            if not await sh.is_disabled(): await sh.fill('Овощи'); await pg.wait_for_timeout(100); ok(await card.locator('.ctname').inner_text()=='Овощи', f'{W}: заголовок = короткое')
            sw=await pg.evaluate('document.documentElement.scrollWidth'); ok(sw<=W, f'{W}: без прокрутки вбок ({sw})')
            await card.scroll_into_view_if_needed(); await pg.screenshot(path=f'/tmp/claude-0/ctf-{W}.png')
            await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(2000)
            T=dump()['Контракты']; Hh=T[0]; R=[dict(zip(Hh,r)) for r in T[1:]]
            row=[r for r in R if 'Договор № 77' in str(r.get(Hh[3]) if len(Hh)>3 else '') or any('Договор № 77' in str(v) for v in r.values())]
            ok(row and any('18.01.2026' in str(v) for v in row[0].values()) and any(str(v).replace(' ','') in ('100000','100000.0') for v in row[0].values()), f'{W}: записано в «Контракты»')
            d=card.locator('[data-del]'); await d.click(); ok(await d.inner_text()=='Удалить?', f'{W}: удаление — первое нажатие спрашивает')
            await d.click(); await pg.wait_for_timeout(300); ok(await pg.locator('#ct-body .ctc').count()==n0, f'{W}: удалён вторым нажатием')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
