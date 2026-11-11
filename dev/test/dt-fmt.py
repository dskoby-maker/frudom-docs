"""Задачи на день: длинный текст — ползунок прокрутки справа; кнопки Ж/К/Ч/З/список; в задаче — готовое оформление, в тексте для MAX — без значков."""
import asyncio
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
LONG="\n".join(f"Позиция {i} — {i/10} кг" for i in range(40))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for W,H in ((1300,900),(390,844)):
            pg=await b.new_page(viewport={'width':W,'height':H}); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
            await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
            await pg.evaluate("document.querySelector('nav.tabs button[data-tab=\"calendar\"]').click()"); await pg.wait_for_timeout(800)
            ta=pg.locator('#dt-text'); await ta.scroll_into_view_if_needed()
            ok(await pg.locator('#dt-add .fmtb').count()==6, f'{W}: 6 кнопок оформления')
            await ta.fill(LONG); await pg.wait_for_timeout(200)
            st=await pg.evaluate("(t=>[getComputedStyle(t).overflowY, t.scrollHeight>t.clientHeight, t.clientHeight])(document.querySelector('#dt-text'))")
            ok(st[0]=='auto' and st[1] and st[2]<=430, f'{W}: длинный текст — прокрутка внутри поля: {st}')
            await ta.fill('Огурцы 2 кг'); await pg.evaluate("(t=>t.setSelectionRange(0,6))(document.querySelector('#dt-text'))")
            await pg.click('#dt-add .fmtb[data-fmt="b"]'); await pg.wait_for_timeout(100)
            ok(await ta.input_value()=='**Огурцы** 2 кг', f'{W}: «Ж» оборачивает выделенное: {await ta.input_value()!r}')
            await pg.evaluate("(t=>t.setSelectionRange(2,8))(document.querySelector('#dt-text'))"); await pg.click('#dt-add .fmtb[data-fmt="b"]')
            ok(await ta.input_value()=='Огурцы 2 кг', f'{W}: повторное «Ж» снимает: {await ta.input_value()!r}')
            await pg.evaluate("(t=>t.setSelectionRange(7,11))(document.querySelector('#dt-text'))"); await pg.click('#dt-add .fmtb[data-fmt="u"]')
            await pg.evaluate("(t=>t.setSelectionRange(0,0))(document.querySelector('#dt-text'))"); await pg.click('#dt-add .fmtb[data-fmt="li"]')
            v=await ta.input_value(); ok(v=='• Огурцы __2 кг__', f'{W}: подчёркивание и список: {v!r}')
            await ta.press('End'); await ta.press('Shift+Enter'); await ta.type('Томаты')
            v=await ta.input_value(); ok(v.endswith('\n• Томаты'), f'{W}: список продолжается сам: {v!r}')
            ok(await pg.locator('#dt-add .fmtprev:not([hidden]) u').count()==1, f'{W}: под полем видно, как будет выглядеть')
            await pg.click('#dt-add button[type=submit]'); await pg.wait_for_timeout(500)
            t=pg.locator('#dt-list .dt-t').last
            ok(await t.locator('ul.fmtul li').count()==2 and await t.locator('u').count()==1, f'{W}: в задаче — список и подчёркнутое')
            ok(await pg.locator('#dt-add .fmtprev').is_hidden(), f'{W}: после добавления подсказка-образец скрыта')
            mx=await pg.evaluate("[...document.querySelectorAll('textarea, pre, #fd-app *')].filter(e=>/Задачи на день:/.test(e.value||'')).map(e=>e.value).join('|')")
            ok('__' not in mx and '**' not in mx, f'{W}: в тексте для MAX нет значков')
            ok(await pg.evaluate("document.documentElement.scrollWidth")==W, f'{W}: без прокрутки вбок')
            ok(not errs, f'{W}: ошибок JS нет {errs[:2]}')
            if W==390:
                await ta.fill(LONG); await pg.wait_for_timeout(200); await ta.scroll_into_view_if_needed(); await pg.screenshot(path='/tmp/dt390.png')
            await pg.close()
        await b.close()
    print('ПРОВАЛОВ:',len(fails))
asyncio.run(main())
