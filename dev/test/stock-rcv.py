"""Склад: «Все приходы» (окно со всеми приходами: по дням, поиск, период, раскрытие накладной, переход в партию)
и плитки в карточке товара склада (средняя закупка, последний приход, ушло за 30 дней, хватит, стоимость, приходов) — ПК и телефон."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
STK="JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('frudom-stock:'))))"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        seeded=False
        for W,H in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
            S=lambda op,d: pg.evaluate(f"__sk.send('{op}',{json.dumps(d,ensure_ascii=False)},'тест').then(j=>j&&j.out||1)")
            if not seeded:
                seeded=True
                await pg.evaluate("(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{}; D.products.push({id:'p-mak', name:'Изделия макаронные (лапша)', code:'', unit:'кг', country:'', price:'200'}); D.prices[c.id]['p-mak']='200'; })()")
                await S('bulk',{'kind':'in','rows':[
                    {'itemId':'','newName':'Макароны Макфа Лапша 450г','unit':'кг','qty':'18','price':'138.89','date':'2026-11-05','exp':'','supplier':'Таня (Авокадо)','docRef':''},
                    {'itemId':'','newName':'Цикорий Красная волна','unit':'шт','qty':'200','price':'45','date':'2026-11-05','exp':'','supplier':'Таня (Авокадо)','docRef':''}]})
                it=await pg.evaluate(f"{STK}.items.find(i=>i.name.startsWith('Макароны')).id")
                await S('bulk',{'kind':'in','rows':[{'itemId':it,'newName':'','unit':'кг','qty':'72','price':'158.44','date':'2026-11-13','exp':'2027-03-01','supplier':'ООО "РегионПродукт"','docRef':'35027'}]})
                await S('item',{'itemId':it,'links':['p-mak']})
                await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'dr1', customerId:window.__cid, number:'', lines:[{productId:'p-mak',qty:'6',price:'200',stk:{m:'s'},lid:'L1'}]}); })()")
                await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2500)
                await S('ship',{'docId':'dr1','lines':[{'lineId':'L1','qty':'6'}]})
                await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
            it=await pg.evaluate(f"{STK}.items.find(i=>i.name.startsWith('Макароны')).id")
            # кнопка «Все приходы»
            ok(await pg.is_visible('#tab-stock [data-sk="rcv"]'), f'{W}: на складе есть кнопка «Все приходы»')
            await pg.click('#tab-stock [data-sk="rcv"]'); await pg.wait_for_timeout(600)
            txt=await pg.text_content('#sk-dlg')
            ok('Приходы' in txt and 'РегионПродукт' in txt and 'Таня' in txt, f'{W}: окно приходов показывает обоих поставщиков')
            ok(await pg.locator('#sk-dlg .skrc').count()==2, f'{W}: два прихода (накладная Тани с двумя товарами — одним приходом)')
            ok(await pg.locator('#sk-dlg .skrcd').count()==2, f'{W}: приходы разложены по дням')
            await pg.fill('#sk-dlg .skrcq input','РегионПродукт'); await pg.wait_for_timeout(500)
            ok(await pg.locator('#sk-dlg .skrc').count()==1, f'{W}: поиск по поставщику')
            ok(await pg.evaluate("document.activeElement && document.activeElement.closest('.skrcq')!==null"), f'{W}: курсор остался в поиске')
            await pg.fill('#sk-dlg .skrcq input',''); await pg.wait_for_timeout(500)
            await pg.locator('#sk-dlg .skrc').filter(has_text='Таня').locator('.skrch').click(); await pg.wait_for_timeout(450)
            ok(await pg.locator('#sk-dlg .skrc.open .skrcl').count()==2, f'{W}: раскрытый приход показывает 2 товара')
            await pg.screenshot(path=f'/tmp/claude-0/skrc-{W}.png')
            await pg.locator('#sk-dlg .skrc.open .skrcl').first.click(); await pg.wait_for_timeout(600)
            ok('Партия' in (await pg.text_content('#sk-dlg')), f'{W}: строка открывает партию')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#sk-dlg .skrc').count()==2, f'{W}: «Назад» вернул к приходам')
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: без прокрутки вбок ({sw})')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            # карточка товара — плитки
            await pg.locator('#sk-list .skrow').filter(has_text='Макароны').first.click(); await pg.wait_for_timeout(700)
            T=await pg.evaluate("[...document.querySelectorAll('#sk-dlg .skt')].map(t=>t.innerText.replace(/\\s+/g,' '))")
            ok(len(T)>=6, f'{W}: в карточке товара {len(T)} плиток')
            j=' | '.join(T)
            ok('Средняя закупка' in j and 'Последний приход' in j and 'Ушло за 30 дней' in j and '6 кг' in j and 'хватит' in j and 'Стоимость остатка' in j and 'Приходов 2' in j and 'Ближайший срок' in j, f'{W}: плитки: {j}')
            ok('▲' in j, f'{W}: рост цены последней закупки показан')
            await pg.evaluate("document.querySelector('#sk-dlg .skts').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300); await pg.screenshot(path=f'/tmp/claude-0/skt-{W}.png')
            await pg.click('#sk-dlg [data-skit="out"]'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#sk-dlg .skh-f [data-skhff="out"].on').count()==1, f'{W}: «Ушло за 30 дней» → история с фильтром «Ушло»')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
            await pg.click('#sk-dlg [data-skit="rcv"]'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#sk-dlg .skrc').count()==2 and await pg.input_value('#sk-dlg .skrcq input')!='', f'{W}: «Приходов» → приходы этого товара')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
            await pg.locator('#sk-dlg [data-skit^="last:"]').first.click(); await pg.wait_for_timeout(600)
            ok('РегионПродукт' in (await pg.text_content('#sk-dlg')), f'{W}: «Последний приход» → партия')
            ok(not errs, f'{W}: без ошибок {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
