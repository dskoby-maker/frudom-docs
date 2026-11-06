"""Закупка на комплект + склад: «Со склада» / «Часть со склада» у товара комплекта, поиск товара склада подсказками,
раскладка складского количества по накладным, списание, себестоимость, цены Саида, повторное открытие, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
def rows(sheet):
    d=dump().get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
def snap(jid):
    r=[x for x in rows('Журнал') if x['ID']==jid][0]; return json.loads(r['Данные документа (не редактировать)'])
def costL(jid):
    r=[x for x in rows('Себестоимость накладных') if x['ID документа']==jid]; return json.loads(r[0]['Закупочные цены строк (не редактировать)'] or '{}') if r else {}
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def open_bz(pg):
    await pg.evaluate("__fd.D().journal.filter(j=>['bs1','bs2'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tbs'}); })")
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
    await pg.click('#jr-body tr.grp td[data-gcard]'); await pg.wait_for_timeout(500)
    await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(1500)
R="#bz-zki .dzl .dzr"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-ma','Изделия макаронные (макароны фигурные)','104.18'],['p-fa','Фасоль продовольственная','297.66']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Макароны \"Макфа\" Спирали 400г',unit:'кг',qty:'30',price:'50',date:'2026-11-01',exp:'',supplier:'',docRef:''},{itemId:'',newName:'Фасоль белая \"Мистраль\"',unit:'кг',qty:'5',price:'120',date:'2026-11-01',exp:'',supplier:'',docRef:''}]},'тест')")
        for jid, lines in [('bs1',[('p-ma','12'),('p-fa','10')]),('bs2',[('p-ma','8'),('p-fa','10')])]:
            ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        await open_bz(pg)
        ok(await pg.locator('#bz-zki .dzseg').count()==2, 'у каждого товара комплекта выбор «Закупка / Со склада / Часть со склада»')
        # макароны — со склада: поиск
        await pg.click(f'{R}:nth-child(1) [data-bzm="s"]'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("document.activeElement.classList.contains('skpq')"), 'курсор сразу в поиске товара склада')
        await pg.keyboard.type('спира'); await pg.wait_for_timeout(150)
        sug=await pg.evaluate(f"[...document.querySelectorAll('{R}:nth-child(1) [data-skpk] b')].map(b=>b.textContent)"); ok(len(sug)==1 and 'Спирали' in sug[0], f'подсказка по вводу «спира»: {sug}')
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
        inf=(await pg.text_content(f'{R}:nth-child(1) .dzinf')).replace(' ',' '); ok('20 кг со склада' in inf and '1 000,00' in inf, f'макароны: 20 кг со склада, себестоимость 1 000: {inf[:90]}')
        ok(await pg.locator(f'{R}:nth-child(1) .bzc').count()==0, 'у товара целиком со склада нет поля цены')
        # фасоль — часть: 5 кг со склада, остальное по 150
        await pg.click(f'{R}:nth-child(2) [data-bzm="x"]'); await pg.wait_for_timeout(200)
        await pg.keyboard.type('фасоль'); await pg.wait_for_timeout(150); await pg.keyboard.press('ArrowDown'); await pg.keyboard.press('ArrowUp'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(250)
        q=await pg.input_value(f'{R}:nth-child(2) .bzq'); ok(q=='5', f'«Часть» — подставлено всё свободное: {q}')
        inf=(await pg.text_content(f'{R}:nth-child(2) .dzinf')).replace(' ',' '); ok('По накладным: № 1 — 5 кг' in inf, f'видно, в какую накладную пойдёт склад: {inf[-60:]}')
        await pg.fill(f'{R}:nth-child(2) .bzc','150'); await pg.wait_for_timeout(150)
        zks=(await pg.text_content('#bz-zks')).replace(' ',' '); ok('3 850,00' in zks, f'живой расчёт: 1000 + 600 + 15×150 = 3 850: {zks[:50]}')
        ok(await pg.locator('#bz-zki .bzshipc:checked').count()==1, 'галочка «Товар уже уехал» стоит')
        await pg.screenshot(path=f'{SHOT}/bzs-before.png')
        await pg.click('#bz-zki [data-bzk="save"]')
        for _ in range(60):
            if (await pg.text_content('#bz-msg'))=='Сохранено ✓': break
            await pg.wait_for_timeout(250)
        ok((await pg.text_content('#bz-msg'))=='Сохранено ✓', 'закупка комплекта сохранена')
        await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1500)
        s1, s2 = snap('bs1'), snap('bs2')
        L1={l['productId']:l.get('stk') for l in s1['dr']['lines']}; L2={l['productId']:l.get('stk') for l in s2['dr']['lines']}
        ok(L1['p-ma']=={'m':'s'} and L2['p-ma']=={'m':'s'}, f'макароны со склада в обеих накладных: {L1["p-ma"]}, {L2["p-ma"]}')
        ok((L1['p-fa'] or {}).get('m')=='x' and str(L1['p-fa'].get('q'))=='5' and not L2['p-fa'], f'фасоль: № 1 — 5 кг со склада, № 2 — от Саида: {L1["p-fa"]}, {L2["p-fa"]}')
        ships=sorted(-float(m['Количество']) for m in rows('Склад: движения') if float(m['Количество'])<0)
        ok(ships==[5.0,8.0,12.0], f'со склада списано 12 + 8 макарон и 5 фасоли: {ships}')
        c1, c2 = costL('bs1'), costL('bs2')
        ok(c1.get('p-fa')=='150' and c2.get('p-fa')=='150' and 'p-ma' not in c1 and 'p-ma' not in c2, f'цены Саида: фасоль 150 в обеих, у макарон цены нет (склад): {c1} {c2}')
        zks=(await pg.text_content('#bz-zks')).replace(' ',' '); ok('3 850,00' in zks, f'после сохранения закупка 3 850,00: {zks[:50]}')
        ok(await pg.locator('#bz-zki .dzsk.lock').count()==2, 'отгруженные товары закрыты для правки')
        await pg.screenshot(path=f'{SHOT}/bzs-after.png')
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(400)
        await open_bz(pg)
        ok(await pg.locator('#bz-zki .dzsk.lock').count()==2, 'после переоткрытия — «отгружено со склада»')
        await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(1500)
        ok(len([m for m in rows('Склад: движения') if float(m['Количество'])<0])==3, 'повторное сохранение второй раз не списывает')
        ok(not errs, f'ошибок нет {errs[:2]}'); await ctx.close()
        ctx,pg,errs=await login(b,(390,844)); await open_bz(pg)
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=390, f'телефон: нет прокрутки вбок ({sw})')
        await pg.locator('#bz-zki').screenshot(path=f'{SHOT}/bzs-phone.png'); ok(not errs, f'телефон: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
