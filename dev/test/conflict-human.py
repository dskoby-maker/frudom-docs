"""Окно «Эту запись уже изменили» — по-человечески: закупка накладной (цена товара 100 / 110), заказчик (адрес). Два устройства Даниила; ПК и телефон."""
import asyncio, os, re, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'; SH=os.environ.get('SHOTS','/tmp')
HTML=urllib.request.urlopen(BASE+'/page').read().decode()
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', HTML, count=1)
async def dev(b, W):
    pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
    await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
ev=lambda pg,s: pg.evaluate("s=>T.ev(s)", s)
async def settle(pg):
    for _ in range(20):
        await ev(pg,'flush()'); await pg.wait_for_timeout(120)
        if not await ev(pg,'flushing||hasPending()'): return
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in (1300, 390):
            A,ea=await dev(b,W); B,eb=await dev(b,W)
            # накладная с товаром + строка закупки
            jid=await ev(A,"""(()=>{const c=D.customers.find(x=>!x.priv), p=D.products[0], id='cf'+Date.now(); const dr=Object.assign(newDraft(D),{id, number:'1983', date:'2026-10-27', customerId:c.id, lines:[{productId:p.id, qty:15, price:1548.6}]});
              const snap=makeSnap(dr); D.journal.push({id, number:'1983', date:'2026-10-27', customerId:c.id, supplierId:dr.supplierId, sum:23229, snap}); dirty('journal',id); window.__p=p; return id;})()""")
            await settle(A)
            for pg in (A,B): await ev(pg,'loadProfit()'); await pg.wait_for_timeout(800)
            pid=await ev(A,'__p.id')
            await ev(A,f"""(()=>{{D.doccosts=D.doccosts||[]; D.doccosts.push({{id:'{jid}', number:'1983', date:'2026-10-27', customerName:'Школа', expense:'', note:'', lines:JSON.stringify({{'{pid}':'100'}}), paid:''}}); dirty('doccosts','{jid}');}})()"""); await settle(A)
            for pg in (B,): await ev(pg,'loadProfit()'); await pg.wait_for_timeout(800)
            await ev(A,f"(()=>{{const r=D.doccosts.find(x=>x.id==='{jid}'); r.lines=JSON.stringify({{'{pid}':'105'}}); dirty('doccosts','{jid}');}})()"); await settle(A)
            await ev(B,f"(()=>{{const r=D.doccosts.find(x=>x.id==='{jid}'); r.lines=JSON.stringify({{'{pid}':'110'}}); dirty('doccosts','{jid}');}})()")
            await ev(B,'flush()'); await B.wait_for_timeout(1200)
            ok(await B.locator('#fd-conflict[open]').count()==1, f'{W}: окно конфликта открылось')
            t=await B.text_content('#fd-conflict')
            ok('Эту запись уже изменили' in t and 'Закупка по накладной' in t and '№ 1983' in t, f'{W}: понятный заголовок и «Закупка по накладной № 1983»')
            ok('105,00 ₽' in t and '110,00 ₽' in t and '«'+(await ev(A,'__p.name'))+'»' in t, f'{W}: строка товара: в таблице 105, у вас 110')
            ok('"lines"' not in (await B.inner_text('#fd-conflict')), f'{W}: служебный код не виден (только в «Подробно»)')
            ok(await B.evaluate("document.querySelector('#fd-conflict').scrollWidth<=document.querySelector('#fd-conflict').clientWidth+1"), f'{W}: окно без прокрутки вбок')
            await B.locator('#fd-conflict').screenshot(path=f'{SH}/conflict{W}.png')
            await B.click('#fd-conflict [data-choice="mine"]'); await settle(B)
            ok(await B.locator('#fd-conflict[open]').count()==0 and not await ev(B,'syncBlocked'), f'{W}: «Сохранить мой вариант» закрыл окно')
            got=urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=f"(read_('doccosts').find(r=>r.id==='{jid}')||{{}}).lines".encode(), method='POST')).read().decode()
            ok('110' in got, f'{W}: в таблице записано 110 ({got})')
            ok(not ea and not eb, f'{W}: без ошибок {ea[:1]} {eb[:1]}')
            await A.close(); await B.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
