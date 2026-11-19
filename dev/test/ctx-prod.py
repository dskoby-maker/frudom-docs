"""Меню правой кнопкой «где используется товар» (19.11.2026): в окне товара склада (связанная позиция и «Похоже по названию»),
в окне накладной (название товара), во «Товарах», на складе; меню договора в «Заказчики и цены». Договор → «Товары по договору», заказчик → его карточка. PH=1 — телефон."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); W=VW[0]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
MENU="(()=>{const m=document.querySelector('.jcx.in'); return m?m.innerText:''})()"
async def rc(pg, sel):
    el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(350)
    await el.click(button='right'); await pg.wait_for_timeout(450); return await pg.evaluate(MENU)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':VW[0],'height':VW[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), A=D.customers.find(c=>!c.priv), B=D.customers.find(c=>!c.priv&&c.id!==A.id); window.__A=A.id; window.__B=B.id;
          D.products.push({id:'p-kr', name:'Крахмалы, кроме модифицированных', code:'', unit:'кг', country:'', price:'120'});
          D.prices[B.id]=D.prices[B.id]||{}; D.prices[B.id]['p-kr']='130';
          D.contracts.push({id:'ct-kr', customerId:A.id, supplierId:D.suppliers[0].id, basis:'Контракт № 142-ТСТ от 29.01.2026', short:'Насонова ТСТ', sum:'1000', dateTo:'2027-03-05',
            spec:JSON.stringify([{name:'Крахмал картофельный', unit:'кг', price:120.45, qty:50, pid:'p-kr'}])});
          ['products','contracts'].forEach(k=>D[k].forEach(x=>{})); })()""")
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.customerId=window.__A; D.draft.contractId='ct-kr'; D.draft.lines=[{productId:'p-kr',qty:'3',price:'120.45',qOk:'3',pOk:'120.45'},{productId:'',qty:'',price:''}];})()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(1800)
        # «Товары»
        await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(600)
        await pg.evaluate("(()=>{const q=document.querySelector('#pd-q'); if(q){q.value='Крахмалы'; q.dispatchEvent(new Event('input',{bubbles:true}));}})()"); await pg.wait_for_timeout(500)
        await pg.wait_for_timeout(900); t=await rc(pg, '#pd-body .nmr[data-id="p-kr"]')
        if not t: t=await rc(pg, '#pd-body .nmr[data-id="p-kr"]')
        ok('Договор «Насонова ТСТ»' in t and 'Прайс заказчика' in t, f'{W}: «Товары» — видно договор и прайс: {t[:160]!r}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # окно накладной
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
        jid=await pg.evaluate("__fd.D().journal[0].id")
        await pg.evaluate(f"docCard(__fd.D().journal.find(j=>j.id==='{jid}'))") if False else None
        await pg.locator(f'[data-card="{jid}"]').first.click(); await pg.wait_for_timeout(900)
        t=await rc(pg, 'dialog.dcard[open] [data-dcpd="p-kr"]')
        ok('Договор «Насонова ТСТ»' in t, f'{W}: окно накладной — меню открылось поверх окна: {t[:120]!r}')
        ok(await pg.evaluate("!!document.querySelector('dialog.dcard[open] .jcx.in')"), f'{W}: меню внутри окна (не под ним)')
        await pg.locator('.jcx.in .jcx-i', has_text='Договор «Насонова ТСТ»').click(); await pg.wait_for_timeout(900)
        ok('Крахмал картофельный' in await pg.inner_text('dialog.dcard[open]'), f'{W}: нажали договор — открылись «Товары по договору»')
        ok(await pg.locator('dialog.dcard[open] .dc-back').count()>0, f'{W}: есть «‹ Назад» к накладной')
        for _ in range(3):
            if await pg.evaluate("!!document.querySelector('dialog.dcard[open]')"): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        # заказчик из прайса → карточка заказчика
        await pg.locator(f'[data-card="{jid}"]').first.click(); await pg.wait_for_timeout(900)
        await rc(pg, 'dialog.dcard[open] [data-dcpd="p-kr"]')
        await pg.locator('.jcx.in .jcx-i', has_text='Прайс заказчика').click(); await pg.wait_for_timeout(900)
        ok(await pg.evaluate("curTab")=='customers' if False else await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"customers\"]').classList.contains('on')||location.hash==='#zakazchiki'"), f'{W}: прайс → вкладка «Заказчики и цены»')
        ok(not await pg.evaluate("!!document.querySelector('dialog.dcard[open]')"), f'{W}: окно закрылось')
        # договор в «Заказчики и цены»
        await pg.evaluate("(()=>{const s=document.querySelector('#cus-editor select.pick, #cus-editor select'); if(s){s.value=window.__A; s.dispatchEvent(new Event('change',{bubbles:true}));}})()"); await pg.wait_for_timeout(700)
        if await pg.locator('#ct-body [data-id="ct-kr"]').count():
            t=await rc(pg, '#ct-body [data-id="ct-kr"] .cth, #ct-body [data-id="ct-kr"]')
            ok('Товары по договору' in t and 'Скопировать основание' in t, f'{W}: меню договора: {t[:120]!r}')
            await pg.keyboard.press('Escape')
        else: ok(False, f'{W}: карточка договора не нашлась')
        # склад: окно товара, связанная позиция и подсказка
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Крахмал 400г Исток ТСТ',unit:'кг',qty:'5',price:'60',date:'2026-11-01',exp:'',supplier:'',docRef:''}]},'приход')"); await pg.wait_for_timeout(900)
        it=await pg.evaluate("Object.values(__sk.idx().item).find(i=>i.name.startsWith('Крахмал 400г')).id")
        await pg.evaluate(f"__sk.item2('{it}')"); await pg.wait_for_timeout(900)
        if await pg.locator('dialog.dcard[open] .sklsb[data-sklink^="p-kr"]').count():
            t=await rc(pg, 'dialog.dcard[open] .sklsb[data-sklink^="p-kr"]')
            ok('Связать с этим товаром склада' in t and 'Договор «Насонова ТСТ»' in t, f'{W}: подсказка «Похоже по названию» — меню с договором')
            await pg.locator('.jcx.in .jcx-i', has_text='Связать с этим товаром склада').click(); await pg.wait_for_timeout(1500)
        else: ok(False, f'{W}: подсказки нет')
        ok(await pg.locator('dialog.dcard[open] .sklink[data-pid="p-kr"]').count()>0, f'{W}: связалось')
        t=await rc(pg, 'dialog.dcard[open] .sklink[data-pid="p-kr"]')
        ok('Договор «Насонова ТСТ»' in t and 'Убрать связь' in t, f'{W}: связанная позиция — меню с договором')
        await pg.screenshot(path=f'/tmp/claude-0/ctxm-{W}.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("!!document.querySelector('dialog.dcard[open]')"), f'{W}: Esc закрыл только меню, окно осталось')
        await pg.screenshot(path=f'/tmp/claude-0/ctxp-{W}.png')
        ok(await pg.evaluate('document.documentElement.scrollWidth')<=W, f'{W}: без прокрутки вбок')
        ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
