"""Журнал: Счёт / ТОРГ‑12 / УПД + отметки под ними, после отметки — «скачать» одним PDF. ПК и телефон (PH=1), календарь, Гриша."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'; VW=(390,800) if PH else (1300,900)
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    # PDF без сети: заглушка
    await pg.evaluate("""()=>{ window.__pdfs=[]; }""")
    return ctx,pg,errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx,pg,errs=await login(b,'Даниил','1111'); P='jk'+str(VW[0])
        await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; D.products.push({id:'jk-a', name:'Киви', unit:'кг', price:'100'});})()""")
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}d0', customerId:window.__cid, number:'', date:'2026-11-19', lines:[{{productId:'jk-a',qty:'2',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(900)
        box=pg.locator(f'#jr-body [data-jk="{P}d0"]')
        ok(await box.count()==1, 'конструктор в строке')
        L=[t.strip() for t in await box.locator('[data-p]').all_text_contents()]; ok(L in (['Счёт','ТОРГ‑12','УПД'],['Счёт','ТОРГ','УПД']), f'три кнопки {L}')
        ok(not await pg.locator(f'#jr-body tr:has([data-jk="{P}d0"]) [data-combo-j]').is_visible(), '«Счёт+ТОРГ» не видна')
        d=box.locator('.jkd'); ok(await d.evaluate("e=>getComputedStyle(e).opacity")=='0', 'значок скачивания скрыт без отметок')
        await box.evaluate("e=>e.scrollIntoView({block:'center'})")
        await box.locator('[data-jkk="invoice"]').click(); await box.locator('[data-jkk="upd"]').click(); await pg.wait_for_timeout(400)
        ok(await d.evaluate("e=>getComputedStyle(e).opacity")=='1' and (await d.text_content()).strip()=='2', 'после двух отметок — значок с «2»')
        ok('Счёт + УПД' in (await d.get_attribute('title')), f'подсказка: {await d.get_attribute("title")}')
        await pg.screenshot(path=f'/tmp/jk-{VW[0]}.png', clip={'x':0,'y':max(0,(await box.bounding_box())['y']-60),'width':VW[0],'height':160})
        # перерисовка не теряет отметки
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(700)
        ok(await pg.locator(f'#jr-body [data-jk="{P}d0"] .jkb.on').count()==2, 'после перерисовки отметки на месте')
        # скачивание: подменяем comboPdf-путь — ловим вызов через pdf.save
        await pg.evaluate("""()=>{ window.__saved=[]; }""")
        await pg.route('**/*jspdf*', lambda r: r.fulfill(status=200, content_type='application/javascript', body="window.jspdf={jsPDF:function(){this.addPage=()=>{};this.addImage=()=>{};this.save=n=>window.__saved.push(n);this.internal={pageSize:{getWidth:()=>210,getHeight:()=>297}};}};"))
        await pg.route('**/*html2canvas*', lambda r: r.fulfill(status=200, content_type='application/javascript', body="window.html2canvas=async()=>{const c=document.createElement('canvas');c.width=10;c.height=10;return c};"))
        await pg.locator(f'#jr-body [data-jk="{P}d0"] .jkd').click(); await pg.wait_for_timeout(2500)
        sv=await pg.evaluate("window.__saved"); ok(len(sv)==1 and sv[0].startswith('Счёт и УПД'), f'скачан один PDF {sv}')
        # снять отметки — значок прячется
        b2=pg.locator(f'#jr-body [data-jk="{P}d0"]')
        await b2.locator('[data-jkk="invoice"]').click(); await b2.locator('[data-jkk="upd"]').click(); await pg.wait_for_timeout(400)
        ok(await b2.locator('.jkd').evaluate("e=>getComputedStyle(e).opacity")=='0', 'сняли — значок спрятался')
        ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'нет прокрутки вбок')
        # кнопка «Счёт» по-прежнему открывает просмотр
        await b2.locator('[data-p="invoice"]').click(); await pg.wait_for_timeout(900); ok(await pg.evaluate("!document.querySelector('#pv').hidden"), '«Счёт» открыл просмотр'); await pg.click('#pv-close'); await pg.wait_for_timeout(500)
        # меню правой кнопкой: «Счёт+ТОРГ» осталось
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
        el=pg.locator(f'#jr-body [data-card="{P}d0"]').first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await el.dispatch_event('contextmenu'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#fd-app .jcx .jcx-dc', has_text='Счёт+ТОРГ').count()==1, 'в меню правой кнопкой «Счёт+ТОРГ» есть'); await pg.keyboard.press('Escape')
        ok(not errs, f'ошибок нет {errs[:2]}'); await ctx.close()
        ctx,pg,errs=await login(b,'Гриша','3333'); await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(900)
        ok(await pg.locator('#jr-body .jk').count()>0, 'у Гриши тоже конструктор'); ok(not errs, f'Гриша: ошибок нет {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
