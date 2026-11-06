"""Прибыль → По заказчикам → окно заказчика: «Оплачена» по накладной (дата нажатия запоминается, срок оплаты в днях), снятие отметки,
нет эмодзи во вкладке «Прибыль», ПК и телефон."""
import asyncio, os, json, re, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def costs():
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Себестоимость накладных') or [[]]; h=d[0]
    return {r[h.index('ID документа')]:dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)}
def L(c, jid): return json.loads((c.get(jid) or {}).get('Закупочные цены строк (не редактировать)') or '{}')
SHOT=os.environ.get('SHOTS','/tmp')
EMO=re.compile('[\U0001F300-\U0001FAFF☀-➿＋]')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    jid='py'+tag
    await pg.evaluate("""(t)=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
      D.products.push({id:'pq'+t, name:'Рис', code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id]['pq'+t]='100';
      const d=new Date(); d.setDate(d.getDate()-5); const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      Object.assign(D.draft,{id:'py'+t, customerId:c.id, number:'', date:iso, lines:[{productId:'pq'+t,qty:'10',price:'100'}]}); }""", tag)
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
    await pg.evaluate("(id)=>{ const j=__fd.D().journal.find(x=>x.id===id); const d=new Date(); d.setDate(d.getDate()-5); j.date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }", jid)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(2500)
    txt=await pg.evaluate("document.querySelector('#tab-profit').innerText"); ok(not EMO.search(txt), f'{tag}: во вкладке «Прибыль» нет эмодзи {EMO.findall(txt)[:5]}')
    await pg.click('#pv-seg [data-pv="cus"]'); await pg.wait_for_timeout(500)
    txt=await pg.evaluate("document.querySelector('#tab-profit').innerText"); ok(not EMO.search(txt), f'{tag}: «По заказчикам» без эмодзи {EMO.findall(txt)[:5]}')
    cid=await pg.evaluate("window.__cid")
    await pg.evaluate("PV=>0"); await pg.evaluate("(()=>{ const b=document.querySelector('#pv-cus .pvall'); if(b && !b.classList.contains('on')) b.click(); })()"); await pg.wait_for_timeout(400)
    await pg.click(f'#pv-cus [data-pvc="{cid}"]'); await pg.wait_for_timeout(600)
    await pg.evaluate("(id)=>{ const r=document.querySelector(`[data-pvr=\"${id}\"]`); const s=r&&r.closest('.pvm'); if(s&&!s.classList.contains('op')) s.querySelector('.pvmh').click(); }", jid); await pg.wait_for_timeout(400)
    btn=f'#fd-dcard [data-pvpay="{jid}"]'
    t0=await pg.text_content(btn); ok('Не оплачена' in t0 and '5 дн' in t0, f'{tag}: «Не оплачена · 5 дней» ({t0})')
    await pg.click(btn); await pg.wait_for_timeout(700)
    t1=await pg.text_content(btn); ok('Оплачена' in t1 and 'за 5 дней' in t1, f'{tag}: после нажатия — «Оплачена … за 5 дней» ({t1})')
    ok(await pg.locator(f'#fd-dcard [data-pvr="{jid}"].ed').count()==0, f'{tag}: нажатие на оплату не раскрыло закупку')
    await pg.wait_for_timeout(2500)
    p=L(costs(), jid).get('_pay') or {}; today=await pg.evaluate("(()=>{const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
    ok(p.get('d')==today and p.get('s')=='1000' and p.get('at'), f'{tag}: в таблице дата оплаты = сегодня, сумма 1000 ({p})')
    kpi=await pg.text_content('#fd-dcard .pvkpi'); ok('Ждём оплату' in kpi, f'{tag}: плитка «Ждём оплату»')
    await pg.screenshot(path=f'{SHOT}/pvpay-{tag}.png')
    await pg.click(btn); await pg.wait_for_timeout(500)
    ok('Не оплачена' in await pg.text_content(btn), f'{tag}: повторное нажатие снимает отметку')
    sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'{tag}: нет прокрутки вбок ({sw})')
    ok(not errs, f'{tag}: ошибок нет {errs[:2]}')
    await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        await run(b,(1300,900),'pc'); await run(b,(390,844),'ph')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
