"""«Мои задачи» с двух устройств: задачи не теряются, удалённая не возвращается, выполненная остаётся до «Убрать сделанные»."""
import asyncio, json, urllib.request
from playwright.async_api import async_playwright
fails=[]
def ok(c,m): print(('OK  ' if c else 'FAIL'),m); (None if c else fails.append(m))
def srv():
    d=json.load(urllib.request.urlopen('http://localhost:8787/dump')).get('Настройки пользователей') or [[]]
    for r in d[1:]:
        if r and r[0]=='Даниил':
            try: return json.loads(r[1] or '{}')
            except Exception: return {}
    return {}
async def dev(b, vw):
    ctx=await b.new_context(viewport={'width':vw[0],'height':vw[1]}); pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    await pg.goto('http://localhost:8787/page'); await pg.click('#fd-who [data-who="Даниил"]'); await pg.fill('#fd-pass','1111'); await pg.click('#fd-enter'); await pg.wait_for_timeout(2500)
    await pg.evaluate("location.hash='#zadachi'"); await pg.wait_for_timeout(800)
    return pg, errs
async def add(pg, t):
    await pg.fill('#tk-new', t); await pg.click('#tk-add'); await pg.wait_for_timeout(1800)
async def names(pg): return await pg.evaluate("[...document.querySelectorAll('#tk-my .tk.my b')].map(b=>b.textContent)")
async def reload(pg):
    await pg.reload(); await pg.wait_for_timeout(2500); await pg.evaluate("location.hash='#zadachi'"); await pg.wait_for_timeout(800)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        A,ea=await dev(b,(1300,900)); B,eb=await dev(b,(390,844))   # оба загрузились, задач нет
        await add(A,'Задача с ПК')
        ok(any(x.get('t')=='Задача с ПК' for x in srv().get('tasks',[])), 'задача с ПК в таблице')
        await add(B,'Задача с телефона')   # у телефона старые настройки — раньше это стирало задачу с ПК
        T=[x.get('t') for x in srv().get('tasks',[])]
        ok('Задача с ПК' in T and 'Задача с телефона' in T, f'в таблице обе задачи: {T}')
        await reload(A); await reload(B)
        na, nb = await names(A), await names(B)
        ok(set(na)>={'Задача с ПК','Задача с телефона'} and set(nb)>={'Задача с ПК','Задача с телефона'}, f'после перезагрузки обе видны на обоих: {na} / {nb}')
        # удаление с ПК не возвращается телефоном
        await A.click('#tk-my .tk.my:has(b:text-is("Задача с ПК")) [data-del]'); await A.click('#tk-my .tk.my:has(b:text-is("Задача с ПК")) [data-del]'); await A.wait_for_timeout(1800)
        await add(B,'Ещё с телефона')
        await reload(A); await reload(B)
        na, nb = await names(A), await names(B)
        ok('Задача с ПК' not in na and 'Задача с ПК' not in nb, f'удалённая не вернулась: {na} / {nb}')
        ok('Ещё с телефона' in na and 'Задача с телефона' in na, 'остальные на месте')
        # выполненная остаётся
        await A.check('#tk-my .tk.my:has(b:text-is("Задача с телефона")) [data-done]'); await A.wait_for_timeout(1800)
        await reload(B); nb=await names(B)
        ok('Задача с телефона' in nb and await B.locator('#tk-my .tk.my.done').count()==1, 'выполненная видна (зачёркнута) и на телефоне')
        ok(await B.evaluate("document.documentElement.scrollWidth")<=390, 'телефон без прокрутки вбок')
        ok(not ea and not eb, f'ошибок нет {ea} {eb}')
        await b.close()
    print('ИТОГ:', 'всё OK' if not fails else f'{len(fails)} ошибок')
asyncio.run(main())
