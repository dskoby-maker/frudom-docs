"""«Важное» у комментария (16.11.2026): галочка в блоке комментария, подсветка документа в журнале,
фильтр «Важные» со счётчиком, снятие отметки, отмена, запись в таблицу, телефон без прокрутки вбок, Гриша тоже может."""
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
SHOT=os.environ.get('SHOT','/tmp/')
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"doc\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
PH=os.environ.get('PH')=='1'
async def login(b, who, pw, vw):
    pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}, is_mobile=PH, has_touch=PH); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return pg, errs
async def mkdoc(pg):
    before=set(await pg.evaluate("__fd.D().journal.map(j=>j.id)"))
    await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[0].id,qty:'5',price:'100'},{productId:'',qty:'',price:''}]; })()")
    await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300); await pg.click('#d-save'); await pg.wait_for_timeout(1800)
    jid=[i for i in await pg.evaluate("__fd.D().journal.map(j=>j.id)") if i not in before]; jid=jid[0] if jid else None; await pg.click('#d-new'); await pg.click('#d-new'); await pg.wait_for_timeout(500)
    return jid
    return await pg.evaluate("__fd.D().journal[0].id")
async def open_card(pg, jid):
    await pg.evaluate(f"document.querySelector('#jr-body [data-card=\"{jid}\"]').click()"); await pg.wait_for_timeout(600)
async def main():
    W=(390,844) if PH else (1300,900)
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        pg,errs=await login(b,'Даниил','1111',W)
        j1=await mkdoc(pg); j2=await mkdoc(pg); ok(j1!=j2, 'два разных документа')
        await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(400)
        ok(await pg.is_hidden('#jr-imp'), 'нет важных — кнопки «Важные» нет')
        await open_card(pg, j1)
        await pg.click('#fd-dcard [data-cmopen]'); await pg.wait_for_timeout(450)
        ok(await pg.is_visible('#dc-cmimp'), 'в комментарии есть галочка «Важное»')
        ok(await pg.get_attribute('#dc-cmimp','aria-pressed')=='false', 'по умолчанию не отмечена')
        await pg.fill('#dc-cmt','Срочно перевесить'); await pg.click('#dc-cmimp'); await pg.wait_for_timeout(350)
        ok(await pg.get_attribute('#dc-cmimp','aria-pressed')=='true' and await pg.evaluate("document.querySelector('#dc-cm').classList.contains('imp')"), 'отметка ставится, блок краснеет сразу')
        await pg.screenshot(path=SHOT+'imp-card.png')
        await pg.click('#dc-cm [data-cm="save"]'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='{j1}').snap.meta.cm.imp")==1, 'сохранено imp=1')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
        ok(await pg.evaluate(f"!!document.querySelector('#jr-body [data-card=\"{j1}\"]').closest('tr.jimp')"), 'строка важного документа подсвечена')
        ok(await pg.evaluate(f"!document.querySelector('#jr-body [data-card=\"{j2}\"]').closest('tr.jimp')"), 'обычный документ не подсвечен')
        ok(await pg.locator(f'#jr-body [data-card="{j1}"] .jcm.imp').count()==1, 'значок комментария красный с «!»')
        bg=await pg.evaluate(f"(()=>{{const tr=document.querySelector('#jr-body [data-card=\"{j1}\"]').closest('tr'); return getComputedStyle({"true" if PH else "false"}?tr:tr.querySelector('td')).backgroundColor}})()")
        ok('192, 57, 43' in bg, 'фон строки — мягкий красный: '+bg)
        ok(await pg.is_visible('#jr-imp') and (await pg.text_content('#jr-impn')).strip()=='1', 'кнопка «Важные · 1»')
        await pg.screenshot(path=SHOT+'imp-journal.png')
        await pg.click('#jr-imp'); await pg.wait_for_timeout(450)
        n=await pg.evaluate("document.querySelectorAll('#jr-body [data-card]').length")
        ok(n==1 and await pg.get_attribute('#jr-imp','aria-pressed')=='true', 'фильтр «Важные» показывает только важный документ')
        ok('Найдено: 1' in await pg.text_content('#jr-sum'), 'итог по отфильтрованным')
        await pg.screenshot(path=SHOT+'imp-filter.png')
        if PH: ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), 'телефон: без прокрутки вбок')
        await pg.click('#jr-imp'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("document.querySelectorAll('#jr-body [data-card]').length")>=2, 'повторное нажатие — снова все')
        await pg.click('#jr-imp'); await pg.wait_for_timeout(300)
        await pg.click('#jr-reset'); await pg.wait_for_timeout(300)
        ok(await pg.get_attribute('#jr-imp','aria-pressed')=='false', '«Сбросить фильтры» снимает «Важные»')
        await pg.evaluate('__fd.flush()'); await pg.wait_for_timeout(1800)
        s=snap_of(j1); ok(s and s['meta']['cm'].get('imp')==1, 'отметка записана в таблицу')
        # снять отметку без изменения текста
        await open_card(pg, j1)
        ok(await pg.get_attribute('#dc-cmimp','aria-pressed')=='true', 'в окне видна отметка')
        await pg.click('#dc-cmimp'); await pg.wait_for_timeout(350)
        ok(await pg.is_visible('#dc-cm [data-cm="save"]'), 'смена отметки — появилась «Сохранить»')
        await pg.click('#dc-cm [data-cm="cancel"]'); await pg.wait_for_timeout(300)
        ok(await pg.get_attribute('#dc-cmimp','aria-pressed')=='true', '«Отмена» возвращает отметку')
        await pg.click('#dc-cmimp'); await pg.click('#fd-dcard .dc-x'); await pg.wait_for_timeout(600)
        ok(not await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='{j1}').snap.meta.cm.imp"), 'при закрытии окна снятие сохранилось само')
        ok(await pg.is_hidden('#jr-imp'), 'важных нет — кнопка пропала')
        ok(await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='{j1}').snap.meta.cm.t")=='Срочно перевесить', 'текст не потерялся')
        # пустой комментарий с галочкой не сохраняется
        await open_card(pg, j2); await pg.click('#fd-dcard [data-cmopen]'); await pg.wait_for_timeout(400)
        await pg.click('#dc-cmimp'); await pg.wait_for_timeout(200)
        ok(await pg.is_hidden('#dc-cm [data-cm="save"]'), 'галочка без текста — сохранять нечего')
        await pg.click('#fd-dcard .dc-x'); await pg.wait_for_timeout(500)
        ok(not await pg.evaluate(f"__fd.D().journal.find(j=>j.id==='{j2}').snap.meta.cm"), 'пустой комментарий не появился')
        ok(not errs, 'без ошибок на странице: '+'; '.join(errs))
        # Гриша
        g,ge=await login(b,'Гриша','3333',W)
        await g.evaluate(TAB+"('journal')"); await g.wait_for_timeout(500)
        await open_card(g, j2); await g.click('#fd-dcard [data-cmopen]'); await g.wait_for_timeout(400)
        await g.fill('#dc-cmt','Гриша: важно'); await g.click('#dc-cmimp'); await g.press('#dc-cmt','Control+Enter'); await g.wait_for_timeout(400)
        await g.keyboard.press('Escape'); await g.evaluate('__fd.flush()'); await g.wait_for_timeout(2000)
        s=snap_of(j2); ok(s and s['meta'].get('cm',{}).get('imp')==1, 'Гриша тоже может отметить важным, сервер принял')
        ok(not ge, 'у Гриши без ошибок: '+'; '.join(ge))
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
