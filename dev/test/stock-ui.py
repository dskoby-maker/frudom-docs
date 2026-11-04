"""Склад на сайте (Playwright, тестовый сервер): приход, связь с договорной позицией, поиск по складскому названию,
источник «Со склада» в строке документа, резерв с нехваткой, обновление резерва, отгрузка, прибыль, Гриша, без связи, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def dump(): return json.load(urllib.request.urlopen('http://localhost:8787/dump'))
def rows(sheet):
    d=dump().get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw, who='Даниил', pw='1111'):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def wide(pg, name):
    sw=await pg.evaluate("document.documentElement.scrollWidth"); w=await pg.evaluate("innerWidth"); ok(sw<=w, f'{name}: нет прокрутки вбок ({sw} ≤ {w})')
async def until(pg, js, t=8000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        # договорная позиция и прайс заказчика (как у гематологии)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>x.inn==='7729082090'); const p={id:'p-ship', name:'Ягоды сушеные (шиповник)', code:'', unit:'кг', country:'', price:'300'}; D.products.push(p); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id][p.id]='300'; window.__cid=c.id; })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        ok(await pg.locator('#sk-kpi .skk').count()==4, 'четыре показателя склада')
        await pg.screenshot(path=f'{SHOT}/sk-empty.png')
        # приход
        await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(300)
        await pg.fill('#sk-dlg .skf-name','шиповник сушёный'); await pg.wait_for_timeout(150)
        ok(await pg.locator('#sk-dlg [data-skpick=""]').count()==1, 'подсказка «+ Новый товар»')
        await pg.fill('#sk-dlg .skf-name','Шиповник сушёный'); await pg.fill('#sk-dlg .skf-qty','8'); await pg.fill('#sk-dlg .skf-price','70'); await pg.fill('#sk-dlg .skf-sup','Саид'); await pg.fill('#sk-dlg .skf-doc','н-1')
        await pg.screenshot(path=f'{SHOT}/sk-in.png')
        await pg.click('#sk-dlg [data-sk="inSave"]'); ok(await until(pg,"!!document.querySelector('#sk-dlg .skuv')"), 'приход проведён, открылась карточка товара')
        # связь с договорной позицией
        await pg.fill('#sk-dlg .sklq','ягоды сушеные'); await pg.wait_for_timeout(200)
        await pg.click('#sk-dlg [data-sklink="p-ship"]'); ok(await until(pg,"!!document.querySelector('#sk-dlg [data-skunlink=\"p-ship\"]')"), 'договорная позиция связана со складским товаром')
        await pg.screenshot(path=f'{SHOT}/sk-item.png', full_page=False)
        await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(300)
        # документ: поиск по складскому названию, источник «Со склада»
        await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'dsk1', customerId:window.__cid, number:'', lines:[{productId:'',qty:'',price:''}]}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400)
        await pg.click('#d-lines .line[data-i="0"] .ps'); await pg.keyboard.type('шиповник'); await pg.wait_for_timeout(300)
        sug=await pg.text_content('.psm'); ok('Ягоды сушеные (шиповник)' in sug and 'склад' in sug, f'поиск «шиповник» нашёл договорную позицию: {sug[:80]}')
        await pg.click('.psm [data-psi="0"]'); await pg.wait_for_timeout(200)
        await pg.fill('#d-lines .line[data-i="0"] .qty','10'); await pg.wait_for_timeout(200)
        note=await pg.text_content('#d-lines .line[data-i="0"] .sknote'); ok('свободно' in note and 'Саида' in note, f'подсказка об остатке: {note.strip()[:70]}')
        await pg.click('#d-lines .line[data-i="0"] .skb'); await pg.wait_for_timeout(300)
        await pg.check('#sk-dlg input[name="sksrc"][value="s"]'); await pg.click('#sk-dlg [data-sk="lineSave"]'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("__fd.D().draft.lines[0].stk.m==='s'"), 'выбран источник «Со склада»')
        await pg.screenshot(path=f'{SHOT}/sk-docline.png')
        await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        ok(await until(pg,"(document.getElementById('fd-toasts')||{textContent:''}).textContent.includes('нехватка 2')", 9000), 'после сохранения сервер ответил: резерв 8, нехватка 2')
        await pg.screenshot(path=f'{SHOT}/sk-saved.png')
        R=rows('Склад: резервы'); ok(sum(float(r['Количество']) for r in R)==8, 'в таблице резерв 8 кг')
        jn=[r for r in rows('Журнал') if r['ID']=='dsk1']; ok(jn and 'Ягоды сушеные (шиповник)' in jn[0]['Данные документа (не редактировать)'], 'в накладной — точное договорное название')
        # склад: нехватка
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(800)
        await pg.click('#sk-kpi [data-skdet="short"]'); await pg.wait_for_timeout(400)
        ok('не хватает' in await pg.text_content('#sk-det'), 'показатель «Документов с нехваткой» раскрывается')
        await pg.screenshot(path=f'{SHOT}/sk-tab.png', full_page=True)
        # ещё приход 2 кг и обновление резерва из окна документа
        await pg.click('[data-sk="in"]'); await pg.wait_for_timeout(300)
        await pg.fill('#sk-dlg .skf-name','Шиповник сушёный'); await pg.fill('#sk-dlg .skf-qty','2'); await pg.fill('#sk-dlg .skf-price','75'); await pg.fill('#sk-dlg .skf-sup','Саид'); await pg.fill('#sk-dlg .skf-doc','н-2')
        await pg.click('#sk-dlg [data-sk="inSave"]'); await until(pg,"!!document.querySelector('#sk-dlg .skuv')"); await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(300)
        await pg.click('#sk-kpi [data-skdet="res"]'); await pg.wait_for_timeout(300); await pg.click('#sk-det [data-skdoc="dsk1"]'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#fd-dcard .skdoc').count()==1, 'в окне накладной — блок «Склад»')
        await pg.click('#fd-dcard [data-skd="reserve"]'); ok(await until(pg,"!document.querySelector('#fd-dcard .skdoc em.s')"), 'обновление резерва устранило нехватку')
        await pg.screenshot(path=f'{SHOT}/sk-doccard.png')
        # отгрузка
        await pg.click('#fd-dcard [data-skd="ship"]'); await pg.wait_for_timeout(400)
        ok(await pg.input_value('#sk-dlg .skshq')=='10', 'к отгрузке предложено 10 кг (весь резерв)')
        await pg.screenshot(path=f'{SHOT}/sk-ship.png')
        await pg.click('#sk-dlg [data-sk="shipSave"]'); await pg.wait_for_timeout(1500)
        M=[m for m in rows('Склад: движения') if m['Код операции']=='ship']; ok(abs(sum(-float(m['Количество'])*float(m['Себестоимость за ед.']) for m in M)-710)<0.01, 'себестоимость отгрузки 8×70+2×75 = 710')
        # прибыль: складская себестоимость
        await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2500)
        await pg.evaluate("(()=>{const r=document.querySelector('#pf-docs tr.pfd[data-pf=\"dsk1\"] td:nth-child(3)'); r&&r.click(); })()"); await pg.wait_for_timeout(400)
        t=await pg.text_content('#pf-docs'); ok('склад 10' in t and '710,00' in t, 'в прибыли закупка = себестоимость партий 710')
        # история
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(500); await pg.click('#sk-segs [data-skt="log"]'); await pg.wait_for_timeout(300)
        lt=await pg.text_content('#sk-list'); ok('Отгрузка' in lt and 'Резерв' in lt and 'Приход' in lt and 'Даниил' in lt, 'история склада: приход, резерв, отгрузка, автор')
        # без связи: списание ждёт отправки, потом уходит
        bid=[x for x in rows('Склад: партии') if x['Входящий документ']=='н-1'][0]['ID (не менять)']
        await pg.click('#sk-segs [data-skt="items"]'); await pg.wait_for_timeout(200)
        await ctx.set_offline(True)
        await pg.evaluate("document.querySelector('[data-sk=\"in\"]').click()"); await pg.wait_for_timeout(300)
        await pg.fill('#sk-dlg .skf-name','Шиповник сушёный'); await pg.fill('#sk-dlg .skf-qty','3'); await pg.fill('#sk-dlg .skf-price','80'); await pg.fill('#sk-dlg .skf-sup','Рынок'); await pg.fill('#sk-dlg .skf-doc','н-3')
        await pg.click('#sk-dlg [data-sk="inSave"]'); await pg.wait_for_timeout(800)
        ok('Ожидает отправки' in (await pg.text_content('#sk-pend') or ''), 'без связи приход «ожидает отправки»')
        await ctx.set_offline(False); await pg.evaluate("window.dispatchEvent(new Event('online'))")
        ok(await until(pg,"!document.querySelector('#sk-pend .skpend')", 9000), 'после связи отправлено')
        ok(len([x for x in rows('Склад: партии') if x['Входящий документ']=='н-3'])==1, 'приход без связи проведён ровно один раз')
        await wide(pg,'ПК Склад'); ok(not errs, f'ошибок JS: {errs[:3]}')
        await ctx.close()
        # телефон + Гриша
        ctx,pg,errs=await login(b,(390,844),'Гриша','3333')
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        ok(await pg.locator('#sk-list .skrow').count()>=1, 'Гриша видит склад')
        await wide(pg,'телефон Склад')
        await pg.screenshot(path=f'{SHOT}/sk-phone.png', full_page=True)
        await pg.click('#sk-list .skrow'); await pg.wait_for_timeout(500); await wide(pg,'телефон карточка товара')
        await pg.screenshot(path=f'{SHOT}/sk-phone-item.png')
        await pg.locator('#sk-dlg [data-skbatch]').first.click(); await pg.wait_for_timeout(400)
        await pg.click('#sk-dlg [data-sk="mode"][data-m="edit"]'); await pg.wait_for_timeout(200)
        ok(await pg.locator('#sk-dlg .skbp').count()==0, 'Гриша не видит поле цены партии')
        await pg.screenshot(path=f'{SHOT}/sk-phone-batch.png')
        await pg.click('#sk-dlg [data-sk="mode0"]'); await pg.wait_for_timeout(200)
        await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(300)
        await pg.click('[data-sk="inv"]'); await pg.wait_for_timeout(400); await wide(pg,'телефон инвентаризация')
        f=pg.locator('#sk-dlg .skinvf').first; await f.fill('0'); await pg.wait_for_timeout(150)
        ok('−' in (await pg.text_content('#sk-dlg .skinvd')) or '-' in (await pg.text_content('#sk-dlg .skinvd')), 'разница считается при вводе')
        await f.fill(''); await pg.click('#sk-dlg [data-sk="close"]')
        ok(not errs, f'телефон: ошибок JS: {errs[:3]}')
        await ctx.close(); await b.close()
    print('ИТОГ:', 'всё ок' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
