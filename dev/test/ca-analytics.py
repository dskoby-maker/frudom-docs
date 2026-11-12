"""«Аналитика покупок» заказчика: сравнение с прошлым периодом, закупка/прибыль, плитки → окно документов → накладная → назад,
выбор дня на графике, фильтр точки, «Новое / Брал раньше», раскрытие товара, поиск, телефон без прокрутки вбок."""
import asyncio, os, datetime
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
T=datetime.date.today(); iso=lambda d:d.isoformat()
A=T-datetime.timedelta(days=4); PA=A-datetime.timedelta(days=5)
async def login(b, W, H):
    ctx=await b.new_context(viewport={'width':W,'height':H}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def open_ca(pg, cid):
    await pg.evaluate(TAB+"('customers')"); await pg.wait_for_timeout(500)
    await pg.select_option('#cus-editor select.pick', cid); await pg.wait_for_timeout(600)
    await pg.evaluate("document.getElementById('cus-analytics').open=true"); await pg.wait_for_timeout(800)
    await pg.click('#ca-perseg [data-per="custom"]'); await pg.fill('#ca-from', iso(A)); await pg.fill('#ca-to', iso(T))
    await pg.dispatch_event('#ca-to','change'); await pg.wait_for_timeout(2500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,1300,900)
        cid=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv)||D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['ca-p1','Помидоры тест','200'],['ca-p2','Огурцы тест','100'],['ca-p3','Укроп тест','500']].forEach(([id,n,pr])=>{ if(!D.products.find(p=>p.id===id)) D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); return c.id; })()""")
        docs=[(A,'Точка А',[('ca-p1','10'),('ca-p2','5')]),(A+datetime.timedelta(days=2),'Точка Б',[('ca-p1','4')]),(T,'Точка А',[('ca-p1','6'),('ca-p2','2')]),
              (PA,'Точка А',[('ca-p1','5'),('ca-p3','1')]),(PA+datetime.timedelta(days=1),'Точка Б',[('ca-p1','3')])]
        for i,(d,sh,ls) in enumerate(docs):
            L=','.join(f"{{productId:'{a}',qty:'{q}',price:'',qOk:'{q}',pOk:1}}" for a,q in ls)
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'cad{i}', customerId:window.__cid, number:'', date:'{iso(d)}', ship:'{sh}', lines:[{L}], dupOk:1, dOk:1}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(600)
            if await pg.locator('#d-save').count(): await pg.click('#d-save'); await pg.wait_for_timeout(1200)
        n=await pg.evaluate("__fd.D().journal.filter(j=>/^cad/.test(j.id)).length"); ok(n==5, f'создано 5 накладных ({n})')
        await open_ca(pg, cid)
        # закупка помидоров 120 ₽/кг (общая закупочная цена)
        await pg.evaluate("""(()=>{ const D=__fd.D(); D.costs=(D.costs||[]).filter(x=>x.id!=='cac1'); D.costs.push({id:'cac1', productId:'ca-p1', customerId:'', from:'2000-01-01', price:'120'}); })()""")
        await pg.click('#ca-refresh'); await pg.wait_for_timeout(2500)
        tl=await pg.evaluate("Object.fromEntries([...document.querySelectorAll('#ca-tl [data-cat]')].map(b=>[b.dataset.cat, b.innerText.replace(/\\s+/g,' ')]))")
        print(tl)
        # текущий период: помидоры 20 кг × 200 = 4000, огурцы 7 × 100 = 700 → 4700; 3 документа; прошлый: 8×200 + 1×500 = 2100, 2 документа
        ok('4 700' in tl.get('sum',''), f"сумма 4 700 ₽: {tl.get('sum')}")
        ok('3' in tl.get('docs','') and '▲ 50%' in tl.get('docs',''), f"документов 3, ▲ 50% к прошлому периоду: {tl.get('docs')}")
        ok('▲' in tl.get('sum','') and '124%' in tl.get('sum',''), f"сумма ▲ 124% (4700 к 2100): {tl.get('sum')}")
        ok('2 400' in tl.get('cost',''), f"закупка 2 400 ₽ (20 кг × 120), огурцы без закупки: {tl.get('cost')}")
        ok('без закупки' in tl.get('cost',''), 'у закупки подпись «без закупки: N»')
        ok('profit' in tl, 'есть плитка «Прибыль»')
        chg=await pg.text_content('#ca-chg'); ok('Огурцы тест' in chg and 'Укроп тест' in chg, f'«Новое» — огурцы, «брал раньше» — укроп')
        ghosts=await pg.locator('#ca-chw .ca-col s').count(); ok(ghosts>=5, f'на графике призрачные столбики прошлого периода ({ghosts})')
        await pg.locator('#cus-analytics').screenshot(path=f'{SHOT}/ca-1300.png')
        # выбор дня
        await pg.click(f'#ca-chw [data-cacol="{iso(A)}"]'); await pg.wait_for_timeout(900)
        d1=await pg.evaluate("document.querySelector('#ca-tl [data-cat=docs] b').textContent"); ok(d1=='1', f'день выбран — документов 1 ({d1})')
        ok(await pg.locator('#ca-chw .ca-selbar').count()==1, 'плашка «Показан только …»')
        await pg.click('#ca-chw [data-caclr="sel"]'); await pg.wait_for_timeout(900)
        # точки
        ok(await pg.locator('#ca-ptw .ca-pt').count()==2, 'По точкам — 2 точки')
        await pg.click('#ca-ptw [data-capt="Точка Б"]'); await pg.wait_for_timeout(900)
        s1=await pg.evaluate("document.querySelector('#ca-tl [data-cat=sum] b').textContent"); ok('800' in s1, f'Точка Б — 800 ₽ ({s1})')
        await pg.click('#ca-ptw [data-capt="Точка Б"]'); await pg.wait_for_timeout(900)
        # раскрыть товар
        await pg.click('#ca-tw tr.ca-r[data-carow^="ca-p1"]'); await pg.wait_for_timeout(600)
        det=await pg.text_content('#ca-tw tr.ca-dr.open'); ok(det and '3 поставки' in det and 'закупка' in det, f'подробности товара: поставки и закупка')
        h=await pg.evaluate("document.querySelector('#ca-tw tr.ca-dr.open .ca-dw').getBoundingClientRect().height"); ok(h>40, f'раскрылось плавно до {h:.0f}px')
        await pg.click('#ca-tw tr.ca-dr.open [data-cadoc]'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#fd-dcard').count()==1, 'поставка → окно накладной')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        # поиск
        await pg.fill('#ca-q','огур'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#ca-tw tr.ca-r').count()==1, 'поиск по товару')
        ok(await pg.evaluate("document.activeElement && document.activeElement.id==='ca-q'"), 'курсор остался в поиске')
        await pg.fill('#ca-q',''); await pg.wait_for_timeout(400)
        # плитка → окно документов → накладная → назад
        await pg.click('#ca-tl [data-cat="profit"]'); await pg.wait_for_timeout(800)
        ok(await pg.locator('#fd-dcard .ld-row').count()==3, 'плитка «Прибыль» → окно с 3 документами')
        await pg.click('#fd-dcard .ld-row'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#fd-dcard [data-dc="doc"], #fd-dcard .ld-row').count()==0, 'открылась накладная')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#fd-dcard .ld-row').count()==3, 'Esc — назад к списку документов')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
        # сравнение с прошлым годом / без сравнения
        await pg.click('#ca-result [data-cacmp="none"]'); await pg.wait_for_timeout(2000)
        ok(await pg.locator('#ca-tl .ca-d').count()==0 and await pg.locator('#ca-chw .ca-col s').count()==0, '«не сравнивать» — без стрелок и призраков')
        await pg.click('#ca-result [data-cacmp="prev"]'); await pg.wait_for_timeout(2000)
        ok(not errs, f'без ошибок {errs}'); await ctx.close()
        ctx,pg,errs=await login(b,390,844)
        await open_ca(pg, cid); await pg.wait_for_timeout(500)
        await pg.click('#ca-tw tr.ca-r[data-carow^="ca-p1"]'); await pg.wait_for_timeout(600)
        sw=await pg.evaluate('document.documentElement.scrollWidth'); ok(sw==390, f'телефон: без прокрутки вбок ({sw})')
        await pg.locator('#cus-analytics').screenshot(path=f'{SHOT}/ca-390.png')
        ok(not errs, f'телефон: без ошибок {errs}'); await ctx.close(); await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
