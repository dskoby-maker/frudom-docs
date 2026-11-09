"""Строки отдельного счёта: перестановка перетаскиванием за ручку (мышь) и стрелками; «Загрузить по шаблону» (текстовый файл
и «Скачать шаблон» → заполненный шаблон обратно) — строки как в файле, заказчик по ИНН, цена из файла или цена заказчика; телефон."""
import asyncio, os, tempfile
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
NAMES="__inv.st().lines.map(x=>x.name)"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            cid,inn,cname=await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers.find(c=>!c.priv&&c.id!=='private-buyer'&&String(c.inn||'').length>=10); D.prices[c.id]=D.prices[c.id]||{};
              [['p-ap','Фейхоа','100'],['p-gr','Кумкват','150'],['p-sl','Питахайя','200'],['p-ki','Личи','300']].forEach(([id,n,pr])=>{ if(!D.products.some(x=>x.id===id)) D.products.push({id, name:n, code:'', unit:'кг', country:'', price:pr}); D.prices[c.id][id]=pr; }); return [c.id,c.inn,c.name]})()""")
            await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400); await pg.click('#inv-new2'); await pg.wait_for_timeout(700)
            await pg.select_option('#inv-dlg select[data-f="customerId"]', cid); await pg.wait_for_timeout(300)
            for i,(n,q,pr) in enumerate([('Фейхоа','1','100'),('Кумкват','2','150'),('Питахайя','3','200'),('Личи','4','300')]):
                await pg.click('#inv-dlg [data-invadd]'); await pg.wait_for_timeout(120)
                await pg.fill(f'#inv-dlg .invln[data-i="{i}"] [data-k="name"]', n); await pg.fill(f'#inv-dlg .invln[data-i="{i}"] [data-k="qty"]', q); await pg.fill(f'#inv-dlg .invln[data-i="{i}"] [data-k="price"]', pr)
            ok(await pg.evaluate(NAMES)==['Фейхоа','Кумкват','Питахайя','Личи'], f'{W}: 4 строки вписаны')
            ok(await pg.locator('#inv-dlg .invln .invgrip').count()==4, f'{W}: у каждой строки ручка слева')
            # перетаскивание мышью: первую строку — на третье место
            g=pg.locator('#inv-dlg .invln[data-i="0"] .invgrip'); await pg.evaluate("document.querySelector('#inv-dlg .invln[data-i=\"1\"]').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(200); bb=await g.bounding_box(); t=await pg.locator('#inv-dlg .invln[data-i="2"]').bounding_box()
            await pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2); await pg.mouse.down()
            ty=t['y']+t['height']*0.75
            for k in range(1,13): await pg.mouse.move(bb['x']+bb['width']/2, bb['y']+bb['height']/2+(ty-bb['y']-bb['height']/2)*k/12); await pg.wait_for_timeout(25)
            lifted=await pg.evaluate("!!document.querySelector('#inv-dlg .invln.dragging') && getComputedStyle(document.querySelector('#inv-dlg .invln[data-i=\"1\"]')).transform!=='none'")
            ok(lifted, f'{W}: при перетаскивании строка поднята, соседние плавно сдвигаются')
            await pg.mouse.up(); await pg.wait_for_timeout(450)
            ok(await pg.evaluate(NAMES)==['Кумкват','Питахайя','Фейхоа','Личи'], f'{W}: «Фейхоа» перенесены на 3-е место: {await pg.evaluate(NAMES)}')
            ok(await pg.evaluate("__inv.st().touched"), f'{W}: строки помечены как изменённые вручную')
            tot=(await pg.text_content('#inv-tot')).replace(' ',' ').replace(' ',' '); ok('2 200,00' in tot, f'{W}: итог не изменился: {tot}')
            # стрелками
            await pg.focus('#inv-dlg .invln[data-i="3"] .invgrip'); await pg.keyboard.press('ArrowUp'); await pg.wait_for_timeout(200)
            ok(await pg.evaluate(NAMES)==['Кумкват','Питахайя','Личи','Фейхоа'] and await pg.evaluate("document.activeElement.closest('.invln').dataset.i")=='2', f'{W}: ↑ на ручке — строка выше, курсор остался на ней')
            # Esc во время перетаскивания — отмена
            g=pg.locator('#inv-dlg .invln[data-i="0"] .invgrip'); bb=await g.bounding_box(); await pg.mouse.move(bb['x']+5, bb['y']+5); await pg.mouse.down(); await pg.mouse.move(bb['x']+5, bb['y']+90, steps=6); await pg.keyboard.press('Escape'); await pg.mouse.up(); await pg.wait_for_timeout(400)
            ok(await pg.evaluate(NAMES)==['Кумкват','Питахайя','Личи','Фейхоа'], f'{W}: Esc при перетаскивании — порядок прежний')
            # загрузка по шаблону: текстовый файл с ИНН и своим порядком
            fp=os.path.join(tempfile.gettempdir(), f'invtpl{W}.txt')
            open(fp,'w').write(f"Счёт на оплату (шаблон)\nПокупатель: {cname}, ИНН {inn}\n1. Личи 2 кг 300\n2. Фейхоа 10 кг 95\n3. Абрикосы сушёные 1,5 кг 640\n4. Кумкват 3 кг\n")
            await pg.set_input_files('#inv-fin', fp); await pg.wait_for_timeout(900)
            L=await pg.evaluate("__inv.st().lines.map(x=>[x.name,x.qty,x.unit,x.price,x.pid||''])")
            ok([x[0] for x in L]==['Личи','Фейхоа','Абрикосы сушёные','Кумкват'], f'{W}: строки — как в файле, тот же порядок: {[x[0] for x in L]}')
            ok(L[1][3]=='95' and L[3][3]=='150' and L[2][1]=='1.5', f'{W}: цена из файла (95), без цены — цена заказчика (150), дробное количество: {L}')
            ok(L[0][4]=='p-ki' and L[2][4]=='', f'{W}: найденные товары привязаны, ненайденный — вписан как в файле')
            note=(await pg.text_content('#inv-dlg .invfn')).replace(' ',' ')
            ok('4 позиции' in note and 'Абрикосы' in note and 'у заказчика' in note, f'{W}: под строками — что прочитано и замечания: {note[150:400]!r}')
            ok(await pg.evaluate("__inv.st().customerId")==cid, f'{W}: заказчик тот же (по ИНН)')
            # «Скачать шаблон» вместо «Вставить текст»: в шаблоне прайс заказчика; заполнили количество у двух — загрузили обратно
            ok(await pg.locator('#inv-dlg [data-invpaste]').count()==0 and await pg.locator('#inv-dlg .invbh [data-invtpl]').is_visible(), f'{W}: вместо «Вставить текст» — «Скачать шаблон»')
            await pg.evaluate("""window.__aoa=null; window.XLSX={utils:{aoa_to_sheet:a=>{window.__aoa=a; return {}}, book_new:()=>({}), book_append_sheet:()=>{}}, writeFile:(w,n)=>{window.__xn=n}}""")
            await pg.click('#inv-dlg .invbh [data-invtpl]'); await pg.wait_for_timeout(500)
            A=await pg.evaluate("window.__aoa"); fn=await pg.evaluate("window.__xn")
            hi=[k for k,r in enumerate(A) if r and r[0]=='Наименование'][0]; rows=A[hi+1:]
            ok(fn and fn.startswith('Шаблон счёта') and A[hi][:4]==['Наименование','Количество','Ед.','Цена, ₽'], f'{W}: шаблон скачан: {fn}, шапка {A[hi][:5]}')
            ok({r[0] for r in rows}>={'Фейхоа','Кумкват','Питахайя','Личи'} and all(r[1]=='' for r in rows) and any(r[0]=='Питахайя' and r[3]==200 for r in rows), f'{W}: в шаблоне прайс заказчика с ценами, количество пустое')
            ok(any(len(r)>1 and str(r[1])==inn for r in A[:hi]), f'{W}: в шапке шаблона ИНН заказчика')
            for r in rows:
                if r[0]=='Питахайя': r[1]='7'
                if r[0]=='Кумкват': r[1]='1,5'
            fp=os.path.join(tempfile.gettempdir(), f'invtpl2{W}.txt')
            open(fp,'w').write("\n".join("\t".join('' if isinstance(x,dict) else str(x) for x in r) for r in A))
            await pg.set_input_files('#inv-fin', fp); await pg.wait_for_timeout(900)
            L=await pg.evaluate("__inv.st().lines.map(x=>[x.name,x.qty,x.price])")
            ok(sorted(L)==sorted([['Питахайя','7','200'],['Кумкват','1.5','150']]), f'{W}: из заполненного шаблона — только строки с количеством: {L}')
            await pg.evaluate("delete window.XLSX")
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            await pg.screenshot(path=f'/tmp/claude-0/inv-lines-{W}.png')
            ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await pg.close()
        await b.close()
    print('\nПРОВАЛОВ:', len(fails)); [print(' -',f) for f in fails]
asyncio.run(main())
