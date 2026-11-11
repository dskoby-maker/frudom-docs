"""Перестановка строк документа: потянуть за номер строки (мышь и палец), стрелки ↑↓, Esc — отмена."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
ORDER="__fd.D().draft.lines.map(l=>l.qty).join(',')"
async def drag(pg, i, j, steps=14, cancel=False):
    await pg.evaluate("document.querySelector('#d-lines').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(100); g=pg.locator(f'#d-lines .line[data-i="{i}"] [data-lngrip]')
    a=await g.bounding_box(); t=await pg.locator(f'#d-lines .line[data-i="{j}"]').bounding_box()
    x=a['x']+a['width']/2; y=a['y']+a['height']/2; ty=t['y']+t['height']/2+(8 if j>i else -8)
    await pg.mouse.move(x,y); await pg.mouse.down()
    for k in range(1,steps+1): await pg.mouse.move(x, y+(ty-y)*k/steps); await pg.wait_for_timeout(16)
    await pg.wait_for_timeout(120)
    moving=await pg.locator('#d-lines .line.dragging').count()
    if cancel: await pg.keyboard.press('Escape')
    else: await pg.mouse.up()
    await pg.wait_for_timeout(450); return moving
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[0,1,2,3].map(i=>({productId:D.products[i].id,qty:String(i+1),price:'100'})); })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            ok(await pg.locator('#d-lines [data-lngrip]').count()==4, f'{vw[0]}: у каждой строки номер-ручка')
            mv=await drag(pg,0,2); ok(mv==1, f'{vw[0]}: строка поднимается при перетаскивании')
            o=await pg.evaluate(ORDER); ok(o=='2,3,1,4', f'{vw[0]}: первая → на третье место ({o})')
            ok((await pg.text_content('#d-lines .line[data-i="2"] .ln')).strip()=='3', f'{vw[0]}: номера пересчитаны')
            await drag(pg,3,0); o=await pg.evaluate(ORDER); ok(o=='4,2,3,1', f'{vw[0]}: последняя → наверх ({o})')
            await drag(pg,0,3,cancel=True); o=await pg.evaluate(ORDER); ok(o=='4,2,3,1', f'{vw[0]}: Esc — без изменений ({o})')
            ok(await pg.evaluate("[...document.querySelectorAll('#d-lines .line')].every(r=>!r.style.transform)"), f'{vw[0]}: после отмены строки на местах')
            await pg.focus('#d-lines .line[data-i="1"] [data-lngrip]'); await pg.keyboard.press('ArrowDown'); await pg.wait_for_timeout(200)
            o=await pg.evaluate(ORDER); ok(o=='4,3,2,1', f'{vw[0]}: стрелка ↓ ({o})')
            ok(await pg.evaluate("document.activeElement.closest('.line').dataset.i")=='2', f'{vw[0]}: фокус остался на ручке')
            await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(200); ok(await pg.evaluate(ORDER)=='4,2,3,1', f'{vw[0]}: стрелка ↑')
            # клик по номеру без движения ничего не меняет
            await pg.click('#d-lines .line[data-i="1"] [data-lngrip]'); await pg.wait_for_timeout(300); ok(await pg.evaluate(ORDER)=='4,2,3,1', f'{vw[0]}: клик без движения — без изменений')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            n0=await pg.evaluate("__fd.D().draft.id"); await pg.click('#d-save'); await pg.wait_for_timeout(2500)
            jo=await pg.evaluate("(ID=>{const J=__fd.D().journal; const j=J.find(x=>x.id===ID); return J.length+'|'+(j?j.snap.dr.lines.map(l=>l.qty).join(','):'')})", n0)
            ok(jo.endswith('|4,2,3,1'), f'{vw[0]}: в документ идёт новый порядок ({n0} → {jo})')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await pg.close()
        # одна строка — ручки нет
        pg=await b.new_page(viewport={'width':1300,'height':900}); await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'1',price:'1'}]; })()")
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(300)
        ok(await pg.locator('#d-lines [data-lngrip]').count()==0, 'одна строка — переставлять нечего')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
