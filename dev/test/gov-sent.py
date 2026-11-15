"""«Отправлено в ЕИС / ПП» (15.11.2026): настройка заказчика c.gov (eis/pp), отметка у накладной snap.meta.sent ставится вручную в окне документа,
в журнале — маленький значок «ЕИС»/«ПП» (зелёный с галочкой, когда отправлено), у комплекта — «ЕИС 1/2». По умолчанию у заказчиков ничего нет;
один раз проставляется по ИНН (Насонова, НМИЦ, КИГМ — ЕИС; Зоопарк, МОК — ПП). Сервер: node test/server.js (на чистом сервере). Телефон — PH=1."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
def sheet(name):
    rows=json.loads(urllib.request.urlopen('http://localhost:8787/dump').read()).get(name) or [[]]; h=rows[0]
    return [dict(zip(h,r)) for r in rows[1:]]
def col(r, start): return next((v for k,v in r.items() if k.startswith(start)), None)
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    r=await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>!x.priv && x.inn!=='7724085040' && x.inn!=='7714061756' && x.inn!=='7718261509' && x.inn!=='7710031380' && x.inn!=='7723920242'); window.__cid=c.id;
      D.products.push({id:'gv-a', name:'Яблоки', unit:'кг', price:'100'}); return [c.gov||'', D.customers.filter(x=>x.gov==='eis'||x.gov==='pp').map(x=>x.inn+':'+x.gov)];})()""")
    ok(r[0] in ('','no'), f'{tag}: по умолчанию у заказчика нет ЕИС/ПП ({r[0]!r})')
    print('   проставлено по ИНН:', r[1])
    for i,dt in enumerate(['2026-11-10','2026-11-11']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'gvd{i}', customerId:window.__cid, number:'', date:'{dt}', lines:[{{productId:'gv-a',qty:'2',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
    ok(await pg.locator('#jr-body .jgov').count()==0, f'{tag}: без настройки значков в журнале нет')
    # настройка у заказчика
    await pg.evaluate(TAB+"('customers')"); await pg.wait_for_timeout(600)
    await pg.evaluate("()=>{ const s=document.querySelector('#cus-editor select.pick'); s.value=window.__cid; s.dispatchEvent(new Event('change',{bubbles:true})); }"); await pg.wait_for_timeout(500)
    sel=pg.locator('#cus-editor select[data-k="gov"]'); ok(await sel.count()==1 and not await sel.is_disabled(), f'{tag}: в карточке заказчика есть выбор ЕИС / ПП')
    await pg.evaluate("()=>{ const s=document.querySelector('#cus-editor select[data-k=\"gov\"]'); s.value='eis'; s.dispatchEvent(new Event('change',{bubbles:true})); }"); await pg.wait_for_timeout(2500)
    cid=await pg.evaluate("window.__cid"); ok(any(col(c,'ID (не менять)')==cid and col(c,'Документы отправляем')=='eis' for c in sheet('Заказчики')), f'{tag}: настройка дошла до таблицы')
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
    n=await pg.locator('#jr-body .jgov').count(); on=await pg.locator('#jr-body .jgov.on').count()
    ok(n>=1 and on==0, f'{tag}: в журнале значок «ЕИС», ещё не отправлено ({n}, {on})')
    # отметка в окне документа
    await pg.evaluate("()=>{ const D=__fd.D(); const j=D.journal.find(x=>x.customerId===window.__cid && x.date==='2026-11-11'); window.__jid=j.id; }")
    await pg.evaluate("()=>document.querySelector('#jr-body [data-card=\"'+window.__jid+'\"]').click()"); await pg.wait_for_timeout(900)
    p=pg.locator('#fd-dcard .dgov'); t=await p.text_content() if await p.count() else ''
    ok('Не отправлено в ЕИС' in t, f'{tag}: в окне документа «Не отправлено в ЕИС» ({t.strip()})')
    await p.click(); await pg.wait_for_timeout(500)
    t=await pg.locator('#fd-dcard .dgov').text_content(); ok('Отправлено в ЕИС' in t and 'Даниил' in t, f'{tag}: после нажатия «Отправлено в ЕИС · Даниил» ({t.strip()})')
    await pg.wait_for_timeout(2500)
    jid=await pg.evaluate("window.__jid"); jr=[x for x in sheet('Журнал') if x.get('ID')==jid]
    sn=json.loads(col(jr[0],'Данные документа')) if jr else {}
    ok(((sn or {}).get('meta') or {}).get('sent',{}).get('k')=='eis', f'{tag}: отметка сохранена в таблице')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    on=await pg.locator('#jr-body .jgov.on').count(); ok(on>=1, f'{tag}: в журнале значок стал зелёным')
    # снять
    await pg.evaluate("()=>document.querySelector('#jr-body [data-card=\"'+window.__jid+'\"]').click()"); await pg.wait_for_timeout(900)
    await pg.click('#fd-dcard .dgov'); await pg.wait_for_timeout(400)
    t=await pg.locator('#fd-dcard .dgov').text_content(); ok('Не отправлено' in t, f'{tag}: отметку можно снять')
    await pg.click('#fd-dcard .dgov'); await pg.wait_for_timeout(300)
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
    # правка документа не теряет отметку
    await pg.evaluate("()=>{ const D=__fd.D(); const j=D.journal.find(x=>x.id===window.__jid); return j.snap.meta.sent && j.snap.meta.sent.k; }")
    # «Нет» у заказчика — значков нет, отметка у документа остаётся видна
    await pg.evaluate(TAB+"('customers')"); await pg.wait_for_timeout(500)
    await pg.evaluate("()=>{ const s=document.querySelector('#cus-editor select[data-k=\"gov\"]'); s.value=''; s.dispatchEvent(new Event('change',{bubbles:true})); }"); await pg.wait_for_timeout(500)
    g=await pg.evaluate("__fd.D().customers.find(x=>x.id===window.__cid).gov"); ok(g=='no', f'{tag}: «Нет» запоминается как снятое вручную ({g})')
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(700)
    n=await pg.locator('#jr-body .jgov').count(); on=await pg.locator('#jr-body .jgov.on').count()
    ok(n==on==1, f'{tag}: без настройки видна только уже поставленная отметка ({n}, {on})')
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    # Гриша — только видит
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
