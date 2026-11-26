"""Озон: подключённый ключ виден после перезагрузки, даже если сайт открылся сразу на вкладке «Озон» (26.11.2026)."""
import asyncio, os, json, urllib.request, datetime
from playwright.async_api import async_playwright
BASE=f"http://localhost:{os.environ.get('PORT','8787')}"; fails=[]
def ok(c,m): print(('✓ ' if c else '✗ ')+m); (None if c else fails.append(m))
def ev(code): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=code.encode(), method='POST')).read().decode()
async def main():
    ph=os.environ.get('PH')=='1'; vw=(390,844) if ph else (1300,900); today=datetime.date.today().isoformat()
    ev("__oz="+json.dumps({'keys':{'123456':'aaaa-bbbb-cccc-dddd-eeee-ffff'},'types':{'types':[]},'days':{today:[]},'products':[]})+"; __ozCalls=[]; 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(1000)
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(500)
        box=pg.locator('#fd-dcard [data-ozks]').first
        await box.locator('.ozkc').fill('123456'); await box.locator('.ozkk').fill('aaaa-bbbb-cccc-dddd-eeee-ffff'); await box.locator('[data-ozkey="save"]').click(); await pg.wait_for_timeout(2500)
        # сайт открывается сразу на «Озоне», ответ таблицы приходит позже — раньше ключ «пропадал»
        slow={'on':True}; bad={'on':False}
        async def hold(route):
            d=route.request.post_data or ''
            if bad['on'] and '"op":"keys"' in d.replace(' ',''): await route.fulfill(status=200, content_type='application/json', body='{"ok":false,"error":"Google Таблица не ответила за 45 секунд"}'); return
            if slow['on']: await asyncio.sleep(2.5)
            await route.continue_()
        await pg.route('**/exec**', hold)
        for i in range(2):
            await pg.reload(); await pg.wait_for_timeout(6000)
            if 'ozon' not in await pg.evaluate("location.hash") : await pg.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pg.wait_for_timeout(1500)
            h=await pg.inner_text('#oz .ozhead')
            ok('Подключите Озон API' not in h, f'после перезагрузки ключ виден (проход {i+1})')
            await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(1500)
            t=await pg.inner_text('#fd-dcard .ozkeys'); ok('подключён · Client-Id 123456' in t, 'в окне «Подключение» — «подключён»')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # таблица не ответила на вопрос о ключах — сайт не пишет «не подключён», а говорит, что не смог проверить, и потом проверяет заново
        slow['on']=False; bad['on']=True
        await pg.reload(); await pg.wait_for_timeout(5000)
        h=await pg.inner_text('#oz .ozhead')
        ok('Подключите Озон API' not in h and ('каждые 5 минут' in h or 'Не удалось проверить ключ' in h), f'ошибка связи — ключ остаётся подключённым (запомнен на устройстве), а не «подключите» ({h[-120:]!r})')
        bad['on']=False
        await pg.click('#oz [data-oz="keys"]'); await pg.wait_for_timeout(2000)
        t=await pg.inner_text('#fd-dcard .ozkeys'); ok('подключён · Client-Id 123456' in t, 'окно «Подключение» само проверило заново — «подключён»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        ok('Не удалось' not in await pg.inner_text('#oz .ozhead'), 'шапка обновилась')
        ok(not errs, f'без ошибок {errs[:2]}')
        await b.close()
    print('ошибок:', len(fails)); raise SystemExit(1 if fails else 0)
asyncio.run(main())
