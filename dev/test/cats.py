"""Категории товаров: стандартные создаются сами, «Разложить по категориям», фильтры (Товары, Цены, Склад), своя категория,
новый товар получает категорию по названию, переименование/удаление, запись в таблицу (ID + понятное название)."""
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
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3500)
            await pg.reload(); await pg.wait_for_timeout(3000)   # первая загрузка пустой таблицы выгружает данные, вторая — читает
            ok(await until(pg,"__fd.D().cats && __fd.D().cats.length>=9"), f'{W}: стандартные категории созданы')
            await pg.wait_for_timeout(2000)
            C=rows('Категории товаров'); nm=[r['Категория'] for r in C]; ok(len(C)>=9 and nm.count('Зелень')==1 and nm.count('Фрукты')==1, f'{W}: в таблице стандартные категории без дублей ({len(C)})')
            # тестовые товары без категории
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); [['a{W}','Огурцы свежие тест{W}'],['b{W}','Укроп свежий тест{W}'],['c{W}','Капуста квашеная тест{W}'],['d{W}','Курага тест{W}'],['e{W}','Вишня замороженная тест{W}'],['f{W}','Штуковина тест{W}']].forEach(([id,name])=>D.products.push({{id,name,code:'',unit:'кг',country:'',price:'1',cat:''}})); }})()""")
            await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(500)
            ok(await pg.is_visible('#pd-auto'), f'{W}: кнопка «Разложить по категориям» видна')
            await pg.click('#pd-auto'); await pg.wait_for_timeout(400)
            sel=await pg.evaluate(f"Object.fromEntries([...document.querySelectorAll('#sk-dlg [data-cata-p]')].filter(s=>s.dataset.cataP.endsWith('{W}')).map(s=>[s.dataset.cataP[0], s.value]))")
            ok(sel=={'a':'c-veg','b':'c-green','c':'c-pickle','d':'c-dried','e':'c-frozen','f':''}, f'{W}: категории угаданы верно {sel}')
            await pg.screenshot(path=f'/tmp/claude-0/cats-auto-{W}.png')
            await pg.click('#sk-dlg [data-cata="apply"]'); await pg.wait_for_timeout(400)
            ok(await pg.evaluate(f"__fd.D().products.find(p=>p.id==='b{W}').cat")=='c-green', f'{W}: применено')
            # фильтр «Зелень» во вкладке «Товары»
            await pg.click('#pd-cats [data-pdc="c-green"]'); await pg.wait_for_timeout(200)
            names=await pg.evaluate("[...document.querySelectorAll('#pd-body input[data-k=name]')].map(i=>i.value)")
            ok(f'Укроп свежий тест{W}' in names and f'Огурцы свежие тест{W}' not in names, f'{W}: фильтр «Зелень» ({len(names)} строк)')
            await pg.fill('#pd-q', f'тест{W}'); await pg.wait_for_timeout(200)
            ok(await pg.locator('#pd-body tr').count()==1, f'{W}: поиск + фильтр')
            await pg.click('#pd-cats [data-pdc="all"]'); await pg.wait_for_timeout(200)
            ok(await pg.locator('#pd-body tr').count()==6, f'{W}: «Все» — 6 тестовых')
            # своя категория, назначить «Штуковине»
            await pg.click('#pd-catm'); await pg.wait_for_timeout(300)
            await pg.fill('#sk-dlg .catm-new', f'Молочка {W}'); await pg.press('#sk-dlg .catm-new','Enter'); await pg.wait_for_timeout(300)
            cid=await pg.evaluate(f"(__fd.D().cats.find(c=>c.name==='Молочка {W}')||{{}}).id")
            ok(bool(cid), f'{W}: своя категория добавлена')
            await pg.screenshot(path=f'/tmp/claude-0/cats-man-{W}.png')
            await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(300)
            await pg.select_option(f'#pd-body tr[data-id="f{W}"] select[data-k=cat]', cid); await pg.wait_for_timeout(200)
            # новый товар — категория сама
            await pg.fill('#pd-q',''); await pg.click('#pd-add'); await pg.wait_for_timeout(200)
            nid=await pg.evaluate("__fd.D().products[__fd.D().products.length-1].id")
            await pg.fill(f'#pd-body tr[data-id="{nid}"] input[data-k=name]', f'Петрушка новая {W}'); await pg.wait_for_timeout(200)
            ok(await pg.input_value(f'#pd-body tr[data-id="{nid}"] select[data-k=cat]')=='c-green', f'{W}: новому товару категория поставилась сама')
            await pg.wait_for_timeout(2500)
            P=[r for r in rows('Товары') if r.get('ID (не менять)') in (f'f{W}', nid)]
            ok(len(P)==2 and {r['Категория (заполняется с сайта)'] for r in P}=={f'Молочка {W}','Зелень'}, f'{W}: в таблице у товаров понятное название категории {[r.get("Категория (заполняется с сайта)") for r in P]}')
            # переименование своей категории → название в «Товарах» обновилось
            await pg.click('#pd-catm'); await pg.wait_for_timeout(300)
            inp=pg.locator(f'#sk-dlg .catm-r[data-cid="{cid}"] .catm-n'); await inp.fill(f'Молочная продукция {W}'); await inp.press('Tab'); await pg.wait_for_timeout(200)
            await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(2500)
            P=[r for r in rows('Товары') if r.get('ID (не менять)')==f'f{W}']; ok(P and P[0]['Категория (заполняется с сайта)']==f'Молочная продукция {W}', f'{W}: переименование видно в таблице')
            # цены заказчика: фильтр по категории
            await pg.evaluate(TAB+"('customers')"); await pg.wait_for_timeout(600)
            ok(await pg.locator('#pr-cats .catc').count()>=2, f'{W}: в «Ценах для заказчика» есть фильтр категорий')
            await pg.fill('#pr-q', f'тест{W}'); await pg.wait_for_timeout(300)
            await pg.click('#pr-cats [data-prc="c-green"]'); await pg.wait_for_timeout(300)
            t=await pg.text_content('#pr-body'); ok(f'Укроп свежий тест{W}' in t and f'Огурцы свежие тест{W}' not in t, f'{W}: фильтр цен по «Зелень»')
            await pg.click('#pr-cats [data-prc="all"]')
            # склад: фильтр
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(800)
            # удаление категории снимает её с товаров
            await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(300); await pg.click('#pd-catm'); await pg.wait_for_timeout(300)
            dl=pg.locator(f'#sk-dlg .catm-r[data-cid="{cid}"] [data-catm="del"]'); await dl.click(); await dl.click(); await pg.wait_for_timeout(300)
            ok(await pg.evaluate(f"__fd.D().products.find(p=>p.id==='f{W}').cat")=='' and not await pg.evaluate(f"!!__fd.D().cats.find(c=>c.id==='{cid}')"), f'{W}: категория удалена и снята с товара')
            await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(300)
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            await pg.screenshot(path=f'/tmp/claude-0/cats-pd-{W}.png')
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
