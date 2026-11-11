"""Текст для MAX по умолчанию короткий: без условий приёмки, телефонов и «Загрузить всего»; галочки возвращают."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        # как у старого пользователя: в настройках было load:true
        await pg.evaluate("(()=>{const D=__fd.D(); D.dv={date:'',sup:'',phone:'',full:false,load:true}; D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'}]; D.draft.ship='г. Москва, ул. Тестовая, д. 5';"
            "const c=D.customers.find(x=>x.id===D.draft.customerId)||D.customers[0]; D.draft.customerId=c.id; const k='г. москва, ул. тестовая, д. 5'.replace(/[^a-zа-я0-9]/g,'');"
            "c.points=JSON.stringify({[k]:{phone:'+7 900 111-22-33',contact:'Ольга',phone2:'8-495-000-00-00',note:'Только по подписанной заявке',tag:'Три подписи'}}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(600)
        t=await pg.input_value('#dv-text')
        ok('Накладная #' in t, 'в тексте есть накладная'); ok('Тестовая' in t, 'адрес есть'); ok('(Три подписи)' in t, 'пометка точки в заголовке осталась')
        ok('900 111' not in t and 'Ольга' not in t and '495-000' not in t, 'телефонов нет'); ok('подписанной заявке' not in t, 'условий приёмки нет')
        ok('Загрузить всего' not in t, '«Загрузить всего» нет по умолчанию (даже если раньше было включено)')
        ok(not await pg.is_checked('#dv-load'), 'галочка «Загрузить всего» снята')
        await pg.click('#dv-h .dvfx'); await pg.wait_for_timeout(400)
        await pg.check('#dv-load'); await pg.wait_for_timeout(300); ok('Загрузить всего' in await pg.input_value('#dv-text'), 'галочка возвращает «Загрузить всего»')
        await pg.check('#dv-full'); await pg.wait_for_timeout(300); t=await pg.input_value('#dv-text')
        ok('900 111' in t and 'Ольга' in t and 'подписанной заявке' in t, '«Подробно» — телефоны и условия есть')
        ok(not errs, f'нет ошибок JS {errs[:2]}'); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
