"""После распознавания заявки ИИ — окно «Внимание: ИИ может ошибаться»: что проверить, закрывается «Понятно», крестиком, Esc,
нажатием мимо; плавно; на телефоне помещается. Сервер: AI_FAKE=/tmp/ai-warn.json."""
import asyncio, os, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def ev(js): return json.loads(urllib.request.urlopen(urllib.request.Request('http://localhost:8787/eval', data=js.encode(), method='POST')).read().decode())
F='/tmp/claude-0/aiw-zayavka.txt'; os.makedirs('/tmp/claude-0', exist_ok=True); open(F,'w').write('Заявка\nПетрушка 3 кг\n')
async def main():
    ev("PropertiesService.getScriptProperties().setProperty('GEMINI_KEY','AIzaTEST0000000000000000000'); 1")
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W,H in ((1300,900),(360,740)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            if W==1300:
                pname=await pg.evaluate("__fd.D().products[0].name"); cname=await pg.evaluate("__fd.D().customers[0].name")
                json.dump({"customer":cname,"items":[{"name":pname,"unit":"кг","qty":3}]}, open('/tmp/ai-warn.json','w'), ensure_ascii=False)
            async def recog():
                await pg.set_input_files('#imp-aifile', F)
                await pg.wait_for_selector('#aiw[open]', timeout=15000); await pg.wait_for_timeout(350)
            await recog()
            t=await pg.text_content('#aiw')
            ok('ИИ может ошибаться' in t and all(w in t for w in ('наименования','количество','дату','заказчика')), f'{W}: окно после распознавания — что проверить')
            ok(await pg.evaluate("document.activeElement.classList.contains('aiwok')"), f'{W}: курсор на «Понятно»')
            r=await pg.evaluate("(()=>{const r=document.querySelector('#aiw .aiwb').getBoundingClientRect(); return [r.left, r.right, innerWidth, document.documentElement.scrollWidth]})()")
            ok(r[0]>=8 and r[1]<=r[2]-8 and r[3]<=r[2], f'{W}: окно помещается по ширине ({r})')
            ok(await pg.evaluate("getComputedStyle(document.getElementById('fd-toasts')||document.body).opacity")=='0' or not await pg.evaluate("!!document.getElementById('fd-toasts')"), f'{W}: уведомления не наезжают на окно')
            await pg.click('#aiw .aiwok'); await pg.wait_for_timeout(100)
            ok(await pg.evaluate("document.getElementById('aiw').classList.contains('out')"), f'{W}: закрывается плавно (анимация ухода)')
            await pg.wait_for_timeout(300); ok(not await pg.evaluate("document.getElementById('aiw').open"), f'{W}: «Понятно» закрывает')
            ok(not await pg.evaluate("document.documentElement.classList.contains('aiwon')"), f'{W}: уведомления снова видны')
            ok('прочитан' in (await pg.text_content('#tab-doc')).lower() or 'ИИ' in await pg.text_content('#tab-doc'), f'{W}: форма заполнена под окном')
            await recog(); await pg.click('#aiw .aiwx'); await pg.wait_for_timeout(350); ok(not await pg.evaluate("document.getElementById('aiw').open"), f'{W}: крестик закрывает')
            await recog(); await pg.keyboard.press('Escape'); await pg.wait_for_timeout(350); ok(not await pg.evaluate("document.getElementById('aiw').open"), f'{W}: Esc закрывает')
            await recog(); await pg.mouse.click(5, H-5); await pg.wait_for_timeout(350); ok(not await pg.evaluate("document.getElementById('aiw').open"), f'{W}: нажатие мимо закрывает')
            ok(await pg.evaluate("document.querySelectorAll('#aiw').length")==1, f'{W}: окно одно, не плодится')
            ok(not errs, f'{W}: без ошибок {errs[:2]}')
            await pg.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'ошибок {len(fails)}')
    if fails: raise SystemExit(1)
asyncio.run(main())
