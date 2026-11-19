"""Склад → «Товары»: по умолчанию только товары в наличии, переключатель «В наличии / Все товары», выбор помнится. PH=1 — телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'; W=390 if PH else 1300
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
NAMES="[...document.querySelectorAll('#sk-list .skrow[data-skitem] .skn b')].map(b=>b.textContent.trim())"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':W,'height':860}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Есть ТСТ',unit:'кг',qty:'5',price:'60',date:'2026-11-01',exp:'',supplier:'',docRef:''},{itemId:'',newName:'Пусто ТСТ',unit:'кг',qty:'2',price:'60',date:'2026-11-01',exp:'',supplier:'',docRef:''}]},'приход')"); await pg.wait_for_timeout(1200)
        it=await pg.evaluate("Object.values(__sk.idx().item).find(i=>i.name==='Пусто ТСТ').id"); bt=await pg.evaluate(f"__sk.idx().byItem['{it}'][0].id")
        await pg.evaluate(f"__sk.send('wo',{{batchId:'{bt}', qty:'2', reason:'тест'}},'списание')"); await pg.wait_for_timeout(1200)
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(800)
        N=await pg.evaluate(NAMES)
        if 'Пусто ТСТ' in N: print('   (списание не прошло, проверяю по фактическому остатку)')
        zero=await pg.evaluate(f"__sk.fact('{bt}')")
        ok(zero==0, f'{W}: товар «Пусто ТСТ» без остатка ({zero})')
        ok('Есть ТСТ' in N and 'Пусто ТСТ' not in N, f'{W}: по умолчанию только в наличии: {N}')
        ok(await pg.is_visible('.skstk'), f'{W}: переключатель виден')
        await pg.click('.skstk [data-skstk="all"]'); await pg.wait_for_timeout(500)
        N=await pg.evaluate(NAMES); ok('Пусто ТСТ' in N, f'{W}: «Все товары» — видны и без остатка')
        await pg.reload(); await pg.wait_for_timeout(2500); await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        N=await pg.evaluate(NAMES); ok('Пусто ТСТ' in N, f'{W}: выбор помнится после перезагрузки')
        await pg.click('.skstk [data-skstk="in"]'); await pg.wait_for_timeout(500)
        await pg.fill('#sk-q','Пусто'); await pg.wait_for_timeout(500)
        t=await pg.inner_text('#sk-list'); ok('Показать все' in t, f'{W}: поиск по товару без остатка — подсказка «Показать все»')
        await pg.click('#sk-list .skempty [data-skstk="all"]'); await pg.wait_for_timeout(500)
        ok('Пусто ТСТ' in await pg.evaluate(NAMES), f'{W}: кнопка показала товар')
        await pg.fill('#sk-q',''); await pg.click('.skstk [data-skstk="in"]'); await pg.wait_for_timeout(500)
        await pg.locator('#sk-list').screenshot(path=f'/tmp/claude-0/skin-{W}.png')
        ok(await pg.evaluate('document.documentElement.scrollWidth')<=W, f'{W}: без прокрутки вбок')
        ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
