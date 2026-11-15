"""Журнал: кнопка «Сегодня ↓» плавно прокручивает к документам на сегодня (сортировка по дате), иначе к ближайшему дню; ПК и телефон."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
SEED="""(()=>{const D=__fd.D(), c=D.customers.find(x=>!x.priv)||D.customers[0], s=D.suppliers[0].id, t=new Date();
 const iso=k=>{const d=new Date(t); d.setDate(d.getDate()+k); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
 const mk=(id,k)=>({id, number:id, date:iso(k), customerId:c.id, supplierId:s, sum:100, arch:'', snap:{dr:{customerId:c.id, supplierId:s, date:iso(k), lines:[]}, c:{name:c.name}, s:{}, meta:{}}});
 for(let k=12;k>=-12;k--) if(k!==SKIP) D.journal.push(mk('t'+(k+50)+'_'+Math.random().toString(36).slice(2,6),k));
 const s2=document.querySelector('#jr-sort'); s2.value='dt_d'; s2.dispatchEvent(new Event('change',{bubbles:true}));})()"""
async def run(b, W, H, skip):
    pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(300)
    await pg.evaluate(SEED.replace('SKIP',str(skip))); await pg.wait_for_timeout(600)
    ok(await pg.is_visible('#jr-today'), f'{W}: кнопка «Сегодня» видна')
    await pg.click('#jr-today'); await pg.wait_for_timeout(1500)
    r=await pg.evaluate("""(()=>{const t=new Date(), iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');
      const el=document.querySelector('#jr-body tr.dsep[data-iso="'+iso+'"]')||[...document.querySelectorAll('#jr-body tr.dsep')].find(x=>x.classList.contains('jflash'));
      const hb=document.querySelector('header.top').getBoundingClientRect().bottom; return [!!el, el?Math.round(el.getBoundingClientRect().top-hb):null, window.scrollY, el?el.dataset.iso:'', iso]})()""")
    ok(r[0] and 0<=r[1]<=30 and r[2]>200, f'{W}: прокрутило к дню {r[3]} (сегодня {r[4]}), отступ под шапкой {r[1]} px, прокрутка {r[2]}')
    sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=W, f'{W}: без прокрутки вбок')
    await pg.screenshot(path=f'/tmp/jtoday{W}_{skip}.png')
    ok(not errs, f'{W}: без ошибок {errs[:2]}'); await pg.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1300,900),(390,844)): await run(b,W,H,99)
        await run(b,390,844,0)   # на сегодня документов нет — ближайший день
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
