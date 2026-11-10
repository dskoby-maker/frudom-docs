"""Товары по договору в карточке заказчика: кнопка у договора, окно с полными характеристиками, ссылка «Открыть договор»,
переход к товару и «‹ Назад», «Изменить» → сохранить (в таблицу, колонка «Товары и характеристики по договору»), телефон."""
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
            cid,xid,pid=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>!x.priv&&x.id!=='private-buyer'), p=D.products[0];
              let x=D.contracts.find(y=>y.customerId===c.id); if(!x){ x={id:'ct-t',customerId:c.id,supplierId:'',basis:'Договор № Т-1 от 01.01.2026',ikz:'',maxSum:'100000',dateTo:'2026-12-31'}; D.contracts.push(x); }
              x.url='https://drive.google.com/file/d/abc/view'; x.spec=JSON.stringify([{name:'Перчатки резиновые, размер M',chars:'Вид материала: Натуральный латекс.\\nТип рабочей поверхности: Рифленая.',unit:'пар',price:'62.41',qty:'по заявкам',per:'с 01.01.2026 по 31.12.2026',pid:p.id}]);
              return [c.id,x.id,p.id]})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"customers\"]').click()"); await pg.wait_for_timeout(500)
            await pg.select_option('#cus-editor select.pick', cid); await pg.wait_for_timeout(500)
            btn=pg.locator(f'#ct-body [data-ctspec="{xid}"]'); ok(await btn.count()==1 and 'Товары по договору · 1' in await btn.inner_text(), f'{W}: у договора кнопка «Товары по договору · 1»')
            await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(600)
            tx=(await pg.text_content('#fd-dcard')).replace(' ',' ').replace(' ',' ')
            ok('Натуральный латекс' in tx and 'Рифленая' in tx and '62,41' in tx and 'с 01.01.2026 по 31.12.2026' in tx, f'{W}: окно — характеристики, цена, срок')
            a=pg.locator('#fd-dcard a:has-text("Открыть договор")'); ok(await a.count()==1 and await a.get_attribute('href')=='https://drive.google.com/file/d/abc/view' and await a.get_attribute('target')=='_blank', f'{W}: «Открыть договор ↗» ведёт на файл договора')
            # к товару и назад
            await pg.click('#fd-dcard [data-ctsp]'); await pg.wait_for_timeout(900)
            back=pg.locator('#fd-dcard .dc-back, #fd-dcard [data-navback]'); ok(await back.count()>=1, f'{W}: карточка товара открылась с «‹ Назад»')
            await back.first.click(); await pg.wait_for_timeout(800)
            ok('Натуральный латекс' in (await pg.text_content('#fd-dcard') or ''), f'{W}: «Назад» вернул к товарам договора')
            # изменить → добавить позицию → сохранить
            await pg.click('#fd-dcard [data-ctsed]'); await pg.wait_for_timeout(500)
            await pg.click('#fd-dcard [data-ctsadd]'); await pg.wait_for_timeout(200)
            await pg.fill('#fd-dcard .cts-e[data-i="1"] [data-k="name"]','Краги'); await pg.fill('#fd-dcard .cts-e[data-i="1"] [data-k="chars"]','Материал: кожа'); await pg.fill('#fd-dcard .cts-e[data-i="1"] [data-k="price"]','808.43')
            await pg.click('#fd-dcard [data-ctssave]'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#fd-dcard .cts-it').count()==2, f'{W}: после сохранения 2 позиции')
            await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(2000)
            T=dump()['Контракты']; Hh=T[0]; R=[dict(zip(Hh,r)) for r in T[1:]]; row=[r for r in R if r.get('ID (не менять)')==xid]
            sp=json.loads(row[0].get('Товары и характеристики по договору (заполняется с сайта)') or '[]') if row else []
            ok(len(sp)==2 and sp[1]['name']=='Краги' and sp[1]['price']=='808.43', f'{W}: в таблицу записано: {[x.get("name") for x in sp]}')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W and await pg.evaluate("(d=>d.scrollWidth<=d.clientWidth+2)(document.querySelector('#fd-dcard'))"), f'{W}: без прокрутки вбок')
            await pg.screenshot(path=f'/tmp/claude-0/ct-spec-{W}.png')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('\nПРОВАЛОВ:', len(fails)); [print(' -',f) for f in fails]
asyncio.run(main())
