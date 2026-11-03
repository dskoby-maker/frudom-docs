"""Повтор номера у заказчика: поле красное + предупреждение, но документ создаётся с этим номером (Новый документ и Заявка)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
REN="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'2',price:'100'}]; })()"); await pg.evaluate(REN+"('doc')"); await pg.wait_for_timeout(300)
            n1=await pg.input_value('#d-num'); ok(not await pg.evaluate("document.getElementById('d-num').classList.contains('numdup')"), f'{vw[0]}: свободный номер {n1} не красный')
            await pg.click('#d-save'); await pg.wait_for_timeout(2500)
            # новый документ тому же заказчику, вписываем тот же номер
            await pg.evaluate("(()=>{const D=__fd.D(); const id=Math.random().toString(36).slice(2); Object.assign(D.draft,{id, number:'', numManual:false}); D.draft.lines=[{productId:D.products[0].id,qty:'1',price:'100'}]; })()"); await pg.evaluate(REN+"('doc')"); await pg.wait_for_timeout(300)
            n2=await pg.input_value('#d-num'); ok(n2!=n1, f'{vw[0]}: сайт сам подставил следующий номер {n2}')
            await pg.fill('#d-num', n1); await pg.wait_for_timeout(200)
            ok(await pg.evaluate("document.getElementById('d-num').classList.contains('numdup')"), f'{vw[0]}: поле номера красное')
            t=await pg.text_content('#d-numinfo'); ok('уже есть № '+n1 in t, f'{vw[0]}: подпись: {t}')
            await pg.screenshot(path=f'/tmp/numdup-doc-{vw[0]}.png')
            c0=await pg.evaluate(f"__fd.D().journal.filter(j=>String(j.number)==='{n1}').length")
            await pg.click('#d-save'); await pg.wait_for_timeout(3000)
            c1=await pg.evaluate(f"__fd.D().journal.filter(j=>String(j.number)==='{n1}').length")
            ok(c1==c0+1 and await pg.evaluate("__fd.D().journal.some(j=>j.snap&&j.snap.dr.lines.some(l=>l.qty==='1')&&String(j.number)==='"+n1+"')"), f'{vw[0]}: сохранён с повторяющимся номером ({c0}→{c1})')
            ok('повторяется' in (await pg.text_content('#fd-toasts') or ''), f'{vw[0]}: всплыло предупреждение о повторе')
            await pg.fill('#d-num', '987654'); await pg.wait_for_timeout(200)
            ok(not await pg.evaluate("document.getElementById('d-num').classList.contains('numdup')"), f'{vw[0]}: другой номер — красного нет')
            # Заявка
            await pg.evaluate(REN+"('order')"); await pg.wait_for_timeout(500)
            await pg.evaluate("(()=>{const D=__fd.D(), o=D.order; D.journal.push({id:'fake777', supplierId:o.supplierId, customerId:o.customerId, number:'777', date:'2026-11-04', sum:0, snap:null}); })()")
            n1='777'; await pg.evaluate(REN+"('order')"); await pg.wait_for_timeout(400)
            if await pg.locator('#o-body tr[data-i] .nm').count():
                el=pg.locator('#o-body tr[data-i="0"] .nm'); await el.click(); await el.fill(n1); await pg.locator('#o-body tr[data-i="0"] .q').first.fill('2'); await pg.wait_for_timeout(300)
                ok(await pg.evaluate("document.querySelector('#o-body tr[data-i=\"0\"] .nm').classList.contains('numdup')"), f'{vw[0]}: Заявка — номер красный')
                ok(not await pg.is_hidden('#o-numwarn') and 'уже есть' in await pg.text_content('#o-numwarn'), f'{vw[0]}: Заявка — предупреждение под таблицей')
                await pg.screenshot(path=f'/tmp/numdup-order-{vw[0]}.png', full_page=True)
                await el.fill(''); await pg.wait_for_timeout(200)
                ok(not await pg.evaluate("document.querySelector('#o-body tr[data-i=\"0\"] .nm').classList.contains('numdup')") and await pg.is_hidden('#o-numwarn'), f'{vw[0]}: Заявка — автономер не красный')
            else: ok(False, f'{vw[0]}: в Заявке нет строк')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
