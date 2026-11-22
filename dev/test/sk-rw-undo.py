"""Склад: перевзвешивание с проверкой веса, отмена перевзвешивания (из партии, из уведомления, из «Истории»), вес 1 шт у товара."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def until(pg, js, t=9000):
    for _ in range(t//200):
        if await pg.evaluate(js): return True
        await pg.wait_for_timeout(200)
    return False
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH") or None)
        W=int(os.environ.get('W','1300')); tag='ph' if W<600 else 'pc'
        pg=await b.new_page(viewport={'width':W,'height':900}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.add_init_script("localStorage.setItem('frudom-skflv','log')")
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(TAB+"('stock')"); await pg.wait_for_timeout(1200)
        nm='Макароны фас Ситно 500гх15шт рожки '+tag
        await pg.evaluate("n=>__sk.send('bulk',{kind:'in', rows:[{itemId:'',newName:n,unit:'шт',qty:'405',price:'39.2',date:'2026-11-13',exp:'',supplier:'РегионПродукт',docRef:'35027'}]},'тест')", nm)
        await pg.wait_for_timeout(900)
        ids=await pg.evaluate("n=>{const S=__sk.state(); const it=S.items.find(i=>i.name===n); const b=S.batches.find(x=>x.itemId===it.id); return [it.id,b.id];}", nm)
        iid,bid=ids
        # карточка партии: вес из названия → 405 шт ≈ 202,5 кг
        await pg.evaluate("id=>__sk.batch(id)", bid); await pg.wait_for_timeout(600)
        txt=await pg.text_content('#sk-dlg'); ok('202,5' in txt and '500 г' in txt, f'{tag}: в партии видно ≈ 202,5 кг и 1 шт = 500 г (из названия)')
        await pg.click('#sk-dlg [data-sk="mode"][data-m="rw"]'); await pg.wait_for_timeout(400)
        ok(await pg.input_value('#sk-dlg .skrn')=='405' and await pg.input_value('#sk-dlg .skrk')=='202,5', f'{tag}: перевзвешивание — 405 шт и 202,5 кг подставлены сами')
        # ошибка как у Даниила: 20,25 кг
        await pg.fill('#sk-dlg .skrk','20,25'); await pg.wait_for_timeout(200)
        w=await pg.text_content('#sk-rwc'); ok('50 г' in w and '500 г' in w and 'Поставить' in w, f'{tag}: предупреждение «1 шт = 50 г, а в названии 500 г» ({w.strip()[:90]})')
        await pg.click('#sk-dlg [data-sk="rwSave"]'); await pg.wait_for_timeout(500)
        t=await pg.text_content('#sk-dlg [data-sk="rwSave"]'); ok('верный' in t, f'{tag}: первое нажатие не проводит — просит подтвердить ({t})')
        await pg.click('#sk-dlg [data-sk="rwSave"]')
        ok(await until(pg,"(()=>{const S=__sk.state(); return S.batches.some(b=>b.kind==='rw'&&b.parent==='"+bid+"')})()",15000), f'{tag}: после подтверждения перевзвешено (ошибочно 20,25 кг)')
        await pg.wait_for_timeout(600)
        ok(await pg.locator('#fd-toasts .ta', has_text='Отменить').count()>=1, f'{tag}: в уведомлении есть «Отменить»')
        ok(await pg.evaluate("id=>!(+(__sk.state().items.find(i=>i.id===id)||{}).pack)", iid), f'{tag}: странный вес (50 г) у товара не запомнился')
        txt=await pg.text_content('#sk-dlg'); ok('Ошиблись при перевзвешивании' in txt, f'{tag}: в новой партии подсказка «Ошиблись? Отменить»')
        await pg.click('#sk-dlg .skrwbox [data-skrwund]'); await pg.wait_for_timeout(200)
        t=await pg.text_content('#sk-dlg .skrwbox [data-skrwund]'); ok('Да' in t, f'{tag}: отмена в два нажатия ({t})')
        await pg.click('#sk-dlg .skrwbox [data-skrwund]')
        ok(await until(pg,"(()=>{const S=__sk.state(); const r=S.batches.find(b=>b.kind==='rw'&&b.parent==='"+bid+"'); return r&&r.cancel})()",15000), f'{tag}: перевзвешивание отменено')
        await pg.wait_for_timeout(600)
        f=await pg.evaluate("id=>__sk.fact(id)", bid); ok(abs(f-405)<1e-6, f'{tag}: 405 шт вернулись в исходную партию ({f})')
        # таблица
        dm=json.load(urllib.request.urlopen('http://localhost:8787/dump'))
        mv=dm.get('Склад: движения'); ok(any('Отмена перевзвешивания' in ' '.join(map(str,r)) for r in mv[1:]), f'{tag}: в таблице движение «Отмена перевзвешивания»')
        # приход снова можно отменить (из партии ничего не брали)
        ok(await pg.evaluate("id=>__sk.canCancel(id)", bid), f'{tag}: после отмены приход снова можно отменить')
        # вес 1 шт у товара: «500» в кг → предупреждение
        await pg.evaluate("id=>__sk.item2(id)", iid); await pg.wait_for_timeout(600)
        await pg.click('#sk-dlg [data-skpwu="кг"]'); await pg.wait_for_timeout(300)
        await pg.fill('#sk-dlg .skpwv','500'); await pg.wait_for_timeout(200)
        w=await pg.text_content('#sk-pwc'); ok('граммы' in w, f'{tag}: 500 кг за штуку — подсказка «возможно, граммы»')
        await pg.click('#sk-pwc [data-skpwu="г"]'); await pg.wait_for_timeout(300)
        w=await pg.text_content('#sk-pwc'); ok('500 г' in w and '202,5' in w, f'{tag}: 500 г → «на складе 405 шт ≈ 202,5 кг» ({w.strip()[:80]})')
        await pg.click('#sk-dlg [data-sk="pwSave"]')
        ok(await until(pg,"(()=>{const S=__sk.state(); const it=S.items.find(i=>i.id==='"+iid+"'); return it && +it.pack===0.5})()",15000), f'{tag}: вес 1 шт сохранён у товара (0,5 кг)')
        # перевзвесить правильно → история → отменить из «Истории»
        await pg.evaluate("id=>__sk.batch(id)", bid); await pg.wait_for_timeout(400)
        await pg.click('#sk-dlg [data-sk="mode"][data-m="rw"]'); await pg.wait_for_timeout(300)
        await pg.fill('#sk-dlg .skrn','100'); await pg.wait_for_timeout(150)
        ok(await pg.input_value('#sk-dlg .skrk')=='50', f'{tag}: 100 шт → 50 кг само')
        ok(await pg.locator('#sk-rwc .skrw-w').count()==0, f'{tag}: правильный вес — без предупреждения')
        await pg.click('#sk-dlg [data-sk="rwSave"]')
        ok(await until(pg,"(()=>__sk.state().batches.filter(b=>b.kind==='rw'&&b.parent==='"+bid+"'&&!b.cancel).length===1)()",15000), f'{tag}: перевзвешено с первого нажатия')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400); await pg.evaluate("document.querySelectorAll('#sk-dlg').forEach(d=>d.close&&d.close())"); await pg.wait_for_timeout(300)
        await pg.click('#sk-segs [data-skt="log"]'); await pg.wait_for_timeout(600)
        r=pg.locator('#sk-list .sklr.go', has_text='Перевзвешивание').first
        ok(await r.count()==1, f'{tag}: в «Истории» запись перевзвешивания нажимается')
        ok(await r.locator('[data-skrwund]').count()==1, f'{tag}: в «Истории» у перевзвешивания кнопка «Отменить»')
        await r.click(position={'x':80,'y':10}); await pg.wait_for_timeout(600)
        ok(await pg.locator('#sk-dlg .skrwbox [data-skrwund]').count()==1, f'{tag}: запись открывает партию с кнопкой отмены')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        u=pg.locator('#sk-list .sklr.go', has_text='Перевзвешивание').first.locator('[data-skrwund]')
        await u.click(); await pg.wait_for_timeout(150); await u.click()
        ok(await until(pg,"(()=>__sk.state().batches.filter(b=>b.kind==='rw'&&b.parent==='"+bid+"'&&!b.cancel).length===0)()",15000), f'{tag}: отменено прямо из «Истории»')
        f=await pg.evaluate("id=>__sk.fact(id)", bid); ok(abs(f-405)<1e-6, f'{tag}: снова 405 шт ({f})')
        # списание больше свободного — не уходит
        await pg.evaluate("id=>__sk.batch(id)", bid); await pg.wait_for_timeout(400)
        await pg.click('#sk-dlg [data-sk="mode"][data-m="wo"]'); await pg.wait_for_timeout(300)
        await pg.fill('#sk-dlg .skwq','500'); await pg.fill('#sk-dlg .skwr','брак'); await pg.click('#sk-dlg [data-sk="woSave"]'); await pg.wait_for_timeout(500)
        f=await pg.evaluate("id=>__sk.fact(id)", bid); ok(abs(f-405)<1e-6, f'{tag}: списать 500 из 405 — не дало')
        sw=await pg.evaluate("[document.documentElement.scrollWidth, innerWidth]"); ok(sw[0]<=sw[1], f'{tag}: без прокрутки вбок {sw}')
        if os.environ.get('SHOT'):
            await pg.click('#sk-dlg [data-sk="mode0"]'); await pg.click('#sk-dlg [data-sk="mode"][data-m="rw"]'); await pg.fill('#sk-dlg .skrk','20,25'); await pg.wait_for_timeout(300)
            await pg.screenshot(path=os.environ['SHOT']+f'/rw-{tag}.png')
        ok(not errs, f'{tag}: ошибок JS нет {errs}')
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
