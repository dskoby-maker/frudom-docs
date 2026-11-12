"""Подсказки «На что» по мере ввода (вместо стандартного списка телефона, который показывал всё сразу)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, has_touch=vw[0]<500); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1800); await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(400)
    for n in ['Бензин','Банковские гарантии','Вове на магазин','Гриша']:
        await pg.click('#pv-fin [data-pva="exp"]'); await pg.wait_for_timeout(400)
        await pg.locator('#pvi-sum').press_sequentially('100'); await pg.fill('#pvi-note',n); await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-fin [data-pva="exp"]'); await pg.wait_for_timeout(450)
    ok(await pg.get_attribute('#pvi-note','list') is None, f'{tag}: у поля нет стандартного списка (list)')
    await pg.click('#pvi-note'); await pg.wait_for_timeout(200)
    ok(await pg.locator('.dlsug').count()==0, f'{tag}: пустое поле — подсказок нет')
    await pg.locator('#pvi-note').press_sequentially('б'); await pg.wait_for_timeout(200)
    L=await pg.locator('.dlsug .dlo').all_text_contents(); ok(sorted(L)==['Банковские гарантии','Бензин'], f'{tag}: «б» → {L}')
    await pg.locator('#pvi-note').press_sequentially('е'); await pg.wait_for_timeout(150)
    L=await pg.locator('.dlsug .dlo').all_text_contents(); ok(L==['Бензин'], f'{tag}: «бе» → {L}')
    vis=await pg.evaluate("(()=>{const b=document.querySelector('.dlsug').getBoundingClientRect(), x=document.elementFromPoint(b.left+20,b.top+15); return x&&x.closest('.dlsug')?true:[b.left,b.top,b.width,b.height,x&&x.className,getComputedStyle(document.querySelector('#fd-dcard')).transform]})()")
    ok(vis, f'{tag}: окошко подсказок поверх окна {vis}')
    g=await pg.evaluate("(()=>{const b=document.querySelector('.dlsug').getBoundingClientRect(), i=document.querySelector('#pvi-note').getBoundingClientRect(); return [Math.round(b.top-i.bottom), Math.round(b.left-i.left), Math.round(b.width-i.width)]})()")
    ok(0<=g[0]<=8 and abs(g[1])<=1 and abs(g[2])<=1, f'{tag}: окошко ровно под полем, той же ширины {g}')
    await pg.screenshot(path=f'/tmp/dl-{tag}.png'); await pg.click('.dlsug .dlo'); await pg.wait_for_timeout(200)
    ok(await pg.input_value('#pvi-note')=='Бензин' and await pg.locator('.dlsug').count()==0, f'{tag}: нажатие подставляет и закрывает')
    await pg.fill('#pvi-note',''); await pg.locator('#pvi-note').press_sequentially('маг'); await pg.wait_for_timeout(150)
    await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
    ok(await pg.input_value('#pvi-note')=='Вове на магазин', f'{tag}: по слову из середины и ↓ Enter')
    await pg.click('#fd-dcard [data-pvi="row"]'); await pg.wait_for_timeout(300)
    r=pg.locator('#pvi-rows .pvxr .pvxn').first; ok(await r.get_attribute('list') is None, f'{tag}: в «Ещё строка» тоже без стандартного списка')
    await r.press_sequentially('гр'); await pg.wait_for_timeout(150)
    ok(await pg.locator('.dlsug .dlo').all_text_contents()==['Гриша'], f'{tag}: подсказки в строке')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(100); ok(await pg.locator('.dlsug').count()==0, f'{tag}: Esc закрывает подсказки')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
