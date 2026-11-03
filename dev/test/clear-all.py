"""«Очистить всё»: стороны «(не выбрано)», номер/основание/товары пустые; без сторон документ не формируется; после выбора заказчика всё подставляется."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SEL="(s=>{const e=document.querySelector(s); return e.options[e.selectedIndex]?e.options[e.selectedIndex].text:''})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'2',price:'100'}]; D.draft.basis='Договор 1'; })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(300)
            # вставили текст заявки — блок вставки открыт
            await pg.click('#imp-txt'); await pg.fill('#imp-ta','помидор 5 кг')
            btn=pg.locator('#d-clrall'); bb=await btn.bounding_box(); hb=await pg.locator('#imp-card h2').bounding_box()
            ok(bb and bb['x']+bb['width']<=vw[0] and bb['y']<hb['y']+hb['height'], f'{vw[0]}: кнопка в заголовке «Заказ из файла» {bb}')
            await btn.click(); await pg.wait_for_timeout(200); ok('Точно' in await btn.text_content(), f'{vw[0]}: первое нажатие спрашивает подтверждение')
            await pg.screenshot(path=f'/tmp/clr-armed-{vw[0]}.png')
            await btn.click(); await pg.wait_for_timeout(500)
            for s in ['#d-sup','#d-cus','#d-ctr','#d-shipsel']:
                t=await pg.evaluate(SEL+f"('{s}')"); ok(t=='(не выбрано)', f'{vw[0]}: {s} = {t}')
            dr=await pg.evaluate("(()=>{const d=__fd.D().draft; return {n:d.number, b:d.basis, s:d.supplierId, c:d.customerId, l:d.lines.filter(l=>l.productId).length}})()")
            ok(dr=={'n':'','b':'','s':'','c':'','l':0}, f'{vw[0]}: черновик пустой {dr}')
            ok(await pg.input_value('#d-num')=='' and await pg.input_value('#d-basis')=='', f'{vw[0]}: номер и основание пустые')
            ok(await pg.is_hidden('#imp-paste') and await pg.input_value('#imp-ta')=='', f'{vw[0]}: вставка заявки закрыта и очищена')
            ok(await btn.text_content()=='Очистить всё', f'{vw[0]}: кнопка вернулась')
            await pg.screenshot(path=f'/tmp/clr-done-{vw[0]}.png', full_page=True)
            # без сторон документ не формируется
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'2',price:'100'}]; })()")
            n0=await pg.evaluate("__fd.D().journal.length"); await pg.click('#d-save'); await pg.wait_for_timeout(800)
            ok(await pg.evaluate("__fd.D().journal.length")==n0, f'{vw[0]}: без сторон не сохранилось')
            ok('Не выбран' in (await pg.text_content('#fd-toasts') or ''), f'{vw[0]}: предупреждение «Не выбран…»')
            # после перезагрузки данных стороны остаются пустыми
            await pg.evaluate("__fd.pull(true)"); await pg.wait_for_timeout(2500)
            ok(await pg.evaluate("__fd.D().draft.supplierId===''&&__fd.D().draft.customerId===''"), f'{vw[0]}: загрузка из таблицы не подставила стороны')
            # выбираем заказчика — подтягивается договор, поставщик, номер
            cid=await pg.evaluate("(__fd.D().contracts.find(x=>x.supplierId)||{}).customerId||__fd.D().customers.find(c=>c.id!=='private-buyer').id")
            await pg.select_option('#d-cus', cid); await pg.wait_for_timeout(400)
            st=await pg.evaluate("(()=>{const d=__fd.D().draft; return {s:!!d.supplierId, n:d.number}})()")
            if not st['s']:
                await pg.select_option('#d-sup', await pg.evaluate("__fd.D().suppliers[0].id")); await pg.wait_for_timeout(300)
            st=await pg.evaluate("(()=>{const d=__fd.D().draft; return {s:!!d.supplierId, n:d.number}})()")
            ok(st['s'] and st['n']!='', f'{vw[0]}: после выбора — поставщик и номер есть {st}')
            ok(await pg.evaluate(SEL+"('#d-cus')")!='(не выбрано)' and await pg.evaluate(SEL+"('#d-sup')")!='(не выбрано)', f'{vw[0]}: в списках выбранные названия')
            n0=await pg.evaluate("__fd.D().journal.length"); await pg.click('#d-save'); await pg.wait_for_timeout(2500)
            ok(await pg.evaluate("__fd.D().journal.length")==n0+1, f'{vw[0]}: документ сохранился')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
