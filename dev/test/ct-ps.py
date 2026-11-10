"""Подсказки товара в документе учитывают выбранный договор: сначала «По договору «…»» (порядок договора), ниже остальные товары заказчика бледнее; другой договор — свои товары."""
import asyncio, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            r=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>!x.priv&&x.id!=='private-buyer'), s=D.suppliers[0];
              const P=D.products.filter(p=>p.name).slice(0,6); D.prices=D.prices||[];
              const a={id:'ct-a',customerId:c.id,supplierId:s.id,basis:'Договор № A от 01.01.2026',short:'Краги',ikz:'',maxSum:'',dateTo:'2026-12-31',spec:JSON.stringify([{name:P[3].name,pid:P[3].id,price:'808.43',unit:'пар'},{name:P[1].name,pid:'',price:'',unit:''}])};
              const bb={id:'ct-b',customerId:c.id,supplierId:s.id,basis:'Договор № B от 01.01.2026',short:'Перчатки',ikz:'',maxSum:'',dateTo:'2026-12-31',spec:JSON.stringify([{name:P[5].name,pid:P[5].id}])};
              D.contracts=D.contracts.filter(x=>x.customerId!==c.id).concat([a,bb]); D.draft.customerId=c.id; D.draft.supplierId=s.id; D.draft.contractId='ct-a';
              return {c:c.id, n3:P[3].name, n1:P[1].name, n5:P[5].name}})()""")
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(700)
            async def sug():
                inp=pg.locator('#d-lines .line[data-i] input.ps, #d-lines .line[data-i] input[type=text]').first
                await inp.scroll_into_view_if_needed(); await inp.click(); await inp.fill(''); await inp.press('Space'); await inp.press('Backspace'); await pg.wait_for_timeout(300)
                return await pg.evaluate("[...document.querySelectorAll('.psm .pst, .psm button[data-psi]')].map(e=>e.classList.contains('pst')?'#'+e.textContent:(e.querySelector('span')||e).textContent)")
            L=await sug()
            L=[x for x in L]; print(W, L[:5])
            ok(L and L[0].startswith('#По договору «Краги»'), f'{W}: первая группа — «По договору «Краги»»')
            ok(len(L)>2 and L[1].startswith(r['n3']) and L[2].startswith(r['n1']), f'{W}: товары договора по порядку договора')
            ok(any(x.startswith('#Другие товары заказчика') for x in L) or len([x for x in L if x.startswith('#')])==1, f'{W}: остальные — ниже, под «не по этому договору»')
            await pg.keyboard.press('Escape')
            await pg.evaluate("(s=>{s.value='ct-b';s.dispatchEvent(new Event('change',{bubbles:true}))})(document.querySelector('#d-ctr'))"); await pg.wait_for_timeout(300)
            L=await sug(); ok(L and L[0].startswith('#По договору «Перчатки»') and L[1].startswith(r['n5']), f'{W}: сменили договор — свои товары: {L[:2]}')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
