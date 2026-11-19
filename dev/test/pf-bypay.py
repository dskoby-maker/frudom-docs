"""«Прибыль → Обзор»: переключатель «По дате накладной | По дате оплаты». Мартовская накладная, оплаченная в ноябре, —
в ноябре только во втором режиме; частичная оплата — долей; неоплаченная ноябрьская — только в первом. ПК и телефон (PH=1)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"profit\"]').click()"); await pg.wait_for_timeout(2000)
        P='bp'+('m' if PH else 'd')
        await pg.evaluate(f"""()=>{{ const D=__fd.D(), c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv), s=D.suppliers[0];
          const mk=(id,date,sum)=>{{ const snap={{dr:{{id,customerId:c.id,supplierId:s.id,date,number:id,lines:[{{productId:'x',name:'Товар',qty:'1',unit:'кг',price:String(sum)}}]}}, c, s, meta:{{}}}};
            D.journal.push({{id, number:id, date, supplierId:s.id, customerId:c.id, sum:String(sum), snap}}); }};
          mk('{P}1','2026-03-10',1000); mk('{P}2','2026-11-05',2000); mk('{P}3','2026-10-20',4000);
          __fd.setPay(D.journal.find(j=>j.id==='{P}1'),1000,'2026-11-12'); __fd.setPay(D.journal.find(j=>j.id==='{P}3'),2000,'2026-11-15');
          D.pf=Object.assign(D.pf||{{}},{{per:'custom',from:'2026-11-01',to:'2026-11-30',sup:'',cus:'',by:''}}); }}""")
        await pg.evaluate("document.querySelector('nav.tabs [data-tab=\"doc\"]').click();document.querySelector('nav.tabs [data-tab=\"profit\"]').click()"); await pg.wait_for_timeout(1200)
        rev=lambda: pg.evaluate("document.querySelector('#pf-cards [data-k=\"rev\"] b').textContent.replace(/\\s/g,'')")
        r1=await rev(); print('   по дате накладной:', r1); ok(r1.startswith('2000'), 'по дате накладной — только ноябрьская (2 000)')
        ok(await pg.locator('#pf-byn').is_hidden(), 'пояснения нет')
        await pg.click('#pf-by [data-pfby="pay"]'); await pg.wait_for_timeout(800)
        r2=await rev(); print('   по дате оплаты:', r2); ok(r2.startswith('3000'), 'по дате оплаты: март 1 000 + половина октябрьской 2 000 = 3 000')
        t=await pg.inner_text('#pf-cards [data-k="rev"]'); ok('2 накладн' in t and 'оплачены' in t, f'подпись: {t!r}')
        ok(await pg.locator('#pf-byn').is_visible(), 'пояснение видно')
        ok(await pg.evaluate("__fd.D().pf.by")=='pay', 'выбор запомнен')
        ids=await pg.evaluate("[...document.querySelectorAll('#pf-docs tr.pfd')].map(r=>r.dataset.pf)"); ok(f'{P}1' in ids and f'{P}3' in ids and f'{P}2' not in ids, f'в таблице оплаченные в ноябре {ids}')
        ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'нет прокрутки вбок')
        await pg.screenshot(path='/tmp/pfby.png')
        await pg.click('#pf-by [data-pfby=""]'); await pg.wait_for_timeout(800); ok((await rev()).startswith('2000') and await pg.locator('#pf-byn').is_hidden(), 'вернулись к дате накладной')
        ok(not errs, f'ошибок нет {errs[:2]}'); await b.close()
    print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
