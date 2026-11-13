"""Закупка «одной суммой» (кнопка «Записать одной суммой»): накладная и комплект → lines._src в «Себестоимости накладных»,
комплект делится по накладным пропорционально продаже, «Убрать», цены по товарам заменяют сумму, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def costs():
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Себестоимость накладных') or [[]]; h=d[0]
    return {r[h.index('ID документа')]:dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)}
def L(c, jid): return json.loads((c.get(jid) or {}).get('Закупочные цены строк (не редактировать)') or '{}')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or "/usr/bin/google-chrome")
        ctx=await b.new_context(viewport={'width':390,'height':844}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['o-a','Рис тест','100'],['o-b','Гречка тест','200']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
        for jid, lines in [('on1',[('o-a','10'),('o-b','5')]),('ob1',[('o-a','10')]),('ob2',[('o-a','20')])]:
            ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        # --- накладная ---
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"on1\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1200)
        ok(await pg.locator('#dc-zki [data-zkc="one"]').count()==1, 'накладная: кнопка «Записать одной суммой»')
        await pg.click('#dc-zki [data-zkc="one"]'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("__fd.D().doccosts.find(x=>x.id==='on1')")==None or 'one' not in str(await pg.evaluate("(__fd.D().doccosts.find(x=>x.id==='on1')||{}).lines")), 'без суммы не записывает')
        await pg.fill('#dc-zki .dzs','1500'); await pg.fill('#dc-zki .dze','200'); await pg.click('#dc-zki [data-zkc="one"]'); await pg.wait_for_timeout(400)
        x=await pg.evaluate("(j=>{const x=__fd.docProfit(j); return [x.cost, x.exp, x.profit, !!x.src]})(__fd.D().journal.find(j=>j.id==='on1'))")
        ok(x[0]==1500 and x[1]==200 and x[3], f'накладная: закупка 1500, расходы 200 {x}')
        ok('одной суммой' in await pg.inner_text('#dc-zki .dzone'), 'плашка «Закупка записана одной суммой»')
        await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(700); ok((await pg.inner_text('#fd-dcard [data-zkc="toggle"]')).startswith('Закупка ✓'), 'кнопка «Закупка ✓»'); await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1000)
        await pg.screenshot(path='/tmp/claude-0/zk-one-doc.png')
        await pg.wait_for_timeout(2500); c=costs()
        ok(L(c,'on1').get('_src')==[{'n':'Одной суммой','s':'1500'}] and c['on1']['Прочие расходы'] in ('200',200), f'в таблице: {L(c,"on1").get("_src")}, расходы {c.get("on1",{}).get("Прочие расходы")}')
        # цены по товарам заменяют сумму
        await pg.fill('#dc-zki .dzc >> nth=0','70'); await pg.fill('#dc-zki .dzc >> nth=1','150'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(400)
        x=await pg.evaluate("(j=>{const x=__fd.docProfit(j); return [x.cost, !!x.src]})(__fd.D().journal.find(j=>j.id==='on1'))")
        ok(x==[1450,False], f'после цен по товарам — считается по товарам {x}')
        await pg.fill('#dc-zki .dzs','999'); await pg.click('#dc-zki [data-zkc="one"]'); await pg.wait_for_timeout(300)
        await pg.click('#dc-zki [data-zkc="oneoff"]'); await pg.wait_for_timeout(300)
        x=await pg.evaluate("(j=>{const x=__fd.docProfit(j); return [x.cost, !!x.src]})(__fd.D().journal.find(j=>j.id==='on1'))")
        ok(x==[1450,False], f'«Убрать» — снова по товарам {x}')
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(400)
        # --- комплект ---
        await pg.evaluate("__fd.D().journal.filter(j=>['ob1','ob2'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tbo'}); })")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
        await pg.click('#jr-body tr.grp td[data-gcard]'); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(1000)
        await pg.fill('#bz-zki .bzs','3001'); await pg.click('#bz-zki [data-bzk="one"]'); await pg.wait_for_timeout(400)
        x=await pg.evaluate("['ob1','ob2'].map(id=>__fd.docProfit(__fd.D().journal.find(j=>j.id===id)).cost)")
        ok(x==[1000.33, 2000.67] or x==[1000.33,2000.67], f'комплект: 3001 разделено 1/3 и 2/3, сумма точная {x}')
        ok(abs(sum(x)-3001)<0.001, 'сумма по накладным = 3001')
        await pg.locator('#fd-dcard .dc-head [data-navback]').first.click(); await pg.wait_for_timeout(700); ok((await pg.inner_text('#fd-dcard [data-bzk="toggle"]')).startswith('Закупка ✓'), 'комплект: «Закупка ✓»'); await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(1000)
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]==sw[1], f'телефон без прокрутки вбок {sw}')
        await pg.evaluate("document.querySelector('#bz-zki .dzbulk').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
        await pg.screenshot(path='/tmp/claude-0/zk-one-bz.png')
        await pg.click('#bz-zki [data-bzk="oneoff"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("['ob1','ob2'].every(id=>!__fd.docProfit(__fd.D().journal.find(j=>j.id===id)).src)"), 'комплект: «Убрать»')
        ok(not errs, f'ошибок нет {errs[:3]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
