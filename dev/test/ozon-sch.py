"""«Озон» → выплата → «Чистыми по схемам»: FBO и realFBS отдельно, FBO + realFBS = «Вам чистыми».
Чистый тестовый сервер, XLSXJS (npm pack xlsx@0.18.5). PH=1 — телефон."""
import asyncio, os, sys, tempfile, importlib.util
from playwright.async_api import async_playwright
spec=importlib.util.spec_from_file_location('oz', os.path.join(os.path.dirname(__file__),'ozon.py')); oz=importlib.util.module_from_spec(spec); spec.loader.exec_module(oz)
BASE=oz.BASE; fails=[]
def ok(c,m):
    print(('✓ ' if c else '✗ ')+m)
    if not c: fails.append(m)
num=lambda s: float(s.replace(' ','').replace('\xa0','').replace('₽','').replace('−','-').replace('≈','').replace(',','.'))
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
        await pg.fill('#fd-dcard input[data-ozz="F:смесь"]','410'); await pg.press('#fd-dcard input[data-ozz="F:смесь"]','Tab'); await pg.wait_for_timeout(700)
        await pg.fill('#fd-dcard input[data-ozz="R:курага"]','300'); await pg.press('#fd-dcard input[data-ozz="R:курага"]','Tab'); await pg.wait_for_timeout(700)
        x=await pg.evaluate(f"(()=>{{const x=__oz.pay('{k}'); return {{net:x.net, F:x.sc.F, R:x.sc.R, rest:x.sc.rest}};}})()")
        kr=1746/(458+1746); wantR=1746*0.92-600+(-300*kr)*0.92; wantF=458*0.92-410+(-300*(1-kr))*0.92
        ok(abs(x['R']['net']-wantR)<0.01, f"realFBS чистыми = 1746 − 8% − 600 − доля общих ({kr:.3f}) = {wantR:.2f} ({x['R']['net']:.2f})")
        ok(abs(x['F']['net']-wantF)<0.01, f"FBO чистыми = {wantF:.2f} ({x['F']['net']:.2f})")
        ok(abs(x['F']['net']+x['R']['net']-x['net'])<0.01 and abs(x['rest'])<0.01, f"FBO + realFBS = вам чистыми {x['net']:.2f}")
        ok(abs(x['R']['n0']-(1746*0.92-600))<0.01, 'realFBS «до общих расходов» = 1746 − налог − закупка')
        txt=await pg.inner_text('#fd-dcard .ozd')
        ok('чистыми по схемам' in txt.lower(), 'в окне выплаты блок «Чистыми по схемам»')
        rb=await pg.inner_text('#fd-dcard [data-ozsc="R"] .ozsch b'); ok(abs(num(rb)-round(wantR,2))<0.01, f'карточка realFBS показывает {rb}')
        ok('Доля общих расходов' in await pg.inner_text('#fd-dcard [data-ozsc="R"]'), 'в карточке realFBS — доля общих расходов')
        if ph:
            sw=await pg.evaluate("(()=>{const d=document.querySelector('#fd-dcard'); return [d.scrollWidth,d.clientWidth]})()")
            ok(sw[0]<=sw[1]+2, f'окно без прокрутки вбок {sw}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        row=await pg.inner_text(f'#oz [data-ozpay="{k}"] .ozpyrf'); ok('realFBS' in row and abs(num(row.split('realFBS')[1])-round(wantR,2))<0.01, f'в списке выплат — «из них realFBS …» ({row})')
        ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'нет прокрутки вбок ({W})')
        ok(not errs, 'без ошибок '+str(errs)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
