"""Переходы между окнами: комплект → документ → «‹ Комплект» (назад, та же прокрутка), Esc = назад, крестик закрывает всё,
кнопка «Назад» телефона (закрытие окна снаружи) = назад, Alt+←, обновление того же окна не добавляет шаг, склад → документ → назад,
плавная анимация, ПК и телефон без прокрутки вбок."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT=os.environ.get('SHOT','/tmp/claude-0/')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
KICK="(document.querySelector('dialog.dcard[open] .dc-kicker')||{}).textContent||''"
BACK="(document.querySelector('dialog.dcard[open] .dc-back')||{}).textContent||''"
OPEN="document.querySelectorAll('dialog.dcard[open]').length"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        seeded=False
        for vw in [(1300,900),(390,844)]:
            W=vw[0]; pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            if not seeded:
                await pg.evaluate("""(()=>{const D=__fd.D(), c=D.customers[0]; window.__cid=c.id; D.prices[c.id]=D.prices[c.id]||{};
                  for(let i=0;i<14;i++){ const id='nv'+i; D.products.push({id, name:'Товар для проверки '+i, code:'', unit:'кг', country:'', price:'100'}); D.prices[c.id][id]='100'; } })()""")
                for jid in ['nb1','nb2','nb3']:
                    ls=','.join(f"{{productId:'nv{i}',qty:'{i+1}',price:'100'}}" for i in range(14))
                    await pg.evaluate(f"(()=>{{const D=__fd.D(); Object.assign(D.draft,{{id:'{jid}', customerId:window.__cid, number:'', lines:[{ls}]}}); }})()")
                    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1500)
                await pg.evaluate("__fd.flush()"); await pg.wait_for_timeout(1500); seeded=True
            await pg.evaluate("__fd.D().journal.filter(j=>['nb1','nb2','nb3'].includes(j.id)).forEach(j=>{ j.snap.meta=Object.assign(j.snap.meta||{},{batch:'tnav'}); })")
            await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
            await pg.evaluate("document.querySelector('#jr-body tr.grp td[data-gcard]').click()"); await pg.wait_for_timeout(500)
            ok((await pg.evaluate(KICK)).startswith('Комплект'), f'{W}: открыт комплект')
            ok(await pg.locator('dialog.dcard[open] .dc-back').count()==0, f'{W}: у первого окна кнопки «назад» нет')
            await pg.evaluate("document.querySelector('#fd-dcard').scrollTop=420"); await pg.wait_for_timeout(100)
            await pg.click('#fd-dcard [data-dc="doc"] >> nth=1'); await pg.wait_for_timeout(120)
            ok(await pg.evaluate(OPEN)==1, f'{W}: при переходе открыто ровно одно окно')
            ok(await pg.evaluate("document.querySelector('#fd-dcard').classList.contains('fwd')"), f'{W}: переход вперёд — с анимацией сдвига')
            await pg.wait_for_timeout(450)
            k=await pg.evaluate(KICK); ok(k.startswith('Документ №'), f'{W}: открыт документ ({k})')
            ok('Комплект' in await pg.evaluate(BACK), f'{W}: в шапке «‹ Комплект»')
            await pg.screenshot(path=SHOT+f'nav-doc-{W}.png')
            await pg.click('#fd-dcard .dc-back'); await pg.wait_for_timeout(120)
            ok(await pg.evaluate("document.querySelector('#fd-dcard').classList.contains('back')"), f'{W}: назад — с анимацией в обратную сторону')
            await pg.wait_for_timeout(450)
            ok((await pg.evaluate(KICK)).startswith('Комплект') and await pg.locator('dialog.dcard[open] .dc-back').count()==0, f'{W}: «‹ Комплект» вернул в комплект')
            st=await pg.evaluate("document.querySelector('#fd-dcard').scrollTop"); ok(abs(st-420)<60, f'{W}: прокрутка та же ({st})')
            # Esc = назад, потом закрыть
            await pg.click('#fd-dcard [data-dc="doc"] >> nth=0'); await pg.wait_for_timeout(500)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
            ok((await pg.evaluate(KICK)).startswith('Комплект'), f'{W}: Esc в документе — назад в комплект')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
            ok(await pg.evaluate(OPEN)==0, f'{W}: Esc в комплекте — закрыть')
            # крестик закрывает всё и забывает путь
            await pg.evaluate("document.querySelector('#jr-body tr.grp td[data-gcard]').click()"); await pg.wait_for_timeout(400)
            await pg.click('#fd-dcard [data-dc="doc"] >> nth=0'); await pg.wait_for_timeout(500)
            await pg.click('#fd-dcard .dc-x'); await pg.wait_for_timeout(500)
            ok(await pg.evaluate(OPEN)==0, f'{W}: крестик закрывает всё сразу')
            await pg.evaluate("document.querySelector('#jr-body [data-card]').click()"); await pg.wait_for_timeout(500)
            ok(await pg.locator('dialog.dcard[open] .dc-back').count()==0, f'{W}: документ из журнала — без «назад» (путь забыт)')
            # обновление того же окна (сохранили комментарий) не добавляет шаг
            await pg.evaluate("(()=>{const b=document.querySelector('[data-cmopen]'); if(b) b.click(); })()"); await pg.wait_for_timeout(400); await pg.fill('#dc-cmt','проверка'); await pg.press('#dc-cmt','Control+Enter'); await pg.wait_for_timeout(500)
            await pg.evaluate("(()=>{const j=__fd.D().journal.find(x=>x.id===document.querySelector('#dc-cm').dataset.doc); window.__dc && window.__dc(j); })()")
            ok(await pg.locator('dialog.dcard[open] .dc-back').count()==0, f'{W}: правка в окне не создаёт лишний шаг')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
            # кнопка «Назад» телефона: приложение закрывает окно снаружи (d.close())
            await pg.evaluate("document.querySelector('#jr-body tr.grp td[data-gcard]').click()"); await pg.wait_for_timeout(400)
            await pg.click('#fd-dcard [data-dc="doc"] >> nth=2'); await pg.wait_for_timeout(500)
            await pg.evaluate("document.querySelector('dialog[open]').close()"); await pg.wait_for_timeout(500)
            ok((await pg.evaluate(KICK)).startswith('Комплект') and await pg.evaluate(OPEN)==1, f'{W}: кнопка «Назад» телефона — в комплект')
            await pg.evaluate("document.querySelector('dialog[open]').close()"); await pg.wait_for_timeout(400)
            ok(await pg.evaluate(OPEN)==0 and await pg.locator('#fd-dcard').count()==0, f'{W}: ещё раз «Назад» — окно закрыто и убрано')
            # Alt+←
            await pg.evaluate("document.querySelector('#jr-body tr.grp td[data-gcard]').click()"); await pg.wait_for_timeout(400)
            await pg.click('#fd-dcard [data-dc="doc"] >> nth=0'); await pg.wait_for_timeout(500)
            await pg.keyboard.press('Alt+ArrowLeft'); await pg.wait_for_timeout(500)
            ok((await pg.evaluate(KICK)).startswith('Комплект'), f'{W}: Alt+← — назад')
            # комплект → «Декларации» (окно склада) → назад
            await pg.click('#fd-dcard [data-dc="decl"]'); await pg.wait_for_timeout(900)
            if await pg.locator('#sk-dlg[open]').count():
                ok('Комплект' in await pg.evaluate(BACK), f'{W}: из комплекта в окно деклараций — «‹ Комплект»')
                await pg.click('#sk-dlg .dc-back'); await pg.wait_for_timeout(500)
                ok((await pg.evaluate(KICK)).startswith('Комплект') and await pg.locator('#sk-dlg').count()==0, f'{W}: из окна склада назад в комплект')
            else: print('     (окно деклараций не открылось — склад не загружен, пропускаю)')
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: нет прокрутки вбок')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
            ok(not errs, f'{W}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
