"""«Озон»: данные общие для всех устройств (Code.gs ≥ 54). Отчёт загружен на ПК — виден на телефоне; удаление — тоже везде.
Нужен чистый тестовый сервер и XLSXJS (npm pack xlsx@0.18.5)."""
import asyncio, os, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
from playwright.async_api import async_playwright
import importlib.util
spec=importlib.util.spec_from_file_location('oz', os.path.join(os.path.dirname(__file__),'ozon.py')); oz=importlib.util.module_from_spec(spec); spec.loader.exec_module(oz)
BASE=oz.BASE; fails=[]
def ok(c,m):
    print(('✓ ' if c else '✗ ')+m)
    if not c: fails.append(m)
async def dev(b, w, h):
    c=await b.new_context(viewport={'width':w,'height':h}); pg=await c.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.route('**/xlsx.full.min.js', lambda r: r.fulfill(path=os.environ['XLSXJS']))
    await pg.goto(BASE+'/page'); await pg.evaluate("try{indexedDB.deleteDatabase('frudom-ozon'); localStorage.removeItem('frudom-oz-ui')}catch(e){}")
    await pg.reload(); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pc,e1=await dev(b,1300,900); ph,e2=await dev(b,390,844)
        await pc.evaluate("document.querySelector('nav.tabs button[data-tab=ozon]').click()"); await pc.wait_for_timeout(800)
        f=tempfile.mktemp(suffix='.xlsx'); tot=oz.mk_xlsx(f)
        await pc.set_input_files('#oz-file', f); await pc.wait_for_timeout(3500)
        ok(await pc.evaluate("!Object.keys(__oz.OZ.d.dirty||{}).length"), 'ПК: отчёт отправлен в общее хранилище')
        await ph.evaluate("showTab('ozon')" if False else "(()=>{const b=document.querySelector('[data-tab=ozon]'); if(b) b.click(); else goTab('ozon');})()"); await ph.wait_for_timeout(3000)
        t=await ph.locator('#oz [data-ozk="tot"] b').count()
        v=await ph.locator('#oz [data-ozk="tot"] b').inner_text() if t else ''
        num=lambda s: float(s.replace(' ','').replace('\xa0','').replace('₽','').replace('−','-').replace(',','.'))
        ok(t and num(v)==round(tot), f'телефон: «Пришло на счёт» = {round(tot)} (на экране {v!r})')
        ok(await ph.locator('#oz .ozr[data-ozp]').count()==2, 'телефон: два товара')
        ok(await ph.evaluate("document.documentElement.scrollWidth")==390, 'телефон: без прокрутки вбок')
        # удаление на ПК — пропадает и на телефоне
        await pc.locator('#oz [data-oz="keys"]').first.click(); await pc.wait_for_timeout(600)
        w=pc.locator('[data-ozkey="wipe"]').first; await w.click(); await pc.wait_for_timeout(300); await w.click(); await pc.wait_for_timeout(2500)
        await ph.evaluate("__oz.pull(true)"); await ph.wait_for_timeout(2500)
        ok(await ph.evaluate("!Object.keys((__oz.OZ.d.days||{}).fd||{}).length"), 'удалили на ПК — пропало и на телефоне')
        ok(not e1 and not e2, 'без ошибок на странице '+str(e1+e2)[:300])
        await b.close()
    print('ошибок:', len(fails)); sys.exit(1 if fails else 0)
asyncio.run(main())
