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
    ok(await pg.locator('#pf-paysum [data-pfd]').count()==4 and 'Прибыль в долгах' in N(await pg.text_content('#pf-paysum')), f'{tag}: плитки «Кто сколько должен» кликабельные, есть «Прибыль в долгах»')
    # Дольше 30 дней
    await pg.click('#pf-paysum [data-pfd="old30"]'); await pg.wait_for_timeout(600)
    txt=N(await pg.text_content('#pfd')); ok('1 000,00' in txt and await pg.locator('#pfd [data-pfdoc="pdd0"]').count()==1 and await pg.locator('#pfd [data-pfdoc="pdd1"]').count()==0, f'{tag}: «Дольше 30 дней» — только старая накладная на 1000')
    await pg.screenshot(path=f'/tmp/claude-0/pfd-{tag}-old.png')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    # Всего должны
    await pg.click('#pf-paysum [data-pfd="debt"]'); await pg.wait_for_timeout(600)
    ok(await pg.locator('#pfd [data-pfdoc="pdd1"]').count()==1 and await pg.locator('#pfd [data-pfage="30"]').count()==1, f'{tag}: «Всего должны» — все накладные и фильтр по давности')
    st=N(await pg.text_content('#pfd .pfd-sum')); ok('Ваша прибыль в этих деньгах' in st and 'без закупки' in st.lower(), f'{tag}: плитка «прибыль в этих деньгах» с пометкой без закупки')
    pp=await pg.evaluate("(()=>{ let s=0; __fd.D().journal.filter(j=>['pdd0','pdd1','pdd2'].includes(j.id)).forEach(j=>{ const p=__fd.payOf(j), x=__fd.docProfit(j); s+=x.profit*(p.left/p.tot); }); return Math.round(s*100)/100; })()")
    ok(f"{pp:,.2f}".replace(',',' ').replace('.',',') in st, f'{tag}: сумма прибыли в долгах верная ({pp})')
    await pg.click('#pfd [data-pfage="30"]'); await pg.wait_for_timeout(300); ok(await pg.locator('#pfd [data-pfdoc="pdd1"]').count()==0, f'{tag}: фильтр «больше 30» работает')
    await pg.click('#pfd [data-pfage=""]'); await pg.wait_for_timeout(300)
    # плитки окна долгов ведут глубже: «Без закупки» → список → «Заполнить» → накладная с закупкой → назад → назад
    await pg.click('#pfd .pfd-sum [data-pfnav^="miss|"]'); await pg.wait_for_timeout(700)
    ok('Без закупки' in N(await pg.text_content('#fd-dcard h3')) and await pg.locator('#pfd [data-pfzk]').count()>=2, f'{tag}: плитка «Без закупки» открывает список накладных без закупки')
    await pg.locator('#pfd [data-pfzk="pdd1"]').click(); await pg.wait_for_timeout(1200)
    ok('Документ' in N(await pg.text_content('#fd-dcard .dc-kicker')) and await pg.locator('#fd-dcard [data-zkc="toggle"].on').count()==1, f'{tag}: «Заполнить» открывает накладную сразу с закупкой')
    await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
    ok('Без закупки' in N(await pg.text_content('#fd-dcard h3')), f'{tag}: «Назад» из накладной — в список без закупки')
    await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
    ok('Кто сколько должен' in N(await pg.text_content('#fd-dcard h3')), f'{tag}: ещё «Назад» — в долги')
    await pg.click('#pfd .pfd-sum [data-pfnav="old30"]'); await pg.wait_for_timeout(700)
    ok('старше 30' in N(await pg.text_content('#fd-dcard h3')) and await pg.locator('#pfd [data-pfdoc="pdd0"]').count()==1, f'{tag}: плитка «дольше 30 дней» показывает, кто именно')
    await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
    ok('Кто сколько должен' in N(await pg.text_content('#fd-dcard h3')), f'{tag}: «Назад» — снова в долги')
    await pg.click('#pfd .pfd-sum [data-pfsort="age"]'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#pfd .pfd-sort [data-pfsort="age"].on').count()==1, f'{tag}: плитка «Средний возраст» сортирует по давности')
    await pg.screenshot(path=f'/tmp/claude-0/pfd3-{tag}.png')
    # открыть накладную и вернуться
    await pg.locator('#pfd [data-pfdoc="pdd1"] .pfd-n').click(); await pg.wait_for_timeout(700)
    ok('Документ' in N(await pg.text_content('#fd-dcard .dc-kicker')), f'{tag}: нажатие на накладную открывает её')
    back=pg.locator('#fd-dcard .dc-head [data-navback]').first; ok(await back.count()>=1, f'{tag}: в окне накладной есть «‹ Назад»')
    if await back.count(): await back.click(); await pg.wait_for_timeout(700)
    ok(await pg.locator('#pfd').count()==1, f'{tag}: «Назад» возвращает к долгам')
    # глубже: заказчик → его накладные → накладная → назад → назад
    await pg.locator('#pfd [data-pfled]').first.click(); await pg.wait_for_timeout(800)
    ok(await pg.locator('#pvl').count()==1, f'{tag}: «Все накладные заказчика» открывает окно заказчика')
    bk=pg.locator('#fd-dcard .dc-head [data-navback]').first; ok(await bk.count()==1, f'{tag}: у окна заказчика есть «‹ Назад»')
    rows=pg.locator('#pvl [data-pvl], #pvl .pvrl'); 
    if await rows.count(): await rows.first.click(); await pg.wait_for_timeout(500)
    pr=pg.locator('#fd-dcard [data-pvs="prod"]')
    if await pr.count():
        await pr.first.click(); await pg.wait_for_timeout(900)
        ok('Документ' in N(await pg.text_content('#fd-dcard .dc-kicker')), f'{tag}: из окна заказчика открывается накладная')
        await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
        ok(await pg.locator('#pvl').count()==1, f'{tag}: «Назад» из накладной — в окно заказчика')
    await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
    ok(await pg.locator('#pfd').count()==1, f'{tag}: «Назад» из окна заказчика — в список долгов')
    await pg.screenshot(path=f'/tmp/claude-0/pfd2-{tag}.png')
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
