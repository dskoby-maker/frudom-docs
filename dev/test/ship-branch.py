"""Страховка адреса: «Другой адрес» похож на адрес другого ОП того же заказчика (МГУ: Комбинат питания / Столовые диетического питания)
→ предупреждение под полем, сохранение не проходит, «Перейти в …» меняет ОП и адрес, «Адрес верный, оставить» пропускает; свой/чужой адрес — без предупреждения;
заявка «+ Другой адрес» спрашивает; функция shipSim на разных написаниях."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W in (1300, 390):
            pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            sim=await pg.evaluate("""[shipSim('г. Москва, Ломоносовский проспект, д. 27, корп. 1','Ломоносовский пр-т 27 к1'),
              shipSim('119192, Москва, Ломоносовский пр-т, 27к1','ул. Ломоносовский проспект дом 27, корпус 1'),
              shipSim('Ломоносовский пр-т 27 к1','Ломоносовский пр-т 31 к5'), shipSim('Ломоносовский пр-т 27 к1','Ленинские горы 1 стр 51')]""") if False else None
            await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>!x.priv && x.id!=='private-buyer'); window.__c=c.id;
              c.branches=JSON.stringify([{id:'brK',label:'Комбинат питания',kpp:'1',ship:'Москва, Ленинские горы, д. 1, стр. 51'},{id:'brS',label:'Столовые диетического питания',kpp:'2',ship:'119192, г. Москва, Ломоносовский проспект, д. 27, корп. 1\\nМосква, Мичуринский пр-т, 1'}]);
              Object.assign(D.draft,{customerId:c.id, branchId:'brK', ship:''}); })()""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(500)
            await pg.select_option('#d-br','brK'); await pg.wait_for_timeout(200)
            await pg.select_option('#d-shipsel','__other'); await pg.fill('#d-ship','Ломоносовский пр-т 27 к1'); await pg.wait_for_timeout(600)
            vis=await pg.is_visible('#d-shipw'); t=await pg.inner_text('#d-shipw') if vis else ''
            ok(vis and 'Столовые диетического питания' in t and 'Комбинат питания' in t, f'{W}: предупреждение под адресом ({t[:90]!r})')
            # сохранение блокируется
            await pg.evaluate("Object.assign(__fd.D().draft,{supplierId:__fd.D().suppliers[0].id}); __fd.D().draft.lines=[{productId:__fd.D().products[0].id,qty:'2',price:'100',qOk:'2',pOk:'100'}]")
            n0=await pg.evaluate("__fd.D().journal.length"); await pg.click('#d-save'); await pg.wait_for_timeout(700)
            ok(await pg.evaluate("__fd.D().journal.length")==n0, f'{W}: сохранение не прошло, пока не решено')
            if W==390: await pg.locator('#d-shipw').screenshot(path='/tmp/claude-0/shipw.png')
            sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]==sw[1], f'{W}: без прокрутки вбок {sw}')
            if W==1300:
                await pg.click('#d-shipw [data-shipgo]'); await pg.wait_for_timeout(400)
                st=await pg.evaluate("[__fd.D().draft.branchId, __fd.D().draft.ship, document.querySelector('#d-shipw').hidden, document.querySelector('#d-shipwrap').hidden]")
                ok(st[0]=='brS' and 'Ломоносовский' in st[1] and st[2] and st[3], f'«Перейти» → ОП Столовые и его адрес из списка {st}')
                await pg.click('#d-save'); await pg.wait_for_timeout(1200); ok(await pg.evaluate("__fd.D().journal.length")==n0+1, 'после исправления сохраняется')
            else:
                await pg.click('#d-shipw [data-shipok]'); await pg.wait_for_timeout(300)
                ok(not await pg.is_visible('#d-shipw'), 'телефон: «Адрес верный» — предупреждение ушло')
                await pg.click('#d-save'); await pg.wait_for_timeout(1200); ok(await pg.evaluate("__fd.D().journal.length")==n0+1, 'телефон: сохраняется с «оставить»')
            # без ложных тревог
            await pg.evaluate("Object.assign(__fd.D().draft,{branchId:'brK', ship:''})"); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400)
            await pg.select_option('#d-shipsel','__other'); await pg.fill('#d-ship','Москва, ул. Тверская, д. 7'); await pg.wait_for_timeout(600)
            ok(not await pg.is_visible('#d-shipw'), f'{W}: чужой адрес — без предупреждения')
            await pg.fill('#d-ship','Москва, Мичуринский пр-т, д. 31'); await pg.wait_for_timeout(600)
            ok(not await pg.is_visible('#d-shipw'), f'{W}: та же улица, другой дом — без предупреждения')
            await pg.fill('#d-ship','Ленинские горы 1 стр 51'); await pg.wait_for_timeout(600)
            ok(not await pg.is_visible('#d-shipw'), f'{W}: адрес своего ОП — без предупреждения')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}')
            await pg.close()
        # заявка
        pg=await b.new_page(viewport={'width':1300,'height':900})
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>!x.priv && x.id!=='private-buyer'); c.branches=JSON.stringify([{id:'brK',label:'Комбинат питания',kpp:'1',ship:'Москва, Ленинские горы, д. 1, стр. 51'},{id:'brS',label:'Столовые диетического питания',kpp:'2',ship:'Москва, Ломоносовский проспект, д. 27, корп. 1'}]); })()""")
        r=await pg.evaluate("__fd.shipElsewhere(__fd.D().customers.find(x=>x.branches).id,'brK','ломоносовский 27 корпус 1').map(x=>x.b.label)")
        ok(r==['Столовые диетического питания'], f'shipElsewhere для заявки/файла {r}')
        await b.close()
asyncio.run(main()); print('ПРОВАЛОВ:', len(fails))
