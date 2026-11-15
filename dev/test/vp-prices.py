"""«Цены других поставщиков» во вкладке «Поставщики»: загрузка прайса → ИИ (заглушка AI_FAKE) → проверка (есть на сайте / новый) →
сохранение на лист «Цены поставщиков», новые товары во «Товарах» с пометкой поставщика, поиск по всем прайсам, удаление, телефон.
Сервер: AI_FAKE=/tmp/claude-0/vp-ai.json PORT=8787 node test/server.js"""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
B='http://localhost:8787'
def srv(js): return urllib.request.urlopen(urllib.request.Request(B+'/eval', data=js.encode(), method='POST')).read().decode()
def dump():
    d=json.loads(urllib.request.urlopen(B+'/dump').read().decode()); t=d.get('Цены поставщиков',[[]]); h=t[0] if t else []
    return {'vprices':[dict(zip(['date','vendor','name','unit','price','productName','id','listId','productId'],r)) for r in t[1:] if len(r)>6 and r[6]]}
F='/tmp/claude-0/rosprodukt.txt'; open(F,'w').write('Наименование;Ед;Цена\nМанго Таиланд;кг;420\n')
async def main():
    srv("PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        pname=await pg.evaluate("__fd.D().products[0].name")
        json.dump({"supplier":"ООО Роспродукт","date":"09.11.2026","items":[[pname,"кг",95.5],["Манго Таиланд","кг",420],["Лук без цены","кг",0]]}, open('/tmp/claude-0/vp-ai.json','w'), ensure_ascii=False)
        await pg.click('nav.tabs [data-tab="suppliers"]'); await pg.wait_for_selector('#vp-card:not([hidden]) .vph', timeout=8000); await pg.wait_for_timeout(600)
        ok('Пока нет ни одного прайса' in await pg.inner_text('#vp-card'), 'пустой блок с подсказкой')
        await pg.set_input_files('#vp-file', F); await pg.wait_for_selector('#vp-card .vpuph', timeout=15000)
        t=await pg.inner_text('#vp-card')
        ok('2 позиции' in t, f'прочитано 2 позиции (без строки без цены)')
        ok(await pg.input_value('#vp-vendor')=='ООО Роспродукт' and await pg.input_value('#vp-date')=='2026-11-09', 'поставщик и дата из прайса')
        ok('есть на сайте' in t and 'новый товар' in t, 'видно, что уже есть, а что новое')
        await pg.click('#vp-card [data-vpf="new"]'); await pg.wait_for_timeout(200); ok(await pg.locator('#vp-card .vpu').count()==1, 'фильтр «Новые товары»')
        await pg.click('#vp-card [data-vpf="all"]'); await pg.wait_for_timeout(200)
        await pg.fill('#vp-vendor','Роспродукт'); await pg.click('#vp-card [data-vp="save"]')
        await pg.wait_for_selector('#vp-card .vpl', timeout=10000); await pg.wait_for_timeout(1500)
        ok(await pg.evaluate("__fd.D().products.some(p=>p.name==='Манго Таиланд')"), 'новый товар создан')
        rows=dump().get('vprices',[])
        ok(len(rows)==2 and all(r['vendor']=='Роспродукт' and r['date']=='2026-11-09' for r in rows), f'в таблице 2 позиции с пометкой поставщика и даты: {[(r["name"],r["price"]) for r in rows]}')
        ok('прайс от 09.11.2026' in await pg.inner_text('#vp-card .vpl'), 'карточка прайса «Роспродукт · прайс от 09.11.2026»')
        await pg.fill('#vp-q','манго'); await pg.wait_for_timeout(250); t=await pg.inner_text('#vp-card')
        ok('Манго Таиланд' in t and '420' in t and await pg.locator('#vp-card .vpr.best').count()>=1, 'поиск по всем прайсам')
        await pg.fill('#vp-q',''); await pg.wait_for_timeout(200)
        await pg.click('nav.tabs [data-tab="products"]'); await pg.wait_for_timeout(800)
        ok('Роспродукт 420' in await pg.inner_text('#tab-products'), 'во «Товарах» видно цену поставщика')
        await pg.click('nav.tabs [data-tab="suppliers"]'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#vp-card .vpl.open .vpr').count()==2, 'новый прайс сразу раскрыт, внутри позиции')
        await pg.click('#vp-card .vplh'); await pg.wait_for_timeout(450); ok(await pg.locator('#vp-card .vpl.open').count()==0, 'сворачивается')
        await pg.click('#vp-card .vplh'); await pg.wait_for_timeout(450)
        await pg.click('#vp-card [data-vp="del"]'); await pg.click('#vp-card [data-vp="del"]'); await pg.wait_for_timeout(1500)
        ok(len(dump().get('vprices',[]))==0 and await pg.locator('#vp-card .vpl').count()==0, 'прайс удаляется в два нажатия')
        ok(await pg.evaluate("__fd.D().products.some(p=>p.name==='Манго Таиланд')"), 'товар во «Товарах» остался')
        ok(not errs, f'без ошибок {errs[:2]}'); await pg.close()
        for W in (390,):
            pg=await b.new_page(viewport={'width':W,'height':800}); await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("location.hash='#postavshchiki'"); await pg.wait_for_timeout(1200)
            await pg.set_input_files('#vp-file', F); await pg.wait_for_selector('#vp-card .vpuph', timeout=15000)
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: без прокрутки вбок')
            await pg.close()
        pg=await b.new_page(); await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Гриша"]'); await pg.fill('#fd-pass','3333'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2000)
        r=await pg.evaluate("fetch(location.origin+'/',{method:'POST',body:JSON.stringify({key:'3333',user:'Гриша',action:'vprices',op:'list'})}).then(r=>r.text()).catch(e=>String(e))")
        ok('forbidden' in r or 'error' in r, f'водителю прайсы недоступны: {r[:80]}')

        # ---- таблица без ИИ: прайс как у поставщиков (шапка, «Номенклатура | Цена с НДС | Валюта | Ед-ца», разделы, «цена по запросу») ----
        import openpyxl
        X=os.environ.get('XLSXJS','/tmp/xlsx/package/dist/xlsx.full.min.js')
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=X, content_type='application/javascript'))
        await pg.goto(B+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.click('nav.tabs [data-tab="suppliers"]'); await pg.wait_for_selector('#vp-card .vph', timeout=8000)
        wb=openpyxl.Workbook(); ws=wb.active
        for r in [['Прайс-лист на 9 ноября 2026\xa0г.',None,None,None,None,'менеджер\nООО «ТестПродукт»\nТел'],['Номенклатура','Цена с НДС','Валюта','Ед-ца измерения','Бланк заказа'],
                  ['Маслины бренды'],['Маслины Тест б/к 2950 г х 6 ж/б',706.2,'руб.','шт.'],['ОВОЩИ:'],['Тыква кг ком','*цена по запросу',None,'кг.'],['Морковь мытая',55.5,'руб.','кг.']]: ws.append(r)
        T='/tmp/claude-0/vp-table.xlsx'; wb.save(T)
        await pg.set_input_files('#vp-file', T); await pg.wait_for_selector('#vp-card .vpuph', timeout=15000); t=await pg.inner_text('#vp-card')
        ok('2 позиции' in t and 'без ИИ' in t and 'без цены пропущено: 1' in t and 'с НДС' in t, f'таблица поставщика читается без ИИ: {t[:220]}')
        ok(await pg.input_value('#vp-vendor')=='ТестПродукт' and await pg.input_value('#vp-date')=='2026-11-09', 'поставщик и дата из шапки таблицы')
        ok('Маслины бренды' in t and 'ОВОЩИ' in t, 'разделы стали категориями')
        await pg.click('#vp-card [data-vp="cancel"]'); await pg.wait_for_timeout(200)
        async with pg.expect_download() as dl: await pg.click('#vp-card [data-vp="tpl"]')
        D2='/tmp/claude-0/vp-tpl.xlsx'; await (await dl.value).save_as(D2)
        wb=openpyxl.load_workbook(D2); ws=wb.active; hr=[i for i,r in enumerate(ws.iter_rows(values_only=True),1) if r and r[0]=='Наименование'][0]
        ok(ws.cell(hr,3).value=='Цена, ₽', 'шаблон скачивается: «Наименование | Ед. | Цена, ₽ | Категория»')
        ws.cell(4,2).value='Овощебаза'; ws.cell(5,2).value='12.11.2026'; ws.cell(6,2).value='без НДС'
        for i,(n,u,pr,c) in enumerate([('Капуста белокочанная','кг',32,'Овощи'),('Лимоны','кг',180.5,'Фрукты'),('Пустая без цены','кг',None,'')]): ws.cell(hr+1+i,1).value=n; ws.cell(hr+1+i,2).value=u; ws.cell(hr+1+i,3).value=pr; ws.cell(hr+1+i,4).value=c
        wb.save(D2)
        await pg.set_input_files('#vp-file', D2); await pg.wait_for_selector('#vp-card .vpuph', timeout=15000); t=await pg.inner_text('#vp-card')
        ok('2 позиции' in t and 'по шаблону' in t and 'без НДС' in t, f'заполненный шаблон читается идеально: {t[-700:]}')
        ok(await pg.input_value('#vp-vendor')=='Овощебаза' and await pg.input_value('#vp-date')=='2026-11-12', 'поставщик и дата из шаблона')
        await pg.click('#vp-card [data-vp="save"]'); await pg.wait_for_selector('#vp-card .vpl', timeout=10000); await pg.wait_for_timeout(800)
        rows=json.loads(urllib.request.urlopen(B+'/dump').read().decode()).get('Цены поставщиков',[])
        ok(any('Фрукты' in str(r) and 'без НДС' in str(r) for r in rows), 'категория и НДС сохранены в примечании')
        ok(not errs, f'без ошибок {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
