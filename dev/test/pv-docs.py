"""«Расходы и доходы»: прибыль с накладных по дням в ленте и календаре — оплаченная (зелёная) и ждущая оплату (светло-зелёная)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
N=lambda s: (s or '').replace(' ',' ').replace(' ',' ')
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    ym=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.products.push({id:'dp-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['dp-a']='100'; return new Date().toISOString().slice(0,7);})()")
    for i,(day,q) in enumerate([('03','10'),('05','20')]):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'dpd{i}', customerId:window.__cid, number:'', date:'{ym}-{day}', lines:[{{productId:'dp-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.evaluate("(()=>{const j=__fd.D().journal.find(x=>x.id==='dpd0'); __fd.setPay(j, __fd.payOf(j).tot, j.date, true);})()")
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-fin [data-pvv="list"]'); await pg.wait_for_timeout(300)
    r0=pg.locator('#pv-fin [data-pvdoc="dpd0"]'); r1=pg.locator('#pv-fin [data-pvdoc="dpd1"]')
    ok(await r0.count()==1 and await r1.count()==1, f'{tag}: накладные видны в ленте')
    ok('paid' in (await r0.get_attribute('class')) and 'оплачена' in N(await r0.text_content()), f'{tag}: оплаченная — зелёная «оплачена»')
    ok('due' in (await r1.get_attribute('class')) and 'ждём оплату' in N(await r1.text_content()), f'{tag}: неоплаченная — светло-зелёная «ждём оплату»')
    flow=N(await pg.text_content('#pv-fin .pvpd')); ok('оплачено' in flow and 'ждём оплату' in flow, f'{tag}: в итоге видно «оплачено / ждём оплату» ({flow})')
    await pg.click('#pv-fin [data-pvfk="exp"]'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#pv-fin [data-pvdoc]').count()==0, f'{tag}: в фильтре «Расходы» накладных нет')
    await pg.click('#pv-fin [data-pvfk=""]'); await pg.wait_for_timeout(300)
    await pg.click('#pv-fin [data-pvv="cal"]'); await pg.wait_for_timeout(500)
    c0=await pg.get_attribute(f'#pv-fin .pvcd[data-pvday="{ym}-03"]','class'); c1=await pg.get_attribute(f'#pv-fin .pvcd[data-pvday="{ym}-05"]','class')
    ok('dok' in c0 and 'ddue' in c1, f'{tag}: календарь — {ym}-03 зелёный, {ym}-05 светло-зелёный')
    await pg.locator('#pv-fin .pvcal').scroll_into_view_if_needed(); await pg.evaluate("scrollBy(0,-160)"); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'{SHOT}/pvd-{tag}-cal.png')
    await pg.click(f'#pv-fin .pvcd[data-pvday="{ym}-05"]'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#pv-fin .pvlist [data-pvdoc]').count()==1, f'{tag}: нажали день — в ленте его накладная')
    await pg.click('#pv-fin .pvlist [data-pvdoc="dpd1"]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#fd-dcard').count()==1, f'{tag}: нажатие открывает окно накладной')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')   # телефон: PH=1, на чистом сервере
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
