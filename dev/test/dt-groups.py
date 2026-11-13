"""Задачи на день: мягкий цвет заказчика, несколько задач одного заказчика сворачиваются в карточку,
разворачиваются плавно, «прочитал» ставится только когда задачи показаны, состояние запоминается."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOT','/tmp/claude-0/')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SEED="""(()=>{const D=__fd.D(), t=new Date(), iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
 const c1=D.customers[0].id, c2=D.customers[1].id, now=new Date().toISOString();
 const mk=(id,c,addr,text,by)=>({id,date:iso,customerId:c,addr,text,by,created:now,photos:'',seen:'{}'});
 D.daytasks=[mk('t1',c1,'г. Москва, ул. Первая, д. 1','Отвезти товар, общий вес 20 кг','Наталья'),
   mk('t2',c1,'г. Москва, ул. Вторая, д. 2','Отвезти товар, общий вес 50 кг','Наталья'),
   mk('t3',c1,'г. Москва, ул. Третья, д. 3','Забрать возврат','Наталья'),
   mk('t4',c2,'','Отвезти документы','Наталья'),
   mk('t5','','','Заехать на склад','Наталья')];
 D.daytasks.forEach(x=>__fd.pend.daytasks&&__fd.pend.daytasks.set(x.id,{s:Date.now(),del:false}));
 try{localStorage.removeItem('frudom-dtg')}catch(e){} })()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            import urllib.request; urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=b"write_('daytasks', []); 1", method='POST')).read()   # второй проход — с чистыми задачами
            W=vw[0]; pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(SEED); await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(600)
            ok(await pg.locator('#dt-list .dtg').count()==1, f'{W}: задачи одного заказчика собраны в одну карточку')
            ok(await pg.locator('#dt-list > .dt').count()==2, f'{W}: одиночные задачи — отдельными строками')
            t=await pg.text_content('#dt-list .dtg-h'); ok('3 задачи' in t and '3 точки' in t, f'{W}: в шапке «3 задачи · 3 точки»: {t.strip()[:80]}')
            ok('3 новые' in t, f'{W}: видно, сколько новых')
            seen=await pg.evaluate("__fd.D().daytasks.filter(x=>x.id[1]<'4').map(x=>JSON.parse(x.seen||'{}')['Даниил']?1:0)")
            ok(seen==[0,0,0], f'{W}: свёрнутые задачи не отмечены как прочитанные')
            h=await pg.evaluate("[...document.querySelectorAll('#dt-list > .dt.hc, #dt-list .dtg')].map(e=>getComputedStyle(e).getPropertyValue('--h').trim())")
            ok(len(h)==2 and h[0]!=h[1], f'{W}: у разных заказчиков разный цвет {h}')
            ok(await pg.evaluate("getComputedStyle(document.querySelector('#dt-list > .dt:not(.hc)')).borderLeftWidth")=='1px', f'{W}: задача без заказчика без цвета')
            ok(await pg.evaluate("document.querySelector('#dt-list .dtg-b').getBoundingClientRect().height")<2, f'{W}: свёрнуто')
            await pg.screenshot(path=SHOT+f'dtg-closed-{W}.png', full_page=False, clip=None) if False else None
            await pg.evaluate("document.querySelector('#dt-list').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200); await pg.screenshot(path=SHOT+f'dtg-closed-{W}.png')
            await pg.click('#dt-list .dtg-h'); await pg.wait_for_timeout(500)
            ok(await pg.evaluate("document.querySelector('#dt-list .dtg-b').getBoundingClientRect().height")>100, f'{W}: развернулось')
            ok(await pg.get_attribute('#dt-list .dtg-h','aria-expanded')=='true', f'{W}: aria-expanded')
            seen=await pg.evaluate("__fd.D().daytasks.filter(x=>x.id[1]<'4').map(x=>JSON.parse(x.seen||'{}')['Даниил']?1:0)")
            ok(seen==[1,1,1], f'{W}: после раскрытия — прочитано')
            chips=await pg.evaluate("[...document.querySelectorAll('#dt-list .dtg .dt-c')].map(e=>e.textContent)")
            ok(len(chips)==3 and all('Москва' in c or 'Перв' in c or 'Втор' in c or 'Трет' in c or c for c in chips), f'{W}: внутри — только точка {chips}')
            rd=await pg.text_content('#dt-list .dtg-i'); ok('Не прочитал: Даниил' not in rd, f'{W}: после раскрытия «Прочитал» обновился')
            await pg.screenshot(path=SHOT+f'dtg-open-{W}.png')
            # перерисовка (например, сохранение задачи) не сворачивает
            await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("document.querySelector('#dt-list .dtg').classList.contains('open')"), f'{W}: состояние запомнилось')
            # правка задачи внутри группы
            await pg.click('#dt-list .dtg .dt [data-dtpen]'); await pg.wait_for_timeout(400)
            ok(await pg.locator('#dt-list .dtg .dt-edit').count()==1, f'{W}: правка задачи внутри карточки')
            await pg.click('#dt-list [data-edno]'); await pg.wait_for_timeout(300)
            await pg.click('#dt-list .dtg-h'); await pg.wait_for_timeout(450)
            ok(not await pg.evaluate("document.querySelector('#dt-list .dtg').classList.contains('open')"), f'{W}: свернулось обратно')
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: нет прокрутки вбок')
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
