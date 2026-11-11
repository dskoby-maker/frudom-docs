"""«Прибыль → По заказчикам»: видны все заказчики. С накладными за месяц — плитками сверху, остальные — ниже «Без накладных в …»
(последняя накладная или «накладных пока нет»); новый заказчик и новая накладная появляются сами."""
import asyncio
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("""(()=>{const D=__fd.D(); const s=D.suppliers[0];
              if(!D.customers.some(c=>c.id==='pa-old')) D.customers.push({id:'pa-old',name:'ООО «Старый заказчик»'});
              if(!D.customers.some(c=>c.id==='pa-new')) D.customers.push({id:'pa-new',name:'ООО «Совсем новый»'});
              const mk=(id,cid,date,sum)=>({id,date,number:'9'+id.length,supplierId:s.id,customerId:cid,sum:String(sum),snap:{dr:{id,supplierId:s.id,customerId:cid,date,number:'1',lines:[]},c:{name:cid==='pa-gone'?'ООО «Удалённый»':'x'},s:{name:s.name},prods:{},meta:{}}});
              D.journal=D.journal.filter(j=>!String(j.id).startsWith('pa-'));
              D.journal.push(mk('pa-j1','pa-old','2026-09-15',1000)); D.journal.push(mk('pa-j2','pa-gone','2026-11-03',500));
              D.pfv=Object.assign(D.pfv||{},{v:'cus',m:'2026-11'}); })()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"profit\"]').click()"); await pg.wait_for_timeout(1500)
            if await pg.locator('#pv-seg [data-v="cus"], #pv-seg button[data-pv="cus"]').count():
                await pg.locator('#pv-seg [data-v="cus"], #pv-seg button[data-pv="cus"]').first.click(); await pg.wait_for_timeout(600)
            await pg.evaluate("(()=>{const f=__fd.D().pfv; if(f){f.v='cus'; f.m='2026-11';}})()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"calendar\"]').click()"); await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"profit\"]').click()"); await pg.wait_for_timeout(1200)
            t=await pg.inner_text('#pv-cus') if await pg.locator('#pv-cus').count() else ''
            ok('Удалённый' in t, f'{W}: накладная заказчика, которого нет в справочнике, видна с его названием')
            ok('Без накладных в ноябре' in t, f'{W}: раздел «Без накладных в ноябре»')
            ok('Старый заказчик' in t and 'последняя накладная 15.09.2026' in t, f'{W}: заказчик без накладных в ноябре виден с последней накладной')
            ok('Совсем новый' in t and 'накладных пока нет' in t, f'{W}: новый заказчик виден')
            n=await pg.evaluate("__fd.D().customers.filter(c=>!c._del).length"); nt=await pg.locator('#pv-cus .pvcus').count()
            ok(nt>=n-1, f'{W}: плиток {nt}, заказчиков {n}')
            await pg.locator('#pv-cus .pvcus.idle', has_text='Старый заказчик').click(); await pg.wait_for_timeout(600)
            ok(await pg.locator('#fd-dcard[open]').count()==1, f'{W}: плитка открывает окно заказчика')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            if W==1300: await pg.screenshot(path='/tmp/pv.png', full_page=True)
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
