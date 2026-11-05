"""Резервные копии: при первом заходе за сутки копия делается сама, «Данные» → список, «Сделать копию сейчас», подсказка про ночной триггер,
Наталья копий не видит, повторный заход в те же сутки новую копию не делает."""
import asyncio, os
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
TAB="(t=>{document.querySelector('nav.tabs button[data-tab=\"journal\"]').click(); document.querySelector('nav.tabs button[data-tab=\"'+t+'\"]').click()})"
async def login(b, who, pw, vw=(1300,900)):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click(f'#fd-who [data-who="{who}"]'); await pg.fill('#fd-pass',pw); await pg.click('#fd-enter'); await pg.wait_for_timeout(3000)
    await pg.reload(); await pg.wait_for_timeout(3000); return ctx, pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path=os.environ.get("BROWSER_EXECUTABLE_PATH"))
        ctx,pg,errs=await login(b,'Даниил','1111')
        await pg.evaluate(TAB+"('data')"); await pg.wait_for_timeout(1500)
        ok(await pg.is_visible('#bk-card'), 'Даниил видит «Резервные копии таблицы»')
        t=await pg.text_content('#bk-box'); ok('Последняя копия' in t and '1 копия' in t, f'копия сделалась сама при заходе: {t[:80]}')
        ok('Ночные копии ещё не включены' in t and 'backupNightly' in t, 'подсказка, как включить ночные копии')
        await pg.click('#bk-now'); await pg.wait_for_timeout(1500)
        t=await pg.text_content('#bk-box'); ok('2 копии' in t and 'вручную' in t, 'кнопка «Сделать копию сейчас»')
        ok(await pg.locator('#bk-box a[href*="export?format=xlsx"]').count()==2, 'у каждой копии — «Открыть» и «Excel»')
        await pg.screenshot(path='/tmp/claude-0/bk-1300.png', full_page=True)
        ok(not errs, f'нет ошибок JS {errs[:2]}'); await ctx.close()
        ctx,pg,errs=await login(b,'Наталья','2222',(390,844))
        await pg.evaluate(TAB+"('data')"); await pg.wait_for_timeout(800)
        ok(await pg.is_hidden('#bk-card'), 'Наталья копий не видит'); await ctx.close()
        ctx,pg,errs=await login(b,'Даниил','1111',(390,844))
        await pg.evaluate(TAB+"('data')"); await pg.wait_for_timeout(1500)
        t=await pg.text_content('#bk-box'); ok('2 копии' in t, 'повторный заход в те же сутки — новой копии нет')
        sw=await pg.evaluate("document.documentElement.scrollWidth"); ok(sw<=390, f'телефон: нет прокрутки вбок ({sw})')
        await pg.screenshot(path='/tmp/claude-0/bk-390.png', full_page=True); await ctx.close()
        await b.close()
    print('ИТОГ:', 'всё прошло' if not fails else f'провалов {len(fails)}')
asyncio.run(main())
