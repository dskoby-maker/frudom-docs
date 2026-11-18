"""Кнопка «В черновик» в блоке «Сформировать» (18.11.2026): документ уходит в «Черновики» (на устройстве и в таблице), форма чистая,
«Вернуть в форму» из уведомления, пустая форма / без заказчика — не сохраняет и объясняет, документ из журнала — не трогает. PH=1 — телефон."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def srv():
    R=json.loads(urllib.request.urlopen('http://localhost:8787/dump').read().decode()).get('Черновики') or []
    return [r[7] for r in R[1:] if len(r)>7 and r[7]]
PH=os.environ.get('PH')=='1'; VW=(390,844) if PH else (1300,900); W=VW[0]
TAB="(t=>document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click())"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':VW[0],'height':VW[1]}, is_mobile=PH, has_touch=PH); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
        await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(400)
        nt=lambda: pg.evaluate("document.querySelector('#fd-toasts').innerText")
        clr=lambda: pg.evaluate("document.querySelectorAll('#fd-toasts .fd-toast').forEach(x=>x.remove())")
        ok(await pg.is_visible('#d-drsave'), f'{W}: кнопка «В черновик» видна')
        # пустая форма
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:'',qty:'',price:''}];})()"); await pg.evaluate(TAB+"('journal')"); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300)
        n0=await pg.evaluate("__fd.D().drafts.length"); await clr(); await pg.click('#d-drsave'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("__fd.D().drafts.length")==n0 and 'товар' in await nt(), f'{W}: пустая форма — не сохраняет и говорит, чего не хватает')
        # заполненная
        await pg.evaluate("(()=>{const D=__fd.D(); const c=D.customers.find(c=>!c.priv)||D.customers[1]; D.draft.customerId=c.id; D.draft.lines=[{productId:D.products[0].id,qty:'3',price:'100',qOk:'3',pOk:'100'},{productId:'',qty:'',price:''}];})()")
        await pg.evaluate(TAB+"('journal')"); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300)
        did=await pg.evaluate("__fd.D().draft.id"); await clr()
        await pg.click('#d-drsave'); await pg.wait_for_timeout(250)
        ok(await pg.evaluate("document.querySelector('#d-drsave').classList.contains('saved')"), f'{W}: кнопка показывает «В черновиках» с галочкой')
        await pg.wait_for_timeout(1800)
        ok(await pg.evaluate(f"__fd.D().drafts.some(r=>r.id==='d-{did}')"), f'{W}: документ в черновиках на устройстве')
        ok(f'd-{did}' in srv(), f'{W}: черновик ушёл в таблицу')
        st=await pg.evaluate("(()=>{const d=__fd.D().draft; return [d.id, d.lines.filter(l=>l.productId).length, d.customerId]})()")
        ok(st[0]!=did and st[1]==0 and st[2], f'{W}: форма чистая, заказчик остался: {st}')
        ok('Сохранено в черновики' in await nt(), f'{W}: уведомление «Сохранено в черновики»')
        ok(await pg.is_visible('#tab-doc .drcard'), f'{W}: блок «Черновики» виден')
        # повторно на чистой форме — ничего не делает
        n1=await pg.evaluate("__fd.D().drafts.length"); await pg.click('#d-drsave'); await pg.wait_for_timeout(300)
        ok(await pg.evaluate("__fd.D().drafts.length")==n1, f'{W}: на чистой форме новых черновиков нет')
        # «Вернуть в форму»
        await clr(); await pg.click('#d-drsave'); await pg.wait_for_timeout(200)
        await pg.evaluate(f"drOpen('d-{did}')") if False else None
        # вернуть через уведомление: снова сохраним и нажмём «Вернуть в форму»
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines=[{productId:D.products[1].id,qty:'5',price:'50',qOk:'5',pOk:'50'},{productId:'',qty:'',price:''}];})()")
        await pg.evaluate(TAB+"('journal')"); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300)
        d2=await pg.evaluate("__fd.D().draft.id"); await clr(); await pg.click('#d-drsave'); await pg.wait_for_timeout(500)
        await pg.click('#fd-toasts button:has-text("Вернуть в форму")'); await pg.wait_for_timeout(700)
        st=await pg.evaluate("(()=>{const d=__fd.D().draft; return [d.id, d.lines.filter(l=>l.productId).map(l=>l.qty)]})()")
        ok(st[0]==d2 and st[1]==['5'], f'{W}: «Вернуть в форму» возвращает документ: {st}')
        # документ в журнале — не откладывается
        await pg.evaluate("(()=>{const D=__fd.D(); D.draft.lines[0].qOk=D.draft.lines[0].qty;})()")
        await pg.click('#d-save'); await pg.wait_for_timeout(1800)
        jid=await pg.evaluate("__fd.D().journal[0].id")
        await pg.evaluate(f"(()=>{{const D=__fd.D(); D.draft=JSON.parse(JSON.stringify(D.journal.find(j=>j.id==='{jid}').snap.dr||D.draft)); D.draft.id='{jid}';}})()")
        await pg.evaluate(TAB+"('journal')"); await pg.evaluate(TAB+"('doc')"); await pg.wait_for_timeout(300)
        n2=await pg.evaluate("__fd.D().drafts.length"); await clr(); await pg.click('#d-drsave'); await pg.wait_for_timeout(400)
        ok(await pg.evaluate("__fd.D().drafts.length")==n2 and 'уже в журнале' in await nt(), f'{W}: документ из журнала в черновик не уходит')
        ok(await pg.evaluate('document.documentElement.scrollWidth')<=W, f'{W}: без прокрутки вбок')
        await pg.locator('#tab-doc .dmk').screenshot(path=f'/tmp/claude-0/dmk-{W}.png')
        ok(not errs, f'{W}: ошибок нет {errs[:2]}'); await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
