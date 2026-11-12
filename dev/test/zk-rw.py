"""Закупка «Со склада»: в кг нехватка, а товар пришёл в штуках (450 г) — подсказка и «Перевести в кг» одним нажатием, после — хватает."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, t=9000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        W=int(os.environ.get('W','1300'))
        pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          D.products.push({id:'p-fas', name:'Фасоль продовольственная', code:'', unit:'кг', country:'', price:'300'}); D.prices[c.id]['p-fas']='300'; })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Фасоль белая бланш 450г',unit:'шт',qty:'45',price:'147',date:'2026-11-10',exp:'',supplier:'Даня',docRef:''}]},'тест')")
        await pg.wait_for_timeout(800)
        d=await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'fas1', customerId:window.__cid, number:'', lines:[{productId:'p-fas',qty:'20.25',price:'300'}]}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2000)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"fas1\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); ok(await until(pg,"!!document.querySelector('#dc-zki .dzl')"),'блок закупки открыт')
        await pg.click('#dc-zki .dzr:nth-child(1) [data-dzm="s"]'); await pg.wait_for_timeout(200)
        await pg.fill('#dc-zki .dzr:nth-child(1) .skpq','фасоль'); await pg.wait_for_timeout(150); await pg.press('#dc-zki .dzr:nth-child(1) .skpq','Enter'); await pg.wait_for_timeout(300)
        inf=await pg.text_content('#dc-zki .dzr:nth-child(1) .dzinf'); print(inf)
        ok(('не хватает' in inf or 'нет в единицах' in inf) and '45 шт' in inf and '20,25' in inf, 'нехватка в кг + подсказка: 45 шт ≈ 20,25 кг')
        await pg.click('[data-skrwq]'); await pg.wait_for_timeout(150)
        t=await pg.text_content('[data-skrwq]'); ok('Да' in t, f'первое нажатие — подтверждение: {t}')
        await pg.click('[data-skrwq]')
        ok(await until(pg,"(()=>{const e=document.querySelector('#dc-zki .dzr:nth-child(1) .dzinf'); return e && !/не хватает|нет в единицах|Перевести/.test(e.textContent) && /20,25/.test(e.textContent)})()", 15000), 'после перевода — хватает, 20,25 кг со склада')
        print(await pg.text_content('#dc-zki .dzr:nth-child(1) .dzinf'))
        bs=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Склад: партии')
        ok(any('Перевзвешено' in ' '.join(map(str,r)) for r in bs[1:]), 'в таблице новая партия «Перевзвешено…» в кг')
        inf2=await pg.text_content('#dc-zki .dzr:nth-child(1) .dzinf'); ok('6615,00' in ''.join(inf2.split()).replace('\u202f','').replace('\u00a0',''), f'себестоимость без лишних копеек: {inf2.strip()[:80]}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        row=await pg.evaluate("[...document.querySelectorAll('.skrow')].map(r=>r.textContent).find(t=>/Фасоль/.test(t))||''")
        ok('20,25' in row and '45 шт' in row, f'на складе видно 20,25 кг и 45 шт: {row[:120]}')
        await pg.screenshot(path='/tmp/sklist.png')
        # товар без указанной фасовки — штуки по весу из названия
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Рис Кубань 900г',unit:'кг',qty:'9',price:'100',date:'2026-11-11',exp:'',supplier:'',docRef:''}]},'тест')")
        await pg.wait_for_timeout(1500)
        row=await pg.evaluate("[...document.querySelectorAll('.skrow')].map(r=>r.textContent).find(t=>/Рис Кубань/.test(t))||''")
        ok('10 шт' in row, f'фасовка из названия (900г): 9 кг = 10 шт: {row[:100]}')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, 'нет прокрутки вбок')
        ok(not errs, f'ошибок нет: {errs}')
        await pg.screenshot(path='/tmp/zkrw.png')
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
