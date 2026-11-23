"""Журнал: по умолчанию — последние 14 дней (и документы на будущие даты); старое сохранённое «Этот месяц»/«Всё время» один раз меняется на 14 дней; «Сбросить фильтры» — снова 14 дней."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    pg=await b.new_page(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""(()=>{ const D=__fd.D(), c=D.customers.find(c=>c.id!=='__private'), d=n=>{const x=new Date(); x.setDate(x.getDate()+n); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');};
      const mk=(id,dt,num)=>({id, date:dt, number:num, supplierId:D.suppliers[0].id, customerId:c.id, sum:'100', snap:{s:D.suppliers[0], c, dr:{ship:'', lines:[]}, lines:[], meta:{created:new Date().toISOString()}}});
      D.journal.push(mk('j14a',d(0),'901'), mk('j14b',d(-10),'902'), mk('j14c',d(-20),'903'), mk('j14d',d(3),'904')); D.jf={per:'month',sup:'',cus:'',br:'',q:'',from:'',to:'',sort:'cr_d'}; })()""")
    await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]')?.click()") if not PH else None
    await pg.evaluate("__fd.go ? __fd.go('journal') : 0"); await pg.wait_for_timeout(1200)
    jf=await pg.evaluate("JSON.stringify(__fd.D().jf)"); ok('"per":"14d"' in jf, f'старый выбор «Этот месяц» один раз сменился на 14 дней ({jf})')
    t=await pg.inner_text('#jr-body'); ok('901' in t and '902' in t and '904' in t, 'видны: сегодня, 10 дней назад и на будущую дату'); ok('903' not in t, '20 дней назад — не видно')
    lab=await pg.evaluate("__rpg.R('jr')"); ok('14' in str(lab.get('lab','')), f'подпись периода — «14 дней» ({lab})')
    await pg.evaluate("__rpg.set('jr','all','all')"); await pg.wait_for_timeout(600); ok('903' in await pg.inner_text('#jr-body'), 'выбрали «Всё время» — видно всё')
    await pg.evaluate("location.reload()"); await pg.wait_for_timeout(3500); await pg.evaluate("__fd.go ? __fd.go('journal') : 0"); await pg.wait_for_timeout(1000)
    ok('"per":"all"' in await pg.evaluate("JSON.stringify(__fd.D().jf)"), 'свой выбор после перезагрузки сохраняется (не сбрасывается в 14 дней)')
    await pg.evaluate("document.getElementById('jr-reset').click()"); await pg.wait_for_timeout(600)
    ok('"per":"14d"' in await pg.evaluate("JSON.stringify(__fd.D().jf)"), '«Сбросить фильтры» — снова 14 дней')
    ok(not errs, f'ошибок JS нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
