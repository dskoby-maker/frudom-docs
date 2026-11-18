"""Журнал: значок оплаты под суммой (только Даниил), нажатие — оплачено / снять в два нажатия, комплект, фильтр «Оплата»,
кнопка «Ждут оплаты · N», итог «ждём …», «Отметить все показанные»; Наталья не видит; ПК и телефон (PH=1)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); TG='тел' if PH else 'ПК'
PAY="__fd.payOf(__fd.D().journal.find(j=>j.id==='{}')).st"
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def tap(pg, sel):
    await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())"); el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200); await el.click(); await pg.wait_for_timeout(600)
async def main():
    P='jb'+('m' if PH else 'p')
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx,pg,errs=await login(b,'Даниил','1111')
        await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; window.__s1=D.suppliers[0].id; D.products.push({id:'jb-a', name:'Груши', unit:'кг', price:'150'});})()""")
        dates=['2026-09-01','2026-11-10','2026-11-11']
        for i,dt in enumerate(dates):
            await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}{i}', supplierId:window.__s1, customerId:window.__cid, number:'', date:'{dt}', lines:[{{productId:'jb-a',qty:'{i+1}',price:'150'}}]}}); }}""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1100)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(1800)
        sel=f'#jr-body [data-jpay="{P}1"]'
        ok(await pg.locator(sel).count()==1, f'{TG}: значок оплаты у накладной')
        cls=await pg.get_attribute(f'#jr-body [data-jpay="{P}0"]','class'); ok('old' in cls, f'{TG}: старая (больше 30 дней) — красная ({cls})')
        await tap(pg, sel); ok(await pg.evaluate(PAY.format(P+'1'))=='paid', f'{TG}: нажатие — оплачена')
        ok('ok' in (await pg.get_attribute(sel,'class')), f'{TG}: значок зелёный')
        await tap(pg, sel); ok(await pg.evaluate(PAY.format(P+'1'))=='paid', f'{TG}: одно нажатие по оплаченной — не снимает')
        await pg.locator(sel).click(); await pg.wait_for_timeout(600); ok(await pg.evaluate(PAY.format(P+'1'))=='due', f'{TG}: второе — снимает')
        # фильтр
        await pg.evaluate("__fd.D().jf.cus=window.__cid"); await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
        ok(not await pg.locator('#jr-due').is_hidden(), f'{TG}: кнопка «Ждут оплаты» видна')
        await tap(pg, f'#jr-body [data-jpay="{P}2"]')
        await pg.evaluate("document.querySelector('#jr-due').click()"); await pg.wait_for_timeout(600)
        ids=await pg.evaluate("[...document.querySelectorAll('#jr-body [data-jpay]')].map(b=>b.dataset.jpay)")
        ok(f'{P}2' not in ids and f'{P}0' in ids, f'{TG}: «Ждут оплаты» — только неоплаченные')
        t=await pg.text_content('#jr-sum'); ok('ждём оплату' in t and 'дольше 30' in t, f'{TG}: итог «ждём оплату … дольше 30 дней» ({t.strip()[:90]})')
        await pg.evaluate("document.querySelector('[data-jpf=\"old\"]').click()"); await pg.wait_for_timeout(500)
        ok(await pg.input_value('#jr-pay')=='old', f'{TG}: «дольше 30 дней» — фильтр')
        await pg.evaluate("(()=>{const s=document.querySelector('#jr-pay'); s.value='due'; s.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pg.wait_for_timeout(500)
        n=await pg.locator('#jr-body [data-jpay]').count()
        if n>1:
            a=pg.locator('[data-jpall]'); await a.click(); await a.click(); await pg.wait_for_timeout(800)
            ok(await pg.locator('#jr-body [data-jpay]').count()==0, f'{TG}: «Отметить все» — список пуст')
            await pg.locator('#fd-toasts .ta', has_text='Отменить').last.click(); await pg.wait_for_timeout(600)
            ok(await pg.locator('#jr-body [data-jpay]').count()==n, f'{TG}: «Отменить» вернул')
        sw=await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"); ok(sw, f'{TG}: нет прокрутки вбок')
        await pg.screenshot(path=f'/tmp/jpay-{TG}.png')
        ok(not errs, f'{TG}: ошибок нет {errs[:2]}'); await ctx.close()
        ctx,pg,errs=await login(b,'Наталья','2222'); await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(1500)
        ok(await pg.locator('#jr-body [data-jpay]').count()==0 and await pg.locator('#jr-payw').is_hidden(), f'{TG}: Наталья не видит оплату')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else fails)
asyncio.run(main())
