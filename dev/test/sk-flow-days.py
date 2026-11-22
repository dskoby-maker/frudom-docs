"""Склад → История → «Куда ушёл товар» → «По дням»: календарь месяца, день — фильтр, порядок «когда · куда · что · сколько · сумма», переход в накладную. PH=1 — телефон."""
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
    await pg.evaluate("localStorage.removeItem('frudom-skflv'); localStorage.removeItem('frudom-skflg')")
    await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    await pg.click('#sk-segs [data-skt="log"]'); await pg.wait_for_timeout(800)
    ok(await pg.locator('#sk-list .skfg [data-skfg="day"].on').count()==1, 'по умолчанию — «По дням»')
    today=await pg.evaluate("todayISO()") if False else await pg.evaluate("(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
    cell=pg.locator(f'#sk-list .skfcd[data-skfday="{today}"]'); ok(await cell.count()==1 and 'has' in (await cell.get_attribute('class')), 'сегодня в календаре отмечено')
    ct=N(await cell.inner_text()); ok('−2,5к' in ct and (PH or '+2,4к' in ct), f'в клетке: ушло −2,5к, пришло +2,4к ({ct})')
    ops=pg.locator('#sk-list .skfo'); ok(await ops.count()==4, f'4 операции: 3 отгрузки и приход ({await ops.count()})')
    o=pg.locator('#sk-list .skfo.k-out').first
    order=await o.evaluate("e=>[...e.querySelector('.skfoh').children].map(c=>c.className)")
    ok(order[:5]==['skfot','skfoi','skfow','skfos','skfgo'], f'порядок: время → куда → сумма ({order})')
    lt=N(await o.locator('.skfol').first.inner_text()); ok('Гречка флоу' in lt or 'Гречка склад флоу' in lt, f'строка: что ({lt})')
    ok('−5 кг' in lt and '500 ₽' in lt, f'строка: сколько и сумма ({lt})')
    dh=N(await pg.inner_text('#sk-list .skfdh')); ok('Сегодня' in dh and '3 отгрузки' in dh and '2 500 ₽' in dh, f'шапка дня ({dh})')
    await cell.click(); await pg.wait_for_timeout(500)
    ok(await pg.locator('#sk-list .skfcd.sel').count()==1 and 'Показан день' in N(await pg.inner_text('#sk-list')), 'нажатие на день — только этот день')
    await pg.locator(f'#sk-list .skfcd[data-skfday="{today}"]').click(); await pg.wait_for_timeout(400)
    ok(await pg.locator('#sk-list .skfcd.sel').count()==0, 'повторное нажатие — все дни')
    await pg.click('#sk-list [data-skfym="-1"]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#sk-list .skfcd.has').count()==0 and 'ничего не нашлось' in N(await pg.inner_text('#sk-list')), 'прошлый месяц — пусто')
    await pg.click('#sk-list [data-skfym="0"]'); await pg.wait_for_timeout(500)
    ok(await pg.locator('#sk-list .skfo').count()==4, '«Сегодня» — назад к текущему месяцу')
    await pg.locator('#sk-list .skfo.k-out .skfoh').first.click(); await pg.wait_for_timeout(800)
    ok(await pg.locator('#fd-dcard[open]').count()==1, 'нажатие на отгрузку открывает накладную')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
    await pg.screenshot(path=f'/tmp/skdays-{"ph" if PH else "pc"}.png')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
