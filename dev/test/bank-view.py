"""Поступления → «Выбрать накладные…» / «Приход вручную»: у каждой накладной «Открыть», внизу «Посмотреть отмеченные»; «Назад» возвращает окно с теми же отметками."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    W,H=(390,844) if PH else (1300,900)
    pg=await (await b.new_context(viewport={'width':W,'height':H})).new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; window.__sid=D.suppliers[0].id;
      D.products.push({id:'bv-a', name:'Гречка', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['bv-a']='100';}""")
    for i,q in enumerate(['3','4']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'bvd{i}{"p" if PH else ""}', customerId:window.__cid, supplierId:window.__sid, number:'', lines:[{{productId:'bv-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500)
    await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-bank [data-bn="man"]'); await pg.wait_for_timeout(500)
    cid=await pg.evaluate("window.__cid"); await pg.select_option('#bnp-c', cid); await pg.wait_for_timeout(300)
    await pg.check('#bnp-all'); await pg.wait_for_timeout(300)
    rows=pg.locator('#bnp-l .bnpr'); n=await rows.count(); ok(n>=2, f'накладные в списке: {n}')
    ok(await pg.locator('#bnp-l .bnpr .bnpv').count()==n, 'у каждой накладной кнопка «Открыть»')
    for i in range(2): await rows.nth(i).locator('.bnpc').check()
    await pg.fill('#bnp-sum','123'); await pg.wait_for_timeout(200)
    ok(await pg.locator('#bnp-t .bnpv.all').count()==1, 'внизу «Посмотреть отмеченные»')
    num=(await rows.nth(0).locator('.bnpn b').text_content()).strip()
    ids=await pg.evaluate("[...document.querySelectorAll('#bnp-l .bnpc:checked')].map(x=>x.dataset.id)")
    await rows.nth(0).locator('.bnpv').click(); await pg.wait_for_timeout(700)
    h=await pg.text_content('#fd-dcard .dc-head h3'); k=await pg.text_content('#fd-dcard .dc-head .dc-kicker'); ok(num in k and await pg.locator('#bnp-l').count()==0, f'открылась накладная {num}: {k} — {h}')
    ok(await pg.locator('#fd-dcard .dc-back').count()>=1, 'сверху «‹ Приход вручную»')
    await pg.screenshot(path='/tmp/bv-doc%s.png'%('-ph' if PH else ''))
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(700)
    ok(await pg.locator('#bnp-l').count()==1, 'Esc вернул окно прихода')
    ids2=await pg.evaluate("[...document.querySelectorAll('#bnp-l .bnpc:checked')].map(x=>x.dataset.id)")
    ok(sorted(ids)==sorted(ids2), f'отметки на месте: {ids2}')
    ok(await pg.input_value('#bnp-sum')=='123', 'сумма прихода на месте'); ok(await pg.input_value('#bnp-c')==cid, 'заказчик на месте')
    ok(await pg.is_checked('#bnp-all'), '«показать всех ИП» на месте')
    await pg.click('#bnp-t .bnpv.all'); await pg.wait_for_timeout(800)
    h=await pg.text_content('#fd-dcard'); ok('Комплект' in h or 'документа' in h, 'отмеченные открылись вместе')
    await pg.screenshot(path='/tmp/bv-all%s.png'%('-ph' if PH else ''))
    await pg.click('#fd-dcard [data-navback]'); await pg.wait_for_timeout(700)
    ok(await pg.locator('#bnp-l .bnpc:checked').count()==len(ids), 'после «Назад» отметки на месте')
    await pg.screenshot(path='/tmp/bv-pick%s.png'%('-ph' if PH else ''))
    sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw==W, f'без прокрутки вбок: {sw}')
    ok(not errs, f'ошибок нет: {errs}')
    print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
