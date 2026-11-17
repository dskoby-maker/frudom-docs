"""Связь позиции документа с товаром склада «только для заказчика».
Позиция «Изделия макаронные (макароны фигурные)» связана с «Макфа» для всех; для заказчика А в окне закупки
выбираем другой товар склада «Ситно» — связь пишется только для А, у Б остаётся «Макфа».
Проверка: таблица (связи, названия связей, резерв по нужным партиям), карточка товара склада, строка в форме, «для всех» снимает свою связь, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
def rows(sheet):
    d=dump().get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, t=9000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
def items(): return {r['ID']:r for r in rows('Склад: товары')}
def links(name):
    for r in rows('Склад: товары'):
        if r['Товар на складе']==name: return json.loads(r.get('Связи с позициями документов (ID)') or r.get('links') or '[]')
    return None
async def save_doc(pg, did, cid, stk=None):
    await pg.evaluate(f"""(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{did}', customerId:'{cid}', number:'', lines:[{{productId:'p-mac',qty:'3',price:'120'{(",stk:"+json.dumps(stk)+",stkSet:1") if stk else ""}}}]}}); }})()""")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2200)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        ok(await pg.evaluate("__fd.D().srvVer>=43"), 'скрипт таблицы новый (≥ 43)')
        await pg.evaluate("""(()=>{const D=__fd.D(), A=D.customers[0], B=D.customers[1]; window.__A=A.id; window.__B=B.id;
          D.products.push({id:'p-mac', name:'Изделия макаронные тестовые (рожки ТСТ)', code:'', unit:'кг', country:'', price:'120'}); [A,B].forEach(c=>{ D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['p-mac']='120'; }); })()""")
        A=await pg.evaluate("window.__A"); B=await pg.evaluate("window.__B")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        await pg.evaluate("__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:'Макароны Макфа Спирали 400г',unit:'кг',qty:'10',price:'90',date:'2026-11-01',exp:'',supplier:'',docRef:''},{itemId:'',newName:'Макароны фас Ситно рожки',unit:'кг',qty:'10',price:'70',date:'2026-11-02',exp:'',supplier:'',docRef:''}]},'тест')")
        await pg.wait_for_timeout(600)
        mk=await pg.evaluate("Object.values(__sk.idx().item).find(i=>i.name.startsWith('Макароны Макфа')).id")
        st=await pg.evaluate("Object.values(__sk.idx().item).find(i=>i.name.startsWith('Макароны фас Ситно')).id")
        await pg.evaluate(f"__sk.send('item',{{itemId:'{mk}', links:['p-mac']}},'связь')"); await pg.wait_for_timeout(400)
        ok(await pg.evaluate(f"__sk.item('p-mac','{A}').id==='{mk}' && __sk.item('p-mac','{B}').id==='{mk}'"), 'сначала позиция связана с «Макфа» для всех')

        # накладная А, окно закупки: «Со склада», выбран «Макфа» → «Сменить» → «Ситно»
        await save_doc(pg,'cl-a',A)
        ok(await pg.evaluate("__fd.D().journal.some(j=>j.id==='cl-a')"), 'накладная заказчика А сохранена')
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"cl-a\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); ok(await until(pg,"!!document.querySelector('#dc-zki .dzl')"), 'открылась закупка накладной')
        await pg.click('#dc-zki .dzr:nth-child(1) [data-dzm="s"]'); await pg.wait_for_timeout(250)
        sel=await pg.text_content('#dc-zki .dzr:nth-child(1) .skpk')
        ok('Макфа' in sel and 'для всех заказчиков' in sel and 'Сменить' in sel, f'у связанной позиции видно товар склада, «связь для всех» и «Сменить»: {sel.strip()[:120]}')
        await pg.click('#dc-zki .dzr:nth-child(1) [data-skpkclr]'); await pg.wait_for_timeout(250)
        await pg.fill('#dc-zki .dzr:nth-child(1) .skpq','ситно'); await pg.wait_for_timeout(200)
        await pg.click('#dc-zki .dzr:nth-child(1) [data-skpk]'); await pg.wait_for_timeout(250)
        sc=await pg.evaluate("[...document.querySelectorAll('#dc-zki .dzr:nth-child(1) .sklsc button')].map(b=>b.textContent+(b.classList.contains('on')?'*':''))")
        ok(len(sc)==2 and sc[1].endswith('*') and 'только для' in sc[1], f'после выбора другого товара — «для всех / только для заказчика», по умолчанию только для заказчика: {sc}')
        await pg.screenshot(path=f'{SHOT}/cus-link-zk.png', full_page=False)
        await pg.click('#dc-zki [data-zkc="save"]')
        ok(await until(pg,"(document.getElementById('dc-zkmsg')||{}).textContent==='Сохранено ✓'", 15000), 'закупка сохранена')
        await pg.wait_for_timeout(1000)
        sit=[r for r in rows('Склад: товары') if r['Товар на складе'].startswith('Макароны фас Ситно')][0]
        mak=[r for r in rows('Склад: товары') if r['Товар на складе'].startswith('Макароны Макфа')][0]
        col=[k for k in sit if 'ID' in k and 'озиц' in k] or [k for k in sit if sit[k].startswith('[')]
        sl=json.loads(sit[col[0]]) if col else []; ml=json.loads(mak[col[0]]) if col else []
        ok(sl==['p-mac@'+A], f'у «Ситно» связь только для А: {sl}')
        ok(ml==['p-mac'], f'у «Макфа» общая связь осталась: {ml}')
        names=[v for k,v in sit.items() if 'Позиции' in k]
        ok(names and 'только для' in names[0], f'в таблице название связи понятное: {names}')
        mv=[r for r in rows('Склад: движения')+rows('Склад: резервы') if 'cl-a' in json.dumps(r)]
        ok(mv and all(st in json.dumps(r, ensure_ascii=False) for r in mv) and not any(mk in json.dumps(r, ensure_ascii=False) for r in mv), f'накладная А списана/зарезервирована с «Ситно»: {len(mv)}')

        # накладная Б со склада — резерв на «Макфа»
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        await save_doc(pg,'cl-b',B,{'m':'s'})
        resb=[r for r in rows('Склад: резервы') if 'cl-b' in json.dumps(r)]
        ok(resb and mk in json.dumps(resb, ensure_ascii=False), f'резерв накладной Б — на «Макфа» (общая связь): {len(resb)}')
        ok(await pg.evaluate(f"__sk.item('p-mac','{A}').id==='{st}' && __sk.item('p-mac','{B}').id==='{mk}'"), 'на сайте: А → Ситно, Б → Макфа')

        # строка в форме для А: значок склада и окно показывают «Ситно», «Связь только для …»
        await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'', customerId:'{A}', number:'', lines:[{{productId:'p-mac',qty:'2',price:'120'}}]}}); }})()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(500)
        await pg.click('#d-lines [data-skl="0"]'); await pg.wait_for_timeout(400)
        t=await pg.text_content('#sk-dlg')
        ok('Ситно' in t and 'только для' in t and 'Другой товар склада' in t, f'окно строки: Ситно, связь только для А, «Другой товар склада…»: {t[:160].strip()}')
        await pg.click('#sk-dlg [data-sk="relink"]'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#sk-dlg .sklsc button').count()==2 and await pg.locator('#sk-dlg .sklq2').count()==1, '«Другой товар склада…» — поиск и выбор «для всех / только для»')
        await pg.click('#sk-dlg [data-sk="relinkOff"]'); await pg.wait_for_timeout(200); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)

        # карточка товара склада «Ситно»: чип «только для», выбор заказчика Б в «Связать для»
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(800)
        await pg.evaluate(f"document.querySelector('[data-skitem=\"{st}\"]').click()"); await pg.wait_for_timeout(500)
        chip=await pg.text_content('#sk-dlg .sklink.cus'); ok('только для' in chip, f'в карточке склада чип связи «только для …»: {chip.strip()}')
        await pg.select_option('#sk-dlg .sklcs', B); await pg.fill('#sk-dlg .sklq','рожки тст'); await pg.wait_for_timeout(300)
        sg=await pg.text_content('#sk-dlg .sklsug'); ok('только для' in sg and 'Макфа' in sg, f'для Б подсказка «связать только для Б · другим останется Макфа»: {sg.strip()[:140]}')
        await pg.click('#sk-dlg [data-sklink]'); await pg.wait_for_timeout(1200)
        sl=json.loads([r for r in rows('Склад: товары') if r['Товар на складе'].startswith('Макароны фас Ситно')][0][col[0]])
        ok(sorted(sl)==sorted(['p-mac@'+A,'p-mac@'+B]), f'связали для Б из карточки склада: {sl}')
        await pg.wait_for_timeout(1500)
        resb=[r for r in rows('Склад: резервы') if 'cl-b' in json.dumps(r)]
        ok(resb and st in json.dumps(resb, ensure_ascii=False), 'резерв накладной Б сам переехал на «Ситно»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)

        # «для всех» у Макфа снимает свою связь А с Ситно
        await pg.evaluate(f"__sk.linkTo('{mk}',['p-mac'],'{A}','all')"); await pg.wait_for_timeout(800)
        sl=json.loads([r for r in rows('Склад: товары') if r['Товар на складе'].startswith('Макароны фас Ситно')][0][col[0]])
        ok(sl==['p-mac@'+B], f'«для всех» для А — своя связь А с «Ситно» снята: {sl}')
        ok(not errs, f'ошибок на странице нет: {errs[:3]}')

        # телефон: карточка склада без прокрутки вбок
        c2,p2,e2=await login(b,(390,800))
        await p2.evaluate(TAB+"('stock')"); await p2.wait_for_timeout(1200)
        await p2.evaluate(f"document.querySelector('[data-skitem=\"{st}\"]').click()"); await p2.wait_for_timeout(600)
        w=await p2.evaluate("[document.documentElement.scrollWidth, innerWidth, getComputedStyle(document.querySelector('#sk-dlg')).overflowX, Math.max(...[...document.querySelectorAll('#sk-dlg .sklc, #sk-dlg .sklink, #sk-dlg .sklinkadd')].map(e=>e.getBoundingClientRect().right))]")
        ok(w[0]<=w[1] and w[2]=='hidden' and w[3]<=w[1], f'телефон: без прокрутки вбок {w}')
        await p2.screenshot(path=f'{SHOT}/cus-link-phone.png')
        ok(not e2, f'телефон: ошибок нет {e2[:3]}')
        await b.close()
    print('\nИТОГ:', 'всё хорошо' if not fails else f'{len(fails)} ошибок'); return 1 if fails else 0
import sys; sys.exit(asyncio.run(main()))
