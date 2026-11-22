"""Склад → История → «Куда ушёл товар»: плитки, карточка товара с полосой «кому ушло», раскрытие, фильтр по заказчику, «По заказчикам», переход в накладную, «Все действия». PH=1 — телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
N=lambda s:(s or '').replace('\xa0',' ').replace(' ',' ')
async def until(pg, js, t=12000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    pg=await b.new_page(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""(()=>{const D=__fd.D(), C=D.customers.filter(c=>c.id!=='__private'&&!c.priv); window.__c1=C[0].id; window.__c2=C[1].id;
      D.products.push({id:'p-flw', name:'Гречка флоу', code:'', unit:'кг', country:'', price:'100'}); [C[0],C[1]].forEach(c=>{ D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['p-flw']='100'; }); })()""")
    await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
    await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Гречка склад флоу',unit:'кг',qty:'40',price:'60',date:'2026-11-20',exp:'',supplier:'Поставщик Ромашка',docRef:'BA-77'}]},'тест')"); await pg.wait_for_timeout(900)
    iid=await pg.evaluate("__sk.state().items.find(i=>i.name==='Гречка склад флоу').id")
    await pg.evaluate("id=>__sk.linkTo(id,['p-flw'],'','all')", iid); await pg.wait_for_timeout(900)
    async def mkdoc(did, cid, q):
        await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{did}', customerId:window.{cid}, number:'', lines:[{{productId:'p-flw',qty:'{q}',price:'100',stk:{{m:'s'}},stkSet:1}}]}}); }})()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save')
        await until(pg,"(document.getElementById('fd-toasts')||{textContent:''}).textContent.includes('списано со склада')"); await pg.wait_for_timeout(900)
    await mkdoc('fl1','__c1',12); await mkdoc('fl2','__c2',8); await mkdoc('fl3','__c1',5)
    await pg.evaluate("localStorage.removeItem('frudom-skflv')")
    await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    await pg.click('#sk-segs [data-skt="log"]'); await pg.wait_for_timeout(700)
    ok(await pg.locator('#sk-list .skfvw [data-skfv="flow"].on').count()==1, 'по умолчанию — «Куда ушёл товар»')
    card=pg.locator(f'#sk-list .skfcard[data-skfcard="i:{iid}"]'); ok(await card.count()==1, 'карточка товара есть')
    t=N(await card.inner_text()); ok('пришло 40 кг' in t and 'ушло 25 кг' in t and '3 накладные' in t, f'подпись: пришло/ушло/накладные ({t[:120]})')
    ok(await card.locator('.skfbar .skfs').count()==3, 'полоса: 2 заказчика + остаток')
    ok('15 кг' in N(await card.locator('.skfr8').inner_text()), 'на складе 15 кг')
    tt=N(await pg.inner_text('#sk-list .skfts')); ok('2 400 ₽' in tt and '1 500 ₽' in tt and '3 накладные' in tt, f'плитки: пришло 2400, ушло 1500 ({tt})')
    await card.locator('.skfh').click(); await pg.wait_for_timeout(500)
    ok(await card.evaluate("e=>e.classList.contains('open')"), 'нажатие раскрывает')
    ok(await card.locator('.skfr').count()==4, 'внутри 4 движения: приход и 3 отгрузки')
    ok('Поставщик Ромашка' in N(await card.inner_text()), 'видно, от кого пришло')
    n1=await pg.evaluate("cusNm(__c1)") if False else None
    await card.locator('.skfchips [data-skfcus]').first.click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('#sk-list .skff').count()==1, 'фильтр по заказчику — строка «Показано»')
    card=pg.locator(f'#sk-list .skfcard[data-skfcard="i:{iid}"]')
    ok(await card.locator('.skfchips [data-skfcus]').count()==1 and 'ушло 17 кг' in N(await card.inner_text()), 'только один заказчик: ушло 17 кг')
    await pg.click('#sk-list [data-skfreset]'); await pg.wait_for_timeout(400)
    await pg.click('#sk-list [data-skfk="in"]'); await pg.wait_for_timeout(400)
    card=pg.locator(f'#sk-list .skfcard[data-skfcard="i:{iid}"]')
    ok(await card.locator('.skfr').count()==1, 'плитка «Пришло» — только приход')
    await pg.click('#sk-list [data-skfk="in"]'); await pg.wait_for_timeout(300)
    await card.locator('.skfh').click(); await pg.wait_for_timeout(500); await pg.screenshot(path=f'/tmp/skflow-items-{"ph" if PH else "pc"}.png'); await card.locator('.skfh').click(); await pg.wait_for_timeout(300)
    await pg.click('#sk-list [data-skfg="cus"]'); await pg.wait_for_timeout(700)
    cc=pg.locator('#sk-list .skfcard.cus'); ok(await cc.count()==2, 'по заказчикам — 2 карточки')
    c1=pg.locator('#sk-list .skfcard.cus').first; ok('2 накладные' in N(await c1.inner_text()) or '1 накладная' in N(await c1.inner_text()), 'у заказчика — число накладных')
    await c1.locator('.skfh').click(); await pg.wait_for_timeout(500)
    await c1.locator('.skfr.go').first.click(); await pg.wait_for_timeout(800)
    ok(await pg.locator('#fd-dcard[open]').count()==1, 'накладная открывается из истории')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'/tmp/skflow-{"ph" if PH else "pc"}.png', full_page=False)
    await pg.click('#sk-list [data-skfv="log"]'); await pg.wait_for_timeout(600)
    ok(await pg.locator('#sk-list .sklog').count()==1, '«Все действия» — прежняя лента')
    ok(await pg.evaluate("localStorage.getItem('frudom-skflv')")=='log', 'выбор запомнился')
    await pg.click('#sk-list [data-skfv="flow"]'); await pg.wait_for_timeout(600)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
