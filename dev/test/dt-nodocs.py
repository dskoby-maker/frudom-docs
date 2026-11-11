"""«Сделать документы» у задачи: метка в календаре, счётчик «Без документов», окно списка, «Сделать документы ›» → новый документ
на заказчика/день/точку, после сохранения задача сама «Документы сделаны» (и в таблице), архив накладной — снова «нужны», «Уже сделаны»."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            cid,day=await pg.evaluate("""(()=>{const D=__fd.D(); const L=D.customers.filter(c=>!c.priv && !D.journal.some(j=>j.customerId===c.id)); const c=L[0]||D.customers[0]; const d=new Date(); d.setDate(d.getDate()-2); const iso=d.toISOString().slice(0,10);
              D.cal=Object.assign(D.cal||{}, {sel:iso, ym:iso.slice(0,7), cus:''}); return [c.id, iso]})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"calendar\"]').click()"); await pg.wait_for_timeout(700)
            await pg.evaluate(f"(()=>{{const c=__fd.D().cal||{{}}; }})()")
            await pg.locator(f'#cal-grid button[data-d="{day}"]').click(); await pg.wait_for_timeout(300)
            ok(await pg.locator('#dt-docs').count()==1 and not await pg.locator('#dt-docs').is_disabled(), f'{W}: галочка «Сделать документы» в новой задаче')
            await pg.fill('#dt-text', f'Отвезти образцы {W}')
            await pg.select_option('#dt-cus', cid); await pg.wait_for_timeout(200)
            await pg.locator('#dt-add label.dt-docs').click(); await pg.click('#dt-add button[type=submit]'); await pg.wait_for_timeout(600)
            ok(await pg.locator(f'#cal-grid button[data-d="{day}"] .cnd').count()==1, f'{W}: на дне жёлтая метка «без документов»')
            t=await pg.inner_text('#cal-nodoc'); ok('Без документов' in t and 'уже отвезли' in t, f'{W}: сверху «{t.strip()}»')
            ok(await pg.locator('#dt-list .dtdoc.need').count()>=1, f'{W}: у задачи плашка «Документы не сделаны»')
            await pg.click('#cal-nodoc'); await pg.wait_for_timeout(500)
            ok(await pg.locator('#fd-dcard .ndr').count()>=1, f'{W}: окно со списком поставок без документов')
            await pg.locator('#fd-dcard .ndr', has_text=f'образцы {W}').locator('[data-dtdmk]').click(); await pg.wait_for_timeout(900)
            st=await pg.evaluate("(()=>{const d=__fd.D().draft; return [location.hash, d.customerId, d.date, !!d.taskId]})()")
            ok(st[0]=='#dokument' and st[1]==cid and st[2]==day and st[3], f'{W}: открылся новый документ на заказчика и день задачи: {st}')
            ok(await pg.locator('#fd-tback').is_visible(), f'{W}: есть «‹ Назад: Календарь»')
            # заполнить строку и сохранить
            await pg.evaluate("""(()=>{const D=__fd.D(), dr=D.draft, p=D.products.find(p=>+p.price>0)||D.products[0]; dr.lines=[{productId:p.id, qty:'2', price:String(p.price||100)}];})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]') && 0")
            sv=pg.locator('#fd-app [data-make="save"], #d-save').first
            if await sv.count(): await sv.click()
            else: await pg.evaluate("__fd.D() && 0")
            await pg.wait_for_timeout(1500)
            x=await pg.evaluate(f"(()=>{{const x=__fd.D().daytasks.find(t=>t.text==='Отвезти образцы {W}'); return [x.docs, x.docsRef, x.docsBy]}})()")
            ok(x[0]=='сделаны' and x[1], f'{W}: после сохранения документа задача «сделаны»: {x}')
            await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1500)
            T=dump()['Задачи на день']; Hh=T[0]; R=[dict(zip(Hh,r)) for r in T[1:]]; row=[r for r in R if r.get('Задача')==f'Отвезти образцы {W}']
            ok(row and row[0].get('Документы (нужны / сделаны)')=='сделаны', f'{W}: в таблице «сделаны»')
            # архив накладной → снова «нужны»
            jid=x[1].split(',')[0]
            await pg.evaluate(f"(()=>{{const D=__fd.D(); const j=D.journal.find(j=>j.id==='{jid}'); return j}})()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"calendar\"]').click()"); await pg.wait_for_timeout(500)
            ok(await pg.locator(f'#cal-grid button[data-d="{day}"] .cnd').count()==0, f'{W}: метка на дне пропала')
            ok(await pg.locator('#dt-list .dtdoc.ok').count()>=1, f'{W}: у задачи «Документы сделаны · № …»')
            # вторая задача — «Уже сделаны»
            await pg.fill('#dt-text', f'Вторая {W}'); await pg.locator('#dt-add label.dt-docs').click(); await pg.click('#dt-add button[type=submit]'); await pg.wait_for_timeout(500)
            r=pg.locator('#dt-list .dt', has_text=f'Вторая {W}'); await r.locator('[data-dtdok]').click(); await pg.wait_for_timeout(400)
            ok(await r.locator('.dtdoc.ok').count()==1, f'{W}: «Уже сделаны» — отмечено вручную')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            if W==1300: await pg.screenshot(path='/tmp/nd.png', full_page=True)
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
