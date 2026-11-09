"""Короткое название заказчика: поле в карточке «Заказчики и цены» → на сайте (выбор заказчика, журнал) короткое,
в документах (счёт/ТОРГ/УПД) — полное; сохраняется в таблицу (колонка «Короткое название»); со старым Code.gs поле закрыто. ПК и телефон."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.loads(urllib.request.urlopen('http://localhost:8787/dump').read())
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
        cid=await pg.evaluate("(()=>{const c=__fd.D().customers.find(x=>/Клиническая|цирк/i.test(x.name))||__fd.D().customers.find(x=>!x.priv&&x.id!=='private-buyer'); return c.id})()")
        full=await pg.evaluate(f"__fd.D().customers.find(x=>x.id==='{cid}').name")
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"customers\"]').click()"); await pg.wait_for_timeout(500)
        await pg.select_option('#cus-editor select.pick', cid); await pg.wait_for_timeout(300)
        inp=pg.locator('#cus-editor [data-k="short"]'); ok(await inp.count()==1 and await inp.is_enabled(), 'поле «Короткое название» есть и доступно')
        await inp.fill('КБ-тест'); await inp.dispatch_event('input'); await inp.dispatch_event('change'); await pg.wait_for_timeout(2500)
        # в таблице
        T=dump()['Заказчики']; H=T[0]; R=[dict(zip(H,r)) for r in T[1:]]; row=[r for r in R if r.get('ID (не менять)')==cid]
        ok(row and row[0].get('Короткое название (только на сайте)')=='КБ-тест' and row[0].get('Наименование')==full, f'в таблице: {row and row[0].get("Короткое название (только на сайте)")}, полное не изменилось')
        # документ
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(500)
        t=await pg.evaluate(f"(()=>{{const o=document.querySelector('#d-cus option[value=\"{cid}\"]'); return o?[o.textContent,o.title]:null}})()")
        ok(t and t[0]=='КБ-тест' and t[1]==full, f'в выборе заказчика коротко, полное — в подсказке: {t}')
        await pg.select_option('#d-cus', cid); await pg.wait_for_timeout(300)
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'2',price:'100'}];})()")
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
        await pg.click('[data-make="invoice"]'); await pg.wait_for_timeout(1500)
        pv=await pg.evaluate("(()=>{const f=[...document.querySelectorAll('iframe')].map(x=>{try{return x.contentDocument.body.innerText}catch(e){return ''}}).join(' '); return f+' '+[...document.querySelectorAll('.doc, .page, #pv-body, #pv-doc, #pv-frame')].map(x=>x.innerText).join(' ')})()"); print('  превью:', pv[:160].replace('\n',' '))
        ok(full.replace('«','').replace('»','')[:15] in pv.replace('«','').replace('»','') and 'КБ-тест' not in pv, 'в счёте — полное название, короткого нет')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click()"); await pg.wait_for_timeout(800)
        jt=await pg.inner_text('#tab-journal'); ok('КБ-тест' in jt, 'в журнале коротко')
        snap=await pg.evaluate("__fd.D().journal.slice(-1)[0].snap.c.name"); ok(snap==full, 'в сохранённом документе — полное название')
        # старый скрипт: поле закрыто
        await pg.evaluate("(()=>{const D=__fd.D(); D.srvVer=23; D.customers.forEach(c=>delete c.short); document.querySelector('nav.tabs button[data-tab=\"customers\"]').click()})()"); await pg.wait_for_timeout(500)
        ok(await pg.locator('#cus-editor [data-k="short"]').is_disabled(), 'со старым Code.gs поле закрыто')
        ok(not errs, f'ошибок нет {errs[:2]}'); await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
