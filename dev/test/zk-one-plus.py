"""«Одной суммой» + товар со своей ценой: сумма покрывает товары без цены, товар с ценой идёт сверху (6000 + 150 = 6150).
Цены у всех товаров — сумма убирается. Обратный порядок, «Убрать», комплект, Excel/карточка не ломаются."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def costs():
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Себестоимость накладных') or [[]]; h=d[0]
    return {r[h.index('ID документа')]:dict(zip(h,r)) for r in d[1:] if any(str(x) for x in r)}
def L(c, jid): return json.loads((c.get(jid) or {}).get('Закупочные цены строк (не редактировать)') or '{}')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PROF="(id=>{const x=__fd.docProfit(__fd.D().journal.find(j=>j.id===id)); return [x.cost, !!x.src, x.oneTop, x.miss]})"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844)]:
          ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
          await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
          W=str(vw[0])
          await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
            [['p-a','Пюре клубника','797'],['p-b','Пюре манго','960'],['p-c','Апельсин сушёный','2024']].forEach(([id,n,pr])=>{ if(!D.products.some(p=>p.id===id)) D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); })()""")
          ids=[W+'a',W+'b1',W+'b2',W+'r']
          for jid, lines in [(ids[0],[('p-a','6'),('p-b','6'),('p-c','0.3')]),(ids[1],[('p-a','6'),('p-c','1')]),(ids[2],[('p-a','4'),('p-c','1')]),(ids[3],[('p-a','6'),('p-c','0.3')])]:
              ls=','.join(f"{{productId:'{a}',qty:'{q}',price:''}}" for a,q in lines)
              await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); D.draft.lines.forEach(l=>l.price=String((D.prices[window.__cid]||{{}})[l.productId]||'')); }})()")
              await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape'); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
          async def open_doc(jid):
              await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
              await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
              await pg.click('#fd-dcard [data-zkc="toggle"]'); await pg.wait_for_timeout(1000)
          async def price(jid, pid, v, bought=None):
              k=await pg.evaluate(f"(()=>{{const j=__fd.D().journal.find(j=>j.id==='{jid}'); const i=j.snap.dr.lines.findIndex(l=>l.productId==='{pid}'); return document.querySelectorAll('#dc-zki .dzc')[i].dataset.k}})()")
              await pg.fill(f'#dc-zki .dzc[data-k="{k}"]', v)
              if bought is not None: await pg.fill(f'#dc-zki .dzb[data-k="{k}"]', bought)
          # --- как у Даниила: сначала 6000 одной суммой, потом 500 ₽/кг за апельсин ---
          await open_doc(ids[0])
          await pg.fill('#dc-zki .dzs','6000'); await pg.click('#dc-zki [data-zkc="one"]'); await pg.wait_for_timeout(400)
          ok(await pg.evaluate(PROF+f"('{ids[0]}')")==[6000,True,0,0], f'{W}: одной суммой 6000')
          await price(ids[0],'p-c','500'); await pg.wait_for_timeout(300)
          t=await pg.inner_text('#dc-zks'); ok('6 150' in t.replace(' ',' ') and '150' in t, f'{W}: до сохранения плитка «Закупка» 6 150: {t[:160]!r}')
          ok('Нет закупки' not in t, f'{W}: нет «Нет закупки у N позиций» — их покрывает сумма')
          await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(500)
          x=await pg.evaluate(PROF+f"('{ids[0]}')"); ok(x==[6150,True,150,0], f'{W}: после сохранения закупка 6150 = 6000 + 150 {x}')
          ok('6 150' in (await pg.inner_text('#dc-zki .dzone')).replace(' ',' '), f'{W}: плашка «… = 6 150 ₽»')
          await pg.locator('#dc-zki .dzone').scroll_into_view_if_needed(); await pg.screenshot(path=f'/tmp/oneplus-{W}.png')
          await pg.wait_for_timeout(2500); c=costs(); ok(L(c,ids[0]).get('_oneAdd')=='1' and L(c,ids[0]).get('p-c')=='500', f'{W}: в таблице сумма + цена апельсина {L(c,ids[0])}')
          # «куплено фактически» учитывается сверху
          await price(ids[0],'p-c','500','0.5'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(500)
          ok((await pg.evaluate(PROF+f"('{ids[0]}')"))[0]==6250, f'{W}: куплено 0,5 кг → 6000 + 250')
          # цены у всех — сумма убирается
          await price(ids[0],'p-a','700'); await price(ids[0],'p-b','800'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(500)
          x=await pg.evaluate(PROF+f"('{ids[0]}')"); ok(x[1]==False and x[0]==round(700*6+800*6+500*0.5,2), f'{W}: цены у всех — одной суммой убрана, по товарам {x}')
          ok('убрана' in (await pg.inner_text('#fd-toasts')), f'{W}: сказали, что сумма убрана')
          await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
          # --- обратный порядок: цена апельсина, потом одна сумма ---
          await open_doc(ids[3]); await price(ids[3],'p-c','500'); await pg.click('#dc-zki [data-zkc="save"]'); await pg.wait_for_timeout(400)
          await pg.fill('#dc-zki .dzs','6000'); await pg.click('#dc-zki [data-zkc="one"]'); await pg.wait_for_timeout(400)
          ok((await pg.evaluate(PROF+f"('{ids[3]}')"))[:2]==[6150,True], f'{W}: обратный порядок тоже 6150')
          await pg.click('#dc-zki [data-zkc="oneoff"]'); await pg.wait_for_timeout(400)
          x=await pg.evaluate(PROF+f"('{ids[3]}')"); ok(x[1]==False and x[0]==150, f'{W}: «Убрать» — по товарам (клубника из закупочных цен нет) {x}')
          ok(await pg.evaluate(f"!('_oneAdd' in JSON.parse(__fd.D().doccosts.find(d=>d.id==='{ids[3]}').lines))"), f'{W}: «Убрать» снимает отметку')
          await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
          # --- комплект: 3000 одной суммой + апельсин 400 ₽/кг (2 кг на две накладные) ---
          await pg.evaluate(f"__fd.D().journal.filter(j=>['{ids[1]}','{ids[2]}'].includes(j.id)).forEach(j=>{{ j.snap.meta=Object.assign(j.snap.meta||{{}},{{batch:'tb{W}'}}); }})")
          await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
          await pg.evaluate(f"(()=>{{const g=[...document.querySelectorAll('#jr-body tr.grp td[data-gcard]')].find(td=>td.closest('tr').outerHTML.includes('tb{W}')||true); g.click()}})()"); await pg.wait_for_timeout(500)
          await pg.click('#fd-dcard [data-bzk="toggle"]'); await pg.wait_for_timeout(1000)
          await pg.fill('#bz-zki .bzs','3000'); await pg.click('#bz-zki [data-bzk="one"]'); await pg.wait_for_timeout(400)
          k=await pg.evaluate("[...document.querySelectorAll('#bz-zki .bzc')].find(e=>/Апельсин/.test(e.getAttribute('aria-label'))).dataset.k")
          await pg.fill(f'#bz-zki .bzc[data-k="{k}"]','400'); await pg.wait_for_timeout(300)
          t=(await pg.inner_text('#bz-zks')).replace(' ',' '); ok('3 800' in t, f'{W}: комплект до сохранения 3 800: {t[:120]!r}')
          await pg.click('#bz-zki [data-bzk="save"]'); await pg.wait_for_timeout(600)
          tot=await pg.evaluate(f"['{ids[1]}','{ids[2]}'].map(id=>__fd.docProfit(__fd.D().journal.find(j=>j.id===id)).cost).reduce((a,b)=>a+b,0)")
          ok(abs(tot-3800)<0.01, f'{W}: комплект после сохранения 3000 + 800 = {tot}')
          await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
          # Excel «Закупка» и карточка товара не падают
          xl=await pg.evaluate("(()=>{ try{ return typeof zkxBook==='function'?'f':'n' }catch(e){ return 'e:'+e.message } })()")
          ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{W}: нет прокрутки вбок')
          ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
