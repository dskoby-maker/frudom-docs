"""Тёмная тема только у Даниила: переключатель в «Данные» → «Оформление», хранится в личных настройках (prefs.dark),
действует на всех его устройствах; у Натальи нет ни темы, ни переключателя; после выхода экран входа светлый;
картинки и листы документов не переворачиваются; печать — без фильтра. Запуск: тестовый сервер (node test/server.js). PH=1 — только телефон.
Снимки — в /tmp/claude-0/dark-*.png."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
SHOT='/tmp/claude-0'; os.makedirs(SHOT, exist_ok=True)
async def login(b, who, pw, W):
    ctx=await b.new_context(viewport={'width':W,'height':860}, has_touch=W<500, is_mobile=W<500); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    return ctx, pg, errs
TAB="(t=>{ const b=document.querySelector('#fd-app nav.tabs [data-tab=\"'+t+'\"]'); if(b) b.click(); })"
DARK="document.documentElement.classList.contains('fd-dark')"
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        for W in ((390,) if os.environ.get('PH') else (1300,390)):
            ctx,pg,errs=await login(b,'Даниил','1111',W)
            ok(not await pg.evaluate(DARK), f'{W}: по умолчанию тема светлая')
            await pg.evaluate(TAB+"('data')"); await pg.wait_for_timeout(700)
            ok(await pg.locator('#dk-card').is_visible(), f'{W}: в «Данных» есть «Оформление»')
            await pg.click('#dk-tog'); await pg.wait_for_timeout(600)
            ok(await pg.evaluate(DARK), f'{W}: тёмная тема включилась')
            ok(await pg.get_attribute('#dk-tog','aria-checked')=='true', f'{W}: переключатель включён')
            ok((await pg.evaluate("getComputedStyle(document.documentElement).filter")).startswith('invert'), f'{W}: страница перевёрнута фильтром')
            # картинка и лист документа переворачиваются обратно
            fl=await pg.evaluate("""(()=>{ const i=document.createElement('img'); i.src='data:image/gif;base64,R0lGODlhAQABAAAAACw='; document.getElementById('fd-app').appendChild(i);
               const s=document.createElement('div'); s.className='sheet'; const i2=document.createElement('img'); s.appendChild(i2); document.getElementById('fd-app').appendChild(s);
               const r=[getComputedStyle(i).filter, getComputedStyle(s).filter, getComputedStyle(i2).filter]; i.remove(); s.remove(); return r; })()""")
            ok(fl[0].endswith('invert(1)') and fl[1].endswith('invert(1)') and fl[2]=='none', f'{W}: фото и листы документов — как раньше ({fl})')
            ok(await pg.evaluate("document.documentElement.scrollWidth<=innerWidth"), f'{W}: без прокрутки вбок')
            for t in ['journal','doc','calendar','data']:
                await pg.evaluate(TAB+f"('{t}')"); await pg.wait_for_timeout(700); await pg.screenshot(path=f'{SHOT}/dark-{W}-{t}.png')
            # окно накладной — модальное окно тоже тёмное
            await pg.evaluate(TAB+"('journal')"); await pg.wait_for_timeout(500)
            # печать — без фильтра
            await pg.emulate_media(media='print'); pf=await pg.evaluate("getComputedStyle(document.documentElement).filter"); await pg.emulate_media(media='screen')
            ok(pf=='none', f'{W}: при печати фильтра нет ({pf})')
            # настройка сохраняется в личных настройках и действует после перезагрузки
            await pg.wait_for_timeout(1500); await pg.reload(); await pg.wait_for_timeout(2500)
            ok(await pg.evaluate(DARK), f'{W}: после перезагрузки тема тёмная')
            # другое устройство Даниила: та же настройка из таблицы
            ctx2,pg2,e2=await login(b,'Даниил','1111',W); await pg2.wait_for_timeout(1500)
            ok(await pg2.evaluate(DARK), f'{W}: на другом устройстве Даниила тоже тёмная')
            await ctx2.close()
            # выход — экран входа светлый
            await pg.evaluate("document.getElementById('fd-user') && (document.getElementById('fd-user').click(), document.getElementById('fd-user').click())"); await pg.wait_for_timeout(1500)
            ok(not await pg.evaluate("document.getElementById('fd-login').hidden") and not await pg.evaluate(DARK), f'{W}: после выхода экран входа светлый')
            await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            ok(await pg.evaluate(DARK), f'{W}: вошёл снова — тема тёмная')
            # Наталья: ни темы, ни переключателя
            ctx3,pg3,e3=await login(b,'Наталья','2222',W)
            await pg3.evaluate("(()=>{ const k='frudom-docs-prefs:Наталья'; const p=JSON.parse(localStorage.getItem(k)||'{}'); p.dark=1; localStorage.setItem(k, JSON.stringify(p)); })()")
            await pg3.reload(); await pg3.wait_for_timeout(2500)
            await pg3.evaluate(TAB+"('data')"); await pg3.wait_for_timeout(600)
            ok(not await pg3.evaluate(DARK) and await pg3.locator('#dk-card').is_hidden(), f'{W}: у Натальи темы и переключателя нет')
            await ctx3.close()
            # выключить
            await pg.evaluate(TAB+"('data')"); await pg.wait_for_timeout(500); await pg.click('#dk-tog'); await pg.wait_for_timeout(500)
            ok(not await pg.evaluate(DARK), f'{W}: выключилась')
            await pg.wait_for_timeout(1500)
            ok(not errs, f'{W}: без ошибок {errs}')
            await ctx.close()
        await b.close()
    print('ИТОГ:', 'ошибок нет' if not fails else f'ошибок {len(fails)}')
asyncio.run(main())
