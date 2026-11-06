"""Склад, удобства: ввод списком, источник по умолчанию, «Со склада всё, что есть», значки и фильтр журнала,
отгрузка за день из Календаря, «В склад» из закупки Саида, подсказки «?» в окнах, отмена прихода, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
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
    return ctx,pg,errs
async def wide(pg,n):
    sw=await pg.evaluate("document.documentElement.scrollWidth"); w=await pg.evaluate("innerWidth"); ok(sw<=w, f'{n}: нет прокрутки вбок ({sw} ≤ {w})')
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>/цирк/i.test(x.name)); window.__cid=c.id; [['p-kur2','Курага (без косточки)'],['p-fin2','Финики Мазафати']].forEach(([id,n])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:'300'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id][id]='300'; }); })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        # 1. ввод списком
        await pg.click('[data-sk="bulk"]'); await pg.wait_for_timeout(300)
        await pg.fill('#sk-dlg .skbkt','Курага\t30\tкг\t180\nФиники; 12; кг; 150; 01.11.26; 01.06.27\nОрехи 0 кг')
        await pg.click('#sk-dlg [data-sk="bulkParse"]'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#sk-dlg table.skbkr tr.bad').count()==1, 'проверка списка нашла строку с ошибкой')
        ok(await pg.locator('#sk-dlg [data-sk="bulkSave"]').is_disabled(), 'с ошибкой провести нельзя')
        await pg.fill('#sk-dlg .skbkt','Курага\t30\tкг\t180\nФиники; 12; кг; 150; 01.11.26; 01.06.27'); await pg.click('#sk-dlg [data-sk="bulkParse"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=f'{SHOT}/u2-bulk.png')
        await pg.click('#sk-dlg [data-sk="bulkSave"]'); ok(await until(pg,"!document.getElementById('sk-dlg')"), 'список проведён')
        B=rows('Склад: партии'); ok(len([x for x in B if x['Вид']=='init'])==2 and any(x['Годен до']=='2027-06-01' for x in B), 'в таблице 2 начальных остатка, срок годности разобран')
        # 2. связь + источник по умолчанию
        await pg.click('#sk-list .skrow >> text=Курага'); await pg.wait_for_timeout(400)
        await pg.fill('#sk-dlg .sklq','курага'); await pg.wait_for_timeout(200); await pg.click('#sk-dlg [data-sklink="p-kur2"]'); await until(pg,"!!document.querySelector('#sk-dlg [data-skunlink=\"p-kur2\"]')")
        await pg.check('#sk-dlg input[name="skdef"][value="all"]'); await pg.click('#sk-dlg [data-sk="defSave"]'); await pg.wait_for_timeout(1200)
        ok(any(x.get('Брать со склада по умолчанию (s = да)')=='s' for x in rows('Склад: товары')), 'настройка «брать со склада» сохранена')
        # подсказка «?» внутри окна
        await pg.click('#sk-dlg .hq[data-hq="Брать со склада автоматически"]'); await pg.wait_for_timeout(200)
        ok(await pg.evaluate("(()=>{const h=document.getElementById('fd-help'); if(!h) return false; const r=h.getBoundingClientRect(); return !!h.closest('dialog') && document.elementsFromPoint(r.left+10,r.top+10).some(e=>e.closest&&e.closest('#fd-help')); })()"), 'подсказка «?» в окне видна поверх и кликабельна')
        await pg.screenshot(path=f'{SHOT}/u2-help.png'); await pg.keyboard.press('Escape'); await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(300)
        # финики связываем без автонастройки — для кнопки «Со склада всё, что есть»
        await pg.click('#sk-list .skrow >> text=Финики'); await pg.wait_for_timeout(300); await pg.fill('#sk-dlg .sklq','финики'); await pg.wait_for_timeout(200); await pg.click('#sk-dlg [data-sklink="p-fin2"]'); await until(pg,"!!document.querySelector('#sk-dlg [data-skunlink=\"p-fin2\"]')"); await pg.click('#sk-dlg [data-sk="close"]')
        # 3. новый документ: курага — сама со склада, финики — кнопкой
        today=await pg.evaluate("(()=>{const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
        await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'du2', customerId:window.__cid, number:'', date:'{today}', lines:[{{productId:'p-kur2',qty:'10',price:'300'}},{{productId:'p-fin2',qty:'20',price:'300'}}]}}); }})()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(500)
        ok(await pg.is_visible('#d-skall'), 'кнопка «Со склада всё, что есть» видна')
        await pg.click('#d-skall'); await pg.wait_for_timeout(300)
        st=await pg.evaluate("JSON.stringify(__fd.D().draft.lines.map(l=>l.stk))"); ok('"m":"x","q":"12"' in st, f'финики: 12 со склада, остальное от Саида ({st})')
        await pg.evaluate("(()=>{ const l=__fd.D().draft.lines[0]; delete l.stk; delete l.stkSet; })()")
        await pg.click('#d-save'); await pg.wait_for_timeout(2500)
        sn=json.loads([r for r in rows('Журнал') if r['ID']=='du2'][0]['Данные документа (не редактировать)']); l0=sn['dr']['lines'][0]
        ok(l0.get('stk',{}).get('m')=='s' and l0.get('stkA')==1, 'курага сама стала «Со склада» по настройке товара')
        await until(pg,"(document.getElementById('fd-toasts')||{textContent:''}).textContent.includes('зарезервирован')")
        # 4. журнал: значок и фильтр
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
        ok(await pg.locator('#jr-body .skjb').count()>=1, 'в журнале значок склада')
        await pg.select_option('#jr-sk','wait'); await pg.wait_for_timeout(300); n1=await pg.locator('#jr-body .skjb').count(); ok(n1>=1, 'фильтр «Ждут отгрузки» показывает документ')
        await pg.screenshot(path=f'{SHOT}/u2-journal.png'); await pg.select_option('#jr-sk','')
        # 5. закупка Саида: строка «В склад»
        await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1500); await pg.evaluate("document.querySelector('#zkx-said').open=true")
        await pg.fill('#zk-src','Цирк\nКурага 5х200=1000\nЧернослив 4х250=1000'); await pg.wait_for_timeout(800)
        zp=pg.locator('#zk-blocks select.zp').nth(1)
        await zp.select_option('k'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#sk-dlg .skf-qty').count()==1 and (await pg.input_value('#sk-dlg .skf-qty'))=='4', 'приход из строки Саида открыт с количеством 4')
        await pg.fill('#sk-dlg .skf-name','Чернослив'); await pg.click('#sk-dlg [data-sk="inSave"]'); ok(await until(pg,"!document.getElementById('sk-dlg') && document.querySelector('#zk-blocks').textContent.includes('в склад — приход проведён')"), 'строка Саида помечена «в склад»')
        ok(any(x['Входящий документ'].startswith('закупка') and x['Поставщик']=='Саид' for x in rows('Склад: партии')), 'приход от Саида записан с документом «закупка …»')
        await pg.screenshot(path=f'{SHOT}/u2-zk.png', full_page=True)
        # 6. календарь: отгрузить всё за день
        await pg.evaluate(f"(()=>{{const c=__fd.D().cal||{{}}; }})()")
        await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(600)
        await pg.evaluate(f"(()=>{{ const b=document.querySelector('[data-d=\"{today}\"]'); b&&b.click(); }})()"); await pg.wait_for_timeout(400)
        ok(await pg.locator('#cal-sk [data-skday]').count()==1, 'в Календаре кнопка «Отгрузить со склада»')
        await pg.click('#cal-sk [data-skday]'); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{SHOT}/u2-day.png')
        await pg.click('#sk-dlg [data-sk="dayShipSave"]'); await pg.wait_for_timeout(2500)
        M=[m for m in rows('Склад: движения') if m['Код операции']=='ship' and m['ID документа']=='du2']; ok(len(M)>=2, f'отгружено за день: {len(M)} движ.')
        # 7. отмена прихода в карточке партии
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(500)
        await pg.click('#sk-list .skrow >> text=Чернослив'); await pg.wait_for_timeout(300); await pg.locator('#sk-dlg [data-skbatch]').first.click(); await pg.wait_for_timeout(300)
        await pg.click('#sk-dlg [data-sk="mode"][data-m="cancel"]'); await pg.fill('#sk-dlg .skcr','ошибся'); await pg.click('#sk-dlg [data-sk="cancelSave"]'); await pg.wait_for_timeout(1200)
        ok(any(x['Приход отменён'] for x in rows('Склад: партии')), 'приход отменён из карточки партии')
        await pg.click('#sk-dlg [data-sk="close"]'); await pg.wait_for_timeout(300)
        ok(not errs, f'ПК: ошибок JS: {errs[:3]}')
        await ctx.close()
        # телефон
        ctx,pg,errs=await login(b,(390,844))
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500); await wide(pg,'телефон склад'); await pg.screenshot(path=f'{SHOT}/u2-phone.png', full_page=True)
        await pg.click('[data-sk="bulk"]'); await pg.wait_for_timeout(300); await pg.fill('#sk-dlg .skbkt','Миндаль 5 кг 900'); await pg.click('#sk-dlg [data-sk="bulkParse"]'); await pg.wait_for_timeout(300); await wide(pg,'телефон ввод списком')
        await pg.screenshot(path=f'{SHOT}/u2-phone-bulk.png'); await pg.click('#sk-dlg [data-sk="close"]')
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600); await wide(pg,'телефон журнал')
        ok(not errs, f'телефон: ошибок JS: {errs[:3]}')
        await ctx.close(); await b.close()
    print('ИТОГ:', 'всё ок' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
