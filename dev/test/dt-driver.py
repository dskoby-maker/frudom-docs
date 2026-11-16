"""Задачи на день: водитель (по умолчанию не выбран; Гриша / Саша / Достависта / Яндекс доставка), сохраняется в таблицу,
видно в задаче и в шапке карточки заказчика; Гриша только видит; на телефоне без прокрутки вбок."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
BASE=os.environ.get('BASE','http://localhost:8787'); SHOT=os.environ.get('SHOT','/tmp/claude-0/')
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=js.encode(), method='POST')).read().decode()
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SEED="""(()=>{const D=__fd.D(), t=new Date(), iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
 const c1=D.customers[0].id, now=new Date().toISOString(); const mk=(id,c,addr,text)=>({id,date:iso,customerId:c,addr,text,by:'Наталья',created:now,photos:'',seen:'{}',drv:''});
 D.daytasks=[mk('t1',c1,'г. Москва, ул. Первая, д. 1','Отвезти товар, общий вес 20 кг'), mk('t2',c1,'г. Москва, ул. Вторая, д. 2','Отвезти товар, общий вес 50 кг'), mk('t5','','','Заехать на склад')];
 D.daytasks.forEach(x=>__fd.pend.daytasks&&__fd.pend.daytasks.set(x.id,{s:Date.now(),del:false})); __fd.flush&&__fd.flush(); })()"""
async def login(b, who, pw, vw):
    pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(BASE+'/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ev("write_('daytasks', []); 1")
            pg,errs=await login(b,'Даниил','1111',vw)
            async def pick(sel, name):
                await pg.click(sel); await pg.wait_for_timeout(300); await pg.click(f'.drp .drp-o[data-drpo="{name}"]'); await pg.wait_for_timeout(500)
            await pg.evaluate(SEED); await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(1500)
            v=await pg.evaluate("document.querySelector('#dt-list > .dt [data-drvb]').dataset.v")
            ok(v=='', f'{W}: по умолчанию водитель не выбран')
            pos=await pg.evaluate("(()=>{const r=document.querySelector('#dt-list > .dt'), l=r.querySelector('.dt-drvl'), sm=r.querySelector('.dt-b > small'); return !!l && l.textContent.includes('Задача для:') && !r.querySelector('.dt-top [data-drvb]') && l.previousElementSibling===sm})()")
            ok(pos, f'{W}: кнопка водителя внизу под автором, с подписью «Задача для:»')
            await pg.click('#dt-drv'); await pg.wait_for_timeout(300)
            opts=await pg.evaluate("[...document.querySelectorAll('.drp .drp-o span')].map(o=>o.textContent.trim())")
            ok(opts[:5]==['Без водителя','Гриша','Саша','Достависта','Яндекс доставка'], f'{W}: варианты {opts}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
            await pick('#dt-list > .dt [data-drvb]', 'Достависта')
            x=await pg.evaluate("__fd.D().daytasks.find(x=>x.id==='t5').drv"); ok(x=='Достависта', f'{W}: водитель записан в задачу')
            ok(await pg.locator('#dt-list > .dt .drvb.on').count()==1, f'{W}: плашка водителя выделена')
            # группа: раскрыть и поставить одной задаче
            await pg.click('#dt-list .dtg-h'); await pg.wait_for_timeout(500)
            await pick('#dt-list .dtg .dt[data-dt="t1"] [data-drvb]', 'Саша')
            t=await pg.text_content('#dt-list .dtg-h'); ok('Саша' in t and 'не у всех' in t, f'{W}: в шапке карточки «Саша · не у всех»: {t.strip()[:90]}')
            await pick('#dt-list .dtg .dt[data-dt="t2"] [data-drvb]', 'Саша')
            t=await pg.text_content('#dt-list .dtg-h'); ok('Саша' in t and 'не у всех' not in t, f'{W}: у всех Саша')
            # своё имя вручную
            await pg.click('#dt-list > .dt [data-drvb]'); await pg.wait_for_timeout(300)
            await pg.fill('.drp .drp-add input','Пётр Иванов'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
            x=await pg.evaluate("__fd.D().daytasks.find(x=>x.id==='t5').drv"); ok(x=='Пётр Иванов', f'{W}: вписанное имя записано: {x}')
            await pg.click('#dt-drv'); await pg.wait_for_timeout(300)
            ok(await pg.locator('.drp .drp-o[data-drpo="Пётр Иванов"]').count()==1, f'{W}: вписанное имя есть в списке')
            ok(await pg.locator('.drp .drp-del[data-drpdel="Пётр Иванов"]').count()==1, f'{W}: своё имя можно убрать из списка')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250); ok(await pg.locator('.drp').count()==0, f'{W}: Esc закрывает список')
            await pick('#dt-list > .dt [data-drvb]', 'Достависта')
            # новая задача с водителем
            await pg.fill('#dt-text','Забрать возврат'); await pick('#dt-drv','Яндекс доставка'); await pg.click('#dt-add button[type=submit]'); await pg.wait_for_timeout(600)
            n=await pg.evaluate("__fd.D().daytasks.find(x=>x.text==='Забрать возврат').drv"); ok(n=='Яндекс доставка', f'{W}: новая задача с водителем')
            ok(await pg.evaluate("document.querySelector('#dt-drv').dataset.v")=='', f'{W}: после добавления выбор сброшен')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(2500)
            d=json.loads(ev("read_('daytasks').map(r=>[r.id,r.drv])")); dm=dict(d)
            ok(dm.get('t5')=='Достависта' and dm.get('t1')=='Саша', f'{W}: в таблице {d}')
            await pg.evaluate("document.querySelector('#dt-list').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(300); await pg.screenshot(path=SHOT+f'dtdrv-{W}.png')
            ok(not errs, f'{W}: без ошибок {errs}')
            await pg.close()
            # Гриша видит, но не меняет
            pg,errs=await login(b,'Гриша','3333',vw); await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(1500)
            await pg.evaluate("document.querySelectorAll('#dt-list .dtg-h').forEach(h=>h.click())"); await pg.wait_for_timeout(500)
            ok(await pg.locator('#dt-list [data-drvb]').count()==0, f'{W}: у Гриши выбора нет')
            txt=await pg.text_content('#dt-list'); ok('Достависта' in txt and 'Саша' in txt, f'{W}: Гриша видит водителей')
            ok(not errs, f'{W}: Гриша без ошибок {errs}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
