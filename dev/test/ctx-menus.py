"""Меню правой кнопкой по сайту (cx_seg.js): «Товары», день и задача «Календаря», накладные дня, «События», «Закупка по накладным»; края экрана, Esc, Shift."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def rclick(pg, sel, at='center', shift=False):
    el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(150); bx=await el.bounding_box()
    x=bx['x']+(bx['width']-4 if at=='right' else bx['width']/2); y=bx['y']+bx['height']/2
    if shift: await pg.keyboard.down('Shift')
    await pg.mouse.click(x, y, button='right')
    if shift: await pg.keyboard.up('Shift')
    await pg.wait_for_timeout(300)
async def items(pg): return [t.strip() for t in await pg.locator('#fd-app .jcx .jcx-i:not(.jcx-ch) span').all_text_contents()]
async def inview(pg): return await pg.evaluate("(()=>{const m=document.querySelector('#fd-app .jcx'); if(!m) return false; const r=m.getBoundingClientRect(); return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()")
async def pick(pg, txt): await pg.locator('#fd-app .jcx .jcx-i', has_text=txt).first.click(); await pg.wait_for_timeout(500)
async def run(b, W, H):
    ctx=await b.new_context(viewport={'width':W,'height':H}, permissions=['clipboard-read','clipboard-write']); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    T=f'{W}:'
    await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; D.products.push({id:'cx-a', name:'Груши Конференция', unit:'кг', price:'150'}); if(!(D.cats||[]).length){ D.cats=[{id:'c1',name:'Фрукты',order:1,color:'#d33'},{id:'c2',name:'Овощи',order:2,color:'#e80'},{id:'c3',name:'Зелень',order:3,color:'#3a3'}]; } D.catSrv=true;
      const t=new Date(), iso=t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); window.__t=iso;
      Object.assign(D.draft,{customerId:c.id, number:'', date:iso, lines:[{productId:'cx-a',qty:'3',price:'150'}]});})()""")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
    # ---- Товары
    await pg.evaluate(TAB+"('products')"); await pg.wait_for_timeout(500)
    await pg.fill('#pd-q','Груши Конф'); await pg.wait_for_timeout(500)
    sel='#pd-body .nmr[data-id="cx-a"] .nmh'
    await rclick(pg, sel, 'right'); L=await items(pg); print('   товар:', L)
    ok(L[:2]==['Изменить','Карточка товара'] and 'Добавить в новый документ' in L and 'Найти в журнале' in L and any('Удалить' in x for x in L), T+' меню товара')
    ok(await inview(pg), T+' меню товара в пределах экрана'); ok(await pg.locator('#pd-body .nmr.jcxon').count()==1, T+' строка товара подсвечена')
    print('   cats:', await pg.evaluate("[__fd.D().catSrv, (__fd.D().cats||[]).length, typeof catList]"))
    ch=await pg.locator('#fd-app .jcx .jcx-ch').count(); ok(ch>=3, T+f' категории чипами ({ch})')
    await pg.locator('#fd-app .jcx .jcx-ch').filter(has_text=__import__('re').compile('^Фрукты$')).first.click(); await pg.wait_for_timeout(500)
    ok(await pg.evaluate("(()=>{const p=__fd.D().products.find(x=>x.id==='cx-a'); const c=(__fd.D().cats||[]).find(c=>c.id===p.cat); return !!c && c.name==='Фрукты'})()"), T+' категория сменилась через меню')
    await rclick(pg, sel, 'right'); await pick(pg,'Карточка товара'); ok(await pg.locator('#fd-dcard[open]').count()==1, T+' «Карточка товара» открыла окно')
    await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    await rclick(pg, sel); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250); ok(await pg.locator('#fd-app .jcx').count()==0, T+' Esc закрывает меню')
    await rclick(pg, sel, shift=True); ok(await pg.locator('#fd-app .jcx').count()==0, T+' Shift + правая — меню сайта не открывается')
    await rclick(pg, sel); await pick(pg,'Добавить в новый документ')
    ok(await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"doc\"]').classList.contains('on')||location.hash==='#dokument'"), T+' перешли в «Новый документ»')
    ok(await pg.evaluate("__fd.D().draft.lines.some(l=>l.productId==='cx-a')"), T+' товар добавлен в строки документа')
    # ---- Календарь: день
    await pg.evaluate(TAB+"('calendar')"); await pg.wait_for_timeout(600)
    await rclick(pg, '#cal-grid [data-d="'+await pg.evaluate("window.__t")+'"]'); L=await items(pg); print('   день:', L)
    ok(L[0]=='Открыть день' and 'Новый документ на эту дату' in L and 'Задача на этот день' in L and 'Скопировать текст для MAX' in L, T+' меню дня')
    ok(await inview(pg), T+' меню дня в пределах экрана')
    await pick(pg,'Задача на этот день'); ok(await pg.evaluate("document.activeElement && document.activeElement.id==='dt-text'"), T+' курсор в поле задачи')
    await pg.fill('#dt-text','Проверить ящики'); await pg.evaluate("document.querySelector('#dt-add').requestSubmit()")
    await pg.wait_for_timeout(600)
    tid=await pg.evaluate("(__fd.D().daytasks||[]).find(x=>x.text==='Проверить ящики'&&x.date===window.__t).id")
    await rclick(pg, f'#dt-list [data-dt="{tid}"] .dt-t'); L=await items(pg); print('   задача:', L)
    ok('Изменить' in L and any(x.startswith('Перенести на завтра') for x in L) and 'Скопировать текст' in L and 'Удалить задачу' in L, T+' меню задачи')
    await pick(pg,'Перенести на завтра')
    ok(await pg.evaluate(f"(__fd.D().daytasks||[]).find(x=>x.id==='{tid}').date > window.__t"), T+' задача перенесена на завтра')
    # накладная дня — меню журнала
    await rclick(pg, '#cal-body [data-card]'); L=await items(pg)
    ok(L and L[0]=='Открыть накладную', T+' накладная дня — меню как в журнале')
    await pick(pg,'Открыть накладную'); ok(await pg.locator('#fd-dcard[open]').count()==1, T+' накладная открылась'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
    # ---- Закупка по накладным
    await pg.evaluate(TAB+"('purchase')")
    await pg.wait_for_timeout(800)
    if await pg.locator('#zkp .zkp-it').count():
        await pg.evaluate("(()=>{const b=document.querySelector('#zkp [data-zkpst=\"all\"]'); b&&b.click();})()"); await pg.wait_for_timeout(300)
        await rclick(pg, '#zkp .zkp-it .zkp-row'); L=await items(pg); print('   закупка:', L)
        ok('Открыть накладную' in L and 'Закупка отдельным окном' in L, T+' меню закупки'); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
    # ---- События
    await pg.evaluate("(()=>{const b=document.querySelector('nav.tabs button[data-tab=\"events\"]'); b&&b.click();})()"); await pg.wait_for_timeout(1500)
    if await pg.locator('#ev-body .evr').count():
        await rclick(pg, '#ev-body .evr .evt'); L=await items(pg); print('   событие:', L)
        ok(any(x.startswith('Только ') for x in L) and 'Скопировать текст' in L, T+' меню события')
        await pick(pg,'Только Даниил'); ok(await pg.evaluate("document.querySelector('#ev-user').value")=='Даниил', T+' фильтр «Только Даниил»')
    ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, T+' без прокрутки вбок')
    ok(not errs, T+f' без ошибок {errs[:2]}'); await ctx.close()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1300,900),(390,844)): await run(b,W,H)
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
