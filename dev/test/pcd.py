"""Карточка товара (Товары): история закупочных и продажных цен, цены заказчиков, связанные названия (grp),
«Одинаковые товары…», отвязать / основное, запись связи в таблицу, телефон без горизонтальной прокрутки."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SEED="""(W=>{ const D=__fd.D(), s=D.suppliers[0], c=D.customers.find(x=>x.inn)||D.customers[0];
  [['pa'+W,'Помидоры т'+W,'кг'],['pb'+W,'Томаты т'+W,'кг'],['pc'+W,'Помидоры (томаты) т'+W,'кг'],['pd'+W,'Помидоры черри т'+W,'кг'],['pe'+W,'Огурцы т'+W,'кг']].forEach(([id,name,unit])=>D.products.push({id,name,unit,code:'',country:'',price:'100',cat:''}));
  const mk=(id,date,num,pid,qty,price)=>D.journal.unshift({id, supplierId:s.id, customerId:c.id, number:num, date, sum:qty*price, updated:new Date().toISOString(),
    snap:{dr:{supplierId:s.id, customerId:c.id, lines:[{productId:pid, qty:String(qty), price:String(price)}]}, s:JSON.parse(JSON.stringify(s)), c:JSON.parse(JSON.stringify(c)), prods:{}, meta:{}}});
  mk('ja'+W,'2026-10-01','9001','pa'+W,10,150); mk('jb'+W,'2026-10-15','9002','pb'+W,20,160); mk('jc'+W,'2026-11-01','9003','pc'+W,5,170);
  D.doccosts=(D.doccosts||[]).concat([{id:'ja'+W, lines:JSON.stringify({['pa'+W]:'90'})},{id:'jb'+W, lines:JSON.stringify({['pb'+W]:'100'})},{id:'jc'+W, lines:JSON.stringify({['pc'+W]:'120'})}]);
  D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['pa'+W]='155';
  return c.name; })"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or "/usr/bin/google-chrome")
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, has_touch=W<500); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3500)
            await pg.reload(); await pg.wait_for_timeout(3000)
            await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500)   # данные прибыли загружены — дальше подкладываем закупку
            cn=await pg.evaluate(SEED+f"('{W}')")
            await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(400)
            await pg.fill('#pd-q', f'т{W}'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#pd-body .nmr').count()==5, f'{W}: 5 строк товаров')
            await pg.click(f'#pd-body .nmr[data-id="pa{W}"] .nmh'); await pg.wait_for_timeout(200); await pg.click(f'#pd-body [data-pcard="pa{W}"]'); await pg.wait_for_timeout(500)
            t=await pg.inner_text('#pcd')
            ok('Карточка товара' in t and f'Помидоры т{W}' in t, f'{W}: карточка открылась')
            ok('Средняя закупка' in t and '90,00' in t, f'{W}: закупочная цена из накладной видна')
            ok('Цены у заказчиков' in t and '155,00' in t, f'{W}: цена заказчика видна')
            chart=pg.locator('#pcd .pcd-chart')
            assert await chart.locator('time').get_attribute('datetime')=='2026-10-01'
            assert await chart.get_by_role('slider').count()==0, 'Для одной даты достаточно показаний на графике'
            sim=await pg.evaluate("[...document.querySelectorAll('#pcd [data-pglink]')].map(b=>b.dataset.pglink)")
            ok(f'pb{W}' in sim and f'pc{W}' in sim and f'pd{W}' not in sim and f'pe{W}' not in sim, f'{W}: «похоже» — томаты и помидоры (томаты), без черри и огурцов {sim}')
            await pg.click(f'#pcd [data-pglink="pb{W}"]'); await pg.wait_for_timeout(300)
            await pg.fill('#pcd-q','помидоры (том'); await pg.wait_for_timeout(200)
            ok(await pg.locator(f'#pcd-sug [data-pglink="pc{W}"]').count()==1, f'{W}: поиск «Связать с товаром»')
            await pg.click(f'#pcd-sug [data-pglink="pc{W}"]'); await pg.wait_for_timeout(300)
            t=await pg.inner_text('#pcd')
            ok('3 названия' in t and '9003' in t and '9002' in t and '9001' in t, f'{W}: в карточке 3 названия и продажи всех трёх')
            ok('120,00' in t and '100,00' in t, f'{W}: закупка по всем связанным')
            plot=chart.get_by_role('slider')
            date=chart.locator('time')
            assert await date.get_attribute('datetime')=='2026-11-01'
            if W<500:
                await plot.tap(position={'x':4,'y':35})
            else:
                await plot.hover(position={'x':4,'y':35})
            assert await date.get_attribute('datetime')=='2026-10-01'
            await plot.press('ArrowRight')
            assert await date.get_attribute('datetime')=='2026-10-15'
            assert await chart.locator('[data-pcd-value="b"]').inner_text()=='100,00 ₽'
            assert '160,00 ₽' in (await plot.get_attribute('aria-valuetext'))
            await plot.press('End')
            assert await date.get_attribute('datetime')=='2026-11-01'
            await plot.press('Home')
            assert await date.get_attribute('datetime')=='2026-10-01'
            print(f'OK   {W}: график реагирует на указатель и клавиатуру')
            ok(await pg.evaluate(f"__fd.D().products.filter(p=>p.grp==='pa{W}').length")==2, f'{W}: связь записана (grp)')
            await pg.screenshot(path=f'/tmp/claude-0/pcd-{W}.png', full_page=False)
            if W<500:
                sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth, (d=>d.scrollWidth-d.clientWidth)(document.getElementById('fd-dcard'))]")
                ok(sw[0]==sw[1] and sw[2]<=2, f'{W}: телефон без горизонтальной прокрутки {sw}')
                await pg.evaluate("(document.getElementById('fd-toasts')||{}).innerHTML='';document.getElementById('fd-dcard').scrollTop=600"); await pg.wait_for_timeout(200); await pg.screenshot(path=f'/tmp/claude-0/pcd-{W}-2.png')
            # продажи → накладная → назад
            await pg.click('#pcd .pcd-er.s >> nth=0'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#fd-dcard .dc-back').count()>=1, f'{W}: из карточки открылась накладная с «‹ назад»')
            await pg.click('#fd-dcard .dc-back'); await pg.wait_for_timeout(600)
            ok(await pg.locator('#pcd').count()==1, f'{W}: вернулись в карточку')
            # основное и отвязать
            await pg.click(f'#pcd [data-pgmain="pb{W}"]'); await pg.wait_for_timeout(200)
            ok(await pg.evaluate(f"[__fd.D().products.find(p=>p.id==='pb{W}').grp, __fd.D().products.find(p=>p.id==='pa{W}').grp]")==['',f'pb{W}'], f'{W}: «Основное» переключено')
            await pg.click(f'#pcd [data-pgun="pb{W}"]'); await pg.wait_for_timeout(200)
            g=await pg.evaluate(f"['pa','pb','pc'].map(x=>__fd.D().products.find(p=>p.id===x+'{W}').grp)")
            ok(g[1]=='' and len({g[0] or f'pa{W}', g[2] or f'pc{W}'})==1, f'{W}: отвязан основной — остальные остались вместе {g}')
            await pg.wait_for_timeout(2500)
            R={r['ID (не менять)']:r.get('Связан с товаром (ID основного, заполняется с сайта)') for r in rows('Товары')}
            ok(R.get(f'pb{W}')=='' and (R.get(f'pa{W}') or R.get(f'pc{W}')), f'{W}: связь сохранилась в таблицу')
            await pg.click('#fd-dcard [data-dc="close"] >> nth=0'); await pg.wait_for_timeout(400)
            ok(await pg.locator(f'#pd-body .nmr[data-id="pa{W}"] .nmlk').inner_text()=='2', f'{W}: в списке значок «2»')
            # «Одинаковые товары…»
            await pg.click('#pd-same'); await pg.wait_for_timeout(400)
            k=await pg.evaluate(f"(g=>g?g.dataset.pgk:'')([...document.querySelectorAll('#pgf [data-pgk]')].find(g=>g.textContent.includes('Томаты т{W}')))")
            ok(bool(k), f'{W}: группа с «Томаты» найдена ({k})')
            await pg.click(f'#pgf [data-pgjoin="{k}"]'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate(f"new Set(['pa','pb','pc'].map(x=>(p=>p.grp||p.id)(__fd.D().products.find(p=>p.id===x+'{W}')))).size")==1, f'{W}: «Связать отмеченные» — все три в одной группе')
            await pg.screenshot(path=f'/tmp/claude-0/pgf-{W}.png')
            ok(not errs, f'{W}: ошибок на странице нет {errs[:3]}')
            await ctx.close()
        # менеджер: карточка без закупки
        ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Наталья"]'); await pg.fill('#fd-pass','2222'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3500)
        await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(400)
        pid=await pg.evaluate("__fd.D().products[0].id"); await pg.fill('#pd-q', await pg.evaluate("__fd.D().products[0].name")); await pg.wait_for_timeout(300); await pg.click(f'#pd-body .nmr[data-id="{pid}"] .nmh'); await pg.wait_for_timeout(200); await pg.click(f'#pd-body [data-pcard="{pid}"]'); await pg.wait_for_timeout(400)
        t=await pg.inner_text('#pcd'); ok('Карточка товара' in t and 'Средняя закупка' not in t, 'Наталья: карточка без закупочных цен')
        ok(not errs, f'Наталья: ошибок нет {errs[:3]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
