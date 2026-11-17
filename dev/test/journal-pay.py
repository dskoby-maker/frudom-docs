"""Журнал: правой кнопкой — «Отметить оплаченной» / «Снять отметку», «Отменить», «Оплаты заказчика ›» → «Прибыль» → окно заказчика; комплект; Наталья не видит; ПК и телефон (PH=1)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); TG='тел' if PH else 'ПК'
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def ctxmenu(pg, sel):
    await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())"); el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(450); bx=await el.bounding_box()
    if PH:
        await pg.evaluate("""([x,y])=>{const t=document.elementFromPoint(x,y); t.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y}));}""", [bx['x']+bx['width']/2, bx['y']+bx['height']/2])
    else: await pg.mouse.click(bx['x']+bx['width']/2, bx['y']+bx['height']/2, button='right')
    await pg.wait_for_timeout(300)
async def items(pg): return [t.strip() for t in await pg.locator('#fd-app .jcx .jcx-i').all_text_contents()]
PAY="__fd.payOf(__fd.D().journal.find(j=>j.id==='{}')).st"
async def main():
    P='jp'+('m' if PH else 'p'); D0='2026-11-14' if PH else '2026-11-13'
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx,pg,errs=await login(b,'Даниил','1111')
        await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; window.__s1=D.suppliers[0].id; D.products.push({id:'jp-a', name:'Груши', unit:'кг', price:'150'});})()""")
        for i in range(3):
            await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}{i}', supplierId:window.__s1, customerId:window.__cid, number:'', date:'{D0}', lines:[{{productId:'jp-a',qty:'{i+1}',price:'150'}}]}}); }}""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1100)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(1500)
        await ctxmenu(pg, f'#jr-body [data-card="{P}0"]'); L=await items(pg); print('   пункты:', L)
        ok(any(x.startswith('Отметить оплаченной') and 'ждём оплату' in x for x in L), f'{TG}: «Отметить оплаченной · ждём оплату»')
        ok(any(x.startswith('Оплаты заказчика') for x in L), f'{TG}: «Оплаты заказчика ›»')
        await pg.locator('#fd-app .jcx-i', has_text='Отметить оплаченной').click(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(PAY.format(P+'0'))=='paid', f'{TG}: накладная оплачена')
        await pg.locator('#fd-toasts .ta', has_text='Отменить').last.click(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(PAY.format(P+'0'))=='due', f'{TG}: «Отменить» вернуло «не оплачена»')
        await ctxmenu(pg, f'#jr-body [data-card="{P}0"]'); await pg.locator('#fd-app .jcx-i', has_text='Отметить оплаченной').click(); await pg.wait_for_timeout(500)
        await ctxmenu(pg, f'#jr-body [data-card="{P}0"]'); L=await items(pg)
        ok(any('Снять отметку' in x and 'оплачена' in x for x in L), f'{TG}: теперь «Снять отметку · оплачена …»')
        await pg.locator('#fd-app .jcx-i', has_text='Снять отметку').click(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(PAY.format(P+'0'))=='due', f'{TG}: отметка снята')
        # комплект
        await pg.evaluate(f"""()=>{{const D=__fd.D(); ['{P}0','{P}1'].forEach(id=>{{const j=D.journal.find(x=>x.id===id); j.snap.meta=j.snap.meta||{{}}; j.snap.meta.batch='jpb{P}';}});}}""")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
        await ctxmenu(pg, f'#jr-body tr.grp [data-gcard]'); L=await items(pg); print('   комплект:', L)
        ok(any(x.startswith('Отметить комплект оплаченным') and '0 из 2' in x for x in L), f'{TG}: у комплекта «оплачено 0 из 2»')
        await pg.locator('#fd-app .jcx-i', has_text='Отметить комплект оплаченным').click(); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(f"[{PAY.format(P+'0')},{PAY.format(P+'1')},{PAY.format(P+'2')}]")==['paid','paid','due'], f'{TG}: оплачены обе накладные комплекта, третья нет')
        # переход к оплатам
        await ctxmenu(pg, f'#jr-body [data-card="{P}2"]'); await pg.locator('#fd-app .jcx-i', has_text='Оплаты заказчика').click(); await pg.wait_for_timeout(1500)
        st=await pg.evaluate("[document.querySelector('nav.tabs button.on, nav.tabs button[aria-selected=\"true\"]')?.dataset.tab||'', !!document.querySelector('#fd-dcard[open].pvl-d'), document.querySelectorAll('#fd-dcard [data-pvpay]').length, !!document.querySelector('#fd-tback')]")
        print('   ', st); ok(st[1] and st[2]>=3, f'{TG}: открыто окно заказчика с оплатами накладных')
        ok(st[3], f'{TG}: есть «‹ Назад: Журнал»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500); await pg.click('#fd-tback'); await pg.wait_for_timeout(800)
        ok(await pg.evaluate("location.hash")=='#zhurnal', f'{TG}: «Назад» вернул в журнал')
        ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'{TG}: без прокрутки вбок')
        ok(not errs, f'{TG}: ошибок JS нет {errs[:2]}')
        ctx2,pg2,e2=await login(b,'Наталья','2222'); await pg2.evaluate(TAB+"('journal')"); await pg2.wait_for_timeout(800)
        await ctxmenu(pg2, '#jr-body [data-card]'); L=await items(pg2); ok(not any('плат' in x for x in L), f'{TG}: у Натальи пунктов оплаты нет')
        await b.close()
    print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
