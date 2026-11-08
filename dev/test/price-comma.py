"""Цены из таблицы с запятой («315,95», «1 691,00», как у МОК Талалихина) — сайт подставляет их в накладную числом и переписывает в таблицу с точкой;
у Цирка ошибочная цена «Сельдерей (корень)» 382,50 (цена КБ № 1, в договоре Х-756/26 такой позиции нет) убирается сама. Запускать на чистом сервере."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode())).read())
async def login(pg):
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(3500)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await login(pg)
        # в таблицу «руками»: цена с запятой и пробелом + ошибочный сельдерей у цирка
        info=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(x=>x.inn==='7736039722'), pl=D.prices[c.id], pid=Object.keys(pl)[0];
          const cel=D.products.find(p=>p.name==='Сельдерей (корень)'); return {c:c.id,pid,cel:cel&&cel.id};})()""")
        ok(info['cel'], 'есть товар «Сельдерей (корень)»')
        r=ev(f"""(()=>{{const r=read_('prices'); const x=r.find(o=>o.customerId==='{info['c']}'&&o.productId==='{info['pid']}'); x.price='1 691,05';
          r.push({{customer:'',product:'',price:'382.5',customerId:'{info['c']}',productId:'{info['cel']}'}}); write_('prices',r); return 'ok'}})()""")
        ok(r=='ok', 'записал в таблицу цену «1 691,05» и сельдерей 382.5')
        await pg.reload(); await pg.wait_for_timeout(4500)
        v=await pg.evaluate(f"[__fd.D().prices['{info['c']}']['{info['pid']}'], __fd.getPrice('{info['c']}','{info['pid']}'), __fd.D().prices['{info['c']}']['{info['cel']}']]")
        ok(v[0]=='1691.05' and abs(v[1]-1691.05)<1e-9, f'на сайте цена числом: {v[:2]}')
        ok(v[2] is None, f'сельдерей у цирка убран: {v[2]}')
        nf=await pg.evaluate("['315,95','1 691,00','174.00','','abc',12].map(__fd.prNorm)")
        ok(nf==['315.95','1691.00','174.00','','abc',12], f'prNorm {nf}')
        # новая накладная — цена подтягивается
        await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{customerId:'{info['c']}'}}); D.draft.lines=[{{productId:'{info['pid']}',qty:'2',price:String(__fd.getPrice('{info['c']}','{info['pid']}'))}}];}})()")
        ok(await pg.evaluate("__fd.D().draft.lines[0].price")=='1691.05', 'в строке накладной 1691.05')
        await pg.wait_for_timeout(4000)
        t=ev(f"""(()=>{{const r=read_('prices'); return [ (r.find(o=>o.customerId==='{info['c']}'&&o.productId==='{info['pid']}')||{{}}).price, !!r.find(o=>o.customerId==='{info['c']}'&&o.productId==='{info['cel']}') ]}})()""")
        ok(t[0] in ('1691.05',) and t[1] is False, f'в таблице цена с точкой, сельдерея нет: {t}')
        # сервер (проверка цен водителя) понимает запятую
        s=ev("+String('1 691,05').replace(/[\\s\\u00a0]/g, '').replace(',', '.')"); ok(abs(s-1691.05)<1e-9, f'Code.gs читает запятую: {s}')
        ok(not errs, f'ошибок страницы нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок: {len(fails)}')
asyncio.run(main())
