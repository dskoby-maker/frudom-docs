"""Окно комплекта: нажатие на «N документа · N кг» раскрывает все товары комплекта вместе — всего и общий вес каждого. ПК и телефон (PH=1)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
N=lambda s:(s or '').replace(' ',' ').replace(' ',' ')
PH=os.environ.get('PH')=='1'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); vw=(390,844) if PH else (1300,900); tag='тел' if PH else 'ПК'
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, is_mobile=PH, has_touch=PH); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>x.id!=='private-buyer'); window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
      [['p-ri','Рис круглозерновой','кг','133.95'],['p-go','Горох шлифованный','кг','99.22'],['p-ma','Макароны 450г','шт','80']].forEach(([id,n,u,pr])=>{ D.products.push({id, name:n, code:'', unit:u, country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
    for jid, lines in [('ba1',[('p-ri','29.7'),('p-go','3.6'),('p-ma','10')]),('ba2',[('p-ri','13.5'),('p-go','2.7')])]:
        ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
        await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>{{ l.price=String(D.prices[window.__cid][l.productId]); l.qOk=l.qty; l.pOk=l.price; }}); }})()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500); await pg.click('#d-save') if False else None
    await pg.evaluate("__fd.D().journal.filter(j=>['ba1','ba2'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tba'}); })")
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
    await pg.evaluate("document.querySelector('#jr-body tr.grp [data-gcard]').click()"); await pg.wait_for_timeout(700)
    btn=pg.locator('#fd-dcard [data-bagg]'); ok(await btn.count()==1, f'{tag}: «2 документа · кг» — кнопка')
    ok(not await pg.evaluate("document.querySelector('#dc-agg').classList.contains('open')"), f'{tag}: сводка свёрнута')
    await btn.scroll_into_view_if_needed(); await btn.click(); await pg.wait_for_timeout(600)
    ok(await pg.evaluate("document.querySelector('#dc-agg').classList.contains('open')") and await btn.get_attribute('aria-expanded')=='true', f'{tag}: раскрылась')
    rows=await pg.evaluate("[...document.querySelectorAll('#dc-agg tbody tr')].map(r=>[...r.cells].map(c=>c.innerText.replace(/\\s+/g,' ').trim()))")
    print(rows)
    ok(len(rows)==3, f'{tag}: 3 наименования')
    t=N(' | '.join(' / '.join(r) for r in rows))
    ok('43,2 кг' in t and '6,3 кг' in t, f'{tag}: рис 43,2 кг, горох 6,3 кг')
    ok('10 шт' in t and '≈ 4,5' in t, f'{tag}: макароны 10 шт ≈ 4,5 кг')
    ok('№ ' in t, f'{tag}: видно, в каких накладных')
    if PH:
        vis=await pg.evaluate("getComputedStyle(document.querySelector('#dc-agg tbody td:nth-child(3)')).display")
        ok(vis!='none', f'{tag}: столбец веса виден на телефоне')
    sw=await pg.evaluate("(()=>{const d=document.querySelector('#fd-dcard'), a=document.querySelector('#dc-agg .dc-tw'); return [d.scrollWidth,d.clientWidth,a.scrollWidth,a.clientWidth, document.documentElement.scrollWidth]})()"); print(sw)
    ok(sw[2]<=sw[3]+1 and sw[4]<=vw[0], f'{tag}: таблица и страница без прокрутки вбок')
    await pg.screenshot(path=f'/tmp/claude-0/bagg-{tag}.png')
    await btn.click(); await pg.wait_for_timeout(500)
    ok(not await pg.evaluate("document.querySelector('#dc-agg').classList.contains('open')"), f'{tag}: повторное нажатие сворачивает')
    ok(not errs, f'{tag}: ошибок нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
