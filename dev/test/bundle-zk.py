"""Закупка на комплект: одна цена за товар сразу во все накладные комплекта, «разнести одной суммой»,
прочие расходы делятся по накладным, нетронутые товары не перезаписываются, повторное открытие, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def costs():
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Себестоимость накладных') or [[]]; h=d[0]
    return {r[h.index('ID документа')]:dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)}
def L(c, jid): return json.loads((c.get(jid) or {}).get('Закупочные цены строк (не редактировать)') or '{}')
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def open_bundle(pg):
    await pg.evaluate("__fd.D().journal.filter(j=>['bz1','bz2','bz3'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tb1'}); })")
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
    await pg.click('#jr-body tr.grp td[data-gcard]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#fd-dcard [data-bzk="toggle"]').count()==1, 'в окне комплекта есть кнопка закупки')
    await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(800)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-ma','Макароны фигурные','104.18'],['p-fa','Фасоль','297.66']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
        for jid, lines in [('bz1',[('p-ma','12'),('p-fa','10')]),('bz2',[('p-ma','8'),('p-fa','10')]),('bz3',[('p-ma','4')])]:
            ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        await open_bundle(pg)
        rows=await pg.evaluate("[...document.querySelectorAll('#bz-zki .dzr:not(.dzx) span b')].map(b=>b.textContent)")
        ok(rows==['Макароны фигурные','Фасоль'], f'строки — товары комплекта без повторов: {rows}')
        sm=await pg.evaluate("[...document.querySelectorAll('#bz-zki .dzr:not(.dzx) span small')].map(b=>b.textContent)")
        ok('24 кг' in sm[0] and '3 накладные' in sm[0] and '20 кг' in sm[1] and '2 накладные' in sm[1], f'количество суммой по накладным: {sm}')
        # одна сумма: 24×60 + 20×150 = 4440 → разнести
        await pg.fill('#bz-zki .bzs','4440'); await pg.click('#bz-zki [data-bzk="spread"]'); await pg.wait_for_timeout(200)
        v=await pg.evaluate("[...document.querySelectorAll('#bz-zki .bzc')].map(i=>i.value)")
        tot=24*float(v[0].replace(',','.'))+20*float(v[1].replace(',','.')); ok(abs(tot-4440)<0.05, f'разнесено по товарам: {v} → {tot:.2f}')
        # свои цены: только макароны 60, фасоль стираем → нетронутое не пишем
        await pg.fill('#bz-zki .bzc[data-k="p-ma|кг"]','60'); await pg.fill('#bz-zki .bzc[data-k="p-fa|кг"]','')
        await pg.fill('#bz-zki .bze','900'); await pg.wait_for_timeout(150)
        zks=(await pg.text_content('#bz-zks')).replace(' ',' '); ok('1 440,00' in zks, f'живой расчёт: закупка 1 440,00 (макароны 24×60) {zks[:60]}')
        await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(2500)
        c=costs()
        ok(all(L(c,j).get('p-ma')=='60' for j in ['bz1','bz2','bz3']), 'макароны 60 ₽ записались во все три накладные')
        ok(all('p-fa' not in L(c,j) for j in ['bz1','bz2']), 'у фасоли цены нет (поле пустое)')
        ex=[float(str(c[j]['Прочие расходы'] or 0).replace(',','.')) for j in ['bz1','bz2','bz3']]
        ok(abs(sum(ex)-900)<0.001 and ex[0]>ex[1]>ex[2]>0, f'прочие расходы 900 разделены по сумме накладных: {ex}')
        ok((await pg.text_content('#bz-msg'))=='Сохранено ✓', 'сообщение «Сохранено ✓»')
        await pg.screenshot(path=f'{SHOT}/bz-1.png', full_page=False)
        # разные цены: в одной накладной фасоль 140, в другой 160 — в комплекте видно «разные», без правки не трогается
        await pg.fill('#bz-zki .bzc[data-k="p-fa|кг"]','140'); await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(400)
        # правим фасоль в № bz2 через окно накладной
        await pg.evaluate("(()=>{ const t=document.querySelector('#jr-body tr.grp'); t&&t.click(); })()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"bz2\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(600)
        await pg.fill('#dc-zki .dzc[data-pid="p-fa"]','160'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(1200)
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(400)
        await open_bundle(pg)
        ph=await pg.get_attribute('#bz-zki .bzc[data-k="p-fa|кг"]','placeholder'); ok('разные' in ph and '140' in ph and '160' in ph, f'разные цены видны: {ph}')
        zks=(await pg.text_content('#bz-zks')).replace(' ',' '); ok('4 440,00' in zks, f'закупка учитывает разные цены: 1440 + 10×140 + 10×160 = 4440 → {zks[:60]}')
        await pg.fill('#bz-zki .bzc[data-k="p-ma|кг"]','62'); await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(2000)
        c=costs(); ok(L(c,'bz1').get('p-fa')=='140' and L(c,'bz2').get('p-fa')=='160', 'нетронутые разные цены фасоли сохранились')
        ok(all(L(c,j).get('p-ma')=='62' for j in ['bz1','bz2','bz3']), 'макароны поменялись на 62 во всех')
        await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(700); ok(await pg.text_content('#fd-dcard [data-bzk="toggle"]')=='Закупка ✓', 'кнопка: «Закупка ✓»')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await ctx.close()
        ctx,pg,errs=await login(b,(390,844))
        await pg.evaluate("__fd.D().journal.length")
        await open_bundle(pg)
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=390, f'телефон: нет прокрутки вбок ({sw})')
        await pg.locator('#bz-zki').screenshot(path=f'{SHOT}/bz-phone.png')
        ok(not errs, f'телефон: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
