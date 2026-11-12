"""«По заказчикам»: под «Прибылью» — «не оплачено: N ›»; нажатие открывает «Ждём оплату» за этот месяц (фильтры «Обзора» не мешают)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    ym=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.products.push({id:'pu-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['pu-a']='100'; return new Date().toISOString().slice(0,7);})()")
    pm=await pg.evaluate("(()=>{const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7);})()")
    for i,dt in enumerate([ym+'-01', ym+'-02', ym+'-03', pm+'-10']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'pud{i}', customerId:window.__cid, number:'', date:'{dt}', lines:[{{productId:'pu-a',qty:'5',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    # первая накладная месяца оплачена
    jid=await pg.evaluate(f"()=>__fd.D().journal.find(x=>x.date==='{ym}-01').id")
    await pg.click('#pv-seg [data-pv="cus"]'); await pg.wait_for_timeout(600)
    await pg.evaluate("()=>document.querySelector('#pv-cus [data-pvc=\"'+window.__cid+'\"]').click()"); await pg.wait_for_timeout(800)
    await pg.locator(f'#fd-dcard [data-pvpay="{jid}"]').click(); await pg.wait_for_timeout(700)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    btn=pg.locator('#pv-cus [data-pvunp]'); n=await btn.count(); ok(n==1, f'{tag}: кнопка «не оплачено» есть')
    txt=(await btn.text_content()) if n else ''; ok('не оплачено: 2' in txt, f'{tag}: число верное ({txt.strip()})')
    await btn.click(); await pg.wait_for_timeout(900)
    h=await pg.text_content('#fd-dcard h3'); ok('Ждём оплату' in h, f'{tag}: открылось «Ждём оплату» ({h})')
    kk=await pg.text_content('#fd-dcard .dc-kicker'); ok(any(m in kk for m in ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']), f'{tag}: в шапке месяц ({kk})')
    rows=await pg.locator('#pfd .pfd-r').count(); ok(rows==2, f'{tag}: ровно 2 накладные ({rows})')
    await pg.locator('#pfd .pfd-r .pfd-pay').first.click(); await pg.wait_for_timeout(900)
    rows=await pg.locator('#pfd .pfd-r').count(); ok(rows==1, f'{tag}: после «Оплачено» осталась 1 ({rows})')
    await pg.locator('#pfd .pfd-r').first.click(); await pg.wait_for_timeout(900)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(900)
    rows=await pg.locator('#pfd .pfd-r').count(); ok(rows==1, f'{tag}: «Назад» из накладной возвращает в то же окно ({rows})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    txt=await pg.locator('#pv-cus [data-pvunp]').text_content(); ok('не оплачено: 1' in txt, f'{tag}: плитка обновилась ({txt.strip()})')
    # «Обзор»: плитка «Ждём оплату» по-прежнему по своим фильтрам — окно без месяца из «По заказчикам»
    await pg.click('#pv-seg [data-pv="ov"]'); await pg.wait_for_timeout(600)
    t=pg.locator('#pf-cards [data-pfd="due"]')
    if await t.count():
        await t.first.click(); await pg.wait_for_timeout(700)
        k2=await pg.text_content('#fd-dcard .dc-kicker'); ok(k2!=kk, f'{tag}: окно из «Обзора» со своим периодом ({k2})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
