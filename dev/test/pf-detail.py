"""«Прибыль»: плитки открывают подробности — кто, сколько и за что должен; оплатить из окна; накладная и «‹ Назад»; разбивка по заказчикам; телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
N=lambda s:(s or '').replace(' ',' ').replace(' ',' ')
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers.find(x=>x.id!=='private-buyer'); window.__c=c.id; D.products.push({id:'pd-a', name:'Груши', code:'', unit:'кг', country:'', price:'100'}); })()")
    t=await pg.evaluate("new Date().toISOString().slice(0,10)"); d40=await pg.evaluate("new Date(Date.now()-40*864e5).toISOString().slice(0,10)")
    for i,(d,q) in enumerate([(d40,'10'),(t,'5'),(t,'3')]):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'pdd{i}', customerId:window.__c, number:'', date:'{d}', lines:[{{productId:'pd-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.evaluate("(()=>{ const s=document.querySelector('#pf-per'); s.value='all'; s.dispatchEvent(new Event('change',{bubbles:true})); })()"); await pg.wait_for_timeout(600)
    ok(await pg.locator('#pf-cards .pk[data-pfd]').count()>=8, f'{tag}: плитки обзора кликабельные')
    ok(await pg.locator('#pf-paysum [data-pfd]').count()==3, f'{tag}: плитки «Кто сколько должен» кликабельные')
    # Дольше 30 дней
    await pg.click('#pf-paysum [data-pfd="old30"]'); await pg.wait_for_timeout(600)
    txt=N(await pg.text_content('#pfd')); ok('1 000,00' in txt and await pg.locator('#pfd [data-pfdoc="pdd0"]').count()==1 and await pg.locator('#pfd [data-pfdoc="pdd1"]').count()==0, f'{tag}: «Дольше 30 дней» — только старая накладная на 1000')
    await pg.screenshot(path=f'/tmp/claude-0/pfd-{tag}-old.png')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    # Всего должны
    await pg.click('#pf-paysum [data-pfd="debt"]'); await pg.wait_for_timeout(600)
    ok(await pg.locator('#pfd [data-pfdoc="pdd1"]').count()==1 and await pg.locator('#pfd [data-pfage="30"]').count()==1, f'{tag}: «Всего должны» — все накладные и фильтр по давности')
    await pg.click('#pfd [data-pfage="30"]'); await pg.wait_for_timeout(300); ok(await pg.locator('#pfd [data-pfdoc="pdd1"]').count()==0, f'{tag}: фильтр «больше 30» работает')
    await pg.click('#pfd [data-pfage=""]'); await pg.wait_for_timeout(300)
    # открыть накладную и вернуться
    await pg.locator('#pfd [data-pfdoc="pdd1"] .pfd-n').click(); await pg.wait_for_timeout(700)
    ok('Документ' in N(await pg.text_content('#fd-dcard .dc-kicker')), f'{tag}: нажатие на накладную открывает её')
    back=pg.locator('#fd-dcard .dc-head [data-navback]').first; ok(await back.count()>=1, f'{tag}: в окне накладной есть «‹ Назад»')
    if await back.count(): await back.click(); await pg.wait_for_timeout(700)
    ok(await pg.locator('#pfd').count()==1, f'{tag}: «Назад» возвращает к долгам')
    # оплатить
    await pg.click('#pfd [data-pfpay="pdd2"]'); await pg.wait_for_timeout(900)
    st=await pg.evaluate("__fd.payOf(__fd.D().journal.find(x=>x.id==='pdd2')).st"); ok(st=='paid' and await pg.locator('#pfd [data-pfdoc="pdd2"]').count()==0, f'{tag}: «Оплачено» отмечает и убирает из долгов ({st})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    await pg.click('#pf-paysum [data-pfd="perpaid"]'); await pg.wait_for_timeout(600)
    ok(await pg.locator('#pfd [data-pfdoc="pdd2"]').count()==1, f'{tag}: «Оплатили за период» — видна оплаченная накладная')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    for k in ['rev','cost','tax','gross','net','paid','due','exp','inc']:
        if await pg.locator(f'#pf-cards .pk[data-pfd="{k}"]').count()==0: continue
        await pg.click(f'#pf-cards .pk[data-pfd="{k}"]'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#pfd .pfd-sum').count()==1, f'{tag}: плитка «{k}» открывает подробности')
        if k=='rev': await pg.screenshot(path=f'/tmp/claude-0/pfd-{tag}-rev.png')
        sw=await pg.evaluate("[document.querySelector('#fd-dcard').scrollWidth, document.querySelector('#fd-dcard').offsetWidth]"); ok(sw[0]<=sw[1]+1, f'{tag}: «{k}» без прокрутки вбок {sw}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
