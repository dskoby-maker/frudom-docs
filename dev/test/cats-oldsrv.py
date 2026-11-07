"""Старый Code.gs: категории нельзя расставить (таблица их не сохранит), плашка «обновите Code.gs», расставленное на устройстве не теряется при загрузке;
после обновления скрипта категории с устройства уходят в таблицу, а не заменяются стандартными."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def rows(sheet):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get(sheet) or [[]]; h=d[0]; return [dict(zip(h,r)) for r in d[1:]]
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
OLD={'on':True}
async def old_route(route):
    req=route.request
    if OLD['on'] and 'action=load' in req.url:
        r=await route.fetch(); j=await r.json()
        j.pop('ver',None); j.pop('cats',None)
        if j.get('data'): j['data'].pop('cats',None); [p.pop('cat',None) or p.pop('catName',None) for p in j['data'].get('products',[])]
        await route.fulfill(response=r, body=json.dumps(j), content_type='application/json'); return
    await route.continue_()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx=await b.new_context(viewport={'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.route('**/*', old_route)
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
        await pg.reload(); await pg.wait_for_timeout(3000)
        ok(await pg.is_visible('#srvOld'), 'старый скрипт — жёлтая плашка «обновите Code.gs»')
        await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(400)
        ok(await pg.is_hidden('#pd-auto') and await pg.is_hidden('#pd-catm'), 'кнопки категорий скрыты')
        await pg.click('#pd-body .nmh >> nth=0'); await pg.wait_for_timeout(200)
        ok(await pg.locator('#pd-body select[data-k=cat][disabled]').count()>0, 'колонка «Категория» недоступна')
        ok('после обновления Code.gs' in await pg.text_content('#pd-cats'), 'понятное объяснение, почему')
        # категории, расставленные на устройстве раньше, не пропадают при загрузке со старого скрипта
        pid=await pg.evaluate("""(()=>{ const D=__fd.D(); D.cats=[{id:'x1',name:'Овощи',order:'10',color:'#3f8f4f'},{id:'x2',name:'Замарозка',order:'20',color:'#2f7fb0'}]; ['x1','x2'].forEach(id=>{}); const p=D.products[0]; p.cat='x2'; localStorage.setItem('frudom-docs-pend', JSON.stringify({cats:[['x1',{s:1,del:false}],['x2',{s:2,del:false}]]})); return p.id; })()""")
        await pg.evaluate("__fd.D && (()=>{ try{ localStorage.setItem('frudom-docs-v1', localStorage.getItem('frudom-docs-v1')); }catch(e){} })()")
        await pg.evaluate("(()=>{ const k=Object.keys(localStorage).find(k=>{ try{ return JSON.parse(localStorage.getItem(k)).products }catch(e){ return false } }); localStorage.setItem(k, JSON.stringify(__fd.D())); })()")
        await pg.reload(); await pg.wait_for_timeout(3000)
        ok(await pg.evaluate(f"__fd.D().products.find(p=>p.id==='{pid}').cat")=='x2', 'после загрузки со старого скрипта категория товара на устройстве осталась')
        # обновили Code.gs
        OLD['on']=False; await pg.reload(); await pg.wait_for_timeout(4000)
        ok(await pg.is_hidden('#srvOld'), 'новый скрипт — плашки нет')
        C=[r['Категория'] for r in rows('Категории товаров')]; ok('Замарозка' in C and 'Овощи' in C and 'Фрукты' not in C, f'категории с устройства ушли в таблицу, стандартные не подменили их: {C}')
        P=[r for r in rows('Товары') if r['ID (не менять)']==pid]; ok(P and P[0].get('Категория (заполняется с сайта)')=='Замарозка', 'категория товара сохранилась в таблице')
        ok(not errs, f'нет ошибок JS {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
