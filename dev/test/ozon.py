"""Вкладка «Озон»: отчёт по начислениям (Excel) и Seller API (тестовый Озон в test/server.js — ctx.__oz).
Нужен тестовый сервер (node test/server.js) и настоящая xlsx: XLSXJS=путь к xlsx.full.min.js (npm pack xlsx@0.18.5).
OZXLSX=путь к настоящему отчёту из кабинета — дополнительно сверяет «Пришло на счёт» с суммой колонки «Сумма итого». PH=1 — телефон."""
import asyncio, os, json, datetime, tempfile, urllib.request
from playwright.async_api import async_playwright
import openpyxl
PORT=os.environ.get('PORT','8787'); BASE=f'http://localhost:{PORT}'
fails=[]
def ok(c, m):
    print(('✓ ' if c else '✗ ')+m)
    if not c: fails.append(m)
def ev(code):
    r=urllib.request.Request(BASE+'/eval', data=code.encode(), method='POST'); return urllib.request.urlopen(r).read().decode()
T=datetime.date.today(); D1=T.replace(day=1)
def mk_xlsx(path):
    wb=openpyxl.Workbook(); ws=wb.active; ws.title='Начисления'
    ws.append([f'Период: {D1:%d.%m.%Y}-{T:%d.%m.%Y}'])
    ws.append(['ID начисления','Дата начисления','Группа услуг','Тип начисления','Артикул','SKU','Название товара','Количество','Цена продавца','Дата принятия заказа в обработку или оказания услуги','Платформа продажи','Схема работы','Вознаграждение Ozon, %','Индекс локализации, %','Среднее время доставки, часы','Сумма итого, руб.'])
    d=datetime.datetime(D1.year,D1.month,D1.day)
    rows=[('0001-0001-1','Продажи','Выручка','смесь','111','Ореховая смесь 800 г',1,1000,'FBO',700),
          ('0001-0001-1','Продажи','Баллы за скидки','смесь','111','Ореховая смесь 800 г',1,1000,'FBO',300),
          ('0001-0001-1','Вознаграждение Ozon','Вознаграждение за продажу','смесь','111','Ореховая смесь 800 г',1,1000,'FBO',-400),
          ('0001-0001-1','Услуги доставки','Логистика','смесь','111','Ореховая смесь 800 г',1,1000,'FBO',-130),
          ('0001-0001','Услуги партнёров','Эквайринг','смесь','111','Ореховая смесь 800 г',1,0,'',-12),
          ('0002-0001-1','Продажи','Выручка','курага','222','Курага 1 кг',2,900,'RFBS',1800),
          ('0002-0001-1','Вознаграждение Ozon','Вознаграждение за продажу','курага','222','Курага 1 кг',2,900,'RFBS',-54),
          ('','Услуги FBO','Размещение на складе','','','',0,0,'',-300)]
    for r in rows: ws.append([r[0],d,r[1],r[2],r[3],r[4],r[5],r[6],r[7],d,'Ozon',r[8],0,None,None,r[9]])
    wb.save(path); return sum(r[9] for r in rows)
