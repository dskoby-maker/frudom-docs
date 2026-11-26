"""Календарь: маленькая лупа — поиск по всем дням (накладные и задачи), подсветка дней, переход к дню и накладной. PH=1 — телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    vp={'width':390,'height':844} if PH else {'width':1300,'height':900}
    ctx=await b.new_context(viewport=vp, is_mobile=PH, has_touch=PH); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0], s=D.suppliers[0]; window.__cid=c.id; window.__sid=s.id;
      D.products.push({id:'cq-a', name:'Картофель молодой', code:'', unit:'кг', country:'', price:'50'}, {id:'cq-b', name:'Лук репчатый', code:'', unit:'кг', country:'', price:'40'}); }""")
    dates=['2026-09-14','2026-10-03','2026-11-20']
    for i,(d,pid) in enumerate([(dates[0],'cq-a'),(dates[1],'cq-b'),(dates[2],'cq-a')]):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'cqd{i}', customerId:window.__cid, supplierId:window.__sid, date:'{d}', number:'', lines:[{{productId:'{pid}',qty:'5',price:'50',pOk:'50',qOk:'5'}}]}}); }}""")
        if PH: await pg.evaluate(TAB+"('doc')")
        else: await pg.evaluate(TAB+"('doc')")
        await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    ok(await pg.evaluate("__fd.D().journal.filter(j=>j.id.startsWith('cqd')).length")==3, 'три накладные в разных месяцах')
    await pg.evaluate("""()=>{const D=__fd.D(); D.daytasks=D.daytasks||[]; D.daytasks.push({id:'cqt1', date:'2026-08-05', text:'Забрать **ящики** у картофельного склада', by:'Даниил', customerId:''}); }""")
    await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(700)
    btn=pg.locator('#cal-qb'); ok(await btn.is_visible(), 'лупа видна в шапке календаря')
    bb=await btn.bounding_box(); ok(bb and bb['width']<=(110 if PH else 32), f'кнопка маленькая ({bb})')
    await btn.click(); await pg.wait_for_timeout(300)
    ok(await pg.locator('#cal-qi').is_visible(), 'открылось поле поиска')
    ok(await pg.evaluate("document.activeElement.id")=='cal-qi', 'курсор в поле')
    await pg.fill('#cal-qi','картоф'); await pg.wait_for_timeout(400)
    s=await pg.text_content('#cal-qr'); print('  ', s[:160])
    ok('2 накладные' in s and '1 задача' in s and '3 дня' in s, 'найдены 2 накладные и задача за 3 дня (все месяцы)')
    first=await pg.locator('#cal-qr .calqdh').first.text_content(); ok('20 ноября' in first, f'сначала новые дни ({first})')
    ok(await pg.locator('#cal-qr mark').count()>0, 'найденное выделено')
    # подсветка дней в сетке текущего месяца
    hit=await pg.evaluate("[...document.querySelectorAll('#cal-grid .qhit')].map(b=>b.dataset.d)")
    ok('2026-11-20' in hit, f'день подсвечен в календаре ({hit})')
    # по номеру
    num=await pg.evaluate("__fd.D().journal.find(j=>j.id==='cqd1').number")
    await pg.fill('#cal-qi', '№'+str(num)); await pg.wait_for_timeout(400)
    ok(await pg.locator('#cal-qr [data-calqj="cqd1"]').count()==1, f'поиск по номеру №{num}')
    # нажатие на накладную: переходит на месяц и открывает накладную
    await pg.locator('#cal-qr [data-calqj="cqd1"]').click(); await pg.wait_for_timeout(900)
    ok(await pg.evaluate("__fd.D().cal.sel")=='2026-10-03', 'выбран день накладной')
    title=await pg.text_content('#cal-title'); ok('октябрь' in title.lower(), f'календарь перешёл на месяц ({title})')
    ok(await pg.evaluate("!!document.querySelector('#fd-dcard[open]')"), 'открылось окно накладной')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#cal-qi').is_visible(), 'поиск остался открыт после закрытия накладной')
    # Enter — к следующему дню
    await pg.fill('#cal-qi','картоф'); await pg.wait_for_timeout(300); await pg.focus('#cal-qi')
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("__fd.D().cal.sel")=='2026-11-20', 'Enter — первый найденный день')
    await pg.focus('#cal-qi'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("__fd.D().cal.sel")=='2026-09-14', 'Enter ещё раз — следующий день')
    # задача
    await pg.locator('#cal-qr [data-calqt="cqt1"]').click(); await pg.wait_for_timeout(900)
    ok(await pg.evaluate("__fd.D().cal.sel")=='2026-08-05', 'нажатие на задачу — её день')
    ok(await pg.locator('#dt-list [data-dt="cqt1"]').count()==1, 'задача видна в «Задачах на день»')
    # ничего не нашлось
    await pg.fill('#cal-qi','зззнеттакого'); await pg.wait_for_timeout(400)
    ok('Ничего не нашлось' in await pg.text_content('#cal-qr'), 'пустой результат')
    ok(await pg.evaluate("document.querySelectorAll('#cal-grid .qhit').length")==0, 'нет подсветки дней')
    # Esc: очистить, второй Esc — закрыть
    await pg.focus('#cal-qi'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    ok(await pg.input_value('#cal-qi')=='', 'Esc очистил поле')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
    ok(not await pg.locator('#cal-qi').is_visible(), 'второй Esc закрыл поиск')
    ok(await pg.evaluate("document.querySelectorAll('#cal-grid .qhit,#cal-grid .qdim').length")==0, 'после закрытия подсветки нет')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
    ok(not errs, 'нет ошибок JS '+str(errs[:2]))
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
