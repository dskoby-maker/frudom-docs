"""Кнопка «Задачи» справа внизу (вместо кнопки помощника) и вкладка «Помощник» в «Ещё»; утреннее уведомление о задачах
включает «Мои задачи» (Code.gs ≥ 50). Запуск: тестовый сервер (node test/server.js), лучше чистый. PH=1 — только телефон."""
import asyncio, os, json, urllib.request, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def post(d): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/exec', data=json.dumps(d).encode(), method='POST')).read().decode())
def rows(t):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
TODAY=datetime.date.today().isoformat()
async def login(b, who, pw, W):
    ctx=await b.new_context(viewport={'width':W,'height':860}, has_touch=W<500, is_mobile=W<500); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in ((390,) if os.environ.get('PH') else (1300,390)):
            ctx,pg,errs=await login(b,'Даниил','1111',W)
            await pg.evaluate(f"""(()=>{{ const L=__fd.D().daytasks=__fd.D().daytasks||[]; if(!L.some(x=>x.id==='dtfab1')) L.push({{id:'dtfab1', date:'{TODAY}', text:'Позвонить в буфет **№ 31**', by:'Даниил', created:new Date().toISOString(), customerName:''}}); }})()""")
            await pg.wait_for_selector('#tkf-fab:not([hidden])', timeout=6000)
            await pg.wait_for_timeout(1800)
            ok(await pg.locator('#ac-fab').count()==0, f'{W}: прежней кнопки помощника нет')
            n0=await pg.evaluate("+((document.querySelector('#tkf-fab b')||{}).textContent||0)"); ok(n0>=1, f'{W}: на кнопке число задач на сегодня ({n0})')
            await pg.click('#tkf-fab'); await pg.wait_for_selector('#tkf-pan:not([hidden])')
            t=await pg.text_content('#tkf-pan'); ok('В календаре на сегодня' in t and 'Позвонить в буфет № 31' in t, f'{W}: в окне задача из календаря без значков оформления')
            name=f'Проверить договор {W}'
            await pg.fill('#tkf-in', name); await pg.press('#tkf-in','Enter'); await pg.wait_for_timeout(300)
            ok(name in await pg.text_content('#tkf-pan .tkfb'), f'{W}: новая «Моя задача» видна в окне')
            n1=await pg.evaluate("+((document.querySelector('#tkf-fab b')||{}).textContent||0)"); ok(n1==n0+1, f'{W}: число на кнопке выросло ({n0}→{n1})')
            sw=await pg.evaluate('document.documentElement.scrollWidth'); ok(sw==W, f'{W}: без прокрутки вбок ({sw})')
            if W<500:
                bx=await pg.evaluate("(()=>{const p=document.getElementById('tkf-pan').getBoundingClientRect(), m=document.getElementById('mbar').getBoundingClientRect(); return [p.left, p.right, p.bottom, m.top]})()")
                ok(bx[0]>=0 and bx[1]<=W and bx[2]<=bx[3], f'телефон: окно задач в экране и над нижним меню ({bx})')
            await pg.screenshot(path=f'/tmp/claude-0/tkf-{W}.png')
            # сделано
            await pg.click(f'#tkf-pan .tkfr:has-text("{name}") input'); await pg.wait_for_timeout(500)
            ok(name not in await pg.text_content('#tkf-pan .tkfb'), f'{W}: галочка — задача ушла из окна')
            # «Все ›»
            await pg.click('#tkf-pan [data-tkfall]'); await pg.wait_for_timeout(500)
            ok(await pg.evaluate("location.hash")=='#zadachi' and await pg.locator('#tkf-pan').is_hidden(), f'{W}: «Все ›» — вкладка «Задачи», окно закрылось')
            ok(name in await pg.text_content('#tk-my'), f'{W}: задача есть во вкладке «Задачи» (сделана)')
            # помощник — вкладкой
            if W<500:
                await pg.click('#mbar [data-mt="__more"]'); await pg.wait_for_timeout(400)
                ok(await pg.locator('#ts-grid [data-tile="ai"]').count()==1, 'телефон: «Помощник» в «Ещё»')
                await pg.evaluate("document.querySelector('#ts-grid [data-tile=\"ai\"]').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}))"); await pg.evaluate("document.querySelector('#ts-grid [data-tile=\"ai\"]').dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))")
            else:
                ok(await pg.locator('#fd-app nav.tabs [data-tab="ai"]').is_visible(), 'ПК: вкладка «Помощник» в строке вкладок'); await pg.click('#fd-app nav.tabs [data-tab="ai"]')
            await pg.wait_for_selector('#ac-pan:not([hidden])', timeout=4000); ok(True, f'{W}: «Помощник» открывает окно помощника')
            ok(await pg.locator('#tkf-fab').is_hidden(), f'{W}: пока открыт помощник — кнопки «Задачи» не видно')
            await pg.click('[data-acx]'); await pg.wait_for_timeout(1800); ok(await pg.locator('#tkf-fab').is_visible(), f'{W}: закрыли помощника — кнопка «Задачи» снова видна')
            ok(not errs, f'{W}: без ошибок {errs[:2]}')
            await pg.wait_for_timeout(2500); await ctx.close()
        # сервер: утреннее уведомление — задачи календаря + «Мои задачи»
        ctx,pg,errs=await login(b,'Даниил','1111',1300)
        await pg.wait_for_selector('#tkf-fab:not([hidden])', timeout=6000); await pg.click('#tkf-fab'); await pg.fill('#tkf-in','Утренняя проверка'); await pg.press('#tkf-in','Enter'); await pg.wait_for_timeout(3500)
        await ctx.close()
        r=post({'key':'1111','user':'Даниил','action':'notes','kinds':'tasks'})
        it=[x for x in r.get('items',[]) if x.get('t')=='tasks']
        ok(it and 'Мои задачи' in it[0]['text'] and 'Утренняя проверка' in it[0]['text'], f'сервер: в утреннем уведомлении есть «Мои задачи» ({(it[0]["title"]+" | "+it[0]["text"][:120]) if it else r})')
        ctx,pg,errs=await login(b,'Наталья','2222',1300); await pg.wait_for_timeout(1800)
        ok(await pg.evaluate("(()=>{const f=document.getElementById('tkf-fab'); return !f||f.hidden})() && document.querySelector('#fd-app nav.tabs [data-tab=\"ai\"]').hidden"), 'у Натальи нет ни кнопки «Задачи», ни вкладки «Помощник»')
        await ctx.close(); await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
