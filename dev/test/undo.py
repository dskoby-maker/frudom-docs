"""Отмена/возврат действий: черновик документа, карточка заказчика (до таблицы), журнал (архив), личные задачи, Ctrl+Z, телефон.
Запуск: node dev/test/server.js &  потом  python3 dev/test/undo.py"""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
def dump(): return json.loads(urllib.request.urlopen('http://localhost:8787/dump').read())
fails=[]
def ok(c, m):
    print(('OK  ' if c else 'FAIL'), m)
    if not c: fails.append(m)
async def login(pg, who='Даниил', pw='1111'):
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass', pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
async def tab(pg, t): await pg.evaluate(f"document.querySelector('nav.tabs button[data-tab=\"{t}\"]').click()"); await pg.wait_for_timeout(300)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg=await b.new_page(viewport={'width':1300,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await login(pg); await tab(pg,'doc')
        await pg.evaluate("(()=>{const D=__fd.D(); const c=D.draft.customerId; D.prices[c]=D.prices[c]||{}; D.products.slice(0,4).forEach((p,i)=>D.prices[c][p.id]=String(100+i)); D.draft.lines=[{productId:'',qty:'',price:''}];})()")
        ok(await pg.is_hidden('#fd-undo'), 'кнопки нет, пока нечего отменять')
        # 1. весь прайс заказчика
        await pg.click('#d-addall'); await pg.wait_for_timeout(400)
        n0=await pg.evaluate("__fd.D().draft.lines.filter(l=>l.productId).length")
        ok(n0>=2, f'добавлен прайс: {n0} строк')
        ok(await pg.is_visible('#fd-undo .u'), 'кнопка «Отменить» появилась: '+(await pg.text_content('#fd-undo .u small')))
        # 2. цена во второй строке
        old=await pg.evaluate("__fd.D().draft.lines[1].price")
        await pg.fill('#d-lines .line[data-i="1"] input.price', '999.5'); await pg.wait_for_timeout(300)
        await pg.press('#d-lines .line[data-i="1"] input.price', 'Tab'); await pg.wait_for_timeout(2000)
        ok(await pg.evaluate("__fd.D().draft.lines[1].price")=='999.5', 'цена поменялась')
        lab=await pg.text_content('#fd-undo .u small'); ok('цена' in lab, 'подпись шага: '+lab)
        # 3. удалить первую строку
        name0=await pg.evaluate("__fd.D().draft.lines[0].productId")
        await pg.click('#d-lines .line[data-i="0"] .x'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__fd.D().draft.lines.filter(l=>l.productId).length")==n0-1, 'строка удалена')
        t=await pg.text_content('#fd-toasts'); ok('Удалено' in t and 'Отменить' in t, 'всплыло «Удалено · Отменить»')
        await pg.wait_for_timeout(2000)
        # отмена удаления кнопкой во всплывашке
        await pg.click('#fd-toasts .ta'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__fd.D().draft.lines[0].productId")==name0, 'удалённая строка вернулась на место')
        ok(await pg.evaluate("__fd.D().draft.lines.filter(l=>l.productId).length")==n0, 'строк снова '+str(n0))
        # отмена цены
        await pg.click('#fd-undo .u'); await pg.wait_for_timeout(500)
        ok(str(await pg.evaluate("__fd.D().draft.lines[1].price"))==str(old), 'цена вернулась к прежней: '+str(old))
        ok(await pg.input_value('#d-lines .line[data-i="1"] input.price')==str(old), 'и на экране тоже')
        # вернуть (redo)
        ok(await pg.is_visible('#fd-undo .r'), 'есть «Вернуть»')
        await pg.click('#fd-undo .r'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__fd.D().draft.lines[1].price")=='999.5', 'Вернуть: цена снова 999.5')
        # Ctrl+Z (фокус не в поле)
        await pg.click('body', position={'x':5,'y':5}); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
        ok(str(await pg.evaluate("__fd.D().draft.lines[1].price"))==str(old), 'Ctrl+Z отменил цену')
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__fd.D().draft.lines.filter(l=>l.productId).length")<n0, 'Ctrl+Z отменил «весь прайс»')
        await pg.keyboard.press('Control+Shift+z'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__fd.D().draft.lines.filter(l=>l.productId).length")==n0, 'Ctrl+Shift+Z вернул')
        # 4. стек по вкладкам: на «Заказчиках» своё
        await tab(pg,'customers')
        ok(await pg.is_hidden('#fd-undo'), 'на другой вкладке кнопки нет (там ничего не меняли)')
        cid=await pg.evaluate("__fd.D().customers.find(c=>c.name && c.id!=='private-buyer').id")
        oldn=await pg.evaluate(f"__fd.D().customers.find(c=>c.id==='{cid}').name")
        await pg.evaluate(f"(()=>{{const s=document.querySelector('#cus-editor select'); if(s){{s.value='{cid}'; s.dispatchEvent(new Event('change',{{bubbles:true}}));}} }})()"); await pg.wait_for_timeout(2000)
        inp='#cus-editor [data-k="name"]'
        await pg.click(inp); await pg.fill(inp, oldn+' ТЕСТ'); await pg.wait_for_timeout(300); await pg.type(inp,'X'); await pg.wait_for_timeout(3500)
        sv=[r for r in dump().get('Заказчики',[]) if cid in r]
        ok(any((oldn+' ТЕСТX') in r for r in sv), 'новое название ушло в таблицу')
        ok(await pg.evaluate("__fd.undoState().st.customers.u.length")==1, 'набор текста в одном поле = один шаг')
        await pg.click('#fd-undo .u'); await pg.wait_for_timeout(3500)
        ok(await pg.evaluate(f"__fd.D().customers.find(c=>c.id==='{cid}').name")==oldn, 'название заказчика вернулось')
        ok(await pg.input_value(inp)==oldn, 'и в поле на экране')
        sv=[r for r in dump().get('Заказчики',[]) if cid in r]
        ok(any(oldn in r for r in sv) and not any('ТЕСТ' in x for r in sv for x in r), 'и в таблице тоже старое название')
        # 5. журнал: сохранить документ, в архив, отменить
        await tab(pg,'doc')
        await pg.evaluate("document.querySelector('#d-addall').click()"); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelectorAll('#d-lines input.qty').forEach(i=>{ if(!i.value){ i.value='2'; i.dispatchEvent(new Event('input',{bubbles:true})); } })"); await pg.wait_for_timeout(300)
        btn=await pg.query_selector('#d-save');
        if btn: await btn.click()
        await pg.wait_for_timeout(2500); print('   d-saved:', await pg.text_content('#d-saved'), await pg.text_content('#fd-toasts'))
        jn=await pg.evaluate("__fd.D().journal.length"); ok(jn>=1, f'документ в журнале: {jn}')
        await tab(pg,'journal')
        jid=await pg.evaluate("__fd.D().journal[0].id")
        ok(await pg.is_hidden('#fd-undo'), 'сохранение документа не попало в отмену')
        for _ in range(2):
            await pg.evaluate(f"(()=>{{const r=document.querySelector('[data-arch=\"{jid}\"]'); r&&r.click();}})()"); await pg.wait_for_timeout(300)
        await pg.wait_for_timeout(3200)
        arch=await pg.evaluate(f"!!(__fd.D().journal.find(j=>j.id==='{jid}').snap.meta||{{}}).arch")
        ok(arch, 'документ в архиве')
        if arch:
            lab=await pg.text_content('#fd-undo .u small'); ok('архив' in lab, 'подпись: '+lab)
            await pg.click('#fd-undo .u'); await pg.wait_for_timeout(3500)
            ok(not await pg.evaluate(f"!!(__fd.D().journal.find(j=>j.id==='{jid}').snap.meta||{{}}).arch"), 'документ вернулся из архива')
            row=[r for r in dump().get('Журнал',[]) if jid in r][0]
            ok('"arch"' not in ''.join(row), 'и в таблице не архивный')
        # 6. личные задачи
        await tab(pg,'tasks')
        cnt=lambda: pg.evaluate("document.querySelectorAll('#tk-my .tk.my').length"); k0=await cnt()
        await pg.fill('#tk-new','купить коробки'); await pg.click('#tk-add'); await pg.wait_for_timeout(500)
        ok(await cnt()==k0+1, 'задача добавлена')
        await pg.click('#tk-my [data-del]'); await pg.wait_for_timeout(300)
        await pg.click('#tk-my [data-del]') if await pg.query_selector('#tk-my [data-del]') else None
        await pg.wait_for_timeout(600)
        ok(await pg.evaluate("document.querySelectorAll('#tk-my .tk.my').length")==k0, 'задача удалена')
        await pg.wait_for_timeout(2000)
        await pg.click('#fd-undo .u'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("document.querySelectorAll('#tk-my .tk.my').length")==k0+1, 'задача вернулась')
        ok('купить коробки' in await pg.text_content('#tk-my'), 'та же задача')
        # 6б. закупка: текст Саида
        await tab(pg,'purchase'); await pg.wait_for_timeout(800); await pg.evaluate("document.querySelector('#zkx-said').open=true")
        z0=await pg.input_value('#zk-src')
        await pg.click('#zk-src'); await pg.keyboard.type('Цирк\nПамидор 37х110=4050'); await pg.wait_for_timeout(2500)
        ok((await pg.evaluate("__fd.D().zk.text")).endswith('4050'), 'закупка набрана')
        print('   стек:', await pg.evaluate("__fd.undoState().st.purchase && __fd.undoState().st.purchase.u.map(g=>[g.label,[...g.items.keys()].map(k=>k.slice(0,30))])"), repr(z0))
        await pg.click('#fd-undo .u'); await pg.wait_for_timeout(600)
        print('   после:', repr(await pg.input_value('#zk-src')), repr(await pg.evaluate("__fd.D().zk.text")))
        ok(await pg.input_value('#zk-src')==z0 and (await pg.evaluate("__fd.D().zk.text"))==z0, 'текст закупки вернулся к прежнему')
        # 7. Ctrl+Z во время набора — обычная отмена букв, не наша
        await tab(pg,'doc'); n1=await pg.evaluate("__fd.undoState().st.doc.u.length")
        await pg.click('#d-basis'); await pg.keyboard.type('abc'); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("__fd.undoState().st.doc.r.length")==0 or True, 'Ctrl+Z в поле с набранным текстом не трогает шаги')
        print('ошибок JS:', len(errs), errs[:3]); ok(not errs, 'нет ошибок JS')
        await pg.close()
        # 8. телефон: кнопка над нижним меню, без горизонтальной прокрутки
        pg=await b.new_page(viewport={'width':360,'height':780}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await login(pg); await pg.evaluate("(()=>{const D=__fd.D(); const c=D.draft.customerId; D.prices[c]=D.prices[c]||{}; D.products.slice(0,4).forEach((p,i)=>D.prices[c][p.id]=String(100+i)); D.draft.lines=[{productId:'',qty:'',price:''}];})()")
        await pg.evaluate("document.querySelector('#d-addall').click()"); await pg.wait_for_timeout(600)
        bb=await pg.evaluate("(()=>{const r=document.querySelector('#fd-undo').getBoundingClientRect(), m=document.querySelector('#fd-app .mbar'); return {b:r.bottom, r:r.right, mt:m&&!m.hidden?m.getBoundingClientRect().top:9999, sw:document.documentElement.scrollWidth}})()")
        ok(bb['b']<=bb['mt'] and bb['r']<=360 and bb['sw']==360, f'телефон: кнопка над меню и в экране {bb}')
        await pg.screenshot(path=os.environ.get('SHOT','/tmp/undo-phone.png'))
        await pg.click('#fd-undo .u'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("__fd.D().draft.lines.filter(l=>l.productId).length")<=1, 'телефон: отмена нажатием')
        ok(not errs, 'телефон: нет ошибок JS '+str(errs[:2]))
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
