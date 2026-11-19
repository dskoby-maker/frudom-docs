"""Журнал: столбца «Распечатан со склада» нет; эта информация — в шапке меню правой кнопкой (накладная и комплект). ПК и телефон (PH=1)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
PH=os.environ.get('PH')=='1'; VW=(390,800) if PH else (1300,900)
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def menu(pg, sel):
    el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150); bx=await el.bounding_box()
    if PH:
        await el.dispatch_event('contextmenu')
    else:
        await pg.mouse.click(bx['x']+bx['width']/2, bx['y']+bx['height']/2, button='right')
    await pg.wait_for_timeout(350)
    return (await pg.locator('#fd-app .jcx .jcx-pr').text_content() or '').strip() if await pg.locator('#fd-app .jcx .jcx-pr').count() else ''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        P='jp'+str(VW[0])
        await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; D.products.push({id:'jp-a', name:'Яблоки', unit:'кг', price:'100'});})()""")
        for i in range(3):
            await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}d{i}', customerId:window.__cid, number:'', date:'2026-11-1{i+1}', lines:[{{productId:'jp-a',qty:'{i+1}',price:'100'}}]}}); }}""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
        await pg.evaluate(f"""()=>{{const D=__fd.D(); const J=id=>D.journal.find(j=>j.id===id);
          Object.assign(J('{P}d0').snap.meta,{{pr:'2026-11-18T11:20:00.000Z', prn:2, prk:['invoice','torg12']}});
          J('{P}d1').snap.meta.batch='{P}'; J('{P}d2').snap.meta.batch='{P}'; J('{P}d1').snap.meta.pr='2026-11-18T12:00:00.000Z'; }}""")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(900)
        th=await pg.locator('#jr-head th').all_text_contents()
        ok(not any('Распечатан' in t for t in th) and len(th)==5, f'столбца нет в шапке журнала {th}')
        ok(await pg.locator('#jr-body td.jpr').count()==0, 'нет ячеек «Распечатан» в строках')
        ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'нет прокрутки вбок')
        t=await menu(pg, f'#jr-body [data-card="{P}d0"]'); ok('Распечатан со склада' in t and 'Счёт' in t and '2 раза' in t, f'накладная: «{t}»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
        t=await menu(pg, '#jr-body tr.grp [data-gcard]'); ok('1 из 2' in t, f'комплект: «{t}»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
        # раскрыть комплект: строки накладных без пустого столбца
        await pg.locator('#jr-body tr.grp [data-gt]').first.click(); await pg.wait_for_timeout(600)
        t=await menu(pg, f'#jr-body .kd [data-card="{P}d2"]'); ok('ещё не печатал' in t, f'накладная в комплекте: «{t}»')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
        if not PH:
            g=await pg.evaluate(f"""(()=>{{const k=document.querySelector('#jr-body .kd [data-card="{P}d2"]').closest('.kd'); return getComputedStyle(k).gridTemplateColumns.split(' ').length}})()""")
            ok(g==4, f'строка накладной в комплекте — 4 колонки ({g})')
        # календарь и архив
        await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(700)
        ok(not any('Распечатан' in x for x in await pg.locator('#cal-body').locator('xpath=ancestor::table//th').all_text_contents()), 'в календаре столбца нет')
        ok(not errs, f'ошибок нет {errs[:2]}')
        await b.close()
    print('ИТОГ:', 'всё хорошо' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