async def main():
    ph=os.environ.get('PH')=='1'; vw=(390,844) if ph else (1300,900)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=os.environ['XLSXJS']))
        await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon'); localStorage.removeItem('frudom-oz-ui')}catch(e){}")
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(800)
        ok(await pg.locator('#oz .ozhello').count()==1, 'пусто — подсказка «как загрузить»')
        # --- отчёт Excel ---
        f=tempfile.mktemp(suffix='.xlsx'); tot=mk_xlsx(f)
        await pg.set_input_files('#oz-file', f); await pg.wait_for_timeout(800)
        ok(await pg.locator('#fd-dcard .ozpick').count()==0, 'один магазин — не спрашивает, какой'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#oz .ozst').count()==0, 'один магазин — без выбора магазина')
        txt=lambda k: pg.locator(f'#oz [data-ozk="{k}"] b').inner_text()
        num=lambda s: float(s.replace(' ','').replace(' ','').replace('₽','').replace('−','-').replace(',','.'))
        ok(num(await txt('tot'))==round(tot), f'«Пришло на счёт» = сумме отчёта ({tot})')
        ok(num(await txt('sales'))==2800, 'продажи = выручка + баллы (2800)')
        ok(num(await txt('tax'))==-round(tot*0.08), 'налог 8% с того, что пришло')
        ok(await pg.locator('#oz .ozr[data-ozp]').count()==2, 'два товара в таблице')
        ok(await pg.locator('#oz .ozmiss').count()==1, 'плашка «впишите себестоимость»')
        # себестоимость
        inp=pg.locator('#oz input[data-ozc="смесь"]'); await inp.fill('400'); await inp.press('Enter'); await pg.wait_for_timeout(500)
        inp=pg.locator('#oz input[data-ozc="курага"]'); await inp.fill('300'); await inp.press('Tab'); await pg.wait_for_timeout(600)
        cost=400+600; prof=round(tot-tot*0.08-cost)
        ok(num(await txt('cost'))==-cost, 'закупка = кол-во × себестоимость (1000)')
        ok(num(await txt('prof'))==prof, f'чистая прибыль = пришло − налог − закупка ({prof})')
        ok(await pg.locator('#oz .ozmiss').count()==0, 'плашка пропала, когда все цены вписаны')
        prefs=await pg.evaluate("__oz.prefs().ozCost"); ok(prefs.get('смесь')==400, 'себестоимость в личных настройках')
        # провалиться и вернуться
        await pg.click('#oz [data-ozk="prof"]'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#fd-dcard .ozd-r[data-ozp]').count()==2, 'окно прибыли — по товарам')
        await pg.click('#fd-dcard .ozd-r[data-ozp="смесь"]'); await pg.wait_for_timeout(600)
        ok('Ореховая смесь' in await pg.locator('#fd-dcard h3').inner_text(), 'окно товара')
        ok(await pg.locator('#fd-dcard .ozd-r.static').count()>=5, 'в окне товара — из чего сложилось')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
        ok('Чистая прибыль' in await pg.locator('#fd-dcard h3').inner_text(), 'Esc — назад к окну прибыли')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.click('#oz [data-ozk="held"]'); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-ozt="Размещение на складе"]'); await pg.wait_for_timeout(500)
        ok('без товара' in (await pg.locator('#fd-dcard .ozd').inner_text()).lower(), 'тип удержания — «без товара — на весь магазин»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # схема
        await pg.click('#oz [data-ozsch="FBO"]'); await pg.wait_for_timeout(400)
        ok(await pg.locator('#oz .ozr[data-ozp]').count()==1, 'фильтр FBO — один товар')
        ok(num(await txt('tot'))==round(700+300-400-130-12), 'FBO: эквайринг привязан к заказу FBO, общие расходы не считаются')
        await pg.click('#oz [data-ozsch="all"]'); await pg.wait_for_timeout(300)
        # разложить общие
        await pg.check('#oz-al'); await pg.wait_for_timeout(400)
        ok(await pg.locator('#oz .ozr[data-ozp] small:has-text("общие")').count()==2, 'общие расходы разложены по товарам')
        await pg.uncheck('#oz-al'); await pg.wait_for_timeout(300)
        # --- Seller API ---
        today=T.isoformat()
        acc=[{'accrual_id':1,'accrued_category':'POSTING','date':today,'unit_number':'9001-0001-1','total_amount':{'amount':455.5,'currency_code':'RUB'},
              'posting':{'delivery_schema':'FBO','products':[{'sku':111,'offer_id':'смесь','name':'Ореховая смесь 800 г','quantity':1,'seller_price':{'amount':1019},'commission':{'amount':-408},'delivery':{'services':[{'type_id':'LastMile','accrued':{'amount':-132}}]}}]}},
             {'accrual_id':2,'accrued_category':'ITEM','date':today,'unit_number':'9001-0001','total_amount':{'amount':-12},'item':{'sku':111},'item_fees':{'fees':[{'fees':[{'type_id':'Acquiring','accrued':{'amount':-12}}]}]}},
             {'accrual_id':3,'accrued_category':'POSTING','date':today,'unit_number':'9002-0001-1','total_amount':{'amount':800},'posting':{'delivery_schema':'RFBS','products':[{'sku':333,'quantity':2,'seller_price':{'amount':450}}]}},
             {'accrual_id':4,'accrued_category':'NON_ITEM','date':today,'unit_number':'','total_amount':{'amount':-2736},'non_item_fee':{'type_id':'Storage','accrued':{'amount':-2736}}}]
        api_tot=455.5-12+800-2736
        ev("__oz="+json.dumps({'keys':{'123456':'aaaa-bbbb-cccc-dddd-eeee-ffff'},'types':{'types':[{'id':'Storage','name':'Размещение товаров на складах'}]},'days':{today:acc},'products':[{'sku':333,'offer_id':'финики','name':'Финики 1 кг'}],'page':2}, ensure_ascii=False)+"; __ozCalls=[]; 1")
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(500)
        box=pg.locator('#fd-dcard [data-ozks="fd"]')
        await box.locator('.ozkc').fill('123456'); await box.locator('.ozkk').fill('wrong-key-0000000000000000')
        await box.locator('[data-ozkey="save"]').click(); await pg.wait_for_timeout(800)
        ok(await pg.locator('#fd-toasts, .toast').filter(has_text='не принял').count()>0 or 'не принял' in await pg.content(), 'неверный ключ — понятная ошибка')
        await box.locator('.ozkk').fill('aaaa-bbbb-cccc-dddd-eeee-ffff'); await box.locator('[data-ozkey="save"]').click(); await pg.wait_for_timeout(2500)
        await pg.locator('#oz input[data-ozc="смесь"]').count()  # тот же магазин: Excel-дни не перезаписываются API
        await pg.evaluate("__oz.OZ.d.days.fd={}"); 
        await pg.click('#oz [data-ozper="m0"]'); await pg.wait_for_timeout(2500)
        ok(abs(num(await txt('tot'))-round(api_tot))<=1, f'Озон API: «Пришло» = сумме начислений ({api_tot})')
        names=await pg.locator('#oz .ozr[data-ozp] .ozn b').all_inner_texts()
        ok('Финики 1 кг' in names, 'товар только с SKU — название и артикул подтянуты из Озона')
        ok(await pg.locator('#oz .ozr[data-ozp="финики"]').count()==1, 'SKU превратился в артикул (себестоимость общая с отчётом)')
        q=await pg.locator('#oz .ozr[data-ozp="смесь"] [data-l="Продано"] b').inner_text(); ok(q=='1 шт', 'API: продано 1 шт смеси')
        calls=json.loads(json.loads(ev("JSON.stringify(__ozCalls)"))); bd=[c for c in calls if 'by-day' in c['path']]
        ok(any(c['b'].get('last_id') for c in bd), 'по страницам: второй запрос с last_id')
        await pg.click('#oz [data-ozk="held"]'); await pg.wait_for_timeout(400)
        ok('Размещение товаров на складах' in await pg.locator('#fd-dcard').inner_text(), 'название вида начисления — из справочника Озона')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        n0=len(bd); await pg.evaluate("document.querySelector('nav.tabs button[data-tab=doc]').click()"); await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(1200)
        bd2=[c for c in json.loads(json.loads(ev("JSON.stringify(__ozCalls)"))) if 'by-day' in c['path']]
        ok(len(bd2)==n0, 'повторный заход в течение 10 минут — Озон не дёргается')
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'нет прокрутки вбок ({sw})')
        # настоящий отчёт
        if os.environ.get('OZXLSX'):
            await pg.set_input_files('#oz-file', os.environ['OZXLSX']); await pg.wait_for_timeout(2500)
            wb=openpyxl.load_workbook(os.environ['OZXLSX'], read_only=True); ws=wb.worksheets[0]; s=0
            for i,r in enumerate(ws.iter_rows(values_only=True)):
                if i>=2 and isinstance(r[15],(int,float)): s+=r[15]
            ok(abs(num(await txt('tot'))-round(s))<=1, f'настоящий отчёт: «Пришло на счёт» = {s:.2f}')
            print('  продажи', await txt('sales'), '· удержал', await txt('held'), '· товаров', await pg.locator('#oz .ozr[data-ozp]').count())
        ok(not errs, 'без ошибок страницы '+str(errs[:2]))
        # Наталья вкладку не видит
        pg2=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); await pg2.goto(BASE+'/page')
        await pg2.click('#fd-who [data-who="Наталья"]'); await pg2.fill('#fd-pass','2222'); await pg2.click('#fd-enter'); await pg2.wait_for_timeout(2000)
        ok(await pg2.locator('nav.tabs button[data-tab="ozon"]').is_hidden(), 'Наталья: вкладки «Озон» нет')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
