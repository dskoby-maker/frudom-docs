"""Окно «Новая запись»: выбрали категорию — 3 последние записи этой категории, «Показать все N», нажатие подставляет «на что» и сумму."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
N=lambda s: (s or '').replace('\xa0',' ').replace(' ',' ')
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':390,'height':844} if PH else {'width':1300,'height':900}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate(TAB+"('profit')")
    await pg.wait_for_timeout(1800); await pg.click('#pv-seg [data-pv="fin"]'); await pg.wait_for_timeout(400)
    await pg.click('#pv-fin [data-pva="exp"]'); await pg.wait_for_timeout(450)
    await pg.evaluate("""()=>{ const D=__fd.D(); const L=D.pother||(D.pother=[]); const c={id:document.querySelector('#pvi-cats [data-pvcat]').dataset.pvcat, n:'x'}; const PO_EXP='Расход', PO_INC='Доход';
      const t=new Date(); const d=i=>{const x=new Date(t); x.setDate(x.getDate()-i); return x.toISOString().slice(0,10)};
      [['Бензин А',1000,5],['Бензин Б',2000,1],['Бензин В',3000,3],['Бензин Г',4000,10],['Бензин Д',5000,2]].forEach(([n,s,i],k)=>L.push({id:'rt'+k,date:d(i),kind:PO_EXP,sum:String(s),note:n,cat:c.id,catName:c.n,by:'Даниил'}));
      L.push({id:'rtinc',date:d(0),kind:PO_INC,sum:'777',note:'Доход тот же',cat:c.id,by:'Даниил'}); window.__rc=c.id; }""")
    cid=await pg.evaluate("__rc")
    ok(not await pg.evaluate("document.querySelector('#pvi-rec').classList.contains('open')"), 'без категории блока нет')
    await pg.click(f'#pvi-cats [data-pvcat="{cid}"]'); await pg.wait_for_timeout(500)
    ok(await pg.evaluate("document.querySelector('#pvi-rec').classList.contains('open')"), 'выбрали категорию — блок раскрылся')
    names=await pg.locator('#pvi-recin > .pvyl .pvyn').all_inner_texts()
    ok([n.replace('Даниил','').strip() for n in names]==['Бензин Б','Бензин Д','Бензин В'], f'3 последние, новые сверху ({names})')
    h=N(await pg.text_content('#pvi-recin .pvyh')); ok('5 записей' in h and '15 000' in h, f'итог в шапке ({h})')
    ok('Доход' not in N(await pg.text_content('#pvi-recin')), 'доходы той же категории не попали')
    mb=pg.locator('[data-pvi="recall"]'); ok(N(await mb.text_content()).startswith('Показать все 5'), 'кнопка «Показать все 5»')
    await mb.click(); await pg.wait_for_timeout(450)
    ok(await pg.locator('#pvi-recall .pvyr').count()==2, 'раскрылись остальные 2')
    ok(N(await mb.text_content()).startswith('Свернуть'), 'кнопка стала «Свернуть»')
    await pg.screenshot(path=f'/tmp/pvrec-{"ph" if PH else "pc"}.png')
    await pg.locator('#pvi-recall .pvyr').last.click(); await pg.wait_for_timeout(200)
    ok(await pg.input_value('#pvi-note')=='Бензин Г' and N(await pg.input_value('#pvi-sum'))=='4 000', 'нажатие подставило «на что» и сумму')
    await mb.click(); await pg.wait_for_timeout(450)
    ok(not await pg.evaluate("document.querySelector('#pvi-recall').classList.contains('open')"), 'свернули')
    await pg.click('#pvi-kind [data-pvk="inc"]'); await pg.wait_for_timeout(400)
    open_=await pg.evaluate("document.querySelector('#pvi-rec').classList.contains('open')")
    txt=N(await pg.text_content('#pvi-recin'))
    ok(not open_ or ('Доход тот же' in txt and 'Бензин' not in txt), f'доход: свои записи ({open_})')
    await pg.click('#pvi-kind [data-pvk="per"]'); await pg.wait_for_timeout(400)
    ok(not await pg.evaluate("document.querySelector('#pvi-rec').classList.contains('open')"), 'личное — блока нет')
    await pg.fill('#pvi-note',''); await pg.click('#pvi-kind [data-pvk="exp"]'); await pg.wait_for_timeout(300)
    await pg.click(f'#pvi-cats [data-pvcat="{cid}"]'); await pg.wait_for_timeout(450)
    await pg.click(f'#pvi-cats [data-pvcat="{cid}"]'); await pg.wait_for_timeout(450)
    ok(not await pg.evaluate("document.querySelector('#pvi-rec').classList.contains('open')"), 'сняли категорию — свернулся')
    other=await pg.evaluate(f"[...document.querySelectorAll('#pvi-cats [data-pvcat]')].map(b=>b.dataset.pvcat).find(x=>x!=='{cid}')")
    await pg.click(f'#pvi-cats [data-pvcat="{other}"]'); await pg.wait_for_timeout(450)
    ok('ещё нет записей' in N(await pg.text_content('#pvi-recin')), 'пустая категория — «ещё нет записей»')
    sw=await pg.evaluate("(()=>{const d=document.querySelector('#fd-dcard'); return [d.scrollWidth,d.clientWidth,[...d.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>d.getBoundingClientRect().right+1).slice(0,4).map(e=>e.tagName+'.'+e.className+'#'+e.id)]})()"); ok(sw[0]<=sw[1]+3 and not sw[2], f'окно без прокрутки вбок {sw}')
    ok(not errs, f'ошибок нет {errs[:2]}')
    await b.close()
  print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} FAIL')
asyncio.run(main())
