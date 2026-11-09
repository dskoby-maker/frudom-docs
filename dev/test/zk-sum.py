"""Сумма рядом с ценой в закупке: вписали сумму — цена за кг считается сама (шиповник 20 кг, 4700 → 235 ₽/кг); вписали цену — сумма сама;
«Куплено фактически» при сумме пересчитывает цену, при цене — сумму; «Разнести по товарам» обновляет суммы; ₽/шт; сохранение и
повторное открытие; комплект; телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def costL(jid):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Себестоимость накладных') or [[]]; h=d[0]
    for r in d[1:]:
        x=dict(zip(h,r))
        if x.get('ID документа')==jid: return json.loads(x['Закупочные цены строк (не редактировать)'] or '{}')
    return {}
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
R='#dc-zki .dzl .dzr'
V=lambda sel: f"document.querySelector('{sel}').value"
async def mkdoc(pg, jid, lines):
    ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
async def open_doc(pg, jid):
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400)
    await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
    await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(900)
async def amount_beside_price(pg, row, price):
    p = await pg.locator(f'{row} {price}').bounding_box()
    t = await pg.locator(f'{row} .dzt').bounding_box()
    return p is not None and t is not None and abs(p['y'] - t['y']) < 1 and p['x'] + p['width'] <= t['x']
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
              [['p-sh','Ягоды сушеные (шиповник)','248.2','кг'],['p-ka','Какао-порошок','693.5','кг'],['p-mk','Макароны 450г','150','кг']].forEach(([id,n,pr,u])=>{ if(!D.products.some(x=>x.id===id)) D.products.push({id, name:n, code:'', unit:u, country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
            jid=f'zs{W}'
            await mkdoc(pg, jid, [('p-sh','20'),('p-ka','5.4'),('p-mk','9')])
            await open_doc(pg, jid)
            ok(await pg.locator(f'{R} .dzt').count()==3, f'{W}: у каждого товара есть поле «сумма»')
            ok(await amount_beside_price(pg, f'{R}:nth-child(1)', '.dzc'), f'{W}: сумма и цена за кг в одном ряду')
            # шиповник: сумма 4700 → 235
            await pg.fill(f'{R}:nth-child(1) .dzt','4700'); await pg.wait_for_timeout(150)
            ok(await pg.evaluate(V(f'{R}:nth-child(1) .dzc'))=='235', f'{W}: 20 кг, сумма 4700 → цена 235 ₽/кг ({await pg.evaluate(V(R+":nth-child(1) .dzc"))})')
            hint=(await pg.text_content(f'{R}:nth-child(1) .dztr em')).replace(' ',' '); ok('235,00 ₽/кг' in hint, f'{W}: подсказка «= 235,00 ₽/кг»: {hint}')
            zks=(await pg.text_content('#dc-zks')).replace(' ',' ').replace(' ',' ')
            ok('4 700,00' in zks, f'{W}: закупка в итогах 4 700: {zks[:80]}')
            ok(await pg.input_value(f'{R}:nth-child(1) .dzt')=='4 700', f'{W}: сумма с пробелом по тысячам')
            # купили больше — цена пересчитывается от суммы
            await pg.fill(f'{R}:nth-child(1) .dzb','23.5'.replace('.',',')); await pg.wait_for_timeout(150)
            ok(await pg.evaluate(V(f'{R}:nth-child(1) .dzc'))=='200', f'{W}: куплено 23,5 кг при сумме 4700 → 200 ₽/кг ({await pg.evaluate(V(R+":nth-child(1) .dzc"))})')
            # какао: вписали цену — сумма считается
            await pg.fill(f'{R}:nth-child(2) .dzc','500'); await pg.wait_for_timeout(150)
            ok(await pg.evaluate(V(f'{R}:nth-child(2) .dzt'))=='2700', f'{W}: цена 500 × 5,4 кг → сумма 2700 ({await pg.evaluate(V(R+":nth-child(2) .dzt"))})')
            await pg.fill(f'{R}:nth-child(2) .dzb','6'); await pg.wait_for_timeout(150)
            ok(await pg.evaluate(V(f'{R}:nth-child(2) .dzt'))=='3000' and await pg.evaluate(V(f'{R}:nth-child(2) .dzc'))=='500', f'{W}: при цене «куплено 6» меняет сумму (3000), цена та же')
            # дробная цена: 1000 за 3 кг
            await pg.fill(f'{R}:nth-child(2) .dzb',''); await pg.fill(f'{R}:nth-child(2) .dzt','1000'); await pg.fill(f'{R}:nth-child(2) .dzb','3'); await pg.wait_for_timeout(150)
            ok(await pg.evaluate(V(f'{R}:nth-child(2) .dzc'))=='333,3333', f'{W}: 1000 за 3 кг → 333,3333 ₽/кг')
            zks=(await pg.text_content('#dc-zks')).replace(' ',' ').replace(' ',' ')
            ok('5 700,00' in zks, f'{W}: итог закупки 4700 + 1000 = 5 700 (без копеечных хвостов): {zks[:80]}')
            # ₽/шт: сумма → цена за кг и за 1 шт
            await pg.click(f'{R}:nth-child(3) [data-pcu="pc"]'); await pg.wait_for_timeout(200)
            ok(await amount_beside_price(pg, f'{R}:nth-child(3)', '.pcp'), f'{W}: сумма и цена за шт в одном ряду')
            await pg.fill(f'{R}:nth-child(3) .dzt','900'); await pg.wait_for_timeout(150)
            pp=await pg.input_value(f'{R}:nth-child(3) .pcp'); kg=await pg.evaluate(V(f'{R}:nth-child(3) .dzc'))
            ok(kg=='100' and pp.replace(' ','') in ('45','45,00'), f'{W}: ₽/шт: 900 за 9 кг → 100 ₽/кг, 45 ₽ за 1 шт (450 г): {kg} / {pp}')
            # «Разнести по товарам» — суммы следуют за ценами
            await pg.fill('#dc-zki .dzs','9000'); await pg.click('#dc-zki [data-zkc="spread"]'); await pg.wait_for_timeout(400)
            S=[await pg.evaluate(V(f'{R}:nth-child({i}) .dzt')) for i in (1,2,3)]
            tot=sum(float(x.replace(',','.') or 0) for x in S); zt=(await pg.text_content('#dc-zks')).replace('\u00a0','').replace('\u202f','').replace(' ','')
            ok(abs(tot-9000)<0.5 and f"{tot:.2f}".replace('.',',') in zt, f'{W}: после «Разнести» суммы строк пересчитались и сходятся с итогом закупки: {S} = {tot:.2f}')
            await pg.screenshot(path=f'/tmp/claude-0/zk-sum-{W}.png')
            # сохранить и открыть заново
            await pg.fill(f'{R}:nth-child(1) .dzt','4700'); await pg.fill(f'{R}:nth-child(1) .dzb',''); await pg.wait_for_timeout(150)
            await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(600); await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1500)
            L=costL(jid); ok(str(L.get('p-sh'))=='235', f'{W}: в таблицу записана цена за кг 235: {L.get("p-sh")}')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400); await open_doc(pg, jid)
            ok(await pg.evaluate(V(f'{R}:nth-child(1) .dzt'))=='4700', f'{W}: после повторного открытия сумма 4700 видна сама')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W and await pg.evaluate("(d=>d.scrollWidth<=d.clientWidth+2)(document.querySelector('#fd-dcard'))"), f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('\nПРОВАЛОВ:', len(fails)); [print(' -',f) for f in fails]
asyncio.run(main())
