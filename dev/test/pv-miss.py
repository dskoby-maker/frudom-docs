"""«Расходы и доходы»: «без закупки: N» — ссылка; нажатие открывает «Закупку» только с этими накладными за месяц."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    ym=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.products.push({id:'pm-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['pm-a']='100'; return new Date().toISOString().slice(0,7);})()")
    for i,day in enumerate(['01','02']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'pmd{i}', customerId:window.__cid, number:'', date:'{ym}-{day}', lines:[{{productId:'pm-a',qty:'5',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
    btn=pg.locator('#pv-fin [data-pvmiss]'); n=await btn.count(); ok(n==1, f'{tag}: «без закупки» — кнопка')
    txt=(await btn.text_content()) if n else ''; ok('без закупки: 2' in txt, f'{tag}: число верное ({txt})')
    await btn.click(); await pg.wait_for_timeout(900)
    ok(await pg.is_visible('#tab-purchase'), f'{tag}: открылась вкладка «Закупка»')
    rng=await pg.text_content('#zkp-rng'); ok('без закупки' in rng.lower() or 'не хватает закупки' in rng, f'{tag}: полоска «Из Прибыли» ({rng.strip()[:60]})')
    rows=await pg.locator('#zkp-list .zkp-it').count(); ok(rows==2, f'{tag}: в списке ровно 2 накладные ({rows})')
    ok(await pg.locator('#zkp-st button.miss.on').count()==1, f'{tag}: выбран фильтр «Без закупки»')
    await pg.locator('#zkp-list .zkp-row').first.click(); await pg.wait_for_timeout(900)
    ok(await pg.locator('#zkp-list .zkp-it.open').count()==1, f'{tag}: строка раскрывается для заполнения')
    await pg.click('#zkp-rng [data-zkprng]'); await pg.wait_for_timeout(500)
    ok(await pg.is_hidden('#zkp-rng') and await pg.locator('#zkp-st button.miss').count()==0, f'{tag}: «Обычный список» возвращает как было')
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
