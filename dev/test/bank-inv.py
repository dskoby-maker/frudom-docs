"""Поступления: платёж по отдельному «Счёту на оплату» (как у МГУ: «…Закона №223-ФЗ. Дог 1428-223-2026…»).
«223» и номер договора — не номера накладных; платёж находит счёт по заказчику и сумме: накладные не оплачены — разносится сам,
уже отмечены оплаченными — предложение, «Подтвердить» связывает без второй суммы."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(code): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=code.encode(), method='POST')).read())
SHOT=os.environ.get('SHOTS','/tmp'); PH=os.environ.get('PH')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
TOK='tok-test-skobelkin-000000000000002'
PAY="(id=>{const j=__fd.D().journal.find(x=>x.id===id); return __fd.payOf(j);})"
PUR="Оплата по счету № {n} от 18.11.2026 по акту 1 в соответствии с требованиями Закона №223-ФЗ. Дог 1428-223-2026 от 13.10.2026 за продукты питания. Без НДС"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    ctx=await b.new_context(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.wait_for_timeout(800)
    if await pg.locator('#fd-who').is_visible():
      await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter')
    await pg.wait_for_timeout(2500)
    info=await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0], s=D.suppliers[0]; c.inn='7729082090'; window.__cid=c.id; window.__sid=s.id;
      D.products.push({id:'bi-a', name:'Яблоки', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['bi-a']='100'; return {sid:s.id, cid:c.id}; }""")
    for i,q in enumerate(['12','30','8','5','40','9','7']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'bid{i}', customerId:window.__cid, supplierId:window.__sid, number:'', lines:[{{productId:'bi-a',qty:'{q}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    # счёт № 2 — накладные 0,1,2 (5000 ₽), не оплачены; счёт № 3 — 3,4 (4500 ₽), уже отмечены оплаченными вручную
    await pg.evaluate("""()=>{const D=__fd.D(); D.invoices=D.invoices||[];
      const mk=(id,n,docs,sum)=>D.invoices.push({id, date:'2026-11-18', number:String(n), supplierId:window.__sid, customerId:window.__cid, place:'Столовые диетического питания', period:'', sum:String(sum), data:JSON.stringify({docs})});
      mk('inv-t2',2,['bid0','bid1','bid2'],5000); mk('inv-t3',3,['bid3','bid4'],4500); mk('inv-t5',5,['bid6'],650);
      ['bid3','bid4','bid6'].forEach(id=>{const j=D.journal.find(x=>x.id===id); __fd.setPay(j, __fd.payOf(j).tot, '2026-11-18', true);}); }""")
    ops=[{'operationId':'q1','operationDate':'2026-11-18T09:00:00Z','typeOfOperation':'Credit','accountAmount':5000,'payPurpose':PUR.format(n=2),'counterParty':{'inn':'7729082090','name':'УФК ПО Г. МОСКВЕ (МГУ)'}},
         {'operationId':'q2','operationDate':'2026-11-18T10:00:00Z','typeOfOperation':'Credit','accountAmount':4500,'payPurpose':PUR.format(n=3).replace('счету № 3','счету'),'counterParty':{'inn':'7729082090','name':'УФК ПО Г. МОСКВЕ (МГУ)'}}]
    n2=await pg.evaluate("__fd.D().journal.find(j=>j.id==='bid5').number")
    ops.append({'operationId':'q3','operationDate':'2026-11-18T11:00:00Z','typeOfOperation':'Credit','accountAmount':700,'payPurpose':f'Оплата по УПД № {n2}. Без НДС','counterParty':{'inn':'7729082090','name':'УФК ПО Г. МОСКВЕ (МГУ)'}})
    ops.append({'operationId':'q4','operationDate':'2026-11-18T12:00:00Z','typeOfOperation':'Credit','accountAmount':650.02,'payPurpose':'Оплата по договору № Х-756/26 от 21.09.2026 г. счет 5 от 09.11.2026 г. Продукты питания. Сумма 650-02 Без налога (НДС)','counterParty':{'inn':'7729082090','name':'ГУП ЦИРК'}})
    ev("__tb="+json.dumps({'tokens':{TOK:{'accounts':['40802810000000000019'],'ops':ops}}}))
    await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-bank [data-bn="keys"]'); await pg.wait_for_timeout(400)
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]'); await row.locator('.bntok').fill(TOK); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(2500)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    st=await pg.evaluate("Object.fromEntries(__fd.D().bank.ops.map(o=>[o.opId,o.status]))")
    ok(st.get('q1')=='auto', f'счёт № 2 (не оплачен) — разнесён сам: {st}')
    lf=[(await pg.evaluate(PAY+f"('bid{i}')"))['left'] for i in range(3)]; ok(all(abs(x)<.01 for x in lf), f'накладные счёта № 2 оплачены полностью {lf}')
    ok(st.get('q2')=='wait', 'счёт № 3 (уже оплачен вручную) — ждёт подтверждения')
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(400)
    c2=pg.locator('#pv-bank [data-bnop="tb-q2"]'); why=await c2.locator('.bnwhy').text_content()
    ok('Оплата счёта № 3' in why and '223' not in why and 'таких накладных' not in why, f'понятное объяснение: {why[:160]}')
    w1=await pg.locator('#pv-bank [data-bnop="tb-q1"]').text_content(); ok('счёта № 2' in w1, 'у разнесённого видно, что это счёт № 2')
    ok(await c2.locator('.bnvd.ok').count()==1 and 'сумма сходится' in await c2.locator('.bnvd').text_content(), 'зелёная подсказка «Скорее всего всё в порядке»')
    c3=pg.locator('#pv-bank [data-bnop="tb-q3"]'); t3=await c3.text_content(); ok(await c3.locator('.bnvd.bad').count()==1, ' '.join(t3.split())[:400]+' | '+'недоплата — красная «Нужно разобраться»')
    c4=pg.locator('#pv-bank [data-bnop="tb-q4"]'); w4=await c4.text_content()
    ok(await c4.locator('.bnvd.ok').count()==1 and 'правили вручную' in w4 and 'Счёта № 5'.lower() in w4.lower(), f'счёт с исправленными строками — по сумме счёта, зелёный: {w4[:220]}')
    await pg.screenshot(path=f'{SHOT}/bank-inv{"-ph" if PH else ""}.png', full_page=True)
    await c2.locator('[data-bn="ok"]').click(); await pg.wait_for_timeout(500)
    a=await pg.evaluate(PAY+"('bid3')"); op=await pg.evaluate("__fd.D().bank.ops.find(o=>o.opId==='q2')")
    ok(abs(a['s']-500)<.01 and op['status']=='done' and 'оплата уже стояла' in op['docsText'], f'подтвердили — связано, сумма не задвоилась: {a["s"]}, {op["docsText"]}')
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(300)
    await pg.locator('#pv-bank [data-bnop="tb-q4"] [data-bn="ok"]').click(); await pg.wait_for_timeout(400)
    a6=await pg.evaluate(PAY+"('bid6')"); op4=await pg.evaluate("__fd.D().bank.ops.find(o=>o.opId==='q4')")
    ok(abs(a6['s']-700)<.01 and op4['status']=='done', f'q4 подтверждён, оплата не задвоилась: {a6["s"]}')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'без прокрутки вбок {sw}')
    ok(not errs, f'ошибок JS нет {errs}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
