"""Декларации к документу: сайт выбирает как можно меньше деклараций, но на все товары."""
import asyncio, os, sys, json
from playwright.async_api import async_playwright
async def main():
  bad=0
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get('BROWSER_EXECUTABLE_PATH'))
    pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"stock\"]').click()"); await pg.wait_for_timeout(1500)
    r=await pg.evaluate("""(()=>{ const S=__sk.state(); S.files=[
      {id:'own', goods:'Апельсины', prods:'["pA"]', validTo:''},
      {id:'fr', goods:'Яблоко; Банан; Апельсин; Груша; Лимон', prods:'[]', validTo:'2029-03-21'},
      {id:'fr2', goods:'Апельсины; Лимоны; Лайм', prods:'[]', validTo:'2031-02-08'},
      {id:'veg', goods:'Огурцы; Помидоры; Капуста', prods:'[]', validTo:''},
      {id:'veg2', goods:'Огурцы; Помидоры; Капуста; Морковь', prods:'[]', validTo:'2029-01-28'},
      {id:'old', goods:'Морковь', prods:'["pM"]', validTo:'2020-01-01'},
      {id:'ban', goods:'Банан', prods:'["pB"]', validTo:''}];
      const pos=[{id:'pA',name:'Апельсины'},{id:'pB',name:'Бананы'},{id:'pL',name:'Лимоны'},{id:'pO',name:'Огурцы'},{id:'pP',name:'Помидоры'},{id:'pM',name:'Морковь'},{id:'pX',name:'Укроп'}];
      return __decl.pick(pos,'2026-11-26'); })()""")
    print(json.dumps(r,ensure_ascii=False))
    used=sorted({x for v in r.values() for x in v})
    def ok(c,t):
      nonlocal bad; print('OK  ' if c else 'FAIL',t); bad+= (not c)
    ok(used==['fr','veg2'], 'всего 2 декларации: фрукты и овощи со сроком (было бы 5)')
    ok(r['pA']==['fr'] and r['pB']==['fr'] and r['pL']==['fr'], 'апельсины, бананы, лимоны — одной общей, а не своими')
    ok(r['pM']==['veg2'], 'морковь — не истёкшей своей, а общей овощной')
    ok(r['pX']==[], 'укроп — без декларации, как и было')
    ok(all(len(v)<=1 for v in r.values()), 'у каждого товара не больше одной')
    ok(not errs, 'ошибок нет '+str(errs))
    await b.close()
  sys.exit(1 if bad else 0)
asyncio.run(main())
