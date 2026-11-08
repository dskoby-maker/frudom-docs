"""«Заполнено по прошлым данным» — слово «прошлым данным» нажимается и открывает окно: из каких накладных (дата, №, заказчик, точка)
и какой вес 1 упаковки сайт взял; строка-источник отмечена «вес взят отсюда»; накладная открывается и «‹ Назад» возвращает к окну. ПК и телефон."""
import asyncio
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SETUP="""(()=>{const D=__fd.D(), c=D.customers.find(x=>!x.priv && x.id!=='private-buyer'), p=D.products[0]; p.packs=JSON.stringify({'кор':4});
  const mk=(id,date,num,q,n,auto)=>({id, supplierId:D.suppliers[0].id, customerId:c.id, number:num, date, sum:0, updated:date+'T10:00:00Z',
    snap:{dr:{id, supplierId:D.suppliers[0].id, customerId:c.id, number:num, date, ship:'Москва, ул. Тестовая, д. 5', lines:[{productId:p.id, qty:String(q), price:'100', pack:{n, u:'кор', t:n+' кор'}, ...(auto?{auto:'x'}:{})}]}, s:D.suppliers[0], c, prods:{}}});
  D.journal.push(mk('pk1','2026-10-01','501',15,3,0), mk('pk2','2026-10-20','502',8,2,0), mk('pk3','2026-11-01','503',12,3,1));
  Object.assign(D.draft,{customerId:c.id}); D.draft.lines=[{productId:p.id, qty:'12', price:'100', pack:{n:3,u:'кор',t:'3 кор'}, auto:'Заполнено по прошлым данным: в заявке «3 кор», 1 кор ≈ 4 кг. Проверьте вес.'}]; return p.name; })()"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W in (1300, 390):
            pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            name=await pg.evaluate(SETUP); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(500)
            lk=pg.locator('#d-lines [data-packh]'); ok(await lk.count()==1 and (await lk.inner_text())=='прошлым данным', f'{W}: «прошлым данным» — кнопка')
            await lk.click(); await pg.wait_for_timeout(500)
            d=pg.locator('#fd-dcard'); txt=await d.inner_text()
            ok('1 кор ≈ 4 кг' in txt and '«3 кор» → 12 кг' in txt, f'{W}: заголовок и что сейчас подставлено')
            rows=d.locator('[data-pkhdoc]'); ok(await rows.count()==3, f'{W}: три накладные')
            first=await rows.nth(0).inner_text(); ok('01.11.2026' in first and '503' in first and 'подставлено сайтом' in first, f'{W}: последняя сверху, «подставлено сайтом»')
            src=await d.locator('.pkh-r.src').inner_text(); ok('20.10.2026' in src and 'вес взят отсюда' in src and 'вписано вручную' in src, f'{W}: источник — последняя вписанная вручную с тем же весом')
            ok('Тестовая' in txt, f'{W}: видна точка доставки')
            ok('разный вес' in txt and '4 кг' in txt and '5 кг' not in txt.split('разный вес')[1][:5], f'{W}: предупреждение о разном весе (4 и 4,5? -> {[t for t in txt.splitlines() if "разный" in t]})')
            sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]==sw[1], f'{W}: без прокрутки вбок {sw}')
            if W==390: await d.screenshot(path='/tmp/claude-0/pkh390.png')
            else: await d.screenshot(path='/tmp/claude-0/pkh1300.png')
            await rows.nth(1).click(); await pg.wait_for_timeout(700)
            t2=await pg.locator('#fd-dcard').inner_text(); ok('502' in t2 and await pg.locator('#fd-dcard .dc-back').first.is_visible(), f'{W}: открылась накладная № 502 с «Назад»')
            await pg.locator('#fd-dcard .dc-back').first.click(); await pg.wait_for_timeout(700)
            ok('Вес упаковки' in await pg.locator('#fd-dcard').inner_text(), f'{W}: «Назад» вернул окно веса')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
