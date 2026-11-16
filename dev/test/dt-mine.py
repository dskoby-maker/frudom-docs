"""«Мои задачи / Все задачи» в календаре — только у Гриши: «Мои» — задачи, где он водитель; выбор помнится; у Даниила переключателя нет."""
import asyncio, os, urllib.request
from playwright.async_api import async_playwright
BASE=os.environ.get('BASE','http://localhost:8787'); fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=js.encode(), method='POST')).read().decode()
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, who, pw, vw):
    pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto(BASE+'/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
SEED="""(()=>{const t=new Date(), iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'), now=new Date().toISOString();
 const mk=(id,text,drv)=>({id,date:iso,customerId:'',addr:'',text,by:'Даниил',created:now,photos:'',seen:'{}',drv,done:'',doneBy:'',doneAt:'',docs:'',docsAt:'',docsBy:'',docsRef:''});
 write_('daytasks',[mk('m1','Забрать перчатки','Гриша'),mk('m2','Купить товар Тане','Гриша'),mk('m3','Отвезти на склад','Саша'),mk('m4','Без водителя','')]); return 1; })()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg,_=await login(b,'Даниил','1111',(1300,900)); await pg.close()
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ev(SEED)
            pg,errs=await login(b,'Гриша','3333',vw); await pg.evaluate("localStorage.removeItem('frudom-dtmine:Гриша')")
            await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(1200)
            ok(await pg.is_visible('#dt-mine'), f'{W}: у Гриши есть «Мои / Все»')
            t=await pg.text_content('#dt-mine'); ok('Моизадачи2' in t.replace(' ','') and 'Всезадачи4' in t.replace(' ',''), f'{W}: счётчики {t}')
            ok(await pg.locator('#dt-list .dt').count()==4, f'{W}: по умолчанию все задачи')
            await pg.click('#dt-mine [data-dtmine="1"]'); await pg.wait_for_timeout(500)
            txt=await pg.text_content('#dt-list'); ok('Забрать перчатки' in txt and 'Купить товар Тане' in txt and 'Отвезти на склад' not in txt and 'Без водителя' not in txt, f'{W}: «Мои» — только задачи Гриши')
            ok(await pg.get_attribute('#dt-mine [data-dtmine="1"]','aria-pressed')=='true', f'{W}: кнопка «Мои» нажата')
            b1=await pg.evaluate("(()=>{const r=[...document.querySelectorAll('#dt-mine button')].map(b=>b.getBoundingClientRect()); return Math.abs(r[0].width-r[1].width)<1.5 && Math.abs(r[0].top-r[1].top)<1})()")
            ok(b1, f'{W}: кнопки ровные, одной ширины')
            await pg.reload(); await pg.wait_for_timeout(2500); await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(1000)
            ok(await pg.locator('#dt-list .dt').count()==2, f'{W}: выбор «Мои» запомнился')
            await pg.evaluate("document.querySelector('#dt-box').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(400); await pg.screenshot(path=f'/tmp/claude-0/dtmine-{W}.png')
            await pg.click('#dt-mine [data-dtmine="0"]'); await pg.wait_for_timeout(500)
            ok(await pg.locator('#dt-list .dt').count()==4, f'{W}: «Все» — снова 4')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            ok(not errs, f'{W}: Гриша без ошибок {errs}'); await pg.close()
            pg,errs=await login(b,'Даниил','1111',vw); await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(1000)
            ok(not await pg.is_visible('#dt-mine'), f'{W}: у Даниила переключателя нет')
            ok(not errs, f'{W}: Даниил без ошибок {errs}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
