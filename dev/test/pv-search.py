"""Поиск в «Прибыль → Расходы и доходы»: по «на что», категории (бензин → «Бензин и машина»), без окончаний; итоги (потрачено,
получено, в среднем, последний раз), по месяцам (нажатие — только месяц), категории-чипы, подсветка, «за всё время / этот месяц», очистка, телефон."""
import asyncio, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
t=datetime.date.today(); m0=t.replace(day=2).isoformat(); pm=(t.replace(day=1)-datetime.timedelta(days=1)).replace(day=12).isoformat(); pp=(t.replace(day=1)-datetime.timedelta(days=40)).replace(day=5).isoformat()
N=lambda s:(s or '').replace(' ',' ').replace(' ',' ')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
            await pg.evaluate(f"""(()=>{{const D=__fd.D(); D.pother=(D.pother||[]).filter(x=>!/^ts-/.test(x.id)); [
              ['ts-1','{pp}','Расход','3000','Бензин АИ-95','c-fuel'],['ts-2','{pm}','Расход','2500','Заправка','c-fuel'],['ts-3','{m0}','Личное','1200','Бензина на дачу',''],
              ['ts-4','{m0}','Расход','800','Такси','c-dlv'],['ts-5','{m0}','Доход','500','Возврат за бензин','c-ret']].forEach(([id,date,kind,sum,note,cat])=>D.pother.push({{id,date,kind,sum,note,cat,catName:'',supplierId:'',by:'Даниил'}})); }})()""")
            await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(500)
            ok(await pg.locator('#pv-fsq').count()==1, f'{W}: строка поиска есть')
            await pg.fill('#pv-fsq','бензин'); await pg.wait_for_timeout(400)
            ok(await pg.evaluate("document.querySelector('#pv-fmain').hidden"), f'{W}: при поиске обычная сводка спрятана')
            n=await pg.locator('#pv-fsr .pvit').count(); ok(n==4, f'{W}: найдено 4 записи (бензин, заправка по категории, «бензина», возврат): {n}')
            ok('Такси' not in await pg.text_content('#pv-fsr'), f'{W}: лишнего нет')
            tl=N(await pg.text_content('#pv-fsr .pvfsts')); ok('−6 700,00' in tl and '+500,00' in tl, f'{W}: потрачено 6 700, получено 500: {tl[:120]}')
            ok('Последний раз' in tl, f'{W}: плитка «Последний раз»')
            ok(await pg.locator('#pv-fsr mark').count()>=2, f'{W}: совпадения подсвечены')
            ok(await pg.locator('#pv-fsr .pvfsmr').count()==3, f'{W}: по месяцам — 3 месяца')
            await pg.click('#pv-fsr .pvfsmr:nth-of-type(2)'); await pg.wait_for_timeout(300)
            n2=await pg.locator('#pv-fsr .pvit').count(); ok(n2==1, f'{W}: нажали на месяц — осталась 1 запись: {n2}')
            await pg.click('#pv-fsr [data-pvfs="reset"]'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#pv-fsr .pvit').count()==4, f'{W}: «все найденные» — снова 4')
            cats=await pg.locator('#pv-fsr .pvfscb').count(); ok(cats==3, f'{W}: чипы категорий (бензин и машина, личное, возвраты): {cats}')
            await pg.click('#pv-fsr .pvfscb:first-child'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#pv-fsr .pvit').count()==2, f'{W}: чип «Бензин и машина» — 2 записи')
            await pg.click('#pv-fsr [data-pvfs="sc:mon"]'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#pv-fsr .pvit').count()==2, f'{W}: «этот месяц» — 2 записи')
            await pg.click('#pv-fsr [data-pvfs="sc:all"]'); await pg.wait_for_timeout(300)
            # нажатие на запись — открывается её окно
            await pg.click('#pv-fsr .pvit:first-of-type'); await pg.wait_for_timeout(500)
            ok(await pg.locator('#fd-dcard #pvi-sum').count()==1, f'{W}: нажатие на запись открывает её')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
            ok(await pg.input_value('#pv-fsq')=='бензин' and await pg.locator('#pv-fsr .pvit').count()==4, f'{W}: после закрытия окна поиск остался')
            await pg.fill('#pv-fsq','холодильник'); await pg.wait_for_timeout(300)
            ok('Ничего не нашлось' in await pg.text_content('#pv-fsr'), f'{W}: ничего — понятное сообщение')
            await pg.fill('#pv-fsq','такс'); await pg.wait_for_timeout(300); ok(await pg.locator('#pv-fsr .pvit').count()==1, f'{W}: «такс» — такси')
            await pg.fill('#pv-fsq','800'); await pg.wait_for_timeout(300); ok(await pg.locator('#pv-fsr .pvit').count()==1, f'{W}: по сумме «800»')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            await pg.fill('#pv-fsq','бензин'); await pg.wait_for_timeout(300); await pg.screenshot(path=f'/tmp/claude-0/pv-search-{W}.png', full_page=False)
            await pg.click('#pv-fin [data-pvfs="clear"]'); await pg.wait_for_timeout(300)
            ok(not await pg.evaluate("document.querySelector('#pv-fmain').hidden") and await pg.input_value('#pv-fsq')=='', f'{W}: «×» — поиск очищен, сводка вернулась')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('\nПРОВАЛОВ:', len(fails)); [print(' -',f) for f in fails]
asyncio.run(main())
