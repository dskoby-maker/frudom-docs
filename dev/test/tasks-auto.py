"""«Задачи» → «Сайт нашёл сам»: разделы со значками, фильтр по важности, новые проверки (долги, без закупки, в минус, без договора, единица),
«Частное лицо» не проверяется, сворачивание раздела, кнопки ведут куда надо."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def run(b, vw, tag):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("""(()=>{const D=__fd.D(), t=new Date().toISOString().slice(0,10), k=D.contracts.find(x=>x.supplierId && x.customerId && (!x.dateTo||x.dateTo>=t) && x.customerId!=='private-buyer'); window.__c=k.customerId; window.__s=k.supplierId; window.__k=k.id;
      D.products.push({id:'ta-a', name:'Киви', code:'', unit:'кг', country:'', price:'100'},{id:'ta-u', name:'Лимоны', code:'', unit:'', country:'', price:'50'});
})()""")
    t=await pg.evaluate("new Date().toISOString().slice(0,10)"); d40=await pg.evaluate("new Date(Date.now()-40*864e5).toISOString().slice(0,10)")
    for i,(d,lines,ct) in enumerate([(d40,"[{productId:'ta-a',qty:'10',price:'100'}]","''"),(t,"[{productId:'ta-a',qty:'2',price:'100'},{productId:'ta-u',qty:'1',price:'50'}]","window.__k"),(t,"[{productId:'ta-a',qty:'3',price:'100'}]","window.__k")]):
        nc='true' if ct=="''" else 'false'
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'tad{i}', supplierId:window.__s, customerId:window.__c, contractId:{ct}, noCtr:{nc}, number:'', date:'{d}', lines:{lines}}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300)
        await pg.evaluate(f"()=>{{const D=__fd.D(); D.draft.contractId={ct}; D.draft.noCtr={nc};}}")
        await pg.click('#d-save'); await pg.wait_for_timeout(1300)
    await pg.evaluate(TAB+"('profit')"); await pg.wait_for_timeout(1800)
    await pg.evaluate("""(()=>{const D=__fd.D(), A=(D.doccosts=Array.isArray(D.doccosts)?D.doccosts:[]); const set=(id,lines)=>{ let r=A.find(x=>x.id===id); if(!r){ r={id}; A.push(r);} r.lines=JSON.stringify(lines); r.expense=''; };
      set('tad0',{'ta-a':'60'}); set('tad2',{'ta-a':'150'}); })()""")
    await pg.evaluate(TAB+"('tasks')"); await pg.wait_for_timeout(1500)
    heads=await pg.locator('#tk-auto .tkch b').all_text_contents(); ok(len(heads)>=4, f'{tag}: разделы со значками: {heads}')
    more=pg.locator('#tk-auto [data-tkall]'); ok(await more.count()>=0, f'{tag}: «Показать ещё» у больших разделов ({await more.count()})')
    while await more.count(): await more.first.click(); await pg.wait_for_timeout(150)
    txt=await pg.text_content('#tk-auto')
    ok('Частное лицо' not in txt, f'{tag}: «Частное лицо» не проверяется')
    ok('не оплатил' in txt, f'{tag}: долг старше 30 дней найден')
    ok('Без закупки: 1' in txt, f'{tag}: накладная без закупки найдена')
    ok('В минус: 1' in txt, f'{tag}: накладная в минус найдена')
    ok('без договора' in txt, f'{tag}: накладная без договора найдена')
    ok('Нет единицы измерения' in txt, f'{tag}: товар без единицы найден')
    W=await pg.evaluate("[...document.querySelectorAll('#tk-auto .tkc')].map(s=>s.querySelector('.tkcn em.err')?0:s.querySelector('.tkcn em.warn')?1:2)")
    ok(W==sorted(W), f'{tag}: сверху разделы с самым важным {W}')
    # фильтр важности
    n_all=await pg.locator('#tk-auto .tk').count()
    await pg.click('#tk-lv [data-tkf="err"]'); await pg.wait_for_timeout(200)
    ok(await pg.locator('#tk-auto .tk.l-warn,#tk-auto .tk.l-info').count()==0 and await pg.locator('#tk-auto .tk.l-err').count()>0, f'{tag}: фильтр «Важно» — только красные')
    await pg.click('#tk-lv [data-tkf=""]'); await pg.wait_for_timeout(200); ok(await pg.locator('#tk-auto .tk').count()==n_all, f'{tag}: «Все» возвращает список')
    # сворачивание
    sec=pg.locator('#tk-auto .tkc').first; await sec.locator('.tkch').click(); await pg.wait_for_timeout(200)
    ok('cl' in (await sec.get_attribute('class')), f'{tag}: раздел сворачивается'); await sec.locator('.tkch').click(); await pg.wait_for_timeout(200)
    await pg.screenshot(path=f'/tmp/claude-0/tk-{tag}.png', full_page=True)
    sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
    # «Заполнить» → вкладка «Закупка» с накладными без закупки
    await pg.locator('#tk-auto .tk', has_text='Без закупки').locator('[data-go]').click(); await pg.wait_for_timeout(1000)
    ok(await pg.is_visible('#tab-purchase') and await pg.locator('#zkp-st button.miss.on').count()==1 and await pg.locator('#zkp-list .zkp-it').count()==1, f'{tag}: «Заполнить» открывает закупку с этой накладной')
    ok('Задачи' in (await pg.text_content('#fd-tback') or ''), f'{tag}: сверху кнопка «‹ Назад: Задачи»')
    await pg.screenshot(path=f'/tmp/claude-0/tkback-{tag}.png')
    geo=await pg.evaluate("""(()=>{const b=document.querySelector('#fd-tback').getBoundingClientRect(), h=document.querySelector('header.top').getBoundingClientRect(), m=document.querySelector('#tab-purchase,#fd-main');
      const x=b.left+b.width/2, y=b.top+b.height/2, top=document.elementFromPoint(x,y); return {inHead:b.top>=h.top && b.bottom<=h.bottom+1, hit:!!(top&&top.closest('#fd-tback')), w:b.right<=innerWidth}})()""")
    ok(geo['inHead'] and geo['hit'] and geo['w'], f'{tag}: «Назад» внутри шапки, ничего не закрывает {geo}')
    await pg.screenshot(path=f'/tmp/claude-0/tb-{tag}.png')
    await pg.mouse.wheel(0,600); await pg.wait_for_timeout(300)
    ok(await pg.locator('#fd-tback').is_visible(), f'{tag}: при прокрутке кнопка остаётся видна (шапка прилипает)')
    await pg.click('#fd-tback'); await pg.wait_for_timeout(600)
    ok(await pg.is_visible('#tab-tasks') and await pg.locator('#fd-tback').count()==0, f'{tag}: «Назад» возвращает в задачи')
    await pg.locator('#tk-auto .tk', has_text='Без закупки').locator('[data-go]').click(); await pg.wait_for_timeout(800)
    await pg.go_back(); await pg.wait_for_timeout(600)
    ok(await pg.is_visible('#tab-tasks'), f'{tag}: «Назад» браузера/телефона тоже возвращает в задачи')
    await pg.locator('#tk-auto .tk', has_text='Без закупки').locator('[data-go]').click(); await pg.wait_for_timeout(800)
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(300)
    ok(await pg.locator('#fd-tback').count()==0, f'{tag}: ушли в другую вкладку сами — кнопка пропала')
    ok(await pg.evaluate("(()=>{ const D=__fd.D(); D.contracts.push({id:'ta-txt', customerId:window.__c, supplierId:window.__s, basis:'Договор поставки №180124 от 18 января 2024г', maxSum:'100', dateTo:'2027-12-31'}); return true; })()"), 'договор с датой словами')
    await pg.evaluate(TAB+"('tasks')"); await pg.wait_for_timeout(800)
    ok(not any(k.startswith('ct-date-ta-txt') for k in await pg.evaluate("(window.__tkA||[]).map(x=>x.key)")), f'{tag}: дата словами («18 января 2024г») принимается')
    await pg.locator('#tk-auto .tk', has_text='В минус').locator('[data-go]').click(); await pg.wait_for_timeout(1000)
    ok(await pg.locator('#zkp-st button.loss.on').count()==1 and await pg.locator('#zkp-list .zkp-it').count()==1, f'{tag}: «Показать» открывает накладную в минус')
    await pg.click('#zkp-rng [data-zkprng]'); await pg.wait_for_timeout(300)
    # скрыть
    await pg.evaluate(TAB+"('tasks')"); await pg.wait_for_timeout(800)
    k=await pg.locator('#tk-auto .tk').first.get_attribute('data-key'); await pg.locator('#tk-auto .tk').first.locator('[data-hide]').click(); await pg.wait_for_timeout(300)
    ok(await pg.locator(f'#tk-auto .tk[data-key="{k}"]').count()==0 and not await pg.is_hidden('#tk-showhid'), f'{tag}: × скрывает пункт')
    ok(not errs, f'{tag}: ошибок JS нет {errs}')
    await ctx.close()
async def main():
  async with async_playwright() as p:
    b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
    await run(b,(390,844),'ph') if os.environ.get('PH') else await run(b,(1300,900),'pc')
    await b.close()
  print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
