"""Комментарий к документу: окно в карточке документа, значок в журнале, сохранение в таблицу,
Ctrl+Enter, отмена, автосохранение при закрытии, удаление, поиск, Гриша тоже может, в печать не попадает."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def snap_of(jid):
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Журнал') or [[]]
    h=d[0]
    for r in d[1:]:
        x=dict(zip(h,r))
        if x.get('ID')==jid: return json.loads(x.get('Данные документа (не редактировать)') or '{}')
    return None
SHOT=os.environ.get('SHOT','/tmp/claude-0/')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, who, pw, vw):
    pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg,errs=await login(b,'Даниил','1111',(1300,900))
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'},{productId:'',qty:'',price:''}]; })()")
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(2000)
        jid=await pg.evaluate("__fd.D().journal[0].id")
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400)
        ok(await pg.locator('#jr-body .jcm').count()==0, 'без комментария значка нет')
        await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
        ok(await pg.is_visible('#fd-dcard [data-cmopen]') and await pg.evaluate("document.querySelector('#fd-dcard .dc-cmi').getBoundingClientRect().height<1 && !document.querySelector('#dc-cmf').classList.contains('open')"), 'комментарий свёрнут: видна кнопка «Оставить комментарий к этой накладной»')
        ok('Оставить комментарий к этой накладной' in await pg.inner_text('#fd-dcard [data-cmopen]'), 'текст кнопки')
        await pg.click('#fd-dcard [data-cmopen]'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate("document.activeElement&&document.activeElement.id==='dc-cmt'") and await pg.is_hidden('#fd-dcard [data-cmopen]'), 'кнопка раскрыла поле, курсор в нём')
        ok(await pg.is_visible('#dc-cm'), 'в окне документа есть блок «Комментарий»')
        ok(await pg.is_hidden('#dc-cm .cma button'), 'кнопки скрыты, пока ничего не набрано')
        await pg.fill('#dc-cmt','Заказчик просил до 10:00\nзвонить Ольге'); await pg.wait_for_timeout(350)
        ok(await pg.is_visible('#dc-cm [data-cm="save"]'), 'появилась кнопка «Сохранить»')
        await pg.click('#dc-cm [data-cm="cancel"]'); await pg.wait_for_timeout(300)
        ok(await pg.input_value('#dc-cmt')=='', '«Отмена» возвращает как было')
        ok(await pg.is_visible('#fd-dcard [data-cmopen]'), '«Отмена» в пустом — снова свёрнуто')
        await pg.click('#fd-dcard [data-cmopen]'); await pg.wait_for_timeout(500)
        await pg.fill('#dc-cmt','Заказчик просил до 10:00\nзвонить Ольге'); await pg.press('#dc-cmt','Control+Enter'); await pg.wait_for_timeout(500)
        ok('Даниил' in (await pg.text_content('#dc-cmw')), 'видно автора и время')
        await pg.screenshot(path=SHOT+'cm-card-1300.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1800)
        s=snap_of(jid); ok(s and s.get('meta',{}).get('cm',{}).get('t')=='Заказчик просил до 10:00\nзвонить Ольге', 'комментарий записан в таблицу')
        ok(await pg.locator(f'#jr-body [data-card="{jid}"] .jcm').count()==1, 'в журнале появился значок комментария')
        tip=await pg.get_attribute(f'#jr-body [data-card="{jid}"] .jcm','title'); ok('звонить Ольге' in tip, 'подсказка значка — текст комментария')
        await pg.screenshot(path=SHOT+'cm-journal-1300.png')
        await pg.fill('#jr-q','Ольге'); await pg.wait_for_timeout(400)
        ok(await pg.locator(f'#jr-body [data-card="{jid}"]').count()==1, 'поиск по журналу находит по комментарию')
        await pg.fill('#jr-q',''); await pg.wait_for_timeout(300)
        # клик по значку — окно сразу на комментарии, правка + автосохранение при закрытии
        await pg.click(f'#jr-body [data-card="{jid}"] .jcm'); await pg.wait_for_timeout(700)
        ok(await pg.evaluate("document.activeElement&&document.activeElement.id==='dc-cmt'"), 'клик по значку ставит курсор в комментарий')
        await pg.fill('#dc-cmt','Изменили текст'); await pg.click('#fd-dcard .dc-x'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='{jid}').snap.meta.cm.t")=='Изменили текст', 'при закрытии окна несохранённое сохраняется само')
        # печатные формы без комментария
        html=await pg.evaluate(f"(()=>{{const j=__fd.D().journal.find(j=>j.id==='{jid}'); const k=__fd.calc(j.snap.dr,j.snap); return ['invoice','torg12','upd'].map(t=>__fd.KINDS[t]?__fd.KINDS[t].render?__fd.KINDS[t].render(k):'':'').join('')+JSON.stringify(k)}})()")
        ok('Изменили текст' not in html, 'в счёт/ТОРГ/УПД комментарий не попадает')
        # удалить
        await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
        await pg.fill('#dc-cmt',''); await pg.click('#dc-cm [data-cm="save"]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate(f"!__fd.D().journal.find(j=>j.id==='{jid}').snap.meta.cm"), 'пустой комментарий удаляется')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        ok(await pg.locator(f'#jr-body [data-card="{jid}"] .jcm').count()==0, 'значок пропал')
        await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(400)
        if await pg.is_visible('#fd-dcard [data-cmopen]'): await pg.click('#fd-dcard [data-cmopen]'); await pg.wait_for_timeout(500)
        await pg.fill('#dc-cmt','Для Гриши'); await pg.click('#dc-cm [data-cm="save"]'); await pg.wait_for_timeout(300); await pg.keyboard.press('Escape')
        await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1800)
        ok(not errs, f'нет ошибок JS {errs[:2]}'); await pg.close()
        # Гриша на телефоне: видит и может дописать
        pg,errs=await login(b,'Гриша','3333',(390,844))
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(600)
        ok(await pg.locator(f'[data-card="{jid}"] .jcm').count()>=1, 'Гриша видит значок')
        await pg.evaluate(f"document.querySelector('[data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(500)
        ok(await pg.input_value('#dc-cmt')=='Для Гриши', 'Гриша видит текст')
        await pg.fill('#dc-cmt','Для Гриши\nОтвёз, принял охранник'); await pg.click('#dc-cm [data-cm="save"]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SHOT+'cm-card-390.png')
        ok(await pg.evaluate("document.documentElement.scrollWidth")<=390, 'телефон: нет прокрутки вбок')
        await pg.keyboard.press('Escape'); await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(2000)
        s=snap_of(jid); ok(s and 'охранник' in s['meta']['cm']['t'] and s['meta']['cm']['by']=='Гриша', 'сервер принял комментарий Гриши')
        await pg.screenshot(path=SHOT+'cm-journal-390.png')
        ok(not errs, f'Гриша: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
