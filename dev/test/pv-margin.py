"""«По заказчикам» → «Накладные по марже»: все накладные периода по % маржи, сортировка, фильтры «Необычные / Без закупки», переход в накладную и закупку."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    ym=await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.products.push({id:'mg-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); return new Date().toISOString().slice(0,7);})()")
    # 5 накладных по 1000 ₽: закупка 600, 620, 580, 100 (подозрительно мало), без закупки
    for i in range(5):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'mgd{i}', customerId:window.__cid, number:'', date:'{ym}-0{i+1}', lines:[{{productId:'mg-a',qty:'10',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.evaluate("""(()=>{const D=__fd.D(), A=(D.doccosts=Array.isArray(D.doccosts)?D.doccosts:[]); const set=(id,s)=>{ let r=A.find(x=>x.id===id); if(!r){ r={id}; A.push(r);} r.lines=JSON.stringify({_src:[{n:'Саид',s}]}); r.expense=''; };
      set('mgd0',600); set('mgd1',620); set('mgd2',580); set('mgd3',100); })()""")
    await pg.click('#pv-seg [data-pv="cus"]'); await pg.wait_for_timeout(600)
    await pg.click('#pv-cus .pvmgo'); await pg.wait_for_timeout(600)
    rows=pg.locator('#pv-mg .pvmr'); n=await rows.count(); ok(n==4, f'{tag}: «С закупкой» — 4 накладные ({n})')
    ids=await pg.evaluate("[...document.querySelectorAll('#pv-mg .pvmr')].map(r=>r.dataset.pvmd)"); ok(ids[0]=='mgd3', f'{tag}: сверху самая большая маржа {ids}')
    cls=await rows.first.get_attribute('class'); ok('hi' in cls or 'odd' in cls, f'{tag}: высокая маржа отмечена ({cls})')
    await pg.select_option('#pv-ms','lo'); await pg.wait_for_timeout(400)
    ids=await pg.evaluate("[...document.querySelectorAll('#pv-mg .pvmr')].map(r=>r.dataset.pvmd)"); ok(ids[-1]=='mgd3' and ids[0]=='mgd1', f'{tag}: от меньшей к большей {ids}')
    await pg.click('#pv-mg [data-pvmf="odd"]'); await pg.wait_for_timeout(400)
    ids=await pg.evaluate("[...document.querySelectorAll('#pv-mg .pvmr')].map(r=>r.dataset.pvmd)"); ok(ids==['mgd3'], f'{tag}: «Необычные» — только mgd3 {ids}')
    await pg.click('#pv-mg [data-pvmf="miss"]'); await pg.wait_for_timeout(400)
    ids=await pg.evaluate("[...document.querySelectorAll('#pv-mg .pvmr')].map(r=>r.dataset.pvmd)"); ok(ids==['mgd4'], f'{tag}: «Без закупки» {ids}')
    await pg.fill('#pv-q','zzz'); await pg.wait_for_timeout(300); ok(await pg.locator('#pv-mg .pvmr').count()==0, f'{tag}: поиск фильтрует')
    await pg.fill('#pv-q',''); await pg.wait_for_timeout(300)
    await pg.click('#pv-mg [data-pvmf="all"]'); await pg.wait_for_timeout(400); ok(await pg.locator('#pv-mg .pvmr').count()==5, f'{tag}: «Все» — 5')
    await pg.locator('#pv-mg [data-pvmd="mgd3"]').click(); await pg.wait_for_timeout(900)
    ok(await pg.locator('#fd-dcard').count()==1, f'{tag}: открылась накладная')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    await pg.locator('#pv-mg [data-pvmz="mgd3"]').click(); await pg.wait_for_timeout(1200)
    ok(await pg.locator('#fd-dcard.zkpage').count()==1, f'{tag}: «Закупка ›» открывает закупку')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(800)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(800)
    ok(await pg.locator('#pv-mg').count()==1, f'{tag}: режим запомнился')
    await pg.click('#pv-cus [data-pvmode="cus"]'); await pg.wait_for_timeout(400); ok(await pg.locator('#pv-cus .pvgrid .pvcus').count()>=1, f'{tag}: назад к плиткам заказчиков')
    await pg.click('#pv-cus [data-pvmode="docs"]'); await pg.wait_for_timeout(400)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    await pg.evaluate("document.querySelector('#pv-mg').scrollIntoView()"); await pg.screenshot(path=f'/tmp/pv-margin-{tag}.png', full_page=False)
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
