"""«Прибыль → Обзор»: у предупреждения «У N накладных нет закупочной цены» — кнопки сразу к этим накладным (окно со списком и «Заполнить»; вкладка «Закупка»). ПК и телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
N=lambda s:(s or '').replace(' ',' ').replace(' ',' ')
PH=os.environ.get('PH')=='1'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); vw=(390,844) if PH else (1300,900); tag='тел' if PH else 'ПК'
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, is_mobile=PH, has_touch=PH); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers.find(x=>x.id!=='private-buyer'); window.__c=c.id; D.products.push({id:'pd-a', name:'Груши', code:'', unit:'кг', country:'', price:'100'}); })()")
    t=await pg.evaluate("new Date().toISOString().slice(0,10)")
    for i,q in enumerate(['5','3','2']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'pm{i}', customerId:window.__c, number:'', date:'{t}', lines:[{{productId:'pd-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2200)
    W=pg.locator('#pf-warn'); ok(await W.is_visible(), f'{tag}: предупреждение видно')
    txt=N(await W.text_content()); ok('3 накладных' in txt, f'{tag}: в тексте «3 накладных» ({txt[:60]})')
    btn=pg.locator('#pf-warn [data-pfmw="list"]'); ok(await btn.count()==1 and '3' in N(await btn.text_content()), f'{tag}: кнопка «Заполнить закупку · 3»')
    ok(await pg.evaluate("document.documentElement.scrollWidth")<=vw[0], f'{tag}: нет прокрутки вбок')
    await pg.screenshot(path=f'/tmp/claude-0/pfmw-{tag}.png')
    await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(800)
    ok('Без закупки' in N(await pg.text_content('#fd-dcard h3')) and await pg.locator('#pfd [data-pfzk]').count()==3, f'{tag}: открылось окно с 3 накладными без закупки')
    await pg.locator('#pfd [data-pfzk="pm1"]').click(); await pg.wait_for_timeout(1300)
    ok(await pg.locator('#fd-dcard.zkpage #dc-zki .dzr').count()>=1, f'{tag}: «Заполнить» открывает закупку накладной')
    await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
    await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(800)
    ok('Без закупки' in N(await pg.text_content('#fd-dcard h3')), f'{tag}: «Назад» возвращает к списку')
    for _ in range(4):
        if not await pg.evaluate("!!document.querySelector('#fd-dcard[open]')"): break
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    z=pg.locator('#pf-warn [data-pfmw="zk"]'); await z.scroll_into_view_if_needed(); await z.click(); await pg.wait_for_timeout(1500)
    act=await pg.evaluate("document.querySelector('nav.tabs button.on, nav.tabs button[aria-selected=true]')?.dataset.tab||location.hash")
    ok(await pg.locator('#zkp').is_visible(), f'{tag}: открылась вкладка «Закупка» ({act})')
    ok(await pg.locator('#fd-tback').is_visible(), f'{tag}: есть «‹ Назад: Прибыль»')
    await pg.click('#fd-tback'); await pg.wait_for_timeout(1000)
    ok(await pg.locator('#pf-warn').is_visible(), f'{tag}: вернулись в «Прибыль»')
    ok(not errs, f'{tag}: ошибок на странице нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
