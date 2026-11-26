"""Поступления: номера накладных в назначении совпали, а сумма отличается на копейки (ЕИС / Портал считают цену вида 156,34534634 ₽) —
до 10 ₽ разница разносится сама, накладные — оплачены полностью. Разница больше 10 ₽ или без номеров — как раньше, «Нужно решить».
В окне «Выбрать накладные…» перебор до 10 ₽ можно разнести."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(code): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=code.encode(), method='POST')).read())
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
TOK='tok-test-tolerance-000000000000001'
PAY="(id=>{const j=__fd.D().journal.find(x=>x.id===id); return __fd.payOf(j);})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    info=await pg.evaluate("""()=>{const D=__fd.D(), c=D.customers[0], s=D.suppliers[0]; c.inn='7723920242'; window.__cid=c.id; window.__sid=s.id;
      D.products.push({id:'bt-a', name:'Огурцы', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]=D.prices[c.id]||{}; D.prices[c.id]['bt-a']='100'; return {sid:s.id}; }""")
    nums=[]
    for i,q in enumerate(['10','25','7','4','3']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'btd{i}', customerId:window.__cid, supplierId:window.__sid, number:'', lines:[{{productId:'bt-a',qty:'{q}',price:'100',pOk:'100',qOk:'{q}'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
        nums.append(await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='btd{i}').number"))
    ok(len(nums)==5, f'накладные: {nums}')
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2000)
    C={'inn':'7723920242','name':'ДЕПАРТАМЕНТ ФИНАНСОВ ГОРОДА МОСКВЫ (ГАПОУ МОК)'}
    ops=[{'operationId':'t1','operationDate':'2026-11-24T09:00:00Z','typeOfOperation':'Credit','accountAmount':3499.97,'payPurpose':f'Оплата по УПД № {nums[0]} и УПД № {nums[1]}. НДС не обл.','counterParty':C},
         {'operationId':'t2','operationDate':'2026-11-24T10:00:00Z','typeOfOperation':'Credit','accountAmount':703.5,'payPurpose':f'Оплата по УПД № {nums[2]}','counterParty':C},
         {'operationId':'t3','operationDate':'2026-11-24T11:00:00Z','typeOfOperation':'Credit','accountAmount':350,'payPurpose':f'Оплата по УПД № {nums[3]}','counterParty':C},
         {'operationId':'t4','operationDate':'2026-11-24T12:00:00Z','typeOfOperation':'Credit','accountAmount':298,'payPurpose':'Оплата за продукты','counterParty':C}]
    ev("__tb="+json.dumps({'tokens':{TOK:{'accounts':['40802810000000000077'],'ops':ops}}}))
    await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(500)
    await pg.click('#pv-bank [data-bn="keys"]'); await pg.wait_for_timeout(400)
    row=pg.locator(f'#fd-dcard [data-sid="{info["sid"]}"]'); await row.locator('.bntok').fill(TOK); await row.locator('[data-bnk="key"]').click(); await pg.wait_for_timeout(2500)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    st=await pg.evaluate("Object.fromEntries(__fd.D().bank.ops.map(o=>[o.opId,o.status]))")
    ok(st.get('t1')=='auto', f'номера совпали, пришло на 0,03 ₽ меньше — разнесено само ({st.get("t1")})')
    ok(st.get('t2')=='auto', f'номер совпал, пришло на 3,50 ₽ больше — разнесено само ({st.get("t2")})')
    ok(st.get('t3')=='wait', f'номер совпал, но разница 50 ₽ — «Нужно решить» ({st.get("t3")})')
    ok(st.get('t4')=='wait', f'без номеров и не ровно — «Нужно решить» ({st.get("t4")})')
    for i in (0,1,2):
        pp=await pg.evaluate(PAY+f"('btd{i}')"); ok(pp['st']=='paid', f'накладная № {nums[i]} оплачена полностью ({pp})')
    p4=await pg.evaluate(PAY+"('btd4')"); ok(p4['st']!='paid', 'посторонняя накладная не тронута')
    await pg.evaluate("__fd.D().bank.f='all'"); await pg.click('#pv-seg [data-pv="bank"]'); await pg.wait_for_timeout(400)
    why=await pg.locator('#pv-bank [data-bnop="tb-t1"] .bnwhy').text_content(); ok('округление' in why and '0,03' in why, f'понятное объяснение ({why[:140]})')
    # окно «Выбрать накладные…»: перебор до 10 ₽ можно разнести
    await pg.locator('#pv-bank [data-bnop="tb-t4"] [data-bn="pick"]').click(); await pg.wait_for_timeout(500)
    await pg.evaluate("document.querySelectorAll('#bnp-l .bnpc').forEach(c=>{ if(c.checked) c.click(); })")
    await pg.locator(f'#bnp-l .bnpc[data-id="btd4"]').click(); await pg.wait_for_timeout(300)
    tot=await pg.text_content('#bnp-t'); ok('округление' in tot, f'перебор 2 ₽ — «округление, можно разносить» ({tot})')
    await pg.click('#fd-dcard [data-bnp="save"]'); await pg.wait_for_timeout(700)
    p4=await pg.evaluate(PAY+"('btd4')"); ok(p4['st']=='paid', f'разнесено, накладная оплачена ({p4})')
    ok(not errs, 'нет ошибок JS '+str(errs[:2]))
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
