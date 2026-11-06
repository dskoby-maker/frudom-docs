"""Фактическая закупка: «Вставить сообщение Саида» в закупке накладной (цена, «куплено фактически», штуки черри, телега),
сохранение `_bq` и прибыль по купленному; красная точка — только если вся накладная в минус; «Прибыль → Товары в минус»;
«Закупка»: по умолчанию 7 дней, вид «Календарь» (день → список за день). ПК и телефон."""
import asyncio, os, json, re, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOT','/tmp/claude-0/')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
MSG="Помидоры 85,6×70\nОгурцы 66,5×45\nПамидор ч 20×100\nТелега 600"
def costs():
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Себестоимость накладных') or [[]]; h=d[0]
    return {r[h.index('ID документа')]:dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)}
def L(c, jid): return json.loads((c.get(jid) or {}).get('Закупочные цены строк (не редактировать)') or '{}')
num=lambda t: float(re.sub(r'[^\d,\-]','',t).replace(',','.'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
          [['p-cu','Огурцы свежие','155.67'],['p-to','Помидоры (томаты) свежие','165.76'],['p-ch','Помидоры черри свежие','326.34'],['p-lo','Лук репчатый','20']].forEach(([id,n,pr])=>{ D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; });
          const pr=JSON.parse(JSON.stringify(__fd.D().prefs||{})); })()""")
        await pg.evaluate("(()=>{ const D=__fd.D(); D.draft.id='za1'; D.draft.customerId=window.__cid; D.draft.number=''; D.draft.lines=[{productId:'p-cu',qty:'60',price:'155.67'},{productId:'p-to',qty:'80',price:'165.76'},{productId:'p-ch',qty:'5',price:'326.34'}]; })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        await pg.evaluate("(()=>{ const D=__fd.D(); D.draft.id='za2'; D.draft.customerId=window.__cid; D.draft.number=''; D.draft.lines=[{productId:'p-lo',qty:'10',price:'20'},{productId:'p-cu',qty:'10',price:'155.67'}]; })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
        await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1200)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(1500)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"za1\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1200)
        # вес 1 шт у черри — как у Даниила (250 г), режим «за шт»
        await pg.click('#dc-zki [data-pcu="pc"][data-k$="p-ch"], #dc-zki .dzr:nth-child(3) [data-pcu="pc"]'); await pg.wait_for_timeout(200)
        await pg.fill('#dc-zki .pcg', '250'); await pg.wait_for_timeout(150)
        await pg.click('#dc-zki [data-zkc="said"]'); await pg.wait_for_timeout(250)
        ok(await pg.is_visible('#dc-zki .dzst'), 'кнопка «Вставить сообщение Саида» открывает поле')
        await pg.fill('#dc-zki .dzst', MSG); await pg.click('#dc-zki [data-zkc="saidgo"]'); await pg.wait_for_timeout(500)
        v=await pg.evaluate("Object.fromEntries([...document.querySelectorAll('#dc-zki .dzc')].map(e=>[e.dataset.pid,e.value]))")
        bq=await pg.evaluate("Object.fromEntries([...document.querySelectorAll('#dc-zki .dzb')].map(e=>[e.dataset.pid,e.value]))")
        ok(v.get('p-to')=='70' and v.get('p-cu')=='45', f'цены: помидоры 70, огурцы 45 → {v}')
        ok(bq.get('p-to')=='85,6' and bq.get('p-cu')=='66,5' and bq.get('p-ch')=='', f'«куплено фактически»: 85,6 и 66,5; черри 20 шт = 5 кг, как в накладной → {bq}')
        ok(await pg.input_value('#dc-zki .pcp')=='100', 'черри — «за шт»: 100 ₽ за 1 шт')
        ok(await pg.input_value('#dc-zki .dze')=='600', 'телега 600 — в прочие расходы')
        msg=await pg.text_content('#dc-zki .dzsaid-m'); ok('11 584,50' in msg.replace(' ',' ').replace(' ',' '), f'итог по сообщению Саида 11 584,50: {msg.strip()[:120]}')
        z=await pg.text_content('#dc-zks'); ok('10 984,50' in z.replace(' ',' ').replace(' ',' '), f'закупка по купленному: 5992 + 2992,5 + 2000 = 10 984,50 → {z[:80]}')
        x=await pg.text_content('#dc-zki .dzbx[data-k$="p-to"], #dc-zki .dzbx'); ok('сверх накладной' in (await pg.text_content('#dc-zki')), 'видно «+5,6 кг сверх накладной → +392 ₽»')
        await pg.screenshot(path=SHOT+'zka-doc.png')
        await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(600)
        await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1500)
        l=L(costs(),'za1'); ok(l.get('_bq')=={'p-to':'85.6','p-cu':'66.5'} and l.get('p-to')=='70', f'в таблице: _bq и цены {l}')
        await pg.click('#fd-dcard .dc-x'); await pg.wait_for_timeout(400)
        # вторая накладная: лук в минус, но накладная в плюс → без красной точки
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"za2\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1000)
        await pg.fill('#dc-zki .dzc[data-pid="p-lo"]','30'); await pg.fill('#dc-zki .dzc[data-pid="p-cu"]','45'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard .dc-x'); await pg.wait_for_timeout(400)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
        ok(await pg.locator('#jr-body [data-zkj="za2"] .jzk-l').count()==0, 'товар в минус, но накладная в плюс — красной точки нет')
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"za2\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1000)
        await pg.fill('#dc-zki .dzc[data-pid="p-cu"]','400'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard .dc-x'); await pg.wait_for_timeout(400)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
        ok(await pg.locator('#jr-body [data-zkj="za2"] .jzk-l').count()==1, 'вся накладная в минус — красная точка есть')
        # прибыль: товары в минус
        await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500)
        ok(await pg.is_visible('#pf-lossc'), 'в «Прибыли» есть карточка «Товары в минус»')
        t=await pg.text_content('#pf-loss'); ok('Лук' in t and 'Огурцы' in t and 'Помидоры (томаты)' not in t, f'в списке лук и огурцы (400 > 155,67), помидоров нет: {t[:150]}')
        await pg.locator('#pf-lossc').screenshot(path=SHOT+'zka-loss.png')
        await pg.click('#pf-loss [data-card="za2"] >> nth=0'); await pg.wait_for_timeout(500); ok(await pg.locator('#fd-dcard').count()==1, 'нажатие на № открывает накладную'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        # «Закупка»: 7 дней и календарь
        await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1200)
        ok(await pg.evaluate("document.querySelector('#zkp-per [data-zkpp=\"7\"]').classList.contains('on')"), 'по умолчанию — 7 дней')
        await pg.click('#zkp-vw [data-zkpv="cal"]'); await pg.wait_for_timeout(500)
        ok(await pg.is_visible('#zkp-cal') and await pg.is_hidden('#zkp-per'), 'вид «Календарь»: месяц вместо периодов')
        n=await pg.locator('#zkp-cal button.zkc-d').count(); ok(n>=1, f'в календаре есть дни с накладными: {n}')
        d=await pg.get_attribute('#zkp-cal button.zkc-d >> nth=0','data-zkpd'); await pg.click('#zkp-cal button.zkc-d >> nth=0'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("document.querySelector('#zkp-cal .zkc-d.sel')!==null") and 'Показаны накладные за' in await pg.text_content('#zkp-cal'), f'нажатие на день {d} — список за этот день')
        ok(await pg.locator('#zkp-list .zkp-it').count()>=1, 'ниже — накладные дня')
        await pg.screenshot(path=SHOT+'zka-cal.png')
        await pg.click('#zkp-cal [data-zkpm="-1"]'); await pg.wait_for_timeout(300); await pg.click('#zkp-cal [data-zkpm="0"]'); await pg.wait_for_timeout(300)
        await pg.reload(); await pg.wait_for_timeout(2500); await pg.evaluate(TAB+"('purchase')"); await pg.wait_for_timeout(1200)
        ok(await pg.is_visible('#zkp-cal'), 'вид «Календарь» запомнился')
        ok(not errs, f'нет ошибок JS {errs[:2]}')
        await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=390, 'телефон: календарь без прокрутки вбок')
        await pg.evaluate("document.querySelector('#zkp').scrollIntoView()"); await pg.screenshot(path=SHOT+'zka-cal-390.png')
        await pg.click('#zkp-vw [data-zkpv="list"]'); await pg.wait_for_timeout(300)
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
        await pg.evaluate("document.querySelector('#jr-body [data-card=\"za1\"]').click()"); await pg.wait_for_timeout(500)
        await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1000)
        ok(await pg.evaluate("document.querySelector('#fd-dcard').scrollWidth<=document.querySelector('#fd-dcard').offsetWidth"), 'телефон: закупка накладной без прокрутки вбок')
        await pg.screenshot(path=SHOT+'zka-doc-390.png')
        ok(not errs, f'телефон: нет ошибок JS {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
