"""Повтор позиции в документе: красная подсветка + предупреждение, сохранить всё равно можно."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'},{productId:'',qty:'',price:''}]; })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            ok(await pg.locator('#d-lines .line.dup').count()==0, f'{vw[0]}: без повторов подсветки нет')
            name=await pg.evaluate("__fd.D().products[0].name")
            inp=pg.locator('#d-lines .line[data-i="1"] input.ps'); await inp.click(); await inp.fill(name); await pg.wait_for_timeout(500); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
            ok(await pg.evaluate("__fd.D().draft.lines[1].productId===__fd.D().draft.lines[0].productId"), f'{vw[0]}: выбрана та же позиция')
            ok(await pg.locator('#d-lines .line.dup').count()==2, f'{vw[0]}: обе строки подсвечены красным')
            t=await pg.text_content('#d-lines'); ok('уже есть в строке № 1' in t and 'уже есть в строке № 2' in t, f'{vw[0]}: подпись у строк')
            ok('Такая позиция уже есть' in (await pg.text_content('#fd-toasts') or ''), f'{vw[0]}: всплыло предупреждение')
            bg=await pg.evaluate("getComputedStyle(document.querySelector('#d-lines .line.dup')).backgroundColor"); ok(bg=='rgb(253, 236, 234)', f'{vw[0]}: красный фон {bg}')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            await pg.screenshot(path=os.environ.get('SHOT','/tmp/')+f'dup-{vw[0]}.png', full_page=False, clip=None)
            await pg.evaluate("document.querySelector('#d-lines .line[data-i=\"1\"] input.qty').scrollIntoView({block:'center'})")
            await pg.screenshot(path=os.environ.get('SHOT','/tmp/')+f'dup-{vw[0]}.png')
            await pg.fill('#d-lines .line[data-i="1"] input.qty','2'); await pg.press('#d-lines .line[data-i="1"] input.qty','Tab')
            n0=await pg.evaluate("__fd.D().journal.length"); await pg.click('#d-save'); await pg.wait_for_timeout(2500)
            j=await pg.evaluate("__fd.D().journal.length"); ok(j==n0+1, f'{vw[0]}: документ с повтором сохранён')
            ok(await pg.evaluate("__fd.D().journal[0].snap.dr.lines.filter(l=>l.productId).length")==2, f'{vw[0]}: в документе обе строки')
            # удалили повтор — подсветка ушла
            await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'},{productId:D.products[0].id,qty:'1',price:'100'}]; })()")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(300)
            await pg.click('#d-lines .line[data-i="1"] .x'); await pg.wait_for_timeout(400)
            ok(await pg.locator('#d-lines .line.dup').count()==0, f'{vw[0]}: после удаления повтора подсветка ушла')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
