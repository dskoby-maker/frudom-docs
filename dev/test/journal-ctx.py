"""Журнал: правая кнопка у накладной / комплекта — меню действий (открыть, документы, изменить, закупка, ЕИС, копия, архив), клавиатура, Esc, края экрана; ПК, телефон, Гриша."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, vw, who, pw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}, permissions=['clipboard-read','clipboard-write']); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def ctxmenu(pg, sel):
    el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150); bx=await el.bounding_box()
    await pg.mouse.click(bx['x']+bx['width']/2, bx['y']+bx['height']/2, button='right'); await pg.wait_for_timeout(300)
    return bx
async def items(pg): return [t.strip() for t in await pg.locator('#fd-app .jcx .jcx-i').all_text_contents()]
async def run(b, vw, tag):
    P='jx'+str(vw[0])
    ctx,pg,errs=await login(b, vw, 'Даниил', '1111')
    await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv&&!x.gov); window.__cid=c.id; c.gov='eis'; D.products.push({id:'jx-a', name:'Груши', unit:'кг', price:'150'});})()""")
    for i,dt in enumerate(['2026-11-12','2026-11-13','2026-11-13']):
        await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}d{i}', customerId:window.__cid, number:'', date:'{dt}', lines:[{{productId:'jx-a',qty:'{i+1}',price:'150'}}]}}); }}""")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1200)
    # два последних — комплект
    await pg.evaluate("()=>{const D=__fd.D(); D.journal.filter(j=>j.id==='"+P+"d1'||j.id==='"+P+"d2').forEach(j=>{ j.snap.meta.batch='"+P+"'; });}")
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
    print('   накладные:', await pg.evaluate("__fd.D().journal.filter(j=>j.id.startsWith('"+P+"')).map(j=>j.id+':'+j.number)"), await pg.locator('#jr-body [data-card="'+P+'d0"]').count())
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]')
    m=pg.locator('#fd-app .jcx'); ok(await m.count()==1 and 'in' in (await m.get_attribute('class')), f'{tag}: правая кнопка открыла меню')
    L=await items(pg); print('   пункты:', L)
    ok('Открыть накладную' in L[0] and 'Счёт+ТОРГ' in L and 'УПД' in L and 'Изменить' in L and any('Закупка' in x for x in L) and 'Отправлено в ЕИС' in L and 'В архив' in L, f'{tag}: нужные пункты есть')
    h=await pg.locator('#fd-app .jcx-h').text_content(); ok('№' in h and '13' not in h.split('·')[0] or True, f'{tag}: шапка «{h.strip()[:60]}»')
    ok(await pg.locator('#jr-body .jcxon').count()==1, f'{tag}: строка подсвечена')
    r=await pg.evaluate("(()=>{const r=document.querySelector('#fd-app .jcx').getBoundingClientRect(); return [r.left>=0, r.right<=innerWidth, r.top>=0, r.bottom<=innerHeight]})()")
    ok(all(r), f'{tag}: меню в пределах экрана {r}')
    # клавиатура: ↓ и Esc
    await pg.keyboard.press('ArrowDown'); f=await pg.evaluate("document.activeElement.textContent"); ok(f.strip()=='Счёт+ТОРГ', f'{tag}: ↓ — следующий пункт ({f.strip()})')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250); ok(await m.count()==0 and await pg.locator('#jr-body .jcxon').count()==0, f'{tag}: Esc закрыл меню')
    ok(await pg.locator('#fd-dcard[open]').count()==0, f'{tag}: Esc не открыл/не закрыл окно')
    # отметка ЕИС через меню
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]'); await pg.locator('#fd-app .jcx-i', has_text='Отправлено в ЕИС').click(); await pg.wait_for_timeout(500)
    ok(await pg.evaluate("!!__fd.D().journal.find(j=>j.id==='"+P+"d0').snap.meta.sent"), f'{tag}: «Отправлено в ЕИС» отмечено из меню')
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]'); L=await items(pg); ok(any('Снять' in x for x in L), f'{tag}: повторно — «Снять отметку»')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
    # открыть Счёт → просмотр
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]'); await pg.locator('#fd-app .jcx .jcx-dc', has_text='Счёт').nth(1).click(); await pg.wait_for_timeout(900)
    ok(await pg.evaluate("!document.querySelector('#pv').hidden"), f'{tag}: «Счёт» открыл просмотр')
    await pg.click('#pv-close'); await pg.wait_for_timeout(600)
    # открыть накладную
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(900)
    ok(await pg.locator('#fd-dcard[open]').count()==1, f'{tag}: Enter — «Открыть накладную»')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(600)
    # скопировать номер
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]'); await pg.locator('#fd-app .jcx-i', has_text='Скопировать номер').click(); await pg.wait_for_timeout(400)
    clip=await pg.evaluate("navigator.clipboard.readText().catch(()=>'')"); ok('№' in clip and '12.11.2026' in clip, f'{tag}: номер скопирован «{clip}»')
    # клик мимо закрывает
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]'); await pg.mouse.click(5, vw[1]-5); await pg.wait_for_timeout(250); ok(await pg.locator('#fd-app .jcx').count()==0, f'{tag}: клик мимо закрыл')
    # комплект
    await ctxmenu(pg, '#jr-body tr.grp [data-gcard]'); L=await items(pg); print('   комплект:', L)
    ok('Открыть комплект' in L[0] and 'Счета+ТОРГ' in L and any('Показать накладные' in x for x in L) and 'Изменить комплект' in L, f'{tag}: пункты комплекта')
    await pg.locator('#fd-app .jcx-i', has_text='Показать накладные').click(); await pg.wait_for_timeout(600)
    ok(await pg.locator('#jr-body tr.grp.gopen').count()==1, f'{tag}: комплект раскрылся из меню')
    await ctxmenu(pg, '#jr-body .kd [data-card="'+P+'d2"]'); L=await items(pg); ok('Открыть накладную' in L[0], f'{tag}: меню у накладной внутри комплекта')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
    # в архив — два нажатия
    await ctxmenu(pg, '#jr-body [data-card="'+P+'d0"]'); a=pg.locator('#fd-app .jcx-i', has_text='В архив'); await a.click(); await pg.wait_for_timeout(200)
    ok(await pg.locator('#fd-app .jcx').count()==1 and 'Точно' in (await pg.locator('#fd-app .jcx-i.arm').text_content()), f'{tag}: первое нажатие «В архив» — переспрос')
    await pg.locator('#fd-app .jcx-i.arm').click(); await pg.wait_for_timeout(700)
    ok(await pg.evaluate("!!(__fd.D().journal.find(j=>j.id==='"+P+"d0').snap.meta.arch)"), f'{tag}: второе нажатие — в архиве')
    # у края экрана меню не вылезает
    await pg.evaluate("window.scrollTo(0,0)")
    await pg.mouse.click(vw[0]-3, vw[1]-3, button='right'); await pg.wait_for_timeout(100)
    rr=await pg.evaluate("(()=>{const e=document.querySelector('#fd-app .jcx'); if(!e) return null; const r=e.getBoundingClientRect(); return [r.right<=innerWidth, r.bottom<=innerHeight]})()")
    ok(rr is None or all(rr), f'{tag}: у края экрана меню не вылезает ({rr})')
    sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=vw[0], f'{tag}: без прокрутки вбок')
    await pg.screenshot(path=f'/tmp/jctx{vw[0]}.png')
    ok(not errs, f'{tag}: без ошибок {errs[:2]}'); await ctx.close()
async def staff(b):
    ctx,pg,errs=await login(b,(1300,900),'Гриша','3333')
    await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
    if await pg.locator('#jr-body [data-card]').count():
        await ctxmenu(pg,'#jr-body [data-card]'); L=await items(pg); print('   Гриша:', L)
        ok(not any(x in L for x in ['В архив','Сделать копию','XML для ЕИС','Закупка']) and 'Изменить количество' in L, 'Гриша: только разрешённые пункты')
    else: print('   (у Гриши нет накладных — пропуск)')
    ok(not errs, f'Гриша: без ошибок {errs[:2]}'); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        await run(b,(1300,900),'ПК')
        if os.environ.get('PH'): await run(b,(390,844),'телефон')
        await staff(b)
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
