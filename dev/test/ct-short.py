"""Короткое название договора (только на сайте): поле в таблице договоров → в таблицу «Контракты», в выборе договора — «Краги · Фамилия», полное серым; в документ идёт полное основание."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            cid,xid,sid=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>!x.priv&&x.id!=='private-buyer'), s=D.suppliers[0];
              let x=D.contracts.find(y=>y.customerId===c.id); if(!x){ x={id:'ct-t',customerId:c.id,supplierId:s.id,basis:'Договор № Т-1 от 01.01.2026',ikz:'',maxSum:'100000',dateTo:'2026-12-31'}; D.contracts.push(x); }
              x.supplierId=x.supplierId||s.id; return [c.id,x.id,x.supplierId]})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"customers\"]').click()"); await pg.wait_for_timeout(500)
            await pg.select_option('#cus-editor select.pick', cid); await pg.wait_for_timeout(500)
            inp=pg.locator(f'#ct-body tr[data-id="{xid}"] input[data-k="short"]'); ok(await inp.count()==1 and not await inp.is_disabled(), f'{W}: поле короткого названия есть')
            await inp.scroll_into_view_if_needed(); await inp.fill('Краги'); await inp.dispatch_event('change'); await pg.wait_for_timeout(300)
            await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(2000)
            T=dump()['Контракты']; Hh=T[0]; R=[dict(zip(Hh,r)) for r in T[1:]]; row=[r for r in R if r.get('ID (не менять)')==xid]
            ok(row and row[0].get('Короткое название (только на сайте)')=='Краги', f'{W}: в таблицу записано «Краги»')
            # новый документ
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); D.draft.supplierId='{sid}'; D.draft.customerId='{cid}'; D.draft.contractId='{xid}';}})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(700)
            o=await pg.evaluate(f"""(()=>{{const o=document.querySelector('#d-ctr option[value="{xid}"]'); return o?[o.textContent,o.dataset.full||'']:null}})()""")
            ok(o and o[0].startswith('Краги ·') and 'Договор' in o[1] or (o and 'Краги' in o[0] and o[1]), f'{W}: в выборе договора: {o}')
            cpk=pg.locator('#d-ctr ~ .cpk, .cpkw:has(#d-ctr) .cpk'); txt=(await cpk.first.inner_text()) if await cpk.count() else ''
            ok('Краги' in txt, f'{W}: кнопка выбора показывает короткое: {txt[:60]!r}')
            await pg.evaluate(f"(s=>{{s.value='';s.dispatchEvent(new Event('change',{{bubbles:true}}));s.value='{xid}';s.dispatchEvent(new Event('change',{{bubbles:true}}))}})(document.querySelector('#d-ctr'))"); await pg.wait_for_timeout(300)
            bs=await pg.evaluate("document.querySelector('#d-basis').value"); ok('Краги' not in bs and len(bs)>3, f'{W}: основание в документе полное: {bs!r}')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
