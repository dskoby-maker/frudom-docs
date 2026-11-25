"""«Озон» → выплата → «Отчёт для Тани (PDF)»: скачивается PDF, в отчёте — сумма Тане, товары, удержания Озона, доля общих.
Чистый тестовый сервер, XLSXJS, H2C и JSPDF (npm pack html2canvas@1.4.1 jspdf@2.5.1). PH=1 — телефон. OUT=папка — сохранить PDF."""
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
        pg=await b.new_page(viewport={'width':W,'height':900}, accept_downloads=True); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=os.environ['XLSXJS']))
        await pg.route('**/html2canvas.min.js', lambda r: r.fulfill(path=os.environ['H2C']))
        await pg.route('**/jspdf.umd.min.js', lambda r: r.fulfill(path=os.environ['JSPDF']))
        await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon'); localStorage.removeItem('frudom-oz-ui')}catch(e){}"); await pg.reload()
        await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("(()=>{const b=document.querySelector('nav.tabs button[data-tab=ozon]'); if(b) b.click(); else goTab('ozon');})()"); await pg.wait_for_timeout(800)
        f=tempfile.mktemp(suffix='.xlsx'); tot=oz.mk_xlsx(f)
        await pg.set_input_files('#oz-file', f); await pg.wait_for_timeout(1500)
        await pg.click('#oz [data-oz="own"]'); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-ozowna="смесь"] [data-ozown="t"]'); await pg.wait_for_timeout(500)
        inp=pg.locator('#fd-dcard input[data-ozc="смесь~t"]'); await inp.fill('300'); await inp.press('Tab'); await pg.wait_for_timeout(400)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.click('#oz [data-ozv="pay"]'); await pg.wait_for_timeout(800)
        k=await pg.evaluate("(()=>{ const d=new Date(); const D1=d.toISOString().slice(0,8)+'01'; return __oz.pers(10).find(x=>x.a<=D1&&x.b>=D1).k; })()")
        await pg.click(f'#oz [data-ozpay="{k}"]'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#fd-dcard [data-oztpdf]').count()==1, 'в «Расчёт с Таней» есть кнопка «Отчёт для Тани (PDF)»')
        x=await pg.evaluate(f"__oz.pay('{k}').tanya")
        html=await pg.evaluate(f"__ozTRep('{k}')")
        for w in ['Тане к выплате','Как посчитано','По каждому товару','Ореховая смесь','Что начислил и удержал Озон','Вознаграждение','Логистика','Доля Тани','Размещение','себестоимость 300']:
            ok(w in html, f'в отчёте есть «{w}»')
        async with pg.expect_download(timeout=60000) as dl:
            await pg.click('#fd-dcard [data-oztpdf]')
        d=await dl.value; path=await d.path(); name=d.suggested_filename
        data=open(path,'rb').read()
        ok(name.startswith('Отчёт для Тани') and name.endswith('.pdf'), f'файл: {name}')
        ok(data[:4]==b'%PDF' and len(data)>20000, f'это PDF ({len(data)} байт)')
        if os.environ.get('OUT'):
            open(os.path.join(os.environ['OUT'],'tanya.pdf'),'wb').write(data)
        ok(await pg.locator('#fd-dcard [data-oztpdf]').is_enabled(), 'кнопка снова активна после скачивания')
        ok('Отчёт для Тани скачан' in await pg.inner_text('#fd-toasts'), 'уведомление «Отчёт для Тани скачан»')
        ok(not errs, 'без ошибок '+str(errs)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
