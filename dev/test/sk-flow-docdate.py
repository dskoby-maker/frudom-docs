"""Склад → История → «Куда ушёл товар» → «По дням»: отгрузка — по дате накладной, рядом когда списано. Было: календарь месяца, день — фильтр, порядок «когда · куда · что · сколько · сумма», переход в накладную. PH=1 — телефон."""
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
    yd=await pg.evaluate("(()=>{const d=new Date(); d.setDate(d.getDate()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'fdd1', customerId:window.__c1, number:'', date:'{yd}', lines:[{{productId:'p-flw',qty:'6',price:'100',stk:{{m:'s'}},stkSet:1}}]}}); }})()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save')
    await until(pg,"(document.getElementById('fd-toasts')||{textContent:''}).textContent.includes('списано со склада')"); await pg.wait_for_timeout(900)
    await pg.evaluate("localStorage.removeItem('frudom-skflv'); localStorage.removeItem('frudom-skflg')")
    await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
    await pg.evaluate("document.querySelectorAll('dialog[open]').forEach(d=>d.close())")
    await pg.click('#sk-segs [data-skt="log"]'); await pg.wait_for_timeout(800)
    # если вчера — в прошлом месяце, листаем
    if yd[:7]!=__import__("datetime").date.today().isoformat()[:7]: await pg.click('#sk-list [data-skfym="-1"]'); await pg.wait_for_timeout(500)
    cell=pg.locator(f'#sk-list .skfcd[data-skfday="{yd}"]'); ok(await cell.count()==1 and 'has' in (await cell.get_attribute('class')), 'отгрузка отмечена в календаре в день накладной (вчера)')
    days=await pg.evaluate("[...document.querySelectorAll('#sk-list .skfday')].map(s=>s.querySelector('.skfdh b').textContent)")
    ok(any(d.startswith('Вчера') for d in days), f'есть день «Вчера» ({days})')
    sec=pg.locator('#sk-list .skfday').filter(has_text='Вчера')
    t=N(await sec.locator('.skfo.k-out').inner_text()); ok('списано со склада' in t, f'видно, когда списано со склада ({t})')
    td=__import__("datetime").date.today().strftime("%d.%m"); ok(td in t, f'дата списания {td} в строке')
    ok(N(await sec.locator('.skfo.k-out .skfot').inner_text())==td, 'в колонке времени — дата списания')
    await pg.screenshot(path=f'/tmp/skdd-{"ph" if PH else "pc"}.png')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
