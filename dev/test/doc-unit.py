"""Единицу товара из справочника можно поменять прямо в строке документа (упак → кг); у Гриши — нельзя."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def login(b,who,pw,w):
    pg=await b.new_page(viewport={'width':w,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg,errs
SET="""(()=>{const D=__fd.D(); const p=D.products.find(x=>x.unit==='кг'); p.unit='упак'; Object.assign(D.draft,{lines:[{productId:p.id,qty:'2',price:'100'}]});
  document.querySelector('nav.tabs button[data-tab="journal"]')?.click(); document.querySelector('nav.tabs button[data-tab="doc"]')?.click(); return p.id})()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for w in (1300,390):
            pg,errs=await login(b,"Даниил","1111",w); pid=await pg.evaluate(SET); await pg.wait_for_timeout(500)
            sel='#d-lines .line[data-i="0"] select.unit.ex'
            ok(await pg.locator(sel).count()==1, f'{w}: у товара из справочника единица — выбор')
            await pg.evaluate(f"(()=>{{const s=document.querySelector('{sel}'); s.value='кг'; s.dispatchEvent(new Event('change',{{bubbles:true}}))}})()"); await pg.wait_for_timeout(400)
            u=await pg.evaluate(f"__fd.D().products.find(x=>x.id==='{pid}').unit")
            ok(u=='кг', f'{w}: в справочнике стало кг ({u})')
            ok('Единица изменена' in await pg.evaluate("document.body.innerText"), f'{w}: уведомление')
            ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'{w}: нет прокрутки вбок')
            ok(not errs, f'{w}: нет ошибок {errs[:2]}'); await pg.close()
        pg,errs=await login(b,"Гриша","3333",390); await pg.evaluate(SET); await pg.wait_for_timeout(500)
        ok(await pg.locator('#d-lines select.unit.ex').count()==0, 'Гриша: единицу не меняет')
        await b.close()
    print('ИТОГ:', 'ошибок: 0' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
