"""Склад → История: по 10 записей, страницы, 10/20/все, период, действие, сотрудник, порядок; движения в карточке товара — по 10."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
def post(body):
    r=urllib.request.Request('http://localhost:8787/exec', data=json.dumps(body).encode(), headers={'content-type':'application/json'}); return json.load(urllib.request.urlopen(r))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            # 14 приходов одного товара → 15+ записей истории и 14 движений
            rows=[{"newName":f"Гречка {W}","unit":"кг","qty":str(i+1),"price":"50","date":"2026-11-05","supplier":"Рынок","docRef":f"Н{i}"} for i in range(14)]
            await pg.evaluate("""async rows=>{ for(const r of rows){ await window.__sk.send('in', Object.assign({force:true},r), 'приход'); } }""", rows)
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(800)
            await pg.wait_for_timeout(300)
            await pg.click('#sk-segs [data-skt="log"]'); await pg.wait_for_timeout(400)
            n=await pg.locator('#sk-list .sklr').count(); total=await pg.evaluate("__sk.logN()")
            ok(n==10, f'{W}: по умолчанию 10 записей ({n}, всего {total})')
            ok(await pg.locator('#sk-lgpager .pgb').count()>=2, f'{W}: есть страницы')
            await pg.click('#sk-lgpager [data-ps="20"]'); await pg.wait_for_timeout(300)
            n20=await pg.locator('#sk-list .sklr').count(); ok(n20==min(20,total), f'{W}: «20» — {n20}')
            await pg.click('#sk-lgpager [data-ps="0"]'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#sk-list .sklr').count()==total, f'{W}: «все» — {total}')
            await pg.click('#sk-lgpager [data-ps="10"]'); await pg.wait_for_timeout(200)
            await pg.click('#sk-lgpager [data-pg="1"]'); await pg.wait_for_timeout(300)
            ok('11–' in await pg.text_content('#sk-lgpager'), f'{W}: вторая страница')
            # действие
            await pg.select_option('#sk-list .sklg-act', 'Приход'); await pg.wait_for_timeout(300)
            acts=await pg.evaluate("[...document.querySelectorAll('#sk-list .skla')].map(x=>x.textContent)"); ok(acts and all(a=='Приход' for a in acts), f'{W}: фильтр по действию ({len(acts)})')
            # порядок
            first_new=await pg.text_content('#sk-list .sklr .sklo b'); await pg.click('[data-sklg-sort]'); await pg.wait_for_timeout(300)
            first_old=await pg.text_content('#sk-list .sklr .sklo b'); ok(first_new!=first_old, f'{W}: порядок меняется ({first_new} / {first_old})')
            # период: «Сегодня» есть, период в прошлом — пусто
            await pg.click('[data-sklg-per="today"]'); await pg.wait_for_timeout(200); ok(await pg.locator('#sk-list .sklr').count()>0, f'{W}: «Сегодня»')
            await pg.click('[data-sklg-per="range"]'); await pg.wait_for_timeout(200)
            await pg.fill('#sk-list .sklg-from','2020-01-01'); await pg.dispatch_event('#sk-list .sklg-from','change'); await pg.fill('#sk-list .sklg-to','2020-01-31'); await pg.dispatch_event('#sk-list .sklg-to','change'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#sk-list .sklr').count()==0 and 'Поменяйте период' in await pg.text_content('#sk-list'), f'{W}: период без записей — понятная подсказка')
            await pg.click('[data-sklg-reset]'); await pg.wait_for_timeout(300); ok(await pg.locator('#sk-list .sklr').count()==10, f'{W}: «Сбросить»')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            await pg.screenshot(path=f'/tmp/claude-0/sklog-{W}.png', full_page=False)
            # карточка товара: движения по 10
            await pg.click('#sk-segs [data-skt="items"]'); await pg.wait_for_timeout(300)
            await pg.locator('#sk-list [data-skitem]', has_text=f'Гречка {W}').first.click(); await pg.wait_for_timeout(400)
            ok(await pg.locator('#sk-dlg .skmr').count()==10 and await pg.locator('#sk-dlg [data-skmv]').count()==2, f'{W}: в карточке 10 движений + «Ещё 10 / Все»')
            await pg.click('#sk-dlg [data-skmv][data-n="all"]'); await pg.wait_for_timeout(300); ok(await pg.locator('#sk-dlg .skmr').count()==14, f'{W}: «Все» — 14 движений')
            await pg.locator('#sk-dlg .skmv').scroll_into_view_if_needed(); await pg.screenshot(path=f'/tmp/claude-0/skmv-{W}.png')
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
