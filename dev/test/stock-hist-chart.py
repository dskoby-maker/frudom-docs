"""«История товара» на складе: график остатков (30 → 25.5 после прихода, отгрузки и списания), подсказка при наведении,
нажатие ведёт к дню в ленте, переключатель периода, телефон без прокрутки вбок. PH=1 — телефон."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'; VW=(390,820) if PH else (1400,900); SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}, has_touch=PH); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          D.products.push({id:'p-grc', name:'Гречка ядрица', code:'', unit:'кг', country:'', price:'120'}); D.prices[c.id]['p-grc']='120'; })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        S=lambda op,d: pg.evaluate(f"__sk.send('{op}',{json.dumps(d,ensure_ascii=False)},'тест').then(j=>j&&j.out||1)")
        await S('bulk',{'kind':'in','rows':[{'itemId':'','newName':'Гречка ядрица график','unit':'кг','qty':'20','price':'80','date':'2026-10-20','exp':'','supplier':'ИП Малишава','docRef':'Н-1'}]})
        it=await pg.evaluate("(()=>__sk.idx().S.items.find(i=>i.name==='Гречка ядрица график').id)()")
        await S('bulk',{'kind':'in','rows':[{'itemId':it,'newName':'','unit':'кг','qty':'10','price':'85','date':'2026-11-02','exp':'','supplier':'ИП Малишава','docRef':'Н-2'}]})
        await S('item',{'itemId':it,'links':['p-grc']})
        await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'gch1', customerId:window.__cid, number:'', lines:[{productId:'p-grc',qty:'4',price:'120',stk:{m:'s'},lid:'G1'}]}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(3500)
        bs=await pg.evaluate(f"__sk.idx().S.batches.filter(b=>b.itemId==='{it}').map(b=>b.id)")
        await S('wo',{'batchId':bs[0],'qty':'0.5','reason':'порвалась пачка'})
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        await pg.evaluate(f"document.querySelector('[data-skihist=\"{it}\"]').click()"); await pg.wait_for_timeout(600)
        ok(await pg.locator('#sk-dlg .skh-stk').count()==1, 'в «Истории товара» есть блок «Остаток на складе»')
        txt=await pg.text_content('#sk-dlg .skh-stk')
        ok('25,5' in txt, f'сейчас 25,5 кг (30 пришло − 4 отгрузка − 0,5 списано): {txt[:80]!r}')
        ok('30' in txt, 'максимум 30 кг в подписи/оси')
        Q=await pg.evaluate("(()=>{const v=document.querySelector('[data-skhch]'); return v?1:0})()")
        # подсказка при наведении в середину — между приходами 20 и 30
        box=await pg.locator('#sk-dlg [data-skhch]').bounding_box()
        await pg.mouse.move(box['x']+3, box['y']+box['height']/2); await pg.wait_for_timeout(200)
        tip=await pg.text_content('#sk-dlg .skh-tip')
        ok(await pg.is_visible('#sk-dlg .skh-tip') and 'без движений' in tip and '0' in tip, f'у левого края — день без движений, 0 кг: {tip!r}')
        await pg.mouse.move(box['x']+box['width']-2, box['y']+box['height']/2); await pg.wait_for_timeout(200)
        tip=await pg.text_content('#sk-dlg .skh-tip')
        ok('Сегодня' in tip and '25,5' in tip and '+30' in tip and 'Списание' in tip and 'Отгрузка' in tip, f'сегодня — 25,5 кг, приход +30, отгрузка и списание: {tip!r}')
        tb=await pg.locator('#sk-dlg .skh-tip').bounding_box(); db=await pg.locator('#sk-dlg').bounding_box()
        ok(tb['x']+tb['width']<=db['x']+db['width']+1 and tb['x']>=db['x']-1, 'подсказка не вылезает за окно')
        await pg.screenshot(path=f"{SHOT}/skh-chart{'-ph' if PH else ''}.png")
        # нажатие — к этому дню в ленте
        if PH:
            await pg.mouse.click(box['x']+box['width']-2, box['y']+box['height']/2); await pg.wait_for_timeout(150)
        await pg.mouse.click(box['x']+box['width']-2, box['y']+box['height']/2); await pg.wait_for_timeout(900)
        fl=await pg.evaluate("!!document.querySelector('#sk-dlg .skh-d.jflash')")
        ok(fl, 'нажатие на график подсветило этот день в ленте')
        # период
        await pg.click('#sk-dlg [data-skhcp="30"]'); await pg.wait_for_timeout(400)
        ok(await pg.locator('#sk-dlg [data-skhcp="30"].on').count()==1, 'переключатель «30 дней» включился')
        ok('25,5' in await pg.text_content('#sk-dlg .skh-stk'), 'за 30 дней текущий остаток тот же')
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth, (d=>d.scrollWidth-d.clientWidth)(document.querySelector('#sk-dlg'))]")
        ok(sw[0]<=sw[1] and sw[2]<=3, f'нет прокрутки вбок {sw}')
        await pg.screenshot(path=f"{SHOT}/skh-chart30{'-ph' if PH else ''}.png")
        ov=await pg.evaluate("(()=>{const d=document.querySelector('#sk-dlg'), r=d.getBoundingClientRect(); return [...d.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>r.right+1&&e.getClientRects().length).slice(0,5).map(e=>e.className+' '+Math.round(e.getBoundingClientRect().right-r.right))})()")
        print('  вылезают:', ov)
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок: 0' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
