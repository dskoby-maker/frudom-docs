"""«Распознать с ИИ» рядом с «Вставить текст» и «Печать» рядом со «Скачать PDF»."""
import asyncio, os, json
from playwright.async_api import async_playwright
fails=[]; CALLS=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
AI={"customer":"","date":"2026-11-20","items":[{"name":"Курага","unit":"кг","qty":5},{"name":"Изюм","unit":"кг","qty":3}]}
async def ai_route(route):
    req=route.request
    if req.method=='POST' and '"aiRead"' in (req.post_data or ''):
        CALLS.append(1)
        await route.fulfill(status=200, content_type='application/json', body=json.dumps({"ok":True,"text":json.dumps(AI,ensure_ascii=False),"model":"gemini-test"})); return
    await route.continue_()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in [(1300,900),(390,844)]:
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.route('**/*', ai_route)
            await pg.add_init_script("window.__printed=0; const _o=HTMLIFrameElement.prototype; ")
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("location.hash='#dokument'"); await pg.wait_for_timeout(600)
            ok(await pg.locator('#imp-ai').is_visible(), f'{W}: кнопка «Распознать с ИИ» видна')
            r=await pg.evaluate("(()=>{const a=document.querySelector('#imp-txt').getBoundingClientRect(), b=document.querySelector('#imp-ai').getBoundingClientRect(); return [Math.round(a.top),Math.round(b.top),Math.round(b.height)]})()")
            ok(abs(r[0]-r[1])<6 or W<500, f'{W}: рядом с «Вставить текст» {r}')
            await pg.set_input_files('#imp-aifile', files=[{'name':'scan.jpg','mimeType':'image/jpeg','buffer':b'\xff\xd8\xff\xe0'+b'0'*200}])
            got=False
            for _ in range(40):
                t=await pg.text_content('#imp-res') or ''
                if 'Курага' in t or 'ИИ' in t and 'Изюм' in t: got=True; break
                await pg.wait_for_timeout(250)
            t=await pg.text_content('#imp-res') or ''
            ok(len(CALLS)>=1 and ('Курага' in t or 'заказчик' in t), f'{W}: файл сразу ушёл в ИИ и разобран: {t[:100]}'); CALLS.clear()
            # печать
            await pg.evaluate("(()=>{const D=__fd.D(); const c=D.customers.find(c=>!c.priv && !/частн/i.test(c.name)); D.draft.customerId=c.id; D.draft.supplierId=D.suppliers[0].id; D.draft.lines=[{productId:D.products[0].id,qty:'2',price:'100'}]; })()")
            await pg.evaluate("location.hash='#zhurnal'"); await pg.wait_for_timeout(300); await pg.evaluate("location.hash='#dokument'"); await pg.wait_for_timeout(600)
            ok(await pg.locator('#d-pdfprn').is_visible(), f'{W}: кнопка «Печать» видна')
            await pg.evaluate("window.__ifr=0; new MutationObserver(m=>m.forEach(x=>x.addedNodes.forEach(n=>{ if(n.tagName==='IFRAME'){ window.__ifr++; window.__pg=()=>n.contentWindow.document.querySelectorAll('.pg').length; n.contentWindow.print=()=>{window.__printed=(window.__printed||0)+1}; } }))).observe(document.body,{childList:true})")
            n0=await pg.evaluate("__fd.D().journal.length")
            await pg.click('#d-pdfprn'); await pg.wait_for_timeout(1500)
            pr=await pg.evaluate("[window.__ifr, window.__pg?window.__pg():0, document.getElementById('pv').hidden]")
            ok(pr[0]>=1 and pr[1]>=2 and pr[2], f'{W}: печать: открылась печать без окна просмотра, листов {pr[1]} (счёт+ТОРГ)')
            ok(await pg.evaluate("__fd.D().journal.length")==n0+1, f'{W}: документ сохранён в журнал')
            dl=await pg.evaluate("[...document.querySelectorAll('#d-pdfgo,#d-pdfprn,#d-save,[data-make=\"invoice\"]')].map(e=>Math.round(e.getBoundingClientRect().height))")
            ok(dl[2]<=dl[0]+30, f'{W}: высоты Скачать/Печать/Сохранить/Счёт: {dl}')
            await pg.click('[data-pdfk="invoice"]'); await pg.click('[data-pdfk="torg12"]'); await pg.wait_for_timeout(150)
            ok(await pg.locator('#d-pdfprn').is_disabled(), f'{W}: ничего не отмечено — печать неактивна')
            await pg.click('[data-pdfk="invoice"]'); await pg.click('[data-pdfk="torg12"]')
            ok(await pg.evaluate("document.documentElement.scrollWidth")<=W, f'{W}: без прокрутки вбок')
            await pg.locator('.dmk').screenshot(path=f'/tmp/dmk{W}.png'); await pg.locator('#imp-card').screenshot(path=f'/tmp/imp{W}.png')
            ok(not errs, f'{W}: ошибок нет {errs}')
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
