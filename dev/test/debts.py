"""Прибыль → Долги: добавить, частично погасить, всё погашено, правка, закрыть без оплаты, удалить; запись в таблицу «Долги»; телефон без прокрутки вбок; пробелы в суммах."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows():
    T=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Долги') or [[]]
    return [dict(zip(T[0],r)) for r in T[1:]]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"profit\"]').click()"); await pg.wait_for_timeout(1500)
            await pg.click('[data-pv="debt"]'); await pg.wait_for_timeout(500)
            nm=f'Тест-долг {W}'
            await pg.fill('#db-name', nm); await pg.click('#db-sum'); await pg.keyboard.type('150000')
            v=await pg.evaluate("document.querySelector('#db-sum').value"); shown=await pg.evaluate("Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').get.call(document.querySelector('#db-sum'))")
            ok(shown=='150 000', f'{W}: сумма с пробелами при вводе: {shown!r}')
            await pg.fill('#db-note','за машину'); await pg.click('[data-dbadd]'); await pg.wait_for_timeout(500)
            card=pg.locator('.dbc', has_text=nm); ok(await card.count()==1, f'{W}: долг появился')
            tx=await pg.text_content('#pv-debt'); ok('150 000' in tx.replace(' ',' ').replace(' ',' '), f'{W}: плитка «Мне должны» 150 000')
            # частичное погашение
            if not await pg.locator('#db-pay').count(): await card.locator('[data-dbopen]').click(); await pg.wait_for_timeout(300)
            await pg.click('#db-pay'); await pg.keyboard.type('50000'); await card.locator('[data-dbpay]').click(); await pg.wait_for_timeout(500)
            card=pg.locator('.dbc', has_text=nm); t2=(await card.inner_text()).replace(' ',' ').replace(' ',' ')
            ok('100 000' in t2, f'{W}: после погашения 50 000 осталось 100 000')
            # правка суммы меньше погашенного — отказ
            await card.locator('.db-sum').fill('40000'); await card.locator('[data-dbedit]').click(); await pg.wait_for_timeout(300)
            x=await pg.evaluate(f"__fd.D().debts.find(x=>x.name==='{nm}')"); ok(x and float(x['sum'])==150000, f'{W}: сумму меньше погашенного не даёт')
            # всё погашено (двойное нажатие)
            card=pg.locator('.dbc', has_text=nm)
            if not await card.locator('[data-dball]').count(): await card.locator('[data-dbopen]').click(); await pg.wait_for_timeout(300)
            await card.locator('[data-dball]').click(); await pg.wait_for_timeout(150); await pg.locator('.dbc', has_text=nm).locator('[data-dball]').click(); await pg.wait_for_timeout(500)
            x=await pg.evaluate(f"__fd.D().debts.find(x=>x.name==='{nm}')"); ok(x and x['closed']=='1' and float(x['paid'])==150000, f'{W}: «Всё погашено» закрыл долг: paid={x and x["paid"]}')
            await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(2000)
            R=[r for r in rows() if r.get('Кто')==nm]; ok(R and R[0].get('Закрыт')=='1' and len(json.loads(R[0].get('Погашения (не редактировать)') or '[]'))==2, f'{W}: в таблице «Долги»: {R and (R[0].get("Сумма"),R[0].get("Погашено"),R[0].get("Закрыт"))}')
            # Я должен + просрочка
            nm2=f'Кредитор {W}'
            await pg.click('[data-dbk="Я должен"]') if await pg.locator('[data-dbk="Я должен"]').count() else None
            k=await pg.evaluate("[...document.querySelectorAll('[data-dbk]')].map(b=>b.dataset.dbk)"); 
            await pg.evaluate("[...document.querySelectorAll('[data-dbk]')][1].click()"); await pg.wait_for_timeout(200)
            await pg.fill('#db-name', nm2); await pg.fill('#db-sum','20000'); await pg.fill('#db-due','2026-01-01'); await pg.click('[data-dbadd]'); await pg.wait_for_timeout(500)
            tx=(await pg.text_content('#pv-debt')).replace(' ',' ').replace(' ',' ')
            ok('просрочен' in tx and '20 000' in tx, f'{W}: «Я должен» с просрочкой видно')
            await pg.click('[data-dbf="late"]'); await pg.wait_for_timeout(200); ok(await pg.locator('.dbc').count()>=1 and await pg.locator('.dbc', has_text=nm).count()==0, f'{W}: фильтр «Просрочены»')
            await pg.click('[data-dbf="all"]'); await pg.wait_for_timeout(200)
            c2=pg.locator('.dbc', has_text=nm2)
            if not await c2.locator('[data-dbdel]').count(): await c2.locator('[data-dbopen]').click(); await pg.wait_for_timeout(300)
            await c2.locator('[data-dbdel]').click(); await pg.wait_for_timeout(200)
            if await pg.locator('.dbc', has_text=nm2).count(): await pg.locator('.dbc', has_text=nm2).locator('[data-dbdel]').click(); await pg.wait_for_timeout(300)
            ok(await pg.locator('.dbc', has_text=nm2).count()==0, f'{W}: удаление')
            await pg.click('.dbkpi [data-dbf="in"]'); await pg.wait_for_timeout(300); ok(await pg.evaluate("document.querySelector('#db-tools [data-dbf=in]').classList.contains('on')"), f'{W}: плитка «Мне должны» нажимается → фильтр')
            ok(await pg.locator('.toast', has_text='Долг удалён').count()==0, f'{W}: при удалении одно уведомление')
            ok(await pg.evaluate("document.querySelector('#db-name').value")=='', f'{W}: после «Добавить» поле «Кто» пустое')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок ({await pg.evaluate("document.documentElement.scrollWidth")})')
            await pg.screenshot(path=f'/tmp/claude-0/-home-claude/e050705b-f8b4-506e-91d5-ab48c1c4f576/scratchpad/debts{W}.png', full_page=False)
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
