"""Склад: рядом с кг — сколько это шт, рядом со шт — сколько кг (история товара, график, «Куда ушёл товар», окно накладной). PH=1 — телефон, на чистом сервере."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'; VW=(390,820) if PH else (1400,900); SHOT='/tmp'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}, has_touch=PH); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          D.products.push({id:'p-mak', name:'Макароны Ситно 500гх15шт рожки', code:'', unit:'кг', country:'', price:'90'}); D.prices[c.id]['p-mak']='90'; })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        S=lambda op,d: pg.evaluate(f"__sk.send('{op}',{json.dumps(d,ensure_ascii=False)},'тест').then(j=>j&&j.out||1)")
        await S('bulk',{'kind':'in','rows':[{'itemId':'','newName':'Макароны Ситно 500гх15шт рожки','unit':'шт','qty':'405','price':'39.2','date':'2026-11-13','exp':'','supplier':'РегионПродукт','docRef':'35027'}]})
        it=await pg.evaluate("__sk.idx().S.items.find(i=>i.name.startsWith('Макароны Ситно')).id")
        bid=await pg.evaluate(f"__sk.idx().S.batches.find(b=>b.itemId==='{it}').id")
        await S('rw',{'batchId':bid,'n':'405','kg':'202.5'})
        await S('item',{'itemId':it,'links':['p-mak']})
        await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'mk1', customerId:window.__cid, number:'', lines:[{productId:'p-mak',qty:'75',price:'90',stk:{m:'s'},lid:'M1'}]}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(3500)
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        await pg.evaluate(f"document.querySelector('[data-skihist=\"{it}\"]').click()"); await pg.wait_for_timeout(700)
        kpi=await pg.text_content('#sk-dlg .skh-kpi'); print(' kpi:', kpi)
        ok('127,5 кг' in kpi and '255 шт' in kpi, 'сейчас 127,5 кг и 255 шт')
        ok('405 шт' in kpi and '202,5 кг' in kpi, 'пришло 405 шт ≈ 202,5 кг')
        ok('75 кг' in kpi and '150 шт' in kpi, 'ушло 75 кг · 150 шт')
        st=await pg.text_content('#sk-dlg .skh-stk'); print(' chart:', st[:200])
        ok('пересчитаны' in st, 'шт пересчитаны в кг на графике')
        box=await pg.locator('#sk-dlg [data-skhch]').bounding_box()
        await pg.mouse.move(box['x']+box['width']-3, box['y']+box['height']/2); await pg.wait_for_timeout(200)
        tip=await pg.text_content('#sk-dlg .skh-tip'); print(' tip:', tip)
        ok('127,5' in tip and '255 шт' in tip, 'подсказка с кг и шт')
        lst=await pg.text_content('#sk-dlg .skh-list'); print(' list:', ' '.join(lst.split())[:400])
        ok('≈ 202,5 кг' in lst and '78,40 ₽/кг' in lst, 'в ленте у прихода в шт — кг и цена за кг')
        pr=await pg.text_content('#sk-dlg .skh-price'); ok('₽/кг' in pr, 'последняя цена и ₽/кг')
        await pg.screenshot(path=f"{SHOT}/alt-hist{'-ph' if PH else ''}.png")
        # flow
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
        await pg.click('#sk-segs [data-skt="log"]'); await pg.wait_for_timeout(800)
        fl=await pg.inner_text('#sk-list'); print(' flow:', ' '.join(fl.split())[:300])
        ok('150 шт' in fl, 'в «Куда ушёл товар» рядом с 75 кг — 150 шт')
        await pg.screenshot(path=f"{SHOT}/alt-flow{'-ph' if PH else ''}.png", full_page=False)
        # doc card
        await pg.click('#sk-list .skfo.k-out .skfoh'); await pg.wait_for_timeout(700)
        dc=await pg.text_content('#fd-dcard'); ok('150 шт' in dc, 'в окне накладной у 75 кг — ≈150 шт')
        await pg.screenshot(path=f"{SHOT}/alt-doc{'-ph' if PH else ''}.png")
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'нет прокрутки вбок {sw}')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок: 0' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
