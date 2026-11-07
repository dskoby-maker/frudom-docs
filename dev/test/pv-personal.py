"""«Расходы и доходы»: личные траты (без категории, не уменьшают прибыль бизнеса), итог «Бизнес заработал» / «Остаётся вам»,
фильтр по виду, календарь, лимит личных, «Повторить», подсказка прошлой суммы; ПК и телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(t): return json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
N=lambda s: (s or '').replace(' ',' ').replace(' ',' ')
async def add(pg, kind, s, note, cat=None):
    await pg.click(f'#pv-fin [data-pva="{kind}"]'); await pg.wait_for_timeout(450)
    await pg.fill('#pvi-sum', s); await pg.fill('#pvi-note', note)
    if cat: await pg.click(f'#pvi-cats [data-pvcat="{cat}"]')
    await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(500)
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
    await add(pg,'exp','40000','Спровод Ростислав')
    await add(pg,'inc','5000','Проценты по вкладу')
    await add(pg,'per','12000','Продукты домой')
    await add(pg,'per','3000','Кафе')
    P=await pg.evaluate("__fd.D().pother.map(x=>[x.kind,x.sum,x.note,x.cat||'',x.supplierId||''])")
    per=[p for p in P if p[0]=='Личное']; ok(len(per)==2 and all(p[3]=='' and p[4]=='' for p in per), f'{tag}: личные записи без категории и ИП: {per}')
    flow=N(await pg.text_content('#pv-fin .pvflow')); res=N(await pg.text_content('#pv-fin .pvres'))
    ok('−40 000,00' in flow and '+5 000,00' in flow and '−15 000,00' in flow, f'{tag}: в итоге расходы, доходы и личные')
    ok('Бизнес заработал' in flow and '−35 000,00' in flow, f'{tag}: бизнес заработал −35 000 (личные не вычтены)')
    ok('−50 000,00' in res, f'{tag}: остаётся −50 000 ({res[:60]})')
    # «Обзор»: личные не уменьшают чистую прибыль, но есть плитка «Остаётся после личных»
    await pg.click('#pv-seg [data-pv="ov"]'); await pg.wait_for_timeout(400)
    net=N(await pg.text_content('#pf-cards [data-k="net"] b')); own=N(await pg.text_content('#pf-cards [data-k="own"] b'))
    ok(net.replace('−','-').strip().startswith('-35 000'), f'{tag}: «Чистая прибыль» без личных: {net}')
    ok(own.replace('−','-').strip().startswith('-50 000'), f'{tag}: «Остаётся после личных»: {own}')
    await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(400)
    # фильтр «Личные»
    await pg.click('#pv-fin [data-pvfk="per"]'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#pv-fin .pvlist .pvit').count()==2, f'{tag}: фильтр «Личные» — 2 записи')
    await pg.click('#pv-fin [data-pvfk=""]'); await pg.wait_for_timeout(300)
    # лимит
    await pg.click('#pv-fin [data-pva="lim"]'); await pg.wait_for_timeout(400); await pg.fill('#pvl-sum','10000'); await pg.click('#fd-dcard [data-pvl="save"]'); await pg.wait_for_timeout(500)
    lim=N(await pg.text_content('#pv-fin .pvlim')); ok('превышен на 5 000,00' in lim, f'{tag}: лимит личных превышен ({lim[:70]})')
    # подсказка прошлой суммы и «Повторить»
    await pg.click('#pv-fin [data-pva="per"]'); await pg.wait_for_timeout(400); await pg.fill('#pvi-note','Кафе'); await pg.wait_for_timeout(200)
    h=N(await pg.text_content('#pvi-hint')); ok('3 000,00' in h, f'{tag}: подсказка «в прошлый раз 3 000»')
    await pg.click('#pvi-hint [data-pvi="last"]'); v=await pg.input_value('#pvi-sum'); ok(v=='3 000', f'{tag}: «подставить» вписал сумму ({v})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    xid=await pg.evaluate("__fd.D().pother.find(x=>x.note==='Продукты домой').id")
    await pg.click(f'#pv-fin [data-pvx="{xid}"]'); await pg.wait_for_timeout(400)
    ok(await pg.locator('#pvi-f.k-per').count()==1 and await pg.locator('#pvi-cats .pvcc').count()==0, f'{tag}: у личной записи категорий нет')
    await pg.screenshot(path=f'{SHOT}/pvp-{tag}-item.png')
    await pg.click('#fd-dcard [data-pvi="copy"]'); await pg.wait_for_timeout(600)
    ok(await pg.input_value('#pvi-sum')=='12 000' and await pg.input_value('#pvi-note')=='Продукты домой', f'{tag}: «Повторить» открыл копию')
    await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(500)
    ok(await pg.evaluate("__fd.D().pother.filter(x=>x.note==='Продукты домой').length")==2, f'{tag}: копия сохранена')
    await pg.screenshot(path=f'{SHOT}/pvp-{tag}-list.png', full_page=True)
    # календарь
    await pg.click('#pv-fin [data-pvv="cal"]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#pv-fin .pvcal .pvcd.has').count()>=1, f'{tag}: календарь показал день с записями')
    await pg.screenshot(path=f'{SHOT}/pvp-{tag}-cal.png', full_page=True)
    d=await pg.locator('#pv-fin .pvcal .pvcd.has').first.get_attribute('data-pvday'); await pg.click(f'#pv-fin .pvcd.has[data-pvday="{d}"]'); await pg.wait_for_timeout(300)
    days=await pg.evaluate("[...new Set([...document.querySelectorAll('#pv-fin .pvlist .pvit')].map(b=>__fd.D().pother.find(x=>x.id===b.dataset.pvx).date))]")
    ok(days==[d], f'{tag}: нажали день — в списке только он ({days})')
    e=await pg.locator('#pv-fin .pvcd.empty').first.get_attribute('data-pvday'); await pg.click(f'#pv-fin .pvcd.empty[data-pvday="{e}"]'); await pg.wait_for_timeout(450)
    ok(await pg.input_value('#pvi-date')==e, f'{tag}: пустой день — новая запись на эту дату')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    await pg.wait_for_timeout(2500)
    t=dump('Прочие доходы и расходы'); h=t[0]; kinds=[r[h.index('Тип')] for r in t[1:]]
    ok(kinds.count('Личное')>=3, f'{tag}: личные записаны в таблицу ({kinds.count("Личное")})')
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
