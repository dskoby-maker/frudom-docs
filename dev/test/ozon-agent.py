"""Озон-помощник: сайт отправляет экономику товара, скрипт проверяет акции, предлагает / сам убирает из убыточных и добавляет в выгодные, отмена, цена одной кнопкой, расписание."""
import asyncio, os, sys, json, urllib.request, datetime
from playwright.async_api import async_playwright
BASE=f"http://localhost:{os.environ.get('PORT','8787')}"; fails=[]
def ok(c,m): print(('✓ ' if c else '✗ ')+m); (None if c else fails.append(m))
def ev(code): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=code.encode(), method='POST')).read().decode()
def evj(code): return json.loads(json.loads(ev("JSON.stringify("+code+")")))
async def main():
    ph=os.environ.get('PH')=='1'; vw=(390,844) if ph else (1300,900)
    today=datetime.date.today().isoformat()
    acc=[{'accrual_id':1,'accrued_category':'POSTING','date':today,'unit_number':'1-1','total_amount':{'amount':700},'posting':{'delivery_schema':'RFBS','products':[{'sku':333,'offer_id':'финики','quantity':2,'seller_price':{'amount':500}}]}}]
    oz={'keys':{'123456':'aaaa-bbbb-cccc-dddd-eeee-ffff'},'types':{'types':[]},'days':{today:acc},
        'products':[{'sku':333,'id':9001,'offer_id':'финики','name':'Финики 1 кг'},{'sku':444,'id':9002,'offer_id':'изюм','name':'Изюм'}],
        'actions':[{'id':1,'title':'Чёрная пятница','date_end':'2099-01-01T00:00:00Z'},{'id':2,'title':'Скидки недели','date_end':'2099-01-01T00:00:00Z'},{'id':3,'title':'Прошедшая','date_end':'2020-01-01T00:00:00Z'}],
        'aprod':{'1':[{'id':9001,'price':500,'action_price':290,'max_action_price':300}]},
        'acand':{'2':[{'id':9001,'price':500,'action_price':0,'max_action_price':420,'min_stock':0},{'id':9002,'price':300,'action_price':0,'max_action_price':280}]},
        'prices':{'финики':{'price':500,'old_price':600,'min_price':0}}}
    ev("__oz="+json.dumps(oz, ensure_ascii=False)+"; __ozCalls=[]; __trig=[]; 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon')}catch(e){}")
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("__oz.cost('финики','200')")
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(800)
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(400)
        box=pg.locator('#fd-dcard [data-ozks]').first
        ok('Admin</b>' in await pg.inner_html('#fd-dcard') or 'роль Admin' in await pg.inner_text('#fd-dcard'), 'в подключении — роль Admin для помощника')
        await box.locator('.ozkc').fill('123456'); await box.locator('.ozkk').fill('aaaa-bbbb-cccc-dddd-eeee-ffff'); await box.locator('[data-ozkey="save"]').click(); await pg.wait_for_timeout(3500)
        g=await pg.evaluate("__oz.agGuard().M['финики']")
        ok(g and g['p0']==311 and g['pt']==389, f'экономика товара: без убытка 311, цель 389 ({g})')
        await pg.evaluate("__oz.agPush()"); await pg.wait_for_timeout(800)
        st=evj("ozAgGet_().guard")
        ok(st and st['items'].get('финики',{}).get('p0')==311, 'скрипт получил экономику товара')
        await pg.evaluate("__oz.agLoad()"); await pg.wait_for_timeout(800)
        t=await pg.inner_text('#oz-ag'); ok('Помощник по Озону' in t and 'Выключен' in t, 'карточка помощника: выключен')
        await pg.click('#oz-ag [data-ozag="run"]'); await pg.wait_for_timeout(2000)
        t=await pg.inner_text('#oz-ag')
        ok('Чёрная пятница' in t and 'Скидки недели' in t and 'Изюм' not in t, 'предлагает: убрать из убыточной, добавить в выгодную; без себестоимости — не трогает')
        ok('акций 2' in t, 'прошедшие акции не считаются')
        await pg.click('#oz-ag [data-ozag="do"] >> nth=0'); await pg.wait_for_timeout(200); await pg.click('#oz-ag [data-ozag="do"] >> nth=0'); await pg.wait_for_timeout(1500)
        ok(evj("__oz.aprod['1']")==[], 'кнопка «Убрать» — товар вышел из «Чёрной пятницы» в Озоне')
        t=await pg.inner_text('#oz-ag'); ok('сделано' in t.lower() and 'убран из акции' in t.lower(), 'в «Сделано» — запись')
        await pg.click('#oz-ag [data-ozag="undo"]'); await pg.wait_for_timeout(200); await pg.click('#oz-ag [data-ozag="undo"]'); await pg.wait_for_timeout(1500)
        ok(len(evj("__oz.aprod['1']"))==1, 'отмена — товар снова в акции')
        # включаем «сам включает и выключает»
        await pg.click('#oz-ag [data-ozag="set"]'); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-ozagmode="auto"]'); await pg.wait_for_timeout(1200)
        ok('ozAgentTick' in evj("__trig"), 'расписание поставлено (каждые 6 часов)')
        ok(evj("ozAgCfg_()")['mode']=='auto', 'режим «сам» сохранён')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        ev("ozAgentTick(); 1")
        a1=evj("__oz.aprod['1']"); a2=evj("__oz.aprod['2']||[]")
        ok(a1==[] and any(x['id']==9001 and x['action_price']==420 for x in a2), f'по расписанию сам убрал из убыточной и добавил в выгодную по 420 ₽ ({a1}, {a2})')
        evs=evj("readEvents_(30)"); ok(any(e['user']=='Озон-помощник' and 'Чёрная пятница' in e['text'] for e in evs), 'в «Событиях» — записи помощника')
        # цена одной кнопкой
        await pg.evaluate("__oz.cost('финики','400')"); await pg.evaluate("document.querySelector('nav.tabs button[data-tab=journal]').click()"); await pg.wait_for_timeout(200)
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(1500)
        bt=pg.locator('#oz .ozguard [data-ozag="price"]').first
        ok(await bt.count()==1 and '699' in await bt.inner_text(), 'в «Контроль цен» — «Поставить 699 ₽»')
        await bt.click(); await pg.wait_for_timeout(200); await bt.click(); await pg.wait_for_timeout(1500)
        pr=evj("__oz.prices['финики']"); ok(pr['price']==699 and pr['old_price']==0, f'цена на Озоне поменялась ({pr})')
        lg=evj("ozAgGet_().log[0]"); ok(lg['k']=='price' and lg['prev']==500, 'в истории — старая цена для отмены')
        ok(await pg.locator('#oz-ag').count()==1, 'карточка помощника на месте')
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'нет прокрутки вбок ({sw})')
        if os.environ.get('SHOT'): await pg.locator('#oz-ag').screenshot(path=os.environ['SHOT'])
        ok(not errs, 'без ошибок '+str(errs)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
if __name__=='__main__': asyncio.run(main())
