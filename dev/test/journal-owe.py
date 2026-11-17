"""«Недовезли — доложить в следующий раз»: правой кнопкой по накладной → товар и сколько; плашка в «Новом документе» и «Заявке»,
строка в маршруте и тексте для MAX на следующую поставку, «Доложили» (и у Гриши), «Отменить», окно накладной; ПК и телефон (PH=1)."""
import asyncio, os, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); TG='тел' if PH else 'ПК'
TODAY=datetime.date.today(); D0=(TODAY-datetime.timedelta(days=1)).isoformat(); D1=TODAY.isoformat()
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())")
    return ctx, pg, errs
async def ctxmenu(pg, sel):
    await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())"); el=pg.locator(sel).first
    await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(450); bx=await el.bounding_box()
    await pg.mouse.click(bx['x']+bx['width']/2, bx['y']+bx['height']/2, button='right'); await pg.wait_for_timeout(300)
OWE="(__fd.D().journal.find(j=>j.id==='{}').snap.meta.owe||[])"
async def main():
    P='ow'+('m' if PH else 'p')
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,'Даниил','1111')
        await pg.evaluate("""(()=>{const D=__fd.D(); D.journal.forEach(j=>{ if(j.date>='2000') j.date='2001-01-01'; }); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id;
          D.products.push({id:'ow-a', name:'Салат Айсберг', unit:'кг', price:'200'},{id:'ow-b', name:'Огурцы', unit:'кг', price:'90'}); })()""")
        for i,dt in enumerate([D0,D1]):
            await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}{i}', supplierId:D.suppliers[0].id, customerId:window.__cid, number:'', date:'{dt}', ship:'г. Москва, ул. Первая, д. 1', lines:[{{productId:'ow-a',qty:'10',price:'200'}},{{productId:'ow-b',qty:'5',price:'90'}}]}}); }}""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
        # 1. правой кнопкой — «Недовезли»
        await ctxmenu(pg, f'#jr-body [data-card="{P}0"]')
        await pg.locator('#fd-app .jcx-i', has_text='Недовезли').click(); await pg.wait_for_timeout(700)
        ok(await pg.locator('#fd-dcard[open].owewin').count()==1, f'{TG}: открылось окно «Недовезли»')
        ok(await pg.locator('#fd-dcard .owc').count()==2, f'{TG}: товары накладной — чипами')
        sw=await pg.evaluate("[document.documentElement.scrollWidth<=innerWidth, [...document.querySelectorAll('#fd-dcard *')].filter(e=>e.getBoundingClientRect().right>document.querySelector('#fd-dcard').getBoundingClientRect().right-1).length]"); ok(sw[0] and sw[1]==0, f'{TG}: ничего не вылезает {sw}')
        await pg.click('#owe-go'); await pg.wait_for_timeout(200); ok('Выберите' in (await pg.text_content('#owe-msg')), f'{TG}: без товара — подсказка')
        await pg.locator('#fd-dcard .owc', has_text='Айсберг').click(); await pg.wait_for_timeout(200)
        ok(await pg.input_value('#owe-u')=='кг' and await pg.evaluate("document.activeElement.id")=='owe-q', f'{TG}: выбрал товар — ед. подставилась, курсор в «Сколько»')
        await pg.keyboard.type('2'); await pg.fill('#owe-n','привезти в пятницу'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(900)
        o=await pg.evaluate(OWE.format(P+'0')); print('   ', o)
        ok(len(o)==1 and o[0]['t']=='Салат Айсберг' and o[0]['q']=='2' and o[0]['pid']=='ow-a' and not o[0].get('done'), f'{TG}: пометка записана в накладную')
        ok(await pg.locator('#fd-dcard[open]').count()==0, f'{TG}: окно закрылось')
        h=await pg.evaluate(f"(__fd.D().journal.find(j=>j.id==='{P}0').snap.meta.hist||[]).slice(-1)[0].w.join()"); ok('недовезли' in h, f'{TG}: в истории — «{h}»')
        # 2. окно накладной
        await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())")
        await pg.locator(f'#jr-body [data-card="{P}0"]').first.click(); await pg.wait_for_timeout(700)
        t=await pg.locator('#fd-dcard #dc-owe').text_content(); ok('Салат Айсберг — 2 кг' in t and 'ждёт' in t, f'{TG}: в окне накладной — пометка')
        await pg.locator('#fd-dcard [data-oweadd]').click(); await pg.wait_for_timeout(700)
        ok(await pg.locator('#fd-dcard .owe-was').count()==1, f'{TG}: «Уже записано»'); ok(await pg.locator('#fd-dcard .dc-head .dc-back').count()>=1, f'{TG}: «‹ Назад»')
        await pg.fill('#owe-t','Огурцы'); await pg.fill('#owe-q','1,5'); await pg.click('#owe-go'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#fd-dcard #dc-owe .ower').count()==2, f'{TG}: вернулись в накладную — 2 пометки')
        o=await pg.evaluate(OWE.format(P+'0')); ok(o[1]['q']=='1.5' and o[1]['u']=='кг' if False else o[1]['q'] in ('1.5','1,5'), f'{TG}: 1,5 записано ({o[1]["q"]})')
        await pg.locator('#fd-dcard [data-owedel]').nth(1).click(); await pg.wait_for_timeout(700)
        ok(len(await pg.evaluate(OWE.format(P+'0')))==1 and await pg.locator('#fd-dcard #dc-owe .ower').count()==1, f'{TG}: «×» убрал вторую пометку')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        # 3. новый документ на этого заказчика — плашка
        await pg.evaluate("""(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'owx', customerId:window.__cid, number:'', lines:[]}); })()""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(600)
        t=await pg.locator('#d-owe').text_content() if await pg.locator('#d-owe:not([hidden])').count() else ''
        ok('Салат Айсберг — 2 кг' in t and 'привезти в пятницу' in t, f'{TG}: «Новый документ» — плашка «Должны доложить»')
        # 4. маршрут на следующий день + текст для MAX
        await pg.evaluate("(()=>{const D=__fd.D(); D.dv={}; })()"); await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(800)
        await pg.evaluate("(()=>{ if(!document.querySelector('#dv-card.open')) document.querySelector('#dv-h').click(); document.querySelectorAll('.dvg [data-dvgt]').forEach(b=>{ if(b.getAttribute('aria-expanded')!=='true') b.click(); }); })()"); await pg.wait_for_timeout(600)
        ok(await pg.locator('#dv-body .dvowe').count()==1, f'{TG}: в маршруте на сегодня — «Доложить»')
        t=await pg.input_value('#dv-text'); ok('+ Доложить (недовезли' in t and 'Салат Айсберг — 2 кг' in t, f'{TG}: строка в тексте для MAX')
        await pg.evaluate("(()=>{ const s=__fd.D(); })()")
        ok(errs==[], f'{TG}: ошибок нет {errs[:2]}')
        await pg.wait_for_timeout(1500)
        # 5. Гриша отмечает «Доложили» в маршруте
        ctx2,pg2,errs2=await login(b,'Гриша','3333')
        await pg2.evaluate(TAB+"('calendar')"); await pg2.wait_for_timeout(900)
        await pg2.evaluate("(()=>{ if(!document.querySelector('#dv-card.open')) document.querySelector('#dv-h').click(); document.querySelectorAll('.dvg [data-dvgt]').forEach(b=>{ if(b.getAttribute('aria-expanded')!=='true') b.click(); }); })()"); await pg2.wait_for_timeout(600)
        n=await pg2.locator('#dv-body .dvowe [data-owedone]').count(); ok(n==1, f'{TG}: Гриша видит «Доложили» ({n})')
        if n:
            await pg2.locator('#dv-body .dvowe [data-owedone]').first.click(); await pg2.wait_for_timeout(2500)
            ok(await pg2.locator('#dv-body .dvowe').count()==0, f'{TG}: после «Доложили» строка ушла')
            srv=await pg2.evaluate(f"fetch('/dump').then(r=>r.json()).then(d=>d['Журнал'].filter(r=>r[6]==='{P}0').map(r=>JSON.parse(r[9]).meta.owe))")
            ok(srv and srv[0] and srv[0][0].get('done',{}).get('by')=='Гриша', f'{TG}: в таблице — доложил Гриша')
            await pg2.locator('#fd-toasts .ta', has_text='Отменить').last.click(); await pg2.wait_for_timeout(1200)
            ok(await pg2.locator('#dv-body .dvowe').count()==1, f'{TG}: «Отменить» вернул пометку')
        ok(errs2==[], f'{TG}: у Гриши ошибок нет {errs2[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок'); raise SystemExit(1 if fails else 0)
asyncio.run(main())
