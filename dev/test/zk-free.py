"""«Бесплатно» в закупке: товар отмечается подарком закупщика — закупка 0 ₽, строка считается заполненной (значок журнала ✓),
но в среднюю закупочную цену, график и «последние закупки» карточки товара не попадает; снять отметку — снова вводится цена;
в комплекте — отметка ложится во все накладные; «Разнести по товарам» бесплатное не трогает; телефон."""
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
async def mkdoc(pg, jid, lines, date=None):
    ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
    dd=f", date:'{date}'" if date else ""
    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:''{dd}, lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
async def open_doc(pg, jid):
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400)
    await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
    await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(900)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
              [['p-fz','Укроп свежий','300','кг'],['p-fb','Свёкла','60','кг']].forEach(([id,n,pr,u])=>{ if(!D.products.some(x=>x.id===id)) D.products.push({id, name:n, code:'', unit:u, country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
            j1=f'zf{W}a'; j2=f'zf{W}b'
            await mkdoc(pg, j1, [('p-fz','2'),('p-fb','10')])
            await open_doc(pg, j1)
            ok(await pg.locator(f'{R} .zfb').count()==2, f'{W}: у каждого товара кнопка «Бесплатно»')
            await pg.locator(f'{R}:nth-child(1) .zfb').click(); await pg.wait_for_timeout(200)
            ok(await pg.locator(f'{R}:nth-child(1).free .zfl').is_visible(), f'{W}: строка «Бесплатно — закупка 0 ₽», цена спрятана')
            ok(not await pg.locator(f'{R}:nth-child(1) .dzc').is_visible(), f'{W}: поле цены скрыто')
            await pg.fill(f'{R}:nth-child(2) .dzc','40'); await pg.wait_for_timeout(150)
            zks=(await pg.text_content('#dc-zks')).replace(' ',' ').replace(' ',' ')
            ok('400,00' in zks and 'Нет закупки' not in zks, f'{W}: закупка = только свёкла 400, укроп не «без закупки»: {zks[:90]}')
            await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(800)
            await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1200)
            L=costL(j1); ok(L.get('_free',{}).get('p-fz')=='1' and 'p-fz' not in L and L.get('p-fb')=='40', f'{W}: в таблице _free у укропа, цены нет: {L}')
            st=await pg.evaluate(f"(()=>{{const j=__fd.D().journal.find(x=>x.id==='{j1}'); const x=__fd.docProfit(j); return [x.cost, x.miss, (__fd.zkJState(j)||{{}}).st]}})()")
            ok(st==[400,0,'ok'], f'{W}: закупка 400, без пропусков, значок «заполнено»: {st}')
            # второй документ: укроп по 80
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            await mkdoc(pg, j2, [('p-fz','3')])
            await open_doc(pg, j2)
            ok(not await pg.locator(f'{R}:nth-child(1).free').count(), f'{W}: в новой накладной укроп не бесплатный по умолчанию')
            await pg.fill(f'{R}:nth-child(1) .dzc','80'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(800)
            buys=await pg.evaluate("(()=>{ const X=__fd.pcdData('p-fz'); return X.buys.filter(b=>b.jid).map(b=>b.p) })()")
            ok(80 in buys and 0 not in buys, f'{W}: в закупках карточки товара только 80, бесплатного нет: {buys}')
            sale0=await pg.evaluate(f"(()=>{{ const X=__fd.pcdData('p-fz'); return X.sales.filter(s=>s.j.id==='{j1}').map(s=>s.c) }})()")
            ok(sale0==[None], f'{W}: у продажи из «бесплатной» накладной закупка не считается: {sale0}')
            # снять «бесплатно»
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            await open_doc(pg, j1)
            ok(await pg.locator(f'{R}:nth-child(1).free').count()==1, f'{W}: отметка «Бесплатно» сохраняется при повторном открытии')
            await pg.locator(f'{R}:nth-child(1) .zfb').click(); await pg.wait_for_timeout(200)
            ok(await pg.locator(f'{R}:nth-child(1) .dzc').is_visible(), f'{W}: сняли — поле цены снова видно')
            await pg.locator(f'{R}:nth-child(1) .zfb').click(); await pg.wait_for_timeout(200)
            await pg.fill('#dc-zki .dzs','1000'); await pg.click('#dc-zki [data-zkc="spread"]'); await pg.wait_for_timeout(200)
            ok(await pg.input_value(f'{R}:nth-child(2) .dzc') in ('100','100,00'), f'{W}: «Разнести по товарам» — всё на свёклу, бесплатное не трогает: {await pg.input_value(R+":nth-child(2) .dzc")}')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            if W==1300: await pg.locator('#dc-zki').screenshot(path='/tmp/zkfree.png')
            else: await pg.locator(f'{R}:nth-child(1)').screenshot(path='/tmp/zkfree390.png')
            if W==1300:
                # комплект: две накладные с укропом и свёклой
                await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
                await mkdoc(pg, 'zfk1', [('p-fz','1'),('p-fb','5')]); await mkdoc(pg, 'zfk2', [('p-fz','2'),('p-fb','5')])
                await pg.evaluate("__fd.D().journal.filter(j=>['zfk1','zfk2'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tzf'}); })")
                await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
                await pg.locator('#jr-body tr.grp td[data-gcard]').first.click(); await pg.wait_for_timeout(500)
                await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(800)
                await pg.locator('#bz-zki .dzr', has_text='Укроп').locator('.zfb').click(); await pg.wait_for_timeout(200)
                await pg.fill('#bz-zki .bzc[data-k="p-fb|кг"]','30'); await pg.wait_for_timeout(150)
                t=(await pg.text_content('#bz-zks')).replace('\u00a0',' ').replace('\u202f',' ')
                ok('300,00' in t and 'Нет закупки' not in t, f'{W}: комплект — закупка 300 (свёкла), укроп бесплатно: {t[:80]}')
                await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(1500); await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1200)
                A=costL('zfk1'); B2=costL('zfk2')
                ok(A.get('_free',{}).get('p-fz')=='1' and B2.get('_free',{}).get('p-fz')=='1' and A.get('p-fb')=='30', f'{W}: «бесплатно» записано в обе накладные комплекта: {A} {B2}')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
