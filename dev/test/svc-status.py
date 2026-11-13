"""«Данные» → «Состояние сервисов» и «Если что-то сломалось»: проверка сервисов, красная строка → «Что делать ›» открывает нужный пункт; Гриша — без банка/почты; телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=js.encode(), method='POST')).read().decode())
async def login(b, who, pw, W=1300, H=900):
    pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('https://dskoby-maker.github.io/**', lambda r: r.fulfill(status=200, body='ok'))
    await pg.route('https://frudom.ru/**', lambda r: r.abort())
    await pg.goto(BASE+'/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
async def until(pg, js, n=60):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    ev("PropertiesService.getScriptProperties().setProperty('MAIL_ACC', JSON.stringify([{id:'a1',email:'frudom.ru@mail.ru',pass:'x',at:new Date(Date.now()-600000).toISOString(),err:'auth failed'}])); PropertiesService.getScriptProperties().deleteProperty('TB_PROXY'); 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg,errs=await login(b,'Даниил','1111')
        await pg.evaluate("location.hash='#dannye'")
        ok(await until(pg,"!!document.querySelector('#sv-box .sv-sum:not(.wait)')"), 'проверка сервисов закончилась')
        t=await pg.text_content('#sv-box')
        ok(await pg.locator('.sv-r.ok:has-text("Google Диск")').count()==1, 'Google Диск — зелёный, место видно')
        for w in ['Google Таблица','Скрипт таблицы','Google Диск','Резервная копия','Сайт и приложение','frudom.ru/1c','Посредник в Яндекс Облаке','Почта · frudom.ru@mail.ru']:
            ok(w in t, 'строка: '+w)
        ok(await pg.locator('.sv-r.ok:has-text("Google Таблица")').count()==1, 'Google Таблица — зелёная')
        ok(await pg.locator('.sv-r.ok:has-text("Сайт и приложение")').count()==1, 'GitHub — зелёный')
        ok(await pg.locator('.sv-r.err:has-text("frudom.ru/1c")').count()==1, 'Тильда не открывается — красная')
        ok(await pg.locator('.sv-r.err:has-text("Почта")').count()==1, 'ошибка ящика — красная')
        ok('Не работает:' in (await pg.text_content('#sv-box .sv-sum')), 'сверху сводка «Не работает: …»')
        await pg.click('.sv-r:has-text("frudom.ru/1c") [data-svh]'); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("document.getElementById('h-tilda').open"), '«Что делать ›» открыл пункт про Тильду')
        ok('dskoby-maker.github.io/frudom-docs' in (await pg.text_content('#h-tilda')), 'в пункте — запасной адрес')
        await pg.click('#sv-again'); ok(await until(pg,"!document.querySelector('#sv-again').disabled"), '«Проверить ещё раз» работает')
        ok(not errs, 'ПК без ошибок '+str(errs[:2]))
        await pg.screenshot(path=os.environ.get('SHOTS','/tmp')+'/svc-pc.png', full_page=False)
        ph,e2=await login(b,'Даниил','1111',390,844)
        await ph.evaluate("location.hash='#dannye'"); await until(ph,"!!document.querySelector('#sv-box .sv-sum:not(.wait)')")
        ok(await ph.evaluate("document.documentElement.scrollWidth")<=390, 'телефон: без прокрутки вбок')
        await ph.locator('#sv-card').screenshot(path=os.environ.get('SHOTS','/tmp')+'/svc-ph.png')
        ok(not e2, 'телефон без ошибок '+str(e2[:2]))
        na,e3=await login(b,'Наталья','2222')
        await na.evaluate("location.hash='#dannye'"); await until(na,"!!document.querySelector('#sv-box .sv-sum:not(.wait)')")
        t=await na.text_content('#sv-box')
        ok('Посредник' in t and 'Почта' in t and 'Банк' not in t and 'ИИ' not in t, 'Наталья: почта и посредник есть, банка и ИИ нет')
        ok(not e3, 'Наталья без ошибок '+str(e3[:2]))
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
