"""Черновики: незаконченный документ сохраняется сам (на устройстве и в листе «Черновики»), переживает закрытие страницы,
«Очистить форму» не теряет работу, «Продолжить» с того же места, кто начал / кто менял, удаление в два нажатия,
документ в журнале — черновик исчезает, другой сотрудник видит и продолжает, водитель видит только свои,
заявка, закреплённая строка над документами из файлов, старый скрипт — только на устройстве. Телефон — PH=1."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.loads(urllib.request.urlopen('http://localhost:8787/dump').read().decode())
K=['updated','kind','title','sum','byName','lastBy','created','id','data']
def srv():
    R=dump().get('Черновики') or []
    return [dict(zip(K,r)) for r in R[1:] if len(r)>7 and r[7]]
VW=(390,844) if os.environ.get('PH')=='1' else (1300,900); W=VW[0]
TAB="(t=>document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click())"
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def fill(pg, q):
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(200)
    await pg.evaluate("(q)=>{const D=__fd.D(); const c=D.customers.find(c=>!c.priv && /Звенигород/.test(c.name))||D.customers[1]; D.draft.customerId=c.id; D.draft.lines=[{productId:D.products[0].id,qty:q,price:'100'},{productId:D.products[1].id,qty:'2',price:'50'}]; }", q)
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300)
    await pg.locator('#tab-doc .dmk').click(position={'x':5,'y':5}); await pg.wait_for_timeout(2600)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,'Даниил','1111')
        ok(await pg.locator('#tab-doc .drcard').is_hidden(), f'{W}: пока черновиков нет — блока нет')
        await fill(pg,'7')
        D1=await pg.evaluate("__fd.D().drafts.map(r=>[r.id,r.kind,r.byName])")
        ok(len(D1)==1 and D1[0][1]=='doc' and D1[0][2]=='Даниил', f'{W}: документ сохранился в черновики сам: {D1}')
        S=srv(); ok(len(S)==1 and S[0]['byName']=='Даниил' and 'qty' in S[0]['data'], f'{W}: черновик ушёл в лист «Черновики»')
        did=await pg.evaluate("__fd.D().draft.id")
        # закрыли страницу и открыли снова
        await pg.reload(); await pg.wait_for_timeout(3000); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(500)
        ok(await pg.locator('#tab-doc .drcard').is_visible() and 'сейчас в форме' in (await pg.inner_text('#tab-doc .drcard .drlist')).replace(' ',' ') if not await pg.locator('#tab-doc .drcard.folded').count() else await pg.locator('#tab-doc .drcard').is_visible(), f'{W}: после перезагрузки блок «Черновики» на месте')
        # «Очистить форму» — работа остаётся в черновиках
        await pg.click('#d-new'); await pg.click('#d-new'); await pg.wait_for_timeout(600)
        ok(await pg.evaluate("__fd.D().draft.id")!=did and await pg.evaluate(f"__fd.D().drafts.some(r=>r.id==='d-{did}')"), f'{W}: «Очистить форму» — прежний документ остался в черновиках')
        ok('остался в «Черновиках»' in await pg.inner_text('#fd-toasts'), f'{W}: сказано, что документ в черновиках')
        # раскрыть, посмотреть, продолжить
        if await pg.locator('#tab-doc .drcard.folded').count(): await pg.click('#tab-doc .drcard [data-drfold]'); await pg.wait_for_timeout(400)
        row=pg.locator(f'#tab-doc .drrow[data-drid="d-{did}"]'); await row.locator('[data-drtog]').click(); await pg.wait_for_timeout(450)
        det=await row.inner_text(); ok('Даниил' in det and 'Начал' in det, f'{W}: видно, кто начал документ')
        await row.locator('[data-drgo]').click(); await pg.wait_for_timeout(700)
        st=await pg.evaluate("(()=>{const d=__fd.D().draft; return [d.id, d.lines.map(l=>l.qty)]})()")
        ok(st[0]==did and st[1][:1]==['7'], f'{W}: «Продолжить» вернул документ с того же места: {st}')
        # второй сотрудник видит и продолжает; водитель — не видит
        ctx2,pg2,errs2=await login(b,'Наталья','2222'); await pg2.evaluate(TAB+"('doc')"); await pg2.wait_for_timeout(1500)
        await pg2.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg2.wait_for_timeout(1500)
        L2=await pg2.evaluate("__fd.D().drafts.map(r=>[r.id,r.byName])")
        ok([f'd-{did}','Даниил'] in L2, f'{W}: Наталья видит черновик Даниила: {L2}')
        if await pg2.locator('#tab-doc .drcard.folded').count(): await pg2.click('#tab-doc .drcard [data-drfold]'); await pg2.wait_for_timeout(400)
        r2=pg2.locator(f'#tab-doc .drrow[data-drid="d-{did}"]'); await r2.locator('[data-drtog]').click(); await pg2.wait_for_timeout(400); await r2.locator('[data-drgo]').click(); await pg2.wait_for_timeout(500)
        await pg2.evaluate("(()=>{const D=__fd.D(); D.draft.lines[0].qty='9';})()"); await pg2.locator('#tab-doc .dmk').click(position={'x':5,'y':5}); await pg2.wait_for_timeout(2800)
        S=[x for x in srv() if x['id']==f'd-{did}']; ok(S and S[0]['byName']=='Даниил' and S[0]['lastBy']=='Наталья', f'{W}: в таблице — начал Даниил, менял(а) Наталья')
        ctx3,pg3,errs3=await login(b,'Гриша','3333'); await pg3.wait_for_timeout(1500); await pg3.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); await pg3.wait_for_timeout(1500)
        ok(not await pg3.evaluate(f"__fd.D().drafts.some(r=>r.id==='d-{did}')"), f'{W}: водитель не видит чужие черновики')
        await ctx3.close()
        # Наталья сохраняет в журнал — черновик исчезает везде
        await pg2.click('#d-save'); await pg2.wait_for_timeout(3500)
        ok(not await pg2.evaluate(f"__fd.D().drafts.some(r=>r.id==='d-{did}')") and not any(x['id']==f'd-{did}' for x in srv()), f'{W}: документ в журнале — черновик удалён и в таблице')
        await ctx2.close()
        # удаление в два нажатия у второго документа
        await pg.click('#d-new'); await pg.click('#d-new'); await pg.wait_for_timeout(300); await fill(pg,'3')
        d2=await pg.evaluate("__fd.D().draft.id"); await pg.click('#d-new'); await pg.click('#d-new'); await pg.wait_for_timeout(500)
        if await pg.locator('#tab-doc .drcard.folded').count(): await pg.click('#tab-doc .drcard [data-drfold]'); await pg.wait_for_timeout(400)
        r=pg.locator(f'#tab-doc .drrow[data-drid="d-{d2}"]'); await r.locator('[data-drtog]').click(); await pg.wait_for_timeout(400)
        await r.locator('[data-drdel]').click(); await pg.wait_for_timeout(200)
        ok('Точно' in await r.locator('[data-drdel]').inner_text(), f'{W}: удаление спрашивает «Точно удалить?»')
        await r.locator('[data-drdel]').click(); await pg.wait_for_timeout(1500)
        ok(not await pg.evaluate(f"__fd.D().drafts.some(r=>r.id==='d-{d2}')") and not any(x['id']==f'd-{d2}' for x in srv()), f'{W}: черновик удалён (и в таблице)')
        # заявка
        await pg.evaluate(TAB+"('order')"); await pg.wait_for_timeout(600)
        await pg.evaluate("(()=>{const o=__fd.D().order; const D=__fd.D(); const c=D.customers.find(x=>x.id===o.customerId); o.qty={'0':{[D.products[0].id]:'5'}}; })()")
        await pg.locator('#tab-order .card').nth(1).click(position={'x':5,'y':5}); await pg.wait_for_timeout(2600)
        od=await pg.evaluate("__fd.D().drafts.filter(r=>r.kind==='order').map(r=>r.title)")
        ok(len(od)==1, f'{W}: заявка сохранилась в черновики: {od}')
        await pg.click('#o-clear'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__fd.D().drafts.filter(r=>r.kind==='order').length")==1 and not await pg.evaluate("__fd.D().order.did"), f'{W}: «Очистить» в заявке — прежняя осталась в черновиках')
        ok(await pg.locator('#tab-order .drcard').is_visible(), f'{W}: блок «Черновики» есть и в «Заявке»')
        await pg.screenshot(path=f'/tmp/drafts-{W}.png')
        ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: нет прокрутки вбок')
        ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
        await ctx.close()
        # старый скрипт таблицы: черновики только на устройстве + пояснение
        ctx4,pg4,errs4=await login(b,'Даниил','1111')
        async def old(route):
            if '"drafts"' in (route.request.post_data or ''): await route.fulfill(status=200, content_type='application/json', body='{"ok":false,"error":"unknown action"}')
            else: await route.continue_()
        await pg4.route('**/*', old)
        await fill(pg4,'4'); await pg4.wait_for_timeout(1500)
        ok(await pg4.evaluate("__fd.D().drSrv")==False and await pg4.evaluate("__fd.D().drafts.length")>=1, f'{W}: старый скрипт — черновик хранится на устройстве')
        if await pg4.locator('#tab-doc .drcard.folded').count(): await pg4.click('#tab-doc .drcard [data-drfold]'); await pg4.wait_for_timeout(400)
        ok('Обновите Code.gs' in await pg4.inner_text('#tab-doc .drcard'), f'{W}: пояснение про старый скрипт')
        ok(not errs4, f'{W}: ошибок JS нет (старый скрипт) {errs4[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
