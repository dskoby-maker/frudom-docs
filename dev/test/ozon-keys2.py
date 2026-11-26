"""Озон: ключ API не «отключается» сам — запасная копия в Code.gs, запомненный ключ на устройстве, магазин ключа всегда в списке.
Чистый тестовый сервер. PH=1 — телефон."""
import asyncio, os, json, urllib.request, datetime, sys
from playwright.async_api import async_playwright
BASE=f"http://localhost:{os.environ.get('PORT','8787')}"; fails=[]
def ok(c,m): print(('✓ ' if c else '✗ ')+m); (None if c else fails.append(m))
def ev(code): return json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=code.encode(), method='POST')).read().decode())
P="PropertiesService.getScriptProperties()"
async def main():
    ph=os.environ.get('PH')=='1'; vw=(390,844) if ph else (1300,900); today=datetime.date.today().isoformat()
    ev("__oz="+json.dumps({'keys':{'123456':'aaaa-bbbb-cccc-dddd-eeee-ffff'},'types':{'types':[]},'days':{today:[]},'products':[]})+"; __ozCalls=[]; 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        mode={'fail':False}
        async def rt(route):
            r=route.request
            if mode['fail'] and r.method=='POST' and '"op":"keys"' in (r.post_data or ''): await route.abort(); return
            await route.continue_()
        await pg.route('**/*', rt)
        async def login():
            await pg.goto(BASE+'/page'); await pg.wait_for_timeout(1200)
            if await pg.locator('#fd-who [data-who="Даниил"]').is_visible():
                await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter')
            await pg.wait_for_timeout(2500)
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(1500)
        await login()
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(500)
        box=pg.locator('#fd-dcard [data-ozks]').first
        await box.locator('.ozkc').fill('123456'); await box.locator('.ozkk').fill('aaaa-bbbb-cccc-dddd-eeee-ffff'); await box.locator('[data-ozkey="save"]').click(); await pg.wait_for_timeout(2500)
        ok('каждые 5 минут' in await pg.inner_text('#oz .ozhead'), 'ключ подключён')
        ok(bool(ev(P+".getProperty('OZON_KEYS_BAK')")), 'в скрипте есть запасная копия ключа')
        # основное хранилище пропало — ключ берётся из копии и восстанавливается
        ev(P+".deleteProperty('OZON_KEYS'); 1")
        await login()
        ok('каждые 5 минут' in await pg.inner_text('#oz .ozhead'), 'после пропажи основного хранилища ключ на месте')
        ok(bool(ev(P+".getProperty('OZON_KEYS')")), 'основное хранилище восстановлено из копии')
        # таблица не ответила про ключи — запомненный ключ работает, «Подключите» не пишется
        mode['fail']=True; await login()
        h=await pg.inner_text('#oz .ozhead'); n=await pg.evaluate("(__oz.OZ.keys||[]).length")
        ok('Подключите' not in h and n==1, f'таблица не ответила — ключ остаётся подключённым ({n})')
        mode['fail']=False
        # список магазинов поменялся — магазин ключа возвращается
        sid=await pg.evaluate("__oz.OZ.keys[0].id")
        await pg.evaluate("__oz.setSt([{id:'other',n:'Другой'}])"); await pg.wait_for_timeout(500)
        await login()
        st=await pg.evaluate("__oz.stores()"); ok(sid in st, f'магазин ключа снова в списке ({st})')
        # «Отключить» — ключ удаляется везде
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(800)
        box=pg.locator(f'#fd-dcard [data-ozks="{sid}"]'); await box.locator('[data-ozkey="del"]').click(); await pg.wait_for_timeout(300); await box.locator('[data-ozkey="del"]').click(); await pg.wait_for_timeout(1500)
        ok(ev(P+".getProperty('OZON_KEYS')")=='{}' and ev(P+".getProperty('OZON_KEYS_BAK')")=='{}', 'отключили — ключа нет ни в основном, ни в запасном')
        await pg.keyboard.press('Escape'); await login()
        ok('Подключите' in await pg.inner_text('#oz .ozhead'), 'после отключения — «Подключите Озон API»')
        ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], 'без прокрутки вбок')
        ok(not errs, 'без ошибок '+str(errs)[:300]); await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
