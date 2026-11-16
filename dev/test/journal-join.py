"""Журнал: «Объединить в комплект» правой кнопкой — накладные одного заказчика за один день; добавить в комплект, убрать, разделить, «Отменить», задачи водителю; Гриша не видит; ПК и телефон (PH=1)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); TG='тел' if PH else 'ПК'
async def login(b, who, pw):
    ctx=await b.new_context(viewport={'width':VW[0],'height':VW[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
async def ctxmenu(pg, sel):
    await pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())"); el=pg.locator(sel).first; await el.evaluate("e=>e.scrollIntoView({block:'center'})"); await pg.wait_for_timeout(450); bx=await el.bounding_box()
    await pg.mouse.click(bx['x']+bx['width']/2, bx['y']+bx['height']/2, button='right'); await pg.wait_for_timeout(300)
async def items(pg): return [t.strip() for t in await pg.locator('#fd-app .jcx .jcx-i').all_text_contents()]
B="__fd.D().journal.find(j=>j.id==='{}').snap.meta.batch||''"
async def main():
    P='jn'+('m' if PH else 'p'); D0='2026-11-24' if PH else '2026-11-20'; D1='2026-11-25' if PH else '2026-11-21'
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx,pg,errs=await login(b,'Даниил','1111')
        await pg.evaluate("""(()=>{const D=__fd.D(); const c=D.customers.find(x=>x.id!=='private-buyer'&&!x.priv); window.__cid=c.id; window.__s1=D.suppliers[0].id; window.__s2=(D.suppliers[1]||D.suppliers[0]).id; D.products.push({id:'jn-a', name:'Груши', unit:'кг', price:'150'});})()""")
        two=await pg.evaluate("window.__s1!==window.__s2")
        plan=[(D0,'__s1'),(D0,'__s1'),(D0,'__s1'),(D0,'__s2'),(D1,'__s1')]
        for i,(dt,s) in enumerate(plan):
            await pg.evaluate(f"""()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{P}{i}', supplierId:window.{s}, customerId:window.__cid, number:'', date:'{dt}', lines:[{{productId:'jn-a',qty:'{i+1}',price:'150'}}]}}); }}""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1100)
        sums=await pg.evaluate(f"__fd.D().journal.filter(j=>j.id.startsWith('{P}')).map(j=>j.number+'|'+j.sum)")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(800)
        # 1. меню у одиночной накладной
        await ctxmenu(pg, f'#jr-body [data-card="{P}0"]'); L=await items(pg); print('   пункты:', L)
        ok('Объединить в комплект…' in L, f'{TG}: в меню есть «Объединить в комплект…»')
        ok('Убрать из комплекта' not in L, f'{TG}: «Убрать из комплекта» нет у одиночной')
        await pg.locator('#fd-app .jcx-i', has_text='Объединить в комплект').click(); await pg.wait_for_timeout(700)
        d=pg.locator('#fd-dcard[open].jnwin'); ok(await d.count()==1, f'{TG}: открылось окно объединения')
        n=await pg.locator('#fd-dcard [data-jnu]').count(); off=await pg.locator('#fd-dcard .jnr.off').count()
        ok(n==2, f'{TG}: можно добавить 2 накладные того же дня ({n})'); ok(off==(1 if two else 0), f'{TG}: накладная другого поставщика — серая, нельзя ({off})')
        ok(await pg.locator('#fd-dcard .jnr', has_text=D1[8:]+'.11').count()==0, f'{TG}: другой день не предлагается')
        sw=await pg.evaluate("[document.documentElement.scrollWidth<=innerWidth, [...document.querySelectorAll('#fd-dcard *')].filter(e=>e.getBoundingClientRect().right>document.querySelector('#fd-dcard').getBoundingClientRect().right-1).length]"); ok(sw[0] and sw[1]==0, f'{TG}: ничего не вылезает за окно {sw}')
        t=await pg.locator('#jn-tot').text_content(); ok('3 накладные' in t, f'{TG}: итог «{t.strip()}»')
        await pg.locator('#fd-dcard [data-jnu]').nth(1).click(); await pg.wait_for_timeout(200)
        t=await pg.locator('#jn-tot').text_content(); g=await pg.locator('#jn-go').text_content(); ok('2 накладные' in t and '2' in g, f'{TG}: сняли одну — «{t.strip()}» / «{g.strip()}»')
        await pg.click('#jn-go'); await pg.wait_for_timeout(1200)
        b0,b1,b2=[await pg.evaluate(B.format(P+str(i))) for i in range(3)]
        ok(b0 and b0==b1 and b2!=b0, f'{TG}: № 1 и № 2 — в одном комплекте, третий нет')
        ok(await pg.locator(f'#jr-body tr.grp[data-g="B{b0}"]').count()==1, f'{TG}: в журнале строка комплекта')
        tk=await pg.evaluate(f"__fd.D().daytasks.filter(t=>t.date==='"+D0+"'&&t.customerId===window.__cid).map(t=>t.text.split('\\n')[0])"); print('   задачи:', tk)
        ok(any('комплект' in x and '2 накладные' in x for x in tk), f'{TG}: задача водителю — «Отвезти комплект»')
        h=await pg.evaluate(f"(__fd.D().journal.find(j=>j.id==='{P}0').snap.meta.hist||[]).slice(-1)[0].w.join()"); ok('комплект' in h, f'{TG}: в истории документа — «{h}»')
        ok(await pg.evaluate(f"__fd.D().journal.filter(j=>j.id.startsWith('{P}')).map(j=>j.number+'|'+j.sum)")==sums, f'{TG}: номера и суммы не изменились')
        # 2. добавить третью: из её меню — комплект добавляется целиком, номер комплекта прежний
        await ctxmenu(pg, f'#jr-body [data-card="{P}2"]'); await pg.locator('#fd-app .jcx-i', has_text='Объединить в комплект').click(); await pg.wait_for_timeout(700)
        txt=await pg.locator('#fd-dcard .jn-l').nth(1).text_content(); ok('комплект · 2' in txt, f'{TG}: комплект предлагается целиком')
        await pg.click('#jn-go'); await pg.wait_for_timeout(1200)
        bb=[await pg.evaluate(B.format(P+str(i))) for i in range(3)]; ok(bb[0]==bb[1]==bb[2]==b0, f'{TG}: все три в том же комплекте')
        # отменить
        await pg.locator('#fd-toasts .ta', has_text='Отменить').last.click(); await pg.wait_for_timeout(900)
        bb=[await pg.evaluate(B.format(P+str(i))) for i in range(3)]; ok(bb[0]==bb[1]==b0 and bb[2]!=b0, f'{TG}: «Отменить» вернул как было')
        # 3. из меню комплекта — «Добавить накладные в комплект…»
        await ctxmenu(pg, f'#jr-body tr.grp[data-g="B{b0}"] [data-gcard]'); L=await items(pg); print('   комплект:', L)
        ok('Добавить накладные в комплект…' in L and 'Разделить комплект' in L, f'{TG}: у комплекта — «Добавить…» и «Разделить»')
        await pg.locator('#fd-app .jcx-i', has_text='Добавить накладные').click(); await pg.wait_for_timeout(700)
        await pg.click('#jn-go'); await pg.wait_for_timeout(1200)
        bb=[await pg.evaluate(B.format(P+str(i))) for i in range(3)]; ok(bb[0]==bb[1]==bb[2]==b0, f'{TG}: добавлена из меню комплекта')
        # 4. убрать одну
        await pg.evaluate(f"""(()=>{{const r=document.querySelector('#jr-body tr.grp[data-g="B{b0}"]'); if(!r.classList.contains('gopen')) r.querySelector('[data-gt]')?.click();}})()"""); await pg.wait_for_timeout(500)
        await ctxmenu(pg, f'#jr-body .kd [data-card="{P}1"]'); L=await items(pg); ok('Убрать из комплекта' in L, f'{TG}: у накладной в комплекте — «Убрать из комплекта»')
        await pg.locator('#fd-app .jcx-i', has_text='Убрать из комплекта').click(); await pg.wait_for_timeout(900)
        bb=[await pg.evaluate(B.format(P+str(i))) for i in range(3)]; ok(bb[0]==bb[2]==b0 and bb[1]!=b0, f'{TG}: № 2 убрана, двое остались')
        # 5. разделить
        await ctxmenu(pg, f'#jr-body tr.grp[data-g="B{b0}"] [data-gcard]'); await pg.locator('#fd-app .jcx-i', has_text='Разделить комплект').click(); await pg.wait_for_timeout(900)
        ok(await pg.locator(f'#jr-body tr.grp[data-g="B{b0}"]').count()==0, f'{TG}: комплект разделён')
        tk=await pg.evaluate(f"__fd.D().daytasks.filter(t=>t.date==='"+D0+"'&&t.customerId===window.__cid&&String(t.id).startsWith('auto')).length"); print('   автозадач:', tk)
        await pg.locator('#fd-toasts .ta', has_text='Отменить').last.click(); await pg.wait_for_timeout(900)
        ok(await pg.locator(f'#jr-body tr.grp[data-g="B{b0}"]').count()==1, f'{TG}: «Отменить» вернул комплект')
        # таблица получила
        await pg.wait_for_timeout(1500)
        srv=await pg.evaluate(f"fetch('/dump').then(r=>r.json()).then(d=>d['Журнал'].filter(r=>String(r[6]).startsWith('{P}')).sort((a,b)=>a[6]<b[6]?-1:1).map(r=>{{try{{return JSON.parse(r[9]).meta.batch||''}}catch(e){{return '?'}}}}))")
        ok(srv[:3].count(b0)==2, f'{TG}: в таблице сохранено ({srv})')
        ok(not errs, f'{TG}: ошибок на странице нет {errs[:2]}')
        # Гриша — без этих пунктов
        ctx2,pg2,errs2=await login(b,'Гриша','3333'); await pg2.evaluate(TAB+"('journal')"); await pg2.wait_for_timeout(800)
        if await pg2.locator(f'#jr-body [data-card="{P}1"]').count():
            await ctxmenu(pg2, f'#jr-body [data-card="{P}1"]'); L=await items(pg2); ok(not any('комплект' in x.lower() for x in L), f'{TG}: у Гриши нет объединения ({L})')
        else: print('   Гриша не видит накладную в журнале — пропуск')
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'{len(fails)} ошибок'); raise SystemExit(1 if fails else 0)
asyncio.run(main())
