"""Поступления: «Не накладные» запоминается (и свои ИП — сами), частичная оплата, вид «Календарь», приход вручную для ИП без банка (Байдаров)."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(code): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=code.encode(), method='POST')).read())
def dump(t): return json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(t) or [[]]
SHOT=os.environ.get('SHOTS','/tmp')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
TOK='tok-test-skobelkin-000000000000002'
PAY="(id=>{const j=__fd.D().journal.find(x=>x.id===id); return __fd.payOf(j);})"
ST="Object.fromEntries(__fd.D().bank.ops.filter(o=>o.opId).map(o=>[o.opId,o.status]))"
async def bank(pg):
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(400)
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    info=await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0], s=D.suppliers[0], s2=D.suppliers.find(x=>/Байдаров/.test(x.name))||D.suppliers[2]; c.inn='9724123821'; s.inn='773120115806';
      window.__cid=c.id; window.__sid=s.id; window.__s2=s2.id;
      D.products.push({id:'bk-a', name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['bk-a']='100'; return {sid:s.id, s2:s2.id, s2n:s2.name, cid:c.id}; }""")
    for i,(q,sup) in enumerate([('10','__sid'),('25','__s2'),('7','__s2')]):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'bkd{i}', customerId:window.__cid, supplierId:window.{sup}, number:'', lines:[{{productId:'bk-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    ops=[{'operationId':'p1','operationDate':'2026-11-05T09:00:00Z','typeOfOperation':'Credit','accountAmount':5573,'payPurpose':'Перевод собственных средств. НДС не облагается','counterParty':{'inn':'773120115806','name':'ИП Скобёлкин'}},
         {'operationId':'p2','operationDate':'2026-11-04T09:00:00Z','typeOfOperation':'Credit','accountAmount':5000,'payPurpose':'Возврат займа','counterParty':{'inn':'500100732259','name':'Иванов И.И.'}},
         {'operationId':'p4','operationDate':'2026-11-05T11:00:00Z','typeOfOperation':'Credit','accountAmount':400,'payPurpose':'Оплата за продукты','counterParty':{'inn':'9724123821','name':'ООО Аврора'}}]
    ev("__tb="+json.dumps({'tokens':{TOK:{'accounts':['40802810000000000010'],'ops':ops}}}))
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-bank [data-bn="keys"]'); await pg.wait_for_timeout(400)
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]'); await row.locator('.bntok').fill(TOK); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(2500)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    st=await pg.evaluate(ST); ok(st.get('p1')=='skip', f'перевод от своего ИП сам ушёл в «Не накладные»: {st}')
    ok(st.get('p2')=='wait', 'чужой плательщик ждёт решения')
    # «Это не оплата накладных» запоминается
    await bank(pg); await pg.locator('#pv-bank [data-bnop="tb-p2"] [data-bn="skip"]').click(); await pg.wait_for_timeout(400)
    t=await pg.evaluate("[...document.querySelectorAll('#fd-toasts .fd-toast')].map(x=>x.textContent).join(' | ')"); ok('Запомнил' in t, 'сообщение «Запомнил»')
    ops.append({'operationId':'p3','operationDate':'2026-11-06T09:00:00Z','typeOfOperation':'Credit','accountAmount':7000,'payPurpose':'Возврат займа','counterParty':{'inn':'500100732259','name':'Иванов И.И.'}})
    ev("__tb.tokens["+json.dumps(TOK)+"].ops="+json.dumps(ops))
    await bank(pg); await pg.click('#pv-bank [data-bn="sync"]'); await pg.wait_for_timeout(2500)
    st=await pg.evaluate(ST); ok(st.get('p3')=='skip', f'новый платёж того же плательщика сам в «Не накладные»: {st}')
    # частичная оплата: 400 из накладной на 1000
    await bank(pg); await pg.locator('#pv-bank [data-bnop="tb-p4"] [data-bn="pick"]').click(); await pg.wait_for_timeout(500)
    for c in await pg.locator('#bnp-l .bnpc:checked').all(): await c.uncheck()
    await pg.locator('#bnp-l .bnpr', has_text='Скобёлкин').first.locator('.bnpc').check(); await pg.wait_for_timeout(200)
    v=await pg.locator('#bnp-l .bnpr.on .bnps').input_value(); ok(v=='400', f'подставилось 400 (остаток платежа): {v}')
    note=await pg.text_content('#bnp-l .bnpr.on .bnpart'); ok('останется долг 600' in note, f'подсказка о частичной оплате: {note}')
    await pg.screenshot(path=f'{SHOT}/bank-part.png')
    await pg.click('#fd-dcard [data-bnp="save"]'); await pg.wait_for_timeout(500)
    p0=await pg.evaluate(PAY+"('bkd0')"); ok(p0['st']=='part' and abs(p0['s']-400)<.01, f'накладная оплачена частично: {p0["s"]}')
    await bank(pg); chip=await pg.locator('#pv-bank [data-bnop="tb-p4"] .bndoc').text_content(); ok('частично из' in chip, f'в карточке видно «частично»: {chip}')
    # календарь
    await pg.click('#pv-bank [data-bnv="cal"]'); await pg.wait_for_timeout(400)
    ok(await pg.locator('#pv-bank .bncal .zkc-d[data-bnday]').count()>=3, 'календарь: дни с поступлениями')
    await pg.click('#pv-bank [data-bnday="2026-11-05"]'); await pg.wait_for_timeout(300)
    n=await pg.locator('#pv-bank .bnop').count(); ok(n==2, f'за 05.11 — 2 поступления: {n}')
    await pg.screenshot(path=f'{SHOT}/bank-cal.png', full_page=True)
    await pg.click('#pv-bank [data-bnv="list"]'); await pg.wait_for_timeout(300)
    # приход вручную (Байдаров)
    await pg.click('#pv-bank [data-bn="man"]'); await pg.wait_for_timeout(500)
    sel=await pg.input_value('#bnp-s'); ok(sel==info['s2'], f'ИП по умолчанию — без банка ({info["s2n"]})')
    await pg.select_option('#bnp-c', info['cid']); await pg.wait_for_timeout(300)
    rows=await pg.locator('#bnp-l .bnpr').count(); ok(rows==2, f'видны 2 неоплаченные накладные Байдарова: {rows}')
    await pg.locator('#bnp-l .bnpr').nth(0).locator('.bnpc').check(); await pg.wait_for_timeout(200)
    t=await pg.text_content('#bnp-t'); ok('2 500' in t.replace('\xa0',' '), f'сумма прихода посчиталась: {t}')
    await pg.fill('#bnp-d','2026-11-03'); await pg.fill('#bnp-n','за октябрь')
    await pg.screenshot(path=f'{SHOT}/bank-man.png')
    await pg.click('#fd-dcard [data-bnp="save"]'); await pg.wait_for_timeout(2500)
    p1=await pg.evaluate(PAY+"('bkd1')"); ok(p1['st']=='paid' and p1['d']=='2026-11-03', f'накладная Байдарова оплачена датой прихода: {p1}')
    d=dump('Поступления (банк)'); h=d[0]; man=[r for r in d[1:] if str(r[h.index('ID операции (не менять)')]).startswith('man-')]
    ok(len(man)==1 and man[0][h.index('Сумма')] in ('2500',2500) and man[0][h.index('Код статуса')]=='done', f'приход записан в таблицу: {man[:1]}')
    # частичный приход вручную
    await pg.click('#pv-bank [data-bn="man"]'); await pg.wait_for_timeout(400); await pg.select_option('#bnp-c', info['cid']); await pg.wait_for_timeout(300)
    await pg.fill('#bnp-sum','300'); await pg.locator('#bnp-l .bnpr').nth(0).locator('.bnpc').check(); await pg.wait_for_timeout(200)
    v=await pg.locator('#bnp-l .bnpr.on .bnps').input_value(); ok(v=='300', f'вручную: подставилось 300: {v}')
    await pg.click('#fd-dcard [data-bnp="save"]'); await pg.wait_for_timeout(2000)
    p2=await pg.evaluate(PAY+"('bkd2')"); ok(p2['st']=='part' and abs(p2['s']-300)<.01, f'частично 300: {p2["s"]}')
    # фильтр по ИП и итог после налога
    await pg.click(f'#pv-bank [data-bnsup="{info["s2"]}"]'); await pg.wait_for_timeout(300)
    k=await pg.text_content('#pv-bank .pvkpi .pos'); k=k.replace('\xa0',' '); ok('2 800' in k and '2 576' in k, f'Байдаров: 2 800 и после налога 8% 2 576: {k}')
    await pg.screenshot(path=f'{SHOT}/bank-sup.png', full_page=True)
    # удалить приход
    c=pg.locator('#pv-bank .bnop', has_text='за октябрь').locator('[data-bn="del"]'); await c.click(); await c.click(); await pg.wait_for_timeout(2500)
    p1=await pg.evaluate(PAY+"('bkd1')"); ok(p1['st']=='due', 'после удаления прихода накладная снова не оплачена')
    d=dump('Поступления (банк)'); h=d[0]; man=[r for r in d[1:] if str(r[h.index('ID операции (не менять)')]).startswith('man-')]; ok(len(man)==1, f'в таблице остался 1 приход вручную: {len(man)}')
    # после перезагрузки страницы приходы на месте
    await pg.reload(); await pg.wait_for_timeout(2500); await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1500); await bank(pg); await pg.wait_for_timeout(1500)
    n=await pg.evaluate("__fd.D().bank.ops.filter(o=>/^man-/.test(o.id)).length"); ok(n==1, f'после перезагрузки 1 приход вручную: {n}')
    await pg.set_viewport_size({'width':390,'height':844}); await pg.wait_for_timeout(300)
    await pg.click('#pv-bank [data-bnv="cal"]'); await pg.wait_for_timeout(400)
    await pg.screenshot(path=f'{SHOT}/bank-cal-ph.png', full_page=True)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'телефон: без прокрутки вбок {sw}')
    await pg.click('#pv-bank [data-bn="man"]'); await pg.wait_for_timeout(400); await pg.screenshot(path=f'{SHOT}/bank-man-ph.png')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'телефон, окно прихода: без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
