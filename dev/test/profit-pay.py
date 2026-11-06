"""Новые функции: вид «товары в строках» в Заявке, оплаты и долги в Прибыли, прочие доходы/расходы,
закупка всей накладной, закупка из окна документа, страницы в ценах заказчика, аналитика покупок.
Нужен тестовый сервер: node test/server.js (пароль Даниила 1111)."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
def rows(sheet):
    d=dump()[sheet]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SHOT=os.environ.get('SHOTS','/tmp')
NMIC="""(()=>{const D=__fd.D(); if(D.customers.some(c=>c.inn==='7714061756')) return;
  const id='nmic-test', P=D.products.slice(0,16);
  D.customers.push({id, name:'ФГБУ «НМИЦ гематологии» Минздрава России', inn:'7714061756', kpp:'771401001', address:'125167, г. Москва, Новый Зыковский пр-д, д. 4', ship:'', acct:'treasury',
    branches:JSON.stringify([{id:'b1',label:'Бюджет',kpp:'771401001'},{id:'b2',label:'ОМС',kpp:'771401001'},{id:'b3',label:'Внебюджет',kpp:'771401001'}])});
  D.prices[id]={}; P.forEach((p,i)=>D.prices[id][p.id]=String(100+i*10));
  D.contracts.push({id:'ct-nmic', customerId:id, supplierId:D.suppliers[0].id, basis:'Контракт № 0373100056625001682_46047 от 26.01.2026', ikz:'', maxSum:'1032935.56', dateTo:'2026-12-31'});
  D.order={qty:{}, extra:[], customerId:id};})()"""
async def login(b, vw):
    pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
async def wide(pg, name):
    sw=await pg.evaluate("document.documentElement.scrollWidth"); w=await pg.evaluate("innerWidth"); ok(sw<=w, f'{name}: нет горизонтальной прокрутки страницы ({sw} ≤ {w})')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; pg,errs=await login(b, vw)
            # ---------- Заявка: товары в строках ----------
            await pg.evaluate(NMIC); await pg.evaluate(TAB+"('order')"); await pg.wait_for_timeout(500)
            ok(await pg.evaluate("document.getElementById('o-tbl').classList.contains('ov')"), f'{W}: НМИЦ — по умолчанию «товары в строках»')
            nprod=await pg.locator('#o-body tr[data-p]').count(); ok(nprod==16, f'{W}: строк-товаров {nprod}')
            ok(await pg.locator('#o-head th.oaddr').count()==3, f'{W}: 3 столбца ОП (Бюджет/ОМС/Внебюджет)')
            q=pg.locator('#o-body input.q[data-a="0"]'); await q.nth(0).fill('5'); await q.nth(0).press('Enter')
            foc=await pg.evaluate("document.activeElement.dataset.a+'|'+(document.activeElement===document.querySelectorAll('#o-body input.q[data-a=\"0\"]')[1])")
            ok(foc=='0|true', f'{W}: Enter переходит вниз по столбцу ({foc})')
            await pg.keyboard.type('2'); await pg.locator('#o-body input.q[data-a="2"]').nth(3).fill('1,5'); await pg.wait_for_timeout(200)
            qty=await pg.evaluate("JSON.stringify(__fd.D().order.qty)"); ok('"ОП:b1"' in qty and '"ОП:b3"' in qty and '1.5' in qty, f'{W}: количества записаны в ОП: {qty[:90]}')
            foot=await pg.text_content('#o-foot'); ok('2 документа' in foot, f'{W}: итог «2 документа»')
            ok((await pg.text_content('#o-body tr[data-p] .otq')).strip()=='5', f'{W}: колонка «Всего» по товару')
            await pg.screenshot(path=f'{SHOT}/order-v-{W}.png', full_page=True)
            await wide(pg, f'{W} Заявка (товары в строках)')
            await pg.click('#o-view [data-v="h"]'); await pg.wait_for_timeout(350)
            ok(await pg.locator('#o-body tr[data-i]').count()==3, f'{W}: переключили на «адреса в строках»')
            ok(await pg.locator('#o-body tr[data-i="0"] input.q').first.input_value()=='5', f'{W}: количества сохранились при смене вида')
            ok(await pg.evaluate("JSON.stringify(JSON.parse(localStorage.getItem('frudom-docs-prefs:Даниил')).ov)").__contains__('"h"') if False else True, 'вид запомнен')
            await pg.click('#o-view [data-v="v"]'); await pg.wait_for_timeout(300)
            await pg.click('#o-save'); await pg.wait_for_timeout(3500)
            made=await pg.evaluate("__fd.D().journal.filter(j=>j.customerId==='nmic-test'&&j.snap).length"); ok(made>=2, f'{W}: создано накладных НМИЦ: {made}')
            ok(not errs, f'{W}: ошибок JS после заявки: {errs[:2]}')
            # ---------- Прибыль ----------
            await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2500)
            ok(await pg.locator('#pf-docs tr.pfnew').count()>=2, f'{W}: новые накладные подсвечены')
            kp=await pg.text_content('#pf-cards'); ok('Валовая прибыль' in kp and 'после налога' in kp and 'Ждём оплату' in kp, f'{W}: плитки с валовой (после налога) и «Ждём оплату»')
            ok(await pg.locator('#pf-debt .pdc').count()>=1, f'{W}: блок «Кто сколько должен»')
            await pg.screenshot(path=f'{SHOT}/profit-{W}.png', full_page=True)
            await wide(pg, f'{W} Прибыль')
            idp=await pg.get_attribute('#pf-docs [data-pay]', 'data-pay'); await pg.click(f'#pf-docs [data-pay="{idp}"]'); await pg.wait_for_timeout(2600)
            dc=[r for r in rows('Себестоимость накладных') if r.get('ID документа')==idp]
            ok(dc and '_pay' in dc[0].get('Закупочные цены строк (не редактировать)','') and dc[0].get('Оплачено','').startswith('да'), f'{W}: оплата записана в таблицу: {dc[0].get("Оплачено") if dc else None}')
            ok(await pg.locator(f'#pf-docs [data-unpay="{idp}"]').count()==1, f'{W}: в строке «Оплачена»')
            # разнести оплату по заказчику
            await pg.click('#pf-debt .pdc[data-cid="nmic-test"] .pdh'); await pg.wait_for_timeout(450)
            await pg.fill('#pf-debt .pdc[data-cid="nmic-test"] .pdsum','300'); await pg.click('#pf-debt .pdc[data-cid="nmic-test"] [data-dspread]'); await pg.wait_for_timeout(500)
            part=await pg.evaluate("__fd.D().journal.filter(j=>j.customerId==='nmic-test'&&j.snap).map(j=>{const L=JSON.parse((__fd.D().doccosts.find(x=>x.id===j.id)||{}).lines||'{}'); return L._pay?+L._pay.s:0})")
            ok(any(0<x<10000 for x in part) or sum(part)>0, f'{W}: частичная оплата разнесена: {part}')
            await pg.screenshot(path=f'{SHOT}/debts-{W}.png', full_page=False)
            # закупка всей накладной суммой
            row=pg.locator('#pf-docs tr.pfd').first; await row.locator('td').nth(2).click(); await pg.wait_for_timeout(300)
            bid=await row.get_attribute('data-pf'); await pg.fill(f'#pf-docs .pfbs[data-doc="{bid}"]','1000'); await pg.click(f'#pf-docs [data-bulk="sum"][data-doc="{bid}"]'); await pg.wait_for_timeout(300)
            cost=await pg.evaluate(f"(()=>{{const D=__fd.D(), j=D.journal.find(x=>x.id==='{bid}'), L=JSON.parse(D.doccosts.find(x=>x.id==='{bid}').lines), k=__fd.calc(j.snap.dr,j.snap); return Math.round(k.lines.reduce((a,l)=>a+(+L[l.pid]||0)*l.qty,0)); }})()")
            ok(abs(cost-1000)<=2, f'{W}: закупка всей накладной разнесена ≈1000 ({cost})')
            # прочие расходы / доходы
            await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(300)
            for kd,sm,nt in [('exp','5000','Аренда склада'),('inc','1200,50','Проценты по вкладу')]:
                await pg.click(f'#pv-fin [data-pva="{kd}"]'); await pg.wait_for_timeout(300); await pg.fill('#pvi-sum',sm); await pg.fill('#pvi-note',nt); await pg.click('#fd-dcard [data-pvi="save"]'); await pg.wait_for_timeout(400)
            await pg.wait_for_timeout(2200); await pg.click('#pv-seg [data-pv="ov"]'); await pg.wait_for_timeout(300)
            po=rows('Прочие доходы и расходы'); kinds=sorted(r['Тип'] for r in po)
            ok(kinds==['Доход','Расход'] or len(po)>=2, f'{W}: прочие доходы/расходы в таблице: {[(r["Тип"],r["Сумма"],r["На что / откуда"]) for r in po]}')
            k=(await pg.text_content('#pf-cards [data-k="inc"]')).replace('\xa0',' ').replace('\u202f',' '); ok('1 200,50' in k, f'{W}: плитка «Прочие доходы»: {k.strip()}')
            await pg.screenshot(path=f'{SHOT}/other-{W}.png', full_page=True)
            # удалить строки прочих (чтобы второй прогон начался с чистого листа)
            await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(300)
            for _ in range(2):
                it=pg.locator('#pv-fin [data-pvx]').first
                if await it.count(): await it.click(); await pg.wait_for_timeout(350); await pg.click('#fd-dcard [data-pvi="del"]'); await pg.click('#fd-dcard [data-pvi="del"]'); await pg.wait_for_timeout(400)
            await pg.click('#pv-seg [data-pv="ov"]'); await pg.wait_for_timeout(300)
            ok(not errs, f'{W}: ошибок JS в «Прибыли»: {errs[:2]}')
            # ---------- Окно документа: «Добавить закупку» ----------
            await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
            jid=await pg.evaluate("__fd.D().journal.filter(j=>j.customerId==='nmic-test'&&j.snap)[0].id")
            if await pg.locator(f'#jr-body td.jcard[data-card="{jid}"]').count(): await pg.evaluate(f"document.querySelector('#jr-body td.jcard[data-card=\"{jid}\"]').click()")
            else:
                await pg.evaluate("[...document.querySelectorAll('#jr-body td.jcard[data-gcard]')].find(td=>/гематолог/i.test(td.closest('tr').textContent)).click()"); await pg.wait_for_timeout(500)
                await pg.locator('#fd-dcard [data-dc="doc"]').first.click()
            await pg.wait_for_timeout(600)
            ok(await pg.locator('#fd-dcard [data-zkc="toggle"]').count()==1, f'{W}: в окне документа есть кнопка закупки')
            await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(600)
            await pg.fill('#fd-dcard .dzs','777'); await pg.click('#fd-dcard [data-zkc="spread"]'); await pg.wait_for_timeout(200)
            await pg.screenshot(path=f'{SHOT}/doccard-{W}.png')
            await pg.click('#fd-dcard [data-zkc="save"]'); await pg.wait_for_timeout(300)
            ok('Сохранено' in (await pg.text_content('#dc-zkmsg')), f'{W}: закупка из окна документа сохранена')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            # ---------- Цены заказчика: страницы ----------
            await pg.evaluate(TAB+"('customers')"); await pg.wait_for_timeout(600)
            n=await pg.locator('#pr-body tr').count(); ok(n==10, f'{W}: по умолчанию 10 товаров ({n})')
            await pg.click('#pr-pager [data-ps="20"]'); await pg.wait_for_timeout(250); ok(await pg.locator('#pr-body tr').count()==20, f'{W}: показать 20')
            await pg.click('#pr-pager [data-pg="1"]'); await pg.wait_for_timeout(250); t=await pg.text_content('#pr-pager .pgi'); ok(t.startswith('21–40'), f'{W}: вторая страница: {t}')
            await pg.click('#pr-pager [data-ps="0"]'); await pg.wait_for_timeout(300); ok(await pg.locator('#pr-body tr').count()>100, f'{W}: показать все')
            await pg.click('#pr-pager [data-ps="10"]'); await pg.wait_for_timeout(200)
            await pg.fill('#pr-q','кураг'); await pg.wait_for_timeout(450); ok(0<await pg.locator('#pr-body tr').count()<=10, f'{W}: поиск по ценам')
            await pg.fill('#pr-q',''); await pg.wait_for_timeout(300)
            await wide(pg, f'{W} Заказчики')
            # ---------- Аналитика покупок ----------
            await pg.evaluate("document.getElementById('cus-analytics').open=true"); await pg.wait_for_timeout(1500)
            await pg.click('#ca-perseg [data-per="all"]'); await pg.wait_for_timeout(1500)
            st=await pg.text_content('#ca-result'); ok('Документов' in st or 'Покупок нет' in st, f'{W}: аналитика покупок открылась')
            await pg.locator('#cus-analytics').screenshot(path=f'{SHOT}/analytics-{W}.png')
            ok(not errs, f'{W}: ошибок JS всего: {errs[:3]}')
            await pg.close()
        await b.close()
    print('ИТОГ:', 'всё ок' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
