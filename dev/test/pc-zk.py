"""Закупка «за шт»: переключатель ₽/кг ↔ ₽/шт, вес 1 шт (из названия «450г» или запомненный), пересчёт в цену за кг,
сохранение (lines[pid] — за кг, lines._pc — как ввели), повторное открытие, «Разнести по товарам», комплект, телефон."""
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
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def mkdoc(pg, jid, lines):
    ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
async def open_doc(pg, jid):
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400)
    await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
    await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(900)
R='#dc-zki .dzl .dzr'
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-mk','Макароны Макфа 450г','150','кг'],['p-yb','Яблоки','90','кг'],['p-yo','Йогурт','40','шт']].forEach(([id,n,pr,u])=>{ D.products.push({id, name:n, code:'', unit:u, country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
        await mkdoc(pg,'pc1',[('p-mk','9'),('p-yb','10'),('p-yo','5')])
        await open_doc(pg,'pc1')
        ok(await pg.locator(f'{R} .pcsw').count()==2, 'переключатель ₽/кг ↔ ₽/шт есть только у товаров в кг')
        await pg.click(f'{R}:nth-child(1) [data-pcu="pc"]'); await pg.wait_for_timeout(200)
        g=await pg.input_value(f'{R}:nth-child(1) .pcg'); ok(g=='450', f'вес 1 шт взят из названия «450г»: {g}')
        ok(await pg.evaluate("document.activeElement.classList.contains('pcp')"), 'курсор сразу в цене за 1 шт')
        await pg.keyboard.type('47'); await pg.wait_for_timeout(150)
        res=(await pg.text_content(f'{R}:nth-child(1) .pcres')).replace(' ',' '); ok('104,44 ₽/кг' in res and '2,22 шт' in res, f'пересчёт: 47 ₽ за 450 г = 104,44 ₽/кг: {res}')
        zks=(await pg.text_content('#dc-zks')).replace(' ',' '); ok('940,00' in zks.split('Закупка')[1][:12], f'закупка 9 кг × 104,44 = 940,00: {zks[:60]}')
        await pg.fill(f'{R}:nth-child(2) .dzc','30')
        await pg.screenshot(path=f'{SHOT}/pc-1.png')
        await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(500); await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1500)
        L=costL('pc1'); ok(L.get('p-mk')=='104.4444' and L.get('_pc',{}).get('p-mk')=={'g':'450','p':'47'} and L.get('p-yb')=='30' and 'p-yb' not in L.get('_pc',{}), f'сохранено: за кг 104.4444, как ввели — 47 ₽ / 450 г: {L}')
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(300)
        await open_doc(pg,'pc1')
        ok(await pg.input_value(f'{R}:nth-child(1) .pcp')=='47' and await pg.input_value(f'{R}:nth-child(1) .pcg')=='450', 'после открытия снова «за шт»: 47 ₽ и 450 г')
        # разнести одной суммой: 900 на макароны+яблоки по выручке
        await pg.fill('#dc-zki .dzs','1000'); await pg.click('#dc-zki [data-zkc="spread"]'); await pg.wait_for_timeout(200)
        h=await pg.input_value(f'{R}:nth-child(1) .dzc'); pcp=await pg.input_value(f'{R}:nth-child(1) .pcp')
        ok(abs(float(h.replace(',','.'))*0.45-float(pcp.replace(',','.')))<0.01, f'«Разнести» обновил и цену за 1 шт: {h} ₽/кг → {pcp} ₽/шт')
        # обратно в кг
        await pg.click(f'{R}:nth-child(1) [data-pcu="kg"]'); await pg.wait_for_timeout(200)
        ok(await pg.locator(f'{R}:nth-child(1) .pcg').count()==0 and await pg.input_value(f'{R}:nth-child(1) .dzc')==h, f'обратно в кг — видна цена за кг {h}')
        await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(500); await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1500)
        L=costL('pc1'); ok('_pc' not in L or 'p-mk' not in L['_pc'], f'в режиме кг «за шт» не хранится: {L}')
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(300)
        # комплект: свой вес 400 г — запоминается
        await mkdoc(pg,'pc2',[('p-mk','4')]); await mkdoc(pg,'pc3',[('p-mk','6')])
        await pg.evaluate("__fd.D().journal.filter(j=>['pc2','pc3'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tpc'}); })")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400); await pg.click('#jr-body tr.grp td[data-gcard]'); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(900)
        await pg.click('#bz-zki .dzl .dzr:nth-child(1) [data-pcu="pc"]'); await pg.wait_for_timeout(200)
        await pg.fill('#bz-zki .pcg','400'); await pg.fill('#bz-zki .pcp','40'); await pg.wait_for_timeout(150)
        zks=(await pg.text_content('#bz-zks')).replace(' ',' '); ok('1 000,00' in zks, f'комплект: 10 кг × 100 ₽/кг = 1 000: {zks[:50]}')
        await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(500); await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1500)
        for j in ['pc2','pc3']:
            L=costL(j); ok(L.get('p-mk')=='100' and L.get('_pc',{}).get('p-mk')=={'g':'400','p':'40'}, f'{j}: 100 ₽/кг и «40 ₽ за 400 г»: {L}')
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(300)
        await mkdoc(pg,'pc4',[('p-mk','2')]); await open_doc(pg,'pc4')
        await pg.click(f'{R}:nth-child(1) [data-pcu="pc"]'); await pg.wait_for_timeout(200)
        ok(await pg.input_value(f'{R}:nth-child(1) .pcg')=='400', 'новая накладная: вес 1 шт подставлен из запомненного (400 г)')
        ok(not errs, f'ошибок нет {errs[:2]}'); await ctx.close()
        ctx,pg,errs=await login(b,(390,844)); await open_doc(pg,'pc4')
        await pg.click(f'{R}:nth-child(1) [data-pcu="pc"]'); await pg.wait_for_timeout(200)
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=390, f'телефон: нет прокрутки вбок ({sw})')
        await pg.locator('#dc-zki').screenshot(path=f'{SHOT}/pc-phone.png'); ok(not errs, f'телефон: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
