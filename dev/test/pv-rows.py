"""Окно записи «Расходы и доходы»: пробелы по тысячам при вводе суммы и «Ещё строка» — несколько записей одним разом."""
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
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1800); await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(400)
    await pg.click('#pv-fin [data-pva="exp"]'); await pg.wait_for_timeout(450)
    s=pg.locator('#pvi-sum')
    for typed,want in [('2900','2 900'),('29900','29 900'),('1234567,5','1 234 567,5')]:
        await s.fill(''); await s.press_sequentially(typed); v=await s.input_value(); ok(v==want, f'{tag}: «{typed}» → «{v}»')
    await s.fill(''); await s.press_sequentially('12900'); await s.press('Home'); await s.press('ArrowRight'); await s.press('ArrowRight'); await s.press('Backspace')
    v=await s.input_value(); ok(v=='1 900', f'{tag}: стёрли цифру в середине — курсор на месте ({v})')
    await s.fill(''); await s.press_sequentially('2900')
    await pg.fill('#pvi-note','VPN наоборот')
    cat=await pg.locator('#pvi-cats [data-pvcat]').first.get_attribute('data-pvcat'); await pg.click(f'#pvi-cats [data-pvcat="{cat}"]')
    await pg.click('#fd-dcard [data-pvi="row"]'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#pvi-rows .pvxr').count()==1, f'{tag}: «Ещё строка» добавила строку')
    r=pg.locator('#pvi-rows .pvxr').nth(0); await r.locator('.pvxn').fill('Бензин'); await r.locator('.pvxs').press_sequentially('15000')
    ok(await r.locator('.pvxs').input_value()=='15 000', f'{tag}: в строке тоже пробелы по тысячам')
    await r.locator('.pvxs').press('Enter'); await pg.wait_for_timeout(300)
    ok(await pg.locator('#pvi-rows .pvxr').count()==2, f'{tag}: Enter в сумме последней строки — новая строка')
    r2=pg.locator('#pvi-rows .pvxr').nth(1); await r2.locator('.pvxn').fill('Обед'); await r2.locator('.pvxs').press_sequentially('600')
    tot=N(await pg.text_content('#pvi-tot')); ok('18 500,00' in tot and '3 записи' in tot, f'{tag}: итого в окне ({tot})')
    ok(N(await pg.text_content('#fd-dcard [data-pvi="save"]'))=='Добавить (3)', f'{tag}: кнопка «Добавить (3)»')
    await pg.screenshot(path=f'{SHOT}/pvr-{tag}.png')
    await pg.locator('#pvi-rows .pvxr').nth(1).locator('.pvxdel').click(); await pg.wait_for_timeout(300)
    ok(await pg.locator('#pvi-rows .pvxr').count()==1, f'{tag}: × убирает строку')
    await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(600)
    P=await pg.evaluate("__fd.D().pother.map(x=>[x.note,x.sum,x.kind,x.cat||''])")
    ok(sorted([p[0] for p in P])==['VPN наоборот','Бензин'] and {p[0]:p[1] for p in P}=={'VPN наоборот':'2900','Бензин':'15000'}, f'{tag}: сохранены 2 записи с верными суммами: {P}')
    ok(all(p[3]==cat for p in P), f'{tag}: категория строки — как у первой записи (по умолчанию)')
    # личное: строки без категории
    await pg.click('#pv-fin [data-pva="per"]'); await pg.wait_for_timeout(450)
    await pg.locator('#pvi-sum').press_sequentially('1000'); await pg.fill('#pvi-note','Кафе'); await pg.click('#fd-dcard [data-pvi="row"]'); await pg.wait_for_timeout(250)
    ok(await pg.locator('#pvi-rows .pvxc').count()==0, f'{tag}: у личных строк нет выбора категории')
    r=pg.locator('#pvi-rows .pvxr').nth(0); await r.locator('.pvxn').fill('Такси'); await r.locator('.pvxs').press_sequentially('450')
    await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(600)
    per=await pg.evaluate("__fd.D().pother.filter(x=>x.kind==='Личное').map(x=>x.note+':'+x.sum)")
    ok(sorted(per)==['Кафе:1000','Такси:450'], f'{tag}: личные — 2 записи {per}')
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
