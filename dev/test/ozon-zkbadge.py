"""«Озон» → «Выплаты на р/с»: значок «Заполните закупку» у выплат, где закупка вписана не вся; нажатие — окно выплаты на разделе «Закупка».
Чистый тестовый сервер, XLSXJS (npm pack xlsx@0.18.5). PH=1 — телефон."""
import asyncio, os, sys, tempfile, importlib.util
from playwright.async_api import async_playwright
spec=importlib.util.spec_from_file_location('oz', os.path.join(os.path.dirname(__file__),'ozon.py')); oz=importlib.util.module_from_spec(spec); spec.loader.exec_module(oz)
BASE=oz.BASE; fails=[]
def ok(c,m):
    print(('✓ ' if c else '✗ ')+m)
    if not c: fails.append(m)
async def main():
    ph=os.environ.get('PH')=='1'; W=390 if ph else 1300
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=os.environ['XLSXJS']))
        await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon'); localStorage.removeItem('frudom-oz-ui')}catch(e){}"); await pg.reload()
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("(()=>{const b=document.querySelector('nav.tabs button[data-tab=ozon]'); if(b) b.click(); else goTab('ozon');})()"); await pg.wait_for_timeout(800)
        f=tempfile.mktemp(suffix='.xlsx'); oz.mk_xlsx(f)
        await pg.set_input_files('#oz-file', f); await pg.wait_for_timeout(1500)
        await pg.click('#oz [data-ozv="pay"]'); await pg.wait_for_timeout(800)
        k=await pg.evaluate("(()=>{ const d=new Date(); const D1=d.toISOString().slice(0,8)+'01'; return __oz.pers(10).find(x=>x.a<=D1&&x.b>=D1).k; })()")
        bd=pg.locator(f'#oz [data-ozpay="{k}"] .ozzkb')
        ok(await bd.count()==1, 'у выплаты без закупки — значок «Заполните закупку»')
        t=await bd.inner_text(); ok('Заполните закупку' in t and '2' in t, f'на значке число товаров без закупки ({t})')
        ok(await pg.locator('#oz .ozzkbar').count()==1, 'над списком — плашка «Заполните закупку»')
        await bd.click(); await pg.wait_for_timeout(1200)
        ok(await pg.locator('#fd-dcard #ozs-zak.ozflash').count()==1, 'открылось окно выплаты, раздел «Закупка» подсвечен')
        fo=await pg.evaluate("document.activeElement&&document.activeElement.dataset.ozz")
        ok(fo=='F:смесь', f'курсор — в первом пустом поле закупки ({fo})')
        await pg.keyboard.type('410'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(700)
        await pg.keyboard.type('300'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(700)
        ok(not await pg.evaluate(f"__oz.pay('{k}').approx"), 'закупка вписана — больше не «примерно»')
        if ph:
            sw=await pg.evaluate("(()=>{const d=document.querySelector('#fd-dcard'); return [d.scrollWidth,d.clientWidth]})()")
            ok(sw[0]<=sw[1]+2, f'окно без прокрутки вбок {sw}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        ok(await pg.locator(f'#oz [data-ozpay="{k}"] .ozzkb').count()==0, 'после заполнения значок пропал')
        if ph:
            # значок не вылезает за карточку
            r=await pg.evaluate("(()=>{const c=document.querySelector('#oz .ozpay'); return c.scrollWidth<=c.clientWidth+1})()")
            ok(r, 'карточки выплат без прокрутки вбок')
        ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'нет прокрутки вбок ({W})')
        ok(not errs, 'без ошибок '+str(errs)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
