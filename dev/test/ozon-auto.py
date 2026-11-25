"""Озон: сайт сам обновляет данные из API раз в 5 минут, пока открыт (и на другой вкладке), Excel-день, скачанный до конца дня, обновляется."""
import asyncio, os, sys, json, urllib.request, datetime
from playwright.async_api import async_playwright
BASE=f"http://localhost:{os.environ.get('PORT','8787')}"; fails=[]
def ok(c,m): print(('✓ ' if c else '✗ ')+m); (None if c else fails.append(m))
def ev(code): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=code.encode(), method='POST')).read().decode()
async def main():
    ph=os.environ.get('PH')=='1'; vw=(390,844) if ph else (1300,900)
    today=datetime.date.today().isoformat()
    acc=[{'accrual_id':1,'accrued_category':'POSTING','date':today,'unit_number':'1-1','total_amount':{'amount':500},'posting':{'delivery_schema':'RFBS','products':[{'sku':333,'offer_id':'финики','quantity':1,'seller_price':{'amount':500}}]}}]
    ev("__oz="+json.dumps({'keys':{'123456':'aaaa-bbbb-cccc-dddd-eeee-ffff'},'types':{'types':[]},'days':{today:acc},'products':[{'sku':333,'offer_id':'финики','name':'Финики 1 кг'}]}, ensure_ascii=False)+"; __ozCalls=[]; 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon')}catch(e){}")
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(1000)
        ok('Подключите Озон API' in await pg.inner_text('#oz .ozhead'), 'без ключа — подсказка подключить API')
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(500)
        box=pg.locator('#fd-dcard [data-ozks]').first
        await box.locator('.ozkc').fill('123456'); await box.locator('.ozkk').fill('aaaa-bbbb-cccc-dddd-eeee-ffff'); await box.locator('[data-ozkey="save"]').click(); await pg.wait_for_timeout(3000)
        ok('каждые 5 минут' in await pg.inner_text('#oz .ozhead'), 'в шапке — «Сам обновляется из Озона каждые 5 минут»')
        # уходим на другую вкладку, «прошло 5 минут» — тик сам забирает данные
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=journal]').click()"); await pg.wait_for_timeout(300)
        acc.append({'accrual_id':2,'accrued_category':'POSTING','date':today,'unit_number':'1-2','total_amount':{'amount':700},'posting':{'delivery_schema':'RFBS','products':[{'sku':333,'offer_id':'финики','quantity':1,'seller_price':{'amount':700}}]}})
        ev("__oz.days["+json.dumps(today)+"]="+json.dumps(acc,ensure_ascii=False)+"; __ozCalls=[]; 1")
        await pg.evaluate("__oz.auto()"); await pg.wait_for_timeout(1000)
        n=len([c for c in json.loads(json.loads(ev("JSON.stringify(__ozCalls)"))) if 'by-day' in c['path']])
        ok(n==0, f'меньше 5 минут с прошлой загрузки — Озон не дёргается ({n})')
        await pg.evaluate("(()=>{ Object.values(__oz.OZ.d.days).forEach(D=>Object.values(D).forEach(x=>x.at-=6*60e3)); __oz.OZ.at=Date.now()-6*60e3; __oz.auto(); })()"); await pg.wait_for_timeout(2500)
        n=len([c for c in json.loads(json.loads(ev("JSON.stringify(__ozCalls)"))) if 'by-day' in c['path']])
        ok(n>0, f'прошло 5 минут — сам забрал начисления, хотя открыт «Журнал» ({n} запросов)')
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(1200)
        tot=await pg.evaluate("__oz.calc().tot"); ok(abs(tot-1200)<0.5, f'новые продажи видны: к выплате {tot}')
        ok('обновлено в' in await pg.inner_text('#oz .ozhead'), 'время последнего обновления в шапке')
        # Excel за сегодня (неполный день) обновляется из API, Excel за старый день — нет
        await pg.evaluate(f"""(()=>{{const D=__oz.OZ.d.days[Object.keys(__oz.OZ.d.days)[0]]; D['{today}']={{s:'x',at:Date.now(),r:[]}}; D['2020-01-01']={{s:'x',at:Date.parse('2020-01-05'),r:[]}}; __oz.OZ.at=0;}})()""")
        ev("__ozCalls=[]; 1"); await pg.evaluate("__oz.auto()"); await pg.wait_for_timeout(2500)
        st=await pg.evaluate(f"(()=>{{const D=__oz.OZ.d.days[Object.keys(__oz.OZ.d.days)[0]]; return [D['{today}'].s, D['2020-01-01'].s];}})()")
        ok(st==['a','x'], f'сегодняшний день из Excel обновлён из API, старый день из Excel не тронут ({st})')
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'нет прокрутки вбок ({sw})')
        ok(not errs, 'без ошибок '+str(errs)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
if __name__=='__main__': asyncio.run(main())
