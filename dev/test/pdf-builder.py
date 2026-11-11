"""Конструктор «Одним PDF»: отмечаем Счёт / ТОРГ‑12 / УПД, «Скачать PDF» кладёт в файл ровно выбранное (ПК и телефон)."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SH=os.environ.get('SHOT','/tmp/')
H2C="window.html2canvas=async el=>{const c=document.createElement('canvas');c.width=100;c.height=140;return c;};"
JSPDF="""window.jspdf={jsPDF:function(o){window.__pdf={pages:[o.orientation],name:null};this.addPage=(f,or)=>window.__pdf.pages.push(or);this.addImage=()=>{};this.save=n=>{window.__pdf.name=n;};}};"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for vw in [(1300,900),(390,844),(360,740)]:
            pg=await b.new_page(viewport={'width':vw[0],'height':vw[1]}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/html2canvas.min.js', lambda r: r.fulfill(body=H2C, content_type='text/javascript'))
            await pg.route('**/jspdf.umd.min.js', lambda r: r.fulfill(body=JSPDF, content_type='text/javascript'))
            await pg.goto('http://localhost:8787/page'); await pg.evaluate("localStorage.removeItem('frudom-pdfk')")
            await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            async def fresh(q):
                if await pg.evaluate("__fd.D().journal.some(j=>j.id===__fd.D().draft.id)"):
                    await pg.click('#d-new'); await pg.click('#d-new'); await pg.wait_for_timeout(300)
                await pg.evaluate("(q)=>{const D=__fd.D(); const c=D.customers.find(c=>!c.priv && !/частн/i.test(c.name)); D.draft.customerId=c.id; D.draft.lines=[{productId:D.products[0].id,qty:q,price:'100'}]; }", q)
                await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"doc\"]').click()"); await pg.wait_for_timeout(400)
            await fresh('5')
            go=pg.locator('#d-pdfgo'); await go.scroll_into_view_if_needed()
            pr=lambda k: pg.get_attribute(f'[data-pdfk="{k}"]','aria-pressed')
            ok(await pr('invoice')=='true' and await pr('torg12')=='true' and await pr('upd')=='false', f'{vw[0]}: по умолчанию Счёт + ТОРГ‑12')
            ok((await go.text_content()).strip()=='Скачать PDF (2)', f'{vw[0]}: кнопка «Скачать PDF (2)»')
            await pg.locator('#tab-doc .dmk').screenshot(path=SH+f'pdfk-{vw[0]}.png')
            async def dl(expect, pages):
                await pg.evaluate("window.__pdf=null"); n0=await pg.evaluate("__fd.D().journal.length")
                await go.click(); await pg.wait_for_timeout(3000)
                r=await pg.evaluate("window.__pdf")
                ok(r and r['name'] and r['name'].startswith(expect), f'{vw[0]}: файл «{(r or {}).get("name")}» начинается с «{expect}»')
                ok(r and r['pages']==pages, f'{vw[0]}: листы {(r or {}).get("pages")} = {pages}')
                ok(await pg.evaluate("__fd.D().journal.length")==n0+1, f'{vw[0]}: документ сохранён в журнал')
            await dl('Счёт и ТОРГ-12', ['p','l'])
            # только УПД
            await fresh('6'); await pg.click('[data-pdfk="invoice"]'); await pg.click('[data-pdfk="torg12"]'); await pg.click('[data-pdfk="upd"]')
            ok((await go.text_content()).strip()=='Скачать PDF' and await go.get_attribute('data-combo')=='upd', f'{vw[0]}: только УПД')
            await dl('УПД', ['l'])
            # все три — порядок всегда счёт, ТОРГ, УПД (отмечаем в обратном порядке)
            await fresh('7'); await pg.click('[data-pdfk="torg12"]'); await pg.click('[data-pdfk="invoice"]')
            ok(await go.get_attribute('data-combo')=='invoice,torg12,upd', f'{vw[0]}: порядок счёт → ТОРГ → УПД')
            await dl('Счёт и ТОРГ-12 и УПД', ['p','l','l'])
            # ничего не выбрано — кнопка неактивна, ничего не сохраняется
            for k in ['invoice','torg12','upd']: await pg.click(f'[data-pdfk="{k}"]')
            ok(await go.is_disabled() and 'Отметьте' in (await go.text_content()), f'{vw[0]}: без выбора кнопка неактивна')
            # выбор запоминается после перезагрузки
            await pg.click('[data-pdfk="upd"]'); await pg.click('[data-pdfk="invoice"]')
            await pg.reload(); await pg.wait_for_timeout(2500)
            ok(await pr('invoice')=='true' and await pr('upd')=='true' and await pr('torg12')=='false', f'{vw[0]}: выбор запомнился (Счёт + УПД)')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==vw[0], f'{vw[0]}: нет прокрутки вбок')
            ok(not errs, f'{vw[0]}: нет ошибок JS {errs[:2]}'); await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
