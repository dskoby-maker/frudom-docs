"""«Закупка по накладным»: строки одного дня и одного заказчика объединяются в одну закупку (prefs.zkpMg), одна сумма
делится по всем накладным, «Разделить обратно», другой заказчик/другой день не трогаются, телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
        ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0], c2=D.customers[1]; window.__cid=c.id; window.__cid2=c2.id;
          [['m-a','Яблоко тест','100'],['m-b','Груша тест','200']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); [c.id,c2.id].forEach(x=>{D.prices[x]=D.prices[x]||{}; D.prices[x][id]=pr;}); }); })()""")
        T="new Date().toISOString().slice(0,10)"
        for jid, cust, lines in [('mg1','__cid',[('m-a','10')]),('mg2','__cid',[('m-b','5')]),('mg3','__cid',[('m-a','20')]),('mg4','__cid2',[('m-a','3')])]:
            ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.{cust}, number:'', date:{T}, lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.{cust}]||{{}})[l.productId]||'')); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
        # mg2+mg3 — комплект, mg1 — отдельная накладная того же заказчика и дня, mg4 — другой заказчик
        await pg.evaluate("__fd.D().journal.filter(j=>['mg2','mg3'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tmg'}); })")
        await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('#zkp [data-zkpst=\"all\"]').click()"); await pg.wait_for_timeout(400)
        n=await pg.locator('#zkp-list .zkp-mg').count(); ok(n==1, f'одна рамка «один день — один заказчик» ({n})')
        ok(await pg.locator('#zkp-list .zkp-mg .zkp-it').count()==2, 'в рамке 2 строки (накладная и комплект)')
        h=await pg.inner_text('#zkp-list .zkp-mg .zkp-mgh'); ok('3 документ' in h and '2 строки' in h, f'шапка: {h!r}')
        await pg.screenshot(path='/tmp/claude-0/zkp-mg1.png')
        await pg.click('#zkp-list [data-zkpmg]'); await pg.wait_for_timeout(1800)
        ok(await pg.locator('#zkp-list .zkp-mg').count()==0 and await pg.locator('#zkp-list .zkp-it.mgd.open').count()==1, 'после «Объединить» — одна открытая строка')
        t=await pg.inner_text('#zkp-list .zkp-it.mgd'); ok('объединено из 2' in t and 'Одна закупка на весь день' in t, 'подписи объединённой строки')
        ok(await pg.evaluate("document.activeElement && document.activeElement.classList.contains('bzs')"), 'курсор сразу в поле «одной суммой»')
        await pg.fill('#bz-zki .bzs','4000'); await pg.click('#bz-zki [data-bzk="one"]'); await pg.wait_for_timeout(600)
        x=await pg.evaluate("['mg1','mg2','mg3','mg4'].map(id=>__fd.docProfit(__fd.D().journal.find(j=>j.id===id)).cost)")
        ok(abs(sum(x[:3])-4000)<0.001 and x[3]==0, f'4000 разделено по трём накладным, чужая не тронута {x}')
        ok(abs(x[0]-1000)<0.01 and abs(x[1]-1000)<0.01 and abs(x[2]-2000)<0.01, f'пропорционально сумме (1000/1000/2000) {x}')
        r=await pg.inner_text('#zkp-list .zkp-it.mgd > .zkp-row'); ok('✓' in r, f'строка показывает «✓» {r!r}')
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]==sw[1], f'телефон без прокрутки вбок {sw}')
        await pg.screenshot(path='/tmp/claude-0/zkp-mg2.png')
        # запоминается после перерисовки
        await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(800)
        ok(await pg.locator('#zkp-list .zkp-it.mgd').count()==1, 'объединение запомнилось')
        if not await pg.locator('#zkp-list .zkp-it.mgd.open').count(): await pg.click('#zkp-list .zkp-it.mgd > .zkp-row')
        await pg.wait_for_timeout(1500)
        await pg.click('#zkp-list [data-zkpsplit]'); await pg.wait_for_timeout(800)
        ok(await pg.locator('#zkp-list .zkp-mg').count()==1 and await pg.locator('#zkp-list .zkp-it.mgd').count()==0, '«Разделить обратно» — снова две строки в рамке')
        x2=await pg.evaluate("['mg1','mg2','mg3'].map(id=>__fd.docProfit(__fd.D().journal.find(j=>j.id===id)).cost)")
        ok(x2==x[:3], f'закупка в накладных осталась {x2}')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
asyncio.run(main()); print('ПРОВАЛОВ:', len(fails))
