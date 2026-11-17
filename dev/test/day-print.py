"""Календарь → «Печать и PDF документов дня»: окно с накладными по заказчикам, у каждой — Счёт / ТОРГ‑12 / УПД и «2 экз.»,
у заказчика и «Всем сразу» — то же для всех; печать одним заданием ровно выбранного; выбор заказчика запоминается. ПК и телефон (PH=1)."""
import asyncio, os, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); TG='тел' if PH else 'ПК'
T=datetime.date.today().isoformat()
async def main():
    P='dp'+('m' if PH else 'p')
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(); D.journal.forEach(j=>{ if(j.date>='2000') j.date='2001-01-01'; }); localStorage.removeItem('frudom-dprint'); const cs=D.customers.filter(x=>x.id!=='private-buyer'&&!x.priv); window.__a=cs[0].id; window.__b=cs[1].id; D.products.push({id:'dp-a', name:'Яблоки', unit:'кг', price:'100'}); })()""")
        for i,c in enumerate(['__a','__a','__b']):
            await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}{i}', supplierId:D.suppliers[0].id, customerId:window.{c}, number:'', date:'{T}', lines:[{{productId:'dp-a',qty:'{i+1}',price:'100'}}]}}); }}""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(900)
            await pg.evaluate("(()=>{ if(!__fd.D().journal.some(j=>j.id===__fd.D().draft.id)) document.querySelector('#d-save').click(); })()"); await pg.wait_for_timeout(900)
        await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())")
        await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(800)
        await pg.evaluate("window.__ifr=0; new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{ if(n.tagName==='IFRAME'){ window.__ifr++; window.__pg=()=>n.contentWindow.document.querySelectorAll('.pg').length; n.contentWindow.print=()=>{}; } }))).observe(document.body,{childList:true})")
        ok((await pg.text_content('#cal-pdf')).strip()=='Печать и PDF документов дня', f'{TG}: кнопка переименована')
        await pg.click('#cal-pdf'); await pg.wait_for_timeout(800)
        ok(await pg.locator('#fd-dcard[open].dpwin').count()==1, f'{TG}: открылось окно')
        ng=await pg.locator('#fd-dcard .dpg').count(); nr=await pg.locator('#fd-dcard .dpr').count(); ok(ng==2 and nr==3, f'{TG}: 2 заказчика, 3 накладные ({ng}/{nr})')
        t=await pg.text_content('#dp-tot'); ok('3 накладные' in t and '6 документов' in t, f'{TG}: по умолчанию Счёт + ТОРГ — «{t}»')
        sw=await pg.evaluate("[document.documentElement.scrollWidth<=innerWidth, [...document.querySelectorAll('#fd-dcard *')].filter(e=>e.getBoundingClientRect().right>document.querySelector('#fd-dcard').getBoundingClientRect().right+0.5).length]"); ok(sw[0] and sw[1]==0, f'{TG}: ничего не вылезает {sw}')
        # «Всем сразу» УПД — всем, потом снять
        await pg.click('#fd-dcard [data-dpak="upd"]'); await pg.wait_for_timeout(200)
        ok('9 документов' in await pg.text_content('#dp-tot'), f'{TG}: «Всем сразу: УПД» добавил УПД всем')
        await pg.click('#fd-dcard [data-dpak="upd"]'); await pg.wait_for_timeout(200)
        # у заказчика B — только счёт; у A: № первой снять, вторую ×2
        R=lambda n: f'#fd-dcard .dpr[data-jid="{P}{n}"]'
        await pg.click(R(2)+' [data-dpk$="|torg12"]'); await pg.wait_for_timeout(150)
        await pg.click(R(0)+' [data-dpd]'); await pg.click(R(1)+' [data-dpc]'); await pg.wait_for_timeout(200)
        g=await pg.locator(R(0)).locator('xpath=ancestor::section[1]').locator('[data-dpgd]').get_attribute('aria-pressed'); ok(g=='mixed', f'{TG}: у заказчика A отмечена часть — «{g}»')
        t=await pg.text_content('#dp-tot'); ok('2 накладные' in t and '5 документов' in t, f'{TG}: итог «{t.strip()}»')
        await pg.click('#dp-prn'); await pg.wait_for_timeout(1500)
        pr=await pg.evaluate("[window.__ifr, window.__pg?window.__pg():0]"); ok(pr[0]>=1 and pr[1]==5, f'{TG}: печать: 5 листов ({pr})')
        mem=await pg.evaluate("JSON.parse(localStorage.getItem('frudom-dprint')||'{}')[window.__b]"); ok(mem and mem['k']==['invoice'], f'{TG}: выбор заказчика запомнился ({mem})')
        # окно открыто заново — B только счёт
        await pg.click('#fd-dcard [data-dc="close"]'); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())")
        await pg.click('#cal-pdf'); await pg.wait_for_timeout(800)
        R=lambda n: f'#fd-dcard .dpr[data-jid="{P}{n}"]'
        ok(await pg.get_attribute(R(2)+' [data-dpk$="|torg12"]','aria-pressed')=='false' and await pg.get_attribute(R(2)+' [data-dpk$="|invoice"]','aria-pressed')=='true', f'{TG}: в следующий раз у заказчика B сразу только счёт')
        await pg.click('#fd-dcard [data-dpsel]'); await pg.wait_for_timeout(200)
        ok(await pg.is_disabled('#dp-prn') and 'Ничего' in await pg.text_content('#dp-tot'), f'{TG}: «Снять все» — кнопки неактивны')
        await pg.click('#fd-dcard [data-dpsel]'); await pg.wait_for_timeout(200)
        ok(not await pg.is_disabled('#dp-pdf'), f'{TG}: «Выбрать все» — снова можно')
        # отметить тип у выключенной накладной — она включается
        await pg.click(R(1)+' [data-dpd]'); await pg.click(R(1)+' [data-dpk$="|upd"]'); await pg.wait_for_timeout(200)
        ok(await pg.get_attribute(R(1)+' [data-dpd]','aria-pressed')=='true', f'{TG}: нажали УПД у снятой — она снова отмечена')
        ok(not errs, f'{TG}: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок'); raise SystemExit(1 if fails else 0)
asyncio.run(main())
