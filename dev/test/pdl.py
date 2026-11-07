"""«Товары»: компактный список (строка → раскрыть поля), порядок (А–Я, Я–А, новые, недавно продавали, цена), внутренние артикулы
(присваивает таблица: 4 цифры, по порядку, не повторяются; связанные названия — один артикул; отвязали — снова свой),
поиск по артикулу во «Товарах» и в документе, каталог в Excel, телефон без прокрутки вбок."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
A='Артикул (присваивается сам)'; AO='Свой номер артикула (служебный, не менять)'; ID='ID (не менять)'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=os.environ.get('XLSXJS','/tmp/xlsx/package/dist/xlsx.full.min.js')))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
    return ctx, pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or "/usr/bin/google-chrome")
        ctx,pg,errs=await login(b,(1300,900))
        await pg.reload(); await pg.wait_for_timeout(3000)   # вторая загрузка: таблица уже с товарами — артикулы проставлены всем
        P=rows('Товары'); own=[r[AO] for r in P]
        ok(len(P)>5 and all(len(x)==4 and x.isdigit() for x in own) and len(set(own))==len(own), f'артикулы всем {len(P)} товарам: 4 цифры, без повторов ({own[:3]}…)')
        ok(own==sorted(own), 'по порядку строк таблицы (старые — меньше)')
        ok(all(r[A]==r[AO] for r in P), 'у несвязанных артикул = свой номер')
        await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(500)
        n0=await pg.locator('#pd-body .nmr').count(); ok(n0==min(len(P),100), f'компактный список: {n0} строк')
        ok(await pg.locator('#pd-body input').count()==0, 'поля скрыты, пока строку не раскрыли')
        first=await pg.evaluate("[...document.querySelectorAll('#pd-body .nmr')].slice(0,1).map(r=>[r.querySelector('.nma').textContent,r.querySelector('.nmn b').textContent])[0]")
        ok(first[0].isdigit(), f'в строке артикул {first}')
        # раскрыть
        await pg.click('#pd-body .nmr >> nth=1 >> .nmh'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#pd-body .nmr.open input[data-k=name]').count()==1 and await pg.locator('#pd-body .nmr.open').count()==1, 'нажатие раскрывает поля строки')
        await pg.click('#pd-body .nmr >> nth=2 >> .nmh'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#pd-body .nmr.open').count()==1, 'открыта одна строка')
        # правка цены — шапка обновляется сразу
        oid=await pg.evaluate("document.querySelector('#pd-body .nmr.open').dataset.id")
        await pg.fill('#pd-body .nmr.open input[data-k=price]','777'); await pg.wait_for_timeout(200)
        ok('777 ₽' in await pg.inner_text(f'#pd-body .nmr[data-id="{oid}"] .nmp'), 'цена в строке обновилась сразу')
        # порядок
        await pg.select_option('#pd-sort','name-d'); await pg.wait_for_timeout(300)
        names=await pg.evaluate("[...document.querySelectorAll('#pd-body .nmn b')].map(b=>b.textContent)")
        import locale
        ok(names[0].lower()>=names[1].lower() or True, 'Я–А')
        srt=await pg.evaluate("(L=>{const c=new Intl.Collator('ru',{numeric:true}); return L.every((x,i)=>!i||c.compare(L[i-1],x)>=0)})([...document.querySelectorAll('#pd-body .nmn b')].map(b=>b.textContent))")
        ok(srt, 'порядок Я–А соблюдён')
        await pg.select_option('#pd-sort','price-d'); await pg.wait_for_timeout(300)
        pr=await pg.evaluate("[...document.querySelectorAll('#pd-body .nmr')].map(r=>__fd.D().products.find(p=>p.id===r.dataset.id)).map(p=>+p.price||0)")
        ok(all(pr[i]>=pr[i+1] or pr[i+1]==0 for i in range(len(pr)-1)) and 777 in pr, 'цена: дороже — по убыванию')
        await pg.wait_for_timeout(1500); await pg.reload(); await pg.wait_for_timeout(2500); await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(400)
        ok(await pg.input_value('#pd-sort')=='price-d', 'порядок запомнился')
        # новый товар → артикул от таблицы
        await pg.select_option('#pd-sort','new'); await pg.click('#pd-add'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#pd-body .nmr >> nth=0 >> .nma.new').count()==1, 'новый товар — сверху, артикул «новый»')
        await pg.fill('#pd-body .nmr.open input[data-k=name]','Тестовый товар Альфа'); await pg.wait_for_timeout(3500)
        nid=await pg.evaluate("document.querySelector('#pd-body .nmr.open').dataset.id")
        mx=max(int(x) for x in own)
        art=await pg.inner_text(f'#pd-body .nmr[data-id="{nid}"] .nma')
        ok(art==str(mx+1).zfill(4), f'таблица присвоила следующий артикул {art} (был максимум {mx})')
        # удаление не освобождает номер: удаляем и создаём ещё один
        await pg.click(f'#pd-body .nmr[data-id="{nid}"] [data-del]'); await pg.click(f'#pd-body .nmr[data-id="{nid}"] [data-del]'); await pg.wait_for_timeout(300)
        await pg.click('#pd-add'); await pg.fill('#pd-body .nmr.open input[data-k=name]','Тестовый товар Бета'); await pg.wait_for_timeout(3500)
        nid2=await pg.evaluate("document.querySelector('#pd-body .nmr.open').dataset.id")
        art2=await pg.inner_text(f'#pd-body .nmr[data-id="{nid2}"] .nma')
        ok(art2==str(mx+2).zfill(4), f'номер удалённого не используется повторно: {art2}')
        # связать: Бета ← первый товар; общий артикул
        oth=await pg.evaluate("__fd.D().products[0].id"); oart=[r[AO] for r in rows('Товары') if r[ID]==oth][0]
        await pg.click(f'#pd-body .nmr[data-id="{nid2}"] [data-pcard]'); await pg.wait_for_timeout(500)
        nm0=await pg.evaluate("__fd.D().products[0].name")
        await pg.fill('#pcd-q', nm0[:12]); await pg.wait_for_timeout(200); await pg.click(f'#pcd-sug [data-pglink="{oth}"]'); await pg.wait_for_timeout(3500)
        R={r[ID]:r for r in rows('Товары')}
        g=(R[nid2][A], R[oth][A]); ok(g[0]==g[1] and g[0] in (oart, art2), f'связанные — один артикул в таблице {g}')
        ok('арт. ' in await pg.inner_text('#pcd .dc-kicker'), 'артикул в карточке товара')
        # отвязать — снова свой
        await pg.click(f'#pcd [data-pgun="{nid2}"]'); await pg.wait_for_timeout(3500)
        R={r[ID]:r for r in rows('Товары')}; ok(R[nid2][A]==art2 and R[oth][A]==oart, f'отвязали — снова свои артикулы {R[nid2][A]}, {R[oth][A]}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # поиск по артикулу
        await pg.fill('#pd-q', str(int(art2))); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("[...document.querySelectorAll('#pd-body .nmn b')].map(b=>b.textContent)")==['Тестовый товар Бета'], 'поиск по артикулу «'+str(int(art2))+'»')
        await pg.fill('#pd-q',''); await pg.wait_for_timeout(200)
        # каталог в Excel
        async with pg.expect_download() as dl: await pg.click('#pd-xls')
        d=await dl.value; ok(d.suggested_filename.startswith('Каталог товаров ФД'), f'каталог скачан: {d.suggested_filename}')
        # в документе: набрать артикул
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:'',qty:'',price:''}]; })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400)
        inp=pg.locator('#d-lines .line[data-i="0"] input.ps'); await inp.click(); await inp.fill(art2); await pg.wait_for_timeout(400)
        t=await pg.inner_text('.psm'); ok('Тестовый товар Бета' in t.split('\n')[0] or 'Тестовый товар Бета' in t[:80], f'документ: по артикулу находит товар ({t[:60]!r})')
        ok(not errs, f'ошибок нет {errs[:3]}')
        await ctx.close()
        # телефон
        ctx,pg,errs=await login(b,(390,844)); await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(500)
        await pg.click('#pd-body .nmr >> nth=0 >> .nmh'); await pg.wait_for_timeout(300)
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]==sw[1], f'телефон: без прокрутки вбок {sw}')
        h=await pg.evaluate("document.querySelector('#pd-body .nmr:nth-child(2) .nmh').getBoundingClientRect().height"); ok(h<=84, f'телефон: строка компактная ({h:.0f} px)')
        await pg.screenshot(path='/tmp/claude-0/pdl-390.png')
        ok(not errs, f'телефон: ошибок нет {errs[:3]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
