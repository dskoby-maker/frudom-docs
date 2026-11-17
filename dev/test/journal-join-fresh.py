"""Объединение в комплект, когда пока открыто окно сайт подтянул из таблицы новую версию одной из накладных (её правили на другом устройстве).
Раньше отметка комплекта ставилась на старую копию и терялась: в таблицу уходила только одна накладная, комплект не появлялся."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; window.__s=D.suppliers[0].id; D.products.push({id:'jf-a', name:'Рис', unit:'кг', price:'100'});})()""")
    for i in range(2):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'jf{i}', supplierId:window.__s, customerId:window.__cid, number:'', date:'2026-11-27', lines:[{{productId:'jf-a',qty:'{i+2}',price:'100'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
    el=pg.locator('#jr-body [data-card="jf0"]').first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(400); bx=await el.bounding_box()
    await pg.mouse.click(bx['x']+bx['width']/2, bx['y']+bx['height']/2, button='right'); await pg.wait_for_timeout(300)
    await pg.locator('#fd-app .jcx-i', has_text='Объединить в комплект').click(); await pg.wait_for_timeout(700)
    ok(await pg.locator('#fd-dcard.jnwin').count()==1, 'окно объединения открылось')
    # пока окно открыто — «из таблицы пришла» новая версия jf0 (новый объект в журнале)
    await pg.evaluate("""(()=>{const D=__fd.D(), i=D.journal.findIndex(j=>j.id==='jf0'); const x=JSON.parse(JSON.stringify(D.journal[i])); x.snap.meta.hist=(x.snap.meta.hist||[]).concat([{at:new Date().toISOString(), by:'Даниил', w:['правка с другого устройства']}]); D.journal[i]=x; })()""")
    await pg.click('#jn-go'); await pg.wait_for_timeout(1500)
    b0=await pg.evaluate("__fd.D().journal.find(j=>j.id==='jf0').snap.meta.batch||''"); b1=await pg.evaluate("__fd.D().journal.find(j=>j.id==='jf1').snap.meta.batch||''")
    ok(b0 and b0==b1, f'обе накладные в одном комплекте ({b0!r}, {b1!r})')
    ok(await pg.locator('#jr-body tr.grp', has_text='Комплект · 2').count()>=1, 'в журнале появилась строка «Комплект · 2»')
    await pg.wait_for_timeout(2500)
    import json, urllib.request
    dump=json.loads(urllib.request.urlopen('http://localhost:8787/dump').read())
    found={}
    def walk(x):
        if isinstance(x,list):
            if any(v in ('jf0','jf1') for v in x if isinstance(v,str)):
                id_=[v for v in x if v in ('jf0','jf1')][0]; found[id_]=any(isinstance(v,str) and '"batch"' in v for v in x)
            for y in x: walk(y)
        elif isinstance(x,dict):
            if x.get('id') in ('jf0','jf1'): found[x['id']]=('"batch"' in json.dumps(x, ensure_ascii=False)) or ('\\"batch\\"' in json.dumps(x, ensure_ascii=False))
            for y in x.values(): walk(y)
    walk(dump); sv=[found.get('jf0'), found.get('jf1')]
    ok(all(sv), f'в таблице у обеих отметка комплекта {sv}')
    ok(not errs, f'ошибок на странице нет {errs}')
    await b.close()
  print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
