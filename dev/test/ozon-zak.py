"""«Озон» → выплата → раздел «Закупка»: FBO — цена за 1 шт по каждому товару, realFBS — одной суммой или по товарам.
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
        f=tempfile.mktemp(suffix='.xlsx'); tot=oz.mk_xlsx(f)
        await pg.set_input_files('#oz-file', f); await pg.wait_for_timeout(1500)
        await pg.click('#oz [data-ozv="pay"]'); await pg.wait_for_timeout(800)
        k=await pg.evaluate("(()=>{ const d=new Date(); const D1=d.toISOString().slice(0,8)+'01'; return __oz.pers(10).find(x=>x.a<=D1&&x.b>=D1).k; })()")
        await pg.click(f'#oz [data-ozpay="{k}"]'); await pg.wait_for_timeout(600)
        txt=await pg.inner_text('#fd-dcard .ozd')
        ok('Закупка' in txt and 'FBO · ваш товар' in txt, 'в окне выплаты есть раздел «Закупка»')
        x=await pg.evaluate(f"(()=>{{const x=__oz.pay('{k}'); return [x.rfm, x.approx, x.myCost, x.rfCost];}})()")
        ok(x[0]=='items' and x[1] and x[2]==0, f'по умолчанию realFBS — по товарам, закупка не вписана → «примерно» {x}')
        ok(await pg.locator('#fd-dcard input[data-ozz="F:смесь"].miss').count()==1, 'FBO: поле цены у смеси, подсвечено — не вписано')
        ok(await pg.locator('#fd-dcard input[data-ozz="R:курага"]').count()==1, 'realFBS: поле цены у кураги')
        # FBO — по штучно, Enter — к следующему полю
        await pg.fill('#fd-dcard input[data-ozz="F:смесь"]','410'); await pg.press('#fd-dcard input[data-ozz="F:смесь"]','Enter'); await pg.wait_for_timeout(700)
        fo=await pg.evaluate("document.activeElement&&document.activeElement.dataset.ozz")
        ok(fo=='R:курага', f'Enter — курсор перешёл к следующему товару ({fo})')
        x=await pg.evaluate(f"(()=>{{const x=__oz.pay('{k}'); return [x.myCost, __oz.prefs().ozPz['{k}']['F:смесь'], (__oz.prefs().ozCost||{{}})['смесь']];}})()")
        ok(x[0]==410 and x[1]==410 and x[2]==410, f'закупка FBO 1 × 410, себестоимость смеси на вкладке тоже 410 (её не было) {x}')
        await pg.keyboard.type('300'); await pg.keyboard.press('Tab'); await pg.wait_for_timeout(700)
        x=await pg.evaluate(f"(()=>{{const x=__oz.pay('{k}'); return [x.rfCost, x.approx, x.net];}})()")
        want=round(tot-tot*0.08-410-600,2)
        ok(x[0]==600 and not x[1] and abs(x[2]-want)<0.01, f'realFBS по товарам: 2 × 300 = 600, вам чистыми {want} без «примерно» {x}')
        tl=await pg.eval_on_selector_all('#fd-dcard .oztile span','L=>L.map(x=>x.textContent)')
        ok('после Тани, налога и закупки' in tl[4], 'плитка «Вам чистыми» — без «не вся закупка вписана»')
        ok('− Закупка FBO' in await pg.inner_text('#fd-dcard .ozd') and '− Закупка realFBS' in await pg.inner_text('#fd-dcard .ozd'), 'в «Ваших деньгах» две строки закупки')
        # своя цена в этой выплате не меняет уже вписанную себестоимость на вкладке
        await pg.fill('#fd-dcard input[data-ozz="F:смесь"]','450'); await pg.press('#fd-dcard input[data-ozz="F:смесь"]','Tab'); await pg.wait_for_timeout(700)
        x=await pg.evaluate(f"[__oz.pay('{k}').myCost, __oz.prefs().ozCost['смесь']]"); ok(x==[450,410], f'в выплате 450, на вкладке осталось 410 {x}')
        await pg.fill('#fd-dcard input[data-ozz="F:смесь"]',''); await pg.press('#fd-dcard input[data-ozz="F:смесь"]','Tab'); await pg.wait_for_timeout(700)
        x=await pg.evaluate(f"__oz.pay('{k}').myCost"); ok(x==410, f'очистили — снова себестоимость с вкладки 410 ({x})')
        ok('себестоимость с вкладки' in await pg.inner_text('#fd-dcard .ozz'), 'подпись «себестоимость с вкладки»')
        # realFBS одной суммой
        await pg.click('#fd-dcard [data-ozrfm="sum"]'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#fd-dcard input[data-ozz^="R:"]').count()==0 and await pg.locator('#fd-dcard #oz-rfz').count()==1, 'одной суммой — одно поле вместо товаров')
        x=await pg.evaluate(f"[__oz.pay('{k}').rfCost, __oz.pay('{k}').approx]"); ok(x==[600, True], f'сумма ещё не вписана — пока по себестоимости, «примерно» {x}')
        await pg.fill('#fd-dcard #oz-rfz','1 000'); await pg.press('#fd-dcard #oz-rfz','Tab'); await pg.wait_for_timeout(700)
        x=await pg.evaluate(f"[__oz.pay('{k}').rfCost, __oz.pay('{k}').approx]"); ok(x==[1000, False], f'realFBS одной суммой 1000 {x}')
        await pg.click('#fd-dcard [data-ozrfm="items"]'); await pg.wait_for_timeout(600)
        x=await pg.evaluate(f"__oz.pay('{k}').rfCost"); ok(x==600, f'обратно «по каждому товару» — 600 ({x})')
        await pg.click('#fd-dcard [data-ozrfm="sum"]'); await pg.wait_for_timeout(600)
        x=await pg.evaluate(f"__oz.pay('{k}').rfCost"); ok(x==1000, f'и снова одной суммой — сумма сохранилась ({x})')
        if ph:
            sw=await pg.evaluate("(()=>{const d=document.querySelector('#fd-dcard'), R=d.getBoundingClientRect().right; return [d.scrollWidth,d.clientWidth,[...d.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>R+1).map(e=>e.tagName+'.'+e.className).slice(0,5)]})()")
            ok(sw[0]<=sw[1]+2, f'окно выплаты без прокрутки вбок {sw}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        row=await pg.inner_text(f'#oz [data-ozpay="{k}"] .me b'); ok('≈' not in row, f'в списке выплат — без «≈» ({row})')
        ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'нет прокрутки вбок ({W})')
        ok(not errs, 'без ошибок '+str(errs)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
