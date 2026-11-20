"""Страница прайса (вместо окна) и подкатегории товаров (20.11.2026).
Прайс ТД Палитра Вкуса (3 717 позиций с разделами) загружается по шаблону (Excel подменён заглушкой) → «Открыть прайс» — отдельная страница:
разделы слева (на телефоне — выбор раздела), поиск и порядок, «Показать ещё», товар сайта → карточка, «‹ Прайсы поставщиков» и «Назад» браузера.
Потом «Разложить товары…» — предпросмотр, «Применить»: категории и подкатегории в таблице, у товаров — подкатегории, во «Товарах» вторая строка фильтра.
Данные прайса: PAL=/tmp/claude-0/pvw/out.json ([название, ед., цена, раздел, упаковка]).
Сервер: AI_FAKE=/tmp/claude-0/ctt-ai.json PORT=8787 node test/server.js (на чистом сервере). PH=1 — телефон."""
import asyncio, json, os, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
B='http://localhost:8787'; PH=os.environ.get('PH')=='1'; W=390 if PH else 1300
def srv(js): return urllib.request.urlopen(urllib.request.Request(B+'/eval', data=js.encode(), method='POST')).read().decode()
json.dump({"c":[]}, open('/tmp/claude-0/ctt-ai.json','w'))
P=json.load(open(os.environ.get('PAL','/tmp/claude-0/pvw/out.json')))
AOA=[["Прайс"],[],["Поставщик","ТД Палитра Вкуса"],["Дата прайса","17.09.2026"],["Цены",""],[],["Наименование","Ед.","Цена, ₽","Категория","Примечание"]]+[[r[0],r[1],r[2],r[3],r[4]] for r in P]
FAKE="window.XLSX={read:()=>({SheetNames:['П'],Sheets:{'П':1}}),utils:{sheet_to_json:()=>"+json.dumps(AOA,ensure_ascii=False)+"}};"
F='/tmp/claude-0/ctt.xlsx'; open(F,'wb').write(b'PK')
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':W,'height':860}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(FAKE)
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"suppliers\"]').click()"); await pg.wait_for_selector('#vp-card:not([hidden]) .vph', timeout=8000)
        have=await pg.evaluate("__fd.D().products.length")
        if not await pg.query_selector('#vp-card .vpl'):
            await pg.set_input_files('#vp-file', F); await pg.wait_for_selector('#vp-card .vpuph', timeout=120000)
            await pg.click('#vp-card [data-vp="save"]'); await pg.wait_for_selector('#vp-card .vpl', timeout=180000); await pg.wait_for_timeout(3000)
        # ---- страница прайса
        await pg.click('#vp-card [data-vp="win"]'); await pg.wait_for_selector('#tab-vprice:not([hidden]) .vpgr', timeout=8000)
        ok(not await pg.query_selector('#fd-dcard[open]'), 'прайс открылся страницей, не окном')
        ok(await pg.evaluate("location.hash")=='#postavshchiki' and await pg.query_selector('#fd-tback'), 'сверху «‹ Назад: Поставщики»')
        t=await pg.inner_text('#tab-vprice .vpgh'); ok('ТД Палитра Вкуса' in t and 'Позиций' in t, 'шапка: поставщик и плитки')
        n=await pg.evaluate("document.querySelectorAll('#vpg-list .vpgr').length"); ok(n==200, f'показаны первые 200 ({n})')
        await pg.click('#tab-vprice [data-vpg="more"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("document.querySelectorAll('#vpg-list .vpgr').length")==400, '«Показать ещё» — 400')
        if not PH:
            ok(await pg.is_visible('#tab-vprice .vpgs'), 'разделы слева')
            sw=await pg.evaluate("document.querySelector('#vpg-sort').getBoundingClientRect().width"); qw=await pg.evaluate("document.querySelector('#vpg-q').getBoundingClientRect().width")
            ok(sw<260 and qw>400, f'поиск широкий ({qw:.0f}), порядок компактный ({sw:.0f})')
            await pg.click('#vpg-secs [data-vpgc="Вафли.Торты вафельные"]'); await pg.wait_for_timeout(300)
        else:
            ok(not await pg.is_visible('#tab-vprice .vpgs'), 'на телефоне разделы — выбором, без боковой колонки')
            await pg.evaluate("(()=>{const s=document.querySelector('#vpg-sec'); s.value='Вафли.Торты вафельные'; s.dispatchEvent(new Event('change',{bubbles:true}))})()"); await pg.wait_for_timeout(300)
        t=await pg.inner_text('#vpg-list'); k=sum(1 for r in P if r[3]=="Вафли.Торты вафельные")
        ok(f'Найдено {k} из' in t and 'раздел «Вафли.Торты вафельные»' in t, f'раздел «Вафли»: {k}')
        await pg.fill('#vpg-q','Артек'); await pg.wait_for_timeout(300); t=await pg.inner_text('#vpg-list'); ok('Артек' in t, 'поиск в разделе')
        await pg.press('#vpg-q','Escape'); await pg.click('#vpg-list [data-vpgc=""]'); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const s=document.querySelector('#vpg-sort'); s.value='price-d'; s.dispatchEvent(new Event('change',{bubbles:true}))})()"); await pg.wait_for_timeout(300)
        pr=await pg.evaluate("[...document.querySelectorAll('#vpg-list .vpgp b')].slice(0,5).map(x=>parseFloat(x.textContent.replace(/\\s/g,'').replace(',','.')))")
        ok(pr==sorted(pr,reverse=True) and pr[0]>=max(r[2] for r in P)-0.01, f'сначала дороже {pr[:3]}')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, 'без прокрутки вбок')
        await pg.click('#vpg-list .vpwl'); await pg.wait_for_selector('#fd-dcard[open]', timeout=5000); ok(True,'товар сайта → карточка поверх страницы')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("!document.querySelector('#tab-vprice').hidden"), 'после карточки — снова страница прайса')
        await pg.go_back(); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("!document.querySelector('#tab-suppliers').hidden"), '«Назад» браузера → «Поставщики»')
        await pg.click('#vp-card [data-vp="win"]'); await pg.wait_for_timeout(500); await pg.click('#tab-vprice [data-vpg="back"]'); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("!document.querySelector('#tab-suppliers').hidden"), '«‹ Прайсы поставщиков» → «Поставщики»')
        # ---- подкатегории
        await pg.evaluate("__fd.pull()"); await pg.wait_for_timeout(2500)   # пустая таблица при первом входе — данные приходят со следующей загрузкой
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"products\"]').click()"); await pg.wait_for_timeout(1500)
        if await pg.query_selector('#pd-tree [data-ctt="open"]'):
            await pg.click('#pd-tree [data-ctt="open"]'); await pg.wait_for_selector('#sk-dlg .ctt', timeout=20000)
            t=await pg.inner_text('#sk-dlg'); ok('Кондитерские изделия' in t and 'Печенье' in t and 'Чай, кофе, какао' in t, 'предпросмотр: дерево категорий')
            await pg.click('#sk-dlg [data-ctt="tg"][data-v="c-s-waf"]'); await pg.wait_for_timeout(300)
            t=await pg.inner_text('#sk-dlg .ctt-g.open'); ok('Вафли' in t and 'Артек' in t, 'подкатегория раскрывается со списком товаров')
            ok(await pg.evaluate("document.querySelector('#sk-dlg').scrollWidth<=document.querySelector('#sk-dlg').clientWidth+3"), 'окно без прокрутки вбок')
            await pg.click('#sk-dlg [data-ctt="apply"]'); await pg.wait_for_timeout(3500)
        D=await pg.evaluate("(()=>{const d=__fd.D(); return {subs:d.cats.filter(c=>c.parent).length, tops:d.cats.filter(c=>!c.parent).length, waf:d.products.filter(p=>p.cat==='c-s-waf').length, none:d.products.filter(p=>!p.cat).length}})()")
        ok(D['tops']==16 and D['subs']>=78, f'категорий 16, подкатегорий {D["subs"]}')
        ok(D['waf']>=100, f'в «Вафли» {D["waf"]} товаров'); ok(D['none']<=5, f'без категории {D["none"]}')
        await pg.wait_for_timeout(2500); d=json.loads(urllib.request.urlopen(B+'/dump').read())
        C=d['Категории товаров']; ip=C[0].index('Входит в категорию (ID, заполняется с сайта)') if 'Входит в категорию (ID, заполняется с сайта)' in C[0] else -1
        ok(ip>=0 and sum(1 for r in C[1:] if r[ip])>=78, 'в таблице у подкатегорий записан родитель')
        T=d['Товары']; ic=T[0].index('Категория (заполняется с сайта)'); ok(any(r[ic]=='Кондитерские изделия / Вафли' for r in T[1:]), 'у товара в таблице «Кондитерские изделия / Вафли»')
        # фильтр во «Товарах»
        await pg.evaluate("(()=>{const b=document.querySelector('#pd-src [data-pdsrc=\"all\"]'); b&&b.click()})()"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#pd-cats [data-pdc=\"cq31d1lxr\"]').click()"); await pg.wait_for_timeout(500)
        ok(await pg.is_visible('#pd-subs [data-pdc="c-s-waf"]'), 'вторая строка — подкатегории «Кондитерских»')
        await pg.evaluate("document.querySelector('#pd-subs [data-pdc=\"c-s-waf\"]').click()"); await pg.wait_for_timeout(500)
        t=await pg.inner_text('#pd-n'); ok(str(D['waf']) in t.replace(' ',''), f'выбрана подкатегория «Вафли»: {t}')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, 'во «Товарах» без прокрутки вбок')
        g=await pg.evaluate("[__cats.guess('Вафли Артек 6,5кг'), __cats.guess('Помидоры черри'), __cats.guess('Чипсы Лейс 90г')]")
        ok(g==['c-s-waf','c-v-tom','c-n-chips'], f'новый товар — сразу в подкатегорию {g}')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
