"""Склад: приход по накладной — много строк за раз (руками, вставка из Excel, фото через ИИ), штуки, сверка с суммой, черновик, одна операция."""
import asyncio, os, json, re, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
AI={"supplier":"ИП Малишава К.А.","number":"000008819","date":"05.11.2026","total":3100,
    "items":[{"name":"Макар\"Макфа\"Лапша450г*20","unit":"шт","qty":40,"price":62.5,"sum":2500},{"name":"Изюм светлый","unit":"кг","qty":2,"price":300,"sum":600,"unsure":True}]}
async def until(pg, js, t=8000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def ai_route(route):
    req=route.request
    if req.method=='POST' and '"aiRead"' in (req.post_data or ''):
        ok('"kind":"in"' in req.post_data, 'ИИ: сайт просит прочитать именно накладную (kind=in)')
        await route.fulfill(status=200, content_type='application/json', body=json.dumps({"ok":True,"text":json.dumps(AI,ensure_ascii=False),"model":"test"})); return
    await route.continue_()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.route('**/*', ai_route)
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1000)
            await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(400)
            ok(await pg.locator('#sk-dlg .mi-row').count()==3, f'{W}: открылся приход по накладной, 3 пустые строки')
            await pg.fill('#sk-dlg .mi-sup',f'ИП Тест {W}'); await pg.fill('#sk-dlg .mi-doc',f'Н-{W}')
            # руками: строка 1, сумма вместо цены
            await pg.locator('#sk-dlg .mi-name').nth(0).fill(f'Гречка {W}'); await pg.locator('#sk-dlg .mi-qty').nth(0).fill('10'); await pg.locator('#sk-dlg .mi-sum').nth(0).fill('1234,5')
            pr=await pg.locator('#sk-dlg .mi-price').nth(0).input_value(); ok(pr=='123,45', f'{W}: по сумме посчиталась цена: {pr}')
            # Enter из последней строки — новая строка
            await pg.locator('#sk-dlg .mi-name').nth(2).fill(f'Рис {W}'); await pg.locator('#sk-dlg .mi-qty').nth(2).fill('5'); await pg.locator('#sk-dlg .mi-price').nth(2).fill('100'); await pg.locator('#sk-dlg .mi-price').nth(2).press('Enter'); await pg.wait_for_timeout(200)
            ok(await pg.locator('#sk-dlg .mi-row').count()==4 and await pg.evaluate("document.activeElement.classList.contains('mi-name')"), f'{W}: Enter добавил строку и поставил курсор')
            ok('1 734,50' in (await pg.text_content('#mi-foot')).replace(' ',' '), f'{W}: итог по строкам 1 734,50')
            # вставка из Excel
            await pg.locator('#sk-dlg .mi-name').nth(3).focus()
            await pg.evaluate("""(()=>{const t=document.activeElement, dt=new DataTransfer(); dt.setData('text/plain','Курага\\t3\\tкг\\t500\\nФиники\\t2\\tкг\\t400\\t800'); t.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));})()"""); await pg.wait_for_timeout(300)
            names=await pg.evaluate("__mi.st().rows.map(r=>r.name)"); ok('Курага' in names and 'Финики' in names, f'{W}: вставка из Excel добавила строки {names}')
            # закрыть — черновик, открыть снова
            await pg.click('#sk-dlg [data-mi="close"]'); await pg.wait_for_timeout(400); await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(400)
            ok(await pg.locator('#sk-dlg .mi-rest').count()==1 and await pg.locator('#sk-dlg .mi-sup').input_value()==f'ИП Тест {W}', f'{W}: черновик восстановлен')
            # ИИ
            await pg.set_input_files('#sk-dlg .mi-aif', files=[{'name':'nakl.jpg','mimeType':'image/jpeg','buffer':bytes.fromhex('ffd8ffe000104a46494600010100000100010000ffd9')}])
            ok(await until(pg,"__mi.st() && __mi.st().rows.some(r=>/Лапша/.test(r.name))"), f'{W}: ИИ заполнил строки')
            # лапша в шт с весом в названии — кнопка перевода в кг
            k=await pg.evaluate("__mi.st().rows.find(r=>/Лапша/.test(r.name)).k")
            if await pg.locator(f'#sk-dlg .mi-row[data-k="{k}"] [data-mi="conv"]').count():   # товара ещё нет на складе — сайт предлагает перевести по весу из названия
                ok(await pg.locator(f'#sk-dlg .mi-row[data-k="{k}"] [data-mi="conv"]').count()==1, f'{W}: подсказка «в кг: 1 шт = 0,45 кг»')
                await pg.click(f'#sk-dlg .mi-row[data-k="{k}"] [data-mi="conv"]'); await pg.wait_for_timeout(300)
            else:         # товар уже на складе с весом 1 шт — переведено в кг сразу
                ok(await pg.locator(f'#sk-dlg .mi-row[data-k="{k}"] .mi-pcsb').count()==1, f'{W}: известный товар сразу переведён в кг, блок штук открыт')
            r=await pg.evaluate(f"(r=>[r.unit,r.qty,r.pcs,r.pack])(__mi.st().rows.find(r=>r.k==='{k}'))"); ok(r==['кг','18','40','0,45'], f'{W}: переведено в кг {r}')
            pc=await pg.text_content(f'#sk-dlg .mi-row[data-k="{k}"] .mi-pcs'); ok('40 шт' in pc, f'{W}: под количеством видно 40 шт')
            await pg.screenshot(path=f'/tmp/claude-0/mi-{W}.png', full_page=False)
            # сумма по накладной от ИИ 3100, а у нас ещё ручные строки — не сходится
            ok('не сходится' in await pg.text_content('#mi-foot'), f'{W}: сверка с суммой накладной показывает расхождение')
            # удалить ручные строки, кроме ИИ
            for nm in [f'Гречка {W}', f'Рис {W}', 'Курага', 'Финики']:
                kk=await pg.evaluate(f"(__mi.st().rows.find(r=>r.name==={json.dumps(nm)})||{{}}).k")
                if kk: await pg.click(f'#sk-dlg .mi-row[data-k="{kk}"] [data-mi="del"]'); await pg.wait_for_timeout(150)
            ok('сходится' in await pg.text_content('#mi-foot') and 'не сходится' not in await pg.text_content('#mi-foot'), f'{W}: после удаления — ✓ сходится')
            await pg.fill('#sk-dlg .mi-doc',f'000008819-{W}')
            sw=await pg.evaluate("(d=>d.scrollWidth<=d.clientWidth+1)(document.querySelector('#sk-dlg'))"); ok(sw, f'{W}: окно без прокрутки вбок')
            await pg.click('#sk-dlg [data-mi="save"]'); ok(await until(pg,"!document.querySelector('#sk-dlg')"), f'{W}: приход проведён, окно закрылось')
            await pg.wait_for_timeout(800)
            B=[x for x in rows('Склад: партии') if x.get('Входящий документ')==f'000008819-{W}']
            ok(len(B)==2, f'{W}: в таблице 2 партии одной накладной ({len(B)})')
            L=[x for x in B if 'Лапша' in str(x.get('Товар'))]
            ok(L and str(L[0].get('Количество'))=='18' and str(L[0].get('Вес 1 шт (фасовка)'))=='0.45' and str(L[0].get('Закупочная цена за ед.'))=='138.8889', f'{W}: лапша 18 кг, 0,45, 138,8889 {[(x.get("Количество"),x.get("Вес 1 шт (фасовка)"),x.get("Закупочная цена за ед.")) for x in L]}')
            ok(all(x.get('Поставщик')==f'ИП Тест {W}' for x in B), f'{W}: вписанный поставщик ИИ не перезаписал, он у всех строк')
            t=await pg.text_content('#sk-list') or ''; ok(re.search(r'\d+ шт', t) is not None, f'{W}: в списке склада видно штуки')
            # черновик очищен
            await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(400); ok(await pg.locator('#sk-dlg .mi-rest').count()==0, f'{W}: после проведения черновик пустой')
            # ошибка в строке — не проводится
            await pg.locator('#sk-dlg .mi-name').nth(0).fill('Без количества'); await pg.click('#sk-dlg [data-mi="save"]'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#sk-dlg .mi-row.bad').count()==1, f'{W}: строка без количества подсвечена, приход не проведён')
            await pg.click('#sk-dlg [data-mi="clear"]') if await pg.locator('#sk-dlg [data-mi="clear"]').count() else None
            await pg.evaluate("localStorage.clear()")
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
