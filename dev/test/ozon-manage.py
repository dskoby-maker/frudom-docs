"""Озон — управление магазином (Code.gs ≥ 57): товары (цена, остатки, архив), заказы (собрать, в доставку, отмена, этикетка), возвраты,
чаты, отзывы/вопросы, акции, аналитика, склады и рейтинг. Тестовый Озон — __oz.api {путь: ответ}. PH=1 — телефон."""
import asyncio, os, json, urllib.request, datetime
from playwright.async_api import async_playwright
BASE=f"http://localhost:{os.environ.get('PORT','8787')}"; fails=[]
def ok(c,m): print(('✓ ' if c else '✗ ')+m); (None if c else fails.append(m))
def ev(code): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=code.encode(), method='POST')).read().decode()
def evj(code): return json.loads(json.loads(ev("JSON.stringify("+code+")")))
def calls(p): return [c for c in evj("__ozCalls||[]") if c['path']==p]
async def main():
    ph=os.environ.get('PH')=='1'; vw=(390,844) if ph else (1300,900)
    now=datetime.datetime.now(datetime.UTC).replace(tzinfo=None); soon=(now+datetime.timedelta(hours=5)).isoformat()+'Z'; ago=(now-datetime.timedelta(days=1)).isoformat()+'Z'
    api={
      '/v3/product/list':{'result':{'items':[{'product_id':9001,'offer_id':'финики'},{'product_id':9002,'offer_id':'изюм'},{'product_id':9003,'offer_id':'старое','archived':True}],'total':3,'last_id':''}},
      '/v3/product/info/list':{'items':[{'id':9001,'name':'Финики 1 кг','offer_id':'финики','sku':333,'price':'500','old_price':'600','statuses':{'status_name':'Продаётся'}},
                                       {'id':9002,'name':'Изюм 500 г','offer_id':'изюм','sku':444,'price':'300','statuses':{'status_name':'Ошибка','status_failed':'x'},'errors':[{'texts':{'short_description':'Нет фото'}}]},
                                       {'id':9003,'name':'Старый товар','offer_id':'старое','sku':555,'is_archived':True}]},
      '/v4/product/info/stocks':{'items':[{'product_id':9001,'offer_id':'финики','stocks':[{'type':'fbo','present':10,'reserved':1},{'type':'rfbs','present':4,'reserved':0}]}],'cursor':''},
      '/v5/product/info/prices':{'items':[{'product_id':9001,'offer_id':'финики','price':{'price':'500','old_price':'600','min_price':'0','auto_action_enabled':'true'},'commissions':{'sales_percent_fbo':12,'sales_percent_fbs':15}}],'cursor':''},
      '/v1/product/import/prices':{'result':[{'product_id':9001,'offer_id':'финики','updated':True,'errors':[]}]},
      '/v1/warehouse/list':{'result':[{'warehouse_id':77,'name':'Склад Москва','is_rfbs':True,'status':'created'}]},
      '/v1/product/info/stocks-by-warehouse/fbs':{'result':[{'sku':333,'warehouse_id':77,'present':4,'reserved':0}]},
      '/v2/products/stocks':{'result':[{'warehouse_id':77,'product_id':9001,'offer_id':'финики','updated':True,'errors':[]}]},
      '/v1/product/archive':{'result':True}, '/v1/product/unarchive':{'result':True},
      '/v3/posting/fbs/list':{'result':{'postings':[
         {'posting_number':'111-1-1','order_number':'111-1','status':'awaiting_packaging','in_process_at':ago,'shipment_date':soon,'tpl_integration_type':'non_integrated','delivery_method':{'name':'Курьер','warehouse':'Склад Москва'},'products':[{'sku':333,'offer_id':'финики','name':'Финики 1 кг','quantity':2,'price':'500'}]},
         {'posting_number':'222-1-1','order_number':'222-1','status':'awaiting_deliver','in_process_at':ago,'shipment_date':soon,'tpl_integration_type':'non_integrated','products':[{'sku':444,'offer_id':'изюм','name':'Изюм 500 г','quantity':1,'price':'300'}]},
         {'posting_number':'333-1-1','order_number':'333-1','status':'delivered','in_process_at':ago,'products':[{'sku':333,'offer_id':'финики','name':'Финики 1 кг','quantity':1,'price':'500'}]}],'has_next':False}},
      '/v3/posting/fbs/get':{'result':{'posting_number':'111-1-1','status':'awaiting_packaging','in_process_at':ago,'shipment_date':soon,'tpl_integration_type':'non_integrated','customer':{'name':'Иван','phone':'+79990000000','address':{'city':'Москва','address_tail':'ул. Ленина, 1'}},'products':[{'sku':333,'offer_id':'финики','name':'Финики 1 кг','quantity':2,'price':'500'}],'financial_data':{'products':[{'commission_amount':150,'payout':850}]}}},
      '/v4/posting/fbs/ship':{'result':['111-1-1']}, '/v2/fbs/posting/delivering':{'result':True},
      '/v2/posting/fbs/cancel-reason/list':{'result':[{'id':352,'title':'Товар закончился','type_id':'seller','is_available_for_cancellation':True}]},
      '/v2/posting/fbs/cancel':{'result':True},
      '/v1/returns/list':{'returns':[{'id':1,'posting_number':'333-1-1','product':{'name':'Финики 1 кг','offer_id':'финики','quantity':1,'price':{'price':500}},'visual':{'status':{'display_name':'Возвращён на склад'}},'return_reason_name':'Не понравился'}],'has_next':False},
      '/v2/returns/rfbs/list':{'returns':[{'return_id':55,'posting_number':'333-1-1','product':{'name':'Финики 1 кг'},'state':{'state':'NEW','state_name':'Новая заявка'},'created_at':ago}]},
      '/v2/returns/rfbs/get':{'returns':{'posting_number':'333-1-1','product':{'name':'Финики 1 кг','offer_id':'финики','price':500},'state':{'state_name':'Новая заявка'},'client_comment':'Помятые','rejection_reason':[{'id':1,'name':'Товар в порядке'}]}},
      '/v2/returns/rfbs/verify':{'result':True},
      '/v3/chat/list':{'chats':[{'chat':{'chat_id':'c1','chat_type':'Buyer_Seller','chat_status':'Opened','created_at':ago},'unread_count':2}],'has_next':False},
      '/v3/chat/history':{'messages':[{'message_id':'1','user':{'type':'Customer'},'created_at':ago,'data':['Здравствуйте, когда отправите?']}],'has_next':False},
      '/v2/chat/read':{'result':'ok'}, '/v1/chat/send/message':{'result':'success'},
      '/v1/review/list':{'reviews':[{'id':'r1','sku':333,'text':'Очень вкусные финики','rating':5,'published_at':ago,'status':'UNPROCESSED'}],'has_next':False},
      '/v1/review/comment/create':{'comment_id':'x'},
      '/v1/question/list':{'questions':[{'id':'q1','sku':333,'text':'Есть косточки?','published_at':ago,'status':'NEW','author_name':'Анна'}]},
      '/v1/question/answer/create':{'answer_id':'a'},
      '/v1/actions':{'result':[{'id':1,'title':'Чёрная пятница','date_start':ago,'date_end':'2099-01-01T00:00:00Z','participating_products_count':1,'potential_products_count':1}]},
      '/v1/actions/products':{'result':{'products':[{'id':9001,'price':500,'action_price':290}],'total':1}},
      '/v1/actions/candidates':{'result':{'products':[{'id':9002,'price':300,'max_action_price':280}],'total':1}},
      '/v1/actions/products/activate':{'result':{'product_ids':[9002],'rejected':[]}},
      '/v1/analytics/data':{'result':{'data':[{'dimensions':[{'id':now.date().isoformat(),'name':''}],'metrics':[1500,3,100,10,50,20,0,0]}],'totals':[1500,3,100,10,50,20,0,0]}},
      '/v1/rating/summary':{'groups':[{'group_name':'Скорость','items':[{'name':'Опоздания','current_value':1.5,'past_value':2,'status':'OK','value_type':'PERCENT'}]}],'penalty_score_exceeded':False},
      '/v2/analytics/stock_on_warehouses':{'result':{'rows':[{'sku':333,'item_code':'финики','item_name':'Финики 1 кг','free_to_sell_amount':10,'warehouse_name':'Хоругвино'}]}},
    }
    oz={'keys':{'123456':'aaaa-bbbb-cccc-dddd-eeee-ffff'},'types':{'types':[]},'days':{},'api':api,'pdfPath':'/v2/posting/fbs/package-label'}
    ev("__oz="+json.dumps(oz, ensure_ascii=False)+"; __ozCalls=[]; 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or "/usr/bin/google-chrome")
        pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}, accept_downloads=True); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon')}catch(e){}")
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(800)
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(400)
        box=pg.locator('#fd-dcard [data-ozks]').first
        await box.locator('.ozkc').fill('123456'); await box.locator('.ozkk').fill('aaaa-bbbb-cccc-dddd-eeee-ffff'); await box.locator('[data-ozkey="save"]').click(); await pg.wait_for_timeout(2500)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        sh=os.environ.get('SHOT')
        async def shot(n):
            if sh: await pg.screenshot(path=f"{sh}/{n}{'-ph' if ph else ''}.png", full_page=False)
        async def view(v): await pg.click(f'#oz [data-ozv="{v}"]'); await pg.wait_for_timeout(1500); await shot(v)
        # --- товары
        await view('goods'); t=await pg.inner_text('#oz')
        ok('Финики 1 кг' in t and 'Изюм 500 г' in t and 'Старый товар' not in t, 'товары: список без архива')
        ok('14 шт' in t, 'остаток FBO + свой склад = 14 шт')
        await pg.click('#oz [data-ozmgf="arch"]'); await pg.wait_for_timeout(200); ok('Старый товар' in await pg.inner_text('#oz .ozmlist'), 'фильтр «В архиве»')
        await pg.click('#oz [data-ozmgf="err"]'); await pg.wait_for_timeout(200); ok('Изюм' in await pg.inner_text('#oz .ozmlist'), 'фильтр «С ошибками»')
        await pg.click('#oz [data-ozmgf="all"]'); await pg.wait_for_timeout(200)
        await pg.click('#oz [data-ozmp="9001"] .ozmt'); await pg.wait_for_timeout(1200)
        await shot('prod'); d=await pg.inner_text('#fd-dcard'); ok('Цена продажи' in d and 'Склад Москва' in d, 'окно товара: цена и остатки по складу')
        await pg.fill('#fd-dcard #ozm-p','550'); await pg.click('#fd-dcard [data-ozmd="price"]'); await pg.wait_for_timeout(1200)
        c=calls('/v1/product/import/prices'); ok(c and c[-1]['b']['prices'][0]['price']=='550' and c[-1]['b']['prices'][0]['old_price']=='600', f'цена ушла в Озон: 550, зачёркнутая 600 ({c[-1]["b"] if c else None})')
        await pg.fill('#fd-dcard [data-ozmwh="77"]','9'); await pg.click('#fd-dcard [data-ozmd="stock"]'); await pg.wait_for_timeout(1200)
        c=calls('/v2/products/stocks'); ok(c and c[-1]['b']['stocks'][0]=={'warehouse_id':77,'product_id':9001,'offer_id':'финики','stock':9}, 'остаток 9 шт ушёл в Озон')
        await pg.click('#fd-dcard [data-ozmd="arch"]'); await pg.wait_for_timeout(200); ok(not calls('/v1/product/archive'), 'архив — первое нажатие только переспрашивает')
        await pg.click('#fd-dcard [data-ozmd="arch"]'); await pg.wait_for_timeout(1200); ok(calls('/v1/product/archive'), 'второе нажатие — товар в архив')
        ev_=evj("readEvents_(20)"); ok(any('Цена на Озоне' in e['text'] for e in ev_) and any('Остатки на Озоне' in e['text'] for e in ev_), 'изменения записаны в «События»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # --- заказы
        await view('orders'); await pg.evaluate("document.querySelector('#oz .ozmlist').scrollIntoView()"); await shot('orders-list'); t=await pg.inner_text('#oz')
        ok('111-1-1' in t and 'Собрать' in t and '333-1-1' not in t, 'заказы: «Собрать» по умолчанию')
        await pg.click('#oz [data-ozmoa="ship"]'); await pg.wait_for_timeout(1500)
        c=calls('/v4/posting/fbs/ship'); ok(c and c[-1]['b']['posting_number']=='111-1-1' and c[-1]['b']['packages'][0]['products'][0]=={'product_id':333,'quantity':2}, 'кнопка «Собрать» — заказ собран')
        await pg.click('#oz [data-ozmof="ship"]'); await pg.wait_for_timeout(200)
        await pg.click('#oz [data-ozmoa="deliv"]'); await pg.wait_for_timeout(1500); ok(calls('/v2/fbs/posting/delivering'), '«Передал в доставку»')
        await pg.click('#oz [data-ozmof="all"]'); await pg.wait_for_timeout(200)
        await pg.click('#oz [data-ozmo="111-1-1"] .ozmt'); await pg.wait_for_timeout(1500)
        await shot('order'); d=await pg.inner_text('#fd-dcard'); ok('ул. Ленина' in d and '850' in d, 'окно заказа: адрес и «Вам перечислят»')
        await pg.click('#fd-dcard [data-ozmoa="cancel"]'); await pg.wait_for_timeout(1000)
        ok('Товар закончился' in await pg.inner_text('#fd-dcard'), 'отмена: причины из Озона')
        await pg.click('#fd-dcard [data-ozmof2="cancel"]'); await pg.wait_for_timeout(100); await pg.click('#fd-dcard [data-ozmof2="cancel"]'); await pg.wait_for_timeout(1500)
        c=calls('/v2/posting/fbs/cancel'); ok(c and c[-1]['b']['cancel_reason_id']==352, 'заказ отменён с причиной')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # этикетка (FBS без non_integrated)
        ev("__oz.api['/v3/posting/fbs/list'].result.postings[1].tpl_integration_type='ozon'; 1")
        await pg.click('#oz [data-ozm="reload"]'); await pg.wait_for_timeout(1500); await pg.click('#oz [data-ozmof="ship"]'); await pg.wait_for_timeout(200)
        async with pg.expect_download() as dl: await pg.click('#oz [data-ozmoa="label"]')
        ok((await dl.value).suggested_filename.endswith('.pdf'), 'этикетка — PDF скачивается')
        # --- возвраты
        await view('ret'); t=await pg.inner_text('#oz'); ok('Не понравился' in t and 'Новая заявка' in t, 'возвраты и заявки realFBS')
        await pg.click('#oz [data-ozmrf="55"]'); await pg.wait_for_timeout(1200); ok('Помятые' in await pg.inner_text('#fd-dcard'), 'окно заявки на возврат')
        await pg.click('#fd-dcard [data-ozmrfa="verify"]'); await pg.wait_for_timeout(1200); ok(calls('/v2/returns/rfbs/verify'), 'возврат одобрен')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # --- чаты
        await view('chat'); await pg.click('#oz [data-ozmch="c1"]'); await pg.wait_for_timeout(1200)
        await shot('chat2'); ok('когда отправите' in await pg.inner_text('#oz'), 'чат: переписка видна'); ok(calls('/v2/chat/read'), 'чат отмечен прочитанным')
        await pg.fill('#ozm-txt','Сегодня отправим'); await pg.click('#oz [data-ozm="send"]'); await pg.wait_for_timeout(1200)
        c=calls('/v1/chat/send/message'); ok(c and c[-1]['b']=={'chat_id':'c1','text':'Сегодня отправим'}, 'сообщение отправлено')
        # --- отзывы и вопросы
        await view('rev'); await pg.evaluate("document.querySelector('#oz .ozmlist').scrollIntoView()"); await shot('rev-list'); t=await pg.inner_text('#oz'); ok('Очень вкусные' in t and 'Финики 1 кг' in t, 'отзыв с названием товара')
        await pg.fill('#oz [data-ozmrt="r1"]','Спасибо!'); await pg.click('#oz [data-ozmra="rev"]'); await pg.wait_for_timeout(1200)
        c=calls('/v1/review/comment/create'); ok(c and c[-1]['b']['text']=='Спасибо!', 'ответ на отзыв')
        await pg.click('#oz [data-ozmrk="q"]'); await pg.wait_for_timeout(200); await pg.fill('#oz [data-ozmqt="q1"]','Нет, без косточек'); await pg.click('#oz [data-ozmra="q"]'); await pg.wait_for_timeout(1200)
        c=calls('/v1/question/answer/create'); ok(c and c[-1]['b']['sku']==333, 'ответ на вопрос')
        # --- акции
        await view('act'); ok('Чёрная пятница' in await pg.inner_text('#oz'), 'акции')
        await pg.click('#oz [data-ozmac="1"]'); await pg.wait_for_timeout(1500)
        d=await pg.inner_text('#fd-dcard'); ok('участвуют · 1' in d.lower() and 'можно добавить · 1' in d.lower(), 'окно акции: участвуют и можно добавить')
        await pg.click('#fd-dcard [data-ozmaa="on"]'); await pg.wait_for_timeout(1200)
        c=calls('/v1/actions/products/activate'); ok(c and c[-1]['b']['products'][0]=={'product_id':9002,'action_price':280}, 'товар добавлен в акцию по 280')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # --- аналитика, склады
        await view('an'); t=await pg.inner_text('#oz'); ok('Заказано на сумму' in t and '1\u00a0500' in t.replace(' ','\u00a0'), 'аналитика: заказано на сумму')
        await view('wh'); t=await pg.inner_text('#oz'); ok('Опоздания' in t and 'хоругвино' in t.lower() and 'Склад Москва' in t, 'склады и рейтинг')
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'без прокрутки вбок ({sw})')
        # старый скрипт
        ok(not errs, 'ошибок на странице нет: '+'; '.join(errs[:3]))
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
