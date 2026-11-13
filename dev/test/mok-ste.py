"""ID СТЕ МОК Талалихина из подписанных УПД (patchMokSte): ставятся в пустые поля «СТЕ» и уходят в таблицу; вписанное раньше не затирается."""
import asyncio, os, re, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
BASE='http://localhost:8787'
HTML=re.sub(r'\}\)\(\);\s*</script>', 'window.T={ev:s=>eval(s)};})();</script>', urllib.request.urlopen(BASE+'/page').read().decode(), count=1)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route(BASE+'/page', lambda r: r.fulfill(status=200, body=HTML, content_type='text/html; charset=utf-8'))
        await pg.goto(BASE+'/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        ev=lambda s: pg.evaluate("s=>T.ev(s)", s)
        await ev("""(()=>{ if(!D.customers.find(c=>c.id==='i2sssar0')) { D.customers.push({id:'i2sssar0', name:'ГАПОУ МОК им. В. Талалихина', inn:'7723920242'}); dirty('customers','i2sssar0'); }
          MOK_STE.forEach(([pid])=>{ if(!prod(pid)) { D.products.push({id:pid, name:'Товар '+pid, unit:'кг'}); dirty('products',pid); } });
          D.specs['i2sssar0']={'cnmx92eg':{spec:'777', ste:'111', art:'A'}}; dirtySpec('i2sssar0','cnmx92eg'); patchMokSte(); })()""")
        for _ in range(20):
            await ev('flush()'); await pg.wait_for_timeout(150)
            if not await ev('hasPending()'): break
        rows=json.loads(urllib.request.urlopen(urllib.request.Request(BASE+'/eval', data=b"JSON.stringify(read_('specs').filter(r=>r.customerId==='i2sssar0'))", method='POST')).read().decode())
        rows=json.loads(rows) if isinstance(rows,str) else rows
        st={r['productId']:r for r in rows}
        ok(st.get('10iyh8dj',{}).get('ste')=='46360446', 'груши: СТЕ 46360446 записан в таблицу')
        ok(st.get('mgd8sl91',{}).get('ste')=='36058953', 'голубика: СТЕ 36058953')
        ok(st.get('cnmx92eg',{}).get('ste')=='111' and st['cnmx92eg'].get('spec')=='777', 'петрушка: вписанное раньше не затёрто')
        ok(len(rows)==12, f'всего строк МОК: {len(rows)} (12 товаров)')
        n=await ev("(patchMokSte(), pend.specs.size)"); ok(n==0, 'повторный запуск ничего не меняет')
        ok(not errs, f'без ошибок {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
