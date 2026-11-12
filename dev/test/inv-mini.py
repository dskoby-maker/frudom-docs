"""Блок «Последние счета» на «Новом документе»: по 5, «Показать ещё», поиск, заказчик, период, порядок, сброс, телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def clk(pg, sel):
    await pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(100); await pg.click(sel)
async def nums(pg): return await pg.evaluate("[...document.querySelectorAll('#inv-mlist .invr .invd b')].map(b=>b.textContent.replace('№ ',''))")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in [(1300,900),(390,844)]:
            ctx=await b.new_context(viewport={'width':W,'height':H}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("""(()=>{ const D=__fd.D(), c=D.customers.filter(c=>!c.priv), s=D.suppliers[0].id, t=new Date(), m=t.toISOString().slice(0,7);
              const prev=new Date(t.getFullYear(), t.getMonth()-1, 10).toISOString().slice(0,10);
              D.invoices=[]; for(let i=1;i<=8;i++) D.invoices.push({id:'tinv'+i, number:String(i), date:i<=3?prev:m+'-0'+(i-3), supplierId:s, customerId:(i%2?c[0]:c[1]).id, place:'', period:'Тест', sum:String(i*1000+(i===8?500:0)), data:JSON.stringify({lines:[{name:i===5?'Курага особая':'Товар',unit:'кг',qty:1,price:i*1000}]})});
              window.__c1=c[1].id; })()""")
            await pg.evaluate("location.hash='#zhurnal'"); await pg.wait_for_timeout(300); await pg.evaluate("location.hash='#dokument'"); await pg.wait_for_timeout(800)
            await pg.locator('#inv-recent > summary').scroll_into_view_if_needed(); await pg.click('#inv-recent > summary'); await pg.wait_for_timeout(400)
            n=await nums(pg); ok(n==['8','7','6','5','4'], f'{W}: по умолчанию 5 последних: {n}')
            ok((await pg.text_content('#inv-msum')).strip()=='8', f'{W}: в заголовке всего 8')
            await clk(pg, '[data-invmmore]'); await pg.wait_for_timeout(200); n=await nums(pg); ok(len(n)==8, f'{W}: «Показать ещё» — все 8: {n}')
            await clk(pg, '[data-invmless]'); await pg.wait_for_timeout(200); ok(len(await nums(pg))==5, f'{W}: «Свернуть до 5»')
            await pg.fill('#inv-mq','курага'); await pg.wait_for_timeout(200); n=await nums(pg); ok(n==['5'], f'{W}: поиск по товару: {n}')
            ok(await pg.evaluate("document.activeElement.id")=='inv-mq', f'{W}: курсор остаётся в поиске')
            await pg.press('#inv-mq','Escape'); await pg.wait_for_timeout(200); ok(len(await nums(pg))==5, f'{W}: Esc очищает поиск')
            await pg.select_option('#inv-msort','sumd'); await pg.wait_for_timeout(200); n=await nums(pg); ok(n[0]=='8' and n[1]=='7', f'{W}: порядок по сумме: {n}')
            await pg.select_option('#inv-msort','old'); await pg.wait_for_timeout(200); n=await nums(pg); ok(n[0] in ('1','2','3'), f'{W}: сначала старые: {n}')
            await clk(pg, '[data-invmper="m1"]'); await pg.wait_for_timeout(200); n=await nums(pg); ok(sorted(n)==['1','2','3'], f'{W}: прошлый месяц: {n}')
            await clk(pg, '[data-invmper=""]'); await pg.wait_for_timeout(200)
            await pg.evaluate("(()=>{ const s=document.getElementById('inv-mcus'); s.value=window.__c1; s.dispatchEvent(new Event('change',{bubbles:true})); })()"); await pg.wait_for_timeout(200)
            n=await nums(pg); ok(n and all(int(x)%2==0 for x in n), f'{W}: только счета заказчика: {n}')
            t=await pg.text_content('#inv-mlist .invmh2'); ok('Найдено' in t and '4' in t, f'{W}: итог по найденным: {t.strip()[:80]}')
            ok(await pg.evaluate("document.querySelector('#inv-mlist [data-invmreset]').getBoundingClientRect().right")<=W, f'{W}: «Сбросить» не вылезает за край')
            await clk(pg, '#inv-mlist [data-invmreset]'); await pg.wait_for_timeout(300)
            ok(await pg.locator('#inv-recent').get_attribute('open') is not None and len(await nums(pg))==5, f'{W}: «Сбросить» — снова все, блок открыт')
            ok(await pg.evaluate("document.getElementById('inv-msort').value")=='old', f'{W}: порядок запомнился')
            await pg.select_option('#inv-msort','new')
            await clk(pg, '#inv-mlist [data-invall]'); await pg.wait_for_timeout(500); ok(await pg.locator('#fd-dcard #inv-list').count()==1, f'{W}: «Все счета ›» открывает окно')
            ok(await pg.locator('#fd-dcard #inv-sort').count()==1, f'{W}: в окне «Все счета» тоже есть порядок')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: без прокрутки вбок')
            await pg.locator('#inv-dc').screenshot(path=f'/tmp/invm{W}.png')
            ok(not errs, f'{W}: ошибок нет {errs}')
            await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
