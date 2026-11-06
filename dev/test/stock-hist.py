"""Склад, список товаров: количество ровно в одной колонке, кнопки «История товара» и «Скачать / Загрузить декларацию»,
окно истории (пришло, ушло заказчику, списано, правка цены, график цены), скачивание декларации, телефон."""
import asyncio, os, json, urllib.request, base64
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, t=9000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1500,900))
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          D.products.push({id:'p-fas', name:'Фасоль сухая', code:'', unit:'кг', country:'', price:'200'}); D.prices[c.id]['p-fas']='200'; })()""")
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        S=lambda op,d: pg.evaluate(f"__sk.send('{op}',{json.dumps(d,ensure_ascii=False)},'тест').then(j=>j&&j.out||1)")
        await S('bulk',{'kind':'in','rows':[
            {'itemId':'','newName':'Фасоль белая "Мистраль" бланш 450г','unit':'кг','qty':'20','price':'150','date':'2026-10-20','exp':'','supplier':'ИП Малишава','docRef':'Н-1'},
            {'itemId':'','newName':'Рис круглый "Мистраль" Кубань 900г длинное название для проверки','unit':'кг','qty':'43.2','price':'90','date':'2026-10-21','exp':'','supplier':'','docRef':''},
            {'itemId':'','newName':'Шиповник','unit':'кг','qty':'1','price':'300','date':'2026-10-21','exp':'','supplier':'','docRef':''}]})
        it=await pg.evaluate("(()=>{const S=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('frudom-stock:')))); return S.items.find(i=>i.name.startsWith('Фасоль')).id})()")
        await S('bulk',{'kind':'in','rows':[{'itemId':it,'newName':'','unit':'кг','qty':'10','price':'165','date':'2026-11-02','exp':'','supplier':'ИП Малишава','docRef':'Н-2'}]})
        await S('item',{'itemId':it,'links':['p-fas']})
        # накладная — фасоль 4 кг со склада, отгрузка
        await pg.evaluate("(()=>{const D=__fd.D(); Object.assign(D.draft,{id:'dh1', customerId:window.__cid, number:'', lines:[{productId:'p-fas',qty:'4',price:'200',stk:{m:'s'},lid:'L1'}]}); })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#d-save'); await pg.wait_for_timeout(2500)
        await S('ship',{'docId':'dh1','lines':[{'lineId':'L1','qty':'4'}]})
        st=await pg.evaluate("(()=>{const S=JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('frudom-stock:')))); return S.batches.filter(b=>b.itemId==='"+it+"').map(b=>b.id)})()")
        await S('wo',{'batchId':st[0],'qty':'0.5','reason':'порвалась пачка'})
        await S('batch',{'batchId':st[1],'price':'160'})
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
        # ровная колонка количества и кнопок
        xs=await pg.evaluate("[...document.querySelectorAll('#sk-list .skrow')].map(r=>[Math.round(r.querySelector('.sku').getBoundingClientRect().left), Math.round(r.querySelector('.skm').getBoundingClientRect().right), Math.round(r.querySelector('.skm .skib').getBoundingClientRect().left)])")
        ok(len(xs)==3 and len(set(x[0] for x in xs))==1, f'количество начинается ровно в одной колонке у всех строк {[x[0] for x in xs]}')
        ok(len(set(x[2] for x in xs))==1, f'кнопки «История товара» стоят ровно друг под другом {[x[2] for x in xs]}')
        ok(await pg.locator('#sk-list [data-skiup]').count()==3, 'у товаров без декларации — «Загрузить декларацию»')
        await pg.screenshot(path=f'{SHOT}/skh-list.png')
        # загрузить декларацию: открывается форма с этим товаром
        await pg.click(f'#sk-list [data-skiup="{it}"]'); await pg.wait_for_timeout(500)
        ok('Фасоль' in (await pg.text_content('#sk-dlg')), 'кнопка «Загрузить декларацию» открыла форму с этим товаром')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        ok(await pg.locator('#sk-dlg').count()==0 or not await pg.is_visible('#sk-dlg'), 'клик по кнопке не открыл карточку товара под формой')
        await S('file',{'itemId':it,'name':'декларация фасоль.pdf','mime':'application/pdf','data':base64.b64encode(b'%PDF-1.4 test').decode()})
        await pg.wait_for_timeout(800)
        ok(await pg.locator(f'#sk-list [data-skidecl="{it}"]').count()==1, 'после загрузки кнопка стала «Скачать декларацию»')
        async with pg.expect_download() as dl:
            await pg.click(f'#sk-list [data-skidecl="{it}"]')
        d=await dl.value; ok(d.suggested_filename.endswith('.pdf'), f'декларация скачалась: {d.suggested_filename}')
        ok(await pg.locator('#sk-dlg .skuv').count()==0, 'скачивание не открывает карточку товара')
        # история товара
        await pg.click(f'#sk-list [data-skihist="{it}"]'); await pg.wait_for_timeout(500)
        txt=(await pg.text_content('#sk-dlg')).replace(' ',' ')
        ok('История товара' in txt, 'открылось окно «История товара»')
        kpi=await pg.evaluate("[...document.querySelectorAll('#sk-dlg .skh-kpi b')].map(b=>b.textContent)")
        ok(kpi==['25,5 кг','30 кг','4 кг','0,5 кг'], f'итоги: сейчас 25,5 · пришло 30 · ушло 4 · списано 0,5 → {kpi}')
        ok(await pg.locator('#sk-dlg .skh-spark').count()==1, 'график цены закупки')
        pr=await pg.evaluate("[...document.querySelectorAll('#sk-dlg .skh-pr')].map(r=>r.textContent)")
        ok(len(pr)==2 and '160,00' in pr[0] and '+6,7%' in pr[0] and '150,00' in pr[1], f'цены приходов с изменением: {pr}')
        ok('Закупочная цена партии' in txt and '165 ₽ → 160 ₽' in txt, 'правка цены партии видна в истории')
        ok('порвалась пачка' in txt and 'Списание' in txt, 'списание с причиной видно')
        ok(await pg.locator('#sk-dlg [data-skdoc="dh1"]').count()==1 and '−4 кг' in txt, 'отгрузка заказчику: −4 кг и ссылка на накладную')
        ok('ИП Малишава' in txt and 'Н-2' in txt, 'приход: от кого и номер накладной')
        await pg.screenshot(path=f'{SHOT}/skh-hist.png')
        await pg.click('#sk-dlg [data-skhff="out"]'); await pg.wait_for_timeout(300)
        n=await pg.locator('#sk-dlg .skh-r').count(); ok(n==1, f'фильтр «Ушло» — одна запись ({n})')
        await pg.click('#sk-dlg [data-skhff="price"]'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#sk-dlg .skh-r').count()==1, 'фильтр «Цена» — правка цены')
        await pg.click('#sk-dlg [data-skhff=""]'); await pg.wait_for_timeout(300)
        await pg.click('#sk-dlg [data-skdoc="dh1"]'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#fd-dcard').count()==1, 'ссылка из истории открывает накладную')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        # клавиатура: Enter на строке открывает карточку
        await pg.focus(f'#sk-list .skrow[data-skitem="{it}"]'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(500)
        ok(await pg.locator('#sk-dlg .skuv').count()==1, 'Enter на строке открывает карточку товара')
        ok(not errs, f'ошибок нет {errs[:2]}'); await ctx.close()
        for W in (1000, 390):
            ctx,pg,errs=await login(b,(W,844)); await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1500)
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: нет прокрутки вбок ({sw})')
            fit=await pg.evaluate("[...document.querySelectorAll('#sk-list .skib span')].filter(s=>s.offsetParent).every(s=>s.scrollWidth<=s.clientWidth+1)"); ok(fit, f'{W}: надписи на кнопках помещаются целиком')
            await pg.locator('#sk-list').screenshot(path=f'{SHOT}/skh-list-{W}.png')
            await pg.click(f'#sk-list [data-skihist="{it}"]'); await pg.wait_for_timeout(500)
            sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: история без прокрутки вбок ({sw})')
            await pg.locator('#sk-dlg').screenshot(path=f'{SHOT}/skh-hist-{W}.png')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
