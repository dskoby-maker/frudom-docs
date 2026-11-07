"""Связанные названия — один товар везде: закупочная цена из «Закупочных цен» соседнего названия, «Товары в минус» одной строкой,
выученное правило Саида срабатывает на другое название того же товара, склад — связь со складом переходит на все названия."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or "/usr/bin/google-chrome")
        ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
        await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>x.inn)||D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['ua','Помидоры у'],['ub','Томаты у']].forEach(([id,n])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:'50'}); D.prices[c.id][id]='50'; }); })()""")
        for jid, pid in [('uj1','ua'),('uj2','ub'),('uj3','ub')]:
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{{productId:'{pid}',qty:'10',price:'50'}}]}}); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
        await pg.wait_for_timeout(1500)
        # склад: товар склада связан с «Помидоры у»
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Помидоры (склад у)',unit:'кг',qty:'5',price:'40',date:'2026-11-01',exp:'',supplier:'',docRef:''}]},'тест')"); await pg.wait_for_timeout(1500)
        it=[r for r in rows('Склад: товары') if r['Товар на складе']=='Помидоры (склад у)'][0]; iid=it['ID (не менять)']
        await pg.evaluate(f"__sk.send('item',{{itemId:'{iid}', links:['ua']}},'тест')"); await pg.wait_for_timeout(1500)
        # до связывания: у «Томатов» закупки нет
        ok(await pg.evaluate("__fd.docProfit(__fd.D().journal.find(j=>j.id==='uj2')).miss")==1, 'до связывания у «Томатов» закупки нет')
        # связываем в карточке
        await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(400); await pg.fill('#pd-q','у'); await pg.wait_for_timeout(200)
        await pg.fill('#pd-q','Помидоры у'); await pg.wait_for_timeout(300)
        await pg.click('#pd-body .nmr[data-id="ua"] .nmh'); await pg.click('#pd-body [data-pcard="ua"]'); await pg.wait_for_timeout(500)
        await pg.fill('#pcd-q','Томаты у'); await pg.wait_for_timeout(200); await pg.click('#pcd-sug [data-pglink="ub"]'); await pg.wait_for_timeout(3000)
        L=json.loads(([r for r in rows('Склад: товары') if r['ID (не менять)']==iid][0]).get('ID позиций (не редактировать)') or [r for r in rows('Склад: товары') if r['ID (не менять)']==iid][0].get([k for k in it if k.startswith('ID позиций')][0]) or '[]')
        ok('ub' in L and 'ua' in L, f'склад: «Томаты» сами связались с тем же товаром склада {L}')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # закупочная цена из списка соседнего названия
        await pg.evaluate("(()=>{const D=__fd.D(); D.costs=(D.costs||[]).concat([{id:'uc1', productId:'ua', price:'80', from:'2026-01-01', customerId:''}]); })()")
        x=await pg.evaluate("(j=>{const x=__fd.docProfit(j); return [x.cost, x.miss]})(__fd.D().journal.find(j=>j.id==='uj2'))")
        ok(x==[800,0], f'«Закупочные цены» «Помидоров» подходят «Томатам» {x}')
        await pg.evaluate("(()=>{const D=__fd.D(); D.costs.push({id:'uc2', productId:'ub', price:'70', from:'2026-01-01', customerId:''}); })()")
        x=await pg.evaluate("__fd.docProfit(__fd.D().journal.find(j=>j.id==='uj2')).cost")
        ok(x==700, f'своя цена «Томатов» важнее цены соседнего названия {x}')
        # «Товары в минус»: закупка 90 при продаже 50 у обоих названий → одна строка
        await pg.evaluate("(()=>{const D=__fd.D(); D.doccosts=(D.doccosts||[]).concat([{id:'uj1', lines:JSON.stringify({ua:'90'})},{id:'uj2', lines:JSON.stringify({ub:'90'})}]); const f=D.pf=D.pf||{}; f.per='all'; })()")
        await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(800)
        t=await pg.inner_text('#pf-loss'); rws=await pg.locator('#pf-loss .pfl-r').count()
        ok(rws==1 and 'Помидоры у' in t and 'Томаты у' in t, f'«Товары в минус» — одна строка на товар ({rws}): {t[:120]!r}')
        # правило Саида выучено на «Помидоры у», накладная с «Томаты у»
        await pg.evaluate("(()=>{const k='frudom-docs-prefs:Даниил', p=JSON.parse(localStorage.getItem(k)||'{}'); p.zk=p.zk||{}; p.zk.n=p.zk.n||{}; p.zk.n['ксилофон']={p:['ua']}; localStorage.setItem(k, JSON.stringify(p)); })()")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"uj3\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1200)
        await pg.click('#dc-zki [data-zkc="said"]'); await pg.fill('#dc-zki .dzst','Ксилофон 10×65'); await pg.click('#dc-zki [data-zkc="saidgo"]'); await pg.wait_for_timeout(400)
        v=await pg.input_value('#dc-zki .dzc >> nth=0')
        ok(v=='65', f'правило Саида с «Помидоров» сработало на «Томаты» (цена {v})')
        ok(not errs, f'ошибок нет {errs[:3]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
