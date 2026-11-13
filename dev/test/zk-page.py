"""Вкладка «Закупка»: список накладных и комплектов со статусом закупки, редактор прямо на странице,
замечания «почему значок жёлтый», старые разделы свёрнуты, телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def costs():
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Себестоимость накладных') or [[]]; h=d[0]
    return {r[h.index('ID документа')]:dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)}
def L(c, jid): return json.loads((c.get(jid) or {}).get('Закупочные цены строк (не редактировать)') or '{}')
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,(1300,900))
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-ko','Кофейный напиток','377.04'],['p-go','Горох','120']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
        for jid, lines in [('zp1',[('p-ko','2'),('p-go','5')]),('zp2',[('p-ko','1')]),('zp3',[('p-go','3')])]:
            ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
            await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        # zp2 и zp3 — комплект
        await pg.evaluate("__fd.D().journal.filter(j=>['zp2','zp3'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tz1'}); })")
        await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1500)
        ok(await pg.evaluate("!document.querySelector('#zkx-said').open && !document.querySelector('#zkx-hist').open"), 'старые разделы «Сообщения Саида» и «Все закупки» свёрнуты')
        ok(await pg.evaluate("document.querySelector('#zkp').getBoundingClientRect().top < document.querySelector('#zkx-said').getBoundingClientRect().top"), 'новый блок — сверху')
        keys=await pg.evaluate("[...document.querySelectorAll('#zkp-list .zkp-it')].map(e=>e.dataset.key)")
        ok('d:zp1' in keys and 'g:Btz1' in keys and 'd:zp2' not in keys, f'накладная и комплект одной строкой: {keys}')
        kpi=(await pg.text_content('#zkp-kpi')).replace(' ',' '); ok('Без закупки' in kpi, f'плитки: {kpi[:80]}')
        # открыть накладную, вписать кофе дороже продажи — замечание видно
        await pg.click('#zkp-list [data-zkpo="d:zp1"]'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#zkp #dc-zki .dzc').count()==2, 'редактор накладной раскрылся на странице')
        await pg.fill('#dc-zki .dzc[data-pid="p-ko"]','380'); await pg.fill('#dc-zki .dzc[data-pid="p-go"]','60'); await pg.wait_for_timeout(200)
        await pg.fill('#dc-zki .dze','100'); await pg.wait_for_timeout(200)
        zt=(await pg.text_content('#dc-zks')).replace('\u00a0',' '); ok('Закупка с расходами' in zt and '1 160,00' in zt and 'расходы 100,00' in zt, f'плитка «Закупка» с прочими расходами: 1060 + 100 = 1 160,00 ({zt[:120]})')
        await pg.fill('#dc-zki .dze',''); await pg.wait_for_timeout(150)
        zn=await pg.text_content('#dc-zki .zkloss'); ok('Кофейный напиток' in zn and '380' in zn, f'отметка «в минус / дороже продажи» видна: {zn[:90]}')
        ok('зелёным' in (await pg.text_content('#dc-zki .zkn.ok')), 'а сама закупка — «Всё заполнено»')
        await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(1800)
        c=costs(); ok(L(c,'zp1').get('p-ko')=='380' and L(c,'zp1').get('p-go')=='60', 'закупка накладной сохранилась в таблицу')
        cls=await pg.get_attribute('#zkp-list .zkp-it[data-key="d:zp1"] .jzk','class'); ok('ok' in cls and 'loss' not in cls, f'закупка заполнена — значок зелёный; товар в минус, но накладная в плюс — без красной точки: {cls}')
        ok(await pg.locator('#zkp-list .zkp-it[data-key="d:zp1"] .zkp-n').count()==0, 'в строке нет жёлтого замечания')
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
        cls=await pg.get_attribute('#jr-body [data-zkj="zp1"]','class'); ok('ok' in cls and 'loss' not in cls, f'в журнале тоже зелёный без точки: {cls}')
        await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(800)
        await pg.click('#zkp-st [data-zkpst="all"]'); await pg.wait_for_timeout(300)
        await pg.click('#zkp-list [data-zkpo="d:zp1"]'); await pg.wait_for_timeout(900)
        await pg.fill('#dc-zki .dzc[data-pid="p-ko"]','300'); await pg.wait_for_timeout(150)
        ok('зелёным' in (await pg.text_content('#dc-zki .zkn.ok')), 'после исправления: «Всё заполнено»')
        await pg.press('#dc-zki .dzc[data-pid="p-ko"]','Enter'); await pg.wait_for_timeout(1800)
        cls=await pg.get_attribute('#zkp-list .zkp-it[data-key="d:zp1"] .jzk','class'); ok('ok' in cls and 'loss' not in cls, f'Enter сохранил, значок зелёный без отметки: {cls}')
        # комплект: открыть, одна цена в обе накладные
        await pg.click('#zkp-list [data-zkpo="g:Btz1"]'); await pg.wait_for_timeout(900)
        ok(await pg.locator('#zkp-list .zkp-it.open').count()==1 and await pg.locator('#dc-zk').count()==0, 'открыт только один редактор (накладная свернулась)')
        await pg.fill('#bz-zki .bzc[data-k="p-ko|кг"]','250'); await pg.fill('#bz-zki .bzc[data-k="p-go|кг"]','70')
        await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(2000)
        c=costs(); ok(L(c,'zp2').get('p-ko')=='250' and L(c,'zp3').get('p-go')=='70', 'закупка комплекта записалась в обе накладные')
        cls=await pg.get_attribute('#zkp-list .zkp-it[data-key="g:Btz1"] .jzk','class'); ok('ok' in cls, f'значок комплекта зелёный: {cls}')
        # фильтр «Нужно заполнить» после перерисовки — пусто
        await pg.click('#zkp-st [data-zkpst="need"]'); await pg.wait_for_timeout(300)
        ok(await pg.locator('#zkp-list .zkp-it').count()==0 or 'zp' not in await pg.evaluate("[...document.querySelectorAll('#zkp-list .zkp-it')].map(e=>e.dataset.key).join()"), 'в «Нужно заполнить» заполненных нет')
        await pg.click('#zkp-st [data-zkpst="all"]'); await pg.wait_for_timeout(300)
        # окно накладной из строки — редактор на странице сворачивается, id не дублируются
        await pg.click('#zkp-list [data-zkpo="d:zp1"]'); await pg.wait_for_timeout(700)
        await pg.click('#zkp [data-zkpcard="d:zp1"]'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#fd-dcard').count()==1 and await pg.locator('#zkp #dc-zk').count()==0 and await pg.locator('#dc-zk').count()<=1, 'окно накладной открылось, редактор на странице свернулся')
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(600)
        ok(await pg.locator('#fd-dcard #dc-zki .dzc').count()==2, 'в окне закупка по-прежнему работает')
        await pg.evaluate("document.querySelector('#fd-dcard [data-dc=\"close\"]').click()"); await pg.wait_for_timeout(400)
        # история закупок Саида открывает свой раздел
        await pg.click('#zkx-said summary'); await pg.wait_for_timeout(300)
        ok(await pg.is_visible('#zk-src'), 'раздел «Сообщения Саида» раскрывается')
        await pg.screenshot(path=f'{SHOT}/zkp-1.png', full_page=True)
        ok(not errs, f'ошибок нет {errs[:2]}')
        await ctx.close()
        ctx,pg,errs=await login(b,(390,844))
        await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1500)
        await pg.click('#zkp-st [data-zkpst="all"]'); await pg.wait_for_timeout(300)
        n=await pg.locator('#zkp-list .zkp-it').count(); ok(n>=2, f'телефон: список есть ({n})')
        if n: await pg.click('#zkp-list .zkp-row >> nth=0'); await pg.wait_for_timeout(900)
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=390, f'телефон: нет прокрутки вбок ({sw})')
        await pg.screenshot(path=f'{SHOT}/zkp-phone.png', full_page=True)
        ok(not errs, f'телефон: ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
