"""Почта в памяти устройства (24.11.2026): список писем и открытые письма не грузятся заново,
тихая подгрузка, пока на сайте ничего не делают.
Запуск ПОСЛЕ test/mail.py на том же сервере (там подключаются ящики и приходят письма)."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
W=int(os.environ.get('W','1300'))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, n=60):
    for _ in range(n):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(250)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx=await b.new_context(viewport={'width':W,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        ops=[]
        def onreq(r):
            try:
                d=json.loads(r.post_data or '{}')
                if d.get('action')=='mail': ops.append(d.get('op'))
            except Exception: pass
        pg.on('request', onreq)
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(TAB+"('mail')")
        ok(await until(pg, "document.querySelectorAll('#ml-list .mlr').length>0", 80), "письма появились")
        await pg.wait_for_timeout(2500)
        # открыть письмо — один запрос get
        n0=ops.count('get')
        await pg.click('#ml-list .mlr >> nth=0'); await until(pg, "!/Загружаю письмо/.test(document.querySelector('#ml-view')?.textContent||'')", 40)
        ok(ops.count('get')==n0+1, f"первое открытие письма — запрос к таблице ({ops.count('get')-n0})")
        await pg.wait_for_timeout(2000)  # список и текст сохраняются на устройство
        # перезагрузка страницы: письмо открывается без запроса
        ops.clear(); await pg.reload(); await pg.wait_for_timeout(2500)
        await pg.evaluate(TAB+"('mail')")
        ok(await until(pg, "document.querySelectorAll('#ml-list .mlr').length>0", 8), "после перезагрузки список виден сразу (из памяти устройства)")
        ok('sync' not in ops, f"ящики заново не проверялись — только свежие отметки из таблицы ({ops})")
        await pg.click('#ml-list .mlr >> nth=0'); await until(pg, "!/Загружаю письмо/.test(document.querySelector('#ml-view')?.textContent||'')", 20)
        txt=await pg.evaluate("document.querySelector('#ml-view').textContent")
        ok(ops.count('get')==0, f"открытое раньше письмо — без загрузки (get: {ops.count('get')})")
        ok(len(txt)>40 and 'не загрузился' not in txt, "текст письма показан")
        # тихая подгрузка: остальные письма загружаются, пока ничего не делают
        ops.clear()
        await pg.evaluate("__mlCache.idle()")
        await until(pg, "!__mlCache.st.run", 80)
        got=ops.count('get')
        ok(got>=1, f"в фоне заранее загружены тексты писем ({got})")
        has=await pg.evaluate("(async()=>{ const L=[...document.querySelectorAll('#ml-list .mlr')].map(e=>e.dataset.mlid); let n=0; for(const id of L) if(await __mlCache.has(id)) n++; return [n, L.length]; })()")
        ok(has[0]>=min(has[1],3), f"письма в памяти устройства: {has[0]} из {has[1]}")
        # пока работают (нажатия) — фон не грузит
        ops.clear()
        await pg.evaluate("__mlCache.st.last=Date.now()")
        await pg.mouse.click(5,5)
        await pg.wait_for_timeout(16000)
        ok(ops.count('get')==0 and ops.count('sync')==0, f"когда работают — ничего не грузит ({ops})")
        # открытие уже загруженного в фоне — без запроса
        ops.clear()
        n=await pg.evaluate("document.querySelectorAll('#ml-list .mlr').length")
        if n>1:
            await pg.click('#ml-list .mlr >> nth=1'); await pg.wait_for_timeout(600)
            ok(ops.count('get')==0, "письмо, загруженное в фоне, открылось сразу")
        if W<700:
            ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), "без прокрутки вбок")
        ok(not errs, f"нет ошибок JS {errs}")
        await b.close()
    print("ИТОГ:", "ошибок нет" if not fails else f"ошибок: {len(fails)}")
asyncio.run(main())
