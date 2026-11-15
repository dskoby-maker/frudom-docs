"""Окно заказчика в «Прибыль → По заказчикам»: период (чипы и свои даты), плитки нажимаются — «Ждём оплату», «без закупки», «в минус» фильтруют список, «На р/с» раскрывает расчёт, «маржа › по марже» ведёт в список накладных по марже."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    ym=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.products.push({id:'lt-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); return new Date().toISOString().slice(0,7);})()")
    pm=await pg.evaluate("(()=>{const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); return d.toISOString().slice(0,7);})()")
    dates=[ym+'-01', ym+'-02', ym+'-03', pm+'-10']
    for i,dt in enumerate(dates):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'ltd{i}', customerId:window.__cid, number:'', date:'{dt}', lines:[{{productId:'lt-a',qty:'10',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    # закупка: 0 — 600, 1 — 1200 (в минус), 2 — нет, 3 — 500; оплачена 0
    await pg.evaluate("""(()=>{const D=__fd.D(), A=(D.doccosts=Array.isArray(D.doccosts)?D.doccosts:[]); const set=(id,s)=>{ let r=A.find(x=>x.id===id); if(!r){ r={id}; A.push(r);} r.lines=JSON.stringify({_src:[{n:'Саид',s}]}); r.expense=''; };
      set('ltd0',600); set('ltd1',1200); set('ltd3',500); })()""")
    await pg.click('#pv-seg [data-pv="cus"]'); await pg.wait_for_timeout(600)
    if await pg.locator('#pv-cus [data-pvmode="cus"]').count(): await pg.click('#pv-cus [data-pvmode="cus"]'); await pg.wait_for_timeout(300)
    await pg.evaluate("()=>document.querySelector('#pv-cus [data-pvc=\"'+window.__cid+'\"]').click()"); await pg.wait_for_timeout(900)
    await pg.locator('#fd-dcard [data-pvpay="ltd0"]').click(); await pg.wait_for_timeout(600)
    rows=lambda: pg.evaluate("[...document.querySelectorAll('#pvl .pvr')].map(r=>r.dataset.pvr).sort()")
    ok(await pg.locator('#pvl .pvlper [data-pvlp]').count()>=5, f'{tag}: чипы периода есть')
    t=await pg.text_content('#pvl [data-pvlt="all"]'); ok('4 накладные' in t, f'{tag}: всё время — 4 накладные ({t.strip()[:60]})')
    await pg.click('#pvl [data-pvlp="m1"]'); await pg.wait_for_timeout(400)
    t=await pg.text_content('#pvl [data-pvlt="all"]'); ok('1 накладная' in t and 'прошлый месяц' in t, f'{tag}: прошлый месяц — 1 ({t.strip()[:60]})')
    ok(await rows()==['ltd3'], f'{tag}: в списке только накладная прошлого месяца')
    await pg.click('#pvl [data-pvlp="c"]'); await pg.wait_for_timeout(300)
    await pg.fill('#pvl-a', ym+'-02'); await pg.fill('#pvl-b', ym+'-03'); await pg.dispatch_event('#pvl-b','change'); await pg.wait_for_timeout(400)
    ok(await rows()==['ltd1','ltd2'], f'{tag}: свои даты 2–3 числа {await rows()}')
    await pg.click('#pvl [data-pvlp="all"]'); await pg.wait_for_timeout(400)
    await pg.click('#pvl [data-pvlt="due"]'); await pg.wait_for_timeout(400)
    ok(await rows()==['ltd1','ltd2','ltd3'], f'{tag}: «Ждём оплату» — только не оплаченные {await rows()}')
    ok(await pg.locator('#pvl .pvlf').count()==1, f'{tag}: строка «Показаны: не оплаченные»')
    await pg.click('#pvl [data-pvlt="clear"]'); await pg.wait_for_timeout(300)
    await pg.click('#pvl [data-pvlt="miss"]'); await pg.wait_for_timeout(400)
    ok(await rows()==['ltd2'], f'{tag}: «без закупки» {await rows()}')
    await pg.click('#pvl [data-pvlt="loss"]'); await pg.wait_for_timeout(400)
    ok(await rows()==['ltd1'], f'{tag}: «в минус» {await rows()}')
    await pg.click('#pvl [data-pvlt="all"]'); await pg.wait_for_timeout(300); ok(len(await rows())==4, f'{tag}: «Сумма» — показать все')
    await pg.click('#pvl [data-pvlt="rs"]'); await pg.wait_for_timeout(300)
    bd=await pg.text_content('#pvl .pvlbd'); ok('уже пришло' in bd and 'налог' in bd, f'{tag}: «На р/с» раскрывает расчёт')
    # открыть накладную и вернуться — период и фильтр помнятся
    await pg.click('#pvl [data-pvlp="m1"]'); await pg.wait_for_timeout(300)
    await pg.locator('#pvl [data-pve="ltd3"]').click(); await pg.wait_for_timeout(500)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    await pg.screenshot(path=f'/tmp/lt-{tag}.png')
    await pg.click('#pvl [data-pvlt="mg"]'); await pg.wait_for_timeout(1200)
    ok(await pg.locator('#fd-dcard').count()==0, f'{tag}: окно закрылось')
    ok(await pg.locator('#pv-mg .pvmr').count()==1, f'{tag}: открылся список по марже за прошлый месяц ({await pg.locator("#pv-mg .pvmr").count()})')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
